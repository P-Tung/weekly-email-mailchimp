---
name: Build Cinema Email
description: A 1-shot robust skill to build the cinema email by creating a JSON payload and running the build script.
---

# Build Cinema Email Skill

**Overview:**
This skill allows you to build and push the cinema email campaign in one perfect shot. The repository now includes a robust Node.js script that automatically parses the HTML template, queries the Veezi live session API, resizes/uploads local images to the Mailchimp CDN, dynamically injects the showtimes, reorders the HTML blocks to match your requested film list, and pushes to your Mailchimp draft.

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
4. The script will automatically fetch Veezi, handle Mailchimp uploads, reorder the HTML via Cheerio, and fire the test email.
5. Wait for the script to finish executing and then report success to the user!
