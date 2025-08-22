document.addEventListener('DOMContentLoaded', function() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const exportBtn = document.getElementById('exportBtn');
    const debugModeCheckbox = document.getElementById('debugMode');
    const debugInfo = document.getElementById('debugInfo');
    const inspectPageBtn = document.getElementById('inspectPage');
    const inspectionResults = document.getElementById('inspectionResults');
    
    let scrapedLeads = [];
    let isScraping = false;

    // Load settings
    loadSettings();

    // Check if we're on Google Maps
    updateDebugInfo();

    startBtn.addEventListener('click', startScraping);
    stopBtn.addEventListener('click', stopScraping);
    exportBtn.addEventListener('click', exportCSV);
    debugModeCheckbox.addEventListener('change', toggleDebugMode);
    inspectPageBtn.addEventListener('click', inspectPage);

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
            if (message.action === 'leadFound') {
                scrapedLeads.push(message.lead);
                updateResultsList();
                updateStatus(`Found ${scrapedLeads.length} leads`);
            } else if (message.action === 'updateProgress') {
                updateProgress(`${message.current}/${message.total} leads found`);
            } else if (message.action === 'scrapingComplete') {
                isScraping = false;
                startBtn.style.display = 'inline-block';
                stopBtn.style.display = 'none';
                updateStatus('Scraping completed');
            }
        } catch (error) {
            console.log('Error handling message:', error);
        }
        
        // Always send a response to prevent connection errors
        sendResponse({ success: true });
    });

    function startScraping() {
        if (isScraping) return;

        getCurrentTab().then(async (currentTab) => {
            if (!currentTab) return;

            if (!currentTab.url.includes('google.com/maps') && !currentTab.url.includes('maps.google.com')) {
                alert('Please navigate to Google Maps to start scraping.');
                return;
            }

            // Check if content script is available
            const contentScriptReady = await checkContentScriptAvailable();
            if (!contentScriptReady) {
                alert('Extension is not ready. Please refresh the page and try again.');
                return;
            }

            const settings = {
                extractPhones: document.getElementById('extractPhones').checked,
                extractEmails: false, // Email functionality disabled
                autoScroll: document.getElementById('autoScroll').checked
            };

            saveSettings(settings);

            try {
                const response = await sendMessageToContentScript({ action: 'startScraping', settings: settings });
                if (response && response.success) {
                    isScraping = true;
                    startBtn.style.display = 'none';
                    stopBtn.style.display = 'inline-block';
                    updateStatus('Scraping started...');
                    updateProgress('0 leads found');
                } else {
                    alert('Failed to start scraping. Make sure you\'re on Google Maps.');
                }
            } catch (error) {
                console.log('Error starting scraping:', error);
                alert('Failed to start scraping. Please refresh the page and try again.');
            }
        });
    }

    function stopScraping() {
        if (!isScraping) return;

        getCurrentTab().then(async (currentTab) => {
            if (!currentTab) return;

            try {
                await sendMessageToContentScript({ action: 'stopScraping' });
                isScraping = false;
                startBtn.style.display = 'inline-block';
                stopBtn.style.display = 'none';
                updateStatus('Scraping stopped');
            } catch (error) {
                console.log('Error stopping scraping:', error);
                // Even if message fails, update UI
                isScraping = false;
                startBtn.style.display = 'inline-block';
                stopBtn.style.display = 'none';
                updateStatus('Scraping stopped');
            }
        });
    }

    function addLead(lead) {
        scrapedLeads.push(lead);
        updateResultsList();
        updateProgress(`${scrapedLeads.length} leads found`);
    }

    function updateResultsList() {
        const resultsList = document.getElementById('resultsList');
        const resultsCount = document.getElementById('resultsCount');
        
        resultsCount.textContent = scrapedLeads.length;
        
        if (scrapedLeads.length === 0) {
            resultsList.innerHTML = '<p>No leads scraped yet</p>';
            return;
        }

        resultsList.innerHTML = scrapedLeads.map((lead, index) => `
            <div class="lead-item">
                <h4>${lead.name || 'Unknown Business'}</h4>
                <p><strong>Type:</strong> ${lead.businessType || 'N/A'}</p>
                <p><strong>Address:</strong> ${lead.address || 'N/A'}</p>
                <p><strong>Phone:</strong> ${lead.phone || 'N/A'}</p>
                <p><strong>Website:</strong> ${lead.website || 'N/A'}</p>
                <p><strong>Rating:</strong> ${lead.rating || 'N/A'}</p>
                <p><strong>Hours:</strong> ${lead.hours || 'N/A'}</p>
                <p><strong>Services:</strong> ${lead.services && lead.services.length > 0 ? lead.services.join(', ') : 'N/A'}</p>
            </div>
        `).join('');
    }

    function updateStatus(status) {
        document.getElementById('statusText').textContent = status;
    }

    function updateProgress(progress) {
        document.getElementById('progressText').textContent = progress;
    }

    function scrapingComplete() {
        isScraping = false;
        startBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
        updateStatus('Scraping completed');
        updateProgress(`${scrapedLeads.length} leads found`);
    }

    function exportCSV() {
        if (scrapedLeads.length === 0) {
            alert('No leads to export.');
            return;
        }

        const csvContent = generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `google-maps-leads-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    function generateCSV() {
        const headers = ['Business Name', 'Business Type', 'Address', 'Phone', 'Website', 'Rating', 'Hours', 'Services'];
        const rows = scrapedLeads.map(lead => [
            lead.name || '',
            lead.businessType || '',
            lead.address || '',
            lead.phone || '',
            lead.website || '',
            lead.rating || '',
            lead.hours || '',
            lead.services && lead.services.length > 0 ? lead.services.join('; ') : ''
        ]);

        return [headers, ...rows].map(row => 
            row.map(field => `"${field}"`).join(',')
        ).join('\n');
    }

    function toggleDebugMode() {
        const isDebugMode = debugModeCheckbox.checked;
        debugInfo.style.display = isDebugMode ? 'block' : 'none';
        saveSettings({ debugMode: isDebugMode });
        
        if (isDebugMode) {
            updateDebugInfo();
        }
    }

    function updateDebugInfo() {
        const currentUrl = document.getElementById('currentUrl');
        const mapsDetected = document.getElementById('mapsDetected');
        const visibleResults = document.getElementById('visibleResults');
        const lastError = document.getElementById('lastError');

        getCurrentTab().then(tab => {
            currentUrl.textContent = tab.url;
            mapsDetected.textContent = (tab.url.includes('google.com/maps') || tab.url.includes('maps.google.com')) ? 'Yes' : 'No';
            
            if (tab.url.includes('google.com/maps') || tab.url.includes('maps.google.com')) {
                chrome.tabs.sendMessage(tab.id, { action: 'getDebugInfo' }, (response) => {
                    if (response && response.success) {
                        visibleResults.textContent = response.visibleResults || 'Unknown';
                    } else {
                        visibleResults.textContent = 'Error getting info';
                    }
                });
            } else {
                visibleResults.textContent = 'N/A';
            }
        });

        lastError.textContent = 'None';
    }

    function inspectPage() {
        getCurrentTab().then(async (currentTab) => {
            if (!currentTab) return;

            try {
                const response = await sendMessageToContentScript({ action: 'inspectPage' });
                if (response && response.data) {
                    displayInspectionResults(response.data);
                } else {
                    alert('Failed to inspect page. Please refresh and try again.');
                }
            } catch (error) {
                console.log('Error inspecting page:', error);
                alert('Failed to inspect page. Please refresh the page and try again.');
            }
        });
    }

    function displayInspectionResults(data) {
        const inspectionData = document.getElementById('inspectionData');
        inspectionData.innerHTML = `
            <p><strong>Business Elements Found:</strong> ${data.businessElements}</p>
            <p><strong>Available Selectors:</strong> ${data.availableSelectors}</p>
            <p><strong>Page Structure:</strong> ${data.pageStructure}</p>
        `;
        inspectionResults.style.display = 'block';
    }

    function getCurrentTab() {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                resolve(tabs[0]);
            });
        });
    }

    function loadSettings() {
        chrome.storage.sync.get(['extractPhones', 'extractEmails', 'autoScroll', 'debugMode'], (result) => {
            if (result.extractPhones !== undefined) document.getElementById('extractPhones').checked = result.extractPhones;
            if (result.extractEmails !== undefined) document.getElementById('extractEmails').checked = result.extractEmails;
            if (result.autoScroll !== undefined) document.getElementById('autoScroll').checked = result.autoScroll;
            if (result.debugMode !== undefined) {
                document.getElementById('debugMode').checked = result.debugMode;
                debugInfo.style.display = result.debugMode ? 'block' : 'none';
            }
        });
    }

    function saveSettings(settings) {
        chrome.storage.sync.set(settings);
    }

    // Check if content script is available
    async function checkContentScriptAvailable() {
        try {
            const currentTab = await getCurrentTab();
            if (!currentTab) return false;
            
            // Try to send a test message to check if content script is ready
            return new Promise((resolve) => {
                chrome.tabs.sendMessage(currentTab.id, { action: 'ping' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log('Content script not ready:', chrome.runtime.lastError.message);
                        resolve(false);
                    } else {
                        resolve(true);
                    }
                });
            });
        } catch (error) {
            console.log('Error checking content script:', error);
            return false;
        }
    }

    // Safe message sending with error handling
    async function sendMessageToContentScript(message) {
        try {
            const currentTab = await getCurrentTab();
            if (!currentTab) {
                throw new Error('No active tab found');
            }
            
            return new Promise((resolve, reject) => {
                chrome.tabs.sendMessage(currentTab.id, message, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log('Message send error:', chrome.runtime.lastError.message);
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(response);
                    }
                });
            });
        } catch (error) {
            console.log('Error sending message:', error);
            throw error;
        }
    }
});
