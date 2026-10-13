"""Start the InterviewIQ Flask server."""
from server import app, ai

if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("  InterviewIQ AI Server")
    print("=" * 50)
    print(f"  AI Engine : {'Ready' if ai.is_ready() else 'Demo mode (add API key in app Settings)'}")
    print("  URL       : http://localhost:5000")
    print("=" * 50 + "\n")
    app.run(
        debug=False,       # reloader disabled - prevents venv watch loop
        use_reloader=False,
        host="0.0.0.0",
        port=5000,
    )
