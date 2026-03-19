# Weekly email integration process log

## Scope completed
- Produced repo-local final HTML at `output/final-weekly-email.html`
- Mirrored fresh-session source data into:
  - `reports/veezi-sessions.json`
  - `reports/moviexchange-data.json`
- Did **not** create a Mailchimp campaign
- Did **not** send a test email
- Operated in **testing mode / HTML-only integration mode**

## Fresh-session verification
The expected repo-local JSON dependencies were not initially present in this checkout, so I verified and used only fresh artifacts from the same 2026-03-17 run, then copied those into this repo for traceability.

### Veezi freshness evidence
Fresh source run used:
- `/home/ubuntu/.openclaw/workspace/fresh-run-20260317/weekly-email-mailchimp/run-output/veezi/sessions-2026-03-23-to-2026-03-29.json`
- source fetched at UTC: `2026-03-17T13:33:47Z`
- live source URL: `https://ticketing.oz.veezi.com/sessions/?siteToken=wpge11hbvd3zadj20jkc0y36ym`

Repo-local copy created:
- `reports/veezi-sessions.json`

### MovieXchange freshness evidence
Fresh source run used:
- `/home/ubuntu/.openclaw/workspace/fresh-run-20260317/weekly-email-mailchimp/run-output/moviexchange/research.json`
- generated at UTC: `2026-03-17T13:41:16Z`
- login verified live for `admin@deluxecinemas.co.nz`
- organisation verified: `Deluxe Cinemas Christchurch (NZ)`

Repo-local copy created:
- `reports/moviexchange-data.json`

## Section mapping used
Mapped into the email template using the section names from `AGENT_MAILER_PROMPT_TEMPLATE.md`.

### Intro text box
- Updated for the fresh March 23–29 lineup
- Copy highlights the active weekly titles and closes with the standard sign-off

### Featured film one
- `I Swear`
- Featured because it is the one-off special/opening-night title in the fresh Veezi data

### Featured film two
- `Project Hail Mary`
- Featured because it has strong multi-day presence and marquee value

### Featured film three
- Omitted / not populated in the final HTML used for this run

### Now showing film 1
- `EXHIBITION ON SCREEN: Turner & Constable`

### Now showing film 2
- `Tenor: My Name is Pati`

### Now showing film 3
- `EPiC: Elvis Presley in Concert`

### Now showing film 4
- `Holy Days`

### Now showing film 5
- `Mid-Winter Break`

### Now showing film 6
- `Fackham Hall`

### Coming soon
- No coming-soon block populated in the final HTML for this run

### Special events & offers
- No special-event block populated in the final HTML for this run

## Data / asset notes
- The final HTML is based on the fresh-run integration output from this same session and preserved its Mailchimp-style `mc:edit` mapping.
- Fresh MovieXchange first-image URLs were used in the HTML.
- Repo-local `reports/*.json` now reflect the same fresh-session data used by the integrator.
- No stale cached reports were used.

## Important caveat
- The repo checkout originally lacked the required `reports/veezi-sessions.json` and `reports/moviexchange-data.json` files.
- To stay within the fresh-session requirement, I used the sibling fresh-run artifacts from this same session only, then mirrored them into this repo before finalizing output.
