# WhatsApp Backup Viewer

A client-side Progressive Web App (PWA) that allows you to view your exported WhatsApp chat backups stored in Google Drive. All processing happens locally in your browser for maximum privacy and security.

## Features

### 📱 WhatsApp Web-like Interface
- Beautiful, familiar UI matching WhatsApp Web design
- Light and dark mode support
- Message bubbles aligned right (you) and left (others)
- Date separators and message timestamps
- Grouped messages by sender

### 🔐 Private Chat Protection
- **Public chats**: Visible by default in chat list
- **Private chats**: Hidden from chat list, accessible only via search with password
- Password-protected private folder access
- Private chats disappear when navigating back to main list

### 🔍 Powerful Search
- Search across all chats (public and private)
- In-chat search with match count and navigation arrows
- Floating date indicator while scrolling
- Unified search experience

### 📸 Media Support
- **Images**: Lazy-loaded thumbnails with full-resolution on click
- **Videos**: Preview thumbnails with play button
- **Documents**: PDFs, contacts (VCF), and more
- **Inline VCF**: Contact cards displayed directly in chat
- **Media Gallery**: Full-screen viewer with navigation

### 🚀 Performance Optimizations
- **1GB Image Cache**: Cached images load instantly on revisit
- **Lazy Loading**: Images load only when scrolled into view
- **IndexedDB Caching**: Parsed chat data cached locally
- **Auto Reconnection**: Automatic token refresh when expired

### 🔄 Multi-Backup Merging
- Automatically merges multiple backup folders for same contact
- Intelligent deduplication by timestamp + sender + content
- Unified timeline across all backups
- Media deduplication by filename

### 📊 Media, Links & Docs View
- Separate tabs for Media, Links, and Documents
- Count indicators for each category
- Chronologically sorted (newest first)

## Setup

### Prerequisites
- Node.js 18+ and npm
- Google Cloud Project with Drive API enabled
- Google OAuth 2.0 credentials

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd whatsapp-backup-viewer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Google Drive API**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing
   - Enable "Google Drive API"
   - Create OAuth 2.0 credentials (Web application type)
   - Add your email as a test user in OAuth consent screen
   - Copy the Client ID

4. **Update configuration**
   - Open `src/config/googleDrive.ts`
   - Replace `GOOGLE_CLIENT_ID` with your Client ID

5. **Run development server**
   ```bash
   npm run dev
   ```

## Google Drive Structure

Organize your backups in Google Drive as follows:

```
wa_bckp/
├── public/
│   ├── Contact Name 1/
│   │   ├── WhatsApp Chat - Contact Name 1/
│   │   │   ├── _chat.txt
│   │   │   ├── IMG-*.jpg
│   │   │   └── ...
│   │   └── WhatsApp Chat - Contact Name 1 2/  (multiple backups)
│   │       ├── _chat.txt
│   │       └── ...
│   └── Contact Name 2/
│       └── ...
├── private/
│   └── (same structure as public, but hidden by default)
└── pwd/
    └── private_hash.txt  (SHA-256 hash of your password)
```

### Notes:
- **Root folder**: Must be named `wa_bckp`
- **Subfolders**: `public` (visible), `private` (password-protected), `pwd` (password hash)
- **Chat folders**: Each contact/group should have its own folder
- **Backup folders**: Multiple backups per contact are supported (automatically merged)
- **Password hash**: Create `private_hash.txt` with SHA-256 hash of your password

## Usage

### Local Development
1. Start the dev server: `npm run dev`
2. Open `http://localhost:5174` in your browser
3. Sign in with Google Drive
4. Start viewing your chats!

### Production Build
```bash
npm run build
```
Output will be in the `dist/` folder.

### Install as PWA (iPhone)
1. Open the app in Safari
2. Tap Share button (square with arrow)
3. Select "Add to Home Screen"
4. The app will work like a native app!

## Technical Details

### Architecture
- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Storage**: IndexedDB for caching
- **Authentication**: Google OAuth 2.0
- **API**: Google Drive API v3

### Key Features Implementation
- **Lazy Loading**: IntersectionObserver API for efficient image loading
- **Caching**: IndexedDB with 1GB limit and LRU eviction
- **Token Persistence**: localStorage with automatic refresh
- **Message Parsing**: Regex-based parser supporting Android/iOS exports
- **Deduplication**: Content-based matching with timestamp rounding

### Privacy & Security
- ✅ All processing happens client-side (in your browser)
- ✅ No data sent to external servers
- ✅ Google Drive API only accesses your specified folders
- ✅ Private chats encrypted with SHA-256 hashed passwords
- ✅ Cached data stored locally in browser

## Deployment

### Deploy to Vercel

1. **Push to GitHub**
   ```bash
   git init
   git add -A
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. **Deploy on Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will auto-detect Vite and deploy
   - Add your Vercel URL to Google OAuth authorized origins

3. **Update OAuth Settings**
   - In Google Cloud Console, add your Vercel URL:
     - Authorized JavaScript origins: `https://your-app.vercel.app`
     - Authorized redirect URIs: `https://your-app.vercel.app`

## Troubleshooting

### "Access blocked" error
- Add your email as a test user in Google Cloud Console → OAuth consent screen

### Images not loading
- Check browser console for errors
- Verify Google Drive API quotas haven't been exceeded
- Try clearing cache and re-authenticating

### Chat not appearing
- Verify folder structure matches expected format
- Check that `_chat.txt` file exists in backup folder
- Ensure folder is in correct `public/` or `private/` directory

## License

MIT License - feel free to use for personal or commercial projects.

## Contributing

This is a personal project. Forks and improvements welcome!

---

Built with ❤️ using React, TypeScript, and Google Drive API
