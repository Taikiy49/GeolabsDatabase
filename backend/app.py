# app.py
from __future__ import annotations

from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from db import close_db, init_db_schema
from routes import register_routes

def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, resources={r"/api/*": {"origins": Config.ALLOWED_ORIGINS}})

    with app.app_context():
        init_db_schema()

    @app.teardown_appcontext
    def _close_db(err=None):
        close_db(err)

    @app.get("/api/health")
    def health():
        return jsonify({"ok": True})

    register_routes(app)

    print("USING DB:", Config.DB_PATH)
    print("ALLOWED ORIGINS:", Config.ALLOWED_ORIGINS)
    return app

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)