# weekly-email-mailchimp

This repository contains the workflow and assets for generating the **weekly Deluxe Cinemas Mailchimp email campaign**.

---

## 🤖 AI Agent — Start Here

When an AI agent is pointed to this repository, follow these steps:

1. **Read `weekly-email-mailchimp.md`** — this is the **main workflow document**. It contains all rules, steps, systems, and critical lessons. Follow it exactly.
2. **Read `weekly-mailer-february-24-mailchimp.html`** — this is the **read-only master HTML template**. Never edit it directly. Always duplicate it first.
3. **Check for any `.js` or `.py` scripts** in the repo root — if present, they are helper tools for this workflow. Read their comments/docstrings to understand what they do and when to run them.

---

## 📁 File Structure

| File | Purpose | Editable? |
|---|---|---|
| `README.md` | Repo overview + AI entry point guide | ✅ Yes |
| `weekly-email-mailchimp.md` | **Main workflow — read this first** | ✅ Yes (workflow updates only) |
| `weekly-mailer-february-24-mailchimp.html` | Master HTML email template | ⛔ **NEVER edit directly** |
| `weekly-mailer-*.html` | Working copies for each campaign week | ✅ Yes (generated per run) |
| `*.js` / `*.py` | Helper scripts (if present) | ✅ Run as instructed |
| `.mailchimp.env` | Mailchimp API key (local only, gitignored) | 🔒 Secret — never commit |
| `.mxfilm.env` | MovieXchange credentials (local only, gitignored) | 🔒 Secret — never commit |

---

## 🔁 Workflow Summary

The full workflow lives in `weekly-email-mailchimp.md`. Here's the high-level overview:

1. **Determine target week** — user provides `DATE_RANGE`
2. **Extract films from Veezi** — find what's showing in that date range
3. **Duplicate the master HTML template** — create `weekly-mailer-[dates].html`
4. **MovieXchange pass** — select banners, gather content, resize + upload to Mailchimp
5. **Update HTML** — swap in new films, banners, dates, links
6. **Push to Mailchimp draft** — upload HTML, verify it saved correctly
7. **QA + test send** — send test to `tester` email, keep as draft
8. **Approval handoff** — report campaign ID, status, audience

---

## ⚙️ How to Invoke

Use this prompt to start the workflow:

```
Fetch and follow the workflow from this URL:
https://github.com/P-Tung/weekly-email-mailchimp
DATE_RANGE: [e.g. March 13 – March 20]
TESTER: 
```

The AI agent should:
- Read this `README.md` first for orientation
- Then read `weekly-email-mailchimp.md` for the full workflow
- Then proceed step by step as documented
