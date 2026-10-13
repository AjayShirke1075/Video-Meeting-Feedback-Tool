"""
Multimodal emotion fusion - facial expressions + voice prosody.
"""

from __future__ import annotations

FACE_LABELS = ("happy", "neutral", "anxious", "thoughtful", "surprised", "stressed")


def _normalize_face(raw: dict) -> dict:
    """Map face-api expressions to interview-relevant categories."""
    if not raw:
        return {k: 0.0 for k in FACE_LABELS} | {"dominant": "neutral", "confidence": 0}

    happy = float(raw.get("happy", 0))
    neutral = float(raw.get("neutral", 0))
    surprised = float(raw.get("surprised", 0))
    anxious = float(raw.get("fearful", 0)) + float(raw.get("sad", 0)) * 0.6
    stressed = float(raw.get("angry", 0)) + float(raw.get("disgusted", 0)) * 0.5
    thoughtful = neutral * 0.35 + surprised * 0.25 + happy * 0.1

    scores = {
        "happy": happy,
        "neutral": neutral,
        "anxious": min(1.0, anxious),
        "thoughtful": min(1.0, thoughtful),
        "surprised": surprised,
        "stressed": min(1.0, stressed),
    }
    total = sum(scores.values()) or 1.0
    normalized = {k: round(v / total * 100) for k, v in scores.items()}
    dominant = max(scores, key=scores.get)
    confidence = round(max(scores.values()) / total * 100)

    return {**normalized, "dominant": dominant, "confidence": confidence}


def _normalize_voice(raw: dict) -> dict:
    if not raw:
        return {
            "confidence": 50,
            "energy": 50,
            "nervousness": 30,
            "clarity": 50,
            "pace": "moderate",
            "dominant": "neutral",
        }

    confidence = int(raw.get("confidence", 50))
    energy = int(raw.get("energy", 50))
    nervousness = int(raw.get("nervousness", 30))
    clarity = int(raw.get("clarity", 50))
    pace = raw.get("pace", "moderate")

    if confidence >= 70 and nervousness <= 35:
        dominant = "confident"
    elif nervousness >= 60:
        dominant = "nervous"
    elif energy >= 65:
        dominant = "energetic"
    elif energy <= 35:
        dominant = "subdued"
    else:
        dominant = "composed"

    return {
        "confidence": max(0, min(100, confidence)),
        "energy": max(0, min(100, energy)),
        "nervousness": max(0, min(100, nervousness)),
        "clarity": max(0, min(100, clarity)),
        "pace": pace,
        "dominant": dominant,
    }


def fuse_biometrics(facial_raw: dict | None, voice_raw: dict | None) -> dict:
    """
    Combine facial and voice signals into a unified presentation profile.
    """
    facial = _normalize_face(facial_raw or {})
    voice = _normalize_voice(voice_raw or {})

    # Presentation score: confidence + composure - anxiety
    face_composure = facial.get("neutral", 0) + facial.get("happy", 0) * 0.7
    face_anxiety = facial.get("anxious", 0) + facial.get("stressed", 0)

    presentation = round(
        voice["confidence"] * 0.35
        + voice["clarity"] * 0.15
        + face_composure * 0.25
        + (100 - voice["nervousness"]) * 0.15
        + (100 - face_anxiety) * 0.10
    )
    presentation = max(0, min(100, presentation))

    if presentation >= 78:
        state = "Executive Presence"
    elif presentation >= 65:
        state = "Professional Composure"
    elif presentation >= 50:
        state = "Developing Presence"
    else:
        state = "Needs Calibration"

    recommendations = []
    if voice["nervousness"] > 55 or facial.get("anxious", 0) > 40:
        recommendations.append("Reduce vocal tension - pause briefly before key points")
    if voice["energy"] < 40:
        recommendations.append("Increase vocal energy to project engagement")
    if facial.get("neutral", 0) > 70 and facial.get("happy", 0) < 15:
        recommendations.append("Allow natural positive expression when discussing achievements")
    if voice["pace"] == "fast":
        recommendations.append("Slow delivery slightly for clarity and authority")
    if not recommendations:
        recommendations.append("Maintain current vocal and facial composure")

    return {
        "facial": facial,
        "voice": voice,
        "presentation_score": presentation,
        "dominant_state": state,
        "eye_contact_estimate": min(95, round(facial.get("neutral", 0) * 0.4 + presentation * 0.6)),
        "recommendations": recommendations[:3],
    }


def aggregate_session_biometrics(answer_records: list) -> dict:
    """Summarize biometrics across all answered questions."""
    samples = [a.get("biometrics") for a in answer_records if a.get("biometrics")]
    if not samples:
        return {}

    avg_presentation = round(
        sum(s.get("presentation_score", 0) for s in samples) / len(samples)
    )
    face_totals = {k: 0 for k in FACE_LABELS}
    voice_totals = {"confidence": 0, "energy": 0, "nervousness": 0, "clarity": 0}

    for s in samples:
        for k in FACE_LABELS:
            face_totals[k] += s.get("facial", {}).get(k, 0)
        for k in voice_totals:
            voice_totals[k] += s.get("voice", {}).get(k, 0)

    n = len(samples)
    return {
        "avg_presentation_score": avg_presentation,
        "avg_facial": {k: round(v / n) for k, v in face_totals.items()},
        "avg_voice": {k: round(v / n) for k, v in voice_totals.items()},
        "questions_with_biometrics": n,
    }


def adjust_answer_score(base_score: int, biometrics: dict | None) -> int:
    """Blend content score with presentation delivery score."""
    if not biometrics:
        return base_score
    presentation = biometrics.get("presentation_score", 50)
    # 75% content, 25% delivery
    blended = round(base_score * 0.75 + presentation * 0.25)
    return max(0, min(100, blended))
