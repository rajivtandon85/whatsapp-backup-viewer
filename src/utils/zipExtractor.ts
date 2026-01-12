/**
 * ZIP Extraction Utility
 * Handles extraction of WhatsApp backup ZIP files containing chat exports and media
 * Uses JSZip for client-side ZIP processing
 */

import JSZip from 'jszip';
import type { ParsedZipContent, MediaFile } from '../types';

/**
 * Extracts a WhatsApp backup ZIP file
 * @param file - The ZIP file uploaded by user
 * @returns Parsed content with chat files and media files
 */
export async function extractWhatsAppBackup(file: File): Promise<ParsedZipContent> {
  try {
    const zip = await JSZip.loadAsync(file);
    
    const chatFiles: Array<{ name: string; content: string }> = [];
    const mediaFiles: MediaFile[] = [];
    
    // Process all files in the ZIP
    const filePromises: Promise<void>[] = [];
    
    zip.forEach((relativePath, zipEntry) => {
      // Skip directories
      if (zipEntry.dir) return;
      
      const fileName = relativePath.split('/').pop() || relativePath;
      const lowerFileName = fileName.toLowerCase();
      
      // Identify chat text files
      // WhatsApp exports are typically named like:
      // "WhatsApp Chat with John Doe.txt"
      // "WhatsApp Chat - Group Name.txt"
      // "_chat.txt" (some formats)
      if (lowerFileName.endsWith('.txt') && 
          (lowerFileName.includes('chat') || lowerFileName.includes('_chat'))) {
        filePromises.push(
          zipEntry.async('string').then(content => {
            chatFiles.push({ name: fileName, content });
          })
        );
      }
      // Identify media files (images, videos, audio, documents)
      else if (isMediaFile(fileName)) {
        filePromises.push(
          zipEntry.async('blob').then(blob => {
            const mimeType = getMimeType(fileName);
            const url = URL.createObjectURL(blob);
            mediaFiles.push({
              fileName: relativePath, // Store full path from ZIP
              blob,
              url,
              mimeType,
              size: blob.size
            });
          })
        );
      }
    });
    
    // Wait for all files to be processed
    await Promise.all(filePromises);
    
    
    return { chatFiles, mediaFiles };
  } catch (error) {
    console.error('Error extracting ZIP:', error);
    throw new Error(`Failed to extract ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Determines if a file is a media file based on extension
 */
function isMediaFile(fileName: string): boolean {
  const mediaExtensions = [
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.heic', '.heif',
    // Videos
    '.mp4', '.mov', '.avi', '.mkv', '.webm', '.3gp',
    // Audio
    '.mp3', '.ogg', '.opus', '.m4a', '.aac', '.wav', '.amr',
    // Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt',
    '.zip', '.rar', '.7z',
    // Data files
    '.csv', '.json', '.xml',
    // Apple/mobile specific
    '.pkpass', '.vcf', '.apk', '.ics',
    // Other
    '.html', '.htm',
  ];

  const lowerFileName = fileName.toLowerCase();
  return mediaExtensions.some(ext => lowerFileName.endsWith(ext));
}

/**
 * Gets MIME type based on file extension
 */
function getMimeType(fileName: string): string {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  
  const mimeTypes: Record<string, string> = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'heic': 'image/heic',
    'heif': 'image/heif',
    // Videos
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'webm': 'video/webm',
    '3gp': 'video/3gpp',
    // Audio
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'opus': 'audio/opus',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',
    'wav': 'audio/wav',
    'amr': 'audio/amr',
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    // Data files
    'csv': 'text/csv',
    'json': 'application/json',
    'xml': 'application/xml',
    // Apple/mobile specific
    'pkpass': 'application/vnd.apple.pkpass',
    'vcf': 'text/vcard',
    'apk': 'application/vnd.android.package-archive',
    'ics': 'text/calendar',
    // Other
    'html': 'text/html',
    'htm': 'text/html',
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Cleans up object URLs to prevent memory leaks
 */
export function cleanupMediaUrls(mediaFiles: MediaFile[]): void {
  mediaFiles.forEach(file => {
    if (file.url.startsWith('blob:')) {
      URL.revokeObjectURL(file.url);
    }
  });
}

