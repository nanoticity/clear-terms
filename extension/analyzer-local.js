/**
 * Local ToS analysis using built-in TF-IDF + LinearSVC model.
 * Extracts clauses, classifies them, attaches reasoning, and computes a grade.
 */

function analyzeTosLocal(tosText, model) {
  const clauses = extractClauses(tosText);

  if (!clauses.length) {
    return { status: "error", message: "No clauses extracted from ToS" };
  }

  const predictions = predictBatch(clauses, model);

  const counts = { good: 0, neutral: 0, bad: 0, blocker: 0 };

  for (const pred of predictions) {
    const cls = pred.classification;
    if (cls in counts) counts[cls]++;
  }

  // Grade
  const total = clauses.length;
  const badRatio = (counts.bad + counts.blocker * 2) / total;
  const goodRatio = counts.good / total;
  let grade, gradeClass;
  if (badRatio < 0.1 && goodRatio > 0.4) { grade = "A"; gradeClass = "good"; }
  else if (badRatio < 0.2 && goodRatio > 0.25) { grade = "B"; gradeClass = "good"; }
  else if (badRatio < 0.35) { grade = "C"; gradeClass = "neutral"; }
  else if (badRatio < 0.5) { grade = "D"; gradeClass = "bad"; }
  else { grade = "F"; gradeClass = "blocker"; }

  // Build clause details with reasoning
  const flagged = [];
  const good = [];
  for (let i = 0; i < clauses.length; i++) {
    const pred = predictions[i];
    const reasons = getReasons(clauses[i]);
    const entry = {
      text: clauses[i],
      classification: pred.classification,
      confidence: pred.confidence,
      reasons: reasons,
      quote: clauses[i].length > 120 ? clauses[i].slice(0, 117) + "..." : clauses[i],
    };
    if (pred.classification === "bad" || pred.classification === "blocker") {
      flagged.push(entry);
    } else if (pred.classification === "good" && good.length < 5) {
      good.push(entry);
    }
  }

  return {
    status: "ok",
    total_clauses: total,
    classification_counts: counts,
    grade,
    grade_class: gradeClass,
    flagged_clauses: flagged,
    good_clauses: good,
  };
}
