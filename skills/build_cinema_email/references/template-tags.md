# Template Tags Reference

This document maps all Mailchimp `mc:edit` tags used in the cinema email template (`cinema-email-master-template-2.html`).

## Tag Naming Convention

| Prefix | Section | Example |
|--------|---------|---------|
| `preheader_` | Preheader area | `preheader_text` |
| `header_` | Header section | `header_image` |
| `intro_text_` | Intro paragraph | `intro_text_top` |
| `featured_film_*` | Featured film block (2) | `featured_film_title`, `featured_film_image` |
| `movie_*` | Now Showing film block | `movie_title`, `movie_poster` |
| `now_showing_` | Now Showing section | `now_showing_heading` |
| `coming_soon_*` | Coming Soon section | `coming_soon_three_poster_1` |
| `promo_*` | Promo/Event section | `promo_title`, `promo_image` |
| `footer_` | Footer section | `footer_map` |

---

## 1. Preheader Section

| Tag | Type | Description | Example |
|-----|------|-------------|---------|
| `preheader_text` | text | Hidden preview text shown in email clients | "Your weekly update from Deluxe Cinemas — new releases, special events and session times." |

---

## 2. Header Section

| Tag | Type | Description | Example |
|-----|------|-------------|---------|
| `header_image` | image | Logo/banner image (600x auto height) | Deluxe Cinemas logo |

---

## 3. Intro Text Section

| Tag | Type | Description | Example |
|-----|------|-------------|---------|
| `intro_text_top` | HTML | Opening paragraph with film highlights | "Dear valued cinema-goer. Here's what's new..." |

---

## 4. Featured Film Section (2 films)

Each featured film block has these tags:

| Tag | Type | Description | Size/Format |
|-----|------|-------------|--------------|
| `featured_film_link` | link | Clickable poster link | deluxecinemas.co.nz/film-name |
| `featured_film_image` | image | Hero banner poster | 600x260 landscape |
| `featured_film_title` | text | Movie title | "I Swear" |
| `featured_film_tagline` | text | Short tagline/first sentence of synopsis | "A moving true story..." |
| `featured_film_rating` | text | Rating (G, PG, M, R16) | "PG" |
| `featured_film_description` | HTML | Full synopsis (remainder after tagline) | "Courage and resilience..." |
| `featured_film_trailer` | link | View Trailer button | deluxecinemas.co.nz/film-name |
| `featured_film_book` | link | Book Now button | deluxecinemas.co.nz/film-name |

**Block identifiers:**
- Featured Film 1: `featured_film_one`, `FEATURED FILM ONE`
- Featured Film 2: `featured_film_two`, `FEATURED FILM TWO`

---

## 5. Now Showing Section

Section tag:
| Tag | Type | Description |
|-----|------|-------------|
| `now_showing_heading` | image | "Now Showing" section header |

Each movie block has these tags (repeatable):

| Tag | Type | Description | Size/Format |
|-----|------|-------------|--------------|
| `movie_link` | link | Poster clickable link | deluxecinemas.co.nz/film-name |
| `movie_poster` | image | Movie poster | 160x240 portrait |
| `movie_title` | text | Movie title | "Tenor" |
| `movie_tagline` | text | Short tagline | "The inspiring rise..." |
| `movie_rating` | text | Rating | "G", "PG", "M" |
| `movie_description` | HTML | First part of synopsis | "Wallflower Colin..." |
| `movie_description_2` | HTML | Second part of synopsis | "As Colin submits..." |
| `movie_description_3` | HTML | Third part of synopsis | "Hilarious, subversive..." |
| `movie_showtimes` | HTML | Session times with links | "Mon 26, 7:00PM \| Tue 27, 7:00PM" |
| `movie_trailer` | link | View Trailer button |
| `movie_cta` | link | Book Now button |

**Block numbering:**
- `NOW SHOWING FILM 1`, `movie_1`
- `NOW SHOWING FILM 2`, `movie_2`
- ...and so on

---

## 6. Coming Soon Section

Section tag:
| Tag | Type | Description |
|-----|------|-------------|
| `coming_soon_heading` | image | "Coming Soon" section header |

Layout variants (3 different row styles):

**Three-column row:**
| Tag | Description |
|-----|-------------|
| `coming_soon_three_poster_1` | Left poster |
| `coming_soon_three_desc_1` | Left description |
| `coming_soon_three_cta_1` | Left CTA button |
| `coming_soon_three_poster_2` | Center poster |
| `coming_soon_three_desc_2` | Center description |
| `coming_soon_three_cta_2` | Center CTA button |
| `coming_soon_three_poster_3` | Right poster |
| `coming_soon_three_desc_3` | Right description |
| `coming_soon_three_cta_3` | Right CTA button |

**Two-column row:**
| Tag | Description |
|-----|-------------|
| `coming_soon_two_poster_1` | Left poster |
| `coming_soon_two_desc_1` | Left description |
| `coming_soon_two_cta_1` | Left CTA button |
| `coming_soon_two_poster_2` | Right poster |
| `coming_soon_two_desc_2` | Right description |
| `coming_soon_two_cta_2` | Right CTA button |

**One-column row:**
| Tag | Description |
|-----|-------------|
| `coming_soon_one_poster_1` | Centered poster |
| `coming_soon_one_desc_1` | Centered description |
| `coming_soon_one_cta_1` | Centered CTA button |

---

## 7. Promo/Event Section

| Tag | Type | Description | Size/Format |
|-----|------|-------------|--------------|
| `promo_link` | link | Promo image link |
| `promo_image` | image | Promo/banner image | 200x130 |
| `promo_title` | text | Event title | "Membership Special" |
| `promo_text` | text | Event description | "Get 20% off..." |
| `promo_cta` | link | CTA button | "Learn more" |

---

## 8. Footer Section

| Tag | Type | Description | Size/Format |
|-----|------|-------------|--------------|
| `footer_map` | image | Location map image | 600x220 |

---

## How Script Uses These Tags

The `build_and_push.js` script:

1. **Loads** `cinema-email-master-template-2.html` as the base template
2. **Fetches** film metadata from Veezi (poster, rating, synopsis)
3. **Injects** data into `mc:edit` tags using Cheerio:
   ```javascript
   $b('[mc\\:edit="featured_film_title"]').text(meta.title);
   $b('img[mc\\:edit="featured_film_image"]').attr('src', cdnUrl);
   ```
4. **Updates** date range in intro text
5. **Uploads** images to Mailchimp CDN and replaces URLs
6. **Pushes** final HTML to Mailchimp campaign

---

## File Locations

| File | Description |
|------|-------------|
| Template: `cinema-email-master-template-2.html` | Source HTML with mc:edit tags |
| Script: `scripts/build_and_push.js` | Node.js script that processes template |
| Output: `final_dynamic_campaign.html` | Generated HTML ready for Mailchimp |