/*
 * Background service worker.
 *
 * When the content script finds a privacy policy URL, this worker:
 *   1. Opens the URL in a hidden background tab
 *   2. Waits for it to load
 *   3. Extracts the rendered text via executeScript
 *   4. Sends the full text to OpenAI for AI-powered analysis
 *   5. Sets the badge grade and caches results for the popup
 *   6. Closes the hidden tab
 */

importScripts("analyzer.js");

const BADGE_COLORS = { A: "#3fb68b", B: "#58a6b1", C: "#d4a850", D: "#d07840", F: "#cf5050" };

// ── Fetch policy text via hidden tab ──────────────────

function fetchPolicyViaTab(url) {
  return new Promise((resolve) => {
    chrome.tabs.create({ url, active: false }, (tab) => {
      const tabId = tab.id;

      function onComplete(changedTabId, info) {
        if (changedTabId !== tabId || info.status !== "complete") return;
        chrome.tabs.onUpdated.removeListener(onComplete);

        setTimeout(() => {
          chrome.scripting.executeScript({
            target: { tabId },
            func: () => document.body.innerText,
          }).then(([result]) => {
            chrome.tabs.remove(tabId);
            resolve(result?.result || null);
          }).catch(() => {
            chrome.tabs.remove(tabId);
            resolve(null);
          });
        }, 1500);
      }

      chrome.tabs.onUpdated.addListener(onComplete);

      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(onComplete);
        chrome.tabs.remove(tabId).catch(() => {});
        resolve(null);
      }, 15000);
    });
  });
}

// ── Listen for content script messages ────────────────

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action !== "foundPolicy" || !sender.tab?.id) return;
  const originTabId = sender.tab.id;

  (async () => {
    try {
      console.log("[Clear Terms] Fetching policy for", msg.hostname, "from", msg.url);

      const text = await fetchPolicyViaTab(msg.url);
      if (!text || text.length < 200) {
        console.log("[Clear Terms] No usable text from", msg.url);
        return;
      }

      console.log("[Clear Terms] Got", text.length, "chars, sending to AI...");

      const result = await analyzeTos(text);
      if (result.status !== "ok") return;

      console.log("[Clear Terms]", msg.hostname, "→", result.grade);

      await chrome.storage.session.set({
        ["ct_" + msg.hostname]: { ...result, policyUrl: msg.url, hostname: msg.hostname },
      });

      chrome.action.setBadgeText({ text: result.grade, tabId: originTabId });
      chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS[result.grade] || "#666", tabId: originTabId });
    } catch (err) {
      console.error("[Clear Terms] Error:", err);
    }
  })();
});
