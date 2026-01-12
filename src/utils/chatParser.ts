/**
 * WhatsApp Chat Parser
 * Parses exported WhatsApp chat text files into structured message objects
 * 
 * Supports formats:
 * - Android: "12/31/2023, 11:45 PM - John: Hello there"
 * - Android (24h): "12/31/2023, 23:45 - John: Hello there"
 * - iOS: "[12/31/23, 11:45:32 PM] John: Hello there"
 * 
 * Design decisions:
 * - Handles multi-line messages (messages spanning multiple lines)
 * - Identifies system messages (encryption, group events, etc.)
 * - Extracts media references (IMG-20231231-WA0001.jpg)
 * - Preserves message ordering and timestamps accurately
 */

import type { Chat, Message, MessageType, Participant, ChatParseResult, MediaFile } from '../types';
import { isMeSender } from '../config/userIdentity';

interface MessageMatch {
  timestamp: Date;
  sender: string;
  content: string;
  line: string;
  isSystemLine?: boolean;
}

type DateOrder = 'DMY' | 'MDY';

/**
 * Main parser function - converts chat file content into structured Chat object
 */
export function parseChatFile(
  fileName: string,
  content: string,
  mediaFiles: MediaFile[]
): ChatParseResult {
  const errors: string[] = [];
  
  try {
    // Extract chat name from file name
    // "WhatsApp Chat with John Doe.txt" -> "John Doe"
    // "WhatsApp Chat - Group Name.txt" -> "Group Name"
    let chatName = extractChatName(fileName);
    
    // Parse all messages (initially all marked as incoming)
    const messages = parseMessages(content, mediaFiles, errors);
    
    if (messages.length === 0) {
      errors.push('No messages found in chat file');
    }
    
    // Extract unique participants
    let participants = extractParticipants(messages);
    
    // Determine if it's a group chat.
    // If there are exactly 2 participants, treat it as a 1:1 chat even if the
    // raw text contains words like "added" in normal messages.
    const looksLikeGroup = participants.length > 2 || detectGroupIndicators(content);
    const isOneToOne = participants.length === 2;
    const isGroup = looksLikeGroup && !isOneToOne;
    
    // If filename doesn't have a meaningful name (common: "_chat.txt"),
    // try to derive the chat name from the export content (group subject).
    if (chatName === 'Unnamed Chat') {
      const derived = deriveChatNameFromContent(content);
      if (derived) chatName = derived;
    }

    // Fix 1:1 chat title and participant ordering using USER_IDENTITY
    // - Chat title should be the other participant, not you.
    // - Participants array should have "other" first (used for avatar/color in UI).
    if (isOneToOne) {
      const me = participants.find((p) => isMeSender(p.name));
      const other = participants.find((p) => !isMeSender(p.name));

      if (other) {
        chatName = other.name;
      }

      if (me && other) {
        participants = [other, me];
      }
    }
    
    const chat: Chat = {
      id: generateChatId(chatName),
      name: chatName,
      participants,
      messages,
      isGroup
    };
    
    return { chat, errors };
  } catch (error) {
    errors.push(`Failed to parse chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    
    // Return minimal valid chat object
    return {
      chat: {
        id: generateChatId(fileName),
        name: fileName,
        participants: [],
        messages: [],
        isGroup: false
      },
      errors
    };
  }
}

/**
 * Extracts chat name from file name
 * Handles various WhatsApp export filename formats
 */
function extractChatName(fileName: string): string {
  // Remove file extension
  let name = fileName.replace(/\.txt$/i, '');
  
  // Remove common WhatsApp export prefixes
  name = name.replace(/^WhatsApp Chat with /i, '');
  name = name.replace(/^WhatsApp Chat - /i, '');
  name = name.replace(/^Chat with /i, '');
  name = name.replace(/^_chat$/i, '');
  
  // Trim whitespace
  name = name.trim();
  
  // If still empty or just "chat", return a fallback
  if (!name || name.toLowerCase() === 'chat') {
    return 'Unnamed Chat';
  }
  
  return name;
}

function deriveChatNameFromContent(raw: string): string | null {
  const text = raw || '';

  // Common WhatsApp export system lines that contain the group subject/name.
  // Examples:
  // - "You created group \"My Group\""
  // - "Alice created group \"My Group\""
  // - "Alice changed the subject to \"My Group\""
  // - "Alice changed the subject from \"Old\" to \"New\""
  const patterns: RegExp[] = [
    /created group\s+["“](.+?)["”]/i,
    /changed the subject to\s+["“](.+?)["”]/i,
    /changed the subject from\s+["“].+?["”]\s+to\s+["“](.+?)["”]/i,
    // Some exports omit quotes:
    /changed the subject to\s+(.+?)$/im,
  ];

  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const name = m[1].trim();
      if (name && name.length <= 80) return name;
    }
  }

  return null;
}

/**
 * Parses all messages from chat content
 */
function parseMessages(
  content: string,
  mediaFiles: MediaFile[],
  errors: string[]
): Message[] {
  const lines = content.split('\n');
  const messages: Message[] = [];
  let currentMessage: MessageMatch | null = null;

  // Infer date order (DD/MM vs MM/DD) once per file for consistent parsing.
  // WhatsApp exports follow the device locale; for India this is commonly DD/MM.
  const dateOrder = inferDateOrder(lines);
  
  for (let i = 0; i < lines.length; i++) {
    // Normalize line BEFORE parsing - remove invisible WhatsApp characters
    const line = normalizeWaText(lines[i]);
    
    if (!line) continue;
    
    // Try to match message pattern (user lines first, then system lines)
    const match = matchMessageLine(line, dateOrder) ?? matchSystemLine(line, dateOrder);
    
    if (match) {
      // Save previous message if exists
      if (currentMessage) {
        messages.push(createMessage(currentMessage, mediaFiles, messages.length));
      }
      
      currentMessage = match;
    } else if (currentMessage) {
      // This line is a continuation of the previous message (multi-line message)
      // Only skip if line STARTS with a WhatsApp timestamp pattern (not just contains date-like text)
      // WhatsApp format: [DD/MM/YY, HH:MM:SS am/pm] or similar at START of line
      const startsWithTimestamp = /^\s*\[?\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}(:\d{2})?\s*(am|pm|AM|PM)?\s*\]/.test(line);
      if (startsWithTimestamp) {
        // This is a timestamp line that failed to parse - DO NOT add as content
        console.warn('⚠️ Skipped unparsed timestamp line:', line.substring(0, 100));
        // Try to save current message and treat this as start of new unparseable message
        if (currentMessage.content.trim()) {
          messages.push(createMessage(currentMessage, mediaFiles, messages.length));
        }
        currentMessage = null; // Reset - we'll lose this line but that's better than corrupting
      } else {
        // Normal continuation line - append to current message
        currentMessage.content += '\n' + line;
      }
    } else {
      // Line doesn't match pattern and no current message - might be header
      if (i < 5) {
        // Ignore first few lines (might be encryption notice, etc.)
        continue;
      }
      errors.push(`Could not parse line ${i + 1}: ${line.substring(0, 50)}...`);
    }
  }
  
  // Don't forget the last message
  if (currentMessage) {
    messages.push(createMessage(currentMessage, mediaFiles, messages.length));
  }
  
  // Filter out empty text-only messages and omitted media placeholders
  return messages.filter(msg => {
    if (msg.type !== 'text') return true; // Keep all media/system messages
    if (msg.content === '__OMITTED_MEDIA__') return false; // Skip omitted media placeholders
    return msg.content.trim().length > 0; // Only keep text with actual content
  });
}

function normalizeWaText(s: string): string {
  // Remove common invisible marks that appear in WhatsApp exports.
  // U+200E LRM, U+200F RLM, U+FEFF BOM, U+202A-U+202E (directional formatting)
  // U+2060 Word Joiner, U+00A0 Non-breaking space, U+200B Zero-width space
  return (s || '')
    .replace(/[\u200E\u200F\uFEFF\u202A-\u202E\u2060\u200B\u00A0]/g, '')  // Remove (not replace with space)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Overload that uses a preferred date order hint.
 */
function matchMessageLine(line: string, dateOrder: DateOrder): MessageMatch | null {
  // Android format: "12/31/2023, 11:45 PM - John: Hello"
  const androidRegex = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\s*[-–]\s*([^:]+?):\s*(.*)$/;

  // iOS format: "[12/31/23, 11:45:32 PM] John: Hello"
  const iosRegex = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\]\s*([^:]+?):\s*(.*)$/;

  // European format: "31/12/2023, 23:45 - John: Hello"
  const europeanRegex = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]\s*([^:]+?):\s*(.*)$/;

  const match = line.match(androidRegex) || line.match(iosRegex) || line.match(europeanRegex);

  if (match) {
    const [, datePart, timePart, sender, content] = match;
    const timestamp = parseTimestamp(datePart, timePart, dateOrder);
    if (timestamp) {
      return {
        timestamp,
        sender: normalizeWaText(sender),
        content: normalizeWaText(content),
        line,
        isSystemLine: false,
      };
    }
  }

  return null;
}

function matchSystemLine(line: string, dateOrder: DateOrder): MessageMatch | null {
  // Android system: "14/08/25, 12:02 am - Messages are end-to-end encrypted"
  const androidSystem = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\s*[-–]\s*(.*)$/;
  // iOS system: "[14/08/25, 12:02:21 am] Messages are end-to-end encrypted"
  const iosSystem = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)\]\s*(.*)$/;

  const m = line.match(androidSystem) || line.match(iosSystem);
  if (!m) return null;

  const [, datePart, timePart, rest] = m;

  // If it looks like "Sender: ..." it's not a system line.
  if (/^[^:]+?:\s/.test(rest)) return null;

  const timestamp = parseTimestamp(datePart, timePart, dateOrder);
  if (!timestamp) return null;

  const cleaned = normalizeWaText(rest);
  if (!cleaned) return null;

  return {
    timestamp,
    sender: 'System',
    content: cleaned,
    line,
    isSystemLine: true,
  };
}

/**
 * Parses date and time strings into a Date object
 */
function parseTimestamp(datePart: string, timePart: string, dateOrderHint?: DateOrder): Date | null {
  try {
    // Normalize date part (handle both MM/DD/YYYY and DD/MM/YYYY)
    const dateParts = datePart.split('/');
    let month: number, day: number, year: number;
    
    if (dateParts.length === 3) {
      // Try to determine format by checking values (or use hint for ambiguous cases)
      const part1 = parseInt(dateParts[0]);
      const part2 = parseInt(dateParts[1]);
      const part3 = parseInt(dateParts[2]);
      
      if (dateOrderHint === 'DMY') {
        day = part1;
        month = part2;
        year = part3;
      } else if (dateOrderHint === 'MDY') {
        month = part1;
        day = part2;
        year = part3;
      } else if (part1 > 12) {
        // DD/MM
        day = part1;
        month = part2;
        year = part3;
      } else if (part2 > 12) {
        // MM/DD
        month = part1;
        day = part2;
        year = part3;
      } else {
        // Ambiguous (both <= 12): default to DD/MM (works for most non-US locales)
        day = part1;
        month = part2;
        year = part3;
      }
      
      // Handle 2-digit years
      if (year < 100) {
        year += 2000;
      }
    } else {
      return null;
    }
    
    // Parse time part
    const timeRegex = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm)?/;
    const timeMatch = timePart.match(timeRegex);
    
    if (!timeMatch) return null;
    
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const seconds = timeMatch[3] ? parseInt(timeMatch[3]) : 0;
    const meridiem = timeMatch[4]?.toUpperCase();
    
    // Convert to 24-hour format if needed
    if (meridiem === 'PM' && hours < 12) {
      hours += 12;
    } else if (meridiem === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return new Date(year, month - 1, day, hours, minutes, seconds);
  } catch (error) {
    console.error('Error parsing timestamp:', error);
    return null;
  }
}

/**
 * Infer date order from the chat file lines.
 * If we ever see a first number > 12, we know it's DD/MM.
 * If we ever see a second number > 12, we know it's MM/DD.
 * If ambiguous throughout, default to DD/MM (better for non-US locales).
 */
function inferDateOrder(lines: string[]): DateOrder {
  let dmyEvidence = 0;
  let mdyEvidence = 0;

  // Only scan the first chunk; enough to infer locale without heavy work.
  const maxScan = Math.min(lines.length, 800);

  for (let i = 0; i < maxScan; i++) {
    const line = lines[i];
    // Quick extract: starts with date or [date
    const m = line.match(/^\[?(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!m) continue;
    const a = parseInt(m[1], 10);
    const b = parseInt(m[2], 10);
    if (a > 12) dmyEvidence++;
    if (b > 12) mdyEvidence++;
  }

  if (dmyEvidence > 0 && mdyEvidence === 0) return 'DMY';
  if (mdyEvidence > 0 && dmyEvidence === 0) return 'MDY';

  // If both appear, pick the stronger signal; ties default to DMY.
  if (mdyEvidence > dmyEvidence) return 'MDY';
  return 'DMY';
}

/**
 * Creates a Message object from parsed message data
 */
function createMessage(
  match: MessageMatch,
  mediaFiles: MediaFile[],
  seq: number
): Message {
  const { timestamp, sender, content } = match;
  
  // Determine message type and extract media info
  const { type, mediaUrl, mediaFileName, mediaMimeType, mediaSize, driveFileId, thumbnailUrl, finalContent } =
    detectMessageType(content, mediaFiles);
  
  // Edited marker (Android export often appends this)
  const { cleaned: editedCleaned, isEdited } = stripEditedMarker(finalContent);

  // Quoted/reply detection (best-effort from export text)
  const { cleaned: replyCleaned, quotedMessage } = extractQuotedMessage(editedCleaned);

  // Detect if it's a call log (WhatsApp exports call logs as text lines)
  const { isCall, callDuration, callKind, callMissed } = detectCallLog(replyCleaned);

  // System messages must come from system lines (no "Sender:").
  // Never infer system messages from normal chat text, otherwise we get false positives
  // like: "They joined waited tried calling and left".
  const isSystem = match.isSystemLine === true;
  
  // Detect if message is outgoing (sent by user)
  const isOutgoing = !isSystem && isMeSender(sender);
  
  return {
    id: generateMessageId(timestamp, sender, seq),
    timestamp,
    sender,
    type: isSystem ? 'system' : (isCall ? 'call' : type),
    content: replyCleaned,
    mediaUrl,
    mediaFileName,
    mediaMimeType,
    mediaSize,
    driveFileId,
    thumbnailUrl,
    isOutgoing,
    isEdited: isEdited || undefined,
    quotedMessage,
    callDuration,
    callKind,
    callMissed,
  };
}

/**
 * Detects message type based on content and matches with media files
 */
function detectMessageType(
  content: string,
  mediaFiles: MediaFile[]
): {
  type: MessageType;
  mediaUrl?: string;
  mediaFileName?: string;
  mediaMimeType?: string;
  mediaSize?: number;
  driveFileId?: string;
  thumbnailUrl?: string;
  finalContent: string;
} {
  const c = normalizeWaText(content);

  // Common placeholders when media isn't included in export - skip these entirely
  if (/^image omitted$/i.test(c) || /^video omitted$/i.test(c) || /^audio omitted$/i.test(c) || /^sticker omitted$/i.test(c) || /^document omitted$/i.test(c) || /^GIF omitted$/i.test(c)) {
    return { type: 'text', finalContent: '__OMITTED_MEDIA__' };
  }

  // Check for media attachments
  // WhatsApp format: "<attached: IMG-20231231-WA0001.jpg>"
  // Or: "IMG-20231231-WA0001.jpg (file attached)"
  // Or just the filename if it's an image/video message
  
  const mediaPatterns = [
    /<attached:\s*(.+?)>/i,
    /(.+?)\s*\(file attached\)/i,
    /^(IMG-\d+-WA\d+\.\w+)$/i,
    /^(VID-\d+-WA\d+\.\w+)$/i,
    /^(AUD-\d+-WA\d+\.\w+)$/i,
    /^(PTT-\d+-WA\d+\.\w+)$/i, // Push-to-talk (voice message)
    /^(STK-\d+-WA\d+\.webp)$/i, // Sticker
    /^(DOC-\d+-WA\d+\.\w+)$/i
  ];
  
  for (const pattern of mediaPatterns) {
    const match = c.match(pattern);
    if (match) {
      const fileName = match[1];
      const mediaFile = findMediaFile(fileName, mediaFiles);
      
      if (mediaFile) {
        const type = getMessageTypeFromMime(mediaFile.mimeType);
        const caption = c.replace(pattern, '').trim();
        
        // Cast to access driveFileId if present (from Google Drive)
        const driveFileId = (mediaFile as MediaFile & { driveFileId?: string }).driveFileId;
        
        return {
          type,
          mediaUrl: mediaFile.url,
          mediaFileName: mediaFile.fileName,
          mediaMimeType: mediaFile.mimeType,
          mediaSize: mediaFile.size,
          driveFileId,
          thumbnailUrl: (mediaFile as MediaFile & { thumbnailLink?: string }).thumbnailLink,
          finalContent: caption
        };
      }
      
      // Media file referenced but not found in ZIP
      // Strip the <attached:...> pattern and show placeholder text
      const caption = c.replace(pattern, '').trim();
      console.warn('Media file not found in ZIP:', fileName);
      
      return {
        type: 'text',
        finalContent: caption || `[Media not found: ${fileName}]`
      };
    }
  }
  
  return {
    type: 'text',
    finalContent: c
  };
}

/**
 * Finds a media file by name (case-insensitive, fuzzy matching)
 */
function findMediaFile(fileName: string, mediaFiles: MediaFile[]): MediaFile | undefined {
  const normalizedName = fileName.toLowerCase().trim();
  const baseFileName = normalizedName.split('/').pop() || normalizedName;
  
  // Extract numeric ID from filename (e.g., "00174172" from "00174172-PHOTO-2025-12-23-15-04-52.jpg")
  const numericId = baseFileName.match(/^(\d+)/)?.[1] || '';
  // Extract date portion (e.g., "2025-12-23-15-04-52" or "2025-12-23")
  const dateMatch = baseFileName.match(/(\d{4}-\d{2}-\d{2}(?:-\d{2}-\d{2}-\d{2})?)/);
  const datePortion = dateMatch?.[1] || '';
  
  // Try exact match first (with or without path)
  let match = mediaFiles.find(file => {
    const fileNameLower = file.fileName.toLowerCase();
    return fileNameLower === normalizedName || fileNameLower.endsWith('/' + normalizedName);
  });
  
  if (match) return match;
  
  // Try matching just the base filename
  match = mediaFiles.find(file => {
    const fileBase = file.fileName.toLowerCase().split('/').pop() || '';
    return fileBase === baseFileName;
  });
  
  if (match) return match;
  
  // Try fuzzy match (filename contains the search term)
  match = mediaFiles.find(file => {
    const fileNameLower = file.fileName.toLowerCase();
    return fileNameLower.includes(baseFileName);
  });
  
  if (match) return match;
  
  // Try matching by numeric ID (most reliable for WhatsApp exports)
  if (numericId && numericId.length >= 5) {
    match = mediaFiles.find(file => {
      const fileBase = file.fileName.toLowerCase().split('/').pop() || '';
      return fileBase.includes(numericId);
    });
    
    if (match) return match;
  }
  
  // Try matching by date portion
  if (datePortion) {
    match = mediaFiles.find(file => {
      const fileBase = file.fileName.toLowerCase().split('/').pop() || '';
      return fileBase.includes(datePortion);
    });
    
    if (match) return match;
  }
  
  return undefined;
}

/**
 * Determines message type from MIME type
 */
function getMessageTypeFromMime(mimeType: string): MessageType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'image/webp') return 'sticker';
  return 'document';
}

function stripEditedMarker(text: string): { cleaned: string; isEdited: boolean } {
  const marker = '<This message was edited>';
  const idx = text.lastIndexOf(marker);
  if (idx === -1) return { cleaned: text, isEdited: false };
  const cleaned = (text.slice(0, idx) + text.slice(idx + marker.length)).trim();
  return { cleaned, isEdited: true };
}

function extractQuotedMessage(text: string): { cleaned: string; quotedMessage?: { sender: string; content: string } } {
  // Best-effort: WhatsApp Android exports replies as:
  // "<QuotedSender>: <QuotedText>\n<ReplyText>"
  const parts = text.split('\n');
  if (parts.length < 2) return { cleaned: text };

  const first = parts[0].trim();
  const rest = parts.slice(1).join('\n').trim();

  const m = first.match(/^(.+?):\s(.+)$/);
  if (!m) return { cleaned: text };

  const quotedSender = m[1].trim();
  const quotedContent = m[2].trim();
  if (!quotedSender || !quotedContent || !rest) return { cleaned: text };

  return {
    cleaned: rest,
    quotedMessage: { sender: quotedSender, content: quotedContent },
  };
}

function detectCallLog(text: string): { isCall: boolean; callDuration?: string; callKind?: 'voice' | 'video'; callMissed?: boolean } {
  const t = (text || '').trim();
  // Examples:
  // "Voice call, 1 min"
  // "Voice call, 4 min"
  // "Video call, 2 min"
  // "Missed voice call"
  const missedVoice = /^missed voice call/i.test(t);
  const missedVideo = /^missed video call/i.test(t);
  if (missedVoice) return { isCall: true, callKind: 'voice', callMissed: true };
  if (missedVideo) return { isCall: true, callKind: 'video', callMissed: true };

  const voiceCall = t.match(/^voice call(?:,)?\s*(.*)$/i);
  if (voiceCall) {
    const dur = voiceCall[1]?.trim();
    return { isCall: true, callKind: 'voice', callDuration: dur || undefined };
  }

  const videoCall = t.match(/^video call(?:,)?\s*(.*)$/i);
  if (videoCall) {
    const dur = videoCall[1]?.trim();
    return { isCall: true, callKind: 'video', callDuration: dur || undefined };
  }

  return { isCall: false };
}

/**
 * Extracts unique participants from messages
 */
function extractParticipants(messages: Message[]): Participant[] {
  const participantMap = new Map<string, Participant>();
  const colors = generateParticipantColors();
  let colorIndex = 0;
  
  messages.forEach(msg => {
    if (!participantMap.has(msg.sender) && msg.type !== 'system') {
      participantMap.set(msg.sender, {
        id: generateParticipantId(msg.sender),
        name: msg.sender,
        color: colors[colorIndex % colors.length]
      });
      colorIndex++;
    }
  });
  
  return Array.from(participantMap.values());
}

/**
 * Detects if chat is a group based on content patterns
 */
function detectGroupIndicators(content: string): boolean {
  const groupPatterns = [
    /created group/i,
    /added/i,
    /removed/i,
    /joined using this group's invite link/i,
    /changed the subject from/i,
    /You're now an admin/i
  ];
  
  return groupPatterns.some(pattern => pattern.test(content));
}

/**
 * Generates participant colors for avatars
 */
function generateParticipantColors(): string[] {
  return [
    '#00a884', // WhatsApp green
    '#ff6b6b', // Red
    '#4ecdc4', // Teal
    '#ffd93d', // Yellow
    '#a8dadc', // Light blue
    '#f4a261', // Orange
    '#e76f51', // Dark orange
    '#2a9d8f', // Dark teal
    '#e63946', // Crimson
    '#06ffa5', // Mint
    '#7209b7', // Purple
    '#f72585', // Pink
  ];
}

/**
 * Generates a unique chat ID
 */
function generateChatId(name: string): string {
  return `chat_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
}

/**
 * Generates a unique message ID
 */
function generateMessageId(timestamp: Date, sender: string, seq: number): string {
  return `msg_${timestamp.getTime()}_${seq}_${sender.replace(/[^a-z0-9]/g, '_').toLowerCase()}`;
}

/**
 * Generates a unique participant ID
 */
function generateParticipantId(name: string): string {
  return `user_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

