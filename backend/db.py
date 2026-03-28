import json
import os
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "popular_sites.json")


def _load_db():
    try:
        with open(DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


_DB = _load_db()


def _normalize_domain(domain: str) -> str:
    d = domain.lower().strip()
    if d.startswith("http://") or d.startswith("https://"):
        # strip scheme
        d = d.split("://", 1)[1]
    # strip path
    d = d.split("/", 1)[0]
    if d.startswith("www."):
        d = d[4:]
    return d


def get_by_domain(domain: str) -> Optional[dict]:
    norm = _normalize_domain(domain)
    for entry in _DB:
        if entry.get("domain") and _normalize_domain(entry["domain"]) == norm:
            return entry
    return None


def all_sites() -> list:
    return _DB
