---
name: Build Cinema Email
description: A skill to build or update the cinema email using the master template and specific section names.
requires:
  bins:
    - curl
    - magick
    - node
---

# Build Cinema Email Skill

**Overview:**
This skill guides you to build or update the **cinema email**. You MUST reference **BOTH** the **User's Goal Prompt** (which provides the execution context, dates, and specific films to include) **AND** the **Master Template** (`cinema-email-master-template-2.html`). You need to use the goal prompt to understand *what* content is required, and the master template to understand *where* and *how* to fill it in to reach the goal. Additionally, you MUST refer to the **benchmark expected result** located at `goal-example/goal-example.html` to understand exactly how the final HTML output should be formatted based on the prompt's film list and dates.

**Important rules:**

- **WORKFLOW_MODE**: Currently set to **`testing`**.
  - **`testing`**: create draft only, send test email to **tester only**.
  - **`production`**: create draft, prepare for final list (but still do not send without final user confirmation).
- **HTML Truth Source**: Follow **exactly** matching **AGENT_MAILER_PROMPT_TEMPLATE.md**.
- **Preservation**: USE THE MASTER TEMPLATE (`cinema-email-master-template-2.html`). **DO NOT delete or overwrite anything** outside of the `mc:edit` regions.
- **Header Preservation**: The **Header image (`header.jpg`)** and its link (`https://deluxecinemas.co.nz/`) MUST be kept. Do not remove the header section.
- **Section GIF Headers**:
  - **Now Showing Section**: MUST use `now-showing.gif` (mc:edit="now_showing_heading").
  - **Coming Soon Section**: MUST use `coming-soon.gif` (mc:edit="coming_soon_heading").
  - DO NOT use plain text for these headers.
- **Core Flow Source**: Use the **Veezi -> MovieXchange -> Mailchimp** pipeline.
- **Highlight(bold) important text** in your reasoning.

### CRITICAL BUG-FIX RULES (MUST FOLLOW)

- **NO TEXT TRUNCATION (EVER)**:
  - **NEVER** append `...` to any text content (taglines, descriptions, synopses, or any other field).
  - The `featured_film_tagline` and `movie_tagline` fields MUST contain the **FULL** tagline text from MovieXchange.
  - The `featured_film_description` and `movie_description` fields MUST contain the **FULL** synopsis/description text.
  - If the tagline is long, show it in full. Do NOT cut it off.
  - If no tagline is found on MX, use the first sentence of the synopsis as the tagline, but show the **full** first sentence.

- **TRAILER LINKS (MANDATORY YOUTUBE URLs)**:
  - The `featured_film_trailer` and `movie_trailer` `href` MUST be a valid **YouTube URL** (e.g., `https://www.youtube.com/watch?v=XXXX`).
  - **NEVER** set `href="None"` or leave it empty. This breaks the button.
  - If no YouTube trailer is found on MovieXchange for a film, **fall back** to `https://deluxecinemas.co.nz/` as the trailer link.
  - **HOW TO FIND THE TRAILER ON MX**: MovieXchange uses Angular (`ng-star-inserted`). You MUST use a headless browser script (like Puppeteer via Node.js) to load the page and wait for the DOM to render. To find the trailer link, locate the `<button>` containing the text 'Watch Trailer' and a `pi-youtube` icon. You will need to extract the underlying bound YouTube URL. Do NOT attempt to static-fetch the HTML.

- **IMAGE HOSTING & RESIZING (CRITICAL)**:
  - You MUST download the actual official movie posters and banners.
  - To get the Featured Film image, navigate to the **Media** tab of the film's profile (MX Film) and locate the official **Landscape/Banner** image.
  - To get the Now Showing/Coming Soon image, navigate to the **Media** tab and locate the official **Poster** image.
  - If MX Film blocks your headless browser, **fallback** to scraping `https://www.deluxecinemas.co.nz/movie/[film-name]` to find the official CDN image (e.g., `img.vwassets.com`).
  - **Resizing Constraint**: Once downloaded, you MUST resize it locally using `magick` retaining the aspect ratio (`convert image.jpg -resize 700x output.jpg` for Featured Films, and `convert image.jpg -resize 160x240! output.jpg` for Now Showing).
  - **Mailchimp Upload**: You CANNOT inject local file paths (like `hero.jpg`) or external TMDB links into the HTML. You MUST upload the perfectly-resized image to the **Mailchimp File Manager** via the API, retrieve the absolute public `mcusercontent.com` URL, and inject *that URL* into the `mc:edit` `src` tag.

- **VEEZI BOOK NOW LINKS**:
  - The `featured_film_book` and `movie_cta` links MUST point to the **earliest session** in the provided date range (e.g., `https://ticketing.oz.veezi.com/purchase/XXXXX?siteToken=wpge11hbvd3zadj20jkc0y36ym`).
  - You must dynamically parse the JSON-LD payload or scrape the Veezi API directly to locate the earliest correct session ID.

- **SECTION PRESERVATION (Coming Soon, Special Events, Footer)**:
  - If the user prompt does **NOT** specify Coming Soon films, **KEEP** the entire Coming Soon section (section 5) from the master template with its placeholder content. Do NOT delete it.
  - If the user prompt does **NOT** specify Special Events, **KEEP** the entire Special Events & Offers section (section 7) from the master template with its placeholder content. Do NOT delete it.
  - **FOOTER (section 8 and everything below)**: From `<!-- ========== 8. FOOTER ========== -->` to the closing `</html>`, ALWAYS copy this section **verbatim** from the master template. NEVER modify, truncate, or delete the footer. This includes the contact grid, unsubscribe links, red location strip, and map image.
  - The **Divider (section 6)** between Now Showing and Coming Soon must also be preserved.

- **DESCRIPTION PLACEHOLDER CONTAMINATION**:
  - The `movie_description_2` and `movie_description_3` fields in the master template contain placeholder text about a movie called "PILLION" (e.g., "As Colin submits to Ray...").
  - When populating Now Showing films, you MUST **replace** these placeholders with the correct film's additional description paragraphs.
  - If the film's synopsis from MX is short (only one paragraph), **remove** the `movie_description_2` and `movie_description_3` elements entirely for that film block. Do NOT leave the PILLION placeholder text.

- **NOW SHOWING FILM NUMBERING**:
  - Now Showing film comments MUST use incrementing numbers: `NOW SHOWING FILM 1`, `NOW SHOWING FILM 2`, `NOW SHOWING FILM 3`, etc.
  - Do NOT repeat the same number (e.g., do not have multiple `NOW SHOWING FILM 2` comments).

## Core Systems Roles

> **IMPORTANT: DO NOT install external dependencies** (e.g., Puppeteer, Playwright, Selenium).
> Use your **built-in browser tools** (`browser_subagent`, `read_url_content`, etc.) to scrape websites.
> You already have a headless browser available. No `npm install` or `yarn add` is needed.

1. **Veezi (Scraper)**:
   - Determine showing films and **unique deep links** for every individual session.
   - Truth source for what is actually playing in the target date range.
   - **URL**: `https://ticketing.oz.veezi.com/sessions/?siteToken=wpge11hbvd3zadj20jkc0y36ym`
   - **How to scrape**: We will not spawn a sub-agent for this skill. Fetch the Veezi sessions page directly. Click "Sort by date" to view sessions day by day. For each day in the target range, collect every film's session times and their individual booking URLs (format: `https://ticketing.oz.veezi.com/purchase/XXXXX?siteToken=...`). You can also use `execute_browser_javascript` to extract DOM data programmatically from the page. Find the **earliest session** URL for the Book Now buttons.
2. **MovieXchange (Researcher) / Deluxe Cinemas Fallback**:
   - Source for official titles, ratings, synopses, trailers, and media.
   - **How to scrape (M2M API - PREFERRED)**: Instead of scraping the Angular SPA (which is blocked by hCaptcha), you MUST authenticate directly against the MovieXchange API using standard OAuth2.
     - **Credentials**: Safely stored locally at `~/.openclaw/workspace/.mx_api_credentials`. Do not ask the user for them.
     - **Auth Endpoint**: `POST https://film.moviexchange.com/api/token`
     - **Payload (form-urlencoded)**: `grant_type=password&client_id=MovieXchangeApi&username=[USERNAME]&password=[PASSWORD]`
     - **Usage**: Extract the `access_token` from the JSON response and use it as a `Bearer` token to query the MX API endpoints (e.g., searching for films, fetching release details and media).
   - **Trailers & Metadata**: Once authenticated, pull the title, tagline, rating, full synopsis, and YouTube trailer links directly from the API JSON responses.
   - **Images**: Navigate to the API's media endpoints to extract the official poster image URL and the landscape/banner image URL.
   - **Fallback Strategy**: If the API approach fails for a specific film, immediately fallback to scraping `https://www.deluxecinemas.co.nz/movie/[film-name]` to find the official metadata, official poster (`img.vwassets.com`), and YouTube trailer.
3. **Media (Processing)**:
   - Download assets locally using `curl`.
   - Perform proportional resizing using `magick`:
     - **Featured Films**: `convert file.jpg -resize 700x out.jpg` (maintains aspect ratio).
     - **Now Showing/Coming Soon Posters**: `convert file.jpg -resize 160x240! out.jpg` (force exact dimensions).
   - **Upload**: Upload the resized files to the Mailchimp File Manager API to obtain public absolute URLs (`mcusercontent.com`) and use those for the HTML `src` tags.
4. **Mailchimp (Integrator)**:
   - Map all data into the template using `mc:edit` names and public Mailchimp-hosted image URLs.
   - Check if an existing draft campaign is available for this update. Update its HTML content via PUT request.
   - If not, create a Draft. Send test to the tester.

## Allowed Section Names & Mapping

_Refer to AGENT_MAILER_PROMPT_TEMPLATE.md for exact field requirements._

- **Intro text box**: Date range and greeting. Ensure film list in intro matches the full campaign lineup.
- **Featured film one / two / three**:
  - Title, **FULL** tagline (never truncated), rating, **FULL** description.
  - **Trailer Button**: MUST use text **"View Trailer"** (never "View Artwork") and link to the YouTube trailer. Never `href="None"`.
  - **Book Button**: MUST point to the earliest Veezi session URL.
  - **Image**: MUST be a Mailchimp-hosted absolute URL containing the 700px proportionally resized image.
- **Now showing film 1 / 2 / 3 / ...**:
  - Title, **FULL** tagline (never truncated), rating, **FULL** descriptions, book URL.
  - **Trailer Button**: MUST use text **"View Trailer"** and link to the YouTube trailer. Never `href="None"`.
  - **Poster URL**: MUST be a Mailchimp-hosted absolute URL containing the 160x240px resized image.
  - **Sessions (`movie_showtimes`)**: DO NOT use plain text. **Every session time** (e.g., "10:00 AM") MUST be an **HTML link** (`<a href="...">`) to its specific Veezi booking URL.
    - _Format: Mon 23, Mar: [<a href="...">10:00 AM</a>] | Tue 24, Mar: [<a href="...">10:00 AM</a>]_
  - **Description fields**: Replace `movie_description_2` and `movie_description_3` with actual film content or **remove them** if no additional content. NEVER leave PILLION placeholder text.
- **Coming soon: film one / two / three**: Poster URL (Mailchimp-hosted), short description, learn-more URL. **KEEP section if no data provided.**
- **Special event one / two / three**: Title, description, image URL (Mailchimp-hosted), CTA URL. **KEEP section if no data provided.**

## Layout & Image Rules (Strict)

- **Featured Films**: Use **Landscape** hero banners (700px wide, proper aspect ratio).
- **Now Showing/Coming Soon**: Use **Portrait** posters (160x240px).
- **Asset Retrieval**: If a film is not found on MX, **retry search** with variations. DO NOT use placeholders unless multiple search attempts fail. Default to Deluxe Cinemas official website as your fallback source of truth.

## Step by Step Instructions

1. **Extraction**: Identify films and target dates using **Veezi**. Extract the **exact booking URL** for every individual session and locate the earliest session URL for the Book Now buttons.
2. **Content Retrieval (MovieXchange or Deluxe Cinemas)**: Fetch metadata, YouTube trailers, and official images using a headless browser to bypass Angular/Javascript walls.
3. **Sizing & Hosting**: Download images locally. Resize to **700px wide** proportional (Featured) and **160x240px** strict (Now Showing) using `magick`. Upload to Mailchimp File Manager to get public absolute URLs.
4. **Drafting**: Match the prompt data to the **exact `mc:edit` names** in the master template.
   - **Critical**: Ensure the header and section GIF headers are correctly set or preserved.
   - **Sessions**: Generate the timeline with individual clickable links inside the `movie_showtimes` tag.
5. **Omission**: Remove any **repeatable film block** from the HTML if it is explicitly marked as "omit" or if no data exists for it (e.g., if there is no third featured film). **However, NEVER remove entire sections** (Coming Soon section 5, Divider section 6, Special Events section 7, or Footer section 8). If no specific films are provided for Coming Soon or Special Events, keep the section with its template placeholder content.
6. **Verification & Auto-Fix Loop**:
   - We will not spawn a sub-agent for this skill. You must audit the generated `campaign_email.html`.
   - Audit criteria: Verify compliance with **ALL rules** in `SKILL.md` and `AGENT_MAILER_PROMPT_TEMPLATE.md`.
    - **Crucial checks**:
      - **Images**: Verify all `src` tags contain Mailchimp-hosted absolute URLs (`https://mcusercontent.com/...`). Local filenames (`hero.jpg`) or unauthorized hotlinks (`tmdb.org`) are **FAILURES**.
      - **Clickable session links**: Every time must have a unique Veezi URL. The "Book Now" buttons must point to the earliest session.
      - **GIF Headers**: `now-showing.gif` and `coming-soon.gif` must be images, not text.
      - **Button text**: Must say **"View Trailer"**, never "View Artwork".
      - **Links**: Trailer buttons must link to **YouTube trailers**. `href="None"` is a **FAILURE**, must be fixed.
      - **Preservation**: The **Header image (`header.jpg`)** and link must be present.
      - **Meta-data**: Ensure all films have their **FULL tagline** (no `...` truncation) and **rating** fields populated.
      - **Dimensions**: Hero banners (700px) and Posters (160x240px) must be correctly resized.
      - **No truncation**: Scan all `mc:edit` text content for `...` at the end. If found, it is a **BUG**, replace with full text.
      - **No stale placeholders**: Scan for "As Colin submits to Ray" or "PILLION" text. If found in a film that is NOT Pillion, it is a **BUG**.
      - **Section completeness**: Verify Coming Soon (section 5), Special Events (section 7), and Footer (section 8) are present in the output HTML.
      - **Footer integrity**: Verify the footer contains: contact grid (phone, website, email, facebook), unsubscribe links, red location strip, and map image.
   - **404 Link & Asset Check (Crucial)**:
     - You MUST run the `check_404.js` script to verify all `<a>` links and `<img>` src paths in `campaign_email.html`.
     - **Command**: `node check_404.js campaign_email.html`
     - If any link or image returns a **404**, **FILE_NOT_FOUND**, or **ERR_NAME_NOT_RESOLVED**:
       1. **List all broken links** clearly for the next step.
       2. **Find it again**: Search **MovieXchange** or **Veezi** for the correct asset or link.
       3. **Fallback**: If the official asset is still 404, look for an alternative (e.g., fallback to the cinema homepage for a broken trailer).
       4. **Replace and Re-verify**: Update the HTML content and run `check_404.js` again.
   - If any rule is violated, you **MUST fix the HTML** and re-verify.
   - Continue the loop until the HTML is **100% compliant**.
7. **Finalization**: Check **`WORKFLOW_MODE`**.
   - If **`testing`**: update **existing draft** and send test to **tester address** only.
   - If **`production`**: update **draft** and notify user for final approval.
