import os
import re
import joblib

MODEL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "model", "classifier.pkl"
)

_pipeline = None


def _load_model():
    global _pipeline
    if _pipeline is None:
        _pipeline = joblib.load(MODEL_PATH)
    return _pipeline


# ── Pattern-based reasoning ──────────────────────────────

REASON_PATTERNS = [
    # --- Bad / Blocker patterns ---
    (r"(share|sell|disclose|provide|transfer)\b.{0,40}\b(data|information|personal).{0,40}\b(third.part|partner|advertis|affiliate)",
     "Allows sharing your personal data with third parties"),
    (r"(collect|gather|track|monitor)\b.{0,40}\b(location|browsing|behavio|biometric|health|financial)",
     "Collects sensitive personal data"),
    (r"(not|no|shall not be)\s+(liable|responsible)\b|limit(ation|ed)?\s+of\s+liability|disclaim.{0,20}(warrant|liabilit)",
     "Limits the company's liability for damages to you"),
    (r"(change|modify|update|revise|amend)\b.{0,40}(terms|agreement|policy).{0,40}(without.{0,20}notice|any\s*time|sole\s*discretion)",
     "Can change terms without notifying you"),
    (r"(terminat|suspend|cancel|disable)\b.{0,40}(account|access|service).{0,40}(any\s*reason|sole\s*discretion|without|at\s*any\s*time)",
     "Can terminate your account at any time without reason"),
    (r"(waive|waiver|give\s*up|relinquish|forfeit)\b.{0,40}(right|claim|recourse)",
     "May require you to waive important legal rights"),
    (r"(arbitrat|class.action.waiver|waive.{0,30}(class|jury|right to sue))",
     "Mandatory arbitration or class action waiver limits your legal options"),
    (r"(retain|keep|store|maintain)\b.{0,40}(data|information).{0,40}(indefinite|permanent|after|even\s*if|terminat)",
     "Your data may be kept even after you leave the service"),
    (r"(irrevocab|perpetual|royalty.free|worldwide|sublicens)\b.{0,40}(licen[sc]e|right|grant)",
     "Grants the company broad rights over your content"),
    (r"(sell|monetiz|commercial).{0,40}\b(data|information|content)\b",
     "Your data or content may be used commercially"),
    (r"(surveil|keystroke|screen.{0,10}(record|captur|monitor)|camera|microphone)",
     "Invasive monitoring or surveillance practices"),
    (r"(indemnif|hold\s*harmless|defend\s+us)",
     "You must cover the company's legal costs if issues arise"),

    # --- Good patterns ---
    (r"(delete|erase|remove)\b.{0,40}(data|information|account).{0,40}(request|right|upon|ask)",
     "You can request deletion of your data"),
    (r"(encrypt|ssl|tls|https|secure).{0,40}(data|information|transfer|transmis|stor)",
     "Data is encrypted or transmitted securely"),
    (r"(notify|inform|notice|alert)\b.{0,40}(change|breach|update|modif)",
     "You will be notified of important changes or breaches"),
    (r"(opt.out|unsubscribe|withdraw\s*consent|choose\s*not\s*to|disable.{0,20}track)",
     "You can opt out of certain data practices"),
    (r"(do\s*not|never|will\s*not)\b.{0,30}(sell|share|trade|disclose).{0,30}(data|information|personal)",
     "The company commits to not selling your data"),
    (r"(gdpr|ccpa|coppa|hipaa|complian|regulation)\b",
     "References specific privacy regulations or compliance"),
    (r"(minimiz|only\s*collect|limit.{0,20}collect|necessary|essential)\b.{0,30}(data|information)",
     "Practices data minimization"),
]

REASON_PATTERNS_COMPILED = [(re.compile(p, re.IGNORECASE), reason) for p, reason in REASON_PATTERNS]


def get_reasons(text: str) -> list[str]:
    reasons = []
    for pattern, reason in REASON_PATTERNS_COMPILED:
        if pattern.search(text):
            reasons.append(reason)
    return reasons


# ── Prediction ───────────────────────────────────────────

def predict(text: str) -> dict:
    pipeline = _load_model()
    cleaned = text.strip().lower()
    label = pipeline.predict([cleaned])[0]

    proba = pipeline.predict_proba([cleaned])[0]
    confidence = float(proba.max())
    reasons = get_reasons(text)

    return {
        "classification": label,
        "confidence": round(confidence, 3),
        "reasons": reasons,
    }


def predict_batch(texts: list[str]) -> list[dict]:
    pipeline = _load_model()
    cleaned = [t.strip().lower() for t in texts]
    labels = pipeline.predict(cleaned)
    probas = pipeline.predict_proba(cleaned)

    results = []
    for i, label in enumerate(labels):
        confidence = float(probas[i].max())
        reasons = get_reasons(texts[i])
        results.append({
            "classification": label,
            "confidence": round(confidence, 3),
            "reasons": reasons,
        })

    return results


# ── Clause extraction ────────────────────────────────────

def _is_header(text: str) -> bool:
    stripped = text.strip()
    if re.match(r"^[A-Z0-9\s\-/&,;:()]+$", stripped) and len(stripped) < 200:
        return True
    if re.match(r"^[A-Z0-9]{1,4}[.)]\s*$", stripped):
        return True
    if (
        re.match(r"^(section\s+)?\d+[.):]?\s+[A-Z]", stripped, re.IGNORECASE)
        and len(stripped) < 80
    ):
        return True
    if re.match(r"^(article|part|chapter|schedule|exhibit|appendix)\s+", stripped, re.IGNORECASE) and len(stripped) < 100:
        return True
    return False


def _is_boilerplate(text: str) -> bool:
    lower = text.lower()
    boilerplate = [
        "all rights reserved",
        "table of contents",
        "click here",
        "last updated",
        "effective date",
        "copyright",
        "scroll down",
    ]
    return any(lower.startswith(b) or lower == b for b in boilerplate)


def extract_clauses(tos_text: str) -> list[str]:
    # Split on double newlines first
    raw_paragraphs = re.split(r"\n\s*\n", tos_text)

    clauses = []
    for para in raw_paragraphs:
        # Collapse internal whitespace
        para = re.sub(r"\s+", " ", para).strip()

        if len(para) < 50:
            continue
        if _is_header(para):
            continue
        if _is_boilerplate(para):
            continue

        clauses.append(para)

    return clauses


# ── Full analysis ────────────────────────────────────────

def analyze_tos(tos_text: str) -> dict:
    clauses = extract_clauses(tos_text)

    if not clauses:
        return {"status": "error", "message": "No clauses extracted from ToS"}

    predictions = predict_batch(clauses)

    counts = {"good": 0, "neutral": 0, "bad": 0, "blocker": 0}
    for pred in predictions:
        classification = pred.get("classification", "unknown")
        if classification in counts:
            counts[classification] += 1

    total = len(clauses)
    bad_ratio = (counts["bad"] + counts["blocker"] * 2) / total
    good_ratio = counts["good"] / total

    if bad_ratio < 0.1 and good_ratio > 0.4:
        grade, grade_class = "A", "good"
    elif bad_ratio < 0.2 and good_ratio > 0.25:
        grade, grade_class = "B", "good"
    elif bad_ratio < 0.35:
        grade, grade_class = "C", "neutral"
    elif bad_ratio < 0.5:
        grade, grade_class = "D", "bad"
    else:
        grade, grade_class = "F", "blocker"

    # Build clause details — all bad/blocker with reasons, and up to 3 good
    flagged = []
    good_clauses = []
    for clause, pred in zip(clauses, predictions):
        entry = {
            "text": clause,
            "classification": pred["classification"],
            "confidence": pred["confidence"],
            "reasons": pred["reasons"],
        }
        if pred["classification"] in ("bad", "blocker"):
            flagged.append(entry)
        elif pred["classification"] == "good" and len(good_clauses) < 3:
            good_clauses.append(entry)

    return {
        "status": "ok",
        "total_clauses": total,
        "classification_counts": counts,
        "grade": grade,
        "grade_class": grade_class,
        "flagged_clauses": flagged,
        "good_clauses": good_clauses,
    }
