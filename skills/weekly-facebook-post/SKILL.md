---
name: Weekly Facebook Post
description: Automates creating a Facebook poster from Deluxe Cinema site links and posting it.
---

# Weekly Facebook Post Skill

**Overview:**
This skill takes a list of Deluxe Cinema movie links, scrapes the high-quality **portrait posters**, generates a grid-style image using HTML/CSS, and pushes the final image to Facebook.

**Process Steps:**

1.  **Step 1: Download Film Poster from Deluxe Cinema site**
    *   **Input**: A list of URLs from `deluxecinemas.co.nz` provided in the prompt.
    *   **Scraping Rule**: Navigate to each URL and locate the **primary portrait movie poster**. Do NOT download landscape banners or character stills.
    *   **Validation**: Ensure the image is the vertical poster (approx. 2:3 ratio) to fit the grid.

2.  **Step 2: Make Poster (The Visual Result)**
    *   **Layout**: Generate a grid-based HTML structure (similar to the "Showing This Week" reference image).
    *   **Flex CSS Style**: Use CSS Flexbox/Grid for a responsive and premium alignment of movie posters.
    *   **Dynamic Background**: Implement a dark, radial-sunburst or thematic background to make the posters pop.
    *   **Have Header and Footer Fixed**: 
        *   **Header**: Include "SHOWING THIS WEEK" in the brand font.
        *   **Footer**: Include Deluxe Cinemas logo, phone number, and website URL.
    *   **Export Recommendation**:
        *   **Type**: **JPG** (Higher quality for complex colors while keeping file size social-media friendly).
        *   **Size**: **1200 x 1200 px** (1:1 Ratio) or **1080 x 1080 px** (Square) for maximum visibility on Facebook and Instagram.

3.  **Step 3: Push to FB**
    *   Upload the final **JPG** image.
    *   Use the provided hook: *"The lineup you've been waiting for is finally here. Which one are you seeing first? 🎬"*
    *   Include the individual movie links for direct booking.
