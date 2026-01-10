# 📱 Install on iPhone

This web app works perfectly on your iPhone! You have two options:

## Option 1: Use Directly in Safari (Easiest)

1. Open Safari on your iPhone
2. Navigate to where you've hosted this app (e.g., `https://yourapp.com`)
3. Upload your WhatsApp backup ZIP and use it!

**That's it!** The app works immediately in Safari.

---

## Option 2: Install as a Home Screen App (Recommended)

This makes the app feel like a native app - it gets its own icon, opens without Safari's UI, and works offline.

### Steps to Install on iPhone:

1. **Open the app in Safari**
   - Navigate to your app's URL in Safari (not Chrome!)
   - Make sure the app loads correctly

2. **Tap the Share button**
   - Look for the share icon at the bottom of Safari
   - It looks like a square with an arrow pointing up ⬆️

3. **Select "Add to Home Screen"**
   - Scroll down in the share menu
   - Tap "Add to Home Screen"
   - You'll see the app icon and name

4. **Customize and Add**
   - You can edit the name if you want
   - Tap "Add" in the top right

5. **Done!**
   - The app now appears on your home screen
   - Tap it to launch like a native app
   - Works offline after first load

### Benefits of Installing:

✅ **Launches instantly** - No Safari browser UI  
✅ **Feels native** - Full-screen experience  
✅ **Works offline** - Can view previously loaded backups  
✅ **Easy access** - Right on your home screen  
✅ **Private** - Still 100% client-side, no data sent anywhere  

---

## Hosting Options

To use this on your iPhone, you need to host it somewhere. Here are your options:

### Quick & Free Options:

1. **Vercel** (Recommended - Easiest)
   ```bash
   npm install -g vercel
   cd whatsapp-backup-viewer
   npm run build
   vercel --prod
   ```
   You'll get a URL like `https://wa-viewer.vercel.app`

2. **Netlify** (Also Great)
   ```bash
   npm run build
   # Then drag the 'dist' folder to netlify.com/drop
   ```

3. **GitHub Pages** (Free, Reliable)
   - Push code to GitHub
   - Enable GitHub Pages in repository settings
   - Access at `https://yourusername.github.io/whatsapp-backup-viewer`

4. **Cloudflare Pages** (Fast, Free CDN)
   - Connect your GitHub repo
   - Auto-deploys on push

### Self-Hosting:

If you have a server or NAS at home:
```bash
npm run build
# Serve the 'dist' folder with any web server
```

---

## Testing PWA Features

Once installed, you can test:

- **Offline Mode**: Turn on airplane mode, app still works
- **No Safari UI**: Opens directly without browser bars
- **Home Screen Icon**: Beautiful WhatsApp-style icon
- **Splash Screen**: Shows while loading

---

## Why Web Instead of Native App?

**Advantages:**
- 🔒 **More Private** - No app store tracking, no permissions needed
- ⚡ **Always Updated** - No manual updates required
- 🆓 **Free** - No App Store fees ($99/year for developer account)
- 🌐 **Cross-Platform** - Works on Android, iPad, desktop too
- 📦 **No Installation Size** - Doesn't use device storage until used

**PWA vs Native App:**
- Native apps need App Store approval (can be rejected)
- Native apps require separate code for iOS/Android
- PWAs work everywhere, update instantly
- PWAs are 100% client-side (better for privacy)

---

## Troubleshooting

### "Add to Home Screen" not showing?
- Make sure you're using **Safari** (not Chrome or Firefox)
- The app must be served over HTTPS
- Try closing and reopening Safari

### App not working offline?
- The first time you load the app, it needs internet
- After that, it caches and works offline
- Media files from new backups need to be loaded once

### How to update the app?
- PWAs auto-update when you host a new version
- Just refresh the page in the app
- Or uninstall and reinstall from Safari

### How to uninstall?
- Long-press the app icon on your home screen
- Tap "Remove App" → "Delete App"

---

## Privacy Notes

Even when installed on iPhone:
- ✅ All processing happens on your device
- ✅ No data is sent to any server
- ✅ ZIP files are processed in browser memory
- ✅ Media files create temporary blob URLs (deleted when you close)
- ✅ Only settings (dark mode preference) are saved locally

**Your chats never leave your iPhone!**

---

Need help? Check the main README or open an issue on GitHub.

