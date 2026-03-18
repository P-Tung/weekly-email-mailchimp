# Cinema Email Mailer - AI Agent Prompt Template

Use this template to brief your AI agent. Fill in the placeholders in square brackets, then paste the full prompt to the agent. The agent must refer to sections of the mailer using **exactly** these names (they match the metadata in `cinema-email-master-template.html`).

---

## Section naming conventions (required)

The mailer is built from these named sections. The agent must use these names when editing or referring to content:

| Section | Name to use |
|--------|-------------|
| First text block below header | **Intro text box** |
| Featured hero films (repeatable) | **Featured film one**, **Featured film two**, **Featured film three**, … |
| Now Showing programme (repeatable) | **Now showing film 1**, **Now showing film 2**, **Now showing film 3**, … |
| Coming Soon (repeatable by film) | **Coming soon: film one**, **Coming soon: film two**, **Coming soon: film three**, … |
| Special events & offers (repeatable) | **Special event one**, **Special event two**, **Special event three**, … |

---

## Prompt template (fill placeholders and send to agent)

```
Build/update the cinema email using the master template. Use only the section names defined in the template metadata.

**Intro text box**
[Your instructions or content for the intro paragraph, e.g. greeting, date range, key highlights.]

**Featured film one**
[Title, tagline, rating, description, hero image URL, trailer URL, book URL.]

**Featured film two**
[Same fields as above, or "omit" if not using.]

**Featured film three**
[Same fields as above, or "omit" if not using.]

**Now showing film 1**
[Title, tagline, rating, description(s), poster URL, showtimes note, trailer URL, book URL.]

**Now showing film 2**
[Same fields, or "omit" if not using.]

**Now showing film 3**
[Same fields, or "omit" if not using.]

**Coming soon: film one**
[Poster URL, short description, learn-more URL. Use the correct Coming soon layout: one, two, or three films per row.]

**Coming soon: film two**
[Same fields, or "omit" if not using.]

**Coming soon: film three**
[Same fields, or "omit" if not using.]

**Special event one**
[Title, description, image URL, CTA URL.]

**Special event two**
[Same fields, or "omit" if not using.]

**Special event three**
[Same fields, or "omit" if not using.]

Additional instructions: [Any other rules, date range for sessions, branding notes, etc.]
```

---

## Quick reference - exact names for copy-paste

- **Intro text box**
- **Featured film one** / **Featured film two** / **Featured film three** / …
- **Now showing film 1** / **Now showing film 2** / **Now showing film 3** / …
- **Coming soon: film one** / **Coming soon: film two** / **Coming soon: film three** / …
- **Special event one** / **Special event two** / **Special event three** / …
