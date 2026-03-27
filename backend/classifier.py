import os
import joblib
import numpy as np

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model", "classifier.pkl")

_pipeline = None


def _load_model():
    global _pipeline
    if _pipeline is None:
        _pipeline = joblib.load(MODEL_PATH)
    return _pipeline


def predict(text: str) -> dict:
    pipeline = _load_model()
    cleaned = text.strip().lower()
    label = pipeline.predict([cleaned])[0]

    decision = pipeline.decision_function([cleaned])
    if decision.ndim == 1:
        confidence = float(1 / (1 + np.exp(-abs(decision[0]))))
    else:
        scores = decision[0]
        confidence = float(np.exp(scores.max()) / np.exp(scores).sum())

    return {"classification": label, "confidence": round(confidence, 3)}


def predict_batch(texts: list[str]) -> list[dict]:
    pipeline = _load_model()
    cleaned = [t.strip().lower() for t in texts]
    labels = pipeline.predict(cleaned)

    decisions = pipeline.decision_function(cleaned)
    results = []
    for i, label in enumerate(labels):
        if decisions.ndim == 1:
            conf = float(1 / (1 + np.exp(-abs(decisions[i]))))
        else:
            scores = decisions[i]
            conf = float(np.exp(scores.max()) / np.exp(scores).sum())
        results.append({"classification": label, "confidence": round(conf, 3)})

    return results


def _is_header(text: str) -> bool:
    """Detect section headers, numbered labels, and other structural noise."""
    import re
    stripped = text.strip()
    # All caps (with optional punctuation/numbers), e.g. "TERMINATION AND SUSPENSION OF SERVICES"
    if re.match(r'^[A-Z0-9\s\-/&,;:()]+$', stripped) and len(stripped) < 200:
        return True
    # Single letter/number labels like "G.", "12.", "IV.", "A)"
    if re.match(r'^[A-Z0-9]{1,4}[.)]\s*$', stripped):
        return True
    # Numbered section headers like "1. Introduction" or "Section 5: Data"
    if re.match(r'^(section\s+)?\d+[.):]?\s+[A-Z]', stripped, re.IGNORECASE) and len(stripped) < 80:
        return True
    return False


def extract_clauses(tos_text: str) -> list[str]:
    """
    Extract meaningful clauses from a ToS document by splitting on paragraph
    boundaries and filtering out headers, short fragments, and boilerplate.
    """
    import re

    # Split on double newlines (paragraph boundaries) first
    paragraphs = re.split(r'\n\s*\n', tos_text)

    clauses = []
    for para in paragraphs:
        # Collapse internal whitespace
        para = re.sub(r'\s+', ' ', para).strip()

        # Skip empty or very short text (less than 80 chars is unlikely to be a real clause)
        if len(para) < 80:
            continue

        # Skip section headers and structural labels
        if _is_header(para):
            continue

        clauses.append(para)

    return clauses


def analyze_tos(tos_text: str) -> dict:
    """
    Analyze a full ToS document by extracting clauses and grading each.
    Returns aggregated results.
    """
    clauses = extract_clauses(tos_text)

    if not clauses:
        return {
            "status": "error",
            "message": "No clauses extracted from ToS"
        }

    # Predict on all clauses
    predictions = predict_batch(clauses)

    # Count classifications
    counts = {"good": 0, "neutral": 0, "bad": 0, "blocker": 0}
    for pred in predictions:
        classification = pred.get("classification", "unknown")
        if classification in counts:
            counts[classification] += 1

    # Calculate average confidence per classification
    confidences = {"good": [], "neutral": [], "bad": [], "blocker": []}
    for pred in predictions:
        classification = pred.get("classification", "unknown")
        if classification in confidences:
            confidences[classification].append(pred.get("confidence", 0))

    avg_confidences = {
        k: round(sum(v) / len(v), 3) if v else 0
        for k, v in confidences.items()
    }

    # Find the classification with the most clauses
    top_issue = max(counts.items(), key=lambda x: x[1])[0]

    return {
        "status": "ok",
        "total_clauses": len(clauses),
        "classification_counts": counts,
        "average_confidences": avg_confidences,
        "top_issue": top_issue,
        "sample_clauses": {
            "bad": [c for c, p in zip(clauses, predictions) if p["classification"] == "bad"][:2],
            "blocker": [c for c, p in zip(clauses, predictions) if p["classification"] == "blocker"][:2]
        }
    }
