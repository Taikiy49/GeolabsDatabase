from __future__ import annotations

from flask import Flask, jsonify
from flask_cors import CORS

from config import Config
from db import close_db, init_db_schema
from routes import register_routes

def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(
        app,
        resources={r"/api/*": {"origins": Config.ALLOWED_ORIGINS}},
        supports_credentials=True,
    )

    with app.app_context():
        init_db_schema()

    @app.teardown_appcontext
    def _close_db(err=None):
        close_db(err)

    @app.get("/api/health")
    def health():
        return jsonify({
            "ok": True,
            "db_path": Config.DB_PATH,
            "allowed_origins": Config.ALLOWED_ORIGINS,
            "api_base_url": Config.API_BASE_URL,
        })

    register_routes(app)

    print("USING DB:", Config.DB_PATH)
    print("ALLOWED ORIGINS:", Config.ALLOWED_ORIGINS)
    print("API BASE URL:", Config.API_BASE_URL)

    return app

app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=7000, debug=True)