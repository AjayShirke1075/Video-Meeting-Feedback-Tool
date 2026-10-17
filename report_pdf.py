"""
Premium PDF report generator for interview sessions.
"""

from __future__ import annotations

import io
from datetime import datetime

from fpdf import FPDF
from fpdf.enums import XPos, YPos


def _safe(text: str) -> str:
    """Ensure text is compatible with built-in Helvetica fonts."""
    if not text:
        return ""
    return text.replace("\u2014", "-").replace("\u2013", "-").encode("ascii", "replace").decode("ascii")


class InterviewReportPDF(FPDF):
    def header(self):
        self.set_fill_color(8, 9, 12)
        self.rect(0, 0, 210, 28, "F")
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(201, 169, 98)
        self.cell(0, 10, "INTERVIEWIQ", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="L")
        self.set_font("Helvetica", "", 8)
        self.set_text_color(160, 165, 175)
        self.cell(0, 4, "Executive Interview Assessment Report", new_x=XPos.LMARGIN, new_y=YPos.NEXT, align="L")
        self.ln(8)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 125, 135)
        self.cell(0, 10, f"Page {self.page_no()}  |  Confidential", align="C")

    def section_title(self, title: str):
        self.ln(4)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(201, 169, 98)
        self.cell(0, 8, title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(201, 169, 98)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(4)

    def body_text(self, text: str):
        self.set_font("Helvetica", "", 10)
        self.set_text_color(50, 55, 65)
        self.multi_cell(0, 5.5, text)
        self.ln(2)

    def metric_row(self, label: str, value: str):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(90, 95, 105)
        self.cell(60, 6, label)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(30, 35, 45)
        self.cell(0, 6, value, new_x=XPos.LMARGIN, new_y=YPos.NEXT)


def generate_pdf(session: dict, report: dict | None = None) -> bytes:
    """Build a professional PDF report and return raw bytes."""
    pdf = InterviewReportPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    role = session.get("role", "Candidate")
    name = session.get("candidate_name", "Candidate")
    duration = session.get("duration", "N/A")
    answers = session.get("answers", [])
    answered = [a for a in answers if not a.get("skipped") and a.get("analysis")]
    scores = [a["analysis"]["score"] for a in answered]
    overall = report.get("overall_score") if report else (
        round(sum(scores) / len(scores)) if scores else 0
    )

    # Title block
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(20, 24, 32)
    pdf.cell(0, 12, "Interview Performance Report", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(80, 85, 95)
    pdf.cell(0, 6, f"Candidate: {name}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 6, f"Role: {role}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 6, f"Date: {datetime.now().strftime('%B %d, %Y at %H:%M')}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 6, f"Session Duration: {duration}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(6)

    # Score highlight box
    pdf.set_fill_color(245, 243, 238)
    pdf.rect(10, pdf.get_y(), 190, 28, "F")
    y = pdf.get_y() + 6
    pdf.set_xy(15, y)
    pdf.set_font("Helvetica", "B", 28)
    pdf.set_text_color(201, 169, 98)
    pdf.cell(40, 14, f"{overall}")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(80, 85, 95)
    pdf.set_xy(55, y + 2)
    pdf.cell(0, 6, "Overall Score / 100")
    grade = report.get("grade", "N/A") if report else "N/A"
    hire = report.get("hiring_probability", "N/A") if report else "N/A"
    pdf.set_xy(55, y + 10)
    pdf.cell(0, 6, f"Grade: {grade}  |  Hiring Signal: {hire}")
    pdf.ln(32)

    # Executive summary
    pdf.section_title("Executive Summary")
    summary = (report or {}).get("executive_summary", "Session completed.")
    pdf.body_text(_safe(summary))

    # Biometrics summary
    bio = session.get("biometrics_summary") or {}
    if bio:
        pdf.section_title("Multimodal Delivery Analysis")
        pdf.metric_row("Avg. Presentation Score", f"{bio.get('avg_presentation_score', 'N/A')}%")
        avg_voice = bio.get("avg_voice", {})
        pdf.metric_row("Vocal Confidence", f"{avg_voice.get('confidence', 'N/A')}%")
        pdf.metric_row("Vocal Clarity", f"{avg_voice.get('clarity', 'N/A')}%")
        pdf.metric_row("Stress Indicator", f"{avg_voice.get('nervousness', 'N/A')}%")
        pdf.ln(4)

    # Strengths & improvements
    if report:
        pdf.section_title("Key Strengths")
        for s in report.get("top_strengths", [])[:5]:
            pdf.body_text(_safe(f"  - {s}"))

        pdf.section_title("Priority Improvements")
        for s in report.get("critical_improvements", [])[:5]:
            pdf.body_text(_safe(f"  - {s}"))

    # Per-question breakdown
    pdf.add_page()
    pdf.section_title("Question-by-Question Analysis")

    for i, a in enumerate(answers, 1):
        if a.get("skipped"):
            continue
        analysis = a.get("analysis") or {}
        bio_q = a.get("biometrics") or {}

        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(30, 35, 45)
        q_text = a.get("question", "")[:120]
        pdf.multi_cell(0, 5, _safe(f"Q{i} [{a.get('category', 'General')}] - {q_text}"))
        pdf.ln(1)

        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(80, 85, 95)
        pdf.metric_row("Content Score", f"{analysis.get('score', 0)}/100 ({analysis.get('grade', '')})")
        if bio_q:
            pdf.metric_row("Presentation Score", f"{bio_q.get('presentation_score', 'N/A')}%")
            pdf.metric_row("Delivery State", bio_q.get("dominant_state", "N/A"))

        ans = (a.get("answer") or "")[:350]
        pdf.ln(2)
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(100, 105, 115)
        pdf.multi_cell(0, 4.5, _safe(f"Response: {ans}{'...' if len(a.get('answer', '')) > 350 else ''}"))

        if analysis.get("summary"):
            pdf.ln(1)
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(60, 65, 75)
            pdf.multi_cell(0, 4.5, _safe(f"Assessment: {analysis['summary']}"))

        pdf.ln(6)

    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()
