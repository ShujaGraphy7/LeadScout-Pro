// LeadScout Pro - Background Service Worker
console.log('LeadScout Pro extension loaded');

chrome.runtime.onInstalled.addListener(() => {
    console.log('LeadScout Pro extension installed');
});

chrome.runtime.onStartup.addListener(() => {
    console.log('LeadScout Pro extension started');
});

// Handle tab updates to check if we're on Google Maps
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (tab.url.includes('google.com/maps') || tab.url.includes('maps.google.com')) {
            console.log('Google Maps page detected, LeadScout Pro ready');
        }
    }
});
