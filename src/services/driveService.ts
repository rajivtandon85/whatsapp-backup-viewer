/**
 * Google Drive Service
 * Handles all interactions with Google Drive API for WhatsApp backup viewing
 */

import { DRIVE_ROOT_FOLDER, DRIVE_FOLDERS, PASSWORD_HASH_FILE } from '../config/googleDrive';
import { getCachedImage, cacheImage } from './cacheService';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  parents?: string[];
  thumbnailLink?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  modifiedTime: string;
}

export interface ChatFolder {
  id: string;
  name: string; // Display name (folder name)
  modifiedTime: string;
  backupFolders: DriveFolder[]; // Subfolders containing backups
  isPrivate: boolean;
}

/**
 * Find a folder by name within a parent folder
 */
async function findFolder(name: string, parentId?: string): Promise<DriveFolder | null> {
  let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  try {
    const response = await gapi.client.drive.files.list({
      q: query,
      fields: 'files(id, name, modifiedTime)',
      spaces: 'drive',
    });

    const files = response.result.files;
    if (files && files.length > 0) {
      return {
        id: files[0].id!,
        name: files[0].name!,
        modifiedTime: files[0].modifiedTime!,
      };
    }
    return null;
  } catch (error) {
    console.error(`Error finding folder "${name}":`, error);
    return null;
  }
}

/**
 * List all subfolders within a folder
 */
async function listSubfolders(parentId: string): Promise<DriveFolder[]> {
  try {
    const response = await gapi.client.drive.files.list({
      q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name, modifiedTime)',
      spaces: 'drive',
      orderBy: 'name',
    });

    return (response.result.files || []).map(f => ({
      id: f.id!,
      name: f.name!,
      modifiedTime: f.modifiedTime!,
    }));
  } catch (error) {
    console.error('Error listing subfolders:', error);
    return [];
  }
}

/**
 * List all files in a folder (non-recursive)
 */
async function listFiles(parentId: string): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const response = await gapi.client.drive.files.list({
        q: `'${parentId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, thumbnailLink)',
        spaces: 'drive',
        pageSize: 1000,
        pageToken,
      });

      const files = response.result.files || [];
      allFiles.push(...files.map(f => ({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType!,
        modifiedTime: f.modifiedTime!,
        size: f.size,
        thumbnailLink: (f as { thumbnailLink?: string }).thumbnailLink,
      })));

      pageToken = response.result.nextPageToken;
    } while (pageToken);

    return allFiles;
  } catch (error) {
    console.error('Error listing files:', error);
    return [];
  }
}

/**
 * Get file content as text
 */
async function getFileContent(fileId: string): Promise<string> {
  try {
    const response = await gapi.client.drive.files.get({
      fileId,
      alt: 'media',
    });
    return response.body;
  } catch (error) {
    console.error('Error getting file content:', error);
    throw error;
  }
}

/**
 * Get file content as blob URL (for media)
 * Uses fetch with access token since gapi doesn't handle binary properly
 */
async function getFileAsBlob(fileId: string, mimeType: string): Promise<string> {
  const accessToken = gapi.client.getToken()?.access_token;
  if (!accessToken) {
    throw new Error('Not authenticated');
  }
  
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status}`);
  }
  
  const blob = await response.blob();
  const typedBlob = new Blob([blob], { type: mimeType });
  return URL.createObjectURL(typedBlob);
}

/**
 * Initialize and find the wa_bckp folder structure
 */
export async function initializeDriveFolders(): Promise<{
  rootId: string | null;
  publicId: string | null;
  privateId: string | null;
  passwordId: string | null;
}> {
  // Find root folder
  const root = await findFolder(DRIVE_ROOT_FOLDER);
  if (!root) {
    console.warn('Backup folder not found in Drive');
    return { rootId: null, publicId: null, privateId: null, passwordId: null };
  }

  // Find subfolders
  const [publicFolder, privateFolder, passwordFolder] = await Promise.all([
    findFolder(DRIVE_FOLDERS.PUBLIC, root.id),
    findFolder(DRIVE_FOLDERS.PRIVATE, root.id),
    findFolder(DRIVE_FOLDERS.PASSWORD, root.id),
  ]);

  return {
    rootId: root.id,
    publicId: publicFolder?.id || null,
    privateId: privateFolder?.id || null,
    passwordId: passwordFolder?.id || null,
  };
}

/**
 * Get list of chat folders (contacts/groups) from public or private folder
 */
export async function getChatFolders(folderId: string, isPrivate: boolean): Promise<ChatFolder[]> {
  const chatFolders = await listSubfolders(folderId);
  
  // For each chat folder, get its backup subfolders
  const results = await Promise.all(
    chatFolders.map(async (folder) => {
      const backupFolders = await listSubfolders(folder.id);
      return {
        id: folder.id,
        name: folder.name,
        modifiedTime: folder.modifiedTime,
        backupFolders: backupFolders.length > 0 ? backupFolders : [folder], // If no subfolders, treat the folder itself as a backup
        isPrivate,
      };
    })
  );

  return results;
}

/**
 * Get password hash from Drive
 */
export async function getPasswordHash(passwordFolderId: string): Promise<string | null> {
  const files = await listFiles(passwordFolderId);
  const hashFile = files.find(f => f.name === PASSWORD_HASH_FILE);
  
  if (!hashFile) {
    console.warn('Password configuration not found');
    return null;
  }

  const content = await getFileContent(hashFile.id);
  return content.trim();
}

/**
 * Hash a password using SHA-256
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify password against stored hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const inputHash = await hashPassword(password);
  return inputHash === storedHash;
}

/**
 * Get all chat files from a chat folder (merges multiple backups)
 */
export async function getChatFiles(chatFolder: ChatFolder): Promise<{
  chatTexts: Array<{ name: string; content: string; backupName: string }>;
  mediaFiles: Map<string, { id: string; name: string; mimeType: string; size?: string; thumbnailLink?: string }>;
}> {
  const chatTexts: Array<{ name: string; content: string; backupName: string }> = [];
  const mediaFiles = new Map<string, { id: string; name: string; mimeType: string; size?: string; thumbnailLink?: string }>();

  // Process each backup folder
  for (const backupFolder of chatFolder.backupFolders) {
    const files = await listFiles(backupFolder.id);
    
    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      
      // Chat text files
      if (lowerName.endsWith('.txt') && (lowerName.includes('chat') || lowerName === '_chat.txt')) {
        const content = await getFileContent(file.id);
        chatTexts.push({
          name: file.name,
          content,
          backupName: backupFolder.name,
        });
      }
      // Media files - dedupe by filename
      else if (isMediaFile(file.name)) {
        if (!mediaFiles.has(file.name)) {
          mediaFiles.set(file.name, {
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            thumbnailLink: file.thumbnailLink,
          });
        }
      }
    }
  }

  return { chatTexts, mediaFiles };
}

/**
 * Load a media file on demand (returns blob URL)
 * Uses IndexedDB cache for faster subsequent loads
 */
export async function loadMediaFile(fileId: string, mimeType: string): Promise<string> {
  // Check cache first
  try {
    const cachedBlob = await getCachedImage(fileId);
    if (cachedBlob) {
      // Return cached blob as URL
      return URL.createObjectURL(cachedBlob);
    }
  } catch {
    // Cache miss or error, continue to fetch from Drive
  }

  // Fetch from Drive
  const url = await getFileAsBlob(fileId, mimeType);
  
  // Cache the blob for future use (only for images to save space)
  if (mimeType.startsWith('image/')) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      await cacheImage(fileId, blob);
    } catch {
      // Caching failed, but we still have the URL
    }
  }
  
  return url;
}

/**
 * Check if a filename is a media file
 */
function isMediaFile(fileName: string): boolean {
  const mediaExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.heif',
    '.mp4', '.mov', '.avi', '.mkv', '.webm', '.3gp',
    '.mp3', '.ogg', '.opus', '.m4a', '.aac', '.wav', '.amr',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.vcf', '.apk',
  ];
  
  const lowerName = fileName.toLowerCase();
  return mediaExtensions.some(ext => lowerName.endsWith(ext));
}

/**
 * Search for chats by name (for private chat search)
 */
export function searchChats(chats: ChatFolder[], query: string): ChatFolder[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  
  return chats.filter(chat => 
    chat.name.toLowerCase().includes(q)
  );
}
