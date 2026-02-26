# routes/__init__.py
from .pnp import projects_bp
from .meta import meta_bp
from .ocr_routes import bp_ocr

def register_routes(app):
    app.register_blueprint(meta_bp)
    app.register_blueprint(projects_bp)
    app.register_blueprint(bp_ocr)