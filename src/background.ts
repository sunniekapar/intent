// Background script for Chrome extension
import { cleanupExpiredIntentions } from './utils/storage';

console.log('[CRXJS] Background script loaded');

// Clean up expired intentions every hour
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// Initial cleanup on extension startup
cleanupExpiredIntentions().then(cleanedCount => {
  if (cleanedCount > 0) {
    console.log(`[Background] Initial cleanup: removed ${cleanedCount} expired intentions`);
  }
});

// Set up periodic cleanup
setInterval(async () => {
  const cleanedCount = await cleanupExpiredIntentions();
  if (cleanedCount > 0) {
    console.log(`[Background] Periodic cleanup: removed ${cleanedCount} expired intentions`);
  }
}, CLEANUP_INTERVAL_MS);

// Listen for extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Background] Extension installed/updated:', details.reason);
  console.log('[Background] Details:', details);
  
  if (details.reason === 'install' || details.reason === 'chrome_update') {
    console.log('[Background] Opening welcome page...');
    chrome.tabs.create({
      url: chrome.runtime.getURL('src/popup/index.html#/welcome')
    }).then((tab) => {
      console.log('[Background] Welcome page tab created:', tab);
    }).catch((error) => {
      console.error('[Background] Error creating welcome page tab:', error);
    });
  }
  
  // Clean up on installation/update
  cleanupExpiredIntentions().then(cleanedCount => {
    if (cleanedCount > 0) {
      console.log(`[Background] Post-install cleanup: removed ${cleanedCount} expired intentions`);
    }
  });
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CLEANUP_INTENTIONS') {
    cleanupExpiredIntentions().then(cleanedCount => {
      sendResponse({ cleanedCount });
    });
    return true; // Keep message channel open for async response
  }
  
  if (message.type === 'GET_STORAGE_INFO') {
    // Return storage information for debugging
    chrome.storage.local.get(null).then((data) => {
      const intentionCount = Object.keys(data).filter(key => 
        data[key] && data[key].intention
      ).length;
      
      sendResponse({ 
        totalEntries: Object.keys(data).length,
        intentionEntries: intentionCount
      });
    });
    return true;
  }
  
  // this is used in the landing page to open the extension
  if (message.type === 'OPEN_POPUP') {
    try {
      chrome.action.openPopup().then(() => {
        sendResponse({ success: true });
      }).catch((error) => {
        sendResponse({ success: false, error: String(error) });
      });
    } catch (error) {
      sendResponse({ success: false, error: String(error) });
    }
    return true;
  }
  
  // Handle opening popup with specific route
  if (message.type === 'OPEN_POPUP_WITH_ROUTE') {
    const route = message.route || '/';
    try {
      // Store the desired route in storage
      chrome.storage.local.set({ pendingRoute: route }, () => {
        chrome.action.openPopup().then(() => {
          sendResponse({ success: true });
        }).catch((error) => {
          sendResponse({ success: false, error: String(error) });
        });
      });
    } catch (error) {
      sendResponse({ success: false, error: String(error) });
    }
    return true;
  }
}); 