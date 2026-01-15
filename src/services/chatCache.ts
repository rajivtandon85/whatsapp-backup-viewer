/**
 * Chat Cache Service
 * Uses IndexedDB to persistently store ALL chat messages
 * Text is tiny (few MB total) so we cache everything for instant loading
 */

import type { Chat } from '../types';

const DB_NAME = 'whatsapp-backup-cache';
const DB_VERSION = 1;
const CHAT_STORE = 'chats';
const METADATA_STORE = 'metadata';

interface CachedChat extends Chat {
  cachedAt: number;
}

interface CacheMetadata {
  key: string;
  value: any;
}

class ChatCacheService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[ChatCache] IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create chats object store
        if (!db.objectStoreNames.contains(CHAT_STORE)) {
          const chatStore = db.createObjectStore(CHAT_STORE, { keyPath: 'id' });
          chatStore.createIndex('cachedAt', 'cachedAt', { unique: false });
          console.log('[ChatCache] Created chats store');
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
          console.log('[ChatCache] Created metadata store');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Save a chat to cache
   */
  async saveChat(chat: Chat): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');

    const cachedChat: CachedChat = {
      ...chat,
      cachedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHAT_STORE], 'readwrite');
      const store = transaction.objectStore(CHAT_STORE);
      const request = store.put(cachedChat);

      request.onsuccess = () => {
        console.log(`[ChatCache] Saved chat: ${chat.name} (${chat.messages.length} messages)`);
        resolve();
      };

      request.onerror = () => {
        console.error('[ChatCache] Failed to save chat:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get a chat from cache
   */
  async getChat(chatId: string): Promise<Chat | null> {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHAT_STORE], 'readonly');
      const store = transaction.objectStore(CHAT_STORE);
      const request = store.get(chatId);

      request.onsuccess = () => {
        const cachedChat = request.result as CachedChat | undefined;
        if (cachedChat) {
          // Remove cache metadata before returning
          const { cachedAt, ...chat } = cachedChat;
          console.log(`[ChatCache] Retrieved chat from cache: ${chat.name}`);
          resolve(chat);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('[ChatCache] Failed to get chat:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all cached chats
   */
  async getAllChats(): Promise<Chat[]> {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHAT_STORE], 'readonly');
      const store = transaction.objectStore(CHAT_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const cachedChats = request.result as CachedChat[];
        const chats = cachedChats.map(({ cachedAt, ...chat }) => chat);
        console.log(`[ChatCache] Retrieved ${chats.length} chats from cache`);
        resolve(chats);
      };

      request.onerror = () => {
        console.error('[ChatCache] Failed to get all chats:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Delete a chat from cache
   */
  async deleteChat(chatId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHAT_STORE], 'readwrite');
      const store = transaction.objectStore(CHAT_STORE);
      const request = store.delete(chatId);

      request.onsuccess = () => {
        console.log(`[ChatCache] Deleted chat: ${chatId}`);
        resolve();
      };

      request.onerror = () => {
        console.error('[ChatCache] Failed to delete chat:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all cached chats
   */
  async clearAll(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CHAT_STORE], 'readwrite');
      const store = transaction.objectStore(CHAT_STORE);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[ChatCache] Cleared all chats');
        resolve();
      };

      request.onerror = () => {
        console.error('[ChatCache] Failed to clear chats:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ chatCount: number; messageCount: number; estimatedSize: string }> {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');

    const chats = await this.getAllChats();
    const messageCount = chats.reduce((sum, chat) => sum + chat.messages.length, 0);

    // Rough estimate: ~500 bytes per message on average
    const estimatedBytes = messageCount * 500;
    const estimatedSize = estimatedBytes < 1024 * 1024
      ? `${(estimatedBytes / 1024).toFixed(1)} KB`
      : `${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB`;

    return {
      chatCount: chats.length,
      messageCount,
      estimatedSize,
    };
  }

  /**
   * Set metadata value
   */
  async setMetadata(key: string, value: any): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], 'readwrite');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get metadata value
   */
  async getMetadata(key: string): Promise<any> {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result as CacheMetadata | undefined;
        resolve(result?.value || null);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const chatCache = new ChatCacheService();
