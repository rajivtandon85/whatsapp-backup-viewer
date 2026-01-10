# 🚀 Deployment Guide

Quick guide to deploy your WhatsApp Backup Viewer so you can use it on your iPhone and other devices.

## Prerequisites

```bash
cd /Users/rajivtandon/Downloads/whatsapp-backup-viewer
npm install
npm run build
```

This creates a `dist/` folder with your production-ready app.

---

## Option 1: Vercel (Recommended - Easiest)

**Why Vercel:**
- ✅ Free tier is generous
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Auto-deploys on git push
- ✅ Takes 2 minutes

**Steps:**

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   cd /Users/rajivtandon/Downloads/whatsapp-backup-viewer
   vercel
   ```

3. **Follow prompts:**
   - Link to Vercel account (creates one if needed)
   - Confirm project settings
   - Deploy!

4. **Get your URL:**
   ```
   https://whatsapp-backup-viewer.vercel.app
   ```

5. **For production:**
   ```bash
   vercel --prod
   ```

**Update your app:**
```bash
npm run build
vercel --prod
```

---

## Option 2: Netlify

**Why Netlify:**
- ✅ Drag-and-drop deployment
- ✅ Free tier
- ✅ Great for beginners

**Steps:**

### Method A: Drag & Drop (Easiest)

1. Run `npm run build`
2. Go to [netlify.com/drop](https://app.netlify.com/drop)
3. Drag your `dist/` folder to the page
4. Done! You get a URL like `https://amazing-site-123.netlify.app`

### Method B: CLI

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir=dist
```

---

## Option 3: GitHub Pages (Free Forever)

**Why GitHub Pages:**
- ✅ Completely free
- ✅ No account limits
- ✅ Reliable GitHub infrastructure

**Steps:**

1. **Push to GitHub:**
   ```bash
   cd /Users/rajivtandon/Downloads/whatsapp-backup-viewer
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/whatsapp-backup-viewer.git
   git push -u origin main
   ```

2. **Install gh-pages:**
   ```bash
   npm install --save-dev gh-pages
   ```

3. **Add to package.json:**
   ```json
   {
     "scripts": {
       "predeploy": "npm run build",
       "deploy": "gh-pages -d dist"
     },
     "homepage": "https://YOUR_USERNAME.github.io/whatsapp-backup-viewer"
   }
   ```

4. **Deploy:**
   ```bash
   npm run deploy
   ```

5. **Enable in GitHub:**
   - Go to repository Settings → Pages
   - Source: Deploy from branch
   - Branch: `gh-pages`
   - Save

**Your app:** `https://YOUR_USERNAME.github.io/whatsapp-backup-viewer`

---

## Option 4: Cloudflare Pages

**Why Cloudflare:**
- ✅ Free unlimited bandwidth
- ✅ Fast global CDN
- ✅ Built-in analytics

**Steps:**

1. Push code to GitHub (see Option 3)
2. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
3. Connect your GitHub account
4. Select repository: `whatsapp-backup-viewer`
5. Build settings:
   - Build command: `npm run build`
   - Build output: `dist`
6. Deploy!

**Auto-deploys on every git push.**

---

## Option 5: Self-Host (Your Own Server)

If you have a server, NAS, or home server:

### Using Nginx

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Copy to server:**
   ```bash
   scp -r dist/* user@yourserver:/var/www/whatsapp-viewer/
   ```

3. **Nginx config:**
   ```nginx
   server {
       listen 80;
       server_name wa-viewer.yourdomain.com;
       
       root /var/www/whatsapp-viewer;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

4. **Enable HTTPS with Let's Encrypt:**
   ```bash
   sudo certbot --nginx -d wa-viewer.yourdomain.com
   ```

### Using Docker

Create `Dockerfile`:
```dockerfile
FROM nginx:alpine
COPY dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Create `nginx.conf`:
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Build and run:
```bash
docker build -t whatsapp-viewer .
docker run -p 8080:80 whatsapp-viewer
```

---

## Testing on iPhone

Once deployed, test on your iPhone:

1. **Open Safari** on your iPhone
2. Navigate to your deployed URL
3. Try uploading a small test backup
4. Install to home screen (see INSTALL_ON_IPHONE.md)

### Local Testing on iPhone

To test before deploying:

1. **Find your computer's local IP:**
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   # Example output: 192.168.1.100
   ```

2. **Start dev server:**
   ```bash
   npm run dev
   ```

3. **On iPhone (same WiFi):**
   - Open Safari
   - Go to `http://192.168.1.100:5173`
   - Test the app!

**Note:** PWA features (install to home screen) require HTTPS, so they won't work in local dev mode.

---

## Custom Domain

All platforms support custom domains:

### Vercel
```bash
vercel domains add yourdomain.com
```

### Netlify
- Netlify Dashboard → Domain Settings → Add custom domain

### GitHub Pages
- Add `CNAME` file to `public/` folder with your domain
- Point your domain's DNS to GitHub Pages

### Cloudflare Pages
- Pages Dashboard → Custom Domains → Add domain

---

## Environment Variables (Optional)

If you add analytics or other services later:

Create `.env`:
```
VITE_ANALYTICS_ID=your_id_here
```

Access in code:
```typescript
const analyticsId = import.meta.env.VITE_ANALYTICS_ID;
```

Deploy with environment variables:
```bash
# Vercel
vercel env add VITE_ANALYTICS_ID

# Netlify
netlify env:set VITE_ANALYTICS_ID your_id_here
```

---

## Monitoring & Analytics (Optional)

### Basic Analytics

Add to `index.html`:
```html
<!-- Simple privacy-friendly analytics -->
<script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>
```

Or use:
- [Plausible](https://plausible.io) - Privacy-focused
- [Umami](https://umami.is) - Self-hosted
- [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) - Free, privacy-focused

---

## Performance Tips

1. **Pre-compress assets:**
   ```bash
   npm install -D vite-plugin-compression
   ```

2. **Enable gzip on your server**
   
3. **Use a CDN** (Vercel/Netlify/Cloudflare all include this)

4. **Check performance:**
   - Chrome DevTools → Lighthouse
   - [PageSpeed Insights](https://pagespeed.web.dev)

---

## Security Checklist

- ✅ Serve over HTTPS (all recommended platforms do this)
- ✅ Set proper headers (CSP, X-Frame-Options)
- ✅ No API keys in client code
- ✅ All processing happens client-side

---

## Troubleshooting

### "Blank page after deployment"
- Check browser console for errors
- Verify `base` path in `vite.config.ts`
- Ensure all files built correctly

### "404 on refresh"
- Add URL rewrite rules (see server configs above)
- Most platforms handle this automatically

### "Not working on iPhone"
- Must be HTTPS for PWA features
- Check Safari console on iPhone (Settings → Safari → Advanced → Web Inspector)

---

## CI/CD (Automatic Deployment)

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v2
      with:
        node-version: '18'
    - run: npm install
    - run: npm run build
    - uses: amondnet/vercel-action@v20
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.ORG_ID}}
        vercel-project-id: ${{ secrets.PROJECT_ID}}
        vercel-args: '--prod'
```

---

## Recommended Setup

For most users:

1. **Push code to GitHub** (free backup, version control)
2. **Deploy with Vercel** (automatic deployments, fast CDN)
3. **Add custom domain** (optional, looks professional)
4. **Share URL with friends** (they can use it too!)

**Total time:** ~10 minutes  
**Total cost:** $0

---

Need help? Check the README or open an issue!

