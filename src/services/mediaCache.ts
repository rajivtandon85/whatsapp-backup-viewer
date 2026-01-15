/**
 * Media Cache Service
 * Implements LRU (Least Recently Used) cache for images/videos
 * Target: ~2GB max storage with smart eviction
 */

const CACHE_NAME = 'whatsapp-media-v1';
const MAX_CACHE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
const EVICTION_THRESHOLD = 0.9; // Start evicting at 90% full

class MediaCacheService {
  private memoryCache = new Map<string, string>(); // driveFileId -> blob URL (for quick access)
  private cacheSize = 0;
  private initialized = false;

  /**
   * Initialize media cache and calculate current size
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Request persistent storage if available
      if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        console.log('[MediaCache] Persistent storage:', isPersisted ? 'granted' : 'denied');
      }

      // Calculate current cache size
      await this.calculateCacheSize();
      this.initialized = true;

      console.log('[MediaCache] Initialized, current size:', this.formatSize(this.cacheSize));
    } catch (err) {
      console.error('[MediaCache] Initialization failed:', err);
    }
  }

  /**
   * Calculate total size of cached media
   */
  private async calculateCacheSize(): Promise<void> {
    if (!('caches' in window)) return;

    try {
      const cache = await caches.open(CACHE_NAME);
      const requests = await cache.keys();

      this.cacheSize = 0;
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          this.cacheSize += blob.size;
        }
      }
    } catch (err) {
      console.error('[MediaCache] Failed to calculate size:', err);
    }
  }

  /**
   * Get media from cache or fetch from URL
   */
  async getMedia(driveFileId: string, originalUrl: string): Promise<string> {
    await this.init();

    // Check memory cache first (instant)
    if (this.memoryCache.has(driveFileId)) {
      console.log('[MediaCache] Memory hit:', driveFileId);
      await this.updateAccessTime(driveFileId);
      return this.memoryCache.get(driveFileId)!;
    }

    // Check disk cache
    const cachedUrl = await this.getCachedUrl(driveFileId);
    if (cachedUrl) {
      console.log('[MediaCache] Disk hit:', driveFileId);
      this.memoryCache.set(driveFileId, cachedUrl);
      await this.updateAccessTime(driveFileId);
      return cachedUrl;
    }

    // Cache miss - fetch and store
    console.log('[MediaCache] Miss, fetching:', driveFileId);
    return await this.fetchAndCache(driveFileId, originalUrl);
  }

  /**
   * Get cached URL from cache storage
   */
  private async getCachedUrl(driveFileId: string): Promise<string | null> {
    if (!('caches' in window)) return null;

    try {
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = this.getCacheKey(driveFileId);
      const response = await cache.match(cacheKey);

      if (response) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        return url;
      }
    } catch (err) {
      console.error('[MediaCache] Failed to get from cache:', err);
    }

    return null;
  }

  /**
   * Fetch media and add to cache
   */
  private async fetchAndCache(driveFileId: string, originalUrl: string): Promise<string> {
    try {
      // Fetch the media
      const response = await fetch(originalUrl);
      if (!response.ok) throw new Error('Failed to fetch media');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Add to memory cache
      this.memoryCache.set(driveFileId, blobUrl);

      // Add to disk cache (with eviction if needed)
      await this.addToCache(driveFileId, blob);

      return blobUrl;
    } catch (err) {
      console.error('[MediaCache] Failed to fetch and cache:', err);
      throw err;
    }
  }

  /**
   * Add media to cache with LRU eviction
   */
  private async addToCache(driveFileId: string, blob: Blob): Promise<void> {
    if (!('caches' in window)) return;

    try {
      const size = blob.size;

      // Check if we need to evict
      if (this.cacheSize + size > MAX_CACHE_SIZE * EVICTION_THRESHOLD) {
        console.log('[MediaCache] Cache full, evicting...');
        await this.evictLRU(size);
      }

      // Add to cache
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = this.getCacheKey(driveFileId);

      // Create metadata object with access time
      const metadata = {
        driveFileId,
        size,
        lastAccessed: Date.now(),
      };

      // Store both the blob and metadata
      const headers = new Headers({
        'X-Cache-Metadata': JSON.stringify(metadata),
        'Content-Type': blob.type,
      });

      const response = new Response(blob, { headers });
      await cache.put(cacheKey, response);

      this.cacheSize += size;
      console.log('[MediaCache] Cached:', driveFileId, this.formatSize(size));
    } catch (err) {
      console.error('[MediaCache] Failed to add to cache:', err);
    }
  }

  /**
   * Evict least recently used items to free up space
   */
  private async evictLRU(spaceNeeded: number): Promise<void> {
    if (!('caches' in window)) return;

    try {
      const cache = await caches.open(CACHE_NAME);
      const requests = await cache.keys();

      // Get all entries with metadata
      const entries: Array<{ request: Request; metadata: any; size: number }> = [];

      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const metadataHeader = response.headers.get('X-Cache-Metadata');
          if (metadataHeader) {
            const metadata = JSON.parse(metadataHeader);
            const blob = await response.blob();
            entries.push({ request, metadata, size: blob.size });
          }
        }
      }

      // Sort by lastAccessed (oldest first)
      entries.sort((a, b) => a.metadata.lastAccessed - b.metadata.lastAccessed);

      // Evict until we have enough space
      let freedSpace = 0;
      let evictedCount = 0;

      for (const entry of entries) {
        if (this.cacheSize - freedSpace + spaceNeeded < MAX_CACHE_SIZE * EVICTION_THRESHOLD) {
          break;
        }

        await cache.delete(entry.request);
        freedSpace += entry.size;
        evictedCount++;

        // Remove from memory cache
        if (entry.metadata.driveFileId) {
          const blobUrl = this.memoryCache.get(entry.metadata.driveFileId);
          if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
            this.memoryCache.delete(entry.metadata.driveFileId);
          }
        }
      }

      this.cacheSize -= freedSpace;
      console.log(`[MediaCache] Evicted ${evictedCount} items, freed ${this.formatSize(freedSpace)}`);
    } catch (err) {
      console.error('[MediaCache] Failed to evict:', err);
    }
  }

  /**
   * Update access time for an item (touch)
   */
  private async updateAccessTime(driveFileId: string): Promise<void> {
    if (!('caches' in window)) return;

    try {
      const cache = await caches.open(CACHE_NAME);
      const cacheKey = this.getCacheKey(driveFileId);
      const response = await cache.match(cacheKey);

      if (response) {
        const blob = await response.blob();
        const metadataHeader = response.headers.get('X-Cache-Metadata');

        if (metadataHeader) {
          const metadata = JSON.parse(metadataHeader);
          metadata.lastAccessed = Date.now();

          const headers = new Headers({
            'X-Cache-Metadata': JSON.stringify(metadata),
            'Content-Type': blob.type,
          });

          const newResponse = new Response(blob, { headers });
          await cache.put(cacheKey, newResponse);
        }
      }
    } catch (err) {
      console.error('[MediaCache] Failed to update access time:', err);
    }
  }

  /**
   * Get cache key for a drive file ID
   */
  private getCacheKey(driveFileId: string): string {
    return `https://media.cache/${driveFileId}`;
  }

  /**
   * Format bytes to human-readable size
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ size: string; count: number; sizeBytes: number }> {
    await this.init();

    if (!('caches' in window)) {
      return { size: '0 B', count: 0, sizeBytes: 0 };
    }

    try {
      const cache = await caches.open(CACHE_NAME);
      const requests = await cache.keys();

      return {
        size: this.formatSize(this.cacheSize),
        count: requests.length,
        sizeBytes: this.cacheSize,
      };
    } catch (err) {
      console.error('[MediaCache] Failed to get stats:', err);
      return { size: '0 B', count: 0, sizeBytes: 0 };
    }
  }

  /**
   * Clear all cached media
   */
  async clearAll(): Promise<void> {
    if (!('caches' in window)) return;

    try {
      // Revoke all blob URLs
      for (const url of this.memoryCache.values()) {
        URL.revokeObjectURL(url);
      }
      this.memoryCache.clear();

      // Clear cache storage
      await caches.delete(CACHE_NAME);
      this.cacheSize = 0;

      console.log('[MediaCache] Cleared all media');
    } catch (err) {
      console.error('[MediaCache] Failed to clear:', err);
    }
  }

  /**
   * Preload media for a list of drive file IDs
   */
  async preloadMedia(items: Array<{ driveFileId: string; url: string }>): Promise<void> {
    console.log(`[MediaCache] Preloading ${items.length} media items...`);

    // Preload in chunks to avoid overwhelming the network
    const CHUNK_SIZE = 5;
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      await Promise.allSettled(
        chunk.map(item => this.getMedia(item.driveFileId, item.url))
      );
    }

    console.log('[MediaCache] Preloading complete');
  }
}

// Export singleton instance
export const mediaCache = new MediaCacheService();
