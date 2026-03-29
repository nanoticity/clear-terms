# Clear Terms

A Chrome extension that analyzes Terms of Service and Privacy Policy pages. It classifies clauses as **good**, **neutral**, **bad**, or **blocker** and gives an overall letter grade (A-F).

Choose between two analysis modes:
- **OpenAI API** — Uses GPT-4.1-nano for accurate, context-aware analysis. Bring your own API key.
- **Built-in Model** — Runs entirely offline in your browser using a lightweight TF-IDF + LinearSVC model. Less accurate but no API key needed.

## How It Works

1. Install the extension and open **Settings** (gear icon or right-click > Options)
2. Pick your analysis mode — enter an OpenAI API key, or select the built-in model
3. Navigate to any Terms of Service or Privacy Policy page and click the extension
4. You get a letter grade, a color-coded breakdown, and flagged clauses with quotes and explanations

## Project Structure

```
extension/          Chrome extension (Manifest V3)
  ├── popup.html/js       Popup UI and orchestration
  ├── analyzer-openai.js  OpenAI API analysis (GPT-4.1-nano)
  ├── analyzer-local.js   Local ML analysis (TF-IDF + LinearSVC)
  ├── classifier.js       Pure JS ML inference engine
  ├── clauses.js          Clause extraction and filtering
  ├── reasons.js          Pattern-based reasoning
  ├── options.html/js     Settings page (mode + API key)
  ├── style.css           Styles
  └── model/              Exported model JSON

backend/            Python API server (Flask)
  ├── app.py          REST API (/health, /analyze)
  ├── classifier.py   ML classification and clause extraction
  ├── scraper.py      ToS scraping (stub)
  ├── tosdr.py        ToS;DR integration (stub)
  └── model/          Trained sklearn pipeline (.pkl)

training/           Model training pipeline
  ├── train.py        Train TF-IDF + LinearSVC on ToS;DR data
  ├── download_data.py  Download dataset from Zenodo
  └── data/           Training CSVs (Git LFS)

docs/               Project website
build.py            Copies extension/ to build/ and creates clear-terms.zip
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

Open the extension's **Options** page to choose your analysis mode before first use.

### Run the Backend API (optional)

The extension works standalone. The backend is an alternative for server-side analysis:

```bash
python backend/app.py
```

**Endpoints:**
- `GET /health` — Health check
- `POST /analyze` — Analyze ToS text (`{"text": "..."}`)

## Analysis Modes

### OpenAI API (recommended)
- Uses GPT-4.1-nano via the OpenAI API with your own key
- Reads the full policy contextually, extracts quotes, and explains each clause
- Grades holistically based on overall policy friendliness

### Built-in Model (offline)
- TF-IDF vectorization with unigrams + bigrams
- LinearSVC classifier with balanced class weights
- Trained on the [ToS;DR dataset](https://zenodo.org/records/15012282)
- Pattern-based reasoning for human-readable explanations
- Grades based on clause classification ratios

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
