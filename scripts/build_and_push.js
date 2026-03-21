const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { execSync } = require('child_process');

const MC_API_KEY = process.env.MATON_API_KEY || "ZdNbP1Xb6_t3Tp5gJB6oL96eZj-mgkcqTE37vDE4ie8JgfqpPEkmxCT6GAyjzNBNIZZUHHL3OH4QmEuN9tv-rm83SPRv08SfUyIQYkzV4g";
const MC_BASE_URL = "https://gateway.maton.ai/mailchimp/3.0";
const WORKSPACE_DIR = path.resolve(__dirname, "../");

async function uploadImage(buffer, filename) {
    console.log(`Uploading ${filename} to Mailchimp...`);
    const content = buffer.toString('base64');
    const res = await fetch(`${MC_BASE_URL}/file-manager/files`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${MC_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: `auto_${Date.now()}_${filename}`, file_data: content })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Upload failed for ${filename}: ${JSON.stringify(data)}`);
    return data.full_size_url;
}

async function getTMDBBanner(title) {
    console.log(`Searching TMDB for high-res banner: ${title}`);
    try {
        const res = await fetch(`https://www.themoviedb.org/search?query=${encodeURIComponent(title)}`, { headers: { "User-Agent": "Mozilla/5.0" } });
        const html = await res.text();
        const match = html.match(/href="(\/movie\/\d+[^"]*)"/);
        if (match) {
            const mRes = await fetch(`https://www.themoviedb.org${match[1]}`, { headers: { "User-Agent": "Mozilla/5.0" }});
            const mHtml = await mRes.text();
            const bMatch = mHtml.match(/url\('([^']+w1920[^']+)'\)/);
            if (bMatch) return bMatch[1];
        }
    } catch(e) {}
    return null;
}

async function fetchImageAndUpload(url, isLandscape, title) {
    let finalUrl = url;
    if (isLandscape) {
        // Fetch high res banner to prevent distortion
        const tmdbBanner = await getTMDBBanner(title);
        if (tmdbBanner) finalUrl = tmdbBanner;
    }

    if (!finalUrl || !finalUrl.startsWith('http')) return "https://mcusercontent.com/983aaba19411e46e8ff025752/images/492a95d6-c361-ee10-b412-3d0fcb753d18.jpg"; 
    
    console.log(`Downloading image: ${finalUrl}`);
    const res = await fetch(finalUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
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
        console.warn("Resize failed, uploading original:", e.message);
        fs.unlinkSync(tempIn);
        return await uploadImage(buffer, "poster.jpg");
    }
}

async function getVeeziSessions() {
    const res = await fetch("https://ticketing.oz.veezi.com/sessions/?siteToken=wpge11hbvd3zadj20jkc0y36ym");
    const html = await res.text();
    const match = html.match(/\[{"@type":"VisualArtsEvent".*?\}\]/);
    if (!match) throw new Error("Could not find Veezi JSON-LD");
    return JSON.parse(match[0]);
}

async function getVeeziMetadata() {
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
    const payloadFile = process.argv[2];
    if (!payloadFile) throw new Error("Usage: node build_and_push.js <payload.json>");
    const payload = JSON.parse(fs.readFileSync(payloadFile, "utf-8"));

    const sessions = await getVeeziSessions();
    const metadata = await getVeeziMetadata();
    
    // Fix Bug 1: Robust Date Parsing
    const monthMap = { "jan": 0, "feb": 1, "mar": 2, "apr": 3, "may": 4, "jun": 5, "jul": 6, "aug": 7, "sep": 8, "oct": 9, "nov": 10, "dec": 11 };
    const dateMatch = payload.dates.toLowerCase().match(/([a-z]+)\s+(\d+).*?([a-z]+)?\s+(\d+)/);
    
    let startMonth = dateMatch ? monthMap[dateMatch[1].substring(0,3)] : 2;
    let startDay = dateMatch ? parseInt(dateMatch[2]) : 25;
    let endMonth = dateMatch && dateMatch[3] ? monthMap[dateMatch[3].substring(0,3)] : startMonth;
    let endDay = dateMatch ? parseInt(dateMatch[4]) : 29;

    const targetStart = new Date(Date.UTC(2026, startMonth, startDay, 0, 0, 0));
    const targetEnd = new Date(Date.UTC(2026, endMonth, endDay, 23, 59, 59));

    const targetSessions = sessions.filter(s => {
        const d = new Date(s.startDate);
        return d >= targetStart && d <= targetEnd;
    });

    const templatePath = path.join(WORKSPACE_DIR, "goal-example", "goal-example.html");
    const html = fs.readFileSync(templatePath, "utf-8");
    
    let newHtmlStr = html.replace(/March \d+\s*[\u2013-]\s*March \d+/g, payload.dates);

    const f1Start = newHtmlStr.indexOf("<!-- FEATURED FILM ONE");
    const f2Start = newHtmlStr.indexOf("<!-- FEATURED FILM TWO");
    const nsStart = newHtmlStr.indexOf("<!-- ========== 4. NOW SHOWING"); 
    const csStart = newHtmlStr.indexOf("<!-- ========== 5. COMING SOON");
    
    const baseF1Block = newHtmlStr.substring(f1Start, f2Start);
    const nsContent = newHtmlStr.substring(newHtmlStr.indexOf("<!-- NOW SHOWING FILM 1"), csStart);
    const nsBlocks = nsContent.split(/(?=<!-- NOW SHOWING FILM \d+)/).filter(b => b.trim().length > 0);
    const baseNsBlock = nsBlocks[0]; 

    async function buildBlock(filmTitle, baseTemplate, isFeatured, index) {
        const vKey = Object.keys(metadata).find(k => k.toLowerCase().includes(filmTitle.toLowerCase()) || filmTitle.toLowerCase().includes(k.toLowerCase()));
        const meta = vKey ? metadata[vKey] : { title: filmTitle, rating: "TBC", synopsis: filmTitle + " is showing at Deluxe Cinemas.", posterUrl: null };
        
        let mSessions = targetSessions.filter(s => s.name.toLowerCase().includes(filmTitle.toLowerCase()) || filmTitle.toLowerCase().includes(s.name.toLowerCase()));
        mSessions.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
        
        let showtimesHtml = mSessions.map(s => `<a href="${s.url}" target="_blank" style="color: #6b6b6b; text-decoration: none; font-weight: bold;">${formatDate(s.startDate)}</a>`).join(" | ");
        if (showtimesHtml === "") showtimesHtml = "Check website for times.";
        const earliestUrl = mSessions.length > 0 ? mSessions[0].url : "https://deluxecinemas.co.nz/";

        // Fix Bug 2: Fetch TMDB High Res Banners for Featured Films
        let cdnUrl = await fetchImageAndUpload(meta.posterUrl, isFeatured, meta.title);

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
        
        $b(`img[mc\\:edit="${tagPoster}"]`).attr('src', cdnUrl);
        
        $b(`[mc\\:edit="movie_showtimes"]`).html(showtimesHtml); 
        $b('a:contains("Book now")').attr('href', earliestUrl);
        $b('a:contains("View Trailer")').attr('href', "https://deluxecinemas.co.nz/");
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
        
        return finalHtml;
    }

    console.log("Building Featured Films...");
    let updatedFeatured = [];
    for (let i = 0; i < payload.featured_films.length; i++) {
        updatedFeatured.push(await buildBlock(payload.featured_films[i], baseF1Block, true, i+1));
    }

    console.log("Building Now Showing Films...");
    let updatedNowShowing = [];
    for (let i = 0; i < payload.now_showing.length; i++) {
        updatedNowShowing.push(await buildBlock(payload.now_showing[i], baseNsBlock, false, i+1));
    }

    let newNsContent = newHtmlStr.substring(nsStart, newHtmlStr.indexOf("<!-- NOW SHOWING FILM 1")) + updatedNowShowing.join("");
    let finalHtml = newHtmlStr.substring(0, f1Start) + updatedFeatured.join("") + newNsContent + newHtmlStr.substring(csStart);
    
    fs.writeFileSync(path.join(WORKSPACE_DIR, "final_dynamic_campaign.html"), finalHtml);
    console.log("Successfully rebuilt final_dynamic_campaign.html");
    
    const campRes = await fetch(`${MC_BASE_URL}/campaigns?status=save`, { headers: { "Authorization": `Bearer ${MC_API_KEY}` } });
    const campData = await campRes.json();
    if (campData.campaigns && campData.campaigns.length > 0) {
        const campId = campData.campaigns[0].id;
        await fetch(`${MC_BASE_URL}/campaigns/${campId}/content`, {
            method: "PUT",
            headers: { "Authorization": `Bearer ${MC_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ html: finalHtml })
        });
        
        const testRes = await fetch(`${MC_BASE_URL}/campaigns/${campId}/actions/test`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${MC_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ test_emails: [payload.test_email], send_type: "html" })
        });
        console.log("Test email sent!", testRes.status);
    }
}
main().catch(console.error);
