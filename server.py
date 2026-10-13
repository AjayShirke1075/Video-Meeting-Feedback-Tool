"""
InterviewIQ - Flask Server
Main web application serving the AI Interview Analyzer
"""

import os
import uuid
import logging
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from werkzeug.utils import secure_filename
import config
from ai_engine import AIEngine, extract_text, save_api_key, validate_api_key
from emotion_engine import fuse_biometrics, aggregate_session_biometrics
from report_pdf import generate_pdf
from flask import send_file
import io

config.load_env()

# ─────────────────────────────────────────────
#  App Configuration
# ─────────────────────────────────────────────
app = Flask(__name__)
CORS(app)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "interviewiq-dev-secret")
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16 MB
app.config["UPLOAD_FOLDER"] = os.path.join(os.path.dirname(__file__), "uploads")

ALLOWED_EXTENSIONS = {"pdf", "docx", "txt"}

os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

ai = AIEngine()


# ─────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────
def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def error(msg: str, code: int = 400):
    return jsonify({"error": msg}), code


# ─────────────────────────────────────────────
#  Routes
# ─────────────────────────────────────────────
def _is_launched() -> bool:
    domain = (os.getenv("CUSTOM_DOMAIN") or "").strip().lower()
    if not domain:
        return False
    host = (request.host or "").split(":")[0].lower()
    return host == domain


@app.route("/")
def index():
    return render_template("index.html", launched=_is_launched())


@app.route("/api/health")
def health():
    ready = ai.is_ready()
    return jsonify({
        "status": "ok",
        "ai_ready": ready,
        "offline_mode": not ready,
        "message": "AI ready" if ready else "Demo mode. Add a Gemini API key in Settings for full scoring.",
    })


@app.route("/api/set-api-key", methods=["POST"])
def set_api_key():
    """Validate and save Gemini API key to .env."""
    try:
        data = request.get_json(silent=True) or {}
        api_key = (data.get("api_key") or request.form.get("api_key") or "").strip()

        if not api_key:
            return error("API key is required")

        ok, message = validate_api_key(api_key)
        if not ok:
            return error(message, 400)

        save_api_key(api_key)
        logger.info("Gemini API key configured successfully")
        return jsonify({"success": True, "message": "Gemini API key saved and verified", "ai_ready": True})

    except Exception as e:
        logger.exception("Failed to save API key")
        return error(f"Could not save API key: {e}", 500)


def _read_uploaded_file(field_name: str) -> str:
    """Extract text from an uploaded file field, then delete the temp file."""
    if field_name not in request.files:
        return ""
    file = request.files[field_name]
    if not file or not file.filename or not allowed_file(file.filename):
        return ""

    original_name = secure_filename(file.filename)
    unique_name = f"{uuid.uuid4()}_{original_name}"
    filepath = os.path.join(app.config["UPLOAD_FOLDER"], unique_name)
    file.save(filepath)
    try:
        return extract_text(filepath, original_name)
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


@app.route("/api/upload", methods=["POST"])
def upload():
    """
    Accept resume + job description (file upload or pasted text).
    Returns AI-generated interview questions.
    """
    try:
        job_description = _read_uploaded_file("job_description_file")
        if not job_description:
            job_description = request.form.get("job_description", "").strip()

        if not job_description:
            return error("Please upload a job description file or paste the job description text")

        if len(job_description) < 50:
            return error("Job description is too short - paste at least 100 characters for best results")

        resume_text = _read_uploaded_file("resume")
        if not resume_text:
            resume_text = request.form.get("resume_text", "").strip()

        if not resume_text:
            return error("Please upload a resume (PDF/DOCX/TXT) or paste your resume text")

        if len(resume_text) < 50:
            return error("Resume text is too short - please provide more content")

        logger.info("Generating questions | resume=%d chars | jd=%d chars",
                    len(resume_text), len(job_description))

        result = ai.generate_questions(resume_text, job_description)

        # Send back truncated context for client-side storage (for answer analysis)
        result["resume_context"] = resume_text[:2000]
        result["job_context"]    = job_description[:800]
        result["offline_mode"] = ai.using_offline_mode()

        return jsonify(result)

    except RuntimeError as e:
        logger.error("Upload error: %s", e)
        return error(str(e), 500)
    except Exception as e:
        logger.exception("Unexpected upload error")
        return error(f"Server error: {e}", 500)


@app.route("/api/analyze-answer", methods=["POST"])
def analyze_answer():
    """
    Analyze a single interview answer with Gemini.
    """
    try:
        data = request.get_json(silent=True) or {}

        question      = (data.get("question") or "").strip()
        answer        = (data.get("answer") or "").strip()
        resume_ctx    = (data.get("resume_context") or "")[:1000]
        job_ctx       = (data.get("job_context") or "")[:400]
        biometrics    = data.get("biometrics")

        if not question:
            return error("Question is required")
        if not answer:
            return error("Answer is required")

        logger.info("Analyzing answer | question_len=%d | answer_words=%d | biometrics=%s",
                    len(question), len(answer.split()), bool(biometrics))

        result = ai.analyze_answer(question, answer, resume_ctx, job_ctx, biometrics=biometrics)
        return jsonify(result)

    except RuntimeError as e:
        logger.error("Analysis error: %s", e)
        return error(str(e), 500)
    except Exception as e:
        logger.exception("Unexpected analysis error")
        return error(f"Server error: {e}", 500)


@app.route("/api/final-report", methods=["POST"])
def final_report():
    """
    Generate a comprehensive coaching report from the full session.
    """
    try:
        data         = request.get_json(silent=True) or {}
        session_data = data.get("session", {})

        if not session_data.get("answers"):
            return error("No session data provided")

        logger.info("Generating final report | questions=%d",
                    len(session_data.get("answers", [])))

        result = ai.generate_final_report(session_data)
        return jsonify(result)

    except RuntimeError as e:
        logger.error("Report error: %s", e)
        return error(str(e), 500)
    except Exception as e:
        logger.exception("Unexpected report error")
        return error(f"Server error: {e}", 500)


@app.route("/api/export-pdf", methods=["POST"])
def export_pdf():
    """Generate a premium PDF assessment report."""
    try:
        data = request.get_json(silent=True) or {}
        session_data = data.get("session", {})
        report = data.get("report", {})

        if not session_data.get("answers"):
            return error("No session data provided")

        session_data["biometrics_summary"] = aggregate_session_biometrics(
            session_data.get("answers", [])
        )
        session_data["candidate_name"] = session_data.get("candidate_name", "Candidate")
        session_data["role"] = session_data.get("role", "Professional")

        pdf_bytes = generate_pdf(session_data, report)
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"InterviewIQ_Report_{session_data.get('role', 'Session').replace(' ', '_')}.pdf",
        )
    except Exception as e:
        logger.exception("PDF export error")
        return error(f"PDF generation failed: {e}", 500)


# ─────────────────────────────────────────────
#  Entry Point
# ─────────────────────────────────────────────
if __name__ == "__main__":
    print("\n" + "=" * 50)
    print("  InterviewIQ AI Server")
    print("=" * 50)
    print(f"  AI Engine : {'Ready' if ai.is_ready() else 'Demo mode (add API key in app Settings)'}")
    print("  URL       : http://localhost:5000")
    print("=" * 50 + "\n")
    app.run(debug=True, host="0.0.0.0", port=5000)
