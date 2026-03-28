# Payload Examples

This document provides example `campaign_payload.json` files for different scenarios.

## Standard Testing Mode

Used when you want to test the campaign and send a test email.

```json
{
  "dates": "March 26 to March 29",
  "featured_films": ["I Swear", "The North"],
  "now_showing": [
    "The Time Traveller's Guide to Hamilton Gardens",
    "The Devil Wears Prada 2",
    "Caterpillar"
  ],
  "test_email": "user@example.com"
}
```

**Behavior:**
- Script fetches data for specified date range
- Builds HTML with all films
- Creates Mailchimp campaign draft
- Sends test email to `test_email`

---

## Production Mode (Draft Only)

Used when ready to push to Mailchimp without sending test.

```json
{
  "dates": "March 26 to March 29",
  "featured_films": ["I Swear", "The North"],
  "now_showing": [
    "The Time Traveller's Guide to Hamilton Gardens",
    "The Devil Wears Prada 2",
    "Caterpillar"
  ]
}
```

**Behavior:**
- Same as testing, but skips test email send
- Campaign remains as draft in Mailchimp

---

## Single Featured Film

When you only have one featured film to highlight.

```json
{
  "dates": "March 26 to March 29",
  "featured_films": ["I Swear"],
  "now_showing": [
    "Tenor",
    "Holy Days",
    "Epic: Elvis Presley in Concert"
  ],
  "test_email": "your-email@example.com"
}
```

**Behavior:**
- Only Featured Film One section populated
- Featured Film Two section remains empty/default

---

## Many Now Showing Films

When you have a full lineup of films.

```json
{
  "dates": "March 26 to March 29",
  "featured_films": ["I Swear", "The North"],
  "now_showing": [
    "Turner and Constable",
    "Tenor",
    "Epic: Elvis Presley in Concert",
    "Holy Days",
    "Mid-Winter Break",
    "Fackham Hall"
  ],
  "test_email": "your-email@example.com"
}
```

**Behavior:**
- Script generates blocks for all films
- Each film gets its own row in Now Showing section

---

## Film Not Found in Veezi

When a film doesn't exist in Veezi metadata.

```json
{
  "dates": "March 26 to March 29",
  "featured_films": ["New Release Film"],
  "now_showing": [
    "Unknown Film",
    "Tenor"
  ],
  "test_email": "your-email@example.com"
}
```

**Fallback behavior:**
- Title: Uses the film name from payload as-is
- Rating: "TBC" (to be classified)
- Synopsis: "{Film Title} is showing at Deluxe Cinemas."
- Poster: Falls back to Deluxe Cinemas scrape → TMDB → placeholder

---

## No Showtimes in Date Range

When Veezi has no sessions for the specified dates.

```json
{
  "dates": "December 25 to December 31",
  "featured_films": ["I Swear"],
  "now_showing": ["Tenor"],
  "test_email": "your-email@example.com"
}
```

**Fallback behavior:**
- Showtime display: "Check website for times."
- Booking link: Uses `https://deluxecinemas.co.nz/` as fallback

---

## Multi-Month Date Range

When campaign spans across months.

```json
{
  "dates": "March 26 to April 5",
  "featured_films": ["I Swear"],
  "now_showing": ["Tenor"],
  "test_email": "your-email@example.com"
}
```

**Behavior:**
- Script parses both start and end months
- Filters sessions that fall within the entire range

---

## Date Format Variations

The script handles these date formats:

| Format | Example |
|--------|---------|
| "March 26 to March 29" | Single month |
| "March 26 to April 5" | Cross-month |
| "Mar 26 to Mar 29" | Abbreviated months |
| "march 26 to march 29" | Lowercase |

---

## Important Notes

1. **Film matching**: The script does fuzzy matching against Veezi metadata. "I Swear" will match "I Swear (2025)" in Veezi.

2. **Order matters**: Featured films are processed in order, first = Featured Film One, second = Featured Film Two.

3. **Now showing order**: Films appear in the email in the order specified in the array.

4. **Image fallback chain**: 
   - Veezi poster → Deluxe Cinemas scrape → TMDB banner → Placeholder image

5. **Test email required**: Include `test_email` to receive a test copy. Without it, script skips test send.