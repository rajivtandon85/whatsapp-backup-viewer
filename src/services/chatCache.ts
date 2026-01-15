/**
 * Chat Cache Service
 * Uses IndexedDB to persistently store ALL chat messages
 * Text is tiny (few MB total) so we cache everything for instant loading
 */

import type { Chat } from '../types';

const DB_NAME = 'whatsapp-backup-cache';
const DB_VERSION = 2; // Bumped to force cache clear (old data was bloated)
const CHAT_STORE = 'chats';
const METADATA_STORE = 'metadata';
const CACHE_VERSION_KEY = 'cache_version';
const CURRENT_CACHE_VERSION = '2.0'; // Version identifier for clean cache format

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

      request.onsuccess = async () => {
        this.db = request.result;
        console.log('[ChatCache] IndexedDB initialized');

        // Check cache version and clear if old
        try {
          const storedVersion = await this.getMetadata(CACHE_VERSION_KEY);
          if (storedVersion !== CURRENT_CACHE_VERSION) {
            console.log(`[ChatCache] Old cache version detected (${storedVersion || 'none'}), clearing all data...`);
            await this.clearAll();
            await this.setMetadata(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
            console.log('[ChatCache] Cache cleared and version updated to', CURRENT_CACHE_VERSION);
          }
        } catch (err) {
          console.error('[ChatCache] Failed to check/update cache version:', err);
        }

        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        console.log(`[ChatCache] Upgrading database from version ${oldVersion} to ${DB_VERSION}`);

        // If upgrading from old version, clear everything
        if (oldVersion > 0) {
          // Delete old stores if they exist
          if (db.objectStoreNames.contains(CHAT_STORE)) {
            db.deleteObjectStore(CHAT_STORE);
            console.log('[ChatCache] Deleted old chats store');
          }
          if (db.objectStoreNames.contains(METADATA_STORE)) {
            db.deleteObjectStore(METADATA_STORE);
            console.log('[ChatCache] Deleted old metadata store');
          }
        }

        // Create fresh stores
        const chatStore = db.createObjectStore(CHAT_STORE, { keyPath: 'id' });
        chatStore.createIndex('cachedAt', 'cachedAt', { unique: false });
        console.log('[ChatCache] Created chats store');

        db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
        console.log('[ChatCache] Created metadata store');

        // Set version in the transaction
        const transaction = (event.target as IDBOpenDBRequest).transaction;
        if (transaction) {
          const store = transaction.objectStore(METADATA_STORE);
          store.put({ key: CACHE_VERSION_KEY, value: CURRENT_CACHE_VERSION });
          console.log('[ChatCache] Set cache version to', CURRENT_CACHE_VERSION);
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
   * Only counts text data (what would be in .txt files), NOT media
   */
  async getStats(): Promise<{ chatCount: number; messageCount: number; estimatedSize: string }> {
    await this.init();
    if (!this.db) throw new Error('DB not initialized');

    const chats = await this.getAllChats();
    const messageCount = chats.reduce((sum, chat) => sum + chat.messages.length, 0);

    // Calculate size of TEXT data only (equivalent to .txt files)
    // Exclude media-related fields to get accurate chat text size
    let textBytes = 0;
    try {
      for (const chat of chats) {
        // Count only text fields, not media metadata
        const textOnlyMessages = chat.messages.map(msg => ({
          id: msg.id,
          timestamp: msg.timestamp,
          sender: msg.sender,
          type: msg.type,
          content: msg.content || '', // This is the actual text content
          isOutgoing: msg.isOutgoing,
          // Skip all media fields - they're counted separately in media cache
          // driveFileId, thumbnailUrl, mediaFileName, mediaMimeType, mediaSize
          quotedMessage: msg.quotedMessage ? {
            sender: msg.quotedMessage.sender,
            content: msg.quotedMessage.content || '',
          } : undefined,
          isDeleted: msg.isDeleted,
          isEdited: msg.isEdited,
        }));

        const textOnlyChat = {
          id: chat.id,
          name: chat.name,
          messages: textOnlyMessages,
          participants: chat.participants,
          isGroup: chat.isGroup,
        };

        const json = JSON.stringify(textOnlyChat);
        textBytes += new Blob([json]).size;
      }
    } catch (err) {
      console.error('[ChatCache] Failed to calculate size:', err);
      // Fallback: estimate based on average message content length
      // .txt files have: timestamp + sender + content
      textBytes = messageCount * 150; // ~150 bytes per message for text only
    }

    const estimatedSize = textBytes < 1024
      ? `${textBytes} B`
      : textBytes < 1024 * 1024
      ? `${(textBytes / 1024).toFixed(1)} KB`
      : `${(textBytes / (1024 * 1024)).toFixed(1)} MB`;

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
