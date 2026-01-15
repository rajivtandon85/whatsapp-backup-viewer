/**
 * Service Worker for PWA - Smart Caching Strategy
 * - Auto-versioning with build timestamp
 * - Network-first for app code (HTML, JS, CSS)
 * - Cache-first for media (images, videos, fonts)
 * - Update notifications for users
 */

// Auto-generated version (replaced during build)
const VERSION = '__BUILD_VERSION__';
const CACHE_NAME = `whatsapp-backup-viewer-${VERSION}`;
const MEDIA_CACHE = `whatsapp-backup-viewer-media-${VERSION}`;

// Static assets to precache
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// File type patterns
const APP_CODE_PATTERN = /\.(html|js|css|json)$/;
const MEDIA_PATTERN = /\.(png|jpg|jpeg|gif|webp|svg|mp4|webm|ogg|mp3|wav|woff2|woff|ttf|eot)$/;

// Install event - precache essentials, skip waiting
self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate event - clean up old caches, take control
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('whatsapp-backup-viewer-') && name !== CACHE_NAME && name !== MEDIA_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim()) // Take control immediately
  );

  // Notify all clients that a new version is active
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'SW_ACTIVATED',
        version: VERSION
      });
    });
  });
});

// Fetch event - hybrid caching strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip cross-origin requests (except for media from known sources)
  if (!url.origin.includes(self.location.origin) && !url.origin.includes('googleusercontent.com')) {
    return;
  }

  // Network-first for app code (HTML, JS, CSS)
  if (APP_CODE_PATTERN.test(url.pathname) || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Cache-first for media files
  if (MEDIA_PATTERN.test(url.pathname)) {
    event.respondWith(cacheFirst(event.request, MEDIA_CACHE));
    return;
  }

  // Default: network-first for everything else
  event.respondWith(networkFirst(event.request));
});

/**
 * Network-first strategy
 * Try network, fallback to cache, great for app code
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      console.log('[SW] Serving from cache (offline):', request.url);
      return cachedResponse;
    }

    // Both failed
    console.error('[SW] Network and cache failed for:', request.url);
    throw error;
  }
}

/**
 * Cache-first strategy
 * Try cache, fallback to network, great for media
 */
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Failed to fetch:', request.url);
    throw error;
  }
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: VERSION });
  }
});

