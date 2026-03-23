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
        *   **Path**: Use the file located at `./skills/weekly-facebook-post/template-fb.png`.
        *   **Rule**: Set this file as the **background-image** for the entire canvas.
    *   **Header and Footer**: Do **NOT** add any text or graphics to the header ("SHOWING THIS WEEK") or footer regions, as they are already in the template.
    *   **Poster Grid (2x5)**:
        *   **Layout**: Place 10 posters in 2 rows of 5.
        *   **Poster Dimensions**: Each poster box must be exactly **280px wide x 420px tall** (Strict 2:3 Ratio).
        *   **Cropping Guard**: Use `object-fit: contain` with a black background color for the poster box. **Never stretch the poster images.**
        *   **Border**: Apply a **4px solid golden border** (Color: `#bfa888`) and **8px rounded corners** to each poster box.
        *   **Positioning**: 
            *   **Top Margin**: Place the grid **250px** from the top (to clear the header).
            *   **Bottom Margin**: Place the grid **200px** from the bottom.
            *   **Center**: Ensure the entire grid is horizontally centered on the 1675px canvas.

3.  **Step 3: Output**
    *   **Format**: High-quality **JPG**.
    *   **Action**: Print the absolute local path to the final JPG.
    *   **Post-Action**: Do **NOT** post to Facebook during the review phase.
