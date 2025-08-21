// Background service worker for Google Maps Leads Scraper

chrome.runtime.onInstalled.addListener(() => {
    console.log('Google Maps Leads Scraper extension installed');
});

chrome.runtime.onStartup.addListener(() => {
    console.log('Google Maps Leads Scraper extension started');
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'leadFound') {
        console.log('Lead found:', message.lead);
        // You can add additional processing here if needed
    }
    
    if (message.action === 'scrapingComplete') {
        console.log('Scraping completed');
        // You can add additional processing here if needed
    }
});

// Handle tab updates to check if we're on Google Maps
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (tab.url.includes('google.com/maps') || tab.url.includes('maps.google.com')) {
            console.log('Google Maps page detected:', tab.url);
        }
    }
});
