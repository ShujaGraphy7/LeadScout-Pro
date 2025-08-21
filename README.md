# Google Maps Leads Scraper

A Chrome extension that automatically extracts business information from Google Maps search results using an intelligent click-and-extract approach.

## Features

- **Smart Data Extraction**: Clicks on each business listing to open detailed views and extract comprehensive information
- **Comprehensive Business Data**: Extracts business names, types, addresses, phone numbers, emails, websites, and ratings
- **Automatic Processing**: Processes businesses one by one, automatically opening and closing detailed views
- **Real-time Results**: Shows extracted leads in real-time as they're processed
- **CSV Export**: Export all scraped data to CSV format for further analysis
- **Debug Tools**: Built-in page inspection and debugging tools
- **Settings Management**: Configurable options for data extraction preferences

## How It Works

Unlike traditional scrapers that try to extract data from search result cards, this extension:

1. **Identifies Business Listings**: Finds all business listings on the Google Maps search results page
2. **Clicks Each Listing**: Clicks on each business listing to open its detailed view
3. **Extracts Detailed Information**: Extracts comprehensive business information from the opened detailed view
4. **Closes and Moves On**: Automatically closes the detailed view and moves to the next business
5. **Repeats Process**: Continues until all businesses are processed or the limit is reached

This approach ensures much more accurate and complete data extraction since it accesses the full business details rather than just the summary information visible in search results.

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The extension icon should appear in your Chrome toolbar

## Usage

1. **Navigate to Google Maps**: Go to [Google Maps](https://maps.google.com) and search for businesses
2. **Open Extension**: Click the extension icon in your Chrome toolbar
3. **Configure Settings**: Choose what data to extract (phones, emails, etc.)
4. **Start Scraping**: Click "Start Scraping" to begin the extraction process
5. **Monitor Progress**: Watch as leads are extracted in real-time
6. **Export Results**: Click "Export CSV" to download your data

## Settings

- **Extract Phone Numbers**: Enable/disable phone number extraction
- **Extract Email Addresses**: Enable/disable email address extraction  
- **Auto-scroll**: Automatically scroll to load more search results
- **Debug Mode**: Show detailed debugging information

## Data Extracted

- **Business Name**: The official business name
- **Business Type**: Category or type of business
- **Address**: Full business address
- **Phone Number**: Contact phone number
- **Email Address**: Business email (when available)
- **Website**: Business website URL
- **Rating**: Google rating and review count

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Content Scripts**: Runs on Google Maps pages
- **Background Service Worker**: Handles extension lifecycle and messaging
- **Storage**: Uses Chrome storage API for settings and data persistence
- **Permissions**: Minimal permissions required for functionality

## File Structure

```
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup interface
├── popup.css             # Popup styling
├── popup.js              # Popup functionality
├── content.js            # Main scraping logic
├── background.js         # Background service worker
├── README.md             # This file
└── install.md            # Installation guide
```

## Browser Compatibility

- Chrome 88+ (Manifest V3 support required)
- Edge 88+ (Chromium-based)
- Other Chromium-based browsers

## Privacy & Security

- **No Data Collection**: The extension doesn't collect or transmit any data
- **Local Processing**: All data processing happens locally in your browser
- **Minimal Permissions**: Only requests necessary permissions for functionality
- **Open Source**: Full source code available for review

## Troubleshooting

### Extension Not Working
- Ensure you're on a Google Maps page
- Check that the extension is enabled
- Try refreshing the page and restarting the extension

### No Results Found
- Verify you're on a Google Maps search results page
- Check that there are business listings visible
- Enable debug mode to see what elements are detected

### Performance Issues
- Reduce the maximum results limit
- Disable auto-scroll if not needed
- Close other tabs to free up memory

## Development

To modify or extend the extension:

1. Make your changes to the source code
2. Reload the extension in Chrome
3. Test on Google Maps pages
4. Use the debug tools to troubleshoot

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## License

This project is open source and available under the MIT License.

## Disclaimer

This extension is for educational and legitimate business research purposes only. Please respect Google's terms of service and use responsibly. The developers are not responsible for any misuse of this tool.
