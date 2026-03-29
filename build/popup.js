document.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("status");
  const statusText = document.getElementById("status-text");
  const errorEl = document.getElementById("error");
  const errorMsg = document.getElementById("error-message");
  const resultsEl = document.getElementById("results");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    statusText.textContent = "Extracting page text...";

    const [{ result: pageText }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.innerText,
    });

    if (!pageText || pageText.length < 200) {
      throw new Error("Not enough text on this page to analyze.");
    }

    statusText.textContent = "Sending to AI for analysis...";

    const data = await analyzeTos(pageText);

    if (data.status === "error") {
      throw new Error(data.message || "No clauses found on this page.");
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

    const flaggedContainer = document.getElementById("flagged-clauses");
    const flaggedSection = document.getElementById("flagged-section");

    if (data.flagged_clauses && data.flagged_clauses.length > 0) {
      flaggedSection.hidden = false;
      for (const clause of data.flagged_clauses) {
        flaggedContainer.appendChild(buildClauseCard(clause));
      }
    }

    const goodContainer = document.getElementById("good-clauses");
    const goodSection = document.getElementById("good-section");

    if (data.good_clauses && data.good_clauses.length > 0) {
      goodSection.hidden = false;
      for (const clause of data.good_clauses) {
        goodContainer.appendChild(buildClauseCard(clause));
      }
    }
  }

  function buildClauseCard(clause) {
    const card = document.createElement("div");
    card.className = `clause-card ${clause.classification}`;

    let html = `<div class="clause-type ${clause.classification}">${clause.classification}</div>`;

    if (clause.quote) {
      html += `<div class="clause-quote">"${escapeHtml(clause.quote)}"</div>`;
    }

    if (clause.reasons && clause.reasons.length > 0) {
      html += `<div class="clause-reasons">`;
      for (const reason of clause.reasons) {
        html += `<div class="clause-reason">${escapeHtml(reason)}</div>`;
      }
      html += `</div>`;
    }

    card.innerHTML = html;
    return card;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
});
