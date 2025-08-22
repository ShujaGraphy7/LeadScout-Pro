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

    // Event listeners
    startBtn.addEventListener('click', startScraping);
    stopBtn.addEventListener('click', stopScraping);
    exportBtn.addEventListener('click', exportData);
    debugModeCheckbox.addEventListener('change', toggleDebugMode);
    inspectPageBtn.addEventListener('click', inspectPage);
    
    // Update export button text when format changes
    document.getElementById('exportFormat').addEventListener('change', function() {
        const format = this.value;
        const exportBtn = document.getElementById('exportBtn');
        if (format === 'xls') {
            exportBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M14 10V12A2 2 0 0 1 12 14H4A2 2 0 0 1 2 12V10M14 10L12 8M14 10L10 14M2 10L4 8M2 10L6 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Export XLS
            `;
        } else {
            exportBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1V11M8 11L4 7M8 11L12 7M2 15H14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Export CSV
            `;
        }
    });
    
    // Initialize button text
    document.getElementById('exportFormat').dispatchEvent(new Event('change'));

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
            if (message.action === 'leadFound') {
                console.log('Lead found:', message.lead);
                
                // Add the new lead to our list
                scrapedLeads.push(message.lead);
                
                // Update the results display
                updateResultsList();
                
                // Update the status with new count
                if (message.totalCount) {
                    updateStatus(`Scraping in progress... Found ${message.totalCount} leads`);
                } else {
                    updateStatus(`Scraping in progress... Found ${scrapedLeads.length} leads`);
                }
                
                // Send response back
                sendResponse({ success: true });
                
            } else if (message.action === 'scrapingComplete') {
                console.log('Scraping completed');
                updateStatus(`Scraping completed! Found ${scrapedLeads.length} leads`);
                
                // Hide stop button and show start button
                document.getElementById('startBtn').style.display = 'inline-flex';
                document.getElementById('stopBtn').style.display = 'none';
                
                // Send response back
                sendResponse({ success: true });
                
            } else if (message.action === 'scrapingStarted') {
                console.log('Scraping started');
                updateStatus('Scraping started...');
                
                // Show stop button and hide start button
                document.getElementById('startBtn').style.display = 'none';
                document.getElementById('stopBtn').style.display = 'inline-flex';
                
                // Send response back
                sendResponse({ success: true });
                
            } else if (message.action === 'scrapingStopped') {
                console.log('Scraping stopped');
                updateStatus(`Scraping stopped. Found ${scrapedLeads.length} leads`);
                
                // Hide stop button and show start button
                document.getElementById('startBtn').style.display = 'inline-flex';
                document.getElementById('stopBtn').style.display = 'none';
                
                // Send response back
                sendResponse({ success: true });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    });

    async function startScraping() {
        try {
            console.log('Starting scraping...');
            
            // Check if content script is available
            const isAvailable = await checkContentScriptAvailable();
            if (!isAvailable) {
                updateStatus('Error: Content script not available. Please refresh the page.');
                return;
            }
            
            // Clear previous results
            scrapedLeads = [];
            updateResultsList();
            
            // Update UI
            updateStatus('Starting scraper...');
            document.getElementById('startBtn').style.display = 'none';
            document.getElementById('stopBtn').style.display = 'inline-flex';
            
            // Send start command to content script
            const response = await sendMessageToContentScript({ action: 'startScraping' });
            
            if (response && response.success) {
                updateStatus('Scraping started...');
                console.log('Scraping started successfully');
            } else {
                updateStatus('Error starting scraper');
                document.getElementById('startBtn').style.display = 'inline-flex';
                document.getElementById('stopBtn').style.display = 'none';
            }
            
        } catch (error) {
            console.error('Error starting scraping:', error);
            updateStatus(`Error: ${error.message}`);
            document.getElementById('startBtn').style.display = 'inline-flex';
            document.getElementById('stopBtn').style.display = 'none';
        }
    }

    async function stopScraping() {
        try {
            console.log('Stopping scraping...');
            
            // Send stop command to content script
            const response = await sendMessageToContentScript({ action: 'stopScraping' });
            
            if (response && response.success) {
                updateStatus(`Scraping stopped. Found ${scrapedLeads.length} leads`);
                console.log('Scraping stopped successfully');
            } else {
                updateStatus('Error stopping scraper');
            }
            
            // Update UI
            document.getElementById('startBtn').style.display = 'inline-flex';
            document.getElementById('stopBtn').style.display = 'none';
            
        } catch (error) {
            console.error('Error stopping scraping:', error);
            updateStatus(`Error: ${error.message}`);
        }
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

    function exportData() {
        if (scrapedLeads.length === 0) {
            alert('No leads to export!');
            return;
        }

        const format = document.getElementById('exportFormat').value;
        
        if (format === 'xls') {
            exportXLS();
        } else {
            exportCSV();
        }
    }

    function exportXLS() {
        if (scrapedLeads.length === 0) {
            alert('No leads to export!');
            return;
        }

        // Create XLS content with proper formatting
        let xlsContent = '';
        
        // Add XLS header
        xlsContent += '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">\n';
        xlsContent += '<head>\n';
        xlsContent += '<meta charset="UTF-8">\n';
        xlsContent += '<style>\n';
        xlsContent += 'table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }\n';
        xlsContent += '.header { background-color: #2c3e50; color: white; font-weight: bold; text-align: center; padding: 15px; font-size: 18px; }\n';
        xlsContent += '.subheader { background-color: #34495e; color: white; font-weight: bold; text-align: center; padding: 10px; font-size: 14px; }\n';
        xlsContent += '.section-header { background-color: #3498db; color: white; font-weight: bold; padding: 8px; font-size: 16px; }\n';
        xlsContent += '.data-header { background-color: #ecf0f1; color: #2c3e50; font-weight: bold; padding: 8px; border: 1px solid #bdc3c7; }\n';
        xlsContent += '.data-cell { padding: 6px; border: 1px solid #bdc3c7; vertical-align: top; }\n';
        xlsContent += '.analysis-header { background-color: #27ae60; color: white; font-weight: bold; padding: 8px; font-size: 14px; }\n';
        xlsContent += '.analysis-cell { padding: 6px; border: 1px solid #bdc3c7; background-color: #f8f9fa; }\n';
        xlsContent += '.footer { background-color: #2c3e50; color: white; text-align: center; padding: 10px; font-size: 12px; }\n';
        xlsContent += '.progress-bar { background-color: #3498db; color: white; text-align: center; font-weight: bold; }\n';
        xlsContent += '.percentage { font-weight: bold; color: #2c3e50; }\n';
        xlsContent += '</style>\n';
        xlsContent += '</head>\n';
        xlsContent += '<body>\n';
        
        // Main header
        xlsContent += '<table>\n';
        xlsContent += '<tr><td colspan="7" class="header">LeadScout Pro - Business Intelligence Report</td></tr>\n';
        xlsContent += '<tr><td colspan="7" class="subheader">Professional Lead Analysis & Market Intelligence</td></tr>\n';
        
        // Report info
        xlsContent += '<tr><td colspan="7" style="padding: 10px; background-color: #f8f9fa; border: 1px solid #e9ecef;">\n';
        xlsContent += '<strong>Generated on:</strong> ' + new Date().toLocaleString() + '<br>\n';
        xlsContent += '<strong>Total Leads Extracted:</strong> ' + scrapedLeads.length + '<br>\n';
        xlsContent += '<strong>Search Target:</strong> Google Maps Business Listings\n';
        xlsContent += '</td></tr>\n';
        
        // Data section header
        xlsContent += '<tr><td colspan="7" class="section-header">Business Information Database</td></tr>\n';
        
        // Data headers
        xlsContent += '<tr>\n';
        xlsContent += '<td class="data-header">Business Name</td>\n';
        xlsContent += '<td class="data-header">Business Type</td>\n';
        xlsContent += '<td class="data-header">Address</td>\n';
        xlsContent += '<td class="data-header">Phone</td>\n';
        xlsContent += '<td class="data-header">Website</td>\n';
        xlsContent += '<td class="data-header">Rating</td>\n';
        xlsContent += '<td class="data-header">Status</td>\n';
        xlsContent += '</tr>\n';
        
        // Data rows
        scrapedLeads.forEach((lead, index) => {
            xlsContent += '<tr>\n';
            xlsContent += '<td class="data-cell">' + (lead.name || 'N/A') + '</td>\n';
            xlsContent += '<td class="data-cell">' + (lead.businessType || 'N/A') + '</td>\n';
            xlsContent += '<td class="data-cell">' + (lead.address || 'N/A') + '</td>\n';
            xlsContent += '<td class="data-cell">' + (lead.phone || 'N/A') + '</td>\n';
            xlsContent += '<td class="data-cell">' + (lead.website || 'N/A') + '</td>\n';
            xlsContent += '<td class="data-cell">' + (lead.rating || 'N/A') + '</td>\n';
            xlsContent += '<td class="data-cell">' + (lead.status || 'N/A') + '</td>\n';
            xlsContent += '</tr>\n';
        });
        
        // Analysis section
        xlsContent += '<tr><td colspan="7" class="analysis-header">Market Intelligence & Analysis Report</td></tr>\n';
        
        // Business type analysis
        const businessTypes = {};
        scrapedLeads.forEach(lead => {
            if (lead.businessType) {
                businessTypes[lead.businessType] = (businessTypes[lead.businessType] || 0) + 1;
            }
        });
        
        xlsContent += '<tr><td colspan="7" class="section-header">Business Type Distribution Analysis</td></tr>\n';
        Object.entries(businessTypes)
            .sort(([,a], [,b]) => b - a)
            .forEach(([type, count]) => {
                const percentage = ((count / scrapedLeads.length) * 100).toFixed(1);
                xlsContent += '<tr>\n';
                xlsContent += '<td class="analysis-cell" colspan="3">' + type + '</td>\n';
                xlsContent += '<td class="analysis-cell">' + count + '</td>\n';
                xlsContent += '<td class="analysis-cell percentage">' + percentage + '%</td>\n';
                xlsContent += '<td class="analysis-cell progress-bar" colspan="2">' + '#'.repeat(Math.round((count / scrapedLeads.length) * 20)) + '</td>\n';
                xlsContent += '</tr>\n';
            });
        
        // Rating analysis
        const ratings = scrapedLeads.filter(lead => lead.rating && lead.rating !== 'N/A');
        if (ratings.length > 0) {
            const avgRating = ratings.reduce((sum, lead) => {
                const rating = parseFloat(lead.rating);
                return isNaN(rating) ? sum : sum + rating;
            }, 0) / ratings.length;
            
            xlsContent += '<tr><td colspan="7" class="section-header">Rating Performance Analysis</td></tr>\n';
            xlsContent += '<tr>\n';
            xlsContent += '<td class="analysis-cell" colspan="3">Average Rating</td>\n';
            xlsContent += '<td class="analysis-cell">' + avgRating.toFixed(1) + '/5.0</td>\n';
            xlsContent += '<td class="analysis-cell" colspan="3">' + '*'.repeat(Math.round(avgRating)) + '</td>\n';
            xlsContent += '</tr>\n';
            xlsContent += '<tr>\n';
            xlsContent += '<td class="analysis-cell" colspan="3">Businesses with Ratings</td>\n';
            xlsContent += '<td class="analysis-cell">' + ratings.length + '/' + scrapedLeads.length + '</td>\n';
            xlsContent += '<td class="analysis-cell percentage" colspan="2">' + ((ratings.length/scrapedLeads.length)*100).toFixed(1) + '%</td>\n';
            xlsContent += '</tr>\n';
        }
        
        // Status analysis
        const openBusinesses = scrapedLeads.filter(lead => 
            lead.status && lead.status.toLowerCase().includes('open')
        ).length;
        const closedBusinesses = scrapedLeads.filter(lead => 
            lead.status && lead.status.toLowerCase().includes('closed')
        ).length;
        
        xlsContent += '<tr><td colspan="7" class="section-header">Business Status Overview</td></tr>\n';
        xlsContent += '<tr>\n';
        xlsContent += '<td class="analysis-cell" colspan="3">Open Businesses</td>\n';
        xlsContent += '<td class="analysis-cell">' + openBusinesses + '</td>\n';
        xlsContent += '<td class="analysis-cell percentage" colspan="2">' + ((openBusinesses/scrapedLeads.length)*100).toFixed(1) + '%</td>\n';
        xlsContent += '</tr>\n';
        xlsContent += '<tr>\n';
        xlsContent += '<td class="analysis-cell" colspan="3">Closed Businesses</td>\n';
        xlsContent += '<td class="analysis-cell">' + closedBusinesses + '</td>\n';
        xlsContent += '<td class="analysis-cell percentage" colspan="2">' + ((closedBusinesses/scrapedLeads.length)*100).toFixed(1) + '%</td>\n';
        xlsContent += '</tr>\n';
        xlsContent += '<tr>\n';
        xlsContent += '<td class="analysis-cell" colspan="3">Status Unknown</td>\n';
        xlsContent += '<td class="analysis-cell">' + (scrapedLeads.length - openBusinesses - closedBusinesses) + '</td>\n';
        xlsContent += '<td class="analysis-cell percentage" colspan="2">' + (((scrapedLeads.length - openBusinesses - closedBusinesses)/scrapedLeads.length)*100).toFixed(1) + '%</td>\n';
        xlsContent += '</tr>\n';
        
        // Contact information analysis
        const withPhone = scrapedLeads.filter(lead => lead.phone && lead.phone !== 'N/A').length;
        const withWebsite = scrapedLeads.filter(lead => lead.website && lead.website !== 'N/A').length;
        
        xlsContent += '<tr><td colspan="7" class="section-header">Contact Information Coverage</td></tr>\n';
        xlsContent += '<tr>\n';
        xlsContent += '<td class="analysis-cell" colspan="3">With Phone Numbers</td>\n';
        xlsContent += '<td class="analysis-cell">' + withPhone + '/' + scrapedLeads.length + '</td>\n';
        xlsContent += '<td class="analysis-cell percentage" colspan="2">' + ((withPhone/scrapedLeads.length)*100).toFixed(1) + '%</td>\n';
        xlsContent += '</tr>\n';
        xlsContent += '<tr>\n';
        xlsContent += '<td class="analysis-cell" colspan="3">With Websites</td>\n';
        xlsContent += '<td class="analysis-cell">' + withWebsite + '/' + scrapedLeads.length + '</td>\n';
        xlsContent += '<td class="analysis-cell percentage" colspan="2">' + ((withWebsite/scrapedLeads.length)*100).toFixed(1) + '%</td>\n';
        xlsContent += '</tr>\n';
        
        // Footer
        xlsContent += '<tr><td colspan="7" class="footer">\n';
        xlsContent += 'Report generated by LeadScout Pro | Developed with love by hashnetics<br>\n';
        xlsContent += 'Open Source • Free for Everyone • Chrome Extension<br>\n';
        xlsContent += 'Support: https://hashnetics.com | GitHub: https://github.com/ShujaGraphy7/LeadScout-Pro\n';
        xlsContent += '</td></tr>\n';
        
        xlsContent += '</table>\n';
        xlsContent += '</body>\n';
        xlsContent += '</html>';
        
        // Create and download file
        const blob = new Blob([xlsContent], { type: 'application/vnd.ms-excel' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `leadscout-pro-leads-${new Date().toISOString().split('T')[0]}.xls`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function exportCSV() {
        if (scrapedLeads.length === 0) {
            alert('No leads to export!');
            return;
        }

        // Create modern branded CSV content
        let csvContent = '';
        
        // Add branding header
        csvContent += '================================================================================\n';
        csvContent += '                    LeadScout Pro - Business Intelligence Report                  \n';
        csvContent += '                              Professional Lead Analysis                          \n';
        csvContent += '================================================================================\n\n';
        csvContent += 'Generated on: ' + new Date().toLocaleString() + '\n';
        csvContent += 'Total Leads Extracted: ' + scrapedLeads.length + '\n';
        csvContent += 'Search Target: Google Maps Business Listings\n';
        csvContent += '================================================================================\n\n';
        
        // Add data headers with modern formatting
        csvContent += 'BUSINESS INFORMATION DATABASE\n';
        csvContent += '--------------------------------------------------------------------------------\n';
        csvContent += 'Name,Type,Address,Phone,Website,Rating,Status\n';
        
        // Add lead data
        scrapedLeads.forEach((lead, index) => {
            const row = [
                lead.name || 'N/A',
                lead.businessType || 'N/A',
                lead.address || 'N/A',
                lead.phone || 'N/A',
                lead.website || 'N/A',
                lead.rating || 'N/A',
                lead.status || 'N/A'
            ].map(field => `"${field}"`).join(',');
            csvContent += row + '\n';
        });
        
        // Add branding analysis report
        csvContent += '\n' + '================================================================================\n';
        csvContent += '                        BRANDING ANALYSIS REPORT                                   \n';
        csvContent += '                              Market Intelligence                                  \n';
        csvContent += '================================================================================\n\n';
        
        // Business type analysis
        const businessTypes = {};
        scrapedLeads.forEach(lead => {
            if (lead.businessType) {
                businessTypes[lead.businessType] = (businessTypes[lead.businessType] || 0) + 1;
            }
        });
        
        csvContent += 'BUSINESS TYPE DISTRIBUTION ANALYSIS\n';
        csvContent += '------------------------------------------------------------------\n';
        Object.entries(businessTypes)
            .sort(([,a], [,b]) => b - a)
            .forEach(([type, count]) => {
                const percentage = ((count / scrapedLeads.length) * 100).toFixed(1);
                const barLength = Math.round((count / scrapedLeads.length) * 20);
                const bar = '#'.repeat(barLength) + '-'.repeat(20 - barLength);
                csvContent += `${type}: ${count} (${percentage}%) ${bar}\n`;
            });
        
        // Rating analysis
        const ratings = scrapedLeads.filter(lead => lead.rating && lead.rating !== 'N/A');
        if (ratings.length > 0) {
            const avgRating = ratings.reduce((sum, lead) => {
                const rating = parseFloat(lead.rating);
                return isNaN(rating) ? sum : sum + rating;
            }, 0) / ratings.length;
            
            csvContent += '\nRATING PERFORMANCE ANALYSIS\n';
            csvContent += '----------------------------------------\n';
            csvContent += `Average Rating: ${avgRating.toFixed(1)}/5.0 (${'*'.repeat(Math.round(avgRating))})\n`;
            csvContent += `Businesses with Ratings: ${ratings.length}/${scrapedLeads.length} (${((ratings.length/scrapedLeads.length)*100).toFixed(1)}%)\n`;
        }
        
        // Status analysis
        const openBusinesses = scrapedLeads.filter(lead => 
            lead.status && lead.status.toLowerCase().includes('open')
        ).length;
        const closedBusinesses = scrapedLeads.filter(lead => 
            lead.status && lead.status.toLowerCase().includes('closed')
        ).length;
        
        csvContent += '\nBUSINESS STATUS OVERVIEW\n';
        csvContent += '-----------------------------------\n';
        csvContent += `Open Businesses: ${openBusinesses} (${((openBusinesses/scrapedLeads.length)*100).toFixed(1)}%)\n`;
        csvContent += `Closed Businesses: ${closedBusinesses} (${((closedBusinesses/scrapedLeads.length)*100).toFixed(1)}%)\n`;
        csvContent += `Status Unknown: ${scrapedLeads.length - openBusinesses - closedBusinesses} (${(((scrapedLeads.length - openBusinesses - closedBusinesses)/scrapedLeads.length)*100).toFixed(1)}%)\n`;
        
        // Contact information analysis
        const withPhone = scrapedLeads.filter(lead => lead.phone && lead.phone !== 'N/A').length;
        const withWebsite = scrapedLeads.filter(lead => lead.website && lead.website !== 'N/A').length;
        
        csvContent += '\nCONTACT INFORMATION COVERAGE\n';
        csvContent += '---------------------------------------------\n';
        csvContent += `With Phone Numbers: ${withPhone}/${scrapedLeads.length} (${((withPhone/scrapedLeads.length)*100).toFixed(1)}%)\n`;
        csvContent += `With Websites: ${withWebsite}/${scrapedLeads.length} (${((withWebsite/scrapedLeads.length)*100).toFixed(1)}%)\n`;
        
        // Footer with branding
        csvContent += '\n' + '================================================================================\n';
        csvContent += '                              REPORT SUMMARY                                        \n';
        csvContent += '================================================================================\n\n';
        csvContent += 'Report generated by LeadScout Pro\n';
        csvContent += 'Developed with love by hashnetics\n';
        csvContent += 'Open Source - Free for Everyone - Chrome Extension\n';
        csvContent += 'Support: https://hashnetics.com\n';
        csvContent += 'Star us on GitHub: https://github.com/ShujaGraphy7/LeadScout-Pro\n';
        csvContent += '\n' + '='.repeat(80) + '\n';
        csvContent += 'Thank you for using LeadScout Pro!\n';
        csvContent += '='.repeat(80) + '\n';
        
        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `leadscout-pro-leads-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
