## Rules for Uploading HTML to Mailchimp

### **File & Upload Requirements**
- **ZIP file size**: Must be less than 1MB
- **HTML files**: Only 1 HTML file per ZIP (Mailchimp uses the first one it finds)
- **File naming**: Use only letters, numbers, and hyphens, no spaces or special characters
- **Case sensitivity**: Your code must match filenames exactly
- **Character encoding**: Must be UTF-8
- **Image formats**: JPG, JPEG, PNG, or GIF only

### **File Structure for ZIP Upload**
- Place all images and files in the **root directory** (no subfolders)
- Include: 
  - Non-inlined HTML file (e.g., `newsletter.html`)
  - CSS stylesheet (e.g., `main.css`)
  - `/img` directory with all images
- Mailchimp uploads images to Content Studio and creates absolute paths automatically

### **Required Tags (MANDATORY)**
You **must** include these in your HTML:
- **Unsubscribe link**: `*|UNSUB|*`
  ```html
  Don't like these emails? <a href="*|UNSUB|*">Unsubscribe</a>.
  ```
- **Physical address**: `*|LIST:ADDRESSLINE|*` (required for CAN-SPAM compliance)
- **Permission reminder**: Tell contacts how they subscribed (e.g., "You received this email because you subscribed at www.example.com")
- **Rewards badge** (for free accounts): `<center>*|REWARDS|*</center>`

### **HTML Coding Rules**
- **No JavaScript** in emails, will be stripped as a security measure
- **No FrontPage/Word/Publisher** HTML, adds extra spammy code
- **Inline CSS or embedded** in `<body>` tag (head CSS gets stripped)
- **Absolute paths** for all images and links:
  ```html
  <!-- Wrong -->
  <img src="/images/photo.gif">
  <a href="index.html">
  
  <!-- Right -->
  <img src="http://www.mysite.com/email/images/photo.gif">
  <a href="http://www.mysite.com/index.html">
  ```
- **Public hosting only** for images, no local or private servers
- **80% text / 20% images** ratio (prevents spam filter triggers)

### **Account Requirements**
- Standard plan or higher required for custom HTML templates
- Mailchimp validates HTML syntax on upload

### **Testing (CRITICAL)**
- Send test emails to Gmail, Yahoo, Hotmail
- Check images and links work correctly
- Use Inbox Preview tool
- Test in all email clients your contacts use

### **What Gets You Banned**
- Missing unsubscribe tag (*|UNSUB|*)
- Missing physical address
- Spammy content (ALL CAPS, excessive exclamation marks, words like "hottest", "best", "click now!")
- Emails that are 100% one graphic
- Gimmicky phrases or clickbait

***

**Bottom line**: Use clean, valid HTML with inline CSS, public image hosting, absolute paths, and ALWAYS include the unsubscribe tag, address, and permission reminder. Test everything before sending.
