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
    *   **Background Template (MANDATORY)**: 
        *   **Path**: **MUST** use the absolute path to `/Users/tungpham/Documents/code/work/weekly-email-mailchimp/skills/weekly-facebook-post/template-fb.png`.
        *   **CRITICAL FAIL CONDITION**: If the final image has a white, black, or plain background, it is a **FAILURE**. You MUST see the "SHOWING THIS WEEK" header and red footer from the template file.
        *   **Rule**: The template **MUST** be the first thing drawn on the 1675 x 1547 canvas. All movie posters must be layered **on top** of it.
    *   **Header and Footer**: Do **NOT** add any text or graphics to the header ("SHOWING THIS WEEK") or footer regions, as they are already burned into the template image. Ensure posters sit in the center space and do not overlap these areas.
    *   **Balanced Symmetrical Grid (Strict 2-Row Layout)**: 
        *   **Dynamic Logic**: Always split the total number of films (**N**) into two rows for maximum balance. 
            *   **Row 1 Count**: `Math.ceil(N / 2)`
            *   **Row 2 Count**: `N - Row 1 Count`
        *   **Rule**: If N = 8, you **MUST** have exactly **4 on top** and **4 on bottom**. Do NOT default to a 5-poster row.
        *   **CSS Style**: Use two separate `flex` containers (one for each row) or a `grid` with specific row definitions to force this split.
        *   **Centering**: Use `justify-content: center` for both rows so they align vertically even if counts differ by 1.
        *   **Gap/Padding**: Use `gap: 30px;` and ensure the grid does not exceed `max-width: 1550px`.
        *   **Vertical Row Spacing**: Ensure the top row and bottom row are separated by exactly **30px** vertical gap.
    *   **Poster Dimensions**: Each poster box must be exactly **280px wide x 420px tall** (Strict 2:3 Ratio).
    *   **Cropping Guard**: Use `object-fit: cover` with a **transparent** background color for the poster box. Use `overflow: hidden` to ensure images stay inside the borders. **Never stretch the poster images.**
    *   **Border**: Apply a **4px solid golden border** (Color: `#bfa888`) and **8px rounded corners** to each poster box.
    *   **Positioning**: 
        *   **Perfect Centering**: The entire poster grid **MUST** be perfectly centered vertically and horizontally on the **1675 x 1547** canvas.
        *   **Equal Spacing**: The top space (between header text and grid) and bottom space (between grid and footer logo) **MUST** be exactly equal.
        *   **Flex Centering**: Use `display: flex; flex-direction: column; justify-content: center; align-items: center;` on the main container for stable alignment.

3.  **Step 3: Output Formatting**
    *   **Format**: High-quality **JPG**.
    *   **Action**: Save the final rendered 1675x1547 canvas as a high-res JPG.
    *   **Naming**: Use `fb-weekly-post-[DATE].jpg`.
    *   **Location**: Print the absolute local path to the final JPG.

4.  **Step 4: Facebook Draft Upload**
    *   **Action**: Use the **`facebook` skill** to upload the final poster image from Step 3 to your Facebook Page.
    *   **Parameters**: 
        *   **Credentials**: Pull `PAGE_ID` and `PAGE_ACCESS_TOKEN` from the `.env` file.
        *   **Publish Mode**: Set the post to **Unpublished (Draft)** for manual review.
        *   **Message**: Use a summary of the movies showing this week.
    *   **Verification**: Ensure the agent confirms the `post_id` for the drafted content.

- **Poster CSS Stablity**:
  ```css
  .canvas {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    width: 1675px;
    height: 1547px;
    background-image: url('template-fb.png');
    background-size: contain;
  }
  .grid-container {
    display: flex;
    flex-direction: column;
    gap: 30px;
    align-items: center;
    justify-content: center;
  }
  .poster-row {
    display: flex;
    gap: 30px;
    justify-content: center;
  }
  .poster-box {
    width: 280px;
    height: 420px;
    border: 4px solid #bfa888;
    border-radius: 8px;
    overflow: hidden;
    background: transparent;
    box-sizing: border-box;
    position: relative;
  }
  .poster-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  ```
- **Transparent Space**: If a film has a white or black pillarbox in the *source* image, you MUST crop it out using `object-zoom` or `object-fit: cover` to ensure only the poster content is visible within the golden border.
