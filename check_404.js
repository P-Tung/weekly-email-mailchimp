const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * Script to check for broken links (404s) in HTML files.
 * Usage: node check_404.js <path_to_html_file>
 */

const campaignFile = process.argv[2] || 'campaign_email.html';

if (!fs.existsSync(campaignFile)) {
  console.error(`File not found: ${campaignFile}`);
  process.exit(1);
}

const html = fs.readFileSync(campaignFile, 'utf8');

// Regex to find href and src attributes
// Excludes mailto, tel, and anchor links
const linkRegex = /(href|src)=["']([^"']+)["']/g;
let match;
const links = [];

while ((match = linkRegex.exec(html)) !== null) {
  const url = match[2];
  // Filter out internal anchors, mailto, and tel links
  if (!url.startsWith('#') && !url.startsWith('mailto:') && !url.startsWith('tel:') && !url.startsWith('*|')) {
    links.push(url);
  }
}

// Deduplicate links
const uniqueLinks = [...new Set(links)];

console.log(`Checking ${uniqueLinks.length} unique links/assets in ${campaignFile}...`);

/**
 * Checks a single URL or local file path
 */
async function checkUrl(url) {
  if (url.startsWith('http')) {
    return new Promise((resolve) => {
      const client = url.startsWith('https') ? https : http;
      
      // Use HEAD request if possible to save bandwidth, fallback to GET
      const options = { method: 'HEAD', timeout: 5000 };
      
      const req = client.request(url, options, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve({ url, ok: true });
        } else if (res.statusCode === 405 || res.statusCode === 403) {
           // Some servers block HEAD, retry with GET
           client.get(url, (res2) => {
             if (res2.statusCode >= 200 && res2.statusCode < 400) {
               resolve({ url, ok: true });
             } else {
               resolve({ url, ok: false, status: res2.statusCode });
             }
           }).on('error', (e) => resolve({ url, ok: false, error: e.message }));
        } else {
          resolve({ url, ok: false, status: res.statusCode });
        }
      });

      req.on('error', (e) => {
        resolve({ url, ok: false, error: e.message });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({ url, ok: false, error: 'TIMEOUT' });
      });
      
      req.end();
    });
  } else {
    // Local file check (relative to the HTML file)
    const filePath = path.resolve(path.dirname(campaignFile), url);
    if (fs.existsSync(filePath)) {
      return { url, ok: true };
    } else {
      return { url, ok: false, status: 'FILE_NOT_FOUND' };
    }
  }
}

/**
 * Main execution function
 */
async function run() {
  const results = [];
  
  // Checking sequentially to avoid overwhelming the network/server
  for (const link of uniqueLinks) {
    const result = await checkUrl(link);
    results.push(result);
  }

  const failures = results.filter(r => !r.ok);

  if (failures.length > 0) {
    console.log('\n\x1b[31m%s\x1b[0m', '❌ FAILED: Found broken links or missing assets:');
    failures.forEach(f => {
      console.log(`- ${f.url} (Status: ${f.status || f.error})`);
    });
    // Exit with code 1 to signal failure to the agent
    process.exit(1);
  } else {
    console.log('\n\x1b[32m%s\x1b[0m', '✅ SUCCESS: All links and assets are valid (No 404s)!');
    process.exit(0);
  }
}

run();
