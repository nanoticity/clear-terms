let _cachedModel = null;
let _cachedCategoryData = null;
const BACKEND_URL = "http://localhost:5000";

async function getModel() {
  if (_cachedModel) return _cachedModel;
  const url = chrome.runtime.getURL("model/model.json");
  const res = await fetch(url);
  const json = await res.json();
  _cachedModel = loadModel(json);
  return _cachedModel;
}

async function getCategoryData() {
  if (_cachedCategoryData) return _cachedCategoryData;
  const url = chrome.runtime.getURL("site_categories.json");
  const res = await fetch(url);
  _cachedCategoryData = await res.json();
  return _cachedCategoryData;
}

function applyTheme(theme) {
  document.body.classList.remove("theme-dark", "theme-light");
  document.body.classList.add(theme === "light" ? "theme-light" : "theme-dark");
}

function normalizeDomain(domain) {
  const lower = domain.toLowerCase().trim();
  let host = lower.replace(/^https?:\/\//, "");
  host = host.split("/")[0];
  if (host.startsWith("www.")) host = host.slice(4);
  return host;
}

function gradeValue(letter) {
  switch ((letter || "").toUpperCase()) {
    case "A": return 5;
    case "B": return 4;
    case "C": return 3;
    case "D": return 2;
    case "F": return 1;
    default: return 0;
  }
}

function compareGrades(current, average) {
  const currentValue = gradeValue(current);
  const avgValue = gradeValue(average);
  if (!currentValue || !avgValue) return "";
  if (currentValue > avgValue) return `This site grades better than the average.`;
  if (currentValue < avgValue) return `This site grades lower than the average.`;
  return `This site is in line with the average.`;
}

function findCategoryForDomain(hostname, categoryData) {
  const norm = normalizeDomain(hostname);
  for (const category of (categoryData.categories || [])) {
    if ((category.domains || []).includes(norm)) return category;
  }
  return null;
}

document.addEventListener("DOMContentLoaded", async () => {
  chrome.storage.sync.get({ theme: "dark" }, (settings) => {
    applyTheme(settings.theme);
  });
  const statusEl = document.getElementById("status");
  const statusText = document.getElementById("status-text");
  const errorEl = document.getElementById("error");
  const errorMsg = document.getElementById("error-message");
  const resultsEl = document.getElementById("results");
  const policyLinkEl = document.getElementById("policy-link");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const hostname = new URL(tab.url).hostname;
    const reportBtn = document.getElementById("report-btn");

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
      renderResults(data, hostname);
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

    renderResults(data, hostname);
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

    const samples = (data.flagged_clauses && data.flagged_clauses.length)
      ? data.flagged_clauses
      : Object.entries(data.sample_clauses || {}).flatMap(([type, arr]) => {
          return (arr || []).map((text) => ({ text, classification: type, confidence: null }));
        });
    const container = document.getElementById("sample-clauses");
    // clear previous samples
    container.innerHTML = "";
    const section = document.getElementById("samples-section");
    let hasSamples = false;

    for (const clause of samples) {
      hasSamples = true;
      const classification = clause.classification || "bad";
      const card = document.createElement("div");
      card.className = `clause-card ${classification}`;
      const textContainer = document.createElement("div");
      textContainer.className = "clause-text";
      textContainer.innerHTML = escapeHtml(clause.text || clause);
      const detail = document.createElement("div");
      detail.className = "clause-details";
      detail.hidden = true;
      detail.innerHTML = `
        <div class="clause-detail-row">Classification: <strong>${escapeHtml(classification)}</strong></div>
        <div class="clause-detail-row">Confidence: <strong>${escapeHtml(clause.confidence != null ? clause.confidence.toString() : "n/a")}</strong></div>
        <div class="clause-detail-row">Why: ${escapeHtml(getClauseReason(classification))}</div>
      `;
      card.appendChild(textContainer);
      card.appendChild(detail);
      card.addEventListener("click", () => {
        detail.hidden = !detail.hidden;
      });
      container.appendChild(card);
    }

    if (hasSamples) section.hidden = false;
    // show report button and wire up handler
    if (reportBtn) {
      reportBtn.hidden = false;
      reportBtn.disabled = false;
      reportBtn.textContent = "Report";
      reportBtn.onclick = async () => {
        const comment = window.prompt("Optional: describe what's incorrect (or leave blank):") || null;
        const payload = {
          hostname: hostname,
          domain: hostname,
          grade: data.grade,
          grade_class: data.grade_class,
          classification_counts: data.classification_counts,
          sample_clauses: data.sample_clauses,
          comment: comment,
        };
        try {
          reportBtn.disabled = true;
          reportBtn.textContent = "Reporting...";
          const res = await fetch(`${BACKEND_URL}/report`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = await res.json();
          if (res.ok && json.status === "ok") {
            reportBtn.textContent = "Reported";
            reportBtn.disabled = true;
          } else {
            reportBtn.textContent = "Report";
            reportBtn.disabled = false;
            alert("Could not send report: " + (json.message || res.statusText));
          }
        } catch (e) {
          reportBtn.textContent = "Report";
          reportBtn.disabled = false;
          alert("Error sending report: " + e.message);
        }
      };
      }
    renderComparison(data, hostname);
    // fetch and render grade history
    (async function renderHistory() {
      try {
        const resp = await fetch(`${BACKEND_URL}/grade-history?domain=${encodeURIComponent(hostname)}`);
        if (!resp.ok) return;
        const json = await resp.json();
        if (json.status !== "ok") return;
        const hist = json.history || [];
        const histSection = document.getElementById("history-section");
        const histList = document.getElementById("history-list");
        histList.innerHTML = "";
        if (!hist.length) {
          histSection.hidden = true;
          return;
        }
        // show most recent first
        hist.reverse();
        for (const h of hist) {
          const item = document.createElement("div");
          item.className = "history-item";
          const when = h.recorded_at || "";
          const grade = h.grade || "";
          const policy = h.policyUrl ? `<a href="${h.policyUrl}" target="_blank">policy</a>` : "";
          item.innerHTML = `<div class=\"history-meta\">${when} — <strong>${grade}</strong> ${policy}</div>`;
          histList.appendChild(item);
        }
        histSection.hidden = false;
      } catch (e) {
        // ignore history errors
      }
    })();
  }

  async function renderComparison(data, hostname) {
    const section = document.getElementById("comparison-section");
    const content = document.getElementById("comparison-content");
    if (!section || !content || !data.grade) return;

    section.hidden = true;
    content.innerHTML = "";

    try {
      const categoryData = await getCategoryData();
      const category = findCategoryForDomain(hostname, categoryData);
      if (!category) return;

      const currentGrade = data.grade;
      const compareText = compareGrades(currentGrade, category.average_grade);
      const similarSites = (category.domains || [])
        .filter((d) => normalizeDomain(d) !== normalizeDomain(hostname))
        .slice(0, 3);

      content.innerHTML = `
        <div>${escapeHtml(category.description)}</div>
        <div class="comparison-text">${escapeHtml(compareText)}</div>
        <div class="comparison-detail">Average ${escapeHtml(category.name)} grade: <strong>${escapeHtml(category.average_grade)}</strong>.</div>
        <div class="comparison-detail">Similar sites: ${escapeHtml(similarSites.join(", ")) || "none"}.</div>
      `;
      section.hidden = false;
    } catch (err) {
      // ignore comparison failures
    }
  }

  function getClauseReason(classification) {
    if (classification === "blocker") {
      return "This clause is classified as a blocker, which means it may contain a very serious policy issue.";
    }
    if (classification === "bad") {
      return "This clause is classified as bad, meaning it likely contains unfavorable or risky policy language.";
    }
    return "This clause was flagged by the analyzer for review.";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
});
