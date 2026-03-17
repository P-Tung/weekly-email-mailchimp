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
* **Draft Only**: Never send to the live list. Keep the campaign as a **draft**.
* **Highlight(bold) important text** in your reasoning.

## Core Systems (Flow Only)

* **Veezi**: Determine showing films and session links from the site token.
* **MovieXchange**: Source for official titles, ratings, synopses, and media.
* **Mailchimp**: Destination for the draft and asset hosting.

## Allowed Section Names & Mapping
*Refer to AGENT_MAILER_PROMPT_TEMPLATE.md for exact field requirements.*

* **Intro text box**: Date range and greeting.
* **Featured film one / two / three**: Title, tagline, rating, description, hero image, trailer, and book URL.
* **Now showing film 1 / 2 / 3 / ...**: Title, tagline, rating, descriptions, poster URL, showtimes note, trailer, and book URL.
* **Coming soon: film one / two / three**: Poster URL, short description, learn-more URL.
* **Special event one / two / three**: Title, description, image URL, CTA URL.

## Layout & Image Rules (Strict)

* **Featured Films**: Use **Landscape** hero banners from the MX Media section.
  - **Ideal Size**: **600px wide**.
* **Now Showing Films**: Use **Portrait** posters from the MX Media section.
  - **Ideal Size**: **160x240px**.
* **Coming Soon Variants**:
  - 1 film = `Coming soon one`.
  - 2 films = `Coming soon two`.
  - 3 films = `Coming soon three`.

## Step by Step Instructions

1. **Extraction**: Identify films and Monday–Sunday dates using **Veezi**. 
2. **Content Retrieval (MovieXchange)**: Fetch metadata and assets.
   * **The "First Image" Rule**: Go to the **Media section** of the film on MovieXchange and select the **first image**. This is the main poster/banner.
   * **Sizing**: Download and resize to **600px wide** for featured films and **160x240px** for Now Showing posters.

3. **Drafting**: Match the prompt data to the **exact `mc:edit` names** in the master template.
4. **Omission**: Remove any section from the HTML that is explicitly marked as "omit."
5. **Finalization**: Check **`WORKFLOW_MODE`**.
   - If **`testing`**: create **draft** and send test to **tester address** only.
   - If **`production`**: create **draft** and notify user for final approval.


