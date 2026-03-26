const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { execSync } = require('child_process');

const MC_API_KEY = process.env.MATON_API_KEY;
if (!MC_API_KEY) {
    console.error("❌ FATAL: MATON_API_KEY environment variable is required.");
    console.error("   OpenClaw should have this configured in environment.");
    process.exit(1);
}
const MC_BASE_URL = "https://gateway.maton.ai/mailchimp/3.0";
const WORKSPACE_DIR = path.resolve(__dirname, "../..");

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
                const $f = cheerio.load(filmHtml);
                
                // First try: Look for explicit "Watch Trailer" button/link
                let trailerLink = $f('a:contains("WATCH TRAILER"), a:contains("Watch Trailer"), a:contains("Trailer")').first();
                if (trailerLink.length) {
                    const trailerHref = trailerLink.attr('href');
                    if (trailerHref) {
                        // Check if it's a YouTube link
                        if (trailerHref.includes('youtube.com') || trailerHref.includes('youtu.be')) {
                            console.log(`  ✅ Found YouTube trailer link on Deluxe Cinemas`);
                            return trailerHref.startsWith('http') ? trailerHref : `https://www.deluxecinemas.co.nz${trailerHref}`;
                        }
                        console.log(`  ✅ Found trailer on Deluxe Cinemas`);
                        return trailerHref.startsWith('http') ? trailerHref : `https://www.deluxecinemas.co.nz${trailerHref}`;
                    }
                }
                
                // Second try: Look for YouTube embeds in the page
                const youtubeEmbed = $f('iframe[src*="youtube"], iframe[src*="youtu.be"]').first();
                if (youtubeEmbed.length) {
                    const src = youtubeEmbed.attr('src');
                    if (src) {
                        // Convert embed URL to watch URL
                        let youtubeUrl = src;
                        if (src.includes('embed/')) {
                            const videoId = src.split('embed/')[1]?.split('?')[0];
                            if (videoId) {
                                youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
                            }
                        }
                        console.log(`  ✅ Found YouTube embed on Deluxe Cinemas`);
                        return youtubeUrl;
                    }
                }
                
                // Third try: Look for any YouTube links in the page
                const anyYoutubeLink = $f('a[href*="youtube.com/watch"], a[href*="youtu.be/"]').first();
                if (anyYoutubeLink.length) {
                    console.log(`  ✅ Found YouTube link on Deluxe Cinemas page`);
                    return anyYoutubeLink.attr('href');
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

async function getDeluxeCinemaPoster(title) {
    console.log(`  🔍 Searching deluxecinemas.co.nz for poster: ${title}`);
    try {
        const res = await fetch(`https://www.deluxecinemas.co.nz/`, { 
            headers: { "User-Agent": "Mozilla/5.0" } 
        });
        const html = await res.text();
        const $ = cheerio.load(html);
        
        const filmLink = $(`a:contains("${title}")`).first();
        if (filmLink.length) {
            const href = filmLink.attr('href');
            if (href) {
                const filmRes = await fetch(`https://www.deluxecinemas.co.nz${href}`, { 
                    headers: { "User-Agent": "Mozilla/5.0" } 
                });
                const filmHtml = await filmRes.text();
                const $f = cheerio.load(filmHtml);
                
                const poster = $f('.film-poster img, .poster img, img[alt*="poster"]').first();
                const posterSrc = poster.attr('src') || poster.attr('data-src');
                if (posterSrc) {
                    const fullUrl = posterSrc.startsWith('http') ? posterSrc : `https://www.deluxecinemas.co.nz${posterSrc}`;
                    console.log(`  ✅ Found poster on Deluxe Cinemas: ${fullUrl}`);
                    return fullUrl;
                }
            }
        }
    } catch(e) {
        console.warn(`  ⚠️ Failed to fetch from Deluxe Cinemas: ${e.message}`);
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
        // FOR NOW SHOWING FILMS (portrait): Priority is MXfilm > Deluxe > Veezi
        console.log(`  🔍 [Now Showing] Finding poster image for: ${title}`);
        
        // 1. Try MXfilm first (highest quality posters - typically 800px+)
        const mxPoster = await getMXfilmPoster(title);
        if (mxPoster) {
            finalUrl = mxPoster;
            source = "MXfilm (highest quality)";
            console.log(`  ✅ [Now Showing] Using MXfilm poster`);
        }
        
        // 2. If MXfilm fails, try Deluxe Cinemas
        if (!finalUrl) {
            const deluxePoster = await getDeluxeCinemaPoster(title);
            if (deluxePoster) {
                finalUrl = deluxePoster;
                source = "Deluxe Cinemas";
                console.log(`  ✅ [Now Showing] Using Deluxe poster`);
            }
        }
        
        // 3. Last resort: use Veezi poster
        if (!finalUrl && url && url.startsWith('http')) {
            finalUrl = url;
            source = "Veezi (fallback)";
            console.log(`  ⚠️ [Now Showing] Using Veezi poster (fallback)`);
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
        } else if (!isLandscape && source !== "Veezi") {
            // For now showing, try Veezi as fallback
            if (url && url.startsWith('http')) {
                fallbackUrl = url;
                console.log(`  🔄 [Now Showing] Retry with Veezi fallback...`);
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

    // Check for payload file from OpenClaw
    const payloadFile = process.argv[2];
    if (!payloadFile) throw new Error("❌ Usage: node build_campaign.js <payload.json>");
    
    console.log(`📋 Loading payload: ${payloadFile}`);
    const payload = JSON.parse(fs.readFileSync(payloadFile, "utf-8"));
    console.log(`   Dates: ${payload.dates}`);
    console.log(`   Featured films: ${payload.featured_films.join(", ")}`);
    console.log(`   Now showing: ${payload.now_showing.join(", ")}`);
    const isTestMode = !payload.test_email;

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

    const f1Start = newHtmlStr.indexOf("<!-- ========== 3. FEATURED FILMS");
    const f2Start = newHtmlStr.indexOf("<!-- FEATURED FILM ONE");
    const f2End = newHtmlStr.indexOf("<!-- ========== 4. NOW SHOWING");
    const nsStart = newHtmlStr.indexOf("<!-- ========== 4. NOW SHOWING"); 
    const csStart = newHtmlStr.indexOf("<!-- ========== 5. COMING SOON");
    
    // Extract entire FEATURED FILMS section (header + all blocks)
    const featuredHeader = newHtmlStr.substring(f1Start, f2Start); // Header only
    const baseFeaturedBlock = newHtmlStr.substring(f2Start, f2End); // First block template
    const nsContent = newHtmlStr.substring(newHtmlStr.indexOf("<!-- NOW SHOWING FILM 1"), csStart);
    const nsBlocks = nsContent.split(/(?=<!-- NOW SHOWING FILM \d+)/).filter(b => b.trim().length > 0);
    const baseNsBlock = nsBlocks[0]; 

    console.log("\n--- STEP 4: Building Film Blocks ---");

    // Auto-generate intro text with featured film highlights
    console.log("\n   ✍️ Generating intro text with featured film highlights...");
    let introText = "";
    if (payload.featured_films && payload.featured_films.length > 0) {
        const filmNames = payload.featured_films.map(f => {
            // Try to get proper title from metadata
            const vKey = Object.keys(metadata).find(k => 
                k.toLowerCase().includes(f.toLowerCase()) || 
                f.toLowerCase().includes(k.toLowerCase())
            );
            return vKey || f;
        });
        
        if (filmNames.length === 1) {
            introText = `This week, we're excited to feature "${filmNames[0]}" - don't miss this amazing film on the big screen!`;
        } else if (filmNames.length === 2) {
            introText = `This week, we're excited to feature "${filmNames[0]}" and "${filmNames[1]}" - two incredible films you won't want to miss!`;
        } else {
            introText = `This week, we're excited to feature ${filmNames.slice(0, -1).map(f => `"${f}"`).join(", ")} and "${filmNames[filmNames.length - 1]}" - amazing films you won't want to miss!`;
        }
        console.log(`   ✅ Generated intro: "${introText.substring(0, 60)}..."`);
    }
    
    // Replace intro_text_top in the HTML
    const introEditPattern = /mc:edit="intro_text_top"/;
    if (introEditPattern.test(newHtmlStr)) {
        const $intro = cheerio.load(newHtmlStr, null, false);
        $intro('[mc\\:edit="intro_text_top"]').text(introText);
        newHtmlStr = $intro.html();
        console.log(`   ✅ Intro text updated in template`);
    } else {
        console.log(`   ⚠️ intro_text_top tag not found in template`);
    }

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

        // Fetch trailer URL - MXfilm first, fallback to Deluxe
        console.log(`   🎬 Fetching trailer link...`);
        let trailerUrl = null;
        
        // 1. Try MXfilm API first
        const mxTrailer = await getMXfilmTrailer(filmTitle);
        if (mxTrailer) {
            trailerUrl = mxTrailer;
            console.log(`   ✅ Found trailer from MXfilm API`);
        }
        
        // 2. Fallback to Deluxe Cinemas if MXfilm fails
        if (!trailerUrl) {
            trailerUrl = await getDeluxeTrailer(filmTitle);
            if (trailerUrl) {
                console.log(`   ✅ Found trailer from Deluxe Cinemas`);
            }
        }
        
        // 3. Default to Deluxe homepage if no trailer found
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
        
        // Clear any extra description fields in the template to prevent duplicate content
        $b(`[mc\\:edit="movie_description_2"]`).remove();
        $b(`[mc\\:edit="movie_description_3"]`).remove();
        $b(`[mc\\:edit="featured_film_description_2"]`).remove();
        $b(`[mc\\:edit="featured_film_description_3"]`).remove();
        
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
        updatedFeatured.push(await buildBlock(payload.featured_films[i], baseFeaturedBlock, true, i+1));
    }
    // Prepend header to the first featured block
    if (updatedFeatured.length > 0) {
        updatedFeatured[0] = featuredHeader + updatedFeatured[0];
    }

    console.log("\n   📌 Building Now Showing Films...");
    let updatedNowShowing = [];
    for (let i = 0; i < payload.now_showing.length; i++) {
        updatedNowShowing.push(await buildBlock(payload.now_showing[i], baseNsBlock, false, i+1));
    }

    console.log("\n--- STEP 5: Assembling Final HTML ---");
    let newNsContent = newHtmlStr.substring(nsStart, newHtmlStr.indexOf("<!-- NOW SHOWING FILM 1")) + updatedNowShowing.join("");
    let finalHtml = newHtmlStr.substring(0, f1Start) + updatedFeatured.join("") + newNsContent + newHtmlStr.substring(csStart);
    
    const outputPath = path.join(WORKSPACE_DIR, "final_dynamic_campaign.html");
    fs.writeFileSync(outputPath, finalHtml);
    console.log(`   ✅ Output saved to: ${outputPath}`);

    // If test mode (no test_email), just report the path and exit
    if (isTestMode) {
        console.log("\n========================================");
        console.log("🎉 BUILD CINEMA EMAIL - COMPLETED (TEST MODE)");
        console.log("========================================");
        console.log(`\n📄 HTML file saved at: ${outputPath}\n`);
        return;
    }

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