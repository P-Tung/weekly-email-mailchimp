---
name: Build Cinema Email
description: A skill to build or update the cinema email using the master template and specific section names.
---

# Build Cinema Email Skill

**Overview:** 
This skill guides you to build or update the **cinema email master template** by combining the **Core System Flow** with the **HTML Prompt Template** rules.

**Important rules:**
* **WORKFLOW_MODE**: Currently set to **`testing`**.
  - **`testing`**: create draft only, send test email to **tester only**.
  - **`production`**: create draft, prepare for final list (but still do not send without final user confirmation).
* **HTML Truth Source**: Follow **exactly** matching **AGENT_MAILER_PROMPT_TEMPLATE.md**.
* **Preservation**: USE THE MASTER TEMPLATE (`cinema-email-master-template.html`). **DO NOT delete or overwrite anything** outside of the `mc:edit` regions.
* **Header Preservation**: The **Header image (`header.jpg`)** and its link (`https://deluxecinemas.co.nz/`) MUST be kept. Do not remove the header section.
* **Section GIF Headers**: 
  - **Now Showing Section**: MUST use `now-showing.gif` (mc:edit="now_showing_heading").
  - **Coming Soon Section**: MUST use `coming-soon.gif` (mc:edit="coming_soon_heading").
  - DO NOT use plain text for these headers.
* **Core Flow Source**: Use the **Veezi -> MovieXchange -> Mailchimp** pipeline.
* **Highlight(bold) important text** in your reasoning.

## Core Systems & Sub-Agent Roles

1. **Veezi (Scraper)**: 
   - Determine showing films and **unique deep links** for every individual session.
   - Truth source for what is actually playing in the target date range.
2. **MovieXchange (Researcher)**: 
   - Source for official titles, ratings, synopses, and media.
   - **Trailers**: MUST fetch **YouTube video links** from the film profile.
3. **Media (Processing)**: 
   - Download assets and perform **hard resize**:
     - **Featured Films**: 600px wide (Landscape).
     - **Now Showing/Coming Soon Posters**: 160x240px (Portrait).
4. **Mailchimp (Integrator)**: 
   - Map all data into the template using `mc:edit` names.
   - Create Draft and send test to the tester.

## Allowed Section Names & Mapping
*Refer to AGENT_MAILER_PROMPT_TEMPLATE.md for exact field requirements.*

* **Intro text box**: Date range and greeting. Ensure film list in intro matches the full campaign lineup.
* **Featured film one / two / three**: 
  - Title, tagline, rating, description, hero image.
  - **Trailer Button**: MUST use text **"View Trailer"** (never "View Artwork") and link to the YouTube trailer.
* **Now showing film 1 / 2 / 3 / ...**: 
  - Title, tagline, rating, descriptions, poster URL, book URL.
  - **Trailer Button**: MUST use text **"View Trailer"** and link to the YouTube trailer.
  - **Sessions (`movie_showtimes`)**: DO NOT use plain text. **Every session time** (e.g., "10:00 AM") MUST be an **HTML link** (`<a href="...">`) to its specific Veezi booking URL. 
    - *Format: Mon 23, Mar: [<a href="...">10:00 AM</a>] | Tue 24, Mar: [<a href="...">10:00 AM</a>]*
* **Coming soon: film one / two / three**: Poster URL, short description, learn-more URL.
* **Special event one / two / three**: Title, description, image URL, CTA URL.

## Layout & Image Rules (Strict)

* **Featured Films**: Use **Landscape** hero banners (600px wide).
* **Now Showing/Coming Soon**: Use **Portrait** posters (160x240px).
* **Asset Retrieval**: If a film is not found on MX, **retry search** with variations. DO NOT use placeholders unless multiple search attempts fail.

## Step by Step Instructions

1. **Extraction**: Identify films and target dates using **Veezi**. Extract the **exact booking URL** for every individual session.
2. **Content Retrieval (MovieXchange)**: Fetch metadata and assets.
   * **Trailers**: Fetch the YouTube URL. Fall back to the cinema homepage ONLY if no trailer exists on MX.
   * **Sizing**: Download and resize to **600px wide** (Featured) and **160x240px** (Now Showing) using `magick`.
3. **Drafting**: Match the prompt data to the **exact `mc:edit` names** in the master template.
   - **Critical**: Ensure the header and section GIF headers are correctly set or preserved.
   - **Sessions**: Generate the timeline with individual clickable links inside the `movie_showtimes` tag.
4. **Omission**: Remove any repeatable section from the HTML if it is explicitly marked as "omit" or if no data exists for it (e.g., if there is no third featured film).
5. **Finalization**: Check **`WORKFLOW_MODE`**.
   - If **`testing`**: create **draft** and send test to **tester address** only.
   - If **`production`**: create **draft** and notify user for final approval.
