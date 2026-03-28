/**
 * ToS analysis aggregation.
 * Port of backend/classifier.py analyze_tos().
 * Returns the same JSON shape the popup already expects.
 */

function analyzeTos(tosText, model) {
  const clauses = extractClauses(tosText);

  if (!clauses.length) {
    return { status: "error", message: "No clauses extracted from ToS" };
  }

  const predictions = predictBatch(clauses, model);

  const counts = { good: 0, neutral: 0, bad: 0, blocker: 0 };
  const confidences = { good: [], neutral: [], bad: [], blocker: [] };

  for (const pred of predictions) {
    const cls = pred.classification;
    if (cls in counts) {
      counts[cls]++;
      confidences[cls].push(pred.confidence);
    }
  }

  const avgConfidences = {};
  for (const [k, v] of Object.entries(confidences)) {
    avgConfidences[k] = v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 1000) / 1000 : 0;
  }

  // Compute a letter grade based on clause distribution
  const total = clauses.length;
  const badRatio = (counts.bad + counts.blocker * 2) / total;
  const goodRatio = counts.good / total;
  let grade, gradeClass;
  if (badRatio < 0.1 && goodRatio > 0.4) {
    grade = "A"; gradeClass = "good";
  } else if (badRatio < 0.2 && goodRatio > 0.25) {
    grade = "B"; gradeClass = "good";
  } else if (badRatio < 0.35) {
    grade = "C"; gradeClass = "neutral";
  } else if (badRatio < 0.5) {
    grade = "D"; gradeClass = "bad";
  } else {
    grade = "F"; gradeClass = "blocker";
  }

  const flagged_clauses = [];
  for (let i = 0; i < clauses.length; i++) {
    const pred = predictions[i];
    if (pred.classification === "bad" || pred.classification === "blocker") {
      flagged_clauses.push({
        text: clauses[i],
        classification: pred.classification,
        confidence: pred.confidence,
      });
    }
  }

  return {
    status: "ok",
    total_clauses: clauses.length,
    classification_counts: counts,
    average_confidences: avgConfidences,
    grade: grade,
    grade_class: gradeClass,
    sample_clauses: {
      bad: clauses.filter((c, i) => predictions[i].classification === "bad").slice(0, 2),
      blocker: clauses.filter((c, i) => predictions[i].classification === "blocker").slice(0, 2),
    },
    flagged_clauses: flagged_clauses,
  };
}
