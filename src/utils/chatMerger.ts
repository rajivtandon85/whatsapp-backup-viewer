/**
 * Chat Merger Utility
 * Merges multiple chat backups into a single deduplicated timeline
 */

import type { Message, Participant } from '../types';

/**
 * Create a unique key for a message for deduplication
 * Uses timestamp (rounded to second) + sender + FULL content
 * For media messages, uses mediaFileName for deduplication
 */
function getMessageKey(msg: Message): string {
  // Round to nearest second (remove milliseconds) for consistent matching
  const timestamp = Math.floor(msg.timestamp.getTime() / 1000) * 1000;
  const sender = (msg.sender || '').toLowerCase().trim();
  
  // For media messages, use timestamp + sender + filename
  if (msg.mediaFileName) {
    return `${timestamp}|${sender}|media:${msg.mediaFileName.toLowerCase()}`;
  }
  
  // For text messages, use timestamp + sender + full content
  const content = (msg.content || '').toLowerCase().trim();
  return `${timestamp}|${sender}|${content}`;
}

/**
 * Merge multiple chat text contents into deduplicated messages
 * Only deduplicates when there are multiple backup folders (multiple _chat.txt files)
 */
export function mergeMessages(allMessages: Message[][]): Message[] {
  // If only one backup (one _chat.txt), no need to dedupe - just sort and return
  if (allMessages.length === 1) {
    const messages = allMessages[0].sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );
    return messages;
  }
  
  // Multiple backups - need to dedupe
  const seenKeys = new Set<string>();
  const merged: Message[] = [];

  // Sort all message arrays by timestamp to process in order
  const flatMessages = allMessages.flat().sort((a, b) => 
    a.timestamp.getTime() - b.timestamp.getTime()
  );

  for (const msg of flatMessages) {
    const key = getMessageKey(msg);
    
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      merged.push(msg);
    }
  }
  
  return merged;
}

/**
 * Merge participants from multiple backups
 */
export function mergeParticipants(allParticipants: Participant[][]): Participant[] {
  const seen = new Map<string, Participant>();

  for (const participants of allParticipants) {
    for (const p of participants) {
      const key = p.name.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.set(key, p);
      }
    }
  }

  return Array.from(seen.values());
}

/**
 * Get statistics about the merge
 */
export function getMergeStats(
  originalCounts: number[],
  mergedCount: number
): {
  totalOriginal: number;
  duplicatesRemoved: number;
  mergedCount: number;
  backupCounts: number[];
} {
  const totalOriginal = originalCounts.reduce((a, b) => a + b, 0);
  return {
    totalOriginal,
    duplicatesRemoved: totalOriginal - mergedCount,
    mergedCount,
    backupCounts: originalCounts,
  };
}
