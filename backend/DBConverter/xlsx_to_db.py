from __future__ import annotations

import sys
import sqlite3
from pathlib import Path

import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
DB_PATH = str(SCRIPT_DIR / "pnp.db")
TABLE = "pnp_table"

DEFAULT_XLSX = r"C:\Users\tyamashita\Desktop\GeolabsSoftwares\GeolabsDatabase\backend\DBConverter\PR Data Base 3-10.xlsx"

COLUMN_MAP = {
    "Date": "date",
    "Client": "client",
    "Project Name": "project_name",
    "PR #": "pr_number",
    "PR Number": "pr_number",
    "Work Order #": "work_order_number",
    "Work Order Number": "work_order_number",
    "Report Date": "report_date",
    "Final Report Date": "report_date",
    "Invoice #": "invoice_number",
    "Invoice Number": "invoice_number",
    "Principal Engineer": "principal_engineer",
}

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


def ensure_schema(db: sqlite3.Connection):
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

    cols = [r[1] for r in db.execute(f"PRAGMA table_info({TABLE})").fetchall()]
    needed = {
        "created_at": "TEXT",
        "updated_at": "TEXT",
        "is_deleted": "INTEGER DEFAULT 0",
    }
    for col, ddl in needed.items():
        if col not in cols:
            db.execute(f"ALTER TABLE {TABLE} ADD COLUMN {col} {ddl}")

    db.execute(
        f"UPDATE {TABLE} SET created_at = datetime('now') "
        f"WHERE created_at IS NULL OR TRIM(created_at) = ''"
    )
    db.execute(
        f"UPDATE {TABLE} SET updated_at = datetime('now') "
        f"WHERE updated_at IS NULL OR TRIM(updated_at) = ''"
    )

    db.execute(f"CREATE INDEX IF NOT EXISTS idx_{TABLE}_date ON {TABLE}(date)")
    db.execute(f"CREATE INDEX IF NOT EXISTS idx_{TABLE}_report_date ON {TABLE}(report_date)")
    db.execute(f"CREATE INDEX IF NOT EXISTS idx_{TABLE}_client ON {TABLE}(client)")
    db.execute(f"CREATE INDEX IF NOT EXISTS idx_{TABLE}_pr ON {TABLE}(pr_number)")
    db.execute(f"CREATE INDEX IF NOT EXISTS idx_{TABLE}_wo ON {TABLE}(work_order_number)")


def normalize_date_value(value) -> str:
    if pd.isna(value):
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


def normalize_text_value(value) -> str:
    if pd.isna(value):
        return ""
    return str(value).strip()


def normalize_df(df: pd.DataFrame) -> pd.DataFrame:
    rename = {}
    for c in df.columns:
        c2 = str(c).strip()
        if c2 in COLUMN_MAP:
            rename[c] = COLUMN_MAP[c2]
        else:
            key = c2.lower().replace("\n", " ").strip()
            for k, v in COLUMN_MAP.items():
                if key == k.lower():
                    rename[c] = v
                    break

    df = df.rename(columns=rename)

    keep = [c for c in FIELDS if c in df.columns]
    df = df[keep].copy()

    for f in FIELDS:
        if f not in df.columns:
            df[f] = ""

    for f in FIELDS:
        if f in DATE_FIELDS:
            df[f] = df[f].map(normalize_date_value)
        else:
            df[f] = df[f].map(normalize_text_value)

    df = df[
        ~df.apply(
            lambda r: all(str(r[f]).strip() == "" for f in FIELDS),
            axis=1,
        )
    ]

    return df[FIELDS]


def clean_existing_dates(db: sqlite3.Connection):
    rows = db.execute(f"SELECT id, date, report_date FROM {TABLE}").fetchall()

    for r in rows:
        updates = {}

        for field in DATE_FIELDS:
            value = r["date"] if field == "date" else r["report_date"]
            if value is None or str(value).strip() == "":
                continue

            cleaned = normalize_date_value(value)
            if cleaned:
                updates[field] = cleaned

        if updates:
            sets = ", ".join([f"{k} = ?" for k in updates])
            db.execute(
                f"UPDATE {TABLE} SET {sets}, updated_at = datetime('now') WHERE id = ?",
                list(updates.values()) + [r["id"]],
            )


def import_xlsx(xlsx_path: str, sheet_name: str | int | None = None, replace_existing: bool = True):
    df = pd.read_excel(xlsx_path, sheet_name=(sheet_name or 0), engine="openpyxl")
    df = normalize_df(df)

    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL;")
    db.execute("PRAGMA foreign_keys = ON;")
    ensure_schema(db)

    if replace_existing:
        db.execute(f"DELETE FROM {TABLE}")

    placeholders = ",".join(["?"] * len(FIELDS))
    sql = f"""
        INSERT INTO {TABLE} ({",".join(FIELDS)}, created_at, updated_at, is_deleted)
        VALUES ({placeholders}, datetime('now'), datetime('now'), 0)
    """

    rows = df.to_records(index=False)
    db.executemany(sql, [tuple(r) for r in rows])

    clean_existing_dates(db)
    db.commit()
    db.close()

    print(f"✅ Imported {len(df)} rows into {DB_PATH}:{TABLE}")


def resolve_default_xlsx() -> str:
    local = SCRIPT_DIR / Path(DEFAULT_XLSX).name
    if local.exists():
        return str(local)
    return DEFAULT_XLSX


if __name__ == "__main__":
    if len(sys.argv) < 2:
        xlsx = resolve_default_xlsx()
        sheet = None
    else:
        xlsx = sys.argv[1]
        sheet = sys.argv[2] if len(sys.argv) >= 3 else None

    import_xlsx(xlsx, sheet_name=sheet, replace_existing=True)