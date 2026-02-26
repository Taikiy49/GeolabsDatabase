# routes/meta.py
from flask import Blueprint, jsonify
from db import get_db

meta_bp = Blueprint("meta", __name__, url_prefix="/api")

TABLE = "pnp_table"

@meta_bp.get("/health")
def health():
    return jsonify({"ok": True})

@meta_bp.get("/stats")
def stats():
    db = get_db()

    # ✅ ignore deleted rows
    total = db.execute(
        f"SELECT COUNT(*) AS c FROM {TABLE} WHERE is_deleted = 0"
    ).fetchone()["c"]

    with_wo = db.execute(
        f"""
        SELECT COUNT(*) AS c
        FROM {TABLE}
        WHERE is_deleted = 0
          AND work_order_number IS NOT NULL
          AND TRIM(work_order_number) != ''
        """
    ).fetchone()["c"]

    with_invoice = db.execute(
        f"""
        SELECT COUNT(*) AS c
        FROM {TABLE}
        WHERE is_deleted = 0
          AND invoice_number IS NOT NULL
          AND TRIM(invoice_number) != ''
        """
    ).fetchone()["c"]

    clients = db.execute(
        f"""
        SELECT COUNT(DISTINCT client) AS c
        FROM {TABLE}
        WHERE is_deleted = 0
          AND client IS NOT NULL
          AND TRIM(client) != ''
        """
    ).fetchone()["c"]

    return jsonify({
        "total_projects": total,
        "projects_with_work_orders": with_wo,
        "projects_with_invoices": with_invoice,
        "unique_clients": clients
    })