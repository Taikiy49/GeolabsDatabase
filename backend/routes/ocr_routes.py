# ocr_routes.py
from __future__ import annotations

import sqlite3
from flask import Blueprint, current_app, jsonify, request

from ocr_service import extract_work_orders_from_image

bp_ocr = Blueprint("bp_ocr", __name__, url_prefix="/api")


@bp_ocr.post("/ocr-upload")
def ocr_upload():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded."}), 400

    image_file = request.files["image"]
    try:
        extracted_text = extract_work_orders_from_image(image_file)
        return jsonify({"recognized_work_orders": extracted_text})
    except Exception as e:
        return jsonify({"error": f"OCR failed: {str(e)}"}), 500


@bp_ocr.post("/lookup-work-orders")
def lookup_work_orders():
    data = request.get_json(silent=True) or {}
    work_orders = data.get("work_orders", []) or []

    pr_db = current_app.config["PR_DB_PATH"]
    table = current_app.config["PR_TABLE"]

    def connect():
        conn = sqlite3.connect(pr_db)
        conn.row_factory = sqlite3.Row
        return conn

    def fetch(cursor, prefix: str):
        cursor.execute(
            f"""
            SELECT WO, Client, Project, PR, Date
            FROM {table}
            WHERE WO LIKE ? COLLATE NOCASE
            ORDER BY WO ASC
            LIMIT 1
            """,
            (f"{prefix}%",),
        )
        return cursor.fetchone()

    results = []
    with connect() as conn:
        cur = conn.cursor()

        for wo in work_orders:
            original = (wo or "").strip()
            formatted = None

            if len(original) >= 3 and original[-1].isalpha():
                base, letter = original[:-1], original[-1]
                formatted = f"{base}({letter})"

            row = fetch(cur, formatted) if formatted else None

            if not row:
                # If input is 4 digits only, try exact-ish then prefix
                if "-" not in original and len(original) == 4:
                    row = fetch(cur, original)
                if not row:
                    row = fetch(cur, original)

            if row:
                results.append(
                    {
                        "work_order": original,
                        "project_wo": row["WO"],
                        "client": row["Client"],
                        "project": row["Project"],
                        "pr": row["PR"],
                        "date": row["Date"],
                    }
                )
            else:
                results.append(
                    {
                        "work_order": original,
                        "project_wo": "Not Found",
                        "client": "Not Found",
                        "project": "Not Found",
                        "pr": "Not Found",
                        "date": "Not Found",
                    }
                )

    return jsonify({"matches": results})