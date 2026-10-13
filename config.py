"""Environment and API key configuration."""

import os
from pathlib import Path

from dotenv import load_dotenv, set_key

ROOT = Path(__file__).resolve().parent
ENV_FILE = ROOT / ".env"
PLACEHOLDER_KEYS = {"", "your_gemini_api_key_here", "YOUR_API_KEY", "YOUR_API_KEY_HERE"}


def load_env() -> None:
    """Load .env from the project root (works regardless of cwd)."""
    load_dotenv(ENV_FILE, override=True)


def get_api_key() -> str:
    load_env()
    for name in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
        value = os.getenv(name, "").strip()
        if value and value not in PLACEHOLDER_KEYS:
            return value
    return ""


def save_api_key(api_key: str) -> None:
    """Persist Gemini API key to .env and reload into process env."""
    api_key = api_key.strip()
    if not ENV_FILE.exists():
        ENV_FILE.write_text(
            "# InterviewIQ environment\n"
            "GEMINI_API_KEY=\n"
            "FLASK_SECRET_KEY=interviewiq-secret-key-change-me\n",
            encoding="utf-8",
        )
    set_key(str(ENV_FILE), "GEMINI_API_KEY", api_key)
    os.environ["GEMINI_API_KEY"] = api_key
