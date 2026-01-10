/**
 * Core type definitions for WhatsApp Backup Viewer
 * Designed to accurately represent WhatsApp chat structure
 */

export interface WhatsAppBackup {
  chats: Chat[];
  extractedAt: Date;
}

export interface Chat {
  id: string;
  name: string; // Chat name (contact name or group name)
  participants: Participant[];
  messages: Message[];
  isGroup: boolean;
  avatar?: string; // Base64 or URL
}

export interface Participant {
  id: string;
  name: string;
  phoneNumber?: string;
  color: string; // For avatar background
}

export type MessageType = 
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'call'
  | 'system';

export interface Message {
  id: string;
  timestamp: Date;
  sender: string; // Participant name or 'You' or 'System'
  type: MessageType;
  content: string; // Text content or media caption
  mediaUrl?: string; // Object URL for media
  mediaFileName?: string;
  mediaMimeType?: string;
  mediaSize?: number;
  driveFileId?: string; // For lazy-loading media from Google Drive
  thumbnailUrl?: string; // Quick preview thumbnail from Drive
  isOutgoing: boolean; // true if sent by user
  reactions?: Reaction[];
  quotedMessage?: QuotedMessage;
  isDeleted?: boolean;
  isEdited?: boolean;
  callDuration?: string; // For call logs like "1 min", "4 min"
  callKind?: 'voice' | 'video';
  callMissed?: boolean;
}

export interface Reaction {
  emoji: string;
  sender: string;
  timestamp: Date;
}

export interface QuotedMessage {
  sender: string;
  content: string;
  mediaType?: MessageType;
}

export interface SystemMessage extends Message {
  systemType: 
    | 'date_separator'
    | 'encryption_notice'
    | 'group_created'
    | 'participant_added'
    | 'participant_removed'
    | 'participant_left'
    | 'subject_changed'
    | 'icon_changed'
    | 'you_blocked'
    | 'you_unblocked';
}

export interface MediaFile {
  fileName: string;
  blob: Blob;
  url: string;
  mimeType: string;
  size?: number;
  driveFileId?: string; // For lazy loading from Google Drive
  thumbnailLink?: string; // Quick preview thumbnail from Drive
}

export interface ParsedZipContent {
  chatFiles: Array<{ name: string; content: string }>;
  mediaFiles: MediaFile[];
}

export interface ChatParseResult {
  chat: Chat;
  errors: string[];
}

// UI State types
export interface AppState {
  backup: WhatsAppBackup | null;
  selectedChatId: string | null;
  isLoading: boolean;
  error: string | null;
  darkMode: boolean;
  searchQuery: string;
  showMediaGallery: boolean;
  selectedMediaIndex: number | null;
}

export interface TimelineGroup {
  date: Date;
  dateString: string; // "Today", "Yesterday", "March 15, 2024"
  messages: Message[];
}

export interface MessageBubbleGroup {
  sender: string;
  isOutgoing: boolean;
  messages: Message[];
  timestamp: Date; // First message timestamp
}

