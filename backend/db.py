import sqlite3
from pathlib import Path
from flask import g, current_app

from config import Config


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        conn = sqlite3.connect(
            Config.DB_PATH,
            detect_types=sqlite3.PARSE_DECLTYPES,
            check_same_thread=False,
            timeout=Config.SQLITE_TIMEOUT_SECONDS,
        )
        conn.row_factory = sqlite3.Row

        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.execute("PRAGMA synchronous = NORMAL;")
        conn.execute(f"PRAGMA busy_timeout = {Config.SQLITE_BUSY_TIMEOUT_MS};")
        conn.execute("PRAGMA temp_store = MEMORY;")

        g.db = conn

    return g.db


def close_db(_e=None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    db_path = Path(Config.DB_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)


def init_db_schema() -> None:
    init_db()
    schema_path = Path(current_app.root_path) / "schema.sql"
    sql = schema_path.read_text(encoding="utf-8")

    db = get_db()
    db.executescript(sql)
    db.commit()