// Minimal content script - just for logging and basic functionality
console.log('Copy Clean for Sheets content script loaded');

// Listen for messages from popup (if needed in the future)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  if (request.action === 'ping') {
    sendResponse({ status: 'alive' });
  }
  
  return true;
});