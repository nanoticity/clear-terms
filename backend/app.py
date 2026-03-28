import os

from flask import Flask, request, jsonify
from flask_cors import CORS
from classifier import analyze_tos
from db import get_by_domain
from scraper import fetch_site_tos
from process_reports import process_reports
from grades import append_grade, get_history

app = Flask(__name__)
CORS(app)

ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN")


def _require_admin():
    auth = request.headers.get("Authorization", "")
    if not ADMIN_TOKEN or not auth.startswith("Bearer "):
        return False
    return auth.split(" ", 1)[1].strip() == ADMIN_TOKEN


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json(silent=True)
    if not data or not data.get("text"):
        return jsonify({"status": "error", "message": "Missing 'text' field"}), 400

    try:
        result = analyze_tos(data["text"])
        return jsonify(result)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/site-info", methods=["POST"])
def site_info():
    data = request.get_json(silent=True) or {}
    domain = data.get("domain") or data.get("url")
    if not domain:
        return jsonify({"status": "error", "message": "Missing 'domain' or 'url' field"}), 400

    # Check local popular-sites DB first
    try:
        entry = get_by_domain(domain)
        if entry:
            return jsonify({"status": "ok", "source": "db", "entry": entry})
    except Exception:
        # continue to fallback scraping
        pass

    # Fallback: attempt to fetch ToS via scraper
    try:
        res = fetch_site_tos(domain)
        if res.get("status") == "ok":
            return jsonify({"status": "ok", "source": "scrape", "url": res.get("url"), "text": res.get("text")})
        return jsonify({"status": "error", "message": res.get("message", "unknown")}), 502
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/report", methods=["POST"])
def report():
    """Accept user reports for incorrect grades and persist them to reports.jsonl"""
    data = request.get_json(silent=True) or {}
    domain = data.get("domain") or data.get("url") or data.get("hostname")
    if not domain:
        return jsonify({"status": "error", "message": "Missing 'domain' or 'url' or 'hostname' field"}), 400

    import datetime, json, os

    entry = {
        "received_at": datetime.datetime.utcnow().isoformat() + "Z",
        "domain": domain,
        "grade": data.get("grade"),
        "grade_class": data.get("grade_class"),
        "classification_counts": data.get("classification_counts"),
        "sample_clauses": data.get("sample_clauses"),
        "comment": data.get("comment"),
    }

    reports_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reports.jsonl")
    try:
        with open(reports_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception as e:
        return jsonify({"status": "error", "message": f"Could not save report: {e}"}), 500

    return jsonify({"status": "ok", "message": "Report received"})


@app.route("/admin/process-reports", methods=["POST"])
def admin_process_reports():
    """Admin endpoint to process accumulated reports into training feedback.

    Returns a summary and whether retraining is recommended.
    """
    if not _require_admin():
        return jsonify({"status": "error", "message": "Unauthorized"}), 401
    try:
        summary = process_reports()
        return jsonify({"status": "ok", "summary": summary})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route("/record-grade", methods=["POST"])
def record_grade():
    data = request.get_json(silent=True) or {}
    domain = data.get("domain") or data.get("hostname") or data.get("url")
    if not domain:
        return jsonify({"status": "error", "message": "Missing domain/hostname/url"}), 400

    import datetime

    entry = {
        "recorded_at": datetime.datetime.utcnow().isoformat() + "Z",
        "domain": domain,
        "hostname": data.get("hostname"),
        "grade": data.get("grade"),
        "grade_class": data.get("grade_class"),
        "classification_counts": data.get("classification_counts"),
        "sample_clauses": data.get("sample_clauses"),
        "policyUrl": data.get("policyUrl") or data.get("policy_url") or data.get("url"),
    }

    try:
        append_grade(entry)
    except Exception as e:
        return jsonify({"status": "error", "message": f"Could not save grade: {e}"}), 500

    return jsonify({"status": "ok"})


@app.route("/grade-history", methods=["GET"])
def grade_history():
    domain = request.args.get("domain") or request.args.get("hostname")
    if not domain:
        return jsonify({"status": "error", "message": "Missing 'domain' query parameter"}), 400
    try:
        hist = get_history(domain)
        return jsonify({"status": "ok", "history": hist})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
