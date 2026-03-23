---
name: Weekly Facebook Post
description: Automates creating a Facebook poster from Deluxe Cinema site links and posting it.
---

# Weekly Facebook Post Skill

**Overview:**
This skill takes a list of movie URLs from Deluxe Cinemas, scrapes high-quality **portrait posters**, and generates a premium **2x5 grid** image (10 posters total). The 1000px content area is filled with posters found by the AI agent, while the **header and footer are left blank** for now.

**Process Steps:**

1.  **Step 1: Download Film Poster from Deluxe Cinema site**
    *   **Input**: A list of URLs from `deluxecinemas.co.nz` provided in the prompt.
    *   **Headless Browser Logic**:
        *   **Navigate** to the specific movie URL.
        *   **Wait** for the page to fully load (Next.js app), ensuring the dynamic content is rendered.
        *   **Primary Selector**: Use `.single-movie__vertical-image img` to locate the high-quality portrait poster.
        *   **Alternative Selector**: Look within `.sticky-inner-wrapper img` if the primary selector fails.
        *   **Avoid Meta Tags**: Do **NOT** use `og:image` as it typically defaults to the website logo.
        *   **Action**: Extract the `src` attribute of the identified image.
    *   **Validation**: Confirm the image is a vertical portrait (approx. 2:3 ratio).

2.  **Step 2: Make Poster (The Visual Result)**
    *   **Layout**: Generate a **2x5 grid** of posters (2 rows, 5 posters each, up to 10 total).
    *   **Finding Posters**: The AI agent extracts the high-res portrait posters from each URL provided in the prompt and populates the grid.
    *   **Flex/Grid CSS**: Use a centered container with gap/spacing to create a premium, balanced layout.
    *   **Poster Styling**: 
        *   **Aspect Ratio**: Each poster container must strictly maintain a **2:3 aspect ratio** (e.g., 200px wide by 300px tall) to match standard film posters.
        *   **No Cropping**: Use `object-fit: contain` or ensure the container size matches the poster ratio exactly to **avoid cropping** the title or credits.
        *   **Border**: Apply a **thin golden border** (approx. 2-4px, Color: `#bfa888`) and subtle rounded corners.
    *   **Background Template**: 
        *   **Path**: Use the official template provided at: `/skills/weekly-facebook-post/template-fb.png`.
        *   **Implementation**: Set this image as the background of the 1675x1547 container.
    *   **Header/Footer Placement**: Do **NOT** add any text or graphics to the header or footer areas, as they are already included in the template.
    *   **Middle Poster Grid**: 
        *   Position the **2x5 grid** of posters precisely in the middle sunburst section of the template.
        *   Ensure the grid is centered and leaves clear margins from the header and footer graphics.
    *   **Technical Specs**:
        *   **Export Type**: **JPG** (High quality).
        *   **Size**: **1675 x 1547 px** (Production Standard).

3.  **Step 3: Output Final JPG Path (Development Phase)**
    *   **Skip Posting**: Do **NOT** push to Facebook yet as we are in the development and feedback phase.
    *   **Action**: Print the **absolute path** to the final generated **JPG** poster image.
    *   **Requirement**: Ensure the path is clearly visible so the user can download and review the visual result before final integration.
