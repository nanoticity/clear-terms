/**
 * Clause extraction from ToS documents.
 */

function isHeader(text) {
  const stripped = text.trim();
  if (/^[A-Z0-9\s\-\/&,;:()]+$/.test(stripped) && stripped.length < 200) return true;
  if (/^[A-Z0-9]{1,4}[.)]\s*$/.test(stripped)) return true;
  if (/^(section\s+)?\d+[.):]?\s+[A-Z]/i.test(stripped) && stripped.length < 80) return true;
  if (/^(article|part|chapter|schedule|exhibit|appendix)\s+/i.test(stripped) && stripped.length < 100) return true;
  return false;
}

function isBoilerplate(text) {
  const lower = text.toLowerCase();
  const phrases = [
    "all rights reserved",
    "table of contents",
    "click here",
    "last updated",
    "effective date",
    "copyright",
    "scroll down",
  ];
  return phrases.some(p => lower.startsWith(p) || lower === p);
}

function extractClauses(tosText) {
  const paragraphs = tosText.split(/\n\s*\n/);
  const clauses = [];

  for (let para of paragraphs) {
    para = para.replace(/\s+/g, " ").trim();
    if (para.length < 50) continue;
    if (isHeader(para)) continue;
    if (isBoilerplate(para)) continue;
    clauses.push(para);
  }

  return clauses;
}
