---
name: Build Cinema Email
description: A skill to build or update the cinema email using the master template and specific section names.
---

# Build Cinema Email Skill

**Overview:**
This skill guides you to build or update the **cinema email master template** by combining the **Core System Flow** with the **HTML Prompt Template** rules.

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
  - **HOW TO FIND THE TRAILER ON MX**: On each film's MovieXchange profile page, look for the **"Watch Trailer"** button (it has a YouTube icon next to it). Click or extract the `href` from that button, it links directly to the YouTube trailer URL. This is the URL to use for the `featured_film_trailer` and `movie_trailer` fields.

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

## Core Systems & Sub-Agent Roles

> **IMPORTANT: DO NOT install external dependencies** (e.g., Puppeteer, Playwright, Selenium).
> Use your **built-in browser tools** (`browser_subagent`, `read_url_content`, etc.) to scrape websites.
> You already have a headless browser available. No `npm install` or `yarn add` is needed.

1. **Veezi (Scraper)**:
   - Determine showing films and **unique deep links** for every individual session.
   - Truth source for what is actually playing in the target date range.
   - **URL**: `https://ticketing.oz.veezi.com/sessions/?siteToken=wpge11hbvd3zadj20jkc0y36ym`
   - **How to scrape**: Use `browser_subagent` to open the Veezi sessions page. Click "Sort by date" to view sessions day by day. For each day in the target range, collect every film's session times and their individual booking URLs (format: `https://ticketing.oz.veezi.com/purchase/XXXXX?siteToken=...`). You can also use `execute_browser_javascript` to extract DOM data programmatically from the page.
2. **MovieXchange (Researcher)**:
   - Source for official titles, ratings, synopses, and media.
   - **Trailers**: On each film's MX profile page, find the **"Watch Trailer"** button (with YouTube icon). Extract the `href` from that button for the YouTube URL.
   - **How to scrape**: Use `browser_subagent` or `read_url_content` to open the film page on MovieXchange (search at `https://moviexchange.com`). Extract: title, tagline, rating, synopsis, poster image URL, landscape/banner image URL, and the "Watch Trailer" button YouTube link.
3. **Media (Processing)**:
   - Download assets using `curl` and perform **hard resize** using `magick`:
     - **Featured Films**: 700px wide (Landscape).
     - **Now Showing/Coming Soon Posters**: 160x240px (Portrait).
4. **Mailchimp (Integrator)**:
   - Map all data into the template using `mc:edit` names.
   - Create Draft and send test to the tester.

## Allowed Section Names & Mapping

_Refer to AGENT_MAILER_PROMPT_TEMPLATE.md for exact field requirements._

- **Intro text box**: Date range and greeting. Ensure film list in intro matches the full campaign lineup.
- **Featured film one / two / three**:
  - Title, **FULL** tagline (never truncated), rating, **FULL** description, hero image.
  - **Trailer Button**: MUST use text **"View Trailer"** (never "View Artwork") and link to the YouTube trailer. Never `href="None"`.
- **Now showing film 1 / 2 / 3 / ...**:
  - Title, **FULL** tagline (never truncated), rating, **FULL** descriptions, poster URL, book URL.
  - **Trailer Button**: MUST use text **"View Trailer"** and link to the YouTube trailer. Never `href="None"`. Fallback: `https://deluxecinemas.co.nz/`.
  - **Sessions (`movie_showtimes`)**: DO NOT use plain text. **Every session time** (e.g., "10:00 AM") MUST be an **HTML link** (`<a href="...">`) to its specific Veezi booking URL.
    - _Format: Mon 23, Mar: [<a href="...">10:00 AM</a>] | Tue 24, Mar: [<a href="...">10:00 AM</a>]_
  - **Description fields**: Replace `movie_description_2` and `movie_description_3` with actual film content or **remove them** if no additional content. NEVER leave PILLION placeholder text.
- **Coming soon: film one / two / three**: Poster URL, short description, learn-more URL. **KEEP section if no data provided.**
- **Special event one / two / three**: Title, description, image URL, CTA URL. **KEEP section if no data provided.**

## Layout & Image Rules (Strict)

- **Featured Films**: Use **Landscape** hero banners (700px wide).
- **Now Showing/Coming Soon**: Use **Portrait** posters (160x240px).
- **Asset Retrieval**: If a film is not found on MX, **retry search** with variations. DO NOT use placeholders unless multiple search attempts fail.

## Step by Step Instructions

1. **Extraction**: Identify films and target dates using **Veezi**. Extract the **exact booking URL** for every individual session.
2. **Content Retrieval (MovieXchange)**: Fetch metadata and assets.
   - **Trailers**: Fetch the YouTube URL. Fall back to the cinema homepage ONLY if no trailer exists on MX.
   - **Sizing**: Download and resize to **700px wide** (Featured) and **160x240px** (Now Showing) using `magick`.
3. **Drafting**: Match the prompt data to the **exact `mc:edit` names** in the master template.
   - **Critical**: Ensure the header and section GIF headers are correctly set or preserved.
   - **Sessions**: Generate the timeline with individual clickable links inside the `movie_showtimes` tag.
4. **Omission**: Remove any **repeatable film block** from the HTML if it is explicitly marked as "omit" or if no data exists for it (e.g., if there is no third featured film). **However, NEVER remove entire sections** (Coming Soon section 5, Divider section 6, Special Events section 7, or Footer section 8). If no specific films are provided for Coming Soon or Special Events, keep the section with its template placeholder content.
5. **Verification & Auto-Fix Loop**:
   - Spawn a **tester sub-agent** to audit the generated `campaign_email.html`.
   - Audit criteria: Verify compliance with **ALL rules** in `SKILL.md` and `AGENT_MAILER_PROMPT_TEMPLATE.md`.
    - **Crucial checks**:
      - **Clickable session links**: Every time must have a unique Veezi URL.
      - **GIF Headers**: `now-showing.gif` and `coming-soon.gif` must be images, not text.
      - **Button text**: Must say **"View Trailer"**, never "View Artwork".
      - **Links**: Trailer buttons must link to **YouTube trailers**. `href="None"` is a **FAILURE**, must be fixed.
      - **Preservation**: The **Header image (`header.jpg`)** and link must be present.
      - **Meta-data**: Ensure all films have their **FULL tagline** (no `...` truncation) and **rating** fields populated.
      - **Dimensions**: Hero banners (700px) and Posters (160x240px) must use correctly sized local assets.
      - **No truncation**: Scan all `mc:edit` text content for `...` at the end. If found, it is a **BUG**, replace with full text.
      - **No stale placeholders**: Scan for "As Colin submits to Ray" or "PILLION" text. If found in a film that is NOT Pillion, it is a **BUG**.
      - **Section completeness**: Verify Coming Soon (section 5), Special Events (section 7), and Footer (section 8) are present in the output HTML.
      - **Footer integrity**: Verify the footer contains: contact grid (phone, website, email, facebook), unsubscribe links, red location strip, and map image.
   - **404 Link & Asset Check (Crucial)**:
     - The sub-agent MUST run the `check_404.js` script to verify all `<a>` links and `<img>` src paths in `campaign_email.html`.
     - **Command**: `node check_404.js campaign_email.html`
     - If any link or image returns a **404**, **FILE_NOT_FOUND**, or **ERR_NAME_NOT_RESOLVED**:
       1. **List all broken links** clearly for the next step.
       2. **Find it again**: Search **MovieXchange** or **Veezi** for the correct asset or link.
       3. **Fallback**: If the official asset is still 404, look for an alternative (e.g., fallback to the cinema homepage for a broken trailer).
       4. **Replace and Re-verify**: Update the HTML content and run `check_404.js` again.
   - If any rule is violated, the sub-agent **MUST fix the HTML** and re-verify.
   - Continue the loop until the HTML is **100% compliant**.
6. **Finalization**: Check **`WORKFLOW_MODE`**.
   - If **`testing`**: create **draft** and send test to **tester address** only.
   - If **`production`**: create **draft** and notify user for final approval.
