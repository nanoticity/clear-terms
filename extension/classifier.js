/**
 * TF-IDF + LinearSVC classifier — pure JS reimplementation of the sklearn pipeline.
 */

function loadModel(json) {
  return {
    vocabulary: json.vocabulary,
    idf: json.idf,
    coef: json.coef,
    intercept: json.intercept,
    classes: json.classes,
  };
}

function _tokenize(text) {
  const cleaned = text.trim().toLowerCase();
  // sklearn default token pattern: (?u)\b\w\w+\b
  const tokens = cleaned.match(/\b\w\w+\b/g) || [];
  return tokens;
}

function _computeTfidf(tokens, model) {
  // Count ngrams (unigrams + bigrams) that exist in vocabulary
  const counts = {};
  for (const token of tokens) {
    const idx = model.vocabulary[token];
    if (idx !== undefined) {
      counts[idx] = (counts[idx] || 0) + 1;
    }
  }
  // Bigrams
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = tokens[i] + " " + tokens[i + 1];
    const idx = model.vocabulary[bigram];
    if (idx !== undefined) {
      counts[idx] = (counts[idx] || 0) + 1;
    }
  }

  // Multiply by IDF
  const tfidf = {};
  for (const idx in counts) {
    tfidf[idx] = counts[idx] * model.idf[idx];
  }

  // L2 normalize
  let norm = 0;
  for (const idx in tfidf) {
    norm += tfidf[idx] * tfidf[idx];
  }
  if (norm > 0) {
    norm = Math.sqrt(norm);
    for (const idx in tfidf) {
      tfidf[idx] /= norm;
    }
  }

  return tfidf; // sparse: {featureIndex: value}
}

function _classify(tfidf, model) {
  const numClasses = model.classes.length;
  const scores = new Array(numClasses);

  for (let c = 0; c < numClasses; c++) {
    let score = model.intercept[c];
    for (const idx in tfidf) {
      score += tfidf[idx] * model.coef[c][idx];
    }
    scores[c] = score;
  }

  // Find best class
  let bestIdx = 0;
  for (let c = 1; c < numClasses; c++) {
    if (scores[c] > scores[bestIdx]) bestIdx = c;
  }

  // Softmax confidence (numerically stable)
  const maxScore = scores[bestIdx];
  let expSum = 0;
  for (let c = 0; c < numClasses; c++) {
    expSum += Math.exp(scores[c] - maxScore);
  }
  const confidence = 1 / expSum; // exp(max - max) / sum = 1 / sum

  return {
    classification: model.classes[bestIdx],
    confidence: Math.round(confidence * 1000) / 1000,
  };
}

function predict(text, model) {
  const tokens = _tokenize(text);
  const tfidf = _computeTfidf(tokens, model);
  return _classify(tfidf, model);
}

function predictBatch(texts, model) {
  return texts.map(text => predict(text, model));
}
