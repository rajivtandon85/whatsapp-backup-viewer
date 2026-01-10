# ⚡ Quick Start Guide

Get your WhatsApp Backup Viewer running in 5 minutes!

## Step 1: Run Locally (1 minute)

```bash
cd /Users/rajivtandon/Downloads/whatsapp-backup-viewer
npm run dev
```

Open http://localhost:5173 in your browser.

---

## Step 2: Test with a Backup (2 minutes)

### Export from WhatsApp:

1. Open WhatsApp on your phone
2. Open a chat → Menu (⋮) → More → Export chat
3. Choose "Include Media" or "Without Media"
4. Save the ZIP file

### Load in Viewer:

1. In the app, click "Select ZIP File"
2. Choose your exported ZIP
3. Wait 5-10 seconds for parsing
4. Browse your chat!

---

## Step 3: Deploy for iPhone (2 minutes)

### Fastest way (Vercel):

```bash
npm install -g vercel
npm run build
vercel
```

You'll get a URL like: `https://whatsapp-viewer.vercel.app`

### Open on iPhone:

1. Open Safari on your iPhone (same WiFi not needed)
2. Go to your Vercel URL
3. Upload your backup
4. **Bonus:** Tap Share → "Add to Home Screen" to install it like an app!

---

## That's It! 🎉

You now have a working WhatsApp Backup Viewer!

### Next Steps:

- Read [INSTALL_ON_IPHONE.md](./INSTALL_ON_IPHONE.md) for iPhone-specific setup
- Read [DEPLOYMENT.md](./DEPLOYMENT.md) for more hosting options
- Read [README.md](./README.md) for full documentation

### Need Help?

- Check browser console for errors
- Make sure you're using a real WhatsApp export ZIP
- Try a small chat first (easier to debug)

---

## Common Issues

**"No messages found"**
- Make sure the ZIP contains `.txt` chat files
- WhatsApp format: "WhatsApp Chat with [Name].txt"

**"App is slow"**
- Large backups take time to parse
- Try without media first
- We're parsing everything in your browser!

**"Can't install on iPhone"**
- Must use Safari (not Chrome)
- App must be served over HTTPS (local http:// won't work)
- Use deployed version (Vercel/Netlify) for PWA features

---

Enjoy viewing your chats! 💬

