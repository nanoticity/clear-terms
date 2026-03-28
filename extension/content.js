/*
 * Content script — extracts page text when requested by the popup.
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getPageText") {
    sendResponse({ text: document.body.innerText });
  }
});
