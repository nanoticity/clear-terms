import json
import os
from typing import List

BASE = os.path.dirname(os.path.abspath(__file__))
GRADES_FILE = os.path.join(BASE, "grades.jsonl")


def append_grade(entry: dict) -> None:
    os.makedirs(BASE, exist_ok=True)
    with open(GRADES_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")


def get_history(domain_or_hostname: str) -> List[dict]:
    if not os.path.exists(GRADES_FILE):
        return []
    domain = domain_or_hostname.lower().strip()
    out = []
    with open(GRADES_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except Exception:
                continue
            d = obj.get("domain") or obj.get("hostname")
            if not d:
                continue
            if d.lower().strip() == domain:
                out.append(obj)
    return out
