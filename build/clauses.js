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

/**
 * Detect collapsed bullet lists: paragraphs that are mostly short fragments
 * with no sentence-ending punctuation between them.
 * e.g. "Terms you search for Videos you watch Voice and audio information"
 */
function isBulletDump(text) {
  // If the original had many short lines (now collapsed), detect via heuristics:
  // - No sentence-ending punctuation (., !, ?) anywhere
  // - Text is long enough to be suspicious (>80 chars) but reads like a list
  const hasSentenceEnd = /[.!?]/.test(text);
  if (hasSentenceEnd) return false;

  // Count capitalized words mid-string (after the first word) — lists of items
  // tend to have many mid-string capital letters (each item starts capitalized)
  const words = text.trim().split(/\s+/);
  if (words.length < 4) return false;

  const midCapCount = words.slice(1).filter(w => /^[A-Z]/.test(w)).length;
  const midCapRatio = midCapCount / (words.length - 1);

  // If >40% of non-first words start with a capital, it's likely a list dump
  return midCapRatio > 0.4;
}

/**
 * Returns true for boilerplate intro/transition sentences that carry no
 * policy substance, e.g. "We build a range of services that help millions..."
 */
function isBoilerplate(text) {
  const lower = text.toLowerCase().trim();

  const boilerplatePatterns = [
    // Intro sentences
    /^(we|our company|apple|google|amazon|meta|microsoft)\s+(build|offer|provide|create|develop|make)\s+a\s+(range|variety|number|suite|set)\s+of/,
    // "This agreement governs..." openers with no substantive clause
    /^(this\s+(agreement|policy|document|page|section|terms?)\s+(governs?|describes?|explains?|outlines?|sets?\s+out|applies?\s+to))\b/,
    // Pure navigation / "For more information see..."
    /^(for\s+more\s+(information|details?)|to\s+learn\s+more|please\s+(see|visit|read|refer)|you\s+can\s+(find|learn|read))\b/,
    // "Our services include:" type sentences with no actual clause
    /^(our\s+services?\s+include|examples?\s+of\s+(our\s+)?services?\s+include|the\s+services?\s+include)\b/,
  ];

  return boilerplatePatterns.some(re => re.test(lower));
}

/**
 * A real policy clause should make an assertion — it needs a finite verb
 * in a main clause context. We check for common policy verbs.
 */
function hasSubstantiveVerb(text) {
  const lower = text.toLowerCase();
  // Policy-relevant verbs that signal an actual obligation, permission, or action
  const policyVerbs = [
    /\b(may|will|shall|must|can|cannot|agree|consent|grant|collect|share|use|store|retain|delete|disclose|transfer|sell|license|provide|receive|access|process|protect|limit|restrict|terminate|suspend|modify|change|update)\b/,
  ];
  return policyVerbs.some(re => re.test(lower));
}

function extractClauses(tosText) {
  const paragraphs = tosText.split(/\n\s*\n/);
  const clauses = [];

  for (let para of paragraphs) {
    para = para.replace(/\s+/g, " ").trim();

    // Minimum length — raised to 120 to filter short intros
    if (para.length < 120) continue;

    // Skip structural noise
    if (isHeader(para)) continue;

    // Skip collapsed bullet lists (no sentence punctuation, many mid-caps)
    if (isBulletDump(para)) continue;

    // Skip pure boilerplate intro sentences
    if (isBoilerplate(para)) continue;

    // Must contain at least one policy-relevant verb
    if (!hasSubstantiveVerb(para)) continue;

    clauses.push(para);
  }

  return clauses;
}