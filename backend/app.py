from __future__ import annotations

from flask import Flask, jsonify, request
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
        allow_headers=[
            "Content-Type",
            "Authorization",
            "X-User-Email",
            "X-User-Name",
            "X-User-Oid",
        ],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    with app.app_context():
        init_db_schema()

    @app.after_request
    def add_cors_headers(response):
        origin = request.headers.get("Origin")
        if origin and origin in Config.ALLOWED_ORIGINS:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Vary"] = "Origin"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = (
                "Content-Type, Authorization, X-User-Email, X-User-Name, X-User-Oid"
            )
            response.headers["Access-Control-Allow-Methods"] = (
                "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            )
        return response

    @app.route("/api/<path:_any>", methods=["OPTIONS"])
    def handle_options(_any):
        return ("", 204)

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