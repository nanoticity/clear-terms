"""Export sklearn pipeline (TF-IDF + LogisticRegression) to JSON for use in the Chrome extension."""

import json
import os
import joblib

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", "model", "classifier.pkl")
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "extension", "model")
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "model.json")


def export():
    pipeline = joblib.load(MODEL_PATH)

    tfidf = pipeline.named_steps["tfidf"]
    clf = pipeline.named_steps["clf"]

    model_data = {
        "vocabulary": {k: int(v) for k, v in tfidf.vocabulary_.items()},
        "idf": [round(float(x), 6) for x in tfidf.idf_],
        "coef": [[round(float(x), 6) for x in row] for row in clf.coef_],
        "intercept": [round(float(x), 6) for x in clf.intercept_],
        "classes": clf.classes_.tolist(),
    }

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(model_data, f)

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"Exported model to {OUTPUT_PATH} ({size_kb:.0f} KB)")
    print(f"  Vocabulary size: {len(model_data['vocabulary'])}")
    print(f"  Classes: {model_data['classes']}")
    print(f"  Coef shape: {len(model_data['coef'])} x {len(model_data['coef'][0])}")


if __name__ == "__main__":
    export()
