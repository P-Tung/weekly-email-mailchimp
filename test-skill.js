const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const MC_API_KEY = process.env.MATON_API_KEY || fs.readFileSync('./.env.local', 'utf-8').match(/MATON_API_KEY=(.+)/)?.[1];
const MC_BASE_URL = 'https://gateway.maton.ai/mailchimp/3.0';
const WORKSPACE_DIR = process.cwd();
const FALLBACK_IMAGE = 'https://mcusercontent.com/983aaba19411e46e8ff025752/images/492a95d6-c361-ee10-b412-3d0fcb753d18.jpg';

async function getMXfilmCredentials() {
    const possiblePaths = [
        '/home/ubuntu/.openclaw/workspace/.mx_api_credentials',
        path.join(WORKSPACE_DIR, '.env.local'),
        path.join(process.env.HOME || process.env.USERPROFILE, '.mx_credentials'),
    ];
    for (const credsPath of possiblePaths) {
        if (fs.existsSync(credsPath)) {
            const content = fs.readFileSync(credsPath, 'utf-8');
            const username = content.match(/MX_USERNAME=(.+)/)?.[1];
            const password = content.match(/MX_PASSWORD=(.+)/)?.[1];
            if (username && password) {
                console.log('✅ Loaded MX credentials from:', credsPath);
                return { username, password };
            }
        }
    }
    console.log('⚠️ No MX credentials found');
    return null;
}

let mxTokenCache = null;
async function getMXfilmToken() {
    if (mxTokenCache) return mxTokenCache;
    const creds = await getMXfilmCredentials();
    if (!creds) return null;
    try {
        const res = await fetch('https://film.moviexchange.com/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'password', client_id: 'MovieXchangeApi', ...creds })
        });
        const data = await res.json();
        mxTokenCache = data.access_token || null;
        return mxTokenCache;
    } catch(e) { console.log('MX token error:', e.message); return null; }
}

async function getMXfilmFilms() {
    const token = await getMXfilmToken();
    if (!token) return [];
    try {
        const res = await fetch('https://film.moviexchange.com/api/v2/releases', {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        const releases = await res.json();
        return releases || [];
    } catch(e) { console.log('MX releases error:', e.message); return []; }
}

async function getMXfilmSessions() {
    const token = await getMXfilmToken();
    if (!token) return [];
    try {
        const res = await fetch('https://film.moviexchange.com/api/v2/sessions', {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });
        const text = await res.text();
        // Handle empty or invalid responses
        if (!text || text.trim() === '') return [];
        const sessions = JSON.parse(text);
        return sessions || [];
    } catch(e) { 
        console.log('MX sessions error:', e.message); 
        return []; 
    }
}

async function getMXfilmTrailer(title) {
    const films = await getMXfilmFilms();
    const film = films.find(f => f.title?.toLowerCase().includes(title.toLowerCase()) || title.toLowerCase().includes(f.title?.toLowerCase()));
    return film?.trailerUrl || null;
}

async function getMXfilmPoster(title) {
    const films = await getMXfilmFilms();
    const film = films.find(f => f.title?.toLowerCase().includes(title.toLowerCase()) || title.toLowerCase().includes(f.title?.toLowerCase()));
    return film?.posterImageUrl || film?.posterUrl || null;
}

// TMDB for higher resolution posters/banners (uses original resolution for portraits)
async function getTMDBImage(title, type = 'poster') {
    console.log(`   🔍 Searching TMDB for ${type}: ${title}`);
    try {
        const res = await fetch(`https://www.themoviedb.org/search?query=${encodeURIComponent(title)}`, { headers: { "User-Agent": "Mozilla/5.0" } });
        const html = await res.text();
        
        // Find movie link
        const match = html.match(/href="(\/movie\/\d+[^"]*)"/);
        if (!match) {
            console.log(`   ⚠️ No TMDB match found`);
            return null;
        }
        
        // Use Playwright to get the movie page (JS-rendered poster)
        const { chromium } = require('playwright');
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        
        await page.goto(`https://www.themoviedb.org${match[1]}`, { 
            waitUntil: 'domcontentloaded', timeout: 20000 
        });
        await page.waitForTimeout(2000);
        
        if (type === 'poster') {
            // Extract poster image from the page - use original resolution
            const posterUrl = await page.evaluate(() => {
                const poster = document.querySelector('.poster img');
                if (!poster) return null;
                
                let src = poster.getAttribute('src') || poster.getAttribute('data-src');
                if (!src) return null;
                
                // Extract image ID from path
                const idMatch = src.match(/\/([^\/]+)\.jpg$/);
                if (!idMatch) return null;
                
                const imageId = idMatch[1];
                // Use image.tmdb.org for original resolution
                return `https://image.tmdb.org/t/p/original/${imageId}.jpg`;
            });
            
            await browser.close();
            
            if (posterUrl) {
                console.log(`   ✅ Found TMDB poster (original resolution)`);
                return posterUrl;
            }
        } else {
            // For banners - extract from CSS background-image
            const bannerUrl = await page.evaluate(() => {
                const header = document.querySelector('div.header');
                if (!header) return null;
                const style = window.getComputedStyle(header);
                const bg = style.backgroundImage;
                if (bg && bg !== 'none') {
                    const match = bg.match(/url\(['"]?([^'")]+)['"]?\)/);
                    if (match && match[1]) {
                        // Upgrade to higher res: w780 -> original
                        return match[1].replace(/\/w\d+\//, '/original/');
                    }
                }
                return null;
            });
            
            await browser.close();
            
            if (bannerUrl) {
                console.log(`   ✅ Found TMDB banner (original resolution)`);
                return bannerUrl;
            }
        }
        
    } catch(e) {
        console.log(`   ⚠️ TMDB error: ${e.message}`);
    }
    return null;
}

async function getDeluxeTrailer(title) {
    console.log('🔍 Searching Deluxe for trailer:', title);
    try {
        let filmUrl = null;
        const res = await fetch('https://www.deluxecinemas.co.nz/', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();
        const $ = cheerio.load(html);
        let filmLink = $(`a:contains("${title}")`).first();
        if (!filmLink.length) {
            const allLinks = $('a[href*="/movie/"]');
            allLinks.each((i, el) => {
                const linkText = $(el).text().toLowerCase();
                const titleLower = title.toLowerCase();
                if (linkText.includes(titleLower) || titleLower.includes(linkText)) {
                    filmLink = $(el);
                    return false;
                }
            });
        }
        if (filmLink && filmLink.length) {
            const href = filmLink.attr('href');
            if (href) filmUrl = href.startsWith('http') ? href : `https://www.deluxecinemas.co.nz${href}`;
        }
        if (!filmUrl) {
            const slug = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
            filmUrl = `https://www.deluxecinemas.co.nz/movie/${slug}`;
        }
        console.log('🔍 Fetching:', filmUrl);
        const filmRes = await fetch(filmUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!filmRes.ok) return null;
        const filmHtml = await filmRes.text();
        const $f = cheerio.load(filmHtml);
        const trailerBtn = $f('.trailer__trigger, button.trailer-trigger, [data-trailer], [data-video-url]').first();
        if (trailerBtn.length) {
            const dataTrailer = trailerBtn.attr('data-trailer') || trailerBtn.attr('data-video-url') || trailerBtn.attr('data-video') || trailerBtn.attr('data-src');
            if (dataTrailer && (dataTrailer.includes('youtube') || dataTrailer.includes('youtu.be') || dataTrailer.includes('embed'))) {
                console.log('✅ Found YouTube in data attribute');
                if (dataTrailer.includes('embed')) {
                    const videoId = dataTrailer.split('embed/')[1]?.split('?')[0];
                    return `https://www.youtube.com/watch?v=${videoId}`;
                }
                return dataTrailer.startsWith('http') ? dataTrailer : `https://www.youtube.com${dataTrailer}`;
            }
        }
        const allElements = $f('*');
        for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i];
            const attrs = $f(el).attr();
            for (const [key, val] of Object.entries(attrs)) {
                if (val && (val.includes('youtube.com') || val.includes('youtu.be') || val.includes('/embed/'))) {
                    console.log('✅ Found YouTube in attribute');
                    if (val.includes('/embed/')) {
                        const videoId = val.split('/embed/')[1]?.split('?')[0];
                        return `https://www.youtube.com/watch?v=${videoId}`;
                    }
                    return val.startsWith('http') ? val : `https://www.youtube.com${val}`;
                }
            }
        }
        const youtubeEmbed = $f('iframe[src*="youtube"], iframe[src*="youtu.be"]').first();
        if (youtubeEmbed.length) {
            const src = youtubeEmbed.attr('src');
            if (src && src.includes('embed/')) {
                const videoId = src.split('embed/')[1]?.split('?')[0];
                return `https://www.youtube.com/watch?v=${videoId}`;
            }
        }
        
        // If basic fetch didn't find it, use Playwright to scrape the dynamic page
        console.log('🔍 Using Playwright to scrape Deluxe page...');
        return await getDeluxeTrailerWithPlaywright(title);
    } catch(e) { console.log('Error:', e.message); return null; }
}

async function getDeluxeTrailerWithPlaywright(title) {
    try {
        const { chromium } = require('playwright');
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        
        const slug = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
        const filmUrl = `https://www.deluxecinemas.co.nz/movie/${slug}`;
        
        await page.goto(filmUrl, { waitUntil: 'networkidle', timeout: 15000 });
        
        // Get HTML after JS has loaded
        const html = await page.content();
        
        // Search for YouTube embed URLs
        const embedMatch = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
        if (embedMatch && embedMatch[1]) {
            console.log('✅ Found YouTube via Playwright');
            await browser.close();
            return `https://www.youtube.com/watch?v=${embedMatch[1]}`;
        }
        
        await browser.close();
        return null;
    } catch(e) {
        console.log('Playwright error:', e.message);
        return null;
    }
}

async function getTMDBBannerWithPlaywright(moviePath) {
    try {
        const { chromium } = require('playwright');
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        
        const url = `https://www.themoviedb.org${moviePath}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2000); // Give time for images to load
        
        // Get the computed style for background-image - use original resolution
        const bannerUrl = await page.evaluate(() => {
            const header = document.querySelector('div.header');
            if (!header) return null;
            const style = window.getComputedStyle(header);
            const bg = style.backgroundImage;
            if (bg && bg !== 'none') {
                // Extract URL from url('...')
                const match = bg.match(/url\(['"]?([^'")]+)['"]?\)/);
                if (match && match[1]) {
                    // Upgrade to original resolution (not w1280)
                    return match[1].replace(/\/w\d+\//, '/original/');
                }
            }
            return null;
        });
        
        await browser.close();
        return bannerUrl;
    } catch(e) {
        console.log('TMDB Playwright error:', e.message);
        return null;
    }
}

// Veezi Sessions Scraper using Playwright
async function scrapeVeeziSessions() {
    console.log('🔍 Scraping Veezi for session data...');
    try {
        const { chromium } = require('playwright');
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        
        const veeziUrl = 'https://ticketing.oz.veezi.com/sessions/?siteToken=wpge11hbvd3zadj20jkc0y36ym';
        await page.goto(veeziUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        // Extract sessions by finding film headers and their session links
        const sessionsData = await page.evaluate(() => {
            const sessions = [];
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
const payload = {
    dates: 'March 26 – April 29',
    featured_films: ['I Swear', 'Midwinter Break'],
    now_showing: ['Project Hail Mary', 'Tenor: My Name is Pati', 'The Devil Wears Prada 2', 'The North', 'The Time Traveller Guide to Hamilton Gardens'],
    test_email: null
};

(async () => {
    console.log('=== BUILD CINEMA EMAIL TEST ===');
    console.log('Dates:', payload.dates);
    console.log('Featured:', payload.featured_films);
    console.log('Now Showing:', payload.now_showing);
    
    // Fetch metadata from MXfilm
    console.log('\n--- STEP 1: Fetching Film Metadata ---');
    const allFilms = await getMXfilmFilms();
    let metadata = {};
    if (allFilms.length > 0) {
        console.log('✅ MXfilm connected, fetched', allFilms.length, 'releases');
        for (const f of allFilms) {
            let rating = 'TBC';
            if (f.rating) {
                if (typeof f.rating === 'string') {
                    rating = f.rating;
                } else if (typeof f.rating === 'object') {
                    rating = f.rating.classification || f.rating.name || f.rating.label || 'TBC';
                }
            } else if (f.ageClassification) {
                if (typeof f.ageClassification === 'string') {
                    rating = f.ageClassification;
                } else if (f.ageClassification && typeof f.ageClassification === 'object') {
                    rating = f.ageClassification.name || f.ageClassification.label || 'TBC';
                }
            }
            if (f.title) metadata[f.title] = { 
                title: f.title, 
                rating: rating, 
                synopsis: f.synopsis || f.description || f.title, 
                posterUrl: f.posterImageUrl 
            };
        }
        console.log('   Processed', Object.keys(metadata).length, 'films');
    }
    
    // Fetch sessions - try Veezi scraper since MXfilm sessions returns empty
    console.log('\n--- STEP 2: Fetching Sessions ---');
    let sessions = [];
    
    // First try the MXfilm API (may return empty)
    const allSessions = await getMXfilmSessions();
    if (allSessions && allSessions.length > 0) {
        sessions = allSessions.map(s => ({ 
            name: s.filmTitle || s.filmName, 
            startDate: s.startTime || s.sessionTime, 
            url: s.bookingUrl || s.ticketUrl 
        })).filter(s => s.name && s.url);
        console.log('   Found', sessions.length, 'sessions from MXfilm API');
    } 
    
    // If no sessions from MXfilm, try Veezi scraper
    if (sessions.length === 0) {
        console.log('   MXfilm sessions empty, trying Veezi scraper...');
        const veeziSessions = await scrapeVeeziSessions();
        // Keep Veezi format: { title, times: [], urls: [] }
        if (veeziSessions.length > 0) {
            sessions = veeziSessions;
            console.log('   Found', sessions.length, 'films with sessions from Veezi');
        }
    }
    
    if (sessions.length === 0) {
        console.log('   No sessions data available');
    }
    
    console.log('\n--- STEP 3: Loading Template ---');
    const templatePath = path.join(WORKSPACE_DIR, 'cinema-email-master-template-2.html');
    console.log('   Template:', templatePath);
    let templateHtml = fs.readFileSync(templatePath, 'utf-8');
    
    // Add DOCTYPE and html wrapper that cheerio strips
    templateHtml = '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:mc="http://www.mailchimp.com/2011/merge">\n<head>\n' + templateHtml.substring(templateHtml.indexOf('<head>') + 6);
    
    // Intro text replacement - match template format with film names and descriptions
    let introText = '';
    
    if (payload.featured_films && payload.featured_films.length > 0) {
        introText = '<p style="margin: 0 0 4px 0; font-family: Georgia, \'Times New Roman\', serif; font-size: 16px; color: #1f1f1f; line-height: 1.45;">Dear valued cinema-goer</p>\n';
        introText += '<p style="margin: 0 0 16px 0; font-family: Georgia, \'Times New Roman\', serif; font-size: 17px; font-weight: 600; color: #1f1f1f; line-height: 1.4;">Here\'s what\'s new and unmissable at Deluxe this week:</p>\n';
        
        // Add each featured film with emoji and description
        const emojis = ['&#127917;', '&#9889;', '&#127775;'];
        for (let i = 0; i < payload.featured_films.length; i++) {
            const filmName = payload.featured_films[i];
            const meta = metadata[Object.keys(metadata).find(k => k.toLowerCase().includes(filmName.toLowerCase()))];
            const emoji = emojis[i % emojis.length];
            const desc = meta?.synopsis ? meta.synopsis.substring(0, 80) + (meta.synopsis.length > 80 ? '...' : '') : 'A must-watch film at Deluxe Cinemas.';
            
            introText += `<p style="margin: 0 0 2px 0; font-size: 17px; line-height: 1.4;"><strong style="font-family: Georgia, 'Times New Roman', serif; font-weight: 600; color: #1f1f1f;">${emoji} ${filmName}</strong></p>\n`;
            introText += `<p style="margin: 0 0 12px 0; font-size: 16px; color: #3d3d3d; line-height: 1.45;">${desc}</p>\n`;
        }
        
        // Add dates and closing
        introText += `<p style="margin: 0 0 6px 0; font-size: 14px; color: #5a5a5a; line-height: 1.4;">${payload.dates}</p>\n`;
        introText += '<p style="margin: 0; font-family: Georgia, \'Times New Roman\', serif; font-size: 16px; font-style: italic; color: #1f1f1f; line-height: 1.45;">See you at the Movies!</p>';
    }
    
    templateHtml = templateHtml.replace(/<div mc:edit="intro_text_top">[\s\S]*?<\/div>/, `<div mc:edit="intro_text_top">${introText}</div>`);
    templateHtml = templateHtml.replace(/March \d+\s*[\u2013-]\s*March \d+/g, payload.dates);
    console.log('✅ Template loaded, intro text replaced');
    
    // ========== PROPER ASSEMBLY ==========
    // Find ALL section markers in template
    const markers = {
        preheaderEnd: templateHtml.indexOf('</div>'),
        headerEnd: templateHtml.indexOf('</table><!-- ========== INTRO'),
        introEnd: templateHtml.indexOf('</table><!-- ========== 3. FEATURED'),
        featuredFilmsHeader: templateHtml.indexOf('<!-- ========== 3. FEATURED'),
        featuredFilmOne: templateHtml.indexOf('<!-- FEATURED FILM ONE'),
        featuredFilmTwo: templateHtml.indexOf('<!-- FEATURED FILM TWO'),
        featuredBorderEnd: templateHtml.indexOf('<!-- Close Featured Film'),
        nowShowingHeader: templateHtml.indexOf('<!-- ========== 4. NOW SHOWING'),
        nowShowingFilm1: templateHtml.indexOf('<!-- NOW SHOWING FILM 1'),
        nowShowingFilm2: templateHtml.indexOf('<!-- NOW SHOWING FILM 2'),
        nowShowingBorderEnd: templateHtml.indexOf('<!-- Close programme'),
        comingSoonHeader: templateHtml.indexOf('<!-- ========== 5. COMING SOON'),
        dividerHeader: templateHtml.indexOf('<!-- ========== 6. DIVIDER'),
        specialEventsHeader: templateHtml.indexOf('<!-- ========== 7. SPECIAL'),
        footerHeader: templateHtml.indexOf('<!-- ========== 8. FOOTER'),
    };
    
    console.log('   Markers:', Object.fromEntries(Object.entries(markers).map(([k,v]) => [k, v > -1 ? 'found' : 'MISSING'])));
    
    // Extract base templates for featured and now showing films
    const baseFeaturedBlock = templateHtml.substring(markers.featuredFilmOne, markers.featuredFilmTwo);
    const baseNsBlock = templateHtml.substring(markers.nowShowingFilm1, markers.nowShowingFilm2);
    
    async function buildBlock(filmTitle, baseTemplate, isFeatured, index) {
        console.log(`\n🎬 Processing: ${filmTitle}`);
        // Find matching key in metadata - use fuzzy matching but prioritize longer matches
        const allKeys = Object.keys(metadata).sort((a, b) => b.length - a.length); // Sort by length descending
        const vKey = allKeys.find(k => {
            const kl = k.toLowerCase().trim();
            const fl = filmTitle.toLowerCase().trim();
            // Skip short keys (likely false matches like "M", "R", etc.)
            if (kl.length <= 3) return false;
            return kl === fl || fl.includes(kl) || kl.includes(fl);
        });
        console.log(`   Metadata key matched: ${vKey || 'NONE'}`);
        console.log(`   Title to use: ${vKey ? metadata[vKey].title : filmTitle}`);
        
        // If no match found, use fallback with the original film title
        let meta;
        if (vKey) {
            meta = metadata[vKey];
        } else {
            console.log('   ⚠️ No metadata match, using fallback');
            meta = { title: filmTitle, rating: 'TBC', synopsis: filmTitle + ' is showing at Deluxe Cinemas.', posterUrl: null };
        }
        
        // Get sessions for this film - use the actual Veezi booking URL
        // Veezi returns: { title, times: [], urls: [] }
        const filmSessions = sessions.find(s => {
            if (!s.title) return false;
            const sTitle = s.title.toLowerCase();
            const fTitle = filmTitle.toLowerCase();
            return sTitle.includes(fTitle) || fTitle.includes(sTitle) || 
                   sTitle.replace(/'/g, '').includes(fTitle.replace(/'/g, '')) ||
                   fTitle.replace(/'/g, '').includes(sTitle.replace(/'/g, ''));
        });
        
        // Build showtimes with actual times from Veezi - make them clickable links
        let showtimesHtml = '';
        if (filmSessions && filmSessions.times && filmSessions.times.length > 0 && filmSessions.urls) {
            // Deduplicate times (same times appear multiple times across dates)
            const uniqueTimes = [...new Set(filmSessions.times)];
            const uniqueUrls = [...new Set(filmSessions.urls)];
            
            // Create links for each time (cycling through URLs)
            showtimesHtml = uniqueTimes.slice(0, 6).map((time, i) => {
                const url = uniqueUrls[i % uniqueUrls.length];
                return `<a href="${url}" target="_blank" style="color: #6b6b6b; text-decoration: none; font-weight: bold;">${time}</a>`;
            }).join(' | ');
            console.log(`   Sessions found: ${uniqueTimes.slice(0, 3).join(', ')}...`);
        } else {
            showtimesHtml = 'Check website for sessions';
            console.log(`   No sessions found for: ${filmTitle}`);
        }
        
        // Use the first URL for Book Now button
        let earliestUrl = (filmSessions && filmSessions.urls && filmSessions.urls[0]) 
            ? filmSessions.urls[0] 
            : 'https://deluxecinemas.co.nz/';
        
        // Determine the title to use for API lookups
        let searchTitle = vKey ? metadata[vKey].title : filmTitle;
        
        // For poster/banner: Priority is TMDB (higher res) > MXfilm > fallback
        // MXfilm provides 600x260 thumbnails which are low-res for featured films
        // TMDB has 1280px banners that are much better quality
        let posterUrl = null;
        
        // For featured films, try TMDB first for better quality (1280px vs 600px)
        if (isFeatured) {
            const tmdbBanner = await getTMDBImage(searchTitle, 'banner');
            if (tmdbBanner) {
                posterUrl = tmdbBanner;
                console.log(`   Using TMDB banner (1280px)`);
            }
        }
        
        // If no TMDB, use MXfilm poster
        if (!posterUrl) {
            posterUrl = meta.posterUrl || await getMXfilmPoster(searchTitle);
        }
        
        // Last resort: try TMDB for posters (for now showing)
        if (!posterUrl || posterUrl === FALLBACK_IMAGE) {
            const tmdbImage = await getTMDBImage(searchTitle, 'poster');
            if (tmdbImage) {
                posterUrl = tmdbImage;
                console.log(`   Using TMDB poster (500px)`);
            }
        }
        
        if (!posterUrl) {
            posterUrl = FALLBACK_IMAGE;
        }
        
        // Try MXfilm first - use the matched metadata title for better results
        let trailerUrl = await getMXfilmTrailer(searchTitle);
        console.log(`   MXfilm trailer for "${searchTitle}": ${trailerUrl ? 'found' : 'not found'}`);
        
        if (!trailerUrl) {
            try {
                trailerUrl = await getDeluxeTrailer(filmTitle);
            } catch(e) {
                console.log('   Trailer fetch error, using fallback');
            }
        }
        if (!trailerUrl) {
            trailerUrl = 'https://deluxecinemas.co.nz/';
        }
        console.log('   Trailer:', trailerUrl);
        
        const $b = cheerio.load(baseTemplate, null, false);
        let tagTitle = isFeatured ? 'featured_film_title' : 'movie_title';
        let tagDesc = isFeatured ? 'featured_film_description' : 'movie_description';
        let tagRating = isFeatured ? 'featured_film_rating' : 'movie_rating';
        let tagPoster = isFeatured ? 'featured_film_image' : 'movie_poster';
        
        // For featured films: title, tagline, rating, description order
        if (isFeatured) {
            $b(`[mc\\:edit="featured_film_title"]`).text(meta.title);
            $b(`[mc\\:edit="featured_film_tagline"]`).text(meta.synopsis ? meta.synopsis.substring(0, 100) : 'A must-watch film at Deluxe Cinemas.');
            $b(`[mc\\:edit="featured_film_rating"]`).text(meta.rating);
            $b(`[mc\\:edit="featured_film_description"]`).html((meta.synopsis || '') + '<br><br>');
        } else {
            // For now showing: title, tagline, rating, description
            $b(`[mc\\:edit="movie_title"]`).text(meta.title);
            $b(`[mc\\:edit="movie_tagline"]`).text(meta.synopsis ? meta.synopsis.substring(0, 80) : 'A must-watch film at Deluxe Cinemas.');
            $b(`[mc\\:edit="movie_rating"]`).text(meta.rating);
            $b(`[mc\\:edit="movie_description"]`).html((meta.synopsis || '') + '<br><br>');
        }
        
        $b(`img[mc\\:edit="${tagPoster}"]`).attr('src', posterUrl);
        $b(`[mc\\:edit="movie_showtimes"]`).html(showtimesHtml);
        
        // Set the booking link for Book Now button - use Veezi URL from sessions
        $b('a:contains("Book now")').attr('href', earliestUrl);
        $b(`[mc\\:edit="movie_cta"]`).attr('href', earliestUrl);
        $b(`[mc\\:edit="featured_film_book"]`).attr('href', earliestUrl);
        
        // Set the trailer link - ensure it's a proper YouTube link
        $b(`[mc\\:edit="featured_film_trailer"]`).attr('href', trailerUrl);
        $b(`[mc\\:edit="movie_trailer"]`).attr('href', trailerUrl);
        $b(`a:has(img[mc\\:edit="${tagPoster}"])`).attr('href', earliestUrl);
        
        let finalHtml = $b.html();
        
        // Remove extra description fields
        finalHtml = finalHtml.replace(/<p\s+mc:edit="movie_description_2"[^>]*>[\s\S]*?<\/p>/gi, '');
        finalHtml = finalHtml.replace(/<p\s+mc:edit="movie_description_3"[^>]*>[\s\S]*?<\/p>/gi, '');
        finalHtml = finalHtml.replace(/<p\s+mc:edit="featured_film_description_2"[^>]*>[\s\S]*?<\/p>/gi, '');
        finalHtml = finalHtml.replace(/<p\s+mc:edit="featured_film_description_3"[^>]*>[\s\S]*?<\/p>/gi, '');
        
        // Rename the comments for featured films
        if (isFeatured) {
            let numStr = index === 1 ? 'ONE' : 'TWO';
            let lowerStr = index === 1 ? 'one' : 'two';
            // Also rename the metadata reference in parentheses
            finalHtml = finalHtml
                .replace(/FEATURED FILM ONE/g, `FEATURED FILM ${numStr}`)
                .replace(/featured_film_one/g, `featured_film_${lowerStr}`)
                .replace(/\(metadata: Featured film one\)/g, `(metadata: Featured film ${lowerStr})`);
        } else {
            finalHtml = finalHtml.replace(/<!-- NOW SHOWING FILM 1/, `<!-- NOW SHOWING FILM ${index}`);
            finalHtml = finalHtml.replace(/_1"/g, `_${index}"`);
        }
        
        console.log('   ✅ Block built');
        return finalHtml;
    }
    
    console.log('\n--- STEP 4: Building Film Blocks ---');
    console.log('\n📌 Building Featured Films...');
    let updatedFeatured = [];
    for (let i = 0; i < payload.featured_films.length; i++) {
        updatedFeatured.push(await buildBlock(payload.featured_films[i], baseFeaturedBlock, true, i+1));
    }
    
    console.log('\n📌 Building Now Showing Films...');
    let updatedNowShowing = [];
    for (let i = 0; i < payload.now_showing.length; i++) {
        updatedNowShowing.push(await buildBlock(payload.now_showing[i], baseNsBlock, false, i+1));
    }
    
    console.log('\n--- STEP 5: Assembling Final HTML ---');
    
    // PROPER ASSEMBLY: Extract each section and combine correctly
    // 1. Everything before Featured Films section (preheader + header + intro)
    let beforeFeatured = templateHtml.substring(0, markers.featuredFilmsHeader);
    
    // 2. Featured Films section header (just the header table, not any film block)
    let featuredSectionHeader = templateHtml.substring(markers.featuredFilmsHeader, markers.featuredFilmOne);
    
    // 3. Get just the closing border (not including any template placeholder blocks)
    let featuredBorder = '';
    const borderStart = templateHtml.indexOf('<!-- Close Featured Film');
    if (borderStart > -1) {
        featuredBorder = templateHtml.substring(borderStart, borderStart + 40);
    }
    
    // 4. Now Showing section header
    let nowShowingSectionHeader = templateHtml.substring(markers.nowShowingHeader, markers.nowShowingFilm1);
    
    // 5. Close Now Showing border - just the border, not template placeholders
    let nowShowingBorder = '';
    const nsBorderStart = templateHtml.indexOf('<!-- Close programme');
    if (nsBorderStart > -1) {
        nowShowingBorder = templateHtml.substring(nsBorderStart, nsBorderStart + 30);
    }
    
    // 6. Coming Soon section (keep as-is)
    let comingSoonSection = templateHtml.substring(markers.comingSoonHeader, markers.dividerHeader);
    
    // 7. Divider
    let divider = templateHtml.substring(markers.dividerHeader, markers.specialEventsHeader);
    
    // 8. Special Events section (keep as-is)
    let specialEventsSection = templateHtml.substring(markers.specialEventsHeader, markers.footerHeader);
    
    // 9. Footer (keep as-is)
    let footer = templateHtml.substring(markers.footerHeader);
    
    // Assemble final HTML
    let finalHtml = beforeFeatured 
        + featuredSectionHeader 
        + updatedFeatured.join('') 
        + featuredBorder
        + nowShowingSectionHeader 
        + updatedNowShowing.join('') 
        + nowShowingBorder
        + comingSoonSection
        + divider
        + specialEventsSection
        + footer;
    
    const outputPath = path.join(WORKSPACE_DIR, 'final_dynamic_campaign.html');
    fs.writeFileSync(outputPath, finalHtml);
    console.log('✅ Output saved to:', outputPath);
    
    console.log('\n========================================');
    console.log('🎉 BUILD CINEMA EMAIL - COMPLETED (TEST MODE)');
    console.log('========================================');
    console.log('\n📄 HTML file saved at:', outputPath);
})();
