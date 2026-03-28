/**
 * Pattern-based reasoning for ToS clause analysis.
 * Detects known problematic (and good) patterns and returns human-readable explanations.
 */

const REASON_PATTERNS = [
  // Bad / Blocker
  [/(share|sell|disclose|provide|transfer)\b.{0,40}\b(data|information|personal).{0,40}\b(third.part|partner|advertis|affiliate)/i,
    "Allows sharing your personal data with third parties"],
  [/(collect|gather|track|monitor)\b.{0,40}\b(location|browsing|behavio|biometric|health|financial)/i,
    "Collects sensitive personal data"],
  [/(not|no|shall not be)\s+(liable|responsible)\b|limit(ation|ed)?\s+of\s+liability|disclaim.{0,20}(warrant|liabilit)/i,
    "Limits the company's liability for damages to you"],
  [/(change|modify|update|revise|amend)\b.{0,40}(terms|agreement|policy).{0,40}(without.{0,20}notice|any\s*time|sole\s*discretion)/i,
    "Can change terms without notifying you"],
  [/(terminat|suspend|cancel|disable)\b.{0,40}(account|access|service).{0,40}(any\s*reason|sole\s*discretion|without|at\s*any\s*time)/i,
    "Can terminate your account at any time without reason"],
  [/(waive|waiver|give\s*up|relinquish|forfeit)\b.{0,40}(right|claim|recourse)/i,
    "May require you to waive important legal rights"],
  [/(arbitrat|class.action.waiver|waive.{0,30}(class|jury|right to sue))/i,
    "Mandatory arbitration or class action waiver limits your legal options"],
  [/(retain|keep|store|maintain)\b.{0,40}(data|information).{0,40}(indefinite|permanent|after|even\s*if|terminat)/i,
    "Your data may be kept even after you leave the service"],
  [/(irrevocab|perpetual|royalty.free|worldwide|sublicens)\b.{0,40}(licen[sc]e|right|grant)/i,
    "Grants the company broad rights over your content"],
  [/(sell|monetiz|commercial).{0,40}\b(data|information|content)\b/i,
    "Your data or content may be used commercially"],
  [/(indemnif|hold\s*harmless|defend\s+us)/i,
    "You must cover the company's legal costs if issues arise"],

  // Good
  [/(delete|erase|remove)\b.{0,40}(data|information|account).{0,40}(request|right|upon|ask)/i,
    "You can request deletion of your data"],
  [/(encrypt|ssl|tls|https|secure).{0,40}(data|information|transfer|transmis|stor)/i,
    "Data is encrypted or transmitted securely"],
  [/(notify|inform|notice|alert)\b.{0,40}(change|breach|update|modif)/i,
    "You will be notified of important changes or breaches"],
  [/(opt.out|unsubscribe|withdraw\s*consent|choose\s*not\s*to|disable.{0,20}track)/i,
    "You can opt out of certain data practices"],
  [/(do\s*not|never|will\s*not)\b.{0,30}(sell|share|trade|disclose).{0,30}(data|information|personal)/i,
    "The company commits to not selling your data"],
  [/(gdpr|ccpa|coppa|hipaa|complian|regulation)\b/i,
    "References specific privacy regulations or compliance"],
  [/(minimiz|only\s*collect|limit.{0,20}collect|necessary|essential)\b.{0,30}(data|information)/i,
    "Practices data minimization"],
];

function getReasons(text) {
  const reasons = [];
  for (const [pattern, reason] of REASON_PATTERNS) {
    if (pattern.test(text)) {
      reasons.push(reason);
    }
  }
  return reasons;
}
