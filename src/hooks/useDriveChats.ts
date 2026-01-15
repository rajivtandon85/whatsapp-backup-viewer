/**
 * useDriveChats Hook
 * Manages Google Drive chat loading, caching, and state
 */

import { useState, useCallback, useEffect } from 'react';
import {
  loadGapiClient,
  loadGisClient,
  initTokenClient,
  requestAccessToken,
  signOut,
  isSignedIn,
  tryRestoreSession,
  trySilentReauth,
  isTokenExpired,
  GOOGLE_CLIENT_ID,
} from '../config/googleDrive';
import {
  initializeDriveFolders,
  getChatFolders,
  getChatFiles,
  getPasswordHash,
  verifyPassword,
  hashPassword,
  loadMediaFile,
  searchChats,
  type ChatFolder,
} from '../services/driveService';
import {
  initCache,
} from '../services/cacheService';
import { chatCache } from '../services/chatCache';
import { mediaCache } from '../services/mediaCache';
import { parseChatFile } from '../utils/chatParser';
import { mergeMessages, mergeParticipants } from '../utils/chatMerger';
import type { Chat, Message, MediaFile } from '../types';

interface DriveState {
  isInitialized: boolean;
  isSignedIn: boolean;
  isLoading: boolean;
  error: string | null;
  publicChats: ChatFolder[];
  privateChats: ChatFolder[];
  privateUnlocked: boolean;
  passwordHash: string | null;
}

export function useDriveChats() {
  const [state, setState] = useState<DriveState>({
    isInitialized: false,
    isSignedIn: false,
    isLoading: false,
    error: null,
    publicChats: [],
    privateChats: [],
    privateUnlocked: false,
    passwordHash: null,
  });

  const [, setFolderIds] = useState<{
    publicId: string | null;
    privateId: string | null;
    passwordId: string | null;
  }>({ publicId: null, privateId: null, passwordId: null });

  /**
   * Initialize Google API and load chat folders
   */
  const initialize = useCallback(async () => {
    // Check if client ID is configured
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes('YOUR_CLIENT_ID')) {
      setState(prev => ({
        ...prev,
        isInitialized: true,
        error: 'Application not configured. Please contact administrator.',
      }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Load Google APIs
      await Promise.all([loadGapiClient(), loadGisClient()]);

      // Initialize caches (old cache service + new chat/media cache)
      await Promise.all([
        initCache(),
        chatCache.init(),
        mediaCache.init(),
      ]);

      // Initialize token client
      initTokenClient(async () => {
        // This callback runs when we get a token
        setState(prev => ({ ...prev, isSignedIn: true }));
        await loadChatsFromDrive();
      });

      // Try to restore session from stored token
      if (tryRestoreSession()) {
        setState(prev => ({ ...prev, isSignedIn: true }));
        await loadChatsFromDrive();
      }

      setState(prev => ({
        ...prev,
        isInitialized: true,
        isLoading: false,
        isSignedIn: isSignedIn(),
      }));

      // If already signed in, load chats
      if (isSignedIn()) {
        await loadChatsFromDrive();
      }
    } catch (error) {
      console.error('Failed to initialize Google Drive:', error);
      setState(prev => ({
        ...prev,
        isInitialized: true,
        isLoading: false,
        error: `Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
    }
  }, []);

  /**
   * Preload chats in background for instant access
   * Disabled for now - causing more harm than good with stutter
   */
  const preloadChatsInBackground = async (_chatFolders: ChatFolder[]) => {
    // DISABLED: This was causing stutter and memory issues
    // Instead, we'll rely on cache-on-demand which works better
    console.log(`[useDriveChats] Background preload disabled, using cache-on-demand`);
    return;

    /* OLD CODE - commented out
    console.log(`[useDriveChats] Starting background preload of ${chatFolders.length} chats...`);

    // Load chats one by one to avoid overwhelming the API
    for (const folder of chatFolders) {
      try {
        // Check if already cached
        const cached = await chatCache.getChat(folder.id);
        if (cached) {
          console.log(`[useDriveChats] Skipping preload (already cached): ${folder.name}`);
          continue;
        }

        // Load and cache
        console.log(`[useDriveChats] Preloading: ${folder.name}`);
        await loadChat(folder);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`[useDriveChats] Failed to preload ${folder.name}:`, err);
        // Continue with other chats
      }
    }

    console.log('[useDriveChats] Background preload complete');
    */
  };

  /**
   * Load chats from Google Drive
   */
  const loadChatsFromDrive = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Find wa_bckp folder structure
      const folders = await initializeDriveFolders();
      setFolderIds({
        publicId: folders.publicId,
        privateId: folders.privateId,
        passwordId: folders.passwordId,
      });

      if (!folders.rootId) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'No chat data found in your Google Drive. Please ensure your backup folder is set up correctly.',
        }));
        return;
      }

      // Load public chats
      let publicChats: ChatFolder[] = [];
      if (folders.publicId) {
        publicChats = await getChatFolders(folders.publicId, false);
      }

      // Load private chats (for search, but hidden until password)
      let privateChats: ChatFolder[] = [];
      if (folders.privateId) {
        privateChats = await getChatFolders(folders.privateId, true);
      }

      // Load password hash
      let passwordHash: string | null = null;
      if (folders.passwordId) {
        passwordHash = await getPasswordHash(folders.passwordId);
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        publicChats,
        privateChats,
        passwordHash,
      }));

      // Preload chats in background (non-blocking)
      preloadChatsInBackground(publicChats);

    } catch (error) {
      console.error('Failed to load chats:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: `Failed to load chats: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
    }
  }, []);

  /**
   * Sign in with Google
   */
  const signIn = useCallback(() => {
    requestAccessToken();
  }, []);

  /**
   * Sign out
   */
  const handleSignOut = useCallback(() => {
    signOut();
    setState(prev => ({
      ...prev,
      isSignedIn: false,
      publicChats: [],
      privateChats: [],
      privateUnlocked: false,
    }));
  }, []);

  /**
   * Unlock private chats with password
   */
  const unlockPrivate = useCallback(async (password: string): Promise<boolean> => {
    if (!state.passwordHash) {
      console.warn('No password hash found in Drive');
      return false;
    }

    const isValid = await verifyPassword(password, state.passwordHash);
    
    if (isValid) {
      setState(prev => ({ ...prev, privateUnlocked: true }));
    }

    return isValid;
  }, [state.passwordHash]);

  /**
   * Lock private chats (call when navigating away)
   */
  const lockPrivate = useCallback(() => {
    setState(prev => ({ ...prev, privateUnlocked: false }));
  }, []);

  /**
   * Search private chats by name
   */
  const searchPrivateChats = useCallback((query: string): ChatFolder[] => {
    return searchChats(state.privateChats, query);
  }, [state.privateChats]);

  /**
   * Load a full chat with messages (from Drive or cache)
   */
  const loadChat = useCallback(async (chatFolder: ChatFolder): Promise<Chat | null> => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      // Check chat cache first for instant loading
      const cachedChat = await chatCache.getChat(chatFolder.id);
      if (cachedChat) {
        console.log(`[useDriveChats] Loaded from cache: ${chatFolder.name}`);
        setState(prev => ({ ...prev, isLoading: false }));
        return cachedChat;
      }

      console.log(`[useDriveChats] Cache miss, loading from Drive: ${chatFolder.name}`);

      // Load from Drive (token validation should be done before calling this)
      const { chatTexts, mediaFiles } = await getChatFiles(chatFolder);

      if (chatTexts.length === 0) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: `No chat files found in "${chatFolder.name}"`,
        }));
        return null;
      }

      // Create media file lookup (lazy loading)
      const mediaLookup: MediaFile[] = [];
      let thumbCount = 0;
      let noThumbCount = 0;
      for (const [fileName, fileInfo] of mediaFiles) {
        // Only use thumbnails for images, not documents
        const isImage = fileInfo.mimeType.startsWith('image/');
        const thumbnailLink = isImage ? fileInfo.thumbnailLink : undefined;
        
        if (thumbnailLink) {
          thumbCount++;
        } else if (isImage) {
          noThumbCount++;
        }
        mediaLookup.push({
          fileName,
          url: '', // Always empty - load on demand
          mimeType: fileInfo.mimeType,
          size: fileInfo.size ? parseInt(fileInfo.size) : undefined,
          blob: new Blob(), // Placeholder
          driveFileId: fileInfo.id, // Store Drive ID for lazy loading
          thumbnailLink, // For quick preview (images only)
        } as MediaFile & { driveFileId: string; thumbnailLink?: string });
      }

      // Parse all chat files
      const allMessages: Message[][] = [];
      const allParticipants: Array<Array<{ id: string; name: string; color: string }>> = [];

      for (const chatText of chatTexts) {
        // Arguments: fileName, content, mediaFiles
        const { chat } = parseChatFile(chatText.name, chatText.content, mediaLookup);
        allMessages.push(chat.messages);
        // Add id to participants
        const participantsWithId = chat.participants.map((p, idx) => ({
          ...p,
          id: `${chatFolder.id}-${idx}`,
        }));
        allParticipants.push(participantsWithId);
      }

      // Merge and dedupe
      const mergedMessages = mergeMessages(allMessages);
      const mergedParticipants = mergeParticipants(allParticipants);

      // Clean messages before caching - remove blob data to save space
      const cleanMessages = mergedMessages.map(msg => {
        const cleaned: any = { ...msg };

        // Remove large blob data, keep only URLs and Drive IDs
        if (msg.mediaUrl && msg.mediaUrl.startsWith('blob:')) {
          // Don't store blob URLs in cache, they're temporary
          delete cleaned.mediaUrl;
        }

        return cleaned;
      });

      const fullChat: Chat = {
        id: chatFolder.id,
        name: chatFolder.name,
        messages: cleanMessages,
        participants: mergedParticipants,
        isGroup: mergedParticipants.length > 2,
      };

      // Save to new chat cache (IndexedDB) - only text data
      await chatCache.saveChat(fullChat);

      // Skip old cache service to avoid duplication
      // The old service was causing the 82MB bloat

      setState(prev => ({ ...prev, isLoading: false }));

      return fullChat;
    } catch (error) {
      console.error(`Failed to load chat "${chatFolder.name}":`, error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: `Failed to load chat: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }));
      return null;
    }
  }, []);

  /**
   * Ensure we have a valid token, refresh if needed
   */
  const ensureValidToken = useCallback(async (): Promise<boolean> => {
    if (!isTokenExpired()) {
      return true;
    }

    // Token expired, try silent re-auth
    const success = await trySilentReauth();
    if (success) {
      setState(prev => ({ ...prev, isSignedIn: true }));
      return true;
    }

    // Silent auth failed, user needs to login again
    setState(prev => ({ ...prev, isSignedIn: false }));
    return false;
  }, []);

  /**
   * Load media file on demand with smart caching
   */
  const getMediaUrl = useCallback(async (driveFileId: string, mimeType: string): Promise<string> => {
    // Ensure valid token before making API call
    const hasValidToken = await ensureValidToken();
    if (!hasValidToken) {
      throw new Error('Session expired. Please sign in again.');
    }

    // Load from Drive with IndexedDB caching (from driveService)
    const url = await loadMediaFile(driveFileId, mimeType);

    // Also add to media cache for LRU management
    // This will help with the 2GB rotating cache
    try {
      await mediaCache.getMedia(driveFileId, url);
    } catch (err) {
      console.warn('[useDriveChats] Failed to add to media cache:', err);
      // Don't fail if media cache fails, we still have the URL
    }

    return url;
  }, [ensureValidToken]);

  /**
   * Refresh chats from Drive (also re-establishes connection if broken)
   */
  const refresh = useCallback(async () => {
    // Ensure valid token before refreshing
    const hasValidToken = await ensureValidToken();
    if (!hasValidToken) {
      // Token refresh failed, need to sign in again
      requestAccessToken();
      return;
    }
    
    await loadChatsFromDrive();
  }, [loadChatsFromDrive, ensureValidToken]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Helper to generate password hash (for user to copy to Drive)
  const generateHashForPassword = useCallback(async (password: string): Promise<string> => {
    return hashPassword(password);
  }, []);

  return {
    // State
    isInitialized: state.isInitialized,
    isSignedIn: state.isSignedIn,
    isLoading: state.isLoading,
    error: state.error,
    publicChats: state.publicChats,
    privateChats: state.privateChats,
    privateUnlocked: state.privateUnlocked,
    hasPassword: !!state.passwordHash,

    // Actions
    signIn,
    signOut: handleSignOut,
    unlockPrivate,
    lockPrivate,
    searchPrivateChats,
    loadChat,
    getMediaUrl,
    refresh,
    ensureValidToken,
    generateHashForPassword,
  };
}
