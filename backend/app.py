from flask import Flask, request, jsonify
from flask_cors import CORS
from classifier import analyze_tos

app = Flask(__name__)
CORS(app)


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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
