# Weekly Email Mailchimp Workflow

## Purpose
Use this workflow to build the **weekly Deluxe Cinemas Mailchimp campaign** correctly and repeatably.

This workflow exists because the weekly mailer has a **high-conversion template** in Mailchimp that should be preserved. The correct process is **not** to design a brand-new simplified email. Instead:

- start from the existing successful weekly campaign HTML
- preserve the header, footer, and layout structure
- update **only** the film-related content and current-period schedule content
- leave the campaign as a **draft** for approval

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

Featured image rule:
- do not substitute random web images when MovieXchange should be the source
- for **main featured film blocks**, use the official MovieXchange **portrait poster** asset, not a landscape/banner image
- this is a strict rule for the default weekly workflow unless the user explicitly overrides it
- do not use landscape hero banners in the main featured body blocks by default
- first preference is the official theatrical/customer-facing portrait poster for the film
- never choose any candidate whose title/description/metadata includes **still** or **stills**
- treat any asset labeled **still** or **stills** as a random scene image, not a customer-facing poster
- if multiple official portrait poster options exist, choose the clearest official release poster that best represents the film to customers
- then create a new resized image file that is **actually 700px wide in pixel dimensions** before upload
- do not rely on HTML attributes, CSS, or Mailchimp display sizing alone
- upload that truly resized 700px-wide file to Mailchimp file manager and use the Mailchimp-hosted URL in the campaign

Exact featured-image workflow:
1. Log into MovieXchange.
2. Search the exact film title.
3. Open the correct NZ release for the campaign period.
4. Go to the release media / image assets.
5. Look for the official **portrait poster** asset first.
6. Exclude any candidate whose title/description/metadata contains **still** or **stills**.
   - Treat these as random scene images, not proper customer-facing posters.
   - Do not use them in the main featured body section.
7. From the remaining official poster candidates, prefer one that:
   - is clearly a theatrical or customer-facing portrait poster
   - reads cleanly at email width
   - clearly identifies the film to customers
   - does not look like a random scene still or cropped banner
8. If multiple official portrait poster files exist, choose the one that most clearly behaves like the film's main release poster.
   - Prefer filenames/descriptions that explicitly read like poster, one-sheet, theatrical poster, key art, or official poster.
   - Prefer the clearest title treatment over alternate art that is less recognisable.
9. Do not jump to a landscape banner, backdrop, or random wide image unless the user explicitly asks for that override.
10. After selecting a candidate, sanity-check the asset name/description one more time before using it.
11. When possible, visually inspect the shortlisted MXfilm candidate images instead of relying only on filenames/roles.
   - use visual judgment to decide which portrait poster will work best in the email
   - prefer the image that most clearly communicates the film to a customer at a glance
   - avoid images that are technically valid but weak, confusing, ambiguous, or not compelling in the email layout
12. If multiple versions of the same strong poster exist, prefer a source width **nearest to but above 700px**.
13. If no suitable official portrait poster exists, do a broader visual browse of the film's remaining MXfilm media for another official portrait-style poster treatment.
14. Even in that broader fallback browse, still reject any asset labeled **still** or **stills**.
15. If there is still no suitable official portrait poster, stop and flag it instead of silently substituting a landscape banner.
16. Download the selected official asset.
17. Use an image-processing tool to create a new output image whose intrinsic pixel width is **exactly 700px**.
18. Preserve aspect ratio so height scales automatically.
19. Verify the resized output file itself is 700px wide before upload.
20. Upload that resized file to Mailchimp file manager.
21. Replace the campaign image with the Mailchimp-hosted URL for the resized file.
22. Do not leave Veezi thumbnail posters, random website posters, original full-size source images, still/stills assets, textless backdrops, wrong-aspect-ratio substitute art, or landscape-banner fallbacks in the main featured body blocks unless the user explicitly overrides the default rule.

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

### Coverage rule — include all and only films showing in Veezi for the target period
Do not stop at the number of featured-film blocks that existed in the previous weekly template.

If Veezi shows more films in the target date range than the old template currently has featured slots, the workflow must be expanded so all relevant films for that period are represented correctly.

Example:
- if the old template has 3 film blocks
- but Veezi shows 5 films for that week
- then the updated email must cover all 5 films

This means you may need to:
- duplicate an existing film block
- preserve the surrounding styling and layout
- add additional film sections so the template matches the actual weekly lineup

Do not leave films out just because the older campaign had fewer slots.
Do not include films that are **outside** the requested date range just because they were present in the old template, in a nearby week, or in a broader campaign concept.

### Main featured-section length rule
To avoid overly long emails and Gmail clipping, the main featured section should show a **maximum of 4 films by default**.

Meaning:
- do not keep expanding the top featured-film area indefinitely
- even if more than 4 films are playing in the period, cap the main featured section at 4 films by default
- choose the top 4 films for the main section
- do not make the intro copy block list more than those 4 featured films if the top section is capped at 4
- if the user explicitly overrides the featured-film count in the prompt, follow the prompt instead
- otherwise, the default rule is strict: exactly the main 4 featured films belong in the main body section

Other films can still be represented elsewhere in the email structure, but the main featured block area should stay capped unless the user explicitly overrides that default.

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

## Step 3 — Pull the proven Mailchimp source template
Find the prior successful weekly campaign HTML in Mailchimp.

For example:
- `Weekly mailer February 24`

Important:
- the previous campaign is the **design/template source**
- it is **not** the schedule source

Save the HTML locally before editing.

Example local file naming:
- `weekly-mailer-feb-24-sent.html`

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

## Step 7 — Prepare posters correctly
For each featured film:
1. download the poster from MovieXchange
2. choose a good-quality variant
3. resize the poster image to **700px wide** using an actual image-processing/export step
4. preserve aspect ratio
5. confirm the exported file's intrinsic pixel dimensions are 700px wide
6. upload that resized poster file to Mailchimp file storage
7. use the Mailchimp-hosted URL in final campaign HTML

### Important image rule
The workflow requirement is:
- **All featured film images must be 700px wide**

Practical interpretation:
- source image may be larger
- final image asset used in the email must be a newly exported image file whose intrinsic width is **actually 700 pixels**
- email display width should also be 700px
- ratio should remain intact
- height should scale automatically from the source image
- do not satisfy this rule with HTML width, CSS width, or Mailchimp display sizing alone
- if someone downloads the image used in the email, that downloaded file should still be 700px wide

### Featured image selection rule
To reduce email height and avoid Gmail clipping:
- visually inspect MovieXchange/MXfilm image options when available; do **not** rely solely on API tags or metadata
- choose **landscape banners** instead of portrait movie posters for featured film blocks
- highest priority: choose an **official** banner whose title/description/metadata clearly includes **"Social Media"**
- do **not** use any asset whose title/description/metadata includes **"still"** or **"stills"**
- within the valid candidates, prefer a landscape/wide asset that reads cleanly in email and ideally includes the film title/logo
- if no suitable **Social Media** asset exists, fall back to **Web Materials** assets
- when falling back to Web Materials, still avoid scene-still type assets and prefer clean title-bearing banners or other clearly promotional wides
- if no suitable Social Media or Web Materials banner exists, check whether MXfilm has another official wide asset such as a **Backdrop** that is clearly intended promotional art and not just a random still
- if the currently chosen image is later found to be the wrong orientation, the wrong banner, or a portrait poster used where a banner is required, go back to MXfilm and browse/select another official banner asset
- do **not** try to rescue the wrong orientation with CSS-only sizing
- do **not** crop a portrait poster into a fake banner unless the user explicitly asks for that
- if multiple suitable official wide assets exist, prefer the one that will read best at 700px wide in email
- when choosing among multiple versions of the same good banner, pick the source width nearest to but above 700px when available, then resize to **700px wide**
- keep aspect ratio intact
- use portrait posters only as a final fallback if neither suitable Social Media nor suitable Web Materials banner assets exist

### Implementation note — actual file resizing
Use a real image-processing tool before uploading to Mailchimp.

Example with ImageMagick:

```bash
magick input.jpg -resize 700x output.jpg
```

Recommended verification step:

```bash
identify output.jpg
```

Expected result should show the resized file is **700px wide** (for example `700x394`).

Rules:
- do not upload the original large source file and rely on HTML width alone
- upload the resized `output.jpg` file instead
- keep aspect ratio intact unless the user explicitly asks for cropping

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

## Step 10 — Update EVENT/AD sections
The yellow promo/event cards near the lower part of the template must also be updated to the **current period**.

For each event/ad block, update:
- image
- title
- promo text
- BOOK NOW link

Best practice:
- use current-week Veezi purchase URLs
- use current films, not stale previous-week promotions

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
