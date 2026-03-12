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

### 🧠 Primary Rule: Use Image Recognition to Judge Marketing Quality First

Landscape ratio is a **minimum technical requirement**, not the selection goal.

The AI agent MUST use **image recognition (visual understanding)** to evaluate every candidate image and ask:

> **"Would a cinema customer see this image and immediately know what film it is promoting?"**

- ✅ YES → it is a marketing banner candidate → then check technical specs
- ❌ NO → it is NOT a marketing banner → reject it immediately, regardless of dimensions

**A landscape scene still, a performance photo, a raw movie capture — these all FAIL the marketing test even if they are 1920x1080.**

---

### ✅ What a Good Marketing Banner Looks Like (Image Recognition Criteria)

When you open and view the full image, ask yourself these questions:

| Question | Required answer |
|---|---|
| Is the **film title or logo** visually present on the image itself? | **YES** — text or logo must be embedded/burned in |
| Does it look like **official promotional/marketing art**? | **YES** — designed to promote the film, not document it |
| Could a customer identify this film **just from the image alone**? | **YES** — no guessing required |
| Is it a **scene still, behind-the-scenes, or performance capture**? | **NO** — reject if yes, even if landscape |
| Is it a **portrait poster** (taller than wide)? | **NO** — reject if yes |
| Is the image **clean and readable at 700px wide**? | **YES** — not dark, muddy, or awkwardly cropped |

> 🎯 **Ask yourself:** If you removed the film title text below the image, would a customer still know what film this is? If NO → reject the image.

---

### ✅ Technical Requirements (check AFTER marketing quality passes)

| Criteria | Requirement |
|---|---|
| **Orientation** | Width > Height (landscape — NOT portrait) |
| **Minimum width** | At least 700px wide (ideally 1000px+ for resize quality) |
| **Aspect ratio** | Roughly 16:9, 2:1, or similar wide cinematic ratio |

---

### 🎯 Best image types (ideal marketing banners)

- **Official Trailer Thumbnails** — almost always have the film title burned in
- **Social Banners** — designed for digital marketing, title always included
- **Key Art / Main Art** — hero promotional image with title
- **Actor callout banners** — acceptable only if the **film title is also visible** (e.g. "JACKI WEAVER — HOLY DAYS")

Asset name patterns to prioritise:
- `OfficialTrailerThumbnail` / `OfficialTr...`
- `Social banner` / `SocialBanner`
- `KeyArt` / `MainArt`
- `PromoBanner` / `Promo`
- Anything tagged **Preferred** + **Official**

---

### ❌ Auto-Reject (any of these = immediate disqualification)

- Scene still or raw movie capture — **even if landscape**
- Performance photo / event photo / behind-the-scenes — **even if landscape**
- Portrait poster (taller than wide)
- Asset label contains "still" or "stills"
- Film title/logo NOT visible on the image
- Under 700px wide
- Too dark, blurry, or cluttered to read at 700px

---

### Why landscape?
The email layout is wide (700px). A landscape banner fills it correctly. A portrait poster creates a tall, broken email block. But landscape alone is not enough — marketing quality is the primary filter.

---

### ⚠️ AI Vision Requirement — MUST be followed

The agent running this workflow **MUST have browser access and visual (image recognition) capability**.

- **Do NOT evaluate images from filenames or small grid thumbnails alone**
- **For every candidate image: click to open/preview the full-size image, then visually assess it**
- Apply the marketing quality questions above to the full image before checking dimensions
- If your session does not support browser vision → stop and report that banner selection cannot be completed

### Mandatory image selection steps (MUST follow in order):

1. Log into MovieXchange at `https://film.moviexchange.com/`
2. Search the exact film title and open the correct NZ release.
3. Scroll to the **Media** section on the film detail page.
4. The Media section has tabs: `All Media | Posters | Stills | Videos | Social Media | Web Materials | Adv. & Promos | Other`

#### 🔍 3-Pass Tab Strategy (follow in order):

**Pass 1 — Web Materials tab (start here)**
- Click the **Web Materials** tab
- Focus first on items tagged **Preferred** + **Official**
- For each candidate: **open the full image → apply marketing quality check → then check dimensions**
- Prioritise: `OfficialTrailer`, `KeyArt`, `Promo`, `Banner` in asset names
- ❌ Reject immediately: scene stills, performance photos, portrait posters, anything without title on image
- ✅ Good marketing banner found → use it, stop searching
- None qualify → move to Pass 2

**Pass 2 — Social Media tab**
- Click the **Social Media** tab
- For each candidate: **open the full image → apply marketing quality check → then check dimensions**
- Prioritise: `Social banner`, `SocialBanner`, trailer thumbnails, promo banners
- ❌ Reject: scene stills, performance photos, portraits, no title on image
- ✅ Good marketing banner found → use it, stop searching
- None qualify → move to Pass 3

**Pass 3 — All Media tab (last resort)**
- Click the **All Media** tab
- Skip grid items visually identified as: portrait posters, stills, videos, headshots, performance photos
- For remaining candidates: **open the full image → apply marketing quality check → then check dimensions**
- ✅ Good marketing banner found → use it
- None qualify → **skip this film entirely** (see STOP rule below)

#### ✅ Selection priority when multiple images pass:
1. Official Trailer Thumbnails with title on image
2. Social Banners with title on image
3. Key Art / Promo banners with title on image
4. Actor callout banners where film title is also visible
5. Among equals → pick the one with source width nearest to but above 700px

### ⛔ STOP — If Pass 3 (All Media) still yields no good banner:

**Do NOT under any circumstances:**
- use a portrait poster as a fallback
- crop a portrait poster into a fake banner
- use a scene still
- use a Veezi thumbnail
- use any image that does not have the film title clearly visible

**Mandatory action — skip and move on:**
1. ❌ Mark this film as **no good banner available**
2. ⏭️ **Move to the next film** on the Veezi ranked list
3. 🔍 Run the full 3-pass tab strategy again for that next film
4. Repeat until you have **4 films each with a confirmed good banner**

> There is no fallback image option. If all 3 passes fail → the film is skipped. No exceptions.

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

## Step 2 — Extract & rank films from Veezi
Open the Veezi sessions page. Extract all films in the date range.

Output:
- full list of titles showing in range, rough session counts, purchase URLs

Rank films by: new release status, session count, marketability.
This ranked list feeds directly into Step 3. Do NOT include films outside the requested date range.

### ⛔ HARD RULE — EXACTLY 4 FEATURED FILMS
The main featured section MUST show **exactly 4 films**. Not 3. Not 5.
- The intro copy block MUST also list exactly those same 4 films.
- Override only if the user explicitly asks.

### Layout rule — extra films
If more films need to be shown, duplicate featured blocks **above the Free Parking block** only.
- Do NOT repurpose or overwrite anything below Free Parking.

### Footer preservation rule
Everything from the **Free Parking** block downward stays untouched by default.
- Do not edit, insert films into, or adjust that area unless the user explicitly asks.


---

## Step 3 — Duplicate the master template

⛔ **NEVER edit `weekly-mailer-february-24-mailchimp.html` directly.**

```bash
cp weekly-mailer-february-24-mailchimp.html weekly-mailer-mar-9-15.html
```

- Name the new file for the target week (e.g. `weekly-mailer-apr-1-7.html`)
- All editing goes into the new copy only
- If the master is accidentally modified, restore from git before continuing

Then immediately inspect the new file to identify editable vs. locked blocks:

| Editable | Do NOT touch |
|---|---|
| Intro summary paragraph | Header |
| Featured film sections | Footer |
| Event/ad promo sections | Phone/site/footer rows |
| Week/date text | Template shell tables |
| Book now / trailer URLs | Branding assets |

---

## Step 4 — MovieXchange pass: select films + gather content + prepare banners

> **One continuous pass per film.** Do not make separate trips to MovieXchange.

Work down the Veezi ranked list. For each candidate film:

**4a — Banner check (follow the 3-pass tab strategy in CANONICAL FEATURED IMAGE RULE)**
1. Log into MovieXchange, search the exact film title
2. Run: Social Media tab → Web Materials tab → All Media tab (in order)
3. ❌ No good landscape banner → skip this film, move to the next ranked film
4. ✅ Good banner found → continue to 4b **without leaving the page**

**4b — Gather all film content (while on the same MovieXchange page)**
- title, rating, rating notes, runtime
- short marketing synopsis
- trailer URL (prefer Deluxe Cinemas site; fall back to MovieXchange)

Rating line format: `PG Coarse language | 96 mins | No Comps`

**4c — Download, resize, upload banner**
```bash
magick input.jpg -resize 700x output.jpg
identify output.jpg   # MUST show 700px wide before proceeding
```
- Upload the resized file to **Mailchimp file storage**
- Note the Mailchimp-hosted URL — this is what goes in the HTML

⛔ Do NOT upload the original source file.
⛔ Do NOT use a MovieXchange or external CDN URL in the HTML.
⛔ Do NOT rely on HTML `width` or CSS — the uploaded file itself must be 700px wide.

Repeat 4a → 4b → 4c until **exactly 4 films** are confirmed with content + hosted banner URL.

---

## Step 5 — Update all HTML content in the working file

With all 4 films' content and Mailchimp banner URLs ready, edit the working HTML in one pass:

**5a — Intro copy block**
- Mention exactly the 4 featured films, current date range, weekly tone
- Only list films actually showing in the requested date range

**5b — Featured film blocks (all 4)**
For each slot, update:
- poster image (Mailchimp-hosted URL)
- film link (Deluxe Cinemas film page)
- trailer link (verified)
- title, rating/note line, synopsis
- schedule/date text — **only sessions within the exact requested date range**

Keep surrounding table structure and styling unchanged.

**5c — Also-showing / secondary sections**
Update to the remaining Veezi films for this period. Remove all stale prior-week titles.

**5d — Date-range validation (mandatory before saving)**
Scan the entire HTML and confirm:
- no film appears outside the requested Veezi date range
- no schedule/date text outside the range remains
- no inherited template blocks from old weeks remain
- no old booking/session links from out-of-range films remain

Fix any failures before proceeding.

---

## Step 6 — Push to Mailchimp draft

**6a — Create or update the working draft**
- Use **one working campaign draft** — update in place, avoid creating extras
- Use a test audience (e.g. `test julian`) until approval
- Set: title, subject line, preview text, from name, reply-to → keep as **draft**

**6b — Upload HTML and verify immediately**
After uploading, confirm the saved HTML still contains:
- header/footer markers
- phone/footer links
- updated week/date text and featured films

If Mailchimp regenerated any content → fix and re-upload.

---

## Step 7 — QA checklist + test send

**QA checklist:**

| Area | Check |
|---|---|
| **Template** | Header, footer, phone/contact blocks present; design structure intact |
| **Films** | Featured + also-showing match Veezi; no stale titles from prior week |
| **Assets** | Posters Mailchimp-hosted, files intrinsically 700px wide, trailer/BOOK NOW links correct |
| **Settings** | Subject line, preview text, title updated; still draft; correct audience |

**Test send (immediately after QA passes):**
- Send test email to `tester` (default: `tungphamkindle@gmail.com`)
- Use prompt-specified tester if provided
- Actually trigger the Mailchimp **test send** action — do not stop at draft
- Confirm the test-send API call succeeded
- Keep campaign as **draft** after test send

---

## Step 8 — Approval handoff
Report back with:
- campaign ID and title
- updated in place or created fresh
- which audience is attached
- draft-only status confirmed
- any known unresolved items

---

## File/Artifact Conventions
- `weekly-mailer-february-24-mailchimp.html` — **read-only master template** (never edit)
- `weekly-mailer-mar-9-15.html` — working copy for target week
- `weekly-email-mailchimp.md` — this workflow doc

---

## Final Rule
When in doubt:
- preserve the original template
- change only film/schedule content
- verify against Veezi and MovieXchange
- keep it draft-only
