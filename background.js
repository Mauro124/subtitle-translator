/**
 * Subtitle Translator Background Service Worker
 */

// Initialize default settings
chrome.runtime.onInstalled.addListener(async () => {
  const settings = await chrome.storage.local.get(['isEnabled']);
  if (settings.isEnabled === undefined) {
    await chrome.storage.local.set({ isEnabled: true });
    console.log('ST: Extension initialized with isEnabled: true');
  }
  updateActionIcon(settings.isEnabled !== false);
});

// Update icon when state changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.isEnabled) {
    updateActionIcon(changes.isEnabled.newValue);
  }
});

/**
 * Update the extension icon (grayscale if disabled)
 * @param {boolean} isEnabled 
 */
function updateActionIcon(isEnabled) {
  const path = isEnabled ? 'assets/icons/icon-192.png' : 'assets/icons/icon-192.png'; // TODO: add grayscale icon
  
  // Note: Since we don't have a grayscale asset yet, we can't fully implement icon swap.
  // For now, we log and keep the original icon.
  console.log(`ST: Extension icon should be ${isEnabled ? 'Active' : 'Grayscale'}`);
}
