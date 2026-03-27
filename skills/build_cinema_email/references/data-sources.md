# Data Sources

This document explains where the script fetches data for the cinema email campaign.

## Data Flow Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Payload JSON   │────▶│  build_and_push  │────▶│  Mailchimp      │
│  (user input)   │     │  .js script      │     │  Campaign       │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐      ┌─────────────────┐      ┌───────────────┐
│   Veezi       │      │ Deluxe Cinemas   │      │    TMDB       │
│   Sessions    │      │   Website        │      │   (fallback)  │
│   API         │      │   (fallback)    │      │               │
└───────────────┘      └─────────────────┘      └───────────────┘
     - Showtimes        - Posters              - Original res posters
     - Session URLs     - Film info            - Hero images
     - Start dates                               - Trailers
```

---

## 1. Veezi Sessions API (Primary)

**URL:** `https://ticketing.oz.veezi.com/sessions/?siteToken=wpge11hbvd3zadj20jkc0y36ym`

**What it provides:**
- All upcoming session times
- Session start dates/times
- Direct booking URLs
- Film names

**Data extracted:**
```javascript
// JSON-LD format embedded in HTML
[
  {
    "@type": "VisualArtsEvent",
    "name": "I Swear",
    "startDate": "2026-03-26T19:00:00",
    "url": "https://ticketing.oz.veezi.com/session/12345"
  },
  ...
]
```

**Used for:**
- Filtering sessions by date range
- Generating showtime links in email
- Matching film titles to payload

---

## 2. Veezi Metadata Scraping (Primary)

**URL:** Same as sessions API

**What it provides:**
- Film titles
- Posters (portrait)
- Ratings/Censors (G, PG, M, R16)
- Synopses

**How it works:**
```javascript
const $ = cheerio.load(html);

// Find all film titles
$('h3.title').each((i, el) => {
    const title = $(el).text().trim();
    const container = $(el).closest('div');
    
    // Get poster from sibling/parent element
    const posterUrl = container.prevAll('.poster-container').first()
        .find('img.poster').attr('src');
    
    // Get rating
    const rating = container.find('.censor').text().trim();
    
    // Get synopsis
    const synopsis = container.find('.film-desc').text().trim();
});
```

**Used for:**
- Populating `mc:edit` tags in template
- Fallback data when film not found

---

## 3. Deluxe Cinemas Website (First Fallback)

**URL:** `https://www.deluxecinemas.co.nz/`

**What it provides:**
- Film posters from homepage
- Film detail pages with larger images

**How it works:**
```javascript
async function getDeluxeCinemaPoster(title) {
    // 1. Fetch homepage
    const res = await fetch('https://www.deluxecinemas.co.nz/');
    const html = await res.text();
    
    // 2. Find film link
    const filmLink = $(`a:contains("${title}")`).first();
    
    // 3. If found, visit film page
    if (filmLink.length) {
        const filmPage = await fetch(filmLink.attr('href'));
        // 4. Extract poster
        const poster = $f('.film-poster img').attr('src');
    }
}
```

**Used for:**
- Fallback poster when Veezi has no poster
- Higher quality images when available
- **Trailer extraction** - Use Playwright to scrape YouTube embeds from film pages

---

## 4. TMDB (Second Fallback) - HIGH RESOLUTION POSTERS

**URL:** `https://www.themoviedb.org/search?query={title}`

**What it provides:**
- **Original resolution posters** (not cropped banners)
- For featured films - use portrait orientation at full resolution

### How to get original resolution posters:

```javascript
// 1. Search TMDB for movie
const searchRes = await fetch('https://www.themoviedb.org/search?query=I+Swear');
const html = await searchRes.text();
const $ = cheerio.load(html);

// 2. Find movie link
const movieLink = $('a[href^="/movie/"]').first().attr('href');

// 3. Use Playwright to navigate to movie page (JS-rendered)
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://www.themoviedb.org' + movieLink);

// 4. Get poster image ID and construct original URL
// Image ID: vUwyhNWBKkSwK8ELvEeBRwV724h.jpg
// Original URL: https://image.tmdb.org/t/p/original/vUwyhNWBKkSwK8ELvEeBRwV724h.jpg
```

**Image URL patterns:**
| Size | URL Pattern |
|------|-------------|
| w185 | `https://image.tmdb.org/t/p/w185/{id}.jpg` |
| w342 | `https://image.tmdb.org/t/p/w342/{id}.jpg` |
| w500 | `https://image.tmdb.org/t/p/w500/{id}.jpg` |
| **original** | `https://image.tmdb.org/t/p/original/{id}.jpg` ✅ |

**Important:** Use `image.tmdb.org` (not `media.themoviedb.org`) for original resolution.

**Used for:**
- Featured film poster images (portrait, full resolution)
- When Veezi and Deluxe fail

---

## 5. Fallback Placeholder (Last Resort)

**Image URL:** `https://mcusercontent.com/983aaba19411e46e8ff025752/images/492a95d6-c361-ee10-b412-3d0fcb753d18.jpg`

**Used when:**
- All image sources fail
- No internet connection
- Invalid image URLs

---

## Image Size Requirements

| Section | Dimensions | Aspect Ratio |
|---------|------------|--------------|
| Featured Film | 600px wide (resized from original) | ~2:3 (portrait) |
| Now Showing | 160x240px | 2:3 (portrait) |
| Header | 600px wide | ~1.5:1 |
| Promo | 200x130px | 1.5:1 |

The script uses **ImageMagick** to resize images:
```bash
# Featured films (portrait, maintain aspect)
convert input.jpg -resize 600x output.jpg

# Now showing (portrait, exact dimensions)
convert input.jpg -resize 160x240! output.jpg
```

---

## Mailchimp CDN

All images are uploaded to Mailchimp's file manager before being inserted into the HTML:

**Upload endpoint:** `https://gateway.maton.ai/mailchimp/3.0/file-manager/files`

**Process:**
1. Convert image to base64
2. POST to Mailchimp API
3. Get back `full_size_url` (CDN URL)
4. Replace image URL in HTML with CDN URL

---

## Error Handling by Source

| Source | Failure | Fallback |
|--------|---------|----------|
| Veezi Sessions | No sessions in date range | Show "Check website for times." |
| Veezi Metadata | Film not found | Use title as-is, rating "TBC", generic synopsis |
| Veezi Poster | No poster URL | Try Deluxe Cinemas |
| Deluxe Cinemas | Scrape fails | Try TMDB |
| TMDB | Search fails | Use placeholder image |
| ImageMagick | Resize fails | Upload original size |
| Mailchimp API | Upload fails | Use original URL (will show broken image) |