/**
 * Clause extraction from ToS documents.
 * Direct port of backend/classifier.py extract_clauses() and _is_header().
 */

function isHeader(text) {
  const stripped = text.trim();

  // All caps (with optional punctuation/numbers)
  if (/^[A-Z0-9\s\-\/&,;:()]+$/.test(stripped) && stripped.length < 200) {
    return true;
  }
  // Single letter/number labels like "G.", "12.", "IV.", "A)"
  if (/^[A-Z0-9]{1,4}[.)]\s*$/.test(stripped)) {
    return true;
  }
  // Numbered section headers like "1. Introduction" or "Section 5: Data"
  if (/^(section\s+)?\d+[.):]?\s+[A-Z]/i.test(stripped) && stripped.length < 80) {
    return true;
  }
  return false;
}

function extractClauses(tosText) {
  const paragraphs = tosText.split(/\n\s*\n/);
  const clauses = [];

  for (let para of paragraphs) {
    para = para.replace(/\s+/g, " ").trim();

    if (para.length < 80) continue;
    if (isHeader(para)) continue;

    clauses.push(para);
  }

  return clauses;
}
