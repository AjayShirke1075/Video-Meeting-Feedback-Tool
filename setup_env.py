"""Configure GEMINI_API_KEY for InterviewIQ."""

import sys

import config
from ai_engine import save_api_key, validate_api_key


def main() -> int:
    print("\nInterviewIQ - Gemini API Setup")
    print("=" * 40)
    print("Get a free key: https://aistudio.google.com/apikey\n")

    api_key = (sys.argv[1] if len(sys.argv) > 1 else "").strip()
    if not api_key:
        api_key = input("Paste your Gemini API key: ").strip()

    if not api_key or api_key == "your_gemini_api_key_here":
        print("\nError: No valid API key provided.")
        return 1

    if not api_key.startswith("AIza"):
        print("\nWarning: Gemini keys usually start with 'AIza'. Continuing anyway...")

    print("\nTesting API key with Gemini...")
    ok, message = validate_api_key(api_key)
    if not ok:
        print(f"\nError: {message}")
        return 1

    save_api_key(api_key)
    print(f"\nSuccess! Saved to {config.ENV_FILE}")
    print("Restart the server: python run.py")
    print("Then open http://localhost:5000\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
