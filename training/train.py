import os
import pandas as pd
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report
import joblib

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend", "model")
MODEL_PATH = os.path.join(MODEL_DIR, "classifier.pkl")


def load_data():
    cases = pd.read_csv(os.path.join(DATA_DIR, "cases.csv"))
    points = pd.read_csv(os.path.join(DATA_DIR, "points.csv"))

    clean = points[
        (points["status"] == "approved") &
        (points["quote_text"].notna())
    ]

    merged = clean.merge(
        cases[["id", "classification"]],
        left_on="case_id",
        right_on="id",
    )

    texts = merged["quote_text"].str.strip().str.lower().tolist()
    labels = merged["classification"].tolist()

    print(f"Total training examples: {len(texts)}")
    print(f"Class distribution:\n{merged['classification'].value_counts().to_string()}\n")

    return texts, labels


def train():
    texts, labels = load_data()

    X_train, X_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.2, random_state=42, stratify=labels
    )

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 3),
            max_features=50000,
            sublinear_tf=True,
            min_df=2,
            max_df=0.95,
            strip_accents="unicode",
        )),
        ("clf", LogisticRegression(
            class_weight="balanced",
            max_iter=5000,
            C=1.0,
            solver="lbfgs",
        )),
    ])

    # Cross-validation
    print("Running 5-fold cross-validation...")
    cv_scores = cross_val_score(pipeline, X_train, y_train, cv=5, scoring="f1_macro")
    print(f"CV F1 (macro): {cv_scores.mean():.3f} (+/- {cv_scores.std():.3f})\n")

    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    print(classification_report(y_test, y_pred))

    os.makedirs(MODEL_DIR, exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)
    print(f"Model saved to {MODEL_PATH}")


if __name__ == "__main__":
    train()
