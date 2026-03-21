---
name: Build Cinema Email
description: A 1-shot robust skill to build the cinema email by creating a JSON payload and running the dynamic build script.
---

# Build Cinema Email Skill

**Overview:**
This skill allows you to build and push the cinema email campaign in one perfect shot. The repository uses a robust, **fully dynamic Node.js script** (`scripts/build_and_push.js`) that automatically:
- Scrapes the Veezi live session API to get real-time showtimes.
- Scrapes the official Veezi film pages to extract brand new **Titles, Posters, Ratings (Censors), and Synopses** for any new film in the payload.
- Dynamically resizes (via ImageMagick) and uploads new posters directly to the Mailchimp CDN.
- Injects this fresh data into the HTML master template and pushes to your Mailchimp draft.

**CRITICAL RULE:** 
**Do NOT** attempt to manually edit the HTML, manually scrape data, or just reorder static blocks from `goal-example.html`. The `goal-example.html` is just a structural template. The `build_and_push.js` script handles 100% of the dynamic data fetching for any new film.

**How to Execute (1-Shot Workflow):**

1. Read the user's prompt to understand the requested `dates`, `test_email`, `featured_films`, and `now_showing` films list exactly as they ordered them.
2. In the `weekly-email-mailchimp` root directory, create a single file called `campaign_payload.json` structured exactly like this example:
   ```json
   {
     "dates": "March 25 to March 29",
     "featured_films": ["Project Hail Mary", "I Swear"],
     "now_showing": [
       "Fackham Hall",
       "Tenor",
       "Mid-Winter Break",
       "Epic: Elvis Presley in concert",
       "Holy days",
       "Turner and Constable"
     ],
     "test_email": "tungphamkindle@gmail.com"
   }
   ```
3. Run the following command exactly as written:
   `cd weekly-email-mailchimp && npm install && node scripts/build_and_push.js campaign_payload.json`
4. The script will automatically scrape the new metadata, handle Mailchimp uploads, compile the HTML via Cheerio, and fire the test email.
5. Wait for the script to finish executing and then report success to the user!
