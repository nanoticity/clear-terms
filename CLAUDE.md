# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clear Terms is a Chrome extension that analyzes Terms of Service documents. It uses a Python backend with a trained ML classifier to evaluate ToS clauses, supplemented by data from ToS;DR (Terms of Service; Didn't Read).

## Architecture

- **extension/** — Chrome extension (Manifest V3 expected). Source files: popup UI, content script, styles. Currently stub files.
- **build/** — Built/packaged extension output (mirrors extension/ structure).
- **backend/** — Python backend with four modules:
  - `app.py` — API server
  - `classifier.py` — ML classification logic
  - `scraper.py` — ToS document scraping
  - `tosdr.py` — ToS;DR API integration
  - `model/classifier.pkl` — Trained model artifact (tracked via Git LFS)
- **training/** — Model training pipeline
  - `download_data.py` — Downloads dataset CSVs from Zenodo (cases, points, services, topics, documents)
  - `train.py` — Model training script
  - `data/` — Training data directory (gitignored at top level, CSVs tracked via Git LFS in `training/.gitattributes`)

## Commands

```bash
# Download training data (run from training/ directory)
cd training && python download_data.py

# Install dependencies
pip install -r requirements.txt
```

## Key Details

- Git LFS is configured for `*.pkl` and `data/*.csv` files in `training/.gitattributes`
- Training data is sourced from Zenodo: https://zenodo.org/records/15012282
- The project is early-stage — most backend and extension files are empty stubs awaiting implementation
