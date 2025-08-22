class GoogleMapsScraper {
    constructor() {
        this.isScraping = false;
        this.stopScraping = false;
        this.scrapedLeads = [];
        this.maxResults = 10; // Default to 10 leads
        this.currentIndex = 0;
        this.businessListings = [];
        this.scrapedCount = 0;
        
        this.init();
        
    }

    init() {
        this.setupMessageListener();
    }

    setupMessageListener() {
        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            try {
                if (message.action === 'startScraping') {
                    
                    if (this.isScraping) {
                        sendResponse({ success: false, message: 'Scraping already in progress' });
                        return true;
                    }
                    
                    // Get settings including max leads
                    const settings = message.settings || {};
                    this.maxResults = settings.maxLeads || 10;
                    
                    // Send scraping started message
                    chrome.runtime.sendMessage({ action: 'scrapingStarted' });
                    
                    // Start scraping in background
                    this.scrapeLeads().then(() => {
                        chrome.runtime.sendMessage({ action: 'scrapingComplete' });
                    }).catch((error) => {
                        console.error('Scraping error:', error);
                        chrome.runtime.sendMessage({ action: 'scrapingComplete' });
                    });
                    
                    sendResponse({ success: true });
                    return true;
                    
                } else if (message.action === 'stopScraping') {
                    this.stopScraping();
                    
                    // Send scraping stopped message
                    chrome.runtime.sendMessage({ action: 'scrapingStopped' });
                    
                    sendResponse({ success: true });
                    return true;
                    
                } else if (message.action === 'ping') {
                    sendResponse({ success: true, message: 'pong' });
                    return true;
                    
                } else if (message.action === 'inspectPage') {
                    const inspectionData = this.inspectPage();
                    sendResponse({ success: true, data: inspectionData });
                    return true;
                    
                } else if (message.action === 'getScrapedLeads') {
                    sendResponse({ success: true, leads: this.getScrapedLeads() });
                    return true;
                }
                
            } catch (error) {
                console.error('Error handling message:', error);
                sendResponse({ success: false, error: error.message });
                return true;
            }
        });
    }

    async startScraping(settings) {
        if (this.isScraping) return;
        
        this.isScraping = true;
        this.stopScraping = false;
        this.scrapedLeads = [];
        this.scrapedCount = 0;
        
        try {
            // Wait for page to be ready
            await this.wait(2000);
            
            // Start the scraping process
            await this.scrapeLeads();
            
        } catch (error) {
            console.error('Error in startScraping:', error);
        } finally {
            this.isScraping = false;
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
                pageStructure: this.analyzePageStructure(),
                availableSelectors: this.findAvailableSelectors(),
                timestamp: new Date().toISOString()
            };
            
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
            
            // Look for the results container and business listings
            const resultsContainer = document.querySelector('.Nv2PK.THOPZb.CpccDe') || 
                                   document.querySelector('.Nv2PK.tH5CWc.THOPZb') ||
                                   document.querySelector('.Nv2PK');
            
            // Look for the "Results" header
            const resultsHeader = document.querySelector('.fontTitleLarge.IFMGgb');
            
            if (searchBox || resultsContainer || resultsHeader) {
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
    }

    getVisibleResults() {
        
        // Use the exact selectors from the actual Google Maps HTML structure
        // Look for the main business listing containers
        const listings = document.querySelectorAll('.Nv2PK.THOPZb.CpccDe, .Nv2PK.tH5CWc.THOPZb');
        
        // Filter to get unique business listings
        const uniqueListings = [];
        const seen = new Set();
        
        for (const listing of listings) {
            // Get the business name using the exact selector from the HTML
            const nameElement = listing.querySelector('.qBF1Pd.fontHeadlineSmall.kiIehc.Hi2drd') || 
                               listing.querySelector('.qBF1Pd');
            if (nameElement) {
                const name = nameElement.textContent.trim();
                if (name && !seen.has(name)) {
                    seen.add(name);
                    uniqueListings.push(listing);
                }
            }
        }
        
        return uniqueListings;
    }

    async processBusinessListings() {
        for (let i = 0; i < this.businessListings.length && this.isScraping && this.scrapedCount < this.maxResults; i++) {
            this.currentIndex = i;
            const listing = this.businessListings[i];
            
            try {
                
                // Extract basic info from the listing card first
                const basicInfo = this.extractBasicInfo(listing);
                
                // Click on the listing to open detailed view
                const detailedInfo = await this.clickAndExtractDetails(listing);
                
                // Combine basic and detailed info
                const lead = { ...basicInfo, ...detailedInfo };
                
                if (lead.name && this.isValidBusinessName(lead.name)) {
                    this.scrapedCount++;
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
                           listing.querySelector('.qBF1Pd');
        if (nameElement) {
            info.name = nameElement.textContent.trim();
        }

        // Extract business type - look for the first span in W4Efsd (category)
        const typeElement = listing.querySelector('.W4Efsd span:first-child span') ||
                           listing.querySelector('.W4Efsd span span:first-child');
        if (typeElement) {
            info.businessType = typeElement.textContent.trim();
        }

        // Extract address - look for the address span (usually the second or third span in W4Efsd)
        const addressElements = listing.querySelectorAll('.W4Efsd span');
        for (let i = 0; i < addressElements.length; i++) {
            const addressText = addressElements[i].textContent.trim();
            // Look for text that looks like an address (contains road names, locations, etc.)
            if (addressText && 
                addressText.length > 10 && 
                !addressText.includes('·') && 
                !addressText.includes('Open') && 
                !addressText.includes('Closed') &&
                !addressText.includes('stars') &&
                !addressText.includes('Reviews') &&
                !addressText.includes('$$') &&
                !addressText.includes('$')) {
                info.address = addressText;
                break;
            }
        }

        // Extract rating
        const ratingElement = listing.querySelector('.MW4etd');
        if (ratingElement) {
            info.rating = ratingElement.textContent.trim();
        }

        // Extract status (open/closed) - look for colored text
        const statusElement = listing.querySelector('.W4Efsd span span[style*="color"]');
        if (statusElement) {
            info.status = statusElement.textContent.trim();
        }

        // Extract hours - look for text containing "Closes" or "Opens"
        const hoursElements = listing.querySelectorAll('.W4Efsd span');
        for (let i = 0; i < hoursElements.length; i++) {
            const hoursText = hoursElements[i].textContent.trim();
            if (hoursText && (hoursText.includes('Closes') || hoursText.includes('Opens'))) {
                info.hours = hoursText;
                break;
            }
        }

        // Extract price range ($$)
        const priceElement = listing.querySelector('.W4Efsd span[aria-label*="priced"]');
        if (priceElement) {
            const priceText = priceElement.getAttribute('aria-label');
            if (priceText) {
                info.priceRange = priceText.replace('Moderately priced', '$$').replace('Inexpensive', '$').replace('Expensive', '$$$');
            }
        }

        return this.cleanBusinessData(info);
    }

    async clickAndExtractDetails(listing) {
        try {
            // Find the clickable element (usually an anchor tag)
            const clickableElement = listing.querySelector('a.hfpxzc') || 
                                   listing.querySelector('a[href*="/maps/place/"]') ||
                                   listing.querySelector('a[jsaction*="click"]');
            
            if (!clickableElement) {
                return {};
            }

            // Check if we're already viewing this business's details
            const currentBusinessName = this.getCurrentBusinessName();
            const listingBusinessName = this.extractBasicInfo(listing).name;
            
            if (currentBusinessName === listingBusinessName && this.isDetailedPanelOpen()) {
                const detailedInfo = this.extractFromDetailedPanel();
                return detailedInfo;
            }

            // Click on the listing to open detailed view
            clickableElement.click();
            
            // Wait for the detailed panel to load
            await this.wait(3000);
            
            // Check if panel opened successfully
            const panel = this.findDetailedPanel();
            if (!panel) {
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
            
            // Don't close the panel - keep it open for next business
            
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
                    break;
                }
            }
            
            // Wait for panel to close
            await this.wait(1000);
            
            // Verify panel is closed
            if (!this.findDetailedPanel()) {
            } else {
            }
            
        } catch (error) {
        }
    }

    async scrapeLeads() {
        if (this.isScraping) {
            return;
        }

        this.isScraping = true;
        this.stopScraping = false;
        this.scrapedLeads = [];
        this.scrapedCount = 0;
        
        try {
            // Wait for Google Maps to fully load
            await this.waitForMapsToLoad();
            
            // Check if we're on the right page
            if (!this.isOnSearchResultsPage()) {
                return;
            }
            
            // Get initial business listings
            this.businessListings = this.getVisibleResults();
            
            if (this.businessListings.length === 0) {
                return;
            }
            
            // Process all available listings
            let processedCount = 0;
            let totalProcessed = 0;
            
            while (this.isScraping && !this.stopScraping) {
                // Get current listings (this will include newly discovered ones)
                const currentListings = this.getVisibleResults();
                
                // Process only unprocessed listings
                const unprocessedListings = currentListings.slice(processedCount);
                
                if (unprocessedListings.length === 0) {
                    if (this.canScrollFurther()) {
                        await this.loadMoreListings();
                        // Wait a bit for new content to load
                        await this.wait(2000);
                        continue; // Continue the loop to process new listings
                    } else {
                        break;
                    }
                }
                
                // Process each unprocessed listing
                for (let i = 0; i < unprocessedListings.length && this.isScraping && !this.stopScraping; i++) {
                    const listing = unprocessedListings[i];
                    const globalIndex = processedCount + i;
                    
                    try {
                        
                        // Extract basic info from the listing card first
                        const basicInfo = this.extractBasicInfo(listing);
                        
                        // Click on the listing to open detailed view
                        const detailedInfo = await this.clickAndExtractDetails(listing);
                        
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
                                
                                // Send message to popup with updated count
                                try {
                                    chrome.runtime.sendMessage({ 
                                        action: 'leadFound', 
                                        lead: lead,
                                        totalCount: this.scrapedCount
                                    }, (response) => {
                                        if (chrome.runtime.lastError) {
                                            console.error('Error sending message:', chrome.runtime.lastError);
                                        } else {
                                        }
                                    });
                                } catch (error) {
                                    console.error('Error sending leadFound message:', error);
                                }
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
                
                // Check if we've reached max results
                if (this.maxResults && this.scrapedCount >= this.maxResults) {
                    break;
                }
                
                // Try to load more listings if we can scroll further
                if (this.canScrollFurther()) {
                    await this.loadMoreListings();
                    await this.wait(2000); // Wait for new content
                } else {
                    break;
                }
            }
            
        } catch (error) {
            console.error('Error during scraping:', error);
        } finally {
            this.isScraping = false;
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
        const hasResultsHeader = !!document.querySelector('.fontTitleLarge.IFMGgb');
        const hasBusinessListings = !!document.querySelector('.Nv2PK.THOPZb.CpccDe, .Nv2PK.tH5CWc.THOPZb, .Nv2PK');
        
        return isMapsPage && (hasSearchQuery || hasResultsHeader || hasBusinessListings);
    }

    async ensureSearchResultsPage() {
        if (!this.isOnSearchResultsPage()) {
            return false;
        }
        return true;
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
                return container;
            }
        }
        
        // Fallback: look for any container with scrollable content
        const allContainers = document.querySelectorAll('.m6QErb, .e07Vkf, .aIFcqe');
        for (const container of allContainers) {
            if (container.scrollHeight > container.clientHeight && container.scrollTop !== undefined) {
                return container;
            }
        }
        
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
            
            // Find the specific scrollable container for Google Maps results
            const scrollableContainer = this.findScrollableContainer();
            
            if (!scrollableContainer) {
                return;
            }
            
            // Get current scroll position
            const currentScrollTop = scrollableContainer.scrollTop;
            const scrollHeight = scrollableContainer.scrollHeight;
            const clientHeight = scrollableContainer.clientHeight;
            
            // Check if we're near the bottom
            if (currentScrollTop + clientHeight >= scrollHeight - 100) {
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
                
                // Execute scroll strategy
                scrollStrategies[i]();
                
                // Wait for content to load
                await this.wait(3000);
                
                // Check if new content was loaded
                const newScrollHeight = scrollableContainer.scrollHeight;
                if (newScrollHeight > scrollHeight) {
                    newContentLoaded = true;
                    break;
                } else {
                }
            }
            
            if (!newContentLoaded) {
            }
            
        } catch (error) {
            console.error('Error in loadMoreListings:', error);
        }
    }

    async safeExtractDetails(listing) {
        try {
            // Extract basic info from the listing first
            const basicInfo = this.extractBasicInfo(listing);
            
            // Now click to open the detailed panel
            const detailedInfo = await this.clickAndExtractDetails(listing);
            
            // Combine all information
            const combinedInfo = { ...basicInfo, ...detailedInfo };
            
            return combinedInfo;
            
        } catch (error) {
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
        }
    }
}

// Initialize the scraper
const scraper = new GoogleMapsScraper();
