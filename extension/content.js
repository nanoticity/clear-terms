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
