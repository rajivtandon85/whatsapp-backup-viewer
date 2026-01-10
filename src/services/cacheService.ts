/**
 * IndexedDB Caching Service
 * Caches parsed chat data and images to avoid re-downloading from Drive
 */

const DB_NAME = 'whatsapp_backup_cache';
const DB_VERSION = 2; // Bumped for new image store

// Store names
const STORES = {
  CHAT_META: 'chat_meta',      // Chat folder metadata (for stale checking)
  PARSED_CHATS: 'parsed_chats', // Parsed message data
  IMAGES: 'images',            // Cached images (blob data)
} as const;

// Image cache settings
const MAX_IMAGE_CACHE_SIZE = 1024 * 1024 * 1024; // 1GB

interface ChatMeta {
  chatId: string;
  modifiedTime: string;
  messageCount: number;
  lastCachedAt: number;
}

interface CachedChat {
  chatId: string;
  messages: unknown[]; // Message[]
  participants: unknown[]; // Participant[]
  cachedAt: number;
}

interface CachedImage {
  fileId: string;        // Google Drive file ID
  blob: Blob;            // Image data
  size: number;          // Blob size in bytes
  lastAccessedAt: number; // For LRU eviction
  cachedAt: number;
}

let db: IDBDatabase | null = null;

/**
 * Open/initialize the IndexedDB database
 */
export async function initCache(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open cache database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve();
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create stores if they don't exist
      if (!database.objectStoreNames.contains(STORES.CHAT_META)) {
        database.createObjectStore(STORES.CHAT_META, { keyPath: 'chatId' });
      }

      if (!database.objectStoreNames.contains(STORES.PARSED_CHATS)) {
        database.createObjectStore(STORES.PARSED_CHATS, { keyPath: 'chatId' });
      }

      if (!database.objectStoreNames.contains(STORES.IMAGES)) {
        const imageStore = database.createObjectStore(STORES.IMAGES, { keyPath: 'fileId' });
        imageStore.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
      }
    };
  });
}

/**
 * Get cached chat metadata
 */
export async function getChatMeta(chatId: string): Promise<ChatMeta | null> {
  if (!db) await initCache();
  
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(STORES.CHAT_META, 'readonly');
    const store = transaction.objectStore(STORES.CHAT_META);
    const request = store.get(chatId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save chat metadata
 */
export async function saveChatMeta(meta: ChatMeta): Promise<void> {
  if (!db) await initCache();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(STORES.CHAT_META, 'readwrite');
    const store = transaction.objectStore(STORES.CHAT_META);
    const request = store.put(meta);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get cached parsed chat
 */
export async function getCachedChat(chatId: string): Promise<CachedChat | null> {
  if (!db) await initCache();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(STORES.PARSED_CHATS, 'readonly');
    const store = transaction.objectStore(STORES.PARSED_CHATS);
    const request = store.get(chatId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save parsed chat to cache
 */
export async function saveCachedChat(chat: CachedChat): Promise<void> {
  if (!db) await initCache();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(STORES.PARSED_CHATS, 'readwrite');
    const store = transaction.objectStore(STORES.PARSED_CHATS);
    const request = store.put(chat);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if cache is stale (folder was modified after cache was created)
 */
export async function isCacheStale(chatId: string, currentModifiedTime: string): Promise<boolean> {
  const meta = await getChatMeta(chatId);
  
  if (!meta) {
    return true; // No cache exists
  }

  // Compare modification times
  const cachedTime = new Date(meta.modifiedTime).getTime();
  const currentTime = new Date(currentModifiedTime).getTime();

  return currentTime > cachedTime;
}

/**
 * Clear all cache
 */
export async function clearCache(): Promise<void> {
  if (!db) await initCache();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORES.CHAT_META, STORES.PARSED_CHATS], 'readwrite');
    
    transaction.objectStore(STORES.CHAT_META).clear();
    transaction.objectStore(STORES.PARSED_CHATS).clear();

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Get cache size estimate
 */
export async function getCacheSize(): Promise<string> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const usedMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(2);
    const quotaMB = ((estimate.quota || 0) / (1024 * 1024)).toFixed(0);
    return `${usedMB} MB / ${quotaMB} MB`;
  }
  return 'Unknown';
}

// ============ IMAGE CACHE FUNCTIONS ============

/**
 * Get cached image by file ID
 */
export async function getCachedImage(fileId: string): Promise<Blob | null> {
  if (!db) await initCache();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(STORES.IMAGES, 'readwrite');
    const store = transaction.objectStore(STORES.IMAGES);
    const request = store.get(fileId);

    request.onsuccess = () => {
      const result = request.result as CachedImage | undefined;
      if (result) {
        // Update last accessed time for LRU
        result.lastAccessedAt = Date.now();
        store.put(result);
        resolve(result.blob);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save image to cache with LRU eviction
 */
export async function cacheImage(fileId: string, blob: Blob): Promise<void> {
  if (!db) await initCache();

  const size = blob.size;

  // Check if we need to evict old images
  await evictIfNeeded(size);

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(STORES.IMAGES, 'readwrite');
    const store = transaction.objectStore(STORES.IMAGES);

    const cachedImage: CachedImage = {
      fileId,
      blob,
      size,
      lastAccessedAt: Date.now(),
      cachedAt: Date.now(),
    };

    const request = store.put(cachedImage);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get total size of cached images
 */
async function getImageCacheSize(): Promise<number> {
  if (!db) await initCache();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(STORES.IMAGES, 'readonly');
    const store = transaction.objectStore(STORES.IMAGES);
    const request = store.openCursor();

    let totalSize = 0;

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        totalSize += (cursor.value as CachedImage).size;
        cursor.continue();
      } else {
        resolve(totalSize);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Evict oldest images if cache is too large
 */
async function evictIfNeeded(newImageSize: number): Promise<void> {
  if (!db) return;

  const currentSize = await getImageCacheSize();
  const targetSize = MAX_IMAGE_CACHE_SIZE - newImageSize;

  if (currentSize <= targetSize) {
    return; // No eviction needed
  }

  // Get all images sorted by lastAccessedAt (oldest first)
  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(STORES.IMAGES, 'readwrite');
    const store = transaction.objectStore(STORES.IMAGES);
    const index = store.index('lastAccessedAt');
    const request = index.openCursor();

    let freedSize = 0;
    const sizeToFree = currentSize - targetSize;

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor && freedSize < sizeToFree) {
        const image = cursor.value as CachedImage;
        freedSize += image.size;
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear image cache only
 */
export async function clearImageCache(): Promise<void> {
  if (!db) await initCache();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(STORES.IMAGES, 'readwrite');
    const store = transaction.objectStore(STORES.IMAGES);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get image cache stats
 */
export async function getImageCacheStats(): Promise<{ count: number; sizeMB: string }> {
  if (!db) await initCache();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction(STORES.IMAGES, 'readonly');
    const store = transaction.objectStore(STORES.IMAGES);
    const countRequest = store.count();
    
    let count = 0;
    let totalSize = 0;

    countRequest.onsuccess = () => {
      count = countRequest.result;
    };

    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        totalSize += (cursor.value as CachedImage).size;
        cursor.continue();
      } else {
        resolve({
          count,
          sizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        });
      }
    };
    cursorRequest.onerror = () => reject(cursorRequest.error);
  });
}
