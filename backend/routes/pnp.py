from __future__ import annotations

import json
import sqlite3
from typing import Any, Dict, List, Optional

from flask import Blueprint, request, jsonify
from db import get_db

projects_bp = Blueprint("projects", __name__, url_prefix="/api/projects")

TABLE = "pnp_table"
HISTORY_TABLE = "pnp_history"
UNDO_TABLE = "pnp_undo_stack"

FIELDS = [
    "date",
    "client",
    "project_name",
    "pr_number",
    "work_order_number",
    "report_date",
    "invoice_number",
    "principal_engineer",
]

DATE_FIELDS = {"date", "report_date"}

PRETTY = {
    "date": "Date",
    "client": "Client",
    "project_name": "Project",
    "pr_number": "PR #",
    "work_order_number": "Work Order #",
    "report_date": "Final Report Date",
    "invoice_number": "Invoice #",
    "principal_engineer": "Engineer",
}


def row_to_dict(r: sqlite3.Row) -> dict:
    return {k: r[k] for k in r.keys()}


def now_sql() -> str:
    return "datetime('now')"


import pandas as pd

def normalize_date_string(value: Any) -> str:
    if value is None:
        return ""

    s = str(value).strip()
    if not s:
        return ""

    try:
        dt = pd.to_datetime(s, errors="coerce")
        if pd.notna(dt):
            return dt.strftime("%Y-%m-%d")
    except Exception:
        pass

    if "T" in s:
        s = s.split("T")[0].strip()
    if " " in s:
        s = s.split(" ")[0].strip()

    try:
        dt = pd.to_datetime(s, errors="coerce")
        if pd.notna(dt):
            return dt.strftime("%Y-%m-%d")
    except Exception:
        pass

    return ""

def normalize_row_dates(row: Optional[dict]) -> Optional[dict]:
    if row is None:
        return None

    out = dict(row)
    for field in DATE_FIELDS:
        out[field] = normalize_date_string(out.get(field, ""))
    return out


def ensure_schema(db: sqlite3.Connection) -> None:
    db.execute(f"""
        CREATE TABLE IF NOT EXISTS {TABLE} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            client TEXT,
            project_name TEXT,
            pr_number TEXT,
            work_order_number TEXT,
            report_date TEXT,
            invoice_number TEXT,
            principal_engineer TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            is_deleted INTEGER DEFAULT 0
        )
    """)

    db.execute(f"""
        CREATE TABLE IF NOT EXISTS {HISTORY_TABLE} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            action TEXT NOT NULL,
            before_json TEXT,
            after_json TEXT,
            changed_fields_json TEXT,
            summary TEXT,
            user_email TEXT,
            user_name TEXT,
            user_oid TEXT,
            changed_at TEXT DEFAULT (datetime('now'))
        )
    """)

    db.execute(f"""
        CREATE TABLE IF NOT EXISTS {UNDO_TABLE} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            action TEXT NOT NULL,
            before_json TEXT,
            after_json TEXT,
            changed_fields_json TEXT,
            summary TEXT,
            user_email TEXT,
            user_name TEXT,
            user_oid TEXT,
            changed_at TEXT,
            undone_at TEXT DEFAULT (datetime('now'))
        )
    """)

    main_cols = [r["name"] for r in db.execute(f"PRAGMA table_info({TABLE})").fetchall()]
    needed_main = {
        "created_at": "TEXT DEFAULT (datetime('now'))",
        "updated_at": "TEXT DEFAULT (datetime('now'))",
        "is_deleted": "INTEGER DEFAULT 0",
    }
    for col, ddl in needed_main.items():
        if col not in main_cols:
            db.execute(f"ALTER TABLE {TABLE} ADD COLUMN {col} {ddl}")

    hist_cols = [r["name"] for r in db.execute(f"PRAGMA table_info({HISTORY_TABLE})").fetchall()]
    for col in ["changed_fields_json", "summary", "user_email", "user_name", "user_oid"]:
        if col not in hist_cols:
            db.execute(f"ALTER TABLE {HISTORY_TABLE} ADD COLUMN {col} TEXT")

    undo_cols = [r["name"] for r in db.execute(f"PRAGMA table_info({UNDO_TABLE})").fetchall()]
    for col in ["changed_fields_json", "summary", "user_email", "user_name", "user_oid"]:
        if col not in undo_cols:
            db.execute(f"ALTER TABLE {UNDO_TABLE} ADD COLUMN {col} TEXT")

    db.execute(f"CREATE INDEX IF NOT EXISTS idx_pnp_date ON {TABLE}(date)")
    db.execute(f"CREATE INDEX IF NOT EXISTS idx_pnp_report_date ON {TABLE}(report_date)")
    db.execute(f"CREATE INDEX IF NOT EXISTS idx_pnp_client ON {TABLE}(client)")
    db.execute(f"CREATE INDEX IF NOT EXISTS idx_pnp_pr ON {TABLE}(pr_number)")
    db.execute(f"CREATE INDEX IF NOT EXISTS idx_pnp_wo ON {TABLE}(work_order_number)")
    db.execute(f"CREATE INDEX IF NOT EXISTS idx_pnp_history_project ON {HISTORY_TABLE}(project_id)")
    db.execute(f"CREATE INDEX IF NOT EXISTS idx_pnp_history_changed_at ON {HISTORY_TABLE}(changed_at)")
    db.execute(f"CREATE INDEX IF NOT EXISTS idx_pnp_undo_undone_at ON {UNDO_TABLE}(undone_at)")


def normalize_existing_dates(db: sqlite3.Connection) -> None:
    rows = db.execute(f"SELECT id, date, report_date FROM {TABLE}").fetchall()

    for row in rows:
        new_date = normalize_date_string(row["date"])
        new_report_date = normalize_date_string(row["report_date"])

        db.execute(
            f"""
            UPDATE {TABLE}
            SET date = ?, report_date = ?
            WHERE id = ?
            """,
            (new_date, new_report_date, row["id"]),
        )

def clean_payload(payload: Dict[str, Any]) -> Dict[str, str]:
    out: Dict[str, str] = {}
    for k in FIELDS:
        if k in payload:
            val = (payload.get(k) or "").strip()
            if k in DATE_FIELDS:
                val = normalize_date_string(val)
            out[k] = val
    return out


def fetch_one(db: sqlite3.Connection, project_id: int) -> Optional[sqlite3.Row]:
    return db.execute(
        f"SELECT * FROM {TABLE} WHERE id = ?",
        (project_id,),
    ).fetchone()


def _norm(v: Any) -> str:
    if v is None:
        return ""
    return str(v).strip()


def diff_fields(before: Optional[dict], after: Optional[dict]) -> List[dict]:
    b = before or {}
    a = after or {}
    keys = sorted({*b.keys(), *a.keys()})
    ignore = {"id", "created_at", "updated_at", "is_deleted"}
    changes: List[dict] = []
    for k in keys:
        if k in ignore:
            continue
        bv = _norm(b.get(k))
        av = _norm(a.get(k))
        if bv != av:
            changes.append({
                "key": k,
                "label": PRETTY.get(k, k),
                "before": bv,
                "after": av,
            })
    return changes


def build_summary(action: str, before: Optional[dict], after: Optional[dict]) -> str:
    base = before if action == "delete" else after
    base = base or {}
    bits = [
        _norm(base.get("client")),
        _norm(base.get("project_name")),
    ]
    wo = _norm(base.get("work_order_number"))
    pr = _norm(base.get("pr_number"))
    if wo:
        bits.append(f"WO {wo}")
    if pr:
        bits.append(f"PR {pr}")
    s = " • ".join([b for b in bits if b])
    return s or "Project change"


def _actor_from_request() -> Dict[str, str]:
    email = (request.headers.get("X-User-Email") or "").strip()
    name = (request.headers.get("X-User-Name") or "").strip()
    oid = (request.headers.get("X-User-Oid") or "").strip()

    if not (email or name or oid):
        claims = getattr(request, "msal_claims", {}) or {}
        email = claims.get("preferred_username") or claims.get("upn") or claims.get("email") or ""
        name = claims.get("name") or ""
        oid = claims.get("oid") or ""

    return {"email": str(email or ""), "name": str(name or ""), "oid": str(oid or "")}


def write_history(
    db: sqlite3.Connection,
    project_id: int,
    action: str,
    before_row: Optional[dict],
    after_row: Optional[dict],
) -> None:
    before_row = normalize_row_dates(before_row)
    after_row = normalize_row_dates(after_row)

    changes = diff_fields(before_row, after_row)
    summary = build_summary(action, before_row, after_row)

    before_json = json.dumps(before_row) if before_row is not None else None
    after_json = json.dumps(after_row) if after_row is not None else None
    changed_fields_json = json.dumps(changes)

    actor = _actor_from_request()

    db.execute(
        f"""
        INSERT INTO {HISTORY_TABLE}
          (project_id, action, before_json, after_json, changed_fields_json, summary,
           user_email, user_name, user_oid)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            project_id,
            action,
            before_json,
            after_json,
            changed_fields_json,
            summary,
            actor["email"],
            actor["name"],
            actor["oid"],
        ),
    )

    db.execute(f"DELETE FROM {UNDO_TABLE}")


def history_row_to_ui(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "project_id": r["project_id"],
        "action": r["action"],
        "changed_at": r["changed_at"],
        "summary": r["summary"] or "",
        "changes": json.loads(r["changed_fields_json"]) if r["changed_fields_json"] else [],
        "before": json.loads(r["before_json"]) if r["before_json"] else None,
        "after": json.loads(r["after_json"]) if r["after_json"] else None,
        "username": r["user_email"] or "",
        "name": r["user_name"] or "",
        "oid": r["user_oid"] or "",
    }



@projects_bp.get("")
def list_projects():
    q = (request.args.get("q") or "").strip()
    page = max(int(request.args.get("page", 1)), 1)
    page_size = min(max(int(request.args.get("page_size", 25)), 5), 200)
    offset = (page - 1) * page_size

    where = ["is_deleted = 0"]
    params: List[Any] = []

    if q:
        like = f"%{q}%"
        where.append("""
            (client LIKE ? OR project_name LIKE ? OR pr_number LIKE ?
             OR work_order_number LIKE ? OR invoice_number LIKE ? OR principal_engineer LIKE ?)
        """)
        params += [like, like, like, like, like, like]

    where_sql = "WHERE " + " AND ".join(where)

    db = get_db()
    total = db.execute(f"SELECT COUNT(*) AS c FROM {TABLE} {where_sql}", params).fetchone()["c"]

    rows = db.execute(f"""
        SELECT *
        FROM {TABLE}
        {where_sql}
        ORDER BY
          CASE WHEN date IS NULL OR TRIM(date)='' THEN 1 ELSE 0 END,
          date DESC,
          id DESC
        LIMIT ? OFFSET ?
    """, params + [page_size, offset]).fetchall()

    items = []
    for r in rows:
        items.append(normalize_row_dates(row_to_dict(r)))

    return jsonify({
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": items,
    })


@projects_bp.post("")
def create_project():
    payload = request.get_json(force=True) or {}
    data = clean_payload(payload)
    for k in FIELDS:
        if k not in data:
            data[k] = ""

    db = get_db()
    cur = db.execute(
        f"""
        INSERT INTO {TABLE} ({",".join(FIELDS)}, created_at, updated_at, is_deleted)
        VALUES ({",".join(["?"] * len(FIELDS))}, {now_sql()}, {now_sql()}, 0)
        """,
        [data[k] for k in FIELDS],
    )
    db.commit()

    row = fetch_one(db, cur.lastrowid)
    if row:
        write_history(db, cur.lastrowid, "create", None, row_to_dict(row))
        db.commit()

    row2 = fetch_one(db, cur.lastrowid)
    return jsonify(normalize_row_dates(row_to_dict(row2))), 201


@projects_bp.patch("/<int:project_id>")
def patch_project(project_id: int):
    payload = request.get_json(force=True) or {}
    data = clean_payload(payload)

    if not data:
        return jsonify({"error": "No valid fields to update"}), 400

    db = get_db()
    before = fetch_one(db, project_id)
    if not before or before["is_deleted"] == 1:
        return jsonify({"error": "Not found"}), 404

    sets = ", ".join([f"{k} = ?" for k in data.keys()])
    params = list(data.values()) + [project_id]

    db.execute(f"UPDATE {TABLE} SET {sets}, updated_at = {now_sql()} WHERE id = ?", params)
    db.commit()

    after = fetch_one(db, project_id)
    write_history(db, project_id, "update", row_to_dict(before), row_to_dict(after))
    db.commit()

    return jsonify(normalize_row_dates(row_to_dict(after)))


@projects_bp.put("/<int:project_id>")
def update_project(project_id: int):
    payload = request.get_json(force=True) or {}
    data = clean_payload(payload)

    if not data:
        return jsonify({"error": "No fields to update"}), 400

    db = get_db()
    before = fetch_one(db, project_id)
    if not before or before["is_deleted"] == 1:
        return jsonify({"error": "Not found"}), 404

    sets = ", ".join([f"{k} = ?" for k in data.keys()])
    params = list(data.values()) + [project_id]

    db.execute(f"UPDATE {TABLE} SET {sets}, updated_at = {now_sql()} WHERE id = ?", params)
    db.commit()

    after = fetch_one(db, project_id)
    write_history(db, project_id, "update", row_to_dict(before), row_to_dict(after))
    db.commit()

    return jsonify(normalize_row_dates(row_to_dict(after)))


@projects_bp.delete("/<int:project_id>")
def delete_project(project_id: int):
    db = get_db()
    before = fetch_one(db, project_id)
    if not before or before["is_deleted"] == 1:
        return jsonify({"error": "Not found"}), 404

    db.execute(f"UPDATE {TABLE} SET is_deleted = 1, updated_at = {now_sql()} WHERE id = ?", (project_id,))
    db.commit()

    after = fetch_one(db, project_id)
    write_history(db, project_id, "delete", row_to_dict(before), row_to_dict(after))
    db.commit()

    return jsonify({"ok": True})


@projects_bp.get("/history")
def get_history():
    project_id = request.args.get("project_id")
    page = max(int(request.args.get("page", 1)), 1)
    page_size = min(max(int(request.args.get("page_size", 25)), 5), 200)
    offset = (page - 1) * page_size

    where = []
    params: List[Any] = []
    if project_id:
        where.append("project_id = ?")
        params.append(int(project_id))

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    db = get_db()
    total = db.execute(f"SELECT COUNT(*) AS c FROM {HISTORY_TABLE} {where_sql}", params).fetchone()["c"]

    rows = db.execute(
        f"""
        SELECT *
        FROM {HISTORY_TABLE}
        {where_sql}
        ORDER BY id DESC
        LIMIT ? OFFSET ?
        """,
        params + [page_size, offset],
    ).fetchall()

    return jsonify({
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": [history_row_to_ui(r) for r in rows],
    })


@projects_bp.post("/undo")
def undo_last():
    db = get_db()
    last = db.execute(f"SELECT * FROM {HISTORY_TABLE} ORDER BY id DESC LIMIT 1").fetchone()

    if not last:
        return jsonify({"error": "Nothing to undo"}), 400

    action = last["action"]
    project_id = last["project_id"]
    before = json.loads(last["before_json"]) if last["before_json"] else None
    after = json.loads(last["after_json"]) if last["after_json"] else None
    changed_at = last["changed_at"]

    db.execute(
        f"""
        INSERT INTO {UNDO_TABLE}
          (project_id, action, before_json, after_json, changed_fields_json, summary,
           user_email, user_name, user_oid, changed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            project_id,
            action,
            last["before_json"],
            last["after_json"],
            last["changed_fields_json"],
            last["summary"],
            last["user_email"],
            last["user_name"],
            last["user_oid"],
            changed_at,
        ),
    )

    if action == "update":
        if not before:
            return jsonify({"error": "Cannot undo update (missing before state)"}), 400
        before = normalize_row_dates(before)
        sets = ", ".join([f"{k} = ?" for k in FIELDS] + ["is_deleted = 0", f"updated_at = {now_sql()}"])
        vals = [before.get(k, "") or "" for k in FIELDS] + [project_id]
        db.execute(f"UPDATE {TABLE} SET {sets} WHERE id = ?", vals)

    elif action == "create":
        db.execute(f"UPDATE {TABLE} SET is_deleted = 1, updated_at = {now_sql()} WHERE id = ?", (project_id,))

    elif action == "delete":
        db.execute(f"UPDATE {TABLE} SET is_deleted = 0, updated_at = {now_sql()} WHERE id = ?", (project_id,))
        if before:
            before = normalize_row_dates(before)
            sets = ", ".join([f"{k} = ?" for k in FIELDS])
            vals = [before.get(k, "") or "" for k in FIELDS] + [project_id]
            db.execute(f"UPDATE {TABLE} SET {sets} WHERE id = ?", vals)

    else:
        return jsonify({"error": f"Unknown action: {action}"}), 400

    db.execute(f"DELETE FROM {HISTORY_TABLE} WHERE id = ?", (last["id"],))
    db.commit()

    return jsonify({"ok": True, "undid": {"action": action, "project_id": project_id}})


@projects_bp.post("/redo")
def redo_last():
    db = get_db()
    last = db.execute(f"SELECT * FROM {UNDO_TABLE} ORDER BY id DESC LIMIT 1").fetchone()

    if not last:
        return jsonify({"error": "Nothing to redo"}), 400

    action = last["action"]
    project_id = last["project_id"]
    before = json.loads(last["before_json"]) if last["before_json"] else None
    after = json.loads(last["after_json"]) if last["after_json"] else None

    actor = _actor_from_request()

    if action == "update":
        if not after:
            return jsonify({"error": "Cannot redo update (missing after state)"}), 400
        after = normalize_row_dates(after)
        sets = ", ".join([f"{k} = ?" for k in FIELDS] + ["is_deleted = 0", f"updated_at = {now_sql()}"])
        vals = [after.get(k, "") or "" for k in FIELDS] + [project_id]
        db.execute(f"UPDATE {TABLE} SET {sets} WHERE id = ?", vals)

        db.execute(
            f"""
            INSERT INTO {HISTORY_TABLE}
              (project_id, action, before_json, after_json, changed_fields_json, summary, changed_at,
               user_email, user_name, user_oid)
            VALUES (?, ?, ?, ?, ?, ?, {now_sql()}, ?, ?, ?)
            """,
            (
                project_id,
                "update",
                json.dumps(normalize_row_dates(before)) if before else None,
                json.dumps(after) if after else None,
                last["changed_fields_json"],
                last["summary"],
                actor["email"],
                actor["name"],
                actor["oid"],
            ),
        )

    elif action == "create":
        db.execute(f"UPDATE {TABLE} SET is_deleted = 0, updated_at = {now_sql()} WHERE id = ?", (project_id,))
        if after:
            after = normalize_row_dates(after)
            sets = ", ".join([f"{k} = ?" for k in FIELDS])
            vals = [after.get(k, "") or "" for k in FIELDS] + [project_id]
            db.execute(f"UPDATE {TABLE} SET {sets} WHERE id = ?", vals)

        db.execute(
            f"""
            INSERT INTO {HISTORY_TABLE}
              (project_id, action, before_json, after_json, changed_fields_json, summary, changed_at,
               user_email, user_name, user_oid)
            VALUES (?, ?, ?, ?, ?, ?, {now_sql()}, ?, ?, ?)
            """,
            (
                project_id,
                "create",
                None,
                json.dumps(after) if after else None,
                last["changed_fields_json"],
                last["summary"],
                actor["email"],
                actor["name"],
                actor["oid"],
            ),
        )

    elif action == "delete":
        db.execute(f"UPDATE {TABLE} SET is_deleted = 1, updated_at = {now_sql()} WHERE id = ?", (project_id,))

        db.execute(
            f"""
            INSERT INTO {HISTORY_TABLE}
              (project_id, action, before_json, after_json, changed_fields_json, summary, changed_at,
               user_email, user_name, user_oid)
            VALUES (?, ?, ?, ?, ?, ?, {now_sql()}, ?, ?, ?)
            """,
            (
                project_id,
                "delete",
                json.dumps(normalize_row_dates(before)) if before else None,
                json.dumps(normalize_row_dates(after)) if after else None,
                last["changed_fields_json"],
                last["summary"],
                actor["email"],
                actor["name"],
                actor["oid"],
            ),
        )

    else:
        return jsonify({"error": f"Unknown action: {action}"}), 400

    db.execute(f"DELETE FROM {UNDO_TABLE} WHERE id = ?", (last["id"],))
    db.commit()

    return jsonify({"ok": True, "redid": {"action": action, "project_id": project_id}})