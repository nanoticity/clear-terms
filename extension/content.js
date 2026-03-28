/*
 * Auto-detect privacy policy on any page.
 *
 * Scans <a> tags and tries fallback paths to find the privacy policy URL.
 * Sends the URL to the background worker — the background handles fetching
 * the actual page content in a hidden tab.
 */

const LINK_TEXT_RE = /privacy\s*(policy|notice|statement)?|data\s*policy|datenschutz/i;
const LINK_HREF_RE = /\/(privacy|datapolicy|data-policy|privacy-policy|privacy_policy)([-_\/]|$)/i;

const SITEMAP_PRIVACY_RE = /privacy|datapolicy|data-policy/i;

const FALLBACK_PATHS = [
  "/privacy",
  "/privacy-policy",
  "/privacy_policy",
  "/legal/privacy",
  "/pages/privacy",
  "/about/privacy",
  "/info/privacy",
  "/company/privacy",
];

function getRootDomain(hostname) {
  const parts = hostname.split(".");
  return parts.length > 2 ? parts.slice(-2).join(".") : hostname;
}

function isSameSite(url) {
  try {
    return getRootDomain(new URL(url).hostname) === getRootDomain(location.hostname);
  } catch { return false; }
}

// ── 1. Scan page links ────────────────────────────────

function findPrivacyLink() {
  const links = document.querySelectorAll("a[href]");

  for (const a of links) {
    const href = a.href;
    const text = (a.textContent || "").replace(/\s+/g, " ").trim();

    if (!href.startsWith("http")) continue;
    if (!isSameSite(href)) continue;

    if (LINK_TEXT_RE.test(text) || LINK_HREF_RE.test(href)) {
      return href;
    }
  }
  return null;
}

// ── 2. Check sitemap ──────────────────────────────────

async function findPrivacyInSitemap() {
  try {
    const resp = await fetch(location.origin + "/sitemap.xml", { credentials: "omit" });
    if (!resp.ok) return null;
    const xml = await resp.text();
    const urls = [];
    const re = /<loc>\s*(.*?)\s*<\/loc>/gi;
    let m;
    while ((m = re.exec(xml)) !== null) urls.push(m[1]);
    for (const url of urls) {
      if (SITEMAP_PRIVACY_RE.test(url)) return url;
    }
  } catch {}
  return null;
}

// ── 3. Try fallback paths (HEAD request) ──────────────

async function tryFallbackPaths() {
  for (const path of FALLBACK_PATHS) {
    const url = location.origin + path;
    try {
      const resp = await fetch(url, { method: "HEAD", credentials: "omit" });
      if (resp.ok) return url;
    } catch {}
  }
  return null;
}

// ── Main ──────────────────────────────────────────────

chrome.storage.sync.get({ autoScan: true }, (settings) => {
  if (!settings.autoScan) return;
  (async () => {
    if (!location.protocol.startsWith("http")) return;

    const key = "__ct_" + location.hostname;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    console.log("[Clear Terms] Scanning for privacy policy on", location.hostname);

  let policyUrl = findPrivacyLink();
  if (policyUrl) console.log("[Clear Terms] Found link:", policyUrl);

  if (!policyUrl) {
    policyUrl = await findPrivacyInSitemap();
    if (policyUrl) console.log("[Clear Terms] Found in sitemap:", policyUrl);
  }

  if (!policyUrl) {
    policyUrl = await tryFallbackPaths();
    if (policyUrl) console.log("[Clear Terms] Found via fallback:", policyUrl);
  }

  if (!policyUrl) {
    console.log("[Clear Terms] No privacy policy found.");
    return;
  }

  // Send URL to background — it will open a hidden tab to get the real rendered text
  chrome.runtime.sendMessage({
    action: "foundPolicy",
    url: policyUrl,
    hostname: location.hostname,
  });
  })();
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action !== "gradeReady") return;
  chrome.storage.sync.get({ notifications: true, theme: "dark" }, (settings) => {
    if (!settings.notifications) return;
    showGradeNotification(msg, settings.theme);
  });
});

function showGradeNotification(msg, theme = "dark") {
  const existing = document.getElementById("clear-terms-grade-notification");
  if (existing) return;

  const banner = document.createElement("div");
  banner.id = "clear-terms-grade-notification";
  banner.style.position = "fixed";
  banner.style.bottom = "16px";
  banner.style.right = "16px";
  banner.style.zIndex = "2147483647";
  banner.style.maxWidth = "320px";
  banner.style.padding = "14px 16px";
  banner.style.borderRadius = "12px";
  banner.style.boxShadow = theme === "light" ? "0 18px 40px rgba(0,0,0,0.12)" : "0 18px 40px rgba(0,0,0,0.22)";
  banner.style.background = theme === "light" ? "rgba(255, 255, 255, 0.96)" : "rgba(20, 28, 54, 0.96)";
  banner.style.color = theme === "light" ? "#111" : "#fff";
  banner.style.fontFamily = "system-ui, sans-serif";
  banner.style.fontSize = "14px";
  banner.style.lineHeight = "1.4";
  banner.style.backdropFilter = "blur(12px)";

  const label = document.createElement("div");
  label.textContent = "Clear Terms grade ready";
  label.style.fontWeight = "700";
  label.style.marginBottom = "6px";
  banner.appendChild(label);

  const gradeLine = document.createElement("div");
  gradeLine.innerHTML = `Grade: <strong>${escapeHtml(msg.grade || "?")}</strong> <span style="opacity:.8">(${escapeHtml(msg.grade_class || "")})</span>`;
  banner.appendChild(gradeLine);

  if (msg.total_clauses !== undefined) {
    const detail = document.createElement("div");
    detail.textContent = `Clauses analyzed: ${msg.total_clauses}`;
    detail.style.marginTop = "6px";
    detail.style.opacity = "0.9";
    banner.appendChild(detail);
  }

  const button = document.createElement("button");
  button.textContent = "Hide";
  button.style.marginTop = "12px";
  button.style.padding = "8px 12px";
  button.style.border = "none";
  button.style.borderRadius = "8px";
  button.style.background = theme === "light" ? "#111" : "#ffffff";
  button.style.color = theme === "light" ? "#fff" : "#111";
  button.style.cursor = "pointer";
  button.style.fontWeight = "600";
  button.addEventListener("click", () => banner.remove());
  banner.appendChild(button);

  document.body.appendChild(banner);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
