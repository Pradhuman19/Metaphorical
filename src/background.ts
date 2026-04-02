console.log('News Cross-Check Background Service Worker Loaded');

chrome.runtime.onInstalled.addListener(() => {
  console.log('News Cross-Check Extension Installed');
});

// Example: Listen for side panel opening
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => console.error(error));
