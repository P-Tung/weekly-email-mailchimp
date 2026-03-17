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
* **Core Flow Source**: Use the **Veezi -> MovieXchange -> Mailchimp** pipeline.
* **Header Image**: Always use the local **`header.jpg`** or its specific Mailchimp hosted version. Do not use generic or old banner URLs.
* **Draft Only**: Never send to the live list. Keep the campaign as a **draft**.
* **Highlight(bold) important text** in your reasoning.

## Core Systems (Flow Only)

* **Veezi**: Determine showing films and **session links** from the site token.
* **MovieXchange**: Source for official titles, ratings, synopses, **YouTube trailers**, and media.
* **Mailchimp**: Destination for the draft and asset hosting.

## Allowed Section Names & Mapping
*Refer to AGENT_MAILER_PROMPT_TEMPLATE.md for exact field requirements.*

* **Intro text box**: Date range and greeting. Ensure film list in intro matches the full campaign lineup.
* **Featured film one / two / three**: Title, tagline, rating, description, hero image, trailer, and book URL.
* **Now showing film 1 / 2 / 3 / ...**: 
  - **Title, tagline, rating, descriptions, poster URL, trailer, and book URL**.
  - **Showtimes Note (`movie_showtimes`)**: DO NOT use plain text. Every session time (e.g., "10:00 AM") MUST be an **HTML link** (`<a href="...">`) to its specific Veezi booking URL. Format: *Monday 23, March: [10:00 AM](url), [12:00 PM](url)...*
* **Coming soon: film one / two / three**: Poster URL, short description, learn-more URL.
* **Special event one / two / three**: Title, description, image URL, CTA URL.

## Layout & Image Rules (Strict)

* **Featured Films**: Use **Landscape** hero banners from the MX Media section.
  - **Ideal Size**: **600px wide**.
  - **Priority**: official banners labeled "Social Media" or "Web Materials". Avoid "stills".
* **Now Showing Films**: Use **Portrait** posters from the MX Media section.
  - **Ideal Size**: **160x240px**.
* **Asset Retrieval**: If a film is not found on MX, **retry search** with variations of the title or part of the title. DO NOT use placeholders unless multiple search attempts fail.

## Step by Step Instructions

1. **Extraction**: Identify films and Monday–Sunday dates using **Veezi**. Extract **deep links** for every individual session.
2. **Content Retrieval (MovieXchange)**: Fetch metadata and assets.
   * **The "First Image" Rule**: Select the **first valid poster/banner** (Portrait for Now Showing, Landscape for Featured). Exclude "stills".
   * **Trailers**: **Must use YouTube video links** from the MX film profile. Fall back to the cinema homepage ONLY if no trailer exists on MX.
   * **Sizing**: Download and resize to **600px wide** (Featured) and **160x240px** (Now Showing) using `magick`.

3. **Drafting**: Match the prompt data to the **exact `mc:edit` names** in the master template.
   - **Important**: Generate the session timeline as **clickable HTML links** inside the `movie_showtimes` tag.

4. **Omission**: Remove any section from the HTML that is explicitly marked as "omit."
5. **Finalization**: Check **`WORKFLOW_MODE`**.
   - If **`testing`**: create **draft** and send test to **tester address** only.
   - If **`production`**: create **draft** and notify user for final approval.


