/**
 * Google Drive Configuration
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a new project (or select existing)
 * 3. Enable "Google Drive API" (APIs & Services → Library → Search "Drive")
 * 4. Create OAuth 2.0 credentials (APIs & Services → Credentials → Create → OAuth Client ID)
 *    - Application type: Web application
 *    - Authorized JavaScript origins: http://localhost:5174 (dev), your production URL
 *    - Authorized redirect URIs: http://localhost:5174 (dev), your production URL
 * 5. Copy the Client ID below
 * 6. Configure OAuth consent screen (APIs & Services → OAuth consent screen)
 *    - User type: External (or Internal if using Google Workspace)
 *    - Add your email as a test user
 */

// Google Cloud OAuth Client ID
export const GOOGLE_CLIENT_ID = '765619887246-l2bq01lg0egj8en88i0fnapuc2tq8fa1.apps.googleusercontent.com';

// Google Drive API scopes we need
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly', // Read files and folders
].join(' ');

// Root folder name in Google Drive
export const DRIVE_ROOT_FOLDER = 'wa_bckp';

// Subfolder names
export const DRIVE_FOLDERS = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  PASSWORD: 'pwd',
} as const;

// Password hash filename
export const PASSWORD_HASH_FILE = 'private_hash.txt';

// Google API Discovery Doc
export const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

// API loaded state
let gapiLoaded = false;
let gisLoaded = false;
let tokenClient: google.accounts.oauth2.TokenClient | null = null;

// Token storage keys
const TOKEN_STORAGE_KEY = 'wa_viewer_token';
const TOKEN_EXPIRY_KEY = 'wa_viewer_token_expiry';

// Auto-refresh timer
let refreshTimer: NodeJS.Timeout | null = null;
let tokenReceivedCallback: (() => void) | null = null;

/**
 * Save token to localStorage and schedule auto-refresh
 */
function saveToken(token: google.accounts.oauth2.TokenResponse): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
    // Token expires in expires_in seconds (usually 3600 = 1 hour)
    const expiresIn = typeof token.expires_in === 'string'
      ? parseInt(token.expires_in)
      : (token.expires_in || 3600);
    const expiryTime = Date.now() + (expiresIn * 1000);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());

    // Schedule automatic token refresh 5 minutes before expiry
    scheduleTokenRefresh(expiresIn);

    console.log(`[Auth] Token saved, expires in ${Math.floor(expiresIn / 60)} minutes`);
  } catch (e) {
    console.warn('Failed to save token to localStorage:', e);
  }
}

/**
 * Schedule automatic token refresh before expiry
 */
function scheduleTokenRefresh(expiresInSeconds: number): void {
  // Clear existing timer
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  // Refresh 5 minutes (300 seconds) before expiry
  // If token expires in less than 5 minutes, refresh in 30 seconds
  const refreshIn = Math.max(30, expiresInSeconds - 300);

  refreshTimer = setTimeout(async () => {
    console.log('[Auth] Auto-refreshing token...');
    const success = await trySilentReauth();
    if (success) {
      console.log('[Auth] Token refreshed successfully');
      // Callback to notify app that token was refreshed
      tokenReceivedCallback?.();
    } else {
      console.warn('[Auth] Auto-refresh failed, user will need to re-login');
    }
  }, refreshIn * 1000);

  console.log(`[Auth] Token refresh scheduled in ${Math.floor(refreshIn / 60)} minutes`);
}

/**
 * Load token from localStorage if still valid
 */
function loadStoredToken(): google.accounts.oauth2.TokenResponse | null {
  try {
    const tokenStr = localStorage.getItem(TOKEN_STORAGE_KEY);
    const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);

    if (!tokenStr || !expiryStr) return null;

    const expiryTime = parseInt(expiryStr);
    const now = Date.now();
    const timeUntilExpiry = expiryTime - now;

    // If already expired, clear and return null
    if (timeUntilExpiry <= 0) {
      clearStoredToken();
      return null;
    }

    // Token is still valid, schedule refresh for remaining time
    const secondsUntilExpiry = Math.floor(timeUntilExpiry / 1000);
    scheduleTokenRefresh(secondsUntilExpiry);

    console.log(`[Auth] Restored token, expires in ${Math.floor(secondsUntilExpiry / 60)} minutes`);

    return JSON.parse(tokenStr);
  } catch (e) {
    console.warn('Failed to load token from localStorage:', e);
    return null;
  }
}

/**
 * Clear stored token
 */
function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch (e) {
    // Ignore
  }
}

/**
 * Load the Google API client library
 */
export function loadGapiClient(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (gapiLoaded) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            discoveryDocs: [DISCOVERY_DOC],
          });
          gapiLoaded = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    };
    script.onerror = () => reject(new Error('Failed to load Google API'));
    document.body.appendChild(script);
  });
}

/**
 * Load the Google Identity Services library
 */
export function loadGisClient(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (gisLoaded) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.body.appendChild(script);
  });
}

/**
 * Initialize the token client for OAuth
 */
export function initTokenClient(onTokenReceived: () => void): void {
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID')) {
    console.error('⚠️ Please configure your Google Client ID in src/config/googleDrive.ts');
    return;
  }

  // Store callback for auto-refresh
  tokenReceivedCallback = onTokenReceived;

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_SCOPES,
    callback: (response) => {
      if (response.error) {
        console.error('OAuth error:', response.error);
        return;
      }
      // Save token to localStorage for persistence
      saveToken(response);
      // Set token in gapi client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (gapi.client as any).setToken(response);
      onTokenReceived();
    },
  });
}

/**
 * Try to restore session from stored token
 * Returns true if successful, false if need to login
 */
export function tryRestoreSession(): boolean {
  const storedToken = loadStoredToken();
  if (storedToken && storedToken.access_token) {
    // Set the token in gapi client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (gapi.client as any).setToken(storedToken);
    return true;
  }
  return false;
}

/**
 * Try silent re-authentication (no popup)
 * Returns a promise that resolves to true if successful
 */
export function trySilentReauth(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!tokenClient) {
      resolve(false);
      return;
    }

    let resolved = false;

    // Re-initialize token client with new callback for this attempt
    const silentTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_SCOPES,
      callback: (response) => {
        if (resolved) return; // Already timed out
        resolved = true;

        if (response.error) {
          console.log('[Auth] Silent reauth failed:', response.error);
          resolve(false);
          return;
        }
        // Save token and set in gapi client
        saveToken(response);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (gapi.client as any).setToken(response);
        resolve(true);
      },
    });

    // Try silent auth with prompt: 'none'
    try {
      silentTokenClient.requestAccessToken({ prompt: 'none' });

      // Set a timeout in case silent auth hangs
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.log('[Auth] Silent reauth timed out');
          resolve(false);
        }
      }, 5000);
    } catch (err) {
      resolved = true;
      console.log('[Auth] Silent reauth exception:', err);
      resolve(false);
    }
  });
}

/**
 * Check if token is expired or about to expire (within 5 minutes)
 */
export function isTokenExpired(): boolean {
  const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!expiryStr) return true;
  
  const expiryTime = parseInt(expiryStr);
  // Consider expired if within 5 minutes of expiry
  return Date.now() > expiryTime - 300000;
}

/**
 * Request access token (triggers OAuth popup)
 */
export function requestAccessToken(): void {
  if (!tokenClient) {
    console.error('Token client not initialized');
    return;
  }

  // Always use empty prompt to speed up login
  // Google will automatically show consent screen if needed
  // If user already has a session, this will be much faster
  tokenClient.requestAccessToken({ prompt: '' });
}

/**
 * Sign out and revoke token
 */
export function signOut(): void {
  const token = gapi.client.getToken();
  if (token) {
    google.accounts.oauth2.revoke(token.access_token, () => {
      gapi.client.setToken(null);
    });
  }
  // Clear stored token
  clearStoredToken();
  // Clear refresh timer
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  console.log('[Auth] Signed out and cleared session');
}

/**
 * Check if user is signed in
 */
export function isSignedIn(): boolean {
  return gapi.client?.getToken() !== null;
}

/**
 * Setup auto-refresh on app visibility change
 * Call this once during app initialization
 */
export function setupVisibilityRefresh(): void {
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;

    // User returned to app, check if token needs refresh
    if (isSignedIn() && isTokenExpired()) {
      console.log('[Auth] App resumed, token expired, attempting silent refresh...');
      const success = await trySilentReauth();
      if (success) {
        console.log('[Auth] Token refreshed on app resume');
        tokenReceivedCallback?.();
      }
    }
  });
  console.log('[Auth] Visibility refresh handler installed');
}
