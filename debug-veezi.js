const { chromium } = require('playwright');

async function scrapeVeeziSessions() {
    console.log('🔍 Scraping Veezi for session data...');
    try {
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        
        const veeziUrl = 'https://ticketing.oz.veezi.com/sessions/?siteToken=wpge11hbvd3zadj20jkc0y36ym';
        await page.goto(veeziUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // Extract sessions by navigating the DOM structure
        // Films are in sections, times are in <ul> lists within each film section
        const sessionsData = await page.evaluate(() => {
            const sessions = [];
            
            // Find all film headers (h3 elements with film titles)
            const filmHeaders = document.querySelectorAll('h3.film-title, h3.film-header, .film-header h3, [class*="film-header"] h3');
            
            // Alternative approach: Find sections that contain both film name and session times
            // Look for the pattern: heading with film name, followed by a ul with session links
            
            // Get all h3, h4 elements that contain film names
            const allHeadings = document.querySelectorAll('h2, h3, h4');
            
            let currentFilm = null;
            let currentFilmElement = null;
            
            // The structure: Each film has a header, then a list of sessions
            // Let's walk through the DOM
            
            // Try to find the film list container
            const filmList = document.querySelector('#sessionsByFilmConent, .film-list, [id*="Film"]');
            
            if (filmList) {
                // Get all direct children that are film entries
                const filmEntries = filmList.querySelectorAll(':scope > *');
                
                filmEntries.forEach(entry => {
                    // Look for film title in this entry
                    const titleEl = entry.querySelector('h2, h3, h4');
                    if (titleEl) {
                        const title = titleEl.textContent.trim();
                        
                        // Skip date headers (e.g., "Friday 27, March")
                        if (!title.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/)) {
                            // This is a film title
                            const sessionLinks = entry.querySelectorAll('a[href*="/purchase/"]');
                            const times = [];
                            const urls = [];
                            
                            sessionLinks.forEach(link => {
                                const timeText = link.textContent.trim();
                                const url = link.href;
                                if (timeText && url && /(\d{1,2}:\d{2}|\d{1,2}\s*(AM|PM))/i.test(timeText)) {
                                    times.push(timeText);
                                    urls.push(url);
                                }
                            });
                            
                            if (title && times.length > 0) {
                                sessions.push({
                                    title: title,
                                    times: times,
                                    urls: urls
                                });
                            }
                        }
                    }
                });
            }
            
            // Fallback: Use simpler approach - look for all links that look like session times
            if (sessions.length === 0) {
                const allLinks = document.querySelectorAll('a[href*="/purchase/"]');
                const seenFilms = new Set();
                
                allLinks.forEach(link => {
                    const timeText = link.textContent.trim();
                    const url = link.href;
                    
                    if (timeText && url && /(\d{1,2}:\d{2}|\d{1,2}\s*(AM|PM))/i.test(timeText)) {
                        // Find the parent film section to get the film name
                        let parent = link.parentElement;
                        let filmName = '';
                        
                        // Walk up the DOM to find the film header
                        for (let i = 0; i < 10 && parent; i++) {
                            const heading = parent.querySelector('h2, h3, h4');
                            if (heading) {
                                const text = heading.textContent.trim();
                                // Skip date headers
                                if (!text.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/)) {
                                    filmName = text;
                                    break;
                                }
                            }
                            parent = parent.parentElement;
                        }
                        
                        if (filmName && !seenFilms.has(filmName)) {
                            seenFilms.add(filmName);
                            sessions.push({
                                title: filmName,
                                times: [timeText],
                                urls: [url]
                            });
                        } else if (filmName) {
                            // Add to existing film
                            const existing = sessions.find(s => s.title === filmName);
                            if (existing) {
                                existing.times.push(timeText);
                                existing.urls.push(url);
                            }
                        }
                    }
                });
            }
            
            return sessions;
        });
        
        console.log(`   Found ${sessionsData.length} films with sessions from Veezi`);
        sessionsData.forEach(s => console.log(`   - ${s.title}: ${s.times.length} sessions`));
        
        await browser.close();
        
        return sessionsData;
    } catch (e) {
        console.log('   Veezi scrape error:', e.message);
        return [];
    }
}

scrapeVeeziSessions().then(sessions => {
    console.log('\n=== FINAL SESSIONS ===');
    console.log(JSON.stringify(sessions, null, 2));
}).catch(console.error);