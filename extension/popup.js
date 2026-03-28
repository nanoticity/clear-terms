let _cachedModel = null;

async function getModel() {
  if (_cachedModel) return _cachedModel;
  const url = chrome.runtime.getURL("model/model.json");
  const res = await fetch(url);
  const json = await res.json();
  _cachedModel = loadModel(json);
  return _cachedModel;
}

document.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("status");
  const statusText = document.getElementById("status-text");
  const errorEl = document.getElementById("error");
  const errorMsg = document.getElementById("error-message");
  const resultsEl = document.getElementById("results");
  const policyLinkEl = document.getElementById("policy-link");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const hostname = new URL(tab.url).hostname;

    // Check if background already graded this site
    const key = "ct_" + hostname;
    const stored = await chrome.storage.session.get(key);

    if (stored[key] && stored[key].status === "ok") {
      const data = stored[key];
      if (data.policyUrl) {
        policyLinkEl.href = data.policyUrl;
        policyLinkEl.textContent = "View privacy policy";
        policyLinkEl.hidden = false;
      }
      renderResults(data);
      return;
    }

    // Fallback: analyze the current page directly
    statusText.textContent = "Analyzing page...";

    const [{ result: pageText }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText,
    });

    if (!pageText) {
      throw new Error("Could not extract text from this page.");
    }

    const model = await getModel();
    const data = analyzeTos(pageText, model);

    if (data.status === "error") {
      throw new Error(data.message || "No privacy policy clauses found on this page.");
    }

    renderResults(data);
  } catch (err) {
    statusEl.hidden = true;
    errorEl.hidden = false;
    errorMsg.textContent = err.message;
  }

  function renderResults(data) {
    statusEl.hidden = true;
    resultsEl.hidden = false;

    document.getElementById("total-clauses").textContent = data.total_clauses;

    const gradeEl = document.getElementById("grade");
    gradeEl.textContent = data.grade;
    gradeEl.className = `summary-value badge ${data.grade_class}`;

    const counts = data.classification_counts;
    const total = data.total_clauses || 1;

    for (const type of ["good", "neutral", "bad", "blocker"]) {
      const count = counts[type] || 0;
      document.getElementById(`count-${type}`).textContent = count;
      document.getElementById(`bar-${type}`).style.width = `${(count / total) * 100}%`;
    }

    const samples = data.sample_clauses || {};
    const container = document.getElementById("sample-clauses");
    const section = document.getElementById("samples-section");
    let hasSamples = false;

    for (const type of ["blocker", "bad"]) {
      for (const text of (samples[type] || [])) {
        hasSamples = true;
        const card = document.createElement("div");
        card.className = `clause-card ${type}`;
        card.innerHTML = `<div class="clause-type ${type}">${type}</div><div>${escapeHtml(text)}</div>`;
        container.appendChild(card);
      }
    }

    if (hasSamples) section.hidden = false;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
});
