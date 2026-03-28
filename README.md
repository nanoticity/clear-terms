# Clear Terms

A Chrome extension that analyzes Terms of Service documents using machine learning. It classifies ToS clauses as **good**, **neutral**, **bad**, or **blocker** and gives an overall letter grade (A-F) — all running locally in your browser with no external API calls.

## How It Works

1. Click the extension on any webpage with a Terms of Service
2. Clear Terms extracts the text, splits it into clauses, and filters out headers/noise
3. A TF-IDF + LinearSVC model (exported from scikit-learn to JSON) classifies each clause
4. You get a letter grade, a color-coded breakdown, and sample problematic clauses

## Project Structure

```
extension/          Chrome extension (Manifest V3)
  ├── popup.html/js   Popup UI and orchestration
  ├── classifier.js   Pure JS ML inference (TF-IDF + LinearSVC)
  ├── clauses.js      Clause extraction and filtering
  ├── analyzer.js     Aggregation and grading logic
  ├── content.js      Content script for text extraction
  ├── style.css       Popup styles
  └── model/          Exported model JSON

backend/            Python API server (Flask)
  ├── app.py          REST API (/health, /analyze)
  ├── classifier.py   ML classification and clause extraction
  ├── scraper.py      ToS scraping (stub)
  ├── tosdr.py        ToS;DR integration (stub)
  └── model/          Trained sklearn pipeline (.pkl)

training/           Model training pipeline
  ├── train.py        Train TF-IDF + LinearSVC on ToS;DR data
  ├── export_model.py Convert sklearn model to JSON for browser
  ├── download_data.py  Download dataset from Zenodo
  └── data/           Training CSVs (Git LFS)

build.py            Copies extension/ to build/ for Chrome loading
tests/              Integration tests
```

## Getting Started

### Prerequisites

- Python 3.x
- Chrome browser

### Setup

```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Train the Model (optional — pre-trained model included)

```bash
cd training
python download_data.py   # Downloads ToS;DR dataset from Zenodo
python train.py           # Trains model, saves to backend/model/classifier.pkl
python export_model.py    # Exports to extension/model/model.json
```

### Load the Extension

```bash
python build.py
```

Then in Chrome: **Extensions > Manage Extensions > Load unpacked** and select the `build/` folder.

### Run the Backend API (optional)

The extension works standalone with in-browser inference. The backend is an alternative for server-side analysis:

```bash
python backend/app.py
```

**Endpoints:**
- `GET /health` — Health check
- `POST /analyze` — Analyze ToS text (`{"text": "..."}`)

## ML Model

- **Training data:** [ToS;DR dataset](https://zenodo.org/records/15012282) (cases and points with human-annotated classifications)
- **Vectorization:** TF-IDF with unigrams + bigrams, max 10,000 features
- **Classifier:** LinearSVC with balanced class weights
- **Classes:** good, neutral, bad, blocker

## Grading Scale

| Grade | Criteria |
|-------|----------|
| A | <10% bad/blocker, >40% good |
| B | <20% bad/blocker, >25% good |
| C | <35% bad/blocker |
| D | <50% bad/blocker |
| F | >=50% bad/blocker |

## Tech Stack

- **Extension:** JavaScript (no frameworks), Chrome Manifest V3
- **Backend:** Python, Flask, scikit-learn
- **Data:** pandas, Git LFS for large files

## License

[MIT](LICENSE)
