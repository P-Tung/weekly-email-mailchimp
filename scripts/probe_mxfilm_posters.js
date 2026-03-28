const { chromium } = require('playwright');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture ALL API/network responses
  const apiResponses = [];
  page.on('response', async (res) => {
    const url = res.url();
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('application/json') || url.includes('/internal/') || url.includes('/api/')) {
      try {
        const text = await res.text();
        apiResponses.push({ url, status: res.status(), body: text });
      } catch (e) {}
    }
  });

  // Login
  await page.goto('https://film.moviexchange.com/login');
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  await page.fill('input[type="email"]', process.env.MX_USERNAME);
  await page.fill('input[type="password"]', process.env.MX_PASSWORD);
  await page.press('input[type="password"]', 'Enter');
  await page.waitForTimeout(3000);

  // Go to release page
  await page.goto('https://film.moviexchange.com/releases/90a3c756-0896-4f9a-a680-0710f68c51ad', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Click on poster to open media viewer
  const poster = page.locator('img[alt="Poster"]').first();
  if (await poster.isVisible()) {
    await poster.click();
    await page.waitForTimeout(3000);
  }

  // Find all download-related elements and click them
  // Look for size-related text/buttons/links
  const sizeButtons = await page.locator('text=/\\d{3,4}x\\d{3,4}/').all();
  console.log('Size buttons found:', sizeButtons.length);

  if (sizeButtons.length > 0) {
    // Click the largest one (first = 2765x4096)
    await sizeButtons[0].click();
    await page.waitForTimeout(3000);
    console.log('Clicked first size button');
    await page.screenshot({ path: 'probe_size_click.png' });
  }

  // Print all captured API responses that look relevant (contain media/download/image info)
  console.log('\n=== Relevant API responses ===');
  for (const r of apiResponses) {
    if (r.url.includes('media') || r.url.includes('download') || r.url.includes('release') || r.url.includes('film')) {
      console.log('\nURL:', r.url);
      console.log('Status:', r.status);
      if (r.body && r.body.length > 2 && r.body.length < 5000) {
        console.log('Body:', r.body);
      } else if (r.body && r.body.length >= 5000) {
        // Search for download/url patterns in large responses
        const urlMatches = r.body.match(/"(https:\/\/[^"]*film-cdn[^"]*)"/g);
        if (urlMatches) {
          console.log('CDN URLs in response:', urlMatches.slice(0, 10));
        }
        const downloadMatches = r.body.match(/"downloadUrl"\s*:\s*"([^"]*)"/g);
        if (downloadMatches) console.log('downloadUrl fields:', downloadMatches);

        const originalMatches = r.body.match(/"(original|fullSize|fullResolution|highRes|url)[^"]*"\s*:\s*"(https[^"]*)"/gi);
        if (originalMatches) console.log('URL fields:', originalMatches.slice(0, 10));
      }
    }
  }

  await browser.close();
}

run().catch(console.error);
