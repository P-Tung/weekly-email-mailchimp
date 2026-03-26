---
name: Build Cinema Email
description: Build and send weekly cinema email campaign to Mailchimp. Use when marketer provides: dates, featured films (1-2), now showing films list, and optional test_email for testing. The script fetches real showtimes from Veezi API, scrapes film metadata (posters, ratings, synopses), and injects data into the HTML template with image upload to Mailchimp CDN.
---

# Build Cinema Email Skill

A 1-shot workflow to build and send a cinema email campaign. The script automatically fetches film data, processes images, and pushes to Mailchimp.

## Quick Start

```bash
# 1. Create campaign payload file
cat > campaign_payload.json << 'EOF'
{
  "dates": "March 26 to March 29",
  "featured_films": ["I Swear", "The North"],
  "now_showing": ["Tenor", "Holy Days", "Epic: Elvis Presley in Concert"],
  "test_email": "tungphamkindle@gmail.com"
}
EOF

# 2. Run the build script
node scripts/build_and_push.js campaign_payload.json
```

---

## ⚠️ Required: Environment Variable

Before running, you must set the Maton API key:

```bash
# Create .env.local file
echo "MATON_API_KEY=your_key_here" > .env.local

# Or set in environment
export MATON_API_KEY=your_key_here
```

The script will fail with an error if `MATON_API_KEY` is not set.

---

## Marketer Prompt Format

Marketers will send prompts in this format:

```
Please clone this repository:
https://github.com/P-Tung/weekly-email-mailchimp.git (if not already cloned), 
and pull the latest code, navigate into it, and use the Build Cinema 
Email skill to generate the new weekly campaign.

Execution Context:
- Dates: [date range]
- Workflow Mode: testing (Draft + Test send to [email])

Films to include:
- Featured film one: [film name]
- Featured film two: [film name]
- Now showing films:
- [film 1]
- [film 2]
- [film 3]
```

### Example Prompt:

```
Please clone this repository:
https://github.com/P-Tung/weekly-email-mailchimp.git

Execution Context:
- Dates: March 26 to April 29
- Workflow Mode: testing (Draft + Test send to tungphamkindle@gmail.com)

Films to include:
- Featured film one: I Swear
- Featured film two: The North
- Now showing films:
- The Time Traveller's Guide to Hamilton Gardens
- The Devil Wears Prada 2
- Caterpillar
```

---

## How It Works

```
┌──────────────┐    ┌─────────────────────┐    ┌──────────────┐
│   Payload    │───▶│  build_and_push.js  │───▶│  Mailchimp   │
│   (JSON)     │    │                     │    │  Campaign    │
└──────────────┘    └──────────┬──────────┘    └──────────────┘
                               │
    ┌──────────┬────────┬───────┴───────┬────────┐
    ▼         ▼        ▼             ▼        ▼
┌────────┐ ┌───────┐ ┌────────┐ ┌──────────┐ ┌────────┐
│ Veezi │ │Deluxe │ │  TMDB  │ │ImageMagick│ │ Mailchimp│
│Sessions│ │Cinema │ │(fallback)│ │(resize)  │ │  CDN    │
└────────┘ └───────┘ └────────┘ └──────────┘ └────────┘
```

**Process:**
1. Parse payload (dates, films, test_email)
2. Fetch Veezi sessions for date range
3. Scrape Veezi metadata (posters, ratings, synopses)
4. Build HTML blocks for each film
5. Fetch/upload images (with fallbacks)
6. Push to Mailchimp draft
7. Send test email (if test_email provided)

---

## Payload Format

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `dates` | string | Date range for showtimes | "March 26 to March 29" |
| `featured_films` | array | Films to feature (1-2) | ["I Swear", "The North"] |
| `now_showing` | array | Full film list | ["Tenor", "Holy Days"] |

### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `test_email` | string | Email for test send | "you@example.com" |

### Example Payload

```json
{
  "dates": "March 26 to March 29",
  "featured_films": ["I Swear", "The North"],
  "now_showing": [
    "The Time Traveller's Guide to Hamilton Gardens",
    "The Devil Wears Prada 2",
    "Caterpillar"
  ],
  "test_email": "tungphamkindle@gmail.com"
}
```

---

## Template Structure

**Source template:** `cinema-email-master-template-2.html`

The email has these sections:

| Section | Description | mc:edit Tags |
|---------|-------------|--------------|
| Preheader | Hidden preview text | `preheader_text` |
| Header | Deluxe Cinemas logo | `header_image` |
| Intro | Opening message + date range | `intro_text_top` |
| Featured Films (2) | Hero film blocks | `featured_film_*` |
| Now Showing | Film list with posters | `movie_*` |
| Coming Soon | Upcoming releases | `coming_soon_*` |
| Promo | Special events | `promo_*` |
| Footer | Contact + map | `footer_map` |

**Reference:** See [references/template-tags.md](references/template-tags.md) for complete tag list

---

## Data Sources

### Primary: Veezi
- **Sessions API**: Showtimes, booking URLs
- **Metadata scraping**: Posters, ratings, synopses

### Fallbacks (in order)
1. **Deluxe Cinemas** - Scrapes deluxecinemas.co.nz for posters
2. **TMDB** - Fetches high-res banners for featured films
3. **Placeholder** - Fallback image when all sources fail

**Reference:** See [references/data-sources.md](references/data-sources.md) for details

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Film not in Veezi | Uses title as-is, rating "TBC", generic synopsis |
| No showtimes in date range | Shows "Check website for times." |
| Image fetch fails | Tries next source → placeholder |
| ImageMagick fails | Uploads original size |

---

## Output Files

| File | Description |
|------|-------------|
| `final_dynamic_campaign.html` | Generated HTML (created by script) |

---

## Examples

### Basic Test Campaign
```json
{
  "dates": "March 26 to March 29",
  "featured_films": ["I Swear"],
  "now_showing": ["Tenor", "Holy Days"],
  "test_email": "your-email@gmail.com"
}
```

### Production (No Test)
```json
{
  "dates": "March 26 to March 29",
  "featured_films": ["I Swear", "The North"],
  "now_showing": ["Tenor", "Holy Days", "Epic: Elvis Presley in Concert"]
}
```

### Full Lineup
```json
{
  "dates": "March 14 to March 20",
  "featured_films": ["I Swear", "Project Hail Mary"],
  "now_showing": [
    "Turner and Constable",
    "Tenor",
    "Epic: Elvis Presley in Concert",
    "Holy Days",
    "Mid-Winter Break",
    "Fackham Hall"
  ],
  "test_email": "tungphamkindle@gmail.com"
}
```

**More examples:** See [references/payload-examples.md](references/payload-examples.md)

---

## Important Notes

1. **Film matching**: Script does fuzzy match - "I Swear" matches "I Swear (2025)" in Veezi
2. **Date parsing**: Handles "March 26 to March 29", "Mar 26 to Apr 5", etc.
3. **Image sizes**: Featured = 700x, Now Showing = 160x240
4. **Test required**: Include `test_email` to receive test copy
5. **Mailchimp draft**: Script pushes to most recent saved draft campaign

---

## Files

| Path | Description |
|------|-------------|
| `cinema-email-master-template-2.html` | Source HTML template |
| `scripts/build_and_push.js` | Build and push script |
| `goal-example/goal-example.html` | Reference output (March 14-20 example) |
| `skills/build_cinema_email/references/template-tags.md` | mc:edit tag reference |
| `skills/build_cinema_email/references/payload-examples.md` | Payload examples |
| `skills/build_cinema_email/references/data-sources.md` | Data source docs |