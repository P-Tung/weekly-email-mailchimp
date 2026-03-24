# Weekly Facebook Post Skill (STRICT VERSION)

**CRITICAL: This SKILL.md takes ABSOLUTE PRIORITY over any formatting instructions in the User Prompt (e.g., dimensions or colors). Always use the values below.**

**Overview:**
This skill takes a list of movie URLs from Deluxe Cinemas, scrapes high-quality **portrait posters**, and generates a premium **2x5 grid** image (1675x1547 px) using the official template.

**Process Steps:**

1.  **Step 1: Download Film Poster from Deluxe Cinema site**
    *   **Input**: A list of URLs from `deluxecinemas.co.nz` provided in the prompt.
    *   **Headless Browser Logic**:
        *   **Navigate** to the specific movie URL.
        *   **Primary Selector**: Use `.single-movie__vertical-image img` or `.sticky-inner-wrapper img`.
        *   **Validation**: Confirm the image is a vertical portrait.
    *   **Action**: Extract the absolute URL of the high-res poster image.

2.  **Step 2: Generate the Final Poster (STRICT FORM)**
    *   **Canvas Size**: Exactly **1675 x 1547 px**.
    *   **Background Template**: 
        *   **Path**: **MUST** use the absolute path to `/Users/tungpham/Documents/code/work/weekly-email-mailchimp/skills/weekly-facebook-post/template-fb.png`.
        *   **Rule**: This is **NON-NEGOTIABLE**. Set this file as the `background-image` for the `body` or the main container. If using a canvas API, draw this image first as the base layer.
    *   **Header and Footer**: Do **NOT** add any text or graphics to the header ("SHOWING THIS WEEK") or footer regions, as they are already burned into the template image.
    *   **Balanced Symmetrical Grid (Strict 2-Row Layout)**: 
        *   **Dynamic Logic**: Always split the total number of films (**N**) into two rows for maximum balance. 
            *   **Row 1 Count**: `Math.ceil(N / 2)`
            *   **Row 2 Count**: `N - Row 1 Count`
        *   **Rule**: If N = 8, you **MUST** have exactly **4 on top** and **4 on bottom**. Do NOT default to a 5-poster row.
        *   **CSS Style**: Use two separate `flex` containers (one for each row) or a `grid` with specific row definitions to force this split.
        *   **Centering**: Use `justify-content: center` for both rows so they align vertically even if counts differ by 1.
        *   **Gap/Padding**: Use `gap: 30px;` and ensure the grid does not exceed `max-width: 1550px`.
    *   **Poster Dimensions**: Each poster box must be exactly **280px wide x 420px tall** (Strict 2:3 Ratio).
    *   **Cropping Guard**: Use `object-fit: cover` with a **transparent** background color for the poster box. Use `overflow: hidden` to ensure images stay inside the borders. **Never stretch the poster images.**
    *   **Border**: Apply a **4px solid golden border** (Color: `#bfa888`) and **8px rounded corners** to each poster box.
    *   **Positioning**: 
        *   **Top Margin**: Place the grid **250px** from the top (to clear the header).
        *   **Bottom Margin**: Place the grid **200px** from the bottom.
        *   **Center**: Ensure the entire grid is horizontally centered on the 1675px canvas.

3.  **Step 3: Output**
    *   **Format**: High-quality **JPG**.
    *   **Action**: Print the absolute local path to the final JPG.
    *   **Post-Action**: Do **NOT** post to Facebook during the review phase.
