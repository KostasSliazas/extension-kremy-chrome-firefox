// FILE: background.js
// ROLE: context menu → send SAVE command

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "rememberField",
    title: "Remember me",
    contexts: ["editable"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "rememberField" || !tab?.id) return;

  try {
    await chrome.tabs.sendMessage(
      tab.id,
      { action: "SAVE_FIELD" },
      { frameId: info.frameId }
    );
  } catch (err) {
    // fallback injection
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });

      await chrome.tabs.sendMessage(tab.id, {
        action: "SAVE_FIELD"
      });
    } catch (e) {
      console.warn("Kremy injection failed:", e);
    }
  }
});
