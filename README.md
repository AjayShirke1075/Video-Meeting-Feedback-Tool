# Video Meeting Feedback Tool

A local, browser-based tool for reviewing recorded presentations. Track observable visual expression cues across a timeline, pin timestamped self-assessment notes, and compare your own perception to what the camera saw.

Built for voluntary, private practice. No recordings leave the browser session.

---

## What it does

**Interview practice mode**

Upload a resume and a job description. The app generates seven interview questions tailored to that role. Answer each question in writing or by dictating. Webcam and microphone run during your answer to capture facial expression and voice volume. Each answer is scored on relevance, depth, structure, and specificity. At the end you get a full session report with a coaching summary and PDF export.

**Presentation review mode**

Upload a recorded video of a presentation (MP4, WebM, MOV). The timeline shows simulated expression trend lines for Composure, Warmth, Energy, and Tension as the video plays. Pin timestamped notes with a 1-5 self-rating and a confidence level. After pinning notes, generate a comparison chart that overlays your self-ratings against the expression trends. Export a plain-text coaching summary.

Three built-in demo presentations let you explore the tool without uploading a video.

---

## How to run

**Requirements**

- Python 3.10 or later
- A Gemini API key (optional - the app works in demo mode without one)

**Install dependencies**

```bash
pip install -r requirements.txt
```

**Set up environment**

```bash
cp .env.example .env
```

Edit `.env` and paste your Gemini API key after `GEMINI_API_KEY=`. Get a free key at [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey).

You can also skip this step and add the key from the in-app Settings panel after the server starts.

**Start the server**

```bash
python run.py
```

Open [http://localhost:5000](http://localhost:5000) in Chrome or Edge.

---

## Project structure

```
emotion_detector/
├── server.py            Flask routes and API endpoints
├── ai_engine.py         Gemini AI integration (question generation, answer scoring)
├── emotion_engine.py    Biometric fusion (facial expressions + voice prosody)
├── report_pdf.py        PDF report generation with fpdf2
├── config.py            Environment and API key management
├── run.py               Server entry point
├── setup_env.py         CLI helper to configure the Gemini API key
├── requirements.txt     Python dependencies
├── .env.example         Environment variable template
├── templates/
│   └── index.html       Main application HTML (Flask Jinja2 template)
└── static/
    ├── app.js           Main application logic (navigation, upload, interview flow, charts)
    ├── emotion.js       Camera and microphone analysis (face-api, Web Audio)
    ├── style.css        Styles
    └── favicon.svg      Browser tab icon
```

---

## Tech stack

| Layer | What |
|---|---|
| Backend | Python, Flask, Flask-CORS |
| AI | Google Gemini API (google-generativeai) |
| PDF | fpdf2 |
| File parsing | PyMuPDF (PDF), python-docx (DOCX) |
| Face analysis | face-api.js (TinyFaceDetector, FaceExpressionNet) - runs in the browser |
| Voice analysis | Web Audio API (RMS, zero-crossing rate) - runs in the browser |
| Charts | Chart.js |
| Fonts | IBM Plex Sans, IBM Plex Mono, Source Serif 4 (Google Fonts) |

---

## API reference

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Serves the main HTML application |
| `/api/health` | GET | Returns AI readiness status |
| `/api/set-api-key` | POST | Validates and saves a Gemini API key to `.env` |
| `/api/upload` | POST | Accepts resume + job description, returns generated questions |
| `/api/analyze-answer` | POST | Scores a single answer with Gemini |
| `/api/final-report` | POST | Generates a full coaching report from the session |
| `/api/export-pdf` | POST | Generates and streams a PDF assessment report |

All API endpoints return JSON. The `/api/export-pdf` endpoint returns `application/pdf`.

---

## Privacy

Webcam frames and microphone audio are processed entirely inside the browser by face-api.js and the Web Audio API. No video or audio data is sent to the server or any external service. Files uploaded for resume and job description parsing are deleted immediately after text is extracted. Nothing is stored between sessions.

---

## Expression signals

The tool measures observable surface visual demeanor, not internal mental state. The signals are:

| Signal | Source | Used for |
|---|---|---|
| Expression mix | Webcam, face-api TinyFaceDetector | Composure, warmth, tension estimates during an answer |
| Voice volume | Microphone, Web Audio RMS | Energy and nervousness proxy |
| Answer text | Typed or speech-to-text | Relevance, depth, structure, specificity scoring |

Expression and voice numbers are browser estimates, not clinical or hiring-grade biometrics.

---

## Demo mode

Without a Gemini API key the app runs in demo mode. Question generation falls back to a role-based template set. Answer analysis produces a basic offline score based on word count and keyword presence. Full AI scoring requires a Gemini API key.

---

## License

MIT
