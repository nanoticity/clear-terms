document.addEventListener("DOMContentLoaded", () => {
  const modeOpenAI = document.getElementById("mode-openai");
  const modeLocal = document.getElementById("mode-local");
  const apiKeySection = document.getElementById("api-key-section");
  const apiKeyInput = document.getElementById("api-key");
  const saveBtn = document.getElementById("save-btn");
  const saveStatus = document.getElementById("save-status");

  // Toggle API key visibility based on mode
  function updateVisibility() {
    apiKeySection.hidden = !modeOpenAI.checked;
  }

  modeOpenAI.addEventListener("change", updateVisibility);
  modeLocal.addEventListener("change", updateVisibility);

  // Load saved settings
  chrome.storage.sync.get(["analysisMode", "openaiApiKey"], (result) => {
    if (result.analysisMode === "openai") {
      modeOpenAI.checked = true;
    } else if (result.analysisMode === "local") {
      modeLocal.checked = true;
    }
    if (result.openaiApiKey) {
      apiKeyInput.value = result.openaiApiKey;
    }
    updateVisibility();
  });

  // Save
  saveBtn.addEventListener("click", () => {
    saveStatus.textContent = "";
    saveStatus.className = "save-status";

    let mode = null;
    if (modeOpenAI.checked) mode = "openai";
    else if (modeLocal.checked) mode = "local";

    if (!mode) {
      saveStatus.textContent = "Please select an analysis mode.";
      saveStatus.className = "save-status error";
      return;
    }

    if (mode === "openai") {
      const key = apiKeyInput.value.trim();
      if (!key) {
        saveStatus.textContent = "Please enter your OpenAI API key.";
        saveStatus.className = "save-status error";
        return;
      }
    }

    chrome.storage.sync.set({
      analysisMode: mode,
      openaiApiKey: mode === "openai" ? apiKeyInput.value.trim() : undefined,
    }, () => {
      saveStatus.textContent = "Settings saved!";
      saveStatus.className = "save-status";
    });
  });
});
