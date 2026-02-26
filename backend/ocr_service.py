# ocr_service.py
from __future__ import annotations

from typing import Union
from PIL import Image

import google.generativeai as genai
from flask import current_app


def _get_model():
    api_key = current_app.config.get("GEMINI_API_KEY") or ""
    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY in environment/config.")
    genai.configure(api_key=api_key)
    return genai.GenerativeModel("gemini-2.5-pro")


PROMPT = """
You are an expert document analyzer.

Extract all valid work order numbers from the image. A valid work order follows these formats:
- 4 digits (e.g., 8292)
- 4 digits + dash + 2 digits (e.g., 8292-05)
- Optional 1 uppercase letter at the end (e.g., 8292-05B)
- Optional parentheses with 1 uppercase letter only after a dashed format (e.g., 8292-05(S))

❌ Do NOT include:
- Explanations
- Introductions like "Here is the list..."
- Any extra commentary

✅ Just output a clean bullet list, like:
- 8292
- 8292-05
- 8292-05B
- 8292-05(S)

Output only the bullet list. Nothing else.
""".strip()


def extract_work_orders_from_image(image_path_or_file: Union[str, object]) -> str:
    """
    image_path_or_file:
      - str path OR
      - Werkzeug FileStorage (request.files["image"]) or similar with .stream
    Returns:
      - bullet-list text
    """
    model = _get_model()

    image = (
        Image.open(image_path_or_file)
        if isinstance(image_path_or_file, str)
        else Image.open(image_path_or_file.stream)
    )

    resp = model.generate_content(
        [PROMPT, image],
        generation_config={"temperature": 0.2},
    )
    return (resp.text or "").strip()