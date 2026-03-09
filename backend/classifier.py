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
