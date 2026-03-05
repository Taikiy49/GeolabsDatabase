# config.py
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def _parse_origins(raw: str) -> list[str]:
    if not raw:
        return ["http://localhost:3000", "http://127.0.0.1:3000"]
    return [o.strip() for o in raw.split(",") if o.strip()]

class Config:
    
    DB_PATH = os.getenv("GEO_DB_PATH", str(BASE_DIR / "pnp.db"))
    JSON_SORT_KEYS = False
    # SQLite tuning
    SQLITE_TIMEOUT_SECONDS = 30          # sqlite3.connect(timeout=...)
    SQLITE_BUSY_TIMEOUT_MS = 5000        # PRAGMA busy_timeout=...

        # CORS
    ALLOWED_ORIGINS = _parse_origins(os.getenv("GEO_ALLOWED_ORIGINS", ""))

    # ✅ OCR / Gemini
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

    # ✅ PR lookup DB (the database that contains pr_data table)
    PR_DB_PATH = os.getenv("GEO_PR_DB_PATH", str(BASE_DIR / "uploads" / "pr_data.db"))
    PR_TABLE = os.getenv("GEO_PR_TABLE", "pr_data")