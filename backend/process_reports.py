import json
import os
from collections import Counter

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REPORTS_FILE = os.path.join(BASE_DIR, "reports.jsonl")
ARCHIVE_DIR = os.path.join(BASE_DIR, "reports_archive")
FEEDBACK_OUT = os.path.join(os.path.dirname(BASE_DIR), "training", "feedback.jsonl")


def _ensure_dirs():
    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(FEEDBACK_OUT), exist_ok=True)


def process_reports(retrain_threshold_total: int = 5, retrain_threshold_per_domain: int = 3) -> dict:
    """Read new reports, convert into feedback examples, append to training/feedback.jsonl.

    Move processed reports into an archive file with timestamp suffix. Returns a summary dict:
    {new_reports: int, examples_added: int, retrain_flag: bool, details: {...}}
    """
    _ensure_dirs()

    if not os.path.exists(REPORTS_FILE):
        return {"new_reports": 0, "examples_added": 0, "retrain_flag": False, "details": {}}

    reports = []
    with open(REPORTS_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                reports.append(json.loads(line))
            except Exception:
                continue

    if not reports:
        return {"new_reports": 0, "examples_added": 0, "retrain_flag": False, "details": {}}

    # simple heuristics to decide if retraining / action is needed
    domains = [r.get("domain") or r.get("hostname") for r in reports]
    domain_counts = Counter(domains)

    retrain_flag = False
    if len(reports) >= retrain_threshold_total:
        retrain_flag = True
    if any(c >= retrain_threshold_per_domain for c in domain_counts.values() if c):
        retrain_flag = True

    # convert sample_clauses into labeled training examples
    examples = []
    for r in reports:
        # prefer explicit grade_class if provided
        user_label = r.get("grade_class")
        samples = r.get("sample_clauses") or {}
        # If user provided sample clauses, map each to the reported label when possible
        if isinstance(samples, dict):
            for lbl, arr in samples.items():
                for txt in arr:
                    examples.append({"text": txt, "label": lbl, "source": "user_report", "domain": r.get("domain")})
        elif isinstance(samples, list):
            # no label provided — use user's grade_class if present
            for txt in samples:
                examples.append({"text": txt, "label": user_label or "unknown", "source": "user_report", "domain": r.get("domain")})

    # Append examples to feedback file (JSON lines). If none, still archive reports.
    examples_added = 0
    if examples:
        with open(FEEDBACK_OUT, "a", encoding="utf-8") as out:
            for ex in examples:
                out.write(json.dumps(ex, ensure_ascii=False) + "\n")
                examples_added += 1

    # archive processed reports
    import time

    ts = int(time.time())
    archive_path = os.path.join(ARCHIVE_DIR, f"reports.{ts}.jsonl")
    os.replace(REPORTS_FILE, archive_path)

    return {
        "new_reports": len(reports),
        "examples_added": examples_added,
        "retrain_flag": retrain_flag,
        "details": {"per_domain_counts": dict(domain_counts), "archive_path": archive_path},
    }


if __name__ == "__main__":
    import pprint

    res = process_reports()
    pprint.pprint(res)
