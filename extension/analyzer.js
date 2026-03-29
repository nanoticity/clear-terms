/**
 * Sends the full privacy policy text to OpenAI and gets back
 * structured clause analysis.
 */

const WORKER_URL = "https://openai-worker.nanoticity.workers.dev";

const SYSTEM_PROMPT = `Analyze this privacy policy / Terms of Service. Return JSON only.

Give an overall letter grade (A through F) for how user-friendly this policy is:
- A: Very user-friendly, strong privacy protections, minimal concerns
- B: Generally good, a few minor concerns but nothing alarming
- C: Average, some notable bad practices but also some good ones
- D: Poor, many unfavorable clauses, few protections
- F: Hostile to users, major red flags throughout

For each notable clause (skip boilerplate and neutral filler), return:
- "classification": "good", "bad", or "blocker"
  - good: protects user rights/privacy
  - bad: unfavorable to user
  - blocker: severely harmful (mandatory arbitration, selling data, irrevocable licenses, etc.)
- "quote": the key phrase from the document (exact wording, under 120 chars)
- "reason": one sentence explaining why it matters

Also count how many clauses total are neutral (standard legal language, neither good nor bad).

JSON format:
{
  "grade": "B",
  "neutral_count": 5,
  "clauses": [
    {"classification":"good","quote":"exact quote","reason":"why it matters"},
    {"classification":"bad","quote":"exact quote","reason":"why it matters"}
  ]
}`;

async function analyzeTos(tosText) {
  const maxChars = 30000;
  if (tosText.length > maxChars) {
    tosText = tosText.slice(0, maxChars);
  }

  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-nano",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: tosText },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 2000,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error (${res.status})`);
  }

  const json = await res.json();
  const raw = json.choices[0].message.content;
  const data = JSON.parse(raw);
  const clauses = data.clauses || [];
  const neutralCount = data.neutral_count || 0;

  if (!clauses.length && neutralCount === 0) {
    return { status: "error", message: "No clauses extracted from ToS" };
  }

  const counts = { good: 0, neutral: neutralCount, bad: 0, blocker: 0 };
  const flagged = [];
  const good = [];

  for (const clause of clauses) {
    const cls = clause.classification || "neutral";
    if (cls in counts) counts[cls]++;

    const entry = {
      classification: cls,
      reasons: clause.reason ? [clause.reason] : [],
      quote: clause.quote || null,
    };

    if (cls === "bad" || cls === "blocker") {
      flagged.push(entry);
    } else if (cls === "good" && good.length < 5) {
      good.push(entry);
    }
  }

  const total = counts.good + counts.neutral + counts.bad + counts.blocker;

  const grade = (data.grade || "C").toUpperCase().charAt(0);
  const gradeClassMap = { A: "good", B: "good", C: "neutral", D: "bad", F: "blocker" };
  const gradeClass = gradeClassMap[grade] || "neutral";

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
