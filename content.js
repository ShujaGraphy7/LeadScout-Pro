class GoogleMapsScraper {
    constructor() {
        this.isScraping = false;
        this.stopScraping = false;
        this.scrapedLeads = [];
        this.maxResults = 100;
        this.currentIndex = 0;
        this.businessListings = [];
        this.scrapedCount = 0;
        
        this.init();
    }

    init() {
        console.log('Google Maps Scraper initialized');
        this.setupMessageListener();
    }

    setupMessageListener() {
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            try {
                if (message.action === 'startScraping') {
                    console.log('Received start scraping command');
                    
                    if (this.isScraping) {
                        console.log('Scraping already in progress');
                        sendResponse({ success: false, message: 'Scraping already in progress' });
                        return;
                    }
                    
                    // Send scraping started message
                    chrome.runtime.sendMessage({ action: 'scrapingStarted' });
                    
                    // Start scraping in background
                    this.scrapeLeads().then(() => {
                        console.log('Scraping completed');
                        chrome.runtime.sendMessage({ action: 'scrapingComplete' });
                    }).catch((error) => {
                        console.error('Scraping error:', error);
                        chrome.runtime.sendMessage({ action: 'scrapingComplete' });
                    });
                    
                    sendResponse({ success: true });
                    
                } else if (message.action === 'stopScraping') {
                    console.log('Received stop scraping command');
                    this.stopScraping();
                    
                    // Send scraping stopped message
                    chrome.runtime.sendMessage({ action: 'scrapingStopped' });
                    
                    sendResponse({ success: true });
                    
                } else if (message.action === 'ping') {
                    console.log('Received ping, responding with pong');
                    sendResponse({ success: true, message: 'pong' });
                    
                } else if (message.action === 'inspectPage') {
                    console.log('Received inspect page command');
                    const inspectionData = this.inspectPage();
                    sendResponse({ success: true, data: inspectionData });
                    
                } else if (message.action === 'getScrapedLeads') {
                    console.log('Received get scraped leads command');
                    sendResponse({ success: true, leads: this.getScrapedLeads() });
                }
                
            } catch (error) {
                console.error('Error handling message:', error);
                sendResponse({ success: false, error: error.message });
            }
        });
    }

    async startScraping(settings) {
        if (this.isScraping) return;
        
        this.isScraping = true;
        this.stopScraping = false;
        this.scrapedLeads = [];
        this.scrapedCount = 0;
        
        console.log('Starting Google Maps scraping with settings:', settings);
        
        try {
            // Wait for page to be ready
            await this.wait(2000);
            
            // Start the scraping process
            await this.scrapeLeads();
            
        } catch (error) {
            console.error('Error in startScraping:', error);
        } finally {
            this.isScraping = false;
            console.log('Scraping finished');
        }
    }

    inspectPage() {
        try {
            const inspectionData = {
                url: window.location.href,
                title: document.title,
                totalListings: this.getVisibleResults().length,
                scrollableContainer: this.findScrollableContainer() ? 'Found' : 'Not found',
                canScroll: this.canScrollFurther(),
                timestamp: new Date().toISOString()
            };
            
            console.log('Page inspection data:', inspectionData);
            return inspectionData;
            
        } catch (error) {
            console.error('Error inspecting page:', error);
            return { error: error.message };
        }
    }

    getScrapedLeads() {
        return this.scrapedLeads;
    }

    findBusinessElements() {
        // Use the exact selectors from the HTML structure provided
        const selectors = [
            '.Nv2PK.tH5CWc.THOPZb', // Main business listing container
            '.Nv2PK.THOPZb.CpccDe', // Alternative business listing container (from Parlour X example)
            '.Nv2PK', // Business listing container
            '.tH5CWc', // Business listing wrapper
            '.THOPZb'  // Business listing content
        ];
        
        let elements = [];
        for (const selector of selectors) {
            const found = document.querySelectorAll(selector);
            if (found.length > 0) {
                elements.push(...Array.from(found));
            }
        }
        
        // Remove duplicates
        elements = [...new Set(elements)];
        return elements;
    }

    findAvailableSelectors() {
        // Use the exact selectors from the HTML structure
        const commonSelectors = [
            '.qBF1Pd', // Business name
            '.MW4etd', // Rating
            '.UY7F9',  // Review count
            '.UsdlK',  // Phone number
            '.lcr4fd', // Website link
            '.W4Efsd'  // Business info container
        ];
        
        const available = commonSelectors.filter(selector => 
            document.querySelector(selector)
        );
        
        return available.length > 0 ? available : ['None of the expected selectors found'];
    }

    analyzePageStructure() {
        const structure = [];
        
        // Check for search box
        const searchBox = document.querySelector('input[placeholder*="Search"]') ||
                         document.querySelector('input[aria-label*="Search"]') ||
                         document.querySelector('.searchBox');
        structure.push(`Search box: ${searchBox ? 'Found' : 'Not found'}`);
        
        // Check for results container
        const resultsContainer = document.querySelector('.Nv2PK') || 
                               document.querySelector('.tH5CWc') ||
                               document.querySelector('.THOPZb');
        structure.push(`Results container: ${resultsContainer ? 'Found' : 'Not found'}`);
        
        // Check for business listings
        const businessListings = this.findBusinessElements();
        structure.push(`Business listings: ${businessListings.length} found`);
        
        // Check for common text elements
        const headings = document.querySelectorAll('h1, h2, h3, h4');
        structure.push(`Headings: ${headings.length} found`);
        
        const links = document.querySelectorAll('a[href]');
        structure.push(`Links: ${links.length} found`);
        
        return structure.join(' | ');
    }

    async waitForMapsToLoad() {
        // Wait for Google Maps to fully load
        const checkMapsLoaded = () => {
            // Look for various Google Maps elements
            const searchBox = document.querySelector('input[placeholder*="Search"]') ||
                             document.querySelector('input[aria-label*="Search"]') ||
                             document.querySelector('.searchBox');
            
            const resultsContainer = document.querySelector('.Nv2PK') || 
                                   document.querySelector('.tH5CWc') ||
                                   document.querySelector('.THOPZb');
            
            if (searchBox || resultsContainer) {
                console.log('Google Maps loaded, scraper ready');
                console.log('Search box found:', !!searchBox);
                console.log('Results container found:', !!resultsContainer);
                return true;
            }
            return false;
        };

        if (!checkMapsLoaded()) {
            await new Promise(resolve => {
                const interval = setInterval(() => {
                    if (checkMapsLoaded()) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 1000);
            });
        }
    }

    stopScraping() {
        this.stopScraping = true;
        this.isScraping = false;
        console.log('Scraping stopped by user');
    }

    getVisibleResults() {
        // Use the exact selector from the HTML structure
        const listings = document.querySelectorAll('.Nv2PK.tH5CWc.THOPZb, .Nv2PK.THOPZb.CpccDe, .Nv2PK, .tH5CWc, .THOPZb');
        
        // Filter to get unique business listings
        const uniqueListings = [];
        const seen = new Set();
        
        for (const listing of listings) {
            // Get the business name to identify unique listings
            const nameElement = listing.querySelector('.qBF1Pd');
            if (nameElement) {
                const name = nameElement.textContent.trim();
                if (name && !seen.has(name)) {
                    seen.add(name);
                    uniqueListings.push(listing);
                }
            }
        }
        
        console.log(`Found ${uniqueListings.length} unique business listings`);
        return uniqueListings;
    }

    async processBusinessListings() {
        for (let i = 0; i < this.businessListings.length && this.isScraping && this.scrapedCount < this.maxResults; i++) {
            this.currentIndex = i;
            const listing = this.businessListings[i];
            
            try {
                console.log(`Processing business ${i + 1}/${this.businessListings.length}`);
                
                // Extract basic info from the listing card first
                const basicInfo = this.extractBasicInfo(listing);
                console.log('Basic info extracted:', basicInfo);
                
                // Click on the listing to open detailed view
                const detailedInfo = await this.clickAndExtractDetails(listing);
                console.log('Detailed info extracted:', detailedInfo);
                
                // Combine basic and detailed info
                const lead = { ...basicInfo, ...detailedInfo };
                
                if (lead.name && this.isValidBusinessName(lead.name)) {
                    this.scrapedCount++;
                    console.log('Extracted lead:', lead);
                    chrome.runtime.sendMessage({ 
                        action: 'leadFound', 
                        lead: lead 
                    });
                }
                
                // Wait before processing next listing
                await this.delay(1000);
                
            } catch (error) {
                console.error(`Error processing business ${i + 1}:`, error);
            }
        }
    }

    extractBasicInfo(listing) {
        const info = {
            name: '',
            businessType: '',
            address: '',
            phone: '',
            email: '',
            website: '',
            rating: '',
            status: '',
            description: '',
            hours: '',
            services: []
        };

        // Extract business name using the exact selector from the HTML structure
        const nameElement = listing.querySelector('.qBF1Pd.fontHeadlineSmall.kiIehc.Hi2drd') || 
                           listing.querySelector('.qBF1Pd') ||
                           listing.querySelector('h1.DUwDvf.lfPIob');
        if (nameElement) {
            info.name = nameElement.textContent.trim();
        }

        // Extract business type - look for the category button or span
        const typeElement = listing.querySelector('button.DkEaL') ||
                           listing.querySelector('.W4Efsd span span') ||
                           listing.querySelector('.W4Efsd button.DkEaL');
        if (typeElement) {
            info.businessType = typeElement.textContent.trim();
        }

        // Extract address - look for the span containing the address (avoiding bullet points and icons)
        const addressElement = listing.querySelector('.W4Efsd span:last-child') || 
                             listing.querySelector('.Io6YTe.fontBodyMedium.kR99db.fdkmkc') ||
                             listing.querySelector('.Io6YTe');
        
        if (addressElement) {
            const addressText = addressElement.textContent.trim();
            // Filter out text that contains bullet points, icons, or is too short
            if (addressText && !addressText.includes('·') && !addressText.includes('') && addressText.length > 5) {
                info.address = addressText;
            }
        }

        // Extract phone number
        const phoneElement = listing.querySelector('.UsdlK');
        if (phoneElement) {
            info.phone = phoneElement.textContent.trim();
        }

        // Extract website
        const websiteElement = listing.querySelector('.lcr4fd') ||
                              listing.querySelector('a[href*="http"] .Io6YTe');
        if (websiteElement) {
            const websiteText = websiteElement.textContent.trim();
            if (websiteText && websiteText.includes('.')) {
                info.website = websiteText;
            }
        }

        // Extract rating and reviews
        const ratingElement = listing.querySelector('.MW4etd') ||
                             listing.querySelector('.fontDisplayLarge');
        const reviewElement = listing.querySelector('.UY7F9') ||
                             listing.querySelector('button.GQjSyb span');
        
        if (ratingElement) {
            const rating = ratingElement.textContent.trim();
            const reviews = reviewElement ? reviewElement.textContent.trim() : '';
            info.rating = reviews ? `${rating} ${reviews}` : rating;
        }

        // Extract business status (Open/Closed)
        const statusElement = listing.querySelector('.W4Efsd span span[style*="color"]') ||
                             listing.querySelector('span[style*="color"]');
        if (statusElement) {
            const statusText = statusElement.textContent.trim();
            if (statusText && (statusText.includes('Open') || statusText.includes('Closed'))) {
                info.status = statusText;
            }
        }

        // Extract business hours
        const hoursElement = listing.querySelector('span[style*="color"] + span') ||
                            listing.querySelector('.MkV9 span span');
        if (hoursElement) {
            const hoursText = hoursElement.textContent.trim();
            if (hoursText && hoursText.includes('Opens') || hoursText.includes('Closes')) {
                info.hours = hoursText;
            }
        }

        // Extract business description (e.g., "Fashionable boutique for women's apparel")
        const descriptionElement = listing.querySelector('.W4Efsd span span');
        if (descriptionElement) {
            const descriptionText = descriptionElement.textContent.trim();
            // Look for longer text that might be a description (not business type or status)
            if (descriptionText && descriptionText.length > 20 && 
                !descriptionText.includes('·') && 
                !descriptionText.includes('Open') && 
                !descriptionText.includes('Closed')) {
                info.description = descriptionText;
            }
        }

        // Extract additional services (e.g., "In-store shopping", "Delivery")
        const serviceElements = listing.querySelectorAll('.TRbhbd + div');
        if (serviceElements.length > 0) {
            serviceElements.forEach(service => {
                const serviceText = service.textContent.trim();
                if (serviceText && serviceText.length > 0) {
                    info.services.push(serviceText);
                }
            });
        }

        return info;
    }

    async clickAndExtractDetails(listing) {
        try {
            // Find the clickable element (usually an anchor tag)
            const clickableElement = listing.querySelector('a.hfpxzc') || 
                                   listing.querySelector('a[href*="/maps/place/"]') ||
                                   listing.querySelector('a[jsaction*="click"]');
            
            if (!clickableElement) {
                console.log('No clickable element found for:', listing);
                return {};
            }

            // Check if we're already viewing this business's details
            const currentBusinessName = this.getCurrentBusinessName();
            const listingBusinessName = this.extractBasicInfo(listing).name;
            
            if (currentBusinessName === listingBusinessName && this.isDetailedPanelOpen()) {
                console.log('Already viewing this business, extracting info directly...');
                const detailedInfo = this.extractFromDetailedPanel();
                return detailedInfo;
            }

            console.log('Clicking on business listing to open detailed panel...');
            
            // Click on the listing to open detailed view
            clickableElement.click();
            
            // Wait for the detailed panel to load
            await this.wait(3000);
            
            // Check if panel opened successfully
            const panel = this.findDetailedPanel();
            if (!panel) {
                console.log('Detailed panel did not open, trying alternative method...');
                // Try alternative click method
                clickableElement.dispatchEvent(new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                }));
                await this.wait(2000);
            }
            
            // Extract information from the detailed panel
            const detailedInfo = this.extractFromDetailedPanel();
            console.log('Extracted detailed info:', detailedInfo);
            
            // Don't close the panel - keep it open for next business
            console.log('Keeping detailed panel open for next business...');
            
            return detailedInfo;
            
        } catch (error) {
            console.error('Error in clickAndExtractDetails:', error);
            return {};
        }
    }

    extractFromDetailedPanel() {
        const info = {
            name: '',
            businessType: '',
            address: '',
            phone: '',
            email: '',
            website: '',
            rating: '',
            status: '',
            description: '',
            hours: '',
            services: []
        };

        // Extract from detailed panel using the new selectors
        const nameElement = document.querySelector('h1.DUwDvf.lfPIob') ||
                           document.querySelector('.qBF1Pd.fontHeadlineSmall.kiIehc.Hi2drd');
        if (nameElement) {
            info.name = nameElement.textContent.trim();
        }

        const typeElement = document.querySelector('button.DkEaL');
        if (typeElement) {
            info.businessType = typeElement.textContent.trim();
        }

        const addressElement = document.querySelector('.Io6YTe.fontBodyMedium.kR99db.fdkmkc');
        if (addressElement) {
            info.address = addressElement.textContent.trim();
        }

        const phoneElement = document.querySelector('button[data-item-id*="phone"] .Io6YTe');
        if (phoneElement) {
            info.phone = phoneElement.textContent.trim();
        }

        const websiteElement = document.querySelector('a[data-item-id="authority"] .Io6YTe');
        if (websiteElement) {
            info.website = websiteElement.textContent.trim();
        }

        const ratingElement = document.querySelector('.fontDisplayLarge');
        const reviewElement = document.querySelector('button.GQjSyb span');
        if (ratingElement) {
            const rating = ratingElement.textContent.trim();
            const reviews = reviewElement ? reviewElement.textContent.trim() : '';
            info.rating = reviews ? `${rating} ${reviews}` : rating;
        }

        const statusElement = document.querySelector('span[style*="color"]');
        if (statusElement) {
            info.status = statusElement.textContent.trim();
        }

        const hoursElement = document.querySelector('span[style*="color"] + span');
        if (hoursElement) {
            info.hours = hoursElement.textContent.trim();
        }

        const serviceElements = document.querySelectorAll('.TRbhbd + div');
        if (serviceElements.length > 0) {
            serviceElements.forEach(service => {
                const serviceText = service.textContent.trim();
                if (serviceText && serviceText.length > 0) {
                    info.services.push(serviceText);
                }
            });
        }

        return info;
    }

    async closeDetailedPanel() {
        try {
            console.log('Closing detailed panel...');
            
            // Try multiple methods to close the panel
            const closeMethods = [
                // Method 1: Look for close button
                () => {
                    const closeButton = document.querySelector('button[aria-label*="Close"]') ||
                                      document.querySelector('button[jsaction*="close"]') ||
                                      document.querySelector('.m6QErb button[aria-label*="Close"]') ||
                                      document.querySelector('button[aria-label*="Back"]');
                    if (closeButton) {
                        closeButton.click();
                        return true;
                    }
                    return false;
                },
                
                // Method 2: Look for back button
                () => {
                    const backButton = document.querySelector('button[aria-label*="Back"]') ||
                                     document.querySelector('button[jsaction*="back"]') ||
                                     document.querySelector('.m6QErb button[aria-label*="Back"]');
                    if (backButton) {
                        backButton.click();
                        return true;
                    }
                    return false;
                },
                
                // Method 3: Press Escape key
                () => {
                    document.dispatchEvent(new KeyboardEvent('keydown', {
                        key: 'Escape',
                        keyCode: 27,
                        which: 27,
                        bubbles: true
                    }));
                    return true;
                },
                
                // Method 4: Click outside the panel
                () => {
                    // Find the main content area and click there
                    const mainContent = document.querySelector('main') ||
                                      document.querySelector('#app-container') ||
                                      document.querySelector('.m6QErb') ||
                                      document.body;
                    if (mainContent) {
                        mainContent.click();
                        return true;
                    }
                    return false;
                }
            ];
            
            // Try each method until one works
            for (const method of closeMethods) {
                if (method()) {
                    console.log('Panel closed successfully');
                    break;
                }
            }
            
            // Wait for panel to close
            await this.wait(1000);
            
            // Verify panel is closed
            if (!this.findDetailedPanel()) {
                console.log('Detailed panel closed successfully');
            } else {
                console.log('Panel may still be open, continuing...');
            }
            
        } catch (error) {
            console.log('Error closing detailed panel:', error);
        }
    }

    async scrapeLeads() {
        if (this.isScraping) {
            console.log('Scraping already in progress');
            return;
        }

        this.isScraping = true;
        this.stopScraping = false;
        this.scrapedLeads = [];
        this.scrapedCount = 0;
        
        console.log('Starting lead scraping...');
        
        try {
            // Wait for Google Maps to fully load
            await this.waitForMapsToLoad();
            
            // Get initial business listings
            this.businessListings = this.getVisibleResults();
            console.log(`Initial listings found: ${this.businessListings.length}`);
            
            // Process all available listings
            let processedCount = 0;
            let totalProcessed = 0;
            
            while (this.isScraping && !this.stopScraping) {
                // Get current listings (this will include newly discovered ones)
                const currentListings = this.getVisibleResults();
                console.log(`Current total listings available: ${currentListings.length}`);
                
                // Process only unprocessed listings
                const unprocessedListings = currentListings.slice(processedCount);
                console.log(`Processing ${unprocessedListings.length} new listings`);
                
                if (unprocessedListings.length === 0) {
                    console.log('No new listings to process, attempting to load more...');
                    if (this.canScrollFurther()) {
                        await this.loadMoreListings();
                        // Wait a bit for new content to load
                        await this.wait(2000);
                        continue; // Continue the loop to process new listings
                    } else {
                        console.log('Cannot scroll further and no new listings, scraping complete');
                        break;
                    }
                }
                
                // Process each unprocessed listing
                for (let i = 0; i < unprocessedListings.length && this.isScraping && !this.stopScraping; i++) {
                    const listing = unprocessedListings[i];
                    const globalIndex = processedCount + i;
                    
                    try {
                        console.log(`Processing business ${globalIndex + 1}/${currentListings.length}: ${listing.textContent?.substring(0, 50)}...`);
                        
                        // Extract basic info from the listing card first
                        const basicInfo = this.extractBasicInfo(listing);
                        console.log('Basic info extracted:', basicInfo);
                        
                        // Click on the listing to open detailed view
                        const detailedInfo = await this.clickAndExtractDetails(listing);
                        console.log('Detailed info extracted:', detailedInfo);
                        
                        // Combine basic and detailed info
                        const lead = { ...basicInfo, ...detailedInfo };
                        
                        if (lead.name && this.isValidBusinessName(lead.name)) {
                            // Check if this lead is already processed
                            const isDuplicate = this.scrapedLeads.some(existing => 
                                existing.name === lead.name && existing.address === lead.address
                            );
                            
                            if (!isDuplicate) {
                                this.scrapedCount++;
                                this.scrapedLeads.push(lead);
                                console.log(`New lead extracted (${this.scrapedCount} total):`, lead.name);
                                
                                // Send message to popup with updated count
                                chrome.runtime.sendMessage({ 
                                    action: 'leadFound', 
                                    lead: lead,
                                    totalCount: this.scrapedCount
                                });
                            } else {
                                console.log(`Duplicate lead skipped: ${lead.name}`);
                            }
                        }
                        
                        // Wait before processing next listing
                        await this.wait(1000);
                        
                    } catch (error) {
                        console.error(`Error processing business ${globalIndex + 1}:`, error);
                    }
                }
                
                // Update processed count
                processedCount = currentListings.length;
                totalProcessed += unprocessedListings.length;
                
                console.log(`Processed ${totalProcessed} total listings, found ${this.scrapedCount} unique leads`);
                
                // Check if we've reached max results
                if (this.maxResults && this.scrapedCount >= this.maxResults) {
                    console.log(`Reached maximum results limit: ${this.maxResults}`);
                    break;
                }
                
                // Try to load more listings if we can scroll further
                if (this.canScrollFurther()) {
                    console.log('Attempting to load more listings...');
                    await this.loadMoreListings();
                    await this.wait(2000); // Wait for new content
                } else {
                    console.log('Cannot scroll further, scraping complete');
                    break;
                }
            }
            
            console.log(`Scraping completed. Total leads found: ${this.scrapedCount}`);
            
        } catch (error) {
            console.error('Error during scraping:', error);
        } finally {
            this.isScraping = false;
            console.log('Scraping stopped');
        }
    }

    cleanBusinessData(data) {
        // Clean and format the extracted data
        const cleaned = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (value && typeof value === 'string') {
                cleaned[key] = value.trim().replace(/\s+/g, ' ');
            } else if (Array.isArray(value)) {
                cleaned[key] = value.filter(item => item && item.trim().length > 0);
            } else {
                cleaned[key] = value;
            }
        }
        
        return cleaned;
    }

    updateProgress(current, total) {
        const progress = Math.round((current / total) * 100);
        console.log(`Progress: ${current}/${total} (${progress}%)`);
        
        // Send progress update to popup
        chrome.runtime.sendMessage({ 
            action: 'updateProgress', 
            current: current, 
            total: total, 
            progress: progress 
        });
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    isOnSearchResultsPage() {
        // Check if we're still on a Google Maps search results page
        const currentUrl = window.location.href;
        const isMapsPage = currentUrl.includes('google.com/maps') || currentUrl.includes('maps.google.com');
        const hasSearchQuery = currentUrl.includes('search') || currentUrl.includes('place');
        
        // Also check for search results elements
        const hasSearchResults = document.querySelector('.Nv2PK.tH5CWc.THOPZb') ||
                                document.querySelector('.Nv2PK.THOPZb.CpccDe') ||
                                document.querySelector('.Nv2PK');
        
        return isMapsPage && hasSearchQuery && hasSearchResults;
    }

    async ensureSearchResultsPage() {
        // If we're not on search results page, try to go back
        if (!this.isOnSearchResultsPage()) {
            console.log('Not on search results page, attempting to go back...');
            
            try {
                // Try browser back button
                window.history.back();
                await this.wait(2000);
                
                // If still not on search results, try to navigate to search
                if (!this.isOnSearchResultsPage()) {
                    console.log('Still not on search results, trying to navigate...');
                    // You might need to implement navigation back to search results
                    return false;
                }
            } catch (error) {
                console.log('Error navigating back:', error);
                return false;
            }
        }
        
        return this.isOnSearchResultsPage();
    }

    findScrollableContainer() {
        // Multiple selectors to find the scrollable container for Google Maps results
        const selectors = [
            '.e07Vkf.kA9KIf[tabindex="-1"]', // Primary scrollable container
            '.aIFcqe', // Alternative container
            '.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde.ecceSd', // Results feed container
            '.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde', // Results container
            '.m6QErb[role="feed"]', // Feed role container
            '.m6QErb.XiKgde.z7i0C', // Results wrapper
            '.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde.ecceSd[tabindex="-1"]' // Tabindex container
        ];
        
        for (const selector of selectors) {
            const container = document.querySelector(selector);
            if (container && container.scrollHeight > container.clientHeight) {
                console.log(`Found scrollable container with selector: ${selector}`);
                return container;
            }
        }
        
        // Fallback: look for any container with scrollable content
        const allContainers = document.querySelectorAll('.m6QErb, .e07Vkf, .aIFcqe');
        for (const container of allContainers) {
            if (container.scrollHeight > container.clientHeight && container.scrollTop !== undefined) {
                console.log('Found scrollable container through fallback search');
                return container;
            }
        }
        
        console.log('No scrollable container found');
        return null;
    }

    canScrollFurther() {
        const container = this.findScrollableContainer();
        if (!container) return false;
        
        const currentScrollTop = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const clientHeight = container.clientHeight;
        
        // Check if we can scroll down further
        return currentScrollTop + clientHeight < scrollHeight - 50;
    }

    async loadMoreListings() {
        try {
            console.log('Attempting to load more listings...');
            
            // Find the specific scrollable container for Google Maps results
            const scrollableContainer = this.findScrollableContainer();
            
            if (!scrollableContainer) {
                console.log('Scrollable container not found');
                return;
            }
            
            console.log('Found scrollable container:', scrollableContainer);
            
            // Get current scroll position
            const currentScrollTop = scrollableContainer.scrollTop;
            const scrollHeight = scrollableContainer.scrollHeight;
            const clientHeight = scrollableContainer.clientHeight;
            
            console.log(`Current scroll: ${currentScrollTop}, Height: ${scrollHeight}, Client: ${clientHeight}`);
            
            // Check if we're near the bottom
            if (currentScrollTop + clientHeight >= scrollHeight - 100) {
                console.log('Already at bottom, no more scrolling needed');
                return;
            }
            
            // Try different scrolling strategies
            const scrollStrategies = [
                // Strategy 1: Scroll by 80% of viewport height
                () => scrollableContainer.scrollTo({
                    top: currentScrollTop + (clientHeight * 0.8),
                    behavior: 'smooth'
                }),
                // Strategy 2: Scroll to specific position
                () => scrollableContainer.scrollTo({
                    top: currentScrollTop + 500,
                    behavior: 'smooth'
                }),
                // Strategy 3: Scroll to bottom
                () => scrollableContainer.scrollTo({
                    top: scrollHeight,
                    behavior: 'smooth'
                })
            ];
            
            let newContentLoaded = false;
            
            for (let i = 0; i < scrollStrategies.length && !newContentLoaded; i++) {
                console.log(`Trying scroll strategy ${i + 1}`);
                
                // Execute scroll strategy
                scrollStrategies[i]();
                
                // Wait for content to load
                await this.wait(3000);
                
                // Check if new content was loaded
                const newScrollHeight = scrollableContainer.scrollHeight;
                if (newScrollHeight > scrollHeight) {
                    console.log(`New content loaded with strategy ${i + 1}! Height increased from ${scrollHeight} to ${newScrollHeight}`);
                    newContentLoaded = true;
                    break;
                } else {
                    console.log(`Strategy ${i + 1} did not load new content`);
                }
            }
            
            if (!newContentLoaded) {
                console.log('No new content loaded after trying all scroll strategies');
            }
            
        } catch (error) {
            console.error('Error in loadMoreListings:', error);
        }
    }

    async safeExtractDetails(listing) {
        try {
            // Extract basic info from the listing first
            const basicInfo = this.extractBasicInfo(listing);
            console.log('Basic info extracted:', basicInfo);
            
            // Now click to open the detailed panel
            const detailedInfo = await this.clickAndExtractDetails(listing);
            console.log('Detailed info extracted:', detailedInfo);
            
            // Combine all information
            const combinedInfo = { ...basicInfo, ...detailedInfo };
            
            return combinedInfo;
            
        } catch (error) {
            console.log('Safe extraction failed:', error);
            return this.extractBasicInfo(listing);
        }
    }

    isDetailedPanelOpen() {
        // Check if the detailed business panel is currently open
        return !!(
            document.querySelector('.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde') ||
            document.querySelector('[role="dialog"]') ||
            document.querySelector('.pane') ||
            document.querySelector('.m6QErb.XiKgde')
        );
    }

    extractAdditionalInfoFromListing(listing) {
        const additional = {};
        
        // Look for more detailed information that might be in the listing
        const allTextElements = listing.querySelectorAll('span, div');
        
        for (const element of allTextElements) {
            const text = element.textContent.trim();
            
            // Look for email patterns
            if (text.includes('@') && text.includes('.') && !additional.email) {
                const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
                if (emailMatch) {
                    additional.email = emailMatch[0];
                }
            }
            
            // Look for business hours
            if ((text.includes('Open') || text.includes('Closed') || text.includes('Opens') || text.includes('Closes')) && !additional.hours) {
                additional.hours = text;
            }
            
            // Look for business description (longer text)
            if (text.length > 30 && !text.includes('·') && !additional.description) {
                additional.description = text;
            }
        }
        
        return additional;
    }

    isValidBusinessName(name) {
        if (!name || name.length < 2) return false;
        
        const invalidPatterns = [
            /^https?:\/\//, // URLs
            /^www\./, // www links
            /^cdn\./, // CDN links
            /^media-cdn\./, // Media CDN
            /^See all$/, // Navigation text
            /^Back to top$/, // Navigation text
            /^Previous$/, // Navigation text
            /^Next$/, // Navigation text
            /^Page$/, // Navigation text
            /^\d+$/, // Just numbers
            /^[^a-zA-Z]*$/, // No letters
            /^[a-zA-Z]{1,2}$/ // Too short
        ];

        return !invalidPatterns.some(pattern => pattern.test(name));
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    findDetailedPanel() {
        // Look for the detailed business panel
        return document.querySelector('.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde') ||
               document.querySelector('[role="dialog"]') ||
               document.querySelector('.pane') ||
               document.querySelector('.m6QErb.XiKgde') ||
               document.querySelector('.m6QErb.Pf6ghf.XiKgde');
    }

    getCurrentBusinessName() {
        // Get the name of the business currently being viewed in the detailed panel
        const nameElement = document.querySelector('h1.DUwDvf.lfPIob') ||
                           document.querySelector('.qBF1Pd.fontHeadlineSmall.kiIehc.Hi2drd') ||
                           document.querySelector('.fontHeadlineSmall');
        
        return nameElement ? nameElement.textContent.trim() : '';
    }

    async forceClosePanel() {
        // Force close the panel using multiple aggressive methods
        try {
            console.log('Force closing panel...');
            
            // Method 1: Multiple escape key presses
            for (let i = 0; i < 3; i++) {
                document.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Escape',
                    keyCode: 27,
                    which: 27,
                    bubbles: true
                }));
                await this.wait(200);
            }
            
            // Method 2: Click multiple areas outside
            const outsideAreas = [
                document.querySelector('main'),
                document.querySelector('#app-container'),
                document.querySelector('.m6QErb'),
                document.body
            ];
            
            for (const area of outsideAreas) {
                if (area) {
                    area.click();
                    await this.wait(200);
                }
            }
            
            // Method 3: Try to navigate back
            if (window.history.length > 1) {
                window.history.back();
                await this.wait(1000);
            }
            
        } catch (error) {
            console.log('Error in force close:', error);
        }
    }
}

// Initialize the scraper
const scraper = new GoogleMapsScraper();
