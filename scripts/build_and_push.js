const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { execSync } = require('child_process');
const { chromium } = require('playwright');

const MC_API_KEY = process.env.MATON_API_KEY;
if (!MC_API_KEY) {
    console.error("❌ FATAL: MATON_API_KEY environment variable is required.");
    console.error("   Please create .env.local with: MATON_API_KEY=your_key");
    console.error("   Or set it in your environment before running.");
    process.exit(1);
}
const MC_BASE_URL = "https://gateway.maton.ai/mailchimp/3.0";
const WORKSPACE_DIR = path.resolve(__dirname, "../");

const FALLBACK_IMAGE = "https://mcusercontent.com/983aaba19411e46e8ff025752/images/492a95d6-c361-ee10-b412-3d0fcb753d18.jpg";

async function getMXfilmCredentials() {
    const mxCredsPath = "/home/ubuntu/.openclaw/workspace/.mx_api_credentials";
    if (!fs.existsSync(mxCredsPath)) return null;
    const content = fs.readFileSync(mxCredsPath, "utf-8");
    const username = content.match(/MX_USERNAME=(.+)/)?.[1];
    const password = content.match(/MX_PASSWORD=(.+)/)?.[1];
    return username && password ? { username, password } : null;
}

let mxTokenCache = null;
async function getMXfilmToken() {
    if (mxTokenCache) return mxTokenCache;
    const creds = await getMXfilmCredentials();
    if (!creds) return null;
    try {
        const res = await fetch("https://film.moviexchange.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "password", client_id: "MovieXchangeApi", ...creds })
        });
        const data = await res.json();
        mxTokenCache = data.access_token || null;
        return mxTokenCache;
    } catch(e) { return null; }
}

async function getMXfilmTrailer(title) {
    const token = await getMXfilmToken();
    if (!token) return null;
    try {
        const res = await fetch(`https://film.moviexchange.com/api/v1/films?title=${encodeURIComponent(title)}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const films = await res.json();
        const film = films.find(f => f.title?.toLowerCase().includes(title.toLowerCase()));
        return film?.trailerUrl || film?.videoUrl || null;
    } catch(e) { return null; }
}

async function getMXfilmPoster(title) {
    const token = await getMXfilmToken();
    if (!token) return null;
    try {
        const res = await fetch(`https://film.moviexchange.com/api/v1/films?title=${encodeURIComponent(title)}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const films = await res.json();
        const film = films.find(f => f.title?.toLowerCase().includes(title.toLowerCase()));
        return film?.posterUrl || film?.imageUrl || film?.thumbnailUrl || null;
    } catch(e) { return null; }
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

async function getTMDBTrailer(title) {
    console.log(`  🔍 Searching TMDB for YouTube trailer: ${title}`);
    try {
        const searchRes = await fetch(`https://www.themoviedb.org/search?query=${encodeURIComponent(title)}`, { headers: { "User-Agent": "Mozilla/5.0" } });
        const searchHtml = await searchRes.text();
        const movieMatch = searchHtml.match(/href="\/movie\/(\d+)(-[^"]*)?"/);
        if (!movieMatch) return null;
        const movieId = movieMatch[1];

        // Fetch the movie page — TMDB embeds data-site="YouTube" data-id="VIDEO_ID" in the initial HTML
        const movieRes = await fetch(`https://www.themoviedb.org/movie/${movieId}`, { headers: { "User-Agent": "Mozilla/5.0" } });
        const movieHtml = await movieRes.text();

        // Primary: look for YouTube play_trailer link with data-site + data-id
        const ytSiteMatch = movieHtml.match(/data-site="YouTube"[^>]*data-id="([a-zA-Z0-9_-]{11})"/);
        const ytIdMatch = movieHtml.match(/data-id="([a-zA-Z0-9_-]{11})"[^>]*data-site="YouTube"/);
        const ytId = (ytSiteMatch && ytSiteMatch[1]) || (ytIdMatch && ytIdMatch[1]) || extractYouTubeId(movieHtml);

        if (ytId) {
            const ytUrl = `https://www.youtube.com/watch?v=${ytId}`;
            console.log(`  ✅ Found TMDB YouTube trailer: ${ytUrl}`);
            return ytUrl;
        }
    } catch(e) {
        console.warn(`  ⚠️ TMDB trailer search failed: ${e.message}`);
    }
    return null;
}

async function getDeluxeTrailer(title) {
    console.log(`  🔍 Searching deluxecinemas.co.nz for trailer: ${title}`);
    try {
        const res = await fetch(`https://www.deluxecinemas.co.nz/`, { headers: { "User-Agent": "Mozilla/5.0" } });
        const html = await res.text();
        const $ = cheerio.load(html);

        const filmLink = $(`a:contains("${title}")`).first();
        if (filmLink.length) {
            const href = filmLink.attr('href');
            if (href) {
                const filmRes = await fetch(`https://www.deluxecinemas.co.nz${href}`, { headers: { "User-Agent": "Mozilla/5.0" } });
                const filmHtml = await filmRes.text();

                // First: look for any YouTube video ID embedded in the page
                const ytId = extractYouTubeId(filmHtml);
                if (ytId) {
                    const ytUrl = `https://www.youtube.com/watch?v=${ytId}`;
                    console.log(`  ✅ Found YouTube trailer on Deluxe Cinemas: ${ytUrl}`);
                    return ytUrl;
                }
            }
        }
    } catch(e) {
        console.warn(`  ⚠️ Failed to fetch trailer from Deluxe Cinemas: ${e.message}`);
    }
    return null;
}

async function uploadImage(buffer, filename) {
    console.log(`  📤 Uploading ${filename} to Mailchimp CDN...`);
    const content = buffer.toString('base64');
    const res = await fetch(`${MC_BASE_URL}/file-manager/files`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${MC_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: `auto_${Date.now()}_${filename}`, file_data: content })
    });
    const data = await res.json();
    if (!res.ok) {
        console.warn(`  ⚠️ Upload failed for ${filename}: ${JSON.stringify(data)}`);
        throw new Error(`Upload failed for ${filename}`);
    }
    console.log(`  ✅ Image uploaded successfully`);
    return data.full_size_url;
}

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

    if (posters[titleLower]) {
        console.log(`  ✅ Found poster on Deluxe Cinemas`);
        return posters[titleLower];
    }
    const matchKey = Object.keys(posters).find(k =>
        k.includes(titleLower) || titleLower.includes(k)
    );
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
            const mRes = await fetch(`https://www.themoviedb.org${match[1]}`, { headers: { "User-Agent": "Mozilla/5.0" }});
            const mHtml = await mRes.text();
            const bMatch = mHtml.match(/url\('([^']+w1920[^']+)'\)/);
            if (bMatch) {
                console.log(`  ✅ Found TMDB banner`);
                return bMatch[1];
            }
        }
    } catch(e) {
        console.warn(`  ⚠️ TMDB search failed: ${e.message}`);
    }
    return null;
}

async function getTMDBPoster(title) {
    console.log(`  🔍 Searching TMDB for portrait poster: ${title}`);
    try {
        const res = await fetch(`https://www.themoviedb.org/search?query=${encodeURIComponent(title)}`, { headers: { "User-Agent": "Mozilla/5.0" } });
        const html = await res.text();
        const match = html.match(/href="(\/movie\/\d+[^"]*)"/);
        if (match) {
            const mRes = await fetch(`https://www.themoviedb.org${match[1]}`, { headers: { "User-Agent": "Mozilla/5.0" } });
            const mHtml = await mRes.text();
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

async function fetchImageAndUpload(url, isLandscape, title) {
    let finalUrl = null;
    let source = null;

    // FOR FEATURED FILMS (landscape): Priority is TMDB > Deluxe > Veezi
    // TMDB has 1920px banners that resize perfectly to 700px
    if (isLandscape) {
        console.log(`  🔍 [Featured] Finding best banner image for: ${title}`);
        
        // 1. Try TMDB first (1920px banners - best quality for 700px display)
        const tmdbBanner = await getTMDBBanner(title);
        if (tmdbBanner) {
            finalUrl = tmdbBanner;
            source = "TMDB (1920px)";
            console.log(`  ✅ [Featured] Using TMDB banner: ${finalUrl.substring(0, 60)}...`);
        }
        
        // 2. If TMDB fails, try Deluxe Cinemas
        if (!finalUrl) {
            const deluxePoster = await getDeluxeCinemaPoster(title);
            if (deluxePoster) {
                finalUrl = deluxePoster;
                source = "Deluxe Cinemas";
                console.log(`  ✅ [Featured] Using Deluxe poster: ${finalUrl.substring(0, 60)}...`);
            }
        }
        
        // 3. Last resort: use Veezi poster (usually small portrait, will be upscaled)
        if (!finalUrl && url && url.startsWith('http')) {
            finalUrl = url;
            source = "Veezi (fallback - may be small)";
            console.log(`  ⚠️ [Featured] Using Veezi poster (may be small/upscaled)`);
        }
    } else {
        // FOR NOW SHOWING FILMS (portrait): Priority is Deluxe Cinemas > MXfilm
        console.log(`  🔍 [Now Showing] Finding poster image for: ${title}`);

        // 1. Try Deluxe Cinemas first (NZ-specific, region-correct)
        const deluxePoster = await getDeluxeCinemaPoster(title);
        if (deluxePoster) {
            finalUrl = deluxePoster;
            source = "Deluxe Cinemas";
            console.log(`  ✅ [Now Showing] Using Deluxe poster`);
        }

        // 2. If Deluxe fails, try MXfilm
        if (!finalUrl) {
            const mxPoster = await getMXfilmPoster(title);
            if (mxPoster) {
                finalUrl = mxPoster;
                source = "MXfilm";
                console.log(`  ✅ [Now Showing] Using MXfilm poster`);
            }
        }

        // 3. If MXfilm fails, try TMDB portrait poster
        if (!finalUrl) {
            const tmdbPoster = await getTMDBPoster(title);
            if (tmdbPoster) {
                finalUrl = tmdbPoster;
                source = "TMDB portrait";
                console.log(`  ✅ [Now Showing] Using TMDB portrait poster`);
            }
        }
    }

    if (!finalUrl || !finalUrl.startsWith('http')) {
        console.log(`  ❌ All image sources failed, using fallback placeholder`);
        return FALLBACK_IMAGE;
    }

    console.log(`  📥 Downloading image from ${source}: ${finalUrl.substring(0, 50)}...`);
    let res;
    try {
        res = await fetch(finalUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!res.headers.get('content-type')?.includes('image')) {
            throw new Error('Not an image');
        }
    } catch (e) {
        console.warn(`  ⚠️ Download from ${source} failed: ${e.message}`);
        
        // Retry logic: if primary fails, try fallback sources
        let fallbackUrl = null;
        
        if (isLandscape && source !== "Veezi (fallback - may be small)" && url && url.startsWith('http')) {
            // For featured films, try Veezi as last resort
            fallbackUrl = url;
            console.log(`  🔄 [Featured] Retry with Veezi fallback...`);
        } else if (!isLandscape && source !== "TMDB portrait") {
            // For now showing, try TMDB portrait as last retry
            const tmdbRetry = await getTMDBPoster(title);
            if (tmdbRetry) {
                fallbackUrl = tmdbRetry;
                console.log(`  🔄 [Now Showing] Retry with TMDB portrait fallback...`);
            }
        }
        
        if (fallbackUrl) {
            res = await fetch(fallbackUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
            if (!res.ok) fallbackUrl = null;
        }
        
        if (!fallbackUrl) {
            console.warn(`  ❌ All image downloads failed, using fallback`);
            return FALLBACK_IMAGE;
        }
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    
    const tempIn = path.join(WORKSPACE_DIR, `temp_in_${Date.now()}.jpg`);
    const tempOut = path.join(WORKSPACE_DIR, `temp_out_${Date.now()}.jpg`);
    fs.writeFileSync(tempIn, buffer);

    try {
        if (isLandscape) {
            execSync(`convert "${tempIn}" -resize 700x "${tempOut}"`);
        } else {
            execSync(`convert "${tempIn}" -resize 160x240! "${tempOut}"`);
        }
        const resizedBuffer = fs.readFileSync(tempOut);
        const cdn = await uploadImage(resizedBuffer, path.basename(tempOut));
        fs.unlinkSync(tempIn);
        fs.unlinkSync(tempOut);
        return cdn;
    } catch (e) {
        console.warn(`  ⚠️ ImageMagick resize failed: ${e.message}, uploading original`);
        fs.unlinkSync(tempIn);
        if (tempOut && fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
        return await uploadImage(buffer, "poster.jpg");
    }
}

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

async function main() {
    console.log("\n========================================");
    console.log("🎬 BUILD CINEMA EMAIL - STARTED");
    console.log("========================================\n");

    const payloadFile = process.argv[2];
    if (!payloadFile) throw new Error("❌ Usage: node build_and_push.js <payload.json>");
    
    console.log(`📋 Loading payload: ${payloadFile}`);
    const payload = JSON.parse(fs.readFileSync(payloadFile, "utf-8"));
    console.log(`   Dates: ${payload.dates}`);
    console.log(`   Featured films: ${payload.featured_films.join(", ")}`);
    console.log(`   Now showing: ${payload.now_showing.join(", ")}`);
    if (payload.test_email) console.log(`   Test email: ${payload.test_email}`);

    console.log("\n--- STEP 1: Fetching Data ---");
    const sessions = await getVeeziSessions();
    const metadata = await getVeeziMetadata();
    
    console.log("\n--- STEP 2: Parsing Date Range ---");
    const monthMap = { "jan": 0, "feb": 1, "mar": 2, "apr": 3, "may": 4, "jun": 5, "jul": 6, "aug": 7, "sep": 8, "oct": 9, "nov": 10, "dec": 11 };
    const dateMatch = payload.dates.toLowerCase().match(/([a-z]+)\s+(\d+).*?([a-z]+)?\s+(\d+)/);
    
    let startMonth = dateMatch ? monthMap[dateMatch[1].substring(0,3)] : 2;
    let startDay = dateMatch ? parseInt(dateMatch[2]) : 25;
    let endMonth = dateMatch && dateMatch[3] ? monthMap[dateMatch[3].substring(0,3)] : startMonth;
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
    console.log(`   Template: ${templatePath}`);
    const html = fs.readFileSync(templatePath, "utf-8");
    
    let newHtmlStr = html.replace(/March \d+\s*[\u2013-]\s*March \d+/g, payload.dates);
    console.log(`   ✅ Template loaded and date range updated`);

    console.log("\n--- STEP 4: Building Film Blocks ---");

    // Auto-generate intro HTML matching the template structure
    console.log("\n   ✍️ Generating intro text...");
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

        console.log(`   🖼️ Fetching and uploading poster...`);
        let cdnUrl = await fetchImageAndUpload(meta.posterUrl, isFeatured, meta.title);

        // Fetch trailer URL - MXfilm > TMDB > Deluxe > fallback
        console.log(`   🎬 Fetching trailer link...`);
        let trailerUrl = null;

        // 1. Try MXfilm API first
        const mxTrailer = await getMXfilmTrailer(filmTitle);
        if (mxTrailer) {
            trailerUrl = mxTrailer;
            console.log(`   ✅ Found trailer from MXfilm API`);
        }

        // 2. Try TMDB for YouTube link
        if (!trailerUrl) {
            trailerUrl = await getTMDBTrailer(filmTitle);
        }

        // 3. Try Deluxe Cinemas page for embedded YouTube link
        if (!trailerUrl) {
            trailerUrl = await getDeluxeTrailer(filmTitle);
        }

        // 4. Default to Deluxe homepage if no trailer found
        if (!trailerUrl) {
            trailerUrl = "https://deluxecinemas.co.nz/";
            console.log(`   ⚠️ No trailer found, using default link`);
        }

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

        $b(`img[mc\\:edit="${tagPoster}"]`).attr('src', cdnUrl);
        
        $b(`[mc\\:edit="movie_showtimes"]`).html(showtimesHtml); 
        $b('a:contains("Book now")').attr('href', earliestUrl);
        
        // Update trailer link - handle both featured and regular film trailers
        const trailerLink = $b('a:contains("View Trailer")');
        if (trailerLink.length) {
            trailerLink.attr('href', trailerUrl);
        }
        
        // Also check for mc:edit tags for featured film trailer
        if (isFeatured) {
            $b(`[mc\\:edit="featured_film_trailer"]`).attr('href', trailerUrl);
        }
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
        updatedFeatured.push(await buildBlock(payload.featured_films[i], baseF1Block, true, i+1));
    }

    console.log("\n   📌 Building Now Showing Films...");
    let updatedNowShowing = [];
    for (let i = 0; i < payload.now_showing.length; i++) {
        updatedNowShowing.push(await buildBlock(payload.now_showing[i], baseNsBlock, false, i+1));
    }

    console.log("\n--- STEP 5: Assembling Final HTML ---");
    // Sections extracted from the template (preserve border-closing tables)
    const featuredClosingSection  = newHtmlStr.substring(closeFeaturedBorderStart, nsStart);   // "Close Featured Film card border" table
    const nowShowingHeader        = newHtmlStr.substring(nsStart, nsFilm1Start);               // "Now Showing" heading table
    const programmeClosingSection = newHtmlStr.substring(closeProgrammeBorderStart, csStart);  // "Close programme card border" table

    let finalHtml =
        newHtmlStr.substring(0, f1Start) +    // header, intro, "Featured Film" section heading
        updatedFeatured.join("") +             // built featured film blocks
        featuredClosingSection +               // bottom border of featured card
        nowShowingHeader +                     // "Now Showing" heading
        updatedNowShowing.join("") +           // built now showing film blocks
        programmeClosingSection +              // bottom border of programme card
        newHtmlStr.substring(csStart);         // coming soon + promo + footer
    
    const outputPath = path.join(WORKSPACE_DIR, "final_dynamic_campaign.html");
    fs.writeFileSync(outputPath, finalHtml);
    console.log(`   ✅ Output saved to: ${outputPath}`);

    console.log("\n--- STEP 6: Pushing to Mailchimp ---");
    const campRes = await fetch(`${MC_BASE_URL}/campaigns?status=save`, { headers: { "Authorization": `Bearer ${MC_API_KEY}` } });
    const campData = await campRes.json();
    
    if (!campData.campaigns || campData.campaigns.length === 0) {
        console.log("❌ No campaign found to push to. Please create a draft campaign in Mailchimp first.");
        return;
    }
    
    const campId = campData.campaigns[0].id;
    console.log(`   📤 Pushing HTML to campaign ${campId}...`);
    
    await fetch(`${MC_BASE_URL}/campaigns/${campId}/content`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${MC_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ html: finalHtml })
    });
    console.log(`   ✅ Campaign content updated`);

    if (payload.test_email) {
        console.log(`   📧 Sending test email to: ${payload.test_email}`);
        const testRes = await fetch(`${MC_BASE_URL}/campaigns/${campId}/actions/test`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${MC_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ test_emails: [payload.test_email], send_type: "html" })
        });
        if (testRes.ok) {
            console.log(`   ✅ Test email sent successfully!`);
        } else {
            console.log(`   ❌ Failed to send test email: ${testRes.status}`);
        }
    } else {
        console.log(`   ℹ️ No test_email in payload - skipping test send`);
    }

    console.log("\n========================================");
    console.log("🎉 BUILD CINEMA EMAIL - COMPLETED!");
    console.log("========================================\n");
}
main().catch(err => {
    console.error("\n❌ ERROR:", err.message);
    process.exit(1);
});