/**
 * build_html_only.js
 * Like build_and_push.js but:
 *  - No MATON_API_KEY required
 *  - Images use direct remote URLs (no Mailchimp CDN upload)
 *  - No Mailchimp campaign push
 *  - No test email send
 *  - Output filename configurable via second argument (default: final_claude.html)
 *
 * Usage:
 *   node scripts/build_html_only.js campaign_payload.json [output.html]
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { chromium } = require('playwright');

const WORKSPACE_DIR = path.resolve(__dirname, "../");
require('dotenv').config({ path: path.join(WORKSPACE_DIR, '.env.local') });
const FALLBACK_IMAGE = "https://mcusercontent.com/983aaba19411e46e8ff025752/images/492a95d6-c361-ee10-b412-3d0fcb753d18.jpg";

let mxTokenCache = null;
async function getMXfilmToken() {
    if (mxTokenCache) return mxTokenCache;
    const username = process.env.MX_USERNAME;
    const password = process.env.MX_PASSWORD;
    if (!username || !password) return null;
    try {
        const res = await fetch("https://film.moviexchange.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "password", client_id: "MovieXchangeApi", username, password })
        });
        const data = await res.json();
        mxTokenCache = data.access_token || null;
        return mxTokenCache;
    } catch(e) { return null; }
}

let mxReleasesCache = null;
async function getMXfilmReleases(token) {
    if (mxReleasesCache) return mxReleasesCache;
    try {
        const r = await fetch('https://film.moviexchange.com/internal/releases', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        mxReleasesCache = await r.json();
        return mxReleasesCache;
    } catch(e) { return []; }
}

async function getMXfilmPoster(title) {
    console.log(`  🔍 Searching MX Film for poster: ${title}`);
    const token = await getMXfilmToken();
    if (!token) return null;
    try {
        // 1. Find release by title — exact first, then starts-with fallback
        const releases = await getMXfilmReleases(token);
        const titleLower = title.toLowerCase();
        let release = releases.find(r => r.title?.toLowerCase() === titleLower);
        if (!release) {
            // Allow "I Swear (2025)" to match "I Swear", but not "The North" to match "The Northern Lights"
            release = releases.find(r => {
                const rt = r.title?.toLowerCase() || '';
                return rt.startsWith(titleLower + ' ') || rt.startsWith(titleLower + '(') ||
                       rt.startsWith(titleLower + ':') || rt === titleLower;
            });
        }
        if (!release) { console.log(`  ❌ Not found in MXfilm: ${title}`); return null; }

        // 2. Get media items for this release
        const mediaRes = await fetch(
            `https://film.moviexchange.com/internal/media/release/${release.externalId}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const items = await mediaRes.json();

        // 3. Find the default Poster image
        const poster =
            items.find(m => m.value?.mediaRole?.code === 'Poster' && m.value?.mediaType === 'Image' && m.value?.isDefault) ||
            items.find(m => m.value?.mediaRole?.code === 'Poster' && m.value?.mediaType === 'Image');
        if (!poster?.value) return null;

        // 4. Return previewMedium (337×500, ~38KB) — 2× display size, retina-sharp for email
        const url = poster.value.previewMedium || poster.value.filePath;
        if (url) console.log(`  ✅ Found MXfilm poster`);
        return url;
    } catch(e) {
        console.warn(`  ⚠️ MXfilm poster fetch failed: ${e.message}`);
        return null;
    }
}

async function getTMDBPoster(title) {
    console.log(`  🔍 Searching TMDB for portrait poster: ${title}`);
    try {
        const res = await fetch(`https://www.themoviedb.org/search?query=${encodeURIComponent(title)}`, { headers: { "User-Agent": "Mozilla/5.0" } });
        const html = await res.text();
        // Extract all movie results with their titles from the search page
        const resultPattern = /href="(\/movie\/\d+[^"]*)"[^>]*>[\s\S]*?<\/h2>\s*<\/a>[\s\S]*?<\/a>[\s\S]*?([^<]+)<\/h2>/g;
        const titleLower = title.toLowerCase();
        // Find the first result whose title actually matches
        const movieLinks = [...html.matchAll(/data-media-type="movie"[\s\S]*?href="(\/movie\/\d+[^"]*)"/g)].map(m => m[1]);
        // Fall back to any movie link if no structured match
        const firstLink = movieLinks[0] || (html.match(/href="(\/movie\/\d+[^"]*)"/)||[])[1];
        if (firstLink) {
            const mRes = await fetch(`https://www.themoviedb.org${firstLink}`, { headers: { "User-Agent": "Mozilla/5.0" } });
            const mHtml = await mRes.text();
            // Validate: og:title must contain our search title
            const ogTitle = (mHtml.match(/<meta property="og:title" content="([^"]+)"/) || [])[1] || '';
            if (!ogTitle.toLowerCase().includes(titleLower) && !titleLower.includes(ogTitle.toLowerCase().replace(/ \(\d{4}\)$/, ''))) {
                console.log(`  ❌ TMDB first result "${ogTitle}" doesn't match "${title}", skipping`);
                return null;
            }
            const ogMatch = mHtml.match(/<meta property="og:image" content="([^"]+)"/);
            if (ogMatch) {
                console.log(`  ✅ Found TMDB portrait poster`);
                return ogMatch[1];
            }
        }
    } catch(e) {
        console.warn(`  ⚠️ TMDB poster search failed: ${e.message}`);
    }
    return null;
}

// ---------- Image source finders (no upload) ----------

let deluxePostersCache = null;
let deluxeBrowserLaunched = false;

async function fetchAllDeluxePosters() {
    if (deluxePostersCache) return deluxePostersCache;
    let browser;
    try {
        if (!deluxeBrowserLaunched) {
            console.log('  🌐 Launching browser to scrape Deluxe Cinemas posters...');
            deluxeBrowserLaunched = true;
        }
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto('https://www.deluxecinemas.co.nz/', { waitUntil: 'networkidle', timeout: 30000 });

        // Scroll to the bottom to trigger IntersectionObserver lazy loading for off-screen posters
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000); // wait for lazy-loaded images to settle

        const posters = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('img.movie-poster')).map(img => ({
                // data-src holds the real URL before lazy loading swaps it into src
                src: img.dataset.src || img.dataset.lazySrc || img.currentSrc || img.src,
                alt: img.alt
            }));
        });

        deluxePostersCache = {};
        posters.forEach(p => {
            // alt is "Movie poster for {title}"
            const title = p.alt.replace(/^Movie poster for /i, '').trim().toLowerCase();
            // Only store real HTTP URLs; skip placeholder data: URIs or empty strings
            if (title && p.src && p.src.startsWith('http') && !deluxePostersCache[title]) {
                deluxePostersCache[title] = p.src;
            }
        });
        console.log(`  ✅ Cached ${Object.keys(deluxePostersCache).length} Deluxe Cinemas posters`);
    } catch (e) {
        const isMissingBinary = e.message.includes('Executable doesn\'t exist') ||
                                e.message.includes('playwright install');
        if (isMissingBinary) {
            console.warn('  ⚠️ Chromium not installed. Run:');
            console.warn('     npx playwright install --with-deps chromium');
            console.warn('  ⚠️ Skipping Deluxe Cinemas posters (will use fallback images).');
        } else {
            console.warn(`  ⚠️ Failed to fetch Deluxe Cinemas posters: ${e.message}`);
        }
        deluxePostersCache = {};
    } finally {
        if (browser) await browser.close();
    }
    return deluxePostersCache;
}

async function getDeluxeCinemaPoster(title) {
    console.log(`  🔍 Searching deluxecinemas.co.nz for poster: ${title}`);
    const posters = await fetchAllDeluxePosters();
    const titleLower = title.toLowerCase();

    // Exact match
    if (posters[titleLower]) {
        console.log(`  ✅ Found poster on Deluxe Cinemas`);
        return posters[titleLower];
    }
    // Fuzzy match: only if the shorter string is at least 60% of the longer string's length
    // This prevents "IT" matching "BITTER" or "The" matching everything
    const matchKey = Object.keys(posters).find(k => {
        const longer = k.length >= titleLower.length ? k : titleLower;
        const shorter = k.length >= titleLower.length ? titleLower : k;
        return longer.includes(shorter) && shorter.length / longer.length >= 0.6;
    });
    if (matchKey) {
        console.log(`  ✅ Found poster on Deluxe Cinemas (fuzzy: "${matchKey}")`);
        return posters[matchKey];
    }
    return null;
}

async function getTMDBBanner(title) {
    console.log(`  🔍 Searching TMDB for banner: ${title}`);
    try {
        const res = await fetch(`https://www.themoviedb.org/search?query=${encodeURIComponent(title)}`, { headers: { "User-Agent": "Mozilla/5.0" } });
        const html = await res.text();
        const match = html.match(/href="(\/movie\/\d+[^"]*)"/);
        if (match) {
            const mRes = await fetch(`https://www.themoviedb.org${match[1]}`, { headers: { "User-Agent": "Mozilla/5.0" } });
            const mHtml = await mRes.text();
            const bMatch = mHtml.match(/url\('([^']+w1920[^']+)'\)/);
            if (bMatch) {
                console.log(`  ✅ Found TMDB banner`);
                return bMatch[1];
            }
        }
    } catch (e) {
        console.warn(`  ⚠️ TMDB search failed: ${e.message}`);
    }
    return null;
}

function extractYouTubeId(html) {
    const patterns = [
        /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /data-video-key="([a-zA-Z0-9_-]{11})"/,
        /data-youtube-id="([a-zA-Z0-9_-]{11})"/,
        /data-video-id="([a-zA-Z0-9_-]{11})"/,
        /"key"\s*:\s*"([a-zA-Z0-9_-]{11})"/,
    ];
    for (const p of patterns) {
        const m = html.match(p);
        if (m) return m[1];
    }
    return null;
}

function normalizeTitleForMatch(t) {
    return t.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function titleMatchesOgTitle(searchTitle, ogTitle) {
    if (!ogTitle) return false;
    const search = normalizeTitleForMatch(searchTitle);
    // og:title on TMDB is usually "Film Title (YYYY)" — strip year
    const og = normalizeTitleForMatch(ogTitle.replace(/\s*\(\d{4}\)\s*$/, ''));
    if (og === search) return true;
    // og starts with search title (handles subtitle variants)
    if (og.startsWith(search)) return true;
    // search title starts with og title (search is more specific)
    if (search.startsWith(og) && og.length >= search.length - 5) return true;
    return false;
}

async function getTMDBTrailer(title) {
    console.log(`  🔍 Searching TMDB for YouTube trailer: ${title}`);
    try {
        const searchRes = await fetch(`https://www.themoviedb.org/search?query=${encodeURIComponent(title)}`, { headers: { "User-Agent": "Mozilla/5.0" } });
        const searchHtml = await searchRes.text();

        const allMovieMatches = [...searchHtml.matchAll(/href="\/movie\/(\d+)(-[^"]*)?"/g)];
        if (allMovieMatches.length === 0) return null;

        // Try each TMDB result in order; accept the first whose og:title matches our search title
        for (const m of allMovieMatches.slice(0, 5)) {
            const movieId = m[1];
            const movieRes = await fetch(`https://www.themoviedb.org/movie/${movieId}`, { headers: { "User-Agent": "Mozilla/5.0" } });
            const movieHtml = await movieRes.text();

            // Validate title via og:title
            const ogTitleMatch = movieHtml.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
                              || movieHtml.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
            const ogTitle = ogTitleMatch ? ogTitleMatch[1] : null;

            if (!titleMatchesOgTitle(title, ogTitle)) {
                console.warn(`  ⚠️ TMDB result mismatch: searched "${title}", got og:title "${ogTitle}" — skipping`);
                continue;
            }

            // Title validated — look for YouTube trailer
            const ytSiteMatch = movieHtml.match(/data-site="YouTube"[^>]*data-id="([a-zA-Z0-9_-]{11})"/);
            const ytIdMatch = movieHtml.match(/data-id="([a-zA-Z0-9_-]{11})"[^>]*data-site="YouTube"/);
            const ytId = (ytSiteMatch && ytSiteMatch[1]) || (ytIdMatch && ytIdMatch[1]) || extractYouTubeId(movieHtml);

            if (ytId) {
                const ytUrl = `https://www.youtube.com/watch?v=${ytId}`;
                console.log(`  ✅ Found TMDB YouTube trailer: ${ytUrl}`);
                return ytUrl;
            }
            // Right film but no trailer on TMDB — stop searching
            break;
        }
    } catch (e) {
        console.warn(`  ⚠️ TMDB trailer search failed: ${e.message}`);
    }
    return null;
}

let deluxeFilmUrlsCache = null;

async function fetchDeluxeFilmUrls() {
    if (deluxeFilmUrlsCache) return deluxeFilmUrlsCache;
    deluxeFilmUrlsCache = {};
    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        for (const pageUrl of ['https://www.deluxecinemas.co.nz/', 'https://www.deluxecinemas.co.nz/coming-soon']) {
            await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30000 });
            const links = await page.evaluate(() =>
                Array.from(document.querySelectorAll('a[href*="/movie/"]')).map(el => ({
                    text: el.textContent.trim(),
                    href: el.href
                }))
            );
            for (const { text, href } of links) {
                if (!href || !text) continue;
                // Extract first line of text (title is before synopsis/dates)
                const titleLine = text.split('\n')[0].trim();
                if (titleLine) deluxeFilmUrlsCache[titleLine.toLowerCase()] = href;
            }
        }
        console.log(`  ✅ Cached ${Object.keys(deluxeFilmUrlsCache).length} Deluxe film URLs`);
    } catch (e) {
        console.warn(`  ⚠️ Failed to fetch Deluxe film URLs: ${e.message}`);
    } finally {
        if (browser) await browser.close();
    }
    return deluxeFilmUrlsCache;
}

async function getDeluxeTrailer(title) {
    console.log(`  🔍 Searching deluxecinemas.co.nz for trailer: ${title}`);
    let browser;
    try {
        const filmUrls = await fetchDeluxeFilmUrls();
        const titleLower = title.toLowerCase();

        // Find film URL by exact match, then starts-with, then partial word match
        let filmUrl = filmUrls[titleLower];
        if (!filmUrl) {
            const key = Object.keys(filmUrls).find(k => k.startsWith(titleLower) || titleLower.startsWith(k));
            if (key) filmUrl = filmUrls[key];
        }
        if (!filmUrl) return null;

        // Load the film page with Playwright to get the rendered iframe
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(filmUrl, { waitUntil: 'networkidle', timeout: 30000 });

        const iframeSrc = await page.evaluate(() => {
            const iframe = document.querySelector('iframe[src*="youtube.com/embed/"]');
            return iframe ? iframe.src : null;
        });

        if (iframeSrc) {
            const ytIdMatch = iframeSrc.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
            if (ytIdMatch) {
                const ytUrl = `https://www.youtube.com/watch?v=${ytIdMatch[1]}`;
                console.log(`  ✅ Found YouTube trailer on Deluxe Cinemas: ${ytUrl}`);
                return ytUrl;
            }
        }

        console.log(`  ℹ️ No YouTube trailer found on Deluxe film page, skipping`);
        return null;
    } catch (e) {
        console.warn(`  ⚠️ Failed to fetch trailer from Deluxe Cinemas: ${e.message}`);
    } finally {
        if (browser) await browser.close();
    }
    return null;
}

/**
 * Returns a best-effort image URL without uploading anywhere.
 */
async function resolveImageUrl(veeziUrl, isLandscape, title) {
    let finalUrl = null;

    if (isLandscape) {
        // Featured film: TMDB banner > Deluxe > Veezi
        const tmdb = await getTMDBBanner(title);
        if (tmdb) { finalUrl = tmdb; console.log(`  ✅ [Featured] Using TMDB banner`); }

        if (!finalUrl) {
            const deluxe = await getDeluxeCinemaPoster(title);
            if (deluxe) { finalUrl = deluxe; console.log(`  ✅ [Featured] Using Deluxe poster`); }
        }

        if (!finalUrl && veeziUrl && veeziUrl.startsWith('http')) {
            finalUrl = veeziUrl;
            console.log(`  ⚠️ [Featured] Falling back to Veezi poster`);
        }
    } else {
        // Now Showing: MX Film > Deluxe Cinemas > TMDB portrait > fallback image
        const mx = await getMXfilmPoster(title);
        if (mx) { finalUrl = mx; console.log(`  ✅ [Now Showing] Using MX Film poster`); }

        if (!finalUrl) {
            const deluxe = await getDeluxeCinemaPoster(title);
            if (deluxe) { finalUrl = deluxe; console.log(`  ✅ [Now Showing] Using Deluxe poster`); }
        }

        if (!finalUrl) {
            const tmdb = await getTMDBPoster(title);
            if (tmdb) { finalUrl = tmdb; console.log(`  ✅ [Now Showing] Using TMDB portrait poster`); }
        }
    }

    return finalUrl || FALLBACK_IMAGE;
}

// ---------- Veezi data ----------

async function getVeeziSessions() {
    console.log("📡 Fetching Veezi sessions API...");
    const res = await fetch("https://ticketing.oz.veezi.com/sessions/?siteToken=wpge11hbvd3zadj20jkc0y36ym");
    const html = await res.text();
    const match = html.match(/\[{"@type":"VisualArtsEvent".*?\}\]/);
    if (!match) throw new Error("❌ Could not find Veezi JSON-LD data");
    console.log("✅ Veezi sessions fetched successfully");
    return JSON.parse(match[0]);
}

async function getVeeziMetadata() {
    console.log("📡 Scraping Veezi metadata (posters, ratings, synopses)...");
    const res = await fetch("https://ticketing.oz.veezi.com/sessions/?siteToken=wpge11hbvd3zadj20jkc0y36ym");
    const html = await res.text();
    const $ = cheerio.load(html);

    const meta = {};
    $('h3.title').each((i, el) => {
        const title = $(el).text().trim();
        const container = $(el).closest('div');
        const prev = container.prevAll('.poster-container').first();
        let posterUrl = prev.find('img.poster').attr('src');
        if (posterUrl && !posterUrl.startsWith('http')) posterUrl = "https://ticketing.oz.veezi.com" + posterUrl;

        const rating = container.find('.censor').text().trim() || "TBC";
        const synopsis = container.find('.film-desc').text().trim();

        if (!meta[title] || (!meta[title].synopsis && synopsis)) {
            meta[title] = { title, posterUrl, rating, synopsis };
        }
    });
    console.log(`✅ Found metadata for ${Object.keys(meta).length} films`);
    return meta;
}

// ---------- Helpers ----------

function formatDate(iso) {
    const d = new Date(iso);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let hours = d.getHours();
    let mins = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    mins = mins < 10 ? '0' + mins : mins;
    return `${days[d.getDay()]} ${d.getDate()}, ${months[d.getMonth()]}: ${hours}:${mins} ${ampm}`;
}

// ---------- Intro HTML ----------

function generateIntroHtml(featuredFilms, nowShowing, dates, metadata) {
    // Highlight featured films + up to 2 now-showing films (max 4 total)
    const highlightFilms = [...featuredFilms];
    const extras = Math.min(2, 4 - highlightFilms.length);
    for (let i = 0; i < extras && i < nowShowing.length; i++) {
        highlightFilms.push(nowShowing[i]);
    }

    const emojis = ['⭐', '🎬', '🎭', '🌟', '🎥', '✨'];

    let filmLines = '';
    highlightFilms.forEach((filmTitle, idx) => {
        const vKey = Object.keys(metadata).find(k =>
            k.toLowerCase().includes(filmTitle.toLowerCase()) ||
            filmTitle.toLowerCase().includes(k.toLowerCase())
        );
        const meta = vKey ? metadata[vKey] : null;
        const displayTitle = (meta ? meta.title : filmTitle)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const synopsis = (meta && meta.synopsis) ? meta.synopsis : '';
        let firstSentence = synopsis.split(/(?<=[.!?])\s/)[0] || synopsis.split(/[.!?]/)[0] || '';
        firstSentence = firstSentence.trim();
        if (firstSentence.length > 10) {
            firstSentence = firstSentence.replace(/[.!?]*$/, '') + '.';
        } else {
            firstSentence = 'Now showing at Deluxe Cinemas.';
        }
        firstSentence = firstSentence.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const emoji = emojis[idx % emojis.length];
        filmLines += `<p style="margin: 0 0 2px 0; font-size: 17px; line-height: 1.4;"><strong style="font-family: Georgia, 'Times New Roman', serif; font-weight: 600; color: #1f1f1f;">${emoji} ${displayTitle}</strong></p>\n`;
        filmLines += `<p style="margin: 0 0 12px 0; font-size: 16px; color: #3d3d3d; line-height: 1.45;">${firstSentence}</p>\n`;
    });

    const displayDates = dates.replace(/\s+to\s+/i, ' \u2013 ');

    return `<p style="margin: 0 0 4px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; color: #1f1f1f; line-height: 1.45;">Dear valued cinema-goer</p>
<p style="margin: 0 0 16px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 17px; font-weight: 600; color: #1f1f1f; line-height: 1.4;">Here\u2019s what\u2019s new and unmissable at Deluxe this week:</p>
${filmLines}<p style="margin: 0 0 6px 0; font-size: 14px; color: #5a5a5a; line-height: 1.4;">${displayDates}</p>
<p style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; font-style: italic; color: #1f1f1f; line-height: 1.45;">See you at the Movies!</p>`;
}

// ---------- Main ----------

async function main() {
    console.log("\n========================================");
    console.log("🎬 BUILD CINEMA EMAIL (HTML ONLY) - STARTED");
    console.log("========================================\n");

    const payloadFile = process.argv[2];
    if (!payloadFile) throw new Error("❌ Usage: node build_html_only.js <payload.json> [output.html]");

    const outputFilename = process.argv[3] || "final_claude.html";

    console.log(`📋 Loading payload: ${payloadFile}`);
    const payload = JSON.parse(fs.readFileSync(payloadFile, "utf-8"));
    console.log(`   Dates: ${payload.dates}`);
    console.log(`   Featured films: ${payload.featured_films.join(", ")}`);
    console.log(`   Now showing: ${payload.now_showing.join(", ")}`);
    console.log(`   Output: ${outputFilename}`);

    console.log("\n--- STEP 1: Fetching Data ---");
    const sessions = await getVeeziSessions();
    const metadata = await getVeeziMetadata();

    console.log("\n--- STEP 2: Parsing Date Range ---");
    const monthMap = { "jan": 0, "feb": 1, "mar": 2, "apr": 3, "may": 4, "jun": 5, "jul": 6, "aug": 7, "sep": 8, "oct": 9, "nov": 10, "dec": 11 };
    const dateMatch = payload.dates.toLowerCase().match(/([a-z]+)\s+(\d+).*?([a-z]+)?\s+(\d+)/);

    let startMonth = dateMatch ? monthMap[dateMatch[1].substring(0, 3)] : 2;
    let startDay = dateMatch ? parseInt(dateMatch[2]) : 27;
    let endMonth = dateMatch && dateMatch[3] ? monthMap[dateMatch[3].substring(0, 3)] : startMonth;
    let endDay = dateMatch ? parseInt(dateMatch[4]) : 29;

    const targetStart = new Date(Date.UTC(2026, startMonth, startDay, 0, 0, 0));
    const targetEnd = new Date(Date.UTC(2026, endMonth, endDay, 23, 59, 59));

    console.log(`   Target range: ${targetStart.toDateString()} to ${targetEnd.toDateString()}`);

    const targetSessions = sessions.filter(s => {
        const d = new Date(s.startDate);
        return d >= targetStart && d <= targetEnd;
    });
    console.log(`   Found ${targetSessions.length} sessions in date range`);

    console.log("\n--- STEP 3: Loading Template ---");
    const templatePath = path.join(WORKSPACE_DIR, "cinema-email-master-template-2.html");
    const html = fs.readFileSync(templatePath, "utf-8");

    let newHtmlStr = html.replace(/March \d+\s*[\u2013-]\s*March \d+/g, payload.dates);
    console.log(`   ✅ Template loaded and date range updated`);

    console.log("\n--- STEP 4: Building Film Blocks ---");

    // Auto-generate intro HTML matching the template structure
    const introHtml = generateIntroHtml(payload.featured_films, payload.now_showing, payload.dates, metadata);
    console.log(`   ✅ Generated intro text`);

    // Update intro text with REGEX (not Cheerio) so the document structure and all
    // character-offset indices remain valid. Cheerio's $.html() strips the DOCTYPE /
    // <html><head><body> wrapper, which shifts every subsequent indexOf result.
    const introReplacePattern = /(<div\s[^>]*mc:edit="intro_text_top"[^>]*>)[\s\S]*?(<\/div>)/;
    if (introReplacePattern.test(newHtmlStr)) {
        newHtmlStr = newHtmlStr.replace(introReplacePattern, `$1${introHtml}$2`);
        console.log(`   ✅ Intro text updated in template`);
    } else {
        console.log(`   ⚠️ intro_text_top tag not found in template`);
    }

    // Compute all slice indices AFTER the intro update so they stay in sync
    const f1Start = newHtmlStr.indexOf("<!-- FEATURED FILM ONE");
    const f2Start = newHtmlStr.indexOf("<!-- FEATURED FILM TWO");
    const nsStart = newHtmlStr.indexOf("<!-- ========== 4. NOW SHOWING");
    const csStart = newHtmlStr.indexOf("<!-- ========== 5. COMING SOON");
    const closeFeaturedBorderStart = newHtmlStr.indexOf("<!-- Close Featured Film card border");
    const closeProgrammeBorderStart = newHtmlStr.indexOf("<!-- Close programme card border");
    const nsFilm1Start = newHtmlStr.indexOf("<!-- NOW SHOWING FILM 1");

    const baseF1Block = newHtmlStr.substring(f1Start, f2Start);
    const nsContent = newHtmlStr.substring(nsFilm1Start, closeProgrammeBorderStart);
    const nsBlocks = nsContent.split(/(?=<!-- NOW SHOWING FILM \d+)/).filter(b => b.trim().length > 0);
    const baseNsBlock = nsBlocks[0];

    async function buildBlock(filmTitle, baseTemplate, isFeatured, index) {
        console.log(`\n   ${isFeatured ? "⭐" : "🎬"} Processing: ${filmTitle}`);

        const vKey = Object.keys(metadata).find(k =>
            k.toLowerCase().includes(filmTitle.toLowerCase()) ||
            filmTitle.toLowerCase().includes(k.toLowerCase())
        );

        let meta;
        if (vKey) {
            meta = metadata[vKey];
            console.log(`   ✅ Matched to Veezi: "${vKey}"`);
        } else {
            meta = {
                title: filmTitle,
                rating: "TBC",
                synopsis: filmTitle + " is showing at Deluxe Cinemas.",
                posterUrl: null
            };
            console.log(`   ⚠️ Film not found in Veezi - using fallback data`);
        }

        let mSessions = targetSessions.filter(s =>
            s.name.toLowerCase().includes(filmTitle.toLowerCase()) ||
            filmTitle.toLowerCase().includes(s.name.toLowerCase())
        );
        mSessions.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

        if (mSessions.length > 0) {
            console.log(`   ✅ Found ${mSessions.length} showtimes in date range`);
        } else {
            console.log(`   ⚠️ No showtimes in date range - will show "Check website for times"`);
        }

        let showtimesHtml = mSessions.map(s =>
            `<a href="${s.url}" target="_blank" style="color: #6b6b6b; text-decoration: none; font-weight: bold;">${formatDate(s.startDate)}</a>`
        ).join(" | ");
        if (showtimesHtml === "") showtimesHtml = "Check website for times.";
        const earliestUrl = mSessions.length > 0 ? mSessions[0].url : "https://deluxecinemas.co.nz/";

        console.log(`   🖼️ Resolving poster image URL...`);
        const imageUrl = await resolveImageUrl(meta.posterUrl, isFeatured, meta.title);

        console.log(`   🎬 Fetching trailer link...`);
        let trailerUrl = await getDeluxeTrailer(filmTitle)
                      || await getTMDBTrailer(filmTitle)
                      || `https://www.youtube.com/results?search_query=${encodeURIComponent(filmTitle + ' trailer')}`;

        const $b = cheerio.load(baseTemplate, null, false);

        let tagTitle = isFeatured ? 'featured_film_title' : 'movie_title';
        let tagDesc = isFeatured ? 'featured_film_description' : 'movie_description';
        let tagRating = isFeatured ? 'featured_film_rating' : 'movie_rating';
        let tagPoster = isFeatured ? 'featured_film_image' : 'movie_poster';

        $b(`[mc\\:edit="${tagTitle}"]`).text(meta.title);
        $b(`[mc\\:edit="${tagRating}"]`).text(meta.rating);

        let parts = meta.synopsis.split(/[.?!] /);
        let tagline = parts[0] ? parts[0] + "." : "";
        let desc = parts.slice(1).join(". ") || meta.synopsis;

        let tagTagline = isFeatured ? 'featured_film_tagline' : 'movie_tagline';
        $b(`[mc\\:edit="${tagTagline}"]`).text(tagline);
        $b(`[mc\\:edit="${tagDesc}"]`).html(desc + "<br><br>");

        // Clear leftover template example content from extra description paragraphs
        $b('[mc\\:edit="movie_description_2"]').remove();
        $b('[mc\\:edit="movie_description_3"]').remove();

        $b(`img[mc\\:edit="${tagPoster}"]`).attr('src', imageUrl);

        $b(`[mc\\:edit="movie_showtimes"]`).html(showtimesHtml);
        $b('a:contains("Book now")').attr('href', earliestUrl);

        const trailerLink = $b('a:contains("View Trailer")');
        if (trailerLink.length) trailerLink.attr('href', trailerUrl);

        if (isFeatured) $b(`[mc\\:edit="featured_film_trailer"]`).attr('href', trailerUrl);
        $b(`[mc\\:edit="movie_trailer"]`).attr('href', trailerUrl);
        $b(`a:has(img[mc\\:edit="${tagPoster}"])`).attr('href', earliestUrl);

        let finalHtml = $b.html();
        if (isFeatured) {
            let numStr = index === 1 ? "ONE" : "TWO";
            let lowerStr = index === 1 ? "one" : "two";
            finalHtml = finalHtml.replace(/FEATURED FILM ONE/g, `FEATURED FILM ${numStr}`).replace(/featured_film_one/g, `featured_film_${lowerStr}`);
        } else {
            finalHtml = finalHtml.replace(/<!-- NOW SHOWING FILM 1/, `<!-- NOW SHOWING FILM ${index}`);
            finalHtml = finalHtml.replace(/_1"/g, `_${index}"`);
        }

        console.log(`   ✅ ${filmTitle} block built successfully`);
        return finalHtml;
    }

    console.log("\n   📌 Building Featured Films...");
    let updatedFeatured = [];
    for (let i = 0; i < payload.featured_films.length; i++) {
        updatedFeatured.push(await buildBlock(payload.featured_films[i], baseF1Block, true, i + 1));
    }

    console.log("\n   📌 Building Now Showing Films...");
    let updatedNowShowing = [];
    for (let i = 0; i < payload.now_showing.length; i++) {
        updatedNowShowing.push(await buildBlock(payload.now_showing[i], baseNsBlock, false, i + 1));
    }

    console.log("\n--- STEP 5: Assembling Final HTML ---");
    // Sections extracted from the template (preserve border-closing tables)
    const featuredClosingSection = newHtmlStr.substring(closeFeaturedBorderStart, nsStart);   // "Close Featured Film card border" table
    const nowShowingHeader       = newHtmlStr.substring(nsStart, nsFilm1Start);               // "Now Showing" heading table
    const programmeClosingSection = newHtmlStr.substring(closeProgrammeBorderStart, csStart); // "Close programme card border" table

    let finalHtml =
        newHtmlStr.substring(0, f1Start) +    // header, intro, "Featured Film" section heading
        updatedFeatured.join("") +             // built featured film blocks
        featuredClosingSection +               // bottom border of featured card
        nowShowingHeader +                     // "Now Showing" heading
        updatedNowShowing.join("") +           // built now showing film blocks
        programmeClosingSection +              // bottom border of programme card
        newHtmlStr.substring(csStart);         // coming soon + promo + footer

    const outputPath = path.join(WORKSPACE_DIR, outputFilename);
    fs.writeFileSync(outputPath, finalHtml);
    console.log(`   ✅ Output saved to: ${outputPath}`);

    console.log("\n========================================");
    console.log("🎉 BUILD CINEMA EMAIL (HTML ONLY) - COMPLETED!");
    console.log(`   Output: ${outputPath}`);
    console.log("========================================\n");
}

main().catch(err => {
    console.error("\n❌ ERROR:", err.message);
    process.exit(1);
});
