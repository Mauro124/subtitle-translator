/**
 * Subtitle Translator Background Service Worker
 */

const GIST_ID = '23ca958cbc1b30b4e57c1f27009c49ca';
const SYNC_ALARM_NAME = 'sync-dictionary-alarm';

// Initialize default settings and sync
chrome.runtime.onInstalled.addListener(async () => {
  // Set default settings
  const settings = await chrome.storage.local.get(['isEnabled']);
  if (settings.isEnabled === undefined) {
    await chrome.storage.local.set({ isEnabled: true });
    console.log('ST: Extension initialized with isEnabled: true');
  }

  // Initial sync
  await syncDictionary();

  // Create daily sync alarm
  chrome.alarms.create(SYNC_ALARM_NAME, {
    periodInMinutes: 24 * 60 // Daily
  });

  // Phase 4: Contextual Activation via declarativeContent
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostSuffix: '.netflix.com' },
          }),
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostSuffix: '.youtube.com' },
          }),
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostSuffix: '.primevideo.com' },
          }),
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostSuffix: '.disneyplus.com' },
          }),
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostSuffix: 'apple.com' },
          })
        ],
        actions: [new chrome.declarativeContent.ShowAction()]
      }
    ]);
  });
});

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    console.log('ST: Starting scheduled dictionary sync...');
    syncDictionary();
  }
});

/**
 * Synchronize dictionary from GitHub Gist
 */
async function syncDictionary() {
  try {
    console.log('ST: Syncing dictionary from Gist...');
    
    // 1. Get Gist metadata to find raw URL
    const gistResponse = await fetch(`https://api.github.com/gists/${GIST_ID}`);
    if (!gistResponse.ok) throw new Error(`Gist API failed: ${gistResponse.status}`);
    
    const gistData = await gistResponse.json();
    const dictionaryFile = Object.values(gistData.files).find(f => f.filename.endsWith('.json'));
    
    if (!dictionaryFile) throw new Error('No JSON file found in Gist');
    
    // 2. Fetch raw content
    const rawResponse = await fetch(dictionaryFile.raw_url);
    if (!rawResponse.ok) throw new Error(`Raw fetch failed: ${rawResponse.status}`);
    
    const dictionaryJson = await rawResponse.json();
    
    // 3. Save to local storage
    await chrome.storage.local.set({
      syncedDictionary: dictionaryJson,
      lastSyncTimestamp: Date.now()
    });
    
    console.log('ST: Dictionary synced successfully', {
      wordCount: Object.keys(dictionaryJson).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('ST: Failed to sync dictionary', error);
  }
}

// Sync on startup too
chrome.runtime.onStartup.addListener(() => {
  syncDictionary();
});
