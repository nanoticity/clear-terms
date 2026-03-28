/*
 * Background service worker.
 * Minimal — just holds the model cache. Analysis is triggered from the popup.
 */

let _model = null;

async function getModel() {
  if (_model) return _model;
  const resp = await fetch(chrome.runtime.getURL("model/model.json"));
  _model = await resp.json();
  return _model;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getModel") {
    getModel().then(model => sendResponse({ model })).catch(() => sendResponse({ model: null }));
    return true; // async response
  }
});
