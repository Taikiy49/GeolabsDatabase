# auth.py
from __future__ import annotations
from functools import wraps
from typing import Any, Callable
from flask import request

def require_auth(fn: Callable[..., Any]) -> Callable[..., Any]:
    """
    DEV MODE: auth disabled.
    Leaves a placeholder request.msal_claims so existing code doesn't break.
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        request.msal_claims = {
            "name": "Dev User",
            "preferred_username": "dev@local",
            "oid": "dev",
            "tid": "dev",
        }
        return fn(*args, **kwargs)
    return wrapper