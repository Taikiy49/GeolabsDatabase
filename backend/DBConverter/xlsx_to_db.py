from __future__ import annotations

import sys
import sqlite3
from pathlib import Path

import pandas as pd

# ====== SETTINGS ======
SCRIPT_DIR = Path(__file__).resolve().parent

# DB created in same folder as this script (same as your old style)
DB_PATH = str(SCRIPT_DIR / "pnp.db")
TABLE = "pnp_table"

# Default Excel path (so you can just run the file)
DEFAULT_XLSX = r"C:\Users\tyamashita\Desktop\GeolabsSoftwares\GeolabsDatabase\backend\DBConverter\PR Data Base 2-10.xlsx"

# Column mapping: Excel headers -> DB columns
COLUMN_MAP = {
    "Date": "date",
    "Client": "client",
    "Project Name": "project_name",
    "PR #": "pr_number",
    "PR Number": "pr_number",
    "Work Order #": "work_order_number",
    "Work Order Number": "work_order_number",
    "Report Date": "report_date",
    "Invoice #": "invoice_number",
    "Invoice Number": "invoice_number",
    "Principal Engineer": "principal_engineer",
}

FIELDS = [
    "date", "client", "project_name", "pr_number",
    "work_order_number", "report_date", "invoice_number",
    "principal_engineer",
]

# ====== DB SCHEMA (UNCHANGED FROM YOUR ORIGINAL) ======
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

    db.execute(f"UPDATE {TABLE} SET created_at = datetime('now') WHERE created_at IS NULL OR TRIM(created_at)=''")
    db.execute(f"UPDATE {TABLE} SET updated_at = datetime('now') WHERE updated_at IS NULL OR TRIM(updated_at)=''")

# ====== NORMALIZATION ======
def normalize_df(df: pd.DataFrame) -> pd.DataFrame:
    # Rename columns using map (case sensitive -> relaxed)
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

    # Keep only known fields
    keep = [c for c in FIELDS if c in df.columns]
    df = df[keep].copy()

    # Ensure all fields exist
    for f in FIELDS:
        if f not in df.columns:
            df[f] = ""

    # Clean values
    for f in FIELDS:
        df[f] = df[f].fillna("").astype(str).map(lambda x: x.strip())

    # Drop fully empty rows (safe)
    df = df[~df.apply(lambda r: all((str(r[f]).strip() == "" for f in FIELDS)), axis=1)]

    return df[FIELDS]

# ====== IMPORT ======
def import_xlsx(xlsx_path: str, sheet_name: str | int | None = None):
    # Force a DataFrame (prevents dict return when sheet_name=None)
    df = pd.read_excel(xlsx_path, sheet_name=(sheet_name or 0), engine="openpyxl")
    df = normalize_df(df)

    db = sqlite3.connect(DB_PATH)
    db.execute("PRAGMA journal_mode=WAL;")
    ensure_schema(db)

    placeholders = ",".join(["?"] * len(FIELDS))
    sql = f"""
        INSERT INTO {TABLE} ({",".join(FIELDS)}, created_at, updated_at, is_deleted)
        VALUES ({placeholders}, datetime('now'), datetime('now'), 0)
    """

    rows = df.to_records(index=False)
    db.executemany(sql, [tuple(r) for r in rows])
    db.commit()
    db.close()

    print(f"✅ Imported {len(df)} rows into {DB_PATH}:{TABLE}")

def resolve_default_xlsx() -> str:
    # If the Excel exists in the same folder as this .py, use that first
    local = SCRIPT_DIR / Path(DEFAULT_XLSX).name
    if local.exists():
        return str(local)
    return DEFAULT_XLSX

if __name__ == "__main__":
    # Run with no args:
    #   python xlsx_to_db.py
    #
    # Or with args:
    #   python xlsx_to_db.py <path_to_excel.xlsx> [sheet_name]
    #
    if len(sys.argv) < 2:
        xlsx = resolve_default_xlsx()
        sheet = None
    else:
        xlsx = sys.argv[1]
        sheet = sys.argv[2] if len(sys.argv) >= 3 else None

    import_xlsx(xlsx, sheet_name=sheet)