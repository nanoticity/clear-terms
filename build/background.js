/*
 * Background service worker.
 *
 * When the content script finds a privacy policy URL, this worker:
 *   1. Opens the URL in a hidden background tab
 *   2. Waits for it to load
 *   3. Extracts the rendered text via executeScript
 *   4. Runs the classifier
 *   5. Sets the badge grade and caches results for the popup
 *   6. Closes the hidden tab
 */

// ── Classifier (same logic as classifier.js) ──────────

function loadModel(json) {
  return { vocabulary: json.vocabulary, idf: json.idf, coef: json.coef, intercept: json.intercept, classes: json.classes };
}

function tokenize(text) {
  return text.trim().toLowerCase().match(/\b\w\w+\b/g) || [];
}

function computeTfidf(tokens, model) {
  const counts = {};
  for (const t of tokens) { const i = model.vocabulary[t]; if (i !== undefined) counts[i] = (counts[i] || 0) + 1; }
  for (let j = 0; j < tokens.length - 1; j++) { const i = model.vocabulary[tokens[j] + " " + tokens[j+1]]; if (i !== undefined) counts[i] = (counts[i] || 0) + 1; }
  const tfidf = {};
  for (const i in counts) tfidf[i] = counts[i] * model.idf[i];
  let norm = 0;
  for (const i in tfidf) norm += tfidf[i] * tfidf[i];
  if (norm > 0) { norm = Math.sqrt(norm); for (const i in tfidf) tfidf[i] /= norm; }
  return tfidf;
}

function classify(tfidf, model) {
  const n = model.classes.length, scores = new Array(n);
  for (let c = 0; c < n; c++) { let s = model.intercept[c]; for (const i in tfidf) s += tfidf[i] * model.coef[c][i]; scores[c] = s; }
  let best = 0;
  for (let c = 1; c < n; c++) if (scores[c] > scores[best]) best = c;
  const mx = scores[best]; let es = 0;
  for (let c = 0; c < n; c++) es += Math.exp(scores[c] - mx);
  return { classification: model.classes[best], confidence: Math.round((1/es)*1000)/1000 };
}

function predictBatch(texts, model) {
  return texts.map(t => classify(computeTfidf(tokenize(t), model), model));
}

// ── Clause extraction (same as clauses.js) ────────────

function isHeader(text) {
  const s = text.trim();
  if (/^[A-Z0-9\s\-\/&,;:()]+$/.test(s) && s.length < 200) return true;
  if (/^[A-Z0-9]{1,4}[.)]\s*$/.test(s)) return true;
  if (/^(section\s+)?\d+[.):]?\s+[A-Z]/i.test(s) && s.length < 80) return true;
  return false;
}

function extractClauses(tosText) {
  const clauses = [];
  for (let p of tosText.split(/\n\s*\n/)) { p = p.replace(/\s+/g, " ").trim(); if (p.length >= 80 && !isHeader(p)) clauses.push(p); }
  return clauses;
}

// ── Analysis (same as analyzer.js) ────────────────────

function analyzeTos(tosText, model) {
  const clauses = extractClauses(tosText);
  if (!clauses.length) return { status: "error", message: "No clauses found" };
  const preds = predictBatch(clauses, model);
  const counts = { good: 0, neutral: 0, bad: 0, blocker: 0 };
  for (const p of preds) if (p.classification in counts) counts[p.classification]++;
  const total = clauses.length;
  const badRatio = (counts.bad + counts.blocker * 2) / total;
  const goodRatio = counts.good / total;
  let grade, gradeClass;
  if (badRatio < 0.1 && goodRatio > 0.4) { grade = "A"; gradeClass = "good"; }
  else if (badRatio < 0.2 && goodRatio > 0.25) { grade = "B"; gradeClass = "good"; }
  else if (badRatio < 0.35) { grade = "C"; gradeClass = "neutral"; }
  else if (badRatio < 0.5) { grade = "D"; gradeClass = "bad"; }
  else { grade = "F"; gradeClass = "blocker"; }
  return {
    status: "ok", total_clauses: total, classification_counts: counts, grade, grade_class: gradeClass,
    sample_clauses: {
      bad: clauses.filter((_, i) => preds[i].classification === "bad").slice(0, 2),
      blocker: clauses.filter((_, i) => preds[i].classification === "blocker").slice(0, 2),
    },
  };
}

// ── Model cache ───────────────────────────────────────

let _model = null;

async function getModel() {
  if (_model) return _model;
  const resp = await fetch(chrome.runtime.getURL("model/model.json"));
  _model = loadModel(await resp.json());
  return _model;
}

// ── Badge colors ──────────────────────────────────────

const BADGE_COLORS = { A: "#3fb68b", B: "#58a6b1", C: "#d4a850", D: "#d07840", F: "#cf5050" };
const BACKEND_URL = "http://localhost:5000";

// ── Fetch policy text via hidden tab ──────────────────

function fetchPolicyViaTab(url) {
  return new Promise((resolve) => {
    // Open a background tab (not active, not visible to user)
    chrome.tabs.create({ url, active: false }, (tab) => {
      const tabId = tab.id;

      function onComplete(changedTabId, info) {
        if (changedTabId !== tabId || info.status !== "complete") return;
        chrome.tabs.onUpdated.removeListener(onComplete);

        // Give the page a moment to finish rendering dynamic content
        setTimeout(() => {
          chrome.scripting.executeScript({
            target: { tabId },
            func: () => document.body.innerText,
          }).then(([result]) => {
            chrome.tabs.remove(tabId);
            resolve(result?.result || null);
          }).catch(() => {
            chrome.tabs.remove(tabId);
            resolve(null);
          });
        }, 1500);
      }

      chrome.tabs.onUpdated.addListener(onComplete);

      // Timeout: if the tab hasn't loaded in 15s, give up
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(onComplete);
        chrome.tabs.remove(tabId).catch(() => {});
        resolve(null);
      }, 15000);
    });
  });
}

// ── Listen for content script messages ────────────────

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action !== "foundPolicy" || !sender.tab?.id) return;
  const originTabId = sender.tab.id;

  (async () => {
    try {
      console.log("[Clear Terms] Fetching policy for", msg.hostname, "from", msg.url);

      const text = await fetchPolicyViaTab(msg.url);
      if (!text || text.length < 200) {
        console.log("[Clear Terms] No usable text from", msg.url);
        return;
      }

      console.log("[Clear Terms] Got", text.length, "chars, analyzing...");

      const model = await getModel();
      const result = analyzeTos(text, model);
      if (result.status !== "ok") return;

      console.log("[Clear Terms]", msg.hostname, "→", result.grade);

      // Cache for popup
      await chrome.storage.session.set({
        ["ct_" + msg.hostname]: { ...result, policyUrl: msg.url, hostname: msg.hostname },
      });

      // Send a record to backend for history (best-effort)
      try {
        fetch(`${BACKEND_URL}/record-grade`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            domain: msg.hostname,
            hostname: msg.hostname,
            grade: result.grade,
            grade_class: result.grade_class,
            classification_counts: result.classification_counts,
            sample_clauses: result.sample_clauses,
            policyUrl: msg.url,
          }),
        }).catch((e) => console.warn("Failed sending grade to backend", e));
      } catch (e) {
        console.warn("Error posting grade to backend", e);
      }

      // Send grade-ready notification to the page content script
      chrome.tabs.sendMessage(originTabId, {
        action: "gradeReady",
        grade: result.grade,
        grade_class: result.grade_class,
        total_clauses: result.total_clauses,
        policyUrl: msg.url,
      }).catch(() => {});

      // Show grade badge on the original tab
      chrome.action.setBadgeText({ text: result.grade, tabId: originTabId });
      chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS[result.grade] || "#666", tabId: originTabId });
    } catch (err) {
      console.error("[Clear Terms] Error:", err);
    }
  })();
});
