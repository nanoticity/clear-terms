document.addEventListener("DOMContentLoaded", () => {
  const autoScanCheckbox = document.getElementById("auto-scan");
  const notificationsCheckbox = document.getElementById("notifications");
  const themeRadios = document.querySelectorAll("input[name='theme']");
  const saveButton = document.getElementById("save-btn");
  const statusMessage = document.getElementById("status-message");

  const defaults = {
    theme: "dark",
    autoScan: true,
    notifications: true,
  };

  chrome.storage.sync.get(defaults, (settings) => {
    autoScanCheckbox.checked = settings.autoScan;
    notificationsCheckbox.checked = settings.notifications;
    for (const radio of themeRadios) {
      radio.checked = radio.value === settings.theme;
    }
  });

  saveButton.addEventListener("click", () => {
    const theme = document.querySelector("input[name='theme']:checked")?.value || "dark";
    const autoScan = autoScanCheckbox.checked;
    const notifications = notificationsCheckbox.checked;

    chrome.storage.sync.set({ theme, autoScan, notifications }, () => {
      statusMessage.textContent = "Settings saved.";
      setTimeout(() => {
        statusMessage.textContent = "";
      }, 2500);
    });
  });
});
