/**
 * Timeline Builder
 * Reconstructs the message timeline with proper grouping and date separators
 * to match WhatsApp's visual presentation
 * 
 * Key behaviors:
 * - Groups consecutive messages from the same sender (within 10 minutes)
 * - Inserts date separators (Today, Yesterday, specific dates)
 * - Preserves exact message order and timestamps
 */

import type { Message, TimelineGroup, MessageBubbleGroup } from '../types';
import { 
  format, 
  isToday, 
  isYesterday, 
  isSameDay, 
  differenceInMinutes,
  startOfDay
} from 'date-fns';

/**
 * Groups messages by date for timeline rendering
 */
export function groupMessagesByDate(messages: Message[]): TimelineGroup[] {
  if (messages.length === 0) return [];
  
  const groups: TimelineGroup[] = [];
  let currentGroup: TimelineGroup | null = null;
  
  // Sort messages by timestamp (should already be sorted, but ensure it)
  const sortedMessages = [...messages].sort((a, b) => 
    a.timestamp.getTime() - b.timestamp.getTime()
  );
  
  sortedMessages.forEach(message => {
    const messageDate = startOfDay(message.timestamp);
    
    if (!currentGroup || !isSameDay(currentGroup.date, messageDate)) {
      // Start new date group
      currentGroup = {
        date: messageDate,
        dateString: formatDateSeparator(messageDate),
        messages: [message]
      };
      groups.push(currentGroup);
    } else {
      // Add to existing date group
      currentGroup.messages.push(message);
    }
  });
  
  return groups;
}

/**
 * Groups consecutive messages from the same sender into bubble groups
 * Messages are grouped if:
 * - Same sender
 * - Within 10 minutes of each other
 * - No system message in between
 */
export function groupMessagesIntoBubbles(messages: Message[]): MessageBubbleGroup[] {
  if (messages.length === 0) return [];
  
  const bubbleGroups: MessageBubbleGroup[] = [];
  let currentGroup: MessageBubbleGroup | null = null;
  
  messages.forEach((message) => {
    // System messages are never grouped
    if (message.type === 'system') {
      // Close current group if exists
      if (currentGroup) {
        bubbleGroups.push(currentGroup);
        currentGroup = null;
      }
      
      // Add system message as its own group
      bubbleGroups.push({
        sender: message.sender,
        isOutgoing: false,
        messages: [message],
        timestamp: message.timestamp
      });
      return;
    }
    
    const shouldGroup = currentGroup && 
      currentGroup.sender === message.sender &&
      currentGroup.isOutgoing === message.isOutgoing &&
      differenceInMinutes(message.timestamp, currentGroup.timestamp) <= 10;
    
    if (shouldGroup && currentGroup) {
      // Add to existing group
      currentGroup.messages.push(message);
    } else {
      // Close previous group
      if (currentGroup) {
        bubbleGroups.push(currentGroup);
      }
      
      // Start new group
      currentGroup = {
        sender: message.sender,
        isOutgoing: message.isOutgoing,
        messages: [message],
        timestamp: message.timestamp
      };
    }
  });
  
  // Don't forget the last group
  if (currentGroup) {
    bubbleGroups.push(currentGroup);
  }
  
  return bubbleGroups;
}

/**
 * Formats date for separator display
 * Examples: "Today", "Yesterday", "March 15, 2024"
 */
export function formatDateSeparator(date: Date): string {
  if (isToday(date)) {
    return 'TODAY';
  }
  
  if (isYesterday(date)) {
    return 'YESTERDAY';
  }
  
  // For dates within the last 7 days, show day name
  const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAgo < 7) {
    return format(date, 'EEEE').toUpperCase(); // "MONDAY", "TUESDAY", etc.
  }
  
  // For older dates, show full date
  return format(date, 'MMMM d, yyyy').toUpperCase(); // "MARCH 15, 2024"
}

/**
 * Formats message timestamp for display in bubble
 * Examples: "11:45 AM", "23:45"
 */
export function formatMessageTime(date: Date, use24Hour: boolean = false): string {
  return format(date, use24Hour ? 'HH:mm' : 'h:mm a');
}

/**
 * Formats timestamp for message details/info view
 * Example: "March 15, 2024 at 11:45 AM"
 */
export function formatMessageTimestamp(date: Date): string {
  return format(date, 'MMMM d, yyyy \'at\' h:mm a');
}

/**
 * Searches messages for a query string
 * Returns filtered messages that match the query
 */
export function searchMessages(messages: Message[], query: string): Message[] {
  if (!query.trim()) return messages;
  
  const lowerQuery = query.toLowerCase();
  
  return messages.filter(message => {
    // Search in message content
    if (message.content.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    
    // Search in sender name
    if (message.sender.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    
    // Search in media file name
    if (message.mediaFileName?.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    
    return false;
  });
}

/**
 * Extracts all media messages from a chat
 * Useful for building media gallery view
 */
export function extractMediaMessages(messages: Message[]): Message[] {
  return messages.filter(message => 
    message.type === 'image' || 
    message.type === 'video' ||
    message.type === 'sticker'
  );
}

/**
 * Groups media by date for gallery view
 */
export interface MediaDateGroup {
  date: Date;
  dateString: string;
  media: Message[];
}

export function groupMediaByDate(mediaMessages: Message[]): MediaDateGroup[] {
  const groups: MediaDateGroup[] = [];
  let currentGroup: MediaDateGroup | null = null;
  
  // Sort by timestamp descending (newest first) for gallery
  const sortedMedia = [...mediaMessages].sort((a, b) => 
    b.timestamp.getTime() - a.timestamp.getTime()
  );
  
  sortedMedia.forEach(message => {
    const messageDate = startOfDay(message.timestamp);
    
    if (!currentGroup || !isSameDay(currentGroup.date, messageDate)) {
      currentGroup = {
        date: messageDate,
        dateString: format(messageDate, 'MMMM d, yyyy'),
        media: [message]
      };
      groups.push(currentGroup);
    } else {
      currentGroup.media.push(message);
    }
  });
  
  return groups;
}

/**
 * Gets initials from a name for avatar display
 */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Generates a unique color for a participant based on their name
 * Ensures consistency - same name always gets same color
 */
export function getParticipantColor(name: string, colorPalette: string[]): string {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % colorPalette.length;
  return colorPalette[index];
}

