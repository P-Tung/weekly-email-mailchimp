# Weekly Email Mailchimp Workflow

## Purpose
Use this workflow to build the **weekly Deluxe Cinemas Mailchimp campaign** correctly and repeatably.

This workflow exists because the weekly mailer has a **high-conversion template** in Mailchimp that should be preserved. The correct process is **not** to design a brand-new simplified email. Instead:

- start from the existing successful weekly campaign HTML
- preserve the header, footer, and layout structure
- update **only** the film-related content and current-period schedule content
- leave the campaign as a **draft** for approval

---

## ⛔ MASTER TEMPLATE PROTECTION RULE

The file **`weekly-mailer-february-24-mailchimp.html`** is the **read-only master template**.

### NEVER modify `weekly-mailer-february-24-mailchimp.html` directly.

This file is the single source of truth for the email design. It must stay intact so every future weekly campaign can be built from a clean, known-good base.

**Correct process — MUST follow every time:**
1. **Read** `weekly-mailer-february-24-mailchimp.html` to understand the structure.
2. **Duplicate** it into a new file named for the current campaign week, e.g.:
   - `weekly-mailer-mar-9-15.html`
   - `weekly-mailer-apr-1-7.html`
3. **Edit only the new duplicate file** — never the original.
4. Upload the edited duplicate to Mailchimp as the campaign HTML.

**If you are about to write changes into `weekly-mailer-february-24-mailchimp.html` → STOP. Create a copy first.**

---

### Email template variation
Treat the base Mailchimp design as an **email template variation**.

Default template variation:
- `Weekly mailer February 24`

This default can be overridden by the user prompt.

Meaning:
- if the user does not specify a different template variation, use `Weekly mailer February 24`
- if the user names another Mailchimp campaign/template variation, use that one instead
- do not hardcode February 24 forever as the only valid template; it is the default, not a permanent rule

### Test-recipient variable
Use a configurable `tester` variable for test sends after the campaign draft is prepared.

Current default tester:
- `tungphamkindle@gmail.com`

This tester value can be changed later.

---

## Core Rule
**Do not send the campaign.**
Only create/update drafts.

---

## Correct Definition of “Find the Source”
For this weekly workflow, **“find the source” means find what films are actually showing in the target week from Veezi**, not “find the previous Mailchimp campaign.”

Sequence:
1. Use **Veezi** to determine what is actually showing in the target date range.
2. Use **MovieXchange** to fetch the official poster, rating, synopsis, and trailer data.
3. Use **Mailchimp** to duplicate or rebuild from the proven weekly template.

---

## Systems Used

### 1) Veezi — session/schedule source
Use Veezi to determine what films are showing in the target week.

URL:
`https://ticketing.oz.veezi.com/sessions/?siteToken=wpge11hbvd3zadj20jkc0y36ym`

What to extract:
- film titles in the target date range
- current-session booking URLs where needed
- which films should be featured vs also showing

### 1b) Deluxe Cinemas website — customer-facing film links
The cinema site for this workflow is fixed as:
- `https://www.deluxecinemas.co.nz/`

Use it for customer-facing film page links.

Rules:
- do not make the cinema site a prompt variable for this workflow unless explicitly asked
- poster clicks should go to the Deluxe Cinemas film page, not MovieXchange
- MovieXchange is the content source, not the public destination link
- if the Deluxe site has a film page, use that URL for the poster link
- if needed, use the Deluxe sitemap to find the correct movie page slug

### 2) MovieXchange — official content source
Use MovieXchange for:
- title
- rating
- rating notes
- runtime
- synopsis / short synopsis
- fallback trailer URL when the cinema site does not have one
- poster

Preferred app/API source:
- `https://film.moviexchange.com/`
- site login entry point: `https://moviexchange.com/`

### MovieXchange access note
Store MovieXchange credentials in a local secret file such as `.mxfilm.env` and keep that file out of git.

Suggested local variables:
- `MXFILM_URL`
- `MXFILM_USERNAME`
- `MXFILM_PASSWORD`

Before MovieXchange work:
- load the env file locally
- sign in to MovieXchange
- search the exact film title there
- use the official MovieXchange-marked poster asset

## ⚠️ CANONICAL FEATURED IMAGE RULE — This overrides all other image guidance in this file

**ALL featured film images MUST be landscape banners. NOT portrait posters.**

This is a hard rule. Do not pick portrait posters for the main featured film blocks.

### Why landscape?
The email layout is wide (700px). A landscape banner fills it correctly. A portrait poster is tall and narrow — it creates a very long, improperly formatted email block.

### Mandatory image selection steps (MUST follow in order):
1. Log into MovieXchange.
2. Search the exact film title.
3. Open the correct NZ release.
4. Go to the release media / image assets.
5. **Look ONLY for landscape/wide banner assets. Do NOT pick portrait posters.**
6. **Priority order for landscape banners:**
   - First: asset whose title/description/metadata includes **"Social Media"**
   - Second (fallback): asset whose title/description/metadata includes **"Web Materials"**
   - Third (last resort): any other official wide/landscape promotional asset (e.g. Backdrop) that is clearly promotional art
7. **NEVER use any asset whose title/description/metadata includes "still" or "stills".** These are random scene captures, not promotional banners.
8. Visually inspect the shortlisted candidates — prefer the banner that reads best at 700px wide in an email.
9. If multiple versions of the same good banner exist, pick the one with source width nearest to but above 700px.

### ⛔ STOP — If NO good landscape banner exists for a film:
Do **NOT**:
- use a portrait poster as a fallback
- crop a portrait poster into a fake banner
- use a scene still
- use a Veezi thumbnail

Instead → **skip that film entirely** and select the next best film from the full Veezi list that DOES have a good landscape banner. See the Film Selection Rule below.

### Resize rule (MANDATORY — no exceptions):
- After selecting the banner, download the source file.
- Use an image-processing tool to resize it so the output file is **exactly 700px wide**.
- Do NOT upload the original source file.
- Do NOT rely on HTML `width` attribute, CSS, or Mailchimp display sizing to achieve 700px.
- The intrinsic pixel width of the uploaded file itself MUST be 700px.

```bash
magick input.jpg -resize 700x output.jpg
identify output.jpg  # MUST show 700px wide before proceeding
```

- Upload ONLY the resized `output.jpg` to Mailchimp file manager.
- Use the Mailchimp-hosted URL in the campaign HTML.
- Do NOT use MovieXchange or external CDN URLs directly in the email.

Trailer link rule:
- first try to get the trailer URL from the Deluxe Cinemas film page / site API
- verify that the trailer link actually works
- if the Deluxe site does not provide a working trailer, fall back to MovieXchange trailer data
- do not use booking links as trailer links

### 3) Mailchimp — campaign destination
Use Mailchimp to:
- read prior campaign HTML
- create/update weekly drafts
- upload poster assets into Mailchimp file storage
- save the final weekly draft

### Mailchimp connection note
The Mailchimp API in this workspace uses the Maton gateway and requires `MATON_API_KEY`.

Preferred local setup:
- store the key in a local env file such as `.mailchimp.env`
- load it before Mailchimp API work with: `source .mailchimp.env`
- do not paste the raw API key into this workflow document
- keep the secret file out of git

Connection pattern:
- base URL: `https://gateway.maton.ai/mailchimp/3.0/...`
- auth header: `Authorization: Bearer $MATON_API_KEY`

Before starting Mailchimp work, verify that `MATON_API_KEY` is available in the shell environment.

---

## Critical Lessons Learned

### A) Preserve the winning template
The selected email template variation already converts well.

So:
- keep header
- keep footer
- keep phone/site/contact blocks
- keep overall table structure
- keep visual layout

Change only:
- film posters
- film titles
- film ratings / notes
- film synopsis text
- trailer links / book now links
- date/schedule text
- current-period event/ad cards
- intro copy block text

### Intro copy block rule
The intro copy block is the text section near the top of the email between:
- the greeting (`Dear *|FNAME|*`)
- and the closing line (`See you at the Movies!`)

When the weekly email includes all films showing in the target period, the intro copy block should also reflect the full lineup.

Do not summarize only the first few featured films if the body of the email contains more films.

If the campaign contains 10 films, the intro copy block should include 10 short film descriptions as well.

### Intro copy block rule — strict date-range matching by default
For this workflow, the intro/header summary must match the **exact requested campaign date range** by default.

Meaning:
- do not mention films in the intro/header unless they are actually showing within the requested date range
- do not use a broader weekly lineup if that broader lineup includes films outside the requested date range
- do not reuse old intro copy patterns that list films from a previous or nearby week
- if only one film is in range, the intro/header must mention only that one film unless the user explicitly asks for broader marketing copy

Default behavior:
- intro/header copy is date-range strict
- every film named in the intro/header should be verifiable from Veezi within the requested date range
- broader lineup wording is allowed only when the user explicitly asks for it

### B) Do not rebuild from scratch unless explicitly needed
A simplified custom HTML rebuild can accidentally remove:
- branding blocks
- conversion-focused structure
- footer/contact elements
- other working design pieces

Only use a clean HTML campaign if absolutely necessary.

### C) Mailchimp template-backed campaigns can fight raw HTML edits
Mailchimp may regenerate some template-backed campaign content.

Safer approaches:
- preserve the original source template HTML and edit only the relevant blocks
- avoid relying on drag-and-drop builder saves after API HTML edits
- verify saved HTML after updates

### D) Prefer Mailchimp-hosted images over external CDN images
Even if posters come from MovieXchange, final campaign images should preferably be:
1. downloaded from MovieXchange
2. uploaded into Mailchimp file manager
3. referenced via Mailchimp-hosted URLs in the campaign

This is more stable than relying on external poster URLs.

---

## Weekly Workflow

## Step 1 — Determine the target week
Define the exact weekly date range first.

Examples:
- March 3 – March 11
- March 9 – March 15

This date range controls:
- Veezi extraction
- intro copy
- headline/schedule text
- current-period event/ad links

---

## Step 2 — Extract current films from Veezi
Open the Veezi sessions page and extract all films in the date range.

Use this as the truth source for what’s showing.

Output should include:
- titles showing in range
- rough prominence / session counts
- purchase URLs for the current week where useful

Use the extracted list to split films into:
- **featured films**
- **also showing**

### Recommended selection logic
Feature films that are:
- new
- important
- heavily programmed
- marketable in subject line / top copy

Use the rest in “also showing” or secondary promo sections.

### ⛔ HARD RULE — EXACTLY 4 FEATURED FILMS IN THE MAIN BODY

The main featured section MUST show **exactly 4 films**. Not 3. Not 5. Not all films from Veezi.

- Do NOT expand the featured section beyond 4 films even if Veezi shows 9 films that week.
- Do NOT shrink below 4 unless there are genuinely fewer than 4 films available.
- The intro copy block MUST also list exactly those same 4 films — no more, no less.
- If the user explicitly overrides this count in the prompt, follow the prompt. Otherwise this rule is absolute.

### ⛔ HARD RULE — Film selection process (choose 4 from all available)

Veezi will often show more than 4 films in a given week. The process to select the 4 featured films is:

1. Pull the full film list from Veezi for the exact date range.
2. Rank films by: new release status, session count, marketability.
3. Starting from the top of the ranked list, attempt to find a **good landscape banner** on MovieXchange for each film.
4. **If a film has no good landscape banner on MovieXchange → skip that film. Move to the next film on the ranked list.**
5. Continue down the ranked list until you have exactly 4 films that each have a confirmed good landscape banner.
6. Those 4 films are the featured films for this email.

Example:
- Veezi has 9 films: A, B, C, D, E, F, G, H, I (ranked by priority)
- A has a good landscape banner → ✅ include
- B has a good landscape banner → ✅ include
- C has NO good landscape banner → ❌ skip C
- D has a good landscape banner → ✅ include
- E has a good landscape banner → ✅ include
- **Result: featured films are A, B, D, E** (4 films, all with confirmed landscape banners)

Do NOT include C just because it ranked 3rd. Do NOT include a portrait poster for C as a workaround.
Do NOT include films that are **outside** the requested date range.

### Critical layout rule — where to add extra films
If the weekly lineup has more films than the original featured-film area can hold:
- duplicate the main featured film block(s)
- duplicate the matching date/session block(s)
- add those extra blocks **above the Free Parking block**

Do **not** solve this by overwriting or repurposing the blocks below the Free Parking section unless the user explicitly asks for that.

In particular, do not casually replace:
- the promo/event blocks below Free Parking
- lower campaign promos
- other existing non-film marketing sections

Default rule:
- extra films belong in duplicated featured-film sections above Free Parking
- lower promo/ad sections stay unchanged unless explicitly requested

### Footer preservation rule — everything below Free Parking stays untouched by default
Treat the section beginning at the **Free Parking** block and everything below it as preserved template content.

Default behavior:
- do not edit that area when updating weekly film content
- do not insert film promos into that area
- do not reuse lower/footer sections as overflow space for film blocks
- if more film capacity is needed, add or duplicate film blocks **above** Free Parking instead
- keep everything below Free Parking the same as the preserved reference footer from **Weekly mailer February 24** unless the user explicitly asks otherwise

Only change anything from Free Parking downward if the user explicitly asks for those lower sections to be modified.

### Hard footer rule
Do **not** touch the footer content below the Free Parking section for normal weekly mailer updates.

For normal runs:
- the footer below Free Parking should stay the same as **Weekly mailer February 24**
- do not rewrite it
- do not swap promos into it
- do not use it to fit extra films
- do not adjust its text, schedule, images, or links unless the user explicitly asks

---

## Step 3 — Duplicate the master template into a new working file

### ⛔ HARD RULE — Do NOT edit the master template file directly

The master template is: **`weekly-mailer-february-24-mailchimp.html`**

This file MUST remain untouched. It is the design source for every future weekly campaign.

**Mandatory steps:**
1. Locate `weekly-mailer-february-24-mailchimp.html` in the local workspace.
2. **Copy it** into a new file named for the target week, for example:
   - `weekly-mailer-mar-9-15.html`
   - `weekly-mailer-apr-1-7.html`
3. **All editing goes into the new copy only.** The original is never touched.
4. Use the new copy as the working file for all subsequent steps in this workflow.

```bash
# Example duplication command
cp weekly-mailer-february-24-mailchimp.html weekly-mailer-mar-9-15.html
```

Important:
- `weekly-mailer-february-24-mailchimp.html` is the **design/structure source** — not the schedule source
- It is **not** the Mailchimp campaign itself — it is the local HTML base you edit before uploading
- Never upload changes back into `weekly-mailer-february-24-mailchimp.html`
- If the file is accidentally modified, restore it from git before continuing

---

## Step 4 — Inspect the source HTML structure
Before editing, identify the blocks that are allowed to change.

Typical editable areas:
- intro summary paragraph
- repeating featured-film sections
- event/ad promo sections
- week/date text
- book now / trailer URLs

Do **not** casually replace or remove:
- header
- footer
- phone/site/footer rows
- template shell tables
- branding assets

---

## Step 5 — Define what each featured film block needs
Each main featured-film block should include:
- 1 main poster
- 1 trailer link/button
- title
- rating/note line
- short synopsis
- link target

Do not overfill blocks with unnecessary data.
Keep the format close to the proven weekly template.

---

## Step 6 — Get film content from MovieXchange
For each featured film, gather:
- title
- rating
- rating notes
- runtime
- short synopsis
- trailer URL
- release/poster reference

Preferred output for each film:
- one short, clean marketing synopsis
- one rating line like:
  - `PG Coarse language | 96 mins | No Comps`
  - `M Offensive language & sexual references | 113 mins | No Comps`

If needed, lightly normalize punctuation and spacing for consistency with the template.

---

## Step 7 — Prepare banners correctly

> ⚠️ See the **CANONICAL FEATURED IMAGE RULE** section above (in the MovieXchange section) for full image selection rules. The rules here only cover the resize and upload gate.

For each of the 4 selected featured films:
1. You must already have confirmed a **good landscape banner** exists on MovieXchange for this film (from the film selection step).
2. Download the selected landscape banner file.
3. **MANDATORY: Resize to exactly 700px wide** using an image-processing tool before uploading.
4. Preserve aspect ratio — height scales automatically.
5. **VERIFY** the output file is 700px wide before proceeding.
6. Upload the resized file to Mailchimp file storage.
7. Use the Mailchimp-hosted URL in the campaign HTML.

### ⛔ HARD RESIZE GATE — Do not upload until this passes:

```bash
magick input.jpg -resize 700x output.jpg
identify output.jpg   # MUST confirm 700px wide (e.g. 700x394)
```

- Do NOT upload the original source file.
- Do NOT use the MovieXchange or external CDN URL directly in the HTML.
- Do NOT rely on HTML `width` attribute or CSS to display the image at 700px.
- The file uploaded to Mailchimp MUST itself be 700px wide when inspected.
- If `identify` does not show 700px wide → resize again before uploading.

---

## Step 8 — Update the intro summary block
Change the intro paragraph to match the current week’s films.

The intro should:
- mention the key featured films for the current period
- sound like the existing weekly style
- include the target week/date range when appropriate

Do not rewrite it into a completely different tone.

---

## Step 9 — Replace the main featured-film blocks
Using the previous weekly template HTML as the base, replace only the film-specific content inside each featured block.

For each featured slot, update:
- poster image
- film link
- trailer link
- title
- rating/note line
- synopsis
- schedule/date text shown under that featured film

Keep the surrounding table structure and styling unchanged.

### Critical schedule-range rule
Any schedule/date text shown under a featured film must contain **only sessions inside the exact requested campaign date range**.

Example:
- if the prompt says `March 20 – March 25`
- then the schedule text under each film may show only dates/sessions within March 20 through March 25
- do not leave older dates from the source template such as March 11–18
- do not leave future dates outside the requested range either

Before final upload:
- scan every featured-film schedule/date block
- remove any inherited template dates outside the requested range
- confirm the visible schedule text matches only the requested campaign window

### Hard validation rule before final upload
Before the campaign is considered ready, perform a strict date-range validation across the whole edited HTML.

Validation requirements:
- no film title should appear unless that film is actually in the requested Veezi date range, unless the user explicitly asked for broader marketing copy
- no schedule/date text should appear outside the requested date range
- no inherited template film blocks from earlier or later weeks may remain by accident
- no old booking/session links from out-of-range films may remain by accident

If any of those checks fail:
- do not treat the campaign as ready
- fix the HTML first
- then re-check the saved Mailchimp content again after upload

---

## Step 10 — EVENT/AD sections
### ⛔ DO NOT EDIT — leave as-is by default

The yellow promo/event cards (`EVENT/AD CARD #1–5`) are **preserved template content**.

**Default rule: do nothing to these blocks.**

Only update them if the user **explicitly asks** to change an event or ad card.

When the user does ask, update per card:
- image (`<img src>` → Mailchimp-hosted)
- title text
- promo description text
- BOOK NOW link → current Veezi purchase URL

---

## Step 11 — Update also-showing / secondary sections
If the template includes:
- also showing text
- lower-priority film mentions
- extra promo rows

Update them to reflect the actual Veezi schedule for the target period.

Do not leave stale titles from the prior week.

---

## Step 12 — Create or update the Mailchimp draft
Preferred operating mode:
- use **one working campaign draft** and keep updating it
- avoid creating unnecessary extra test campaigns

However, when safety matters:
- use a test audience like `test julian`
- keep the real audience untouched until approval

Set campaign settings:
- title
- subject line
- preview text
- from name
- reply-to
- keep as draft

---

## Step 13 — Upload the preserved-template HTML to Mailchimp
Upload the edited HTML into the working Mailchimp draft.

After upload, verify immediately that the saved HTML still contains:
- header/footer markers
- phone/footer links
- updated week/date text
- updated featured films
- updated event/ad blocks

This verification step is mandatory.

---

## Step 14 — QA checklist
Before handoff, check all of the following:

### Template preservation
- header still present
- footer still present
- phone/site/contact/footer blocks still present
- original design structure preserved

### Film correctness
- featured film list matches current Veezi week
- also showing list matches current Veezi week
- no stale previous-week titles remain
- no stale old promo text remains

### Asset correctness
- posters are Mailchimp-hosted
- posters display correctly at 700px width
- uploaded poster files themselves are intrinsically 700px wide when inspected or downloaded
- trailer links match the correct films
- BOOK NOW links point to current Veezi sessions where intended

### Campaign settings
- subject line updated
- preview text updated
- title updated
- test recipient is correct
- still in `save` / draft status
- correct audience choice for the current stage

---

## Step 15 — Send test email to tester
After the draft is prepared and verified, send a test email to the configured `tester` value.

Current default tester:
- `tungphamkindle@gmail.com`

Rules:
- treat `tester` as a variable
- if the prompt specifies a different tester, use that instead
- if not overridden, use the current default tester
- send the test only after links, posters, and schedule text have been checked
- actually trigger the Mailchimp **test send** action; do not stop at preparing the draft
- confirm the test-send API/action succeeded
- keep the campaign as a draft after the test send

---

## Step 16 — Approval handoff
When done, report back with:
- working campaign id
- campaign title
- whether it was updated in place or created fresh
- which audience is attached
- whether it is still draft-only
- any known unresolved items

---

## Recommended Default for Future Runs
Use this default pattern unless the user asks otherwise:

1. Determine week from Veezi
2. Pull current film list from Veezi
3. Use previous successful weekly Mailchimp HTML as the design base
4. Pull official film content from MovieXchange
5. Upload posters into Mailchimp
6. Replace only film/schedule-related content
7. Update the same working campaign draft in Mailchimp
8. Verify saved HTML
9. Send a test email to `tester`
10. Leave as draft

---

## Current Known Good Pattern
A better implementation pattern was established during this session:
- preserve-template rebuild based on `Weekly mailer February 24`
- update only the content blocks
- update the same working Mailchimp campaign instead of making many new ones
- verify saved HTML after each major section update

---

## File/Artifact Conventions
Suggested local workspace files:
- `weekly-mailer-feb-24-sent.html` — preserved source template
- `weekly-mailer-mar-9-15-preserved-template.html` — edited main weekly template for target week
- `weekly-mailer-mar-9-15-preserved-template-events-updated.html` — after event/ad updates
- `weekly-email-mailchimp.md` — this workflow doc

---

## Final Rule
When in doubt:
- preserve the original template
- change only film/schedule content
- verify against Veezi and MovieXchange
- keep it draft-only
