/**
 * ChatView Component
 * Main chat display area with messages timeline
 * Renders messages with proper grouping and date separators
 *
 * Performance optimized with virtual scrolling for large chats (50k+ messages)
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Chat, Message, TimelineGroup, MessageBubbleGroup } from '../types';
import { MessageBubble } from './MessageBubble';
import { MediaLinksDocsView } from './MediaLinksDocsView';
import {
  groupMessagesByDate,
  groupMessagesIntoBubbles,
  getInitials
} from '../utils/timelineBuilder';
import { ArrowLeft, Search, MoreVertical, ChevronDown, ChevronUp, Image } from 'lucide-react';

/**
 * Flattened item for virtual list - either a date separator or a message bubble group
 */
type VirtualItem =
  | { type: 'date'; dateString: string }
  | { type: 'bubbleGroup'; bubbleGroup: MessageBubbleGroup; isGroup: boolean };

interface ChatViewProps {
  chat: Chat;
  onBack?: () => void;
  onMediaClick?: (message: Message) => void;
  searchQuery?: string;
  darkMode?: boolean;
  onOpenSearch?: () => void;
  getMediaUrl?: (driveFileId: string, mimeType: string) => Promise<string>;
}

// Background style memoized to avoid recalculation
const useBackgroundStyle = (darkMode: boolean) => {
  return useMemo(() => ({
    backgroundImage: darkMode
      ? `url('/wa-bg-dark.png')`
      : `url('/wa-bg-light.png'), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cg fill='none' stroke='%2399a1a8' stroke-opacity='0.18' stroke-width='1'%3E%3Cpath d='M18 30c8-10 18-10 26 0'/%3E%3Cpath d='M62 26c6 0 10 4 10 10s-4 10-10 10-10-4-10-10 4-10 10-10z'/%3E%3Cpath d='M110 24l16 16-16 16-16-16z'/%3E%3Cpath d='M20 92c10-6 20-6 30 0'/%3E%3Cpath d='M72 92c10-6 20-6 30 0'/%3E%3Cpath d='M124 92c10-6 20-6 30 0'/%3E%3Cpath d='M30 130c8-8 16-8 24 0'/%3E%3Cpath d='M92 128c0-10 8-18 18-18s18 8 18 18-8 18-18 18-18-8-18-18z'/%3E%3Cpath d='M6 56h18M15 47v18'/%3E%3Cpath d='M140 52h18M149 43v18'/%3E%3Cpath d='M52 56l10 10M62 56L52 66'/%3E%3Cpath d='M100 60c4-4 10-4 14 0'/%3E%3C/g%3E%3C/svg%3E")`,
    backgroundSize: darkMode ? '420px' : '420px, 320px',
    backgroundPosition: 'top left',
    backgroundRepeat: 'repeat',
    backgroundColor: darkMode ? '#0b141a' : '#e5ddd5',
  }), [darkMode]);
};

/**
 * Flattens date groups into a single array for virtualization
 * Each item is either a date separator or a bubble group
 */
function flattenForVirtualization(dateGroups: TimelineGroup[], isGroup: boolean): VirtualItem[] {
  const items: VirtualItem[] = [];
  for (const dateGroup of dateGroups) {
    // Add date separator
    items.push({ type: 'date', dateString: dateGroup.dateString });
    // Add all bubble groups for this date
    const bubbleGroups = groupMessagesIntoBubbles(dateGroup.messages);
    for (const bubbleGroup of bubbleGroups) {
      items.push({ type: 'bubbleGroup', bubbleGroup, isGroup });
    }
  }
  return items;
}

/**
 * Estimates row height based on item type
 * Date separators are small, bubble groups vary based on message count and content
 */
function estimateRowHeight(item: VirtualItem): number {
  if (item.type === 'date') {
    return 40; // Date separator height
  }
  const msgs = item.bubbleGroup.messages;
  // Rough estimate: 60px base + 30px per message + extra for media
  let height = 60;
  for (const msg of msgs) {
    if (msg.type === 'image' || msg.type === 'video') {
      height += 250; // Media messages are taller
    } else if (msg.type === 'document' || msg.type === 'call') {
      height += 70;
    } else {
      // Text message: estimate based on content length
      const lines = Math.ceil((msg.content?.length || 0) / 40);
      height += 24 + Math.max(1, lines) * 20;
    }
  }
  return height;
}

export const ChatView: React.FC<ChatViewProps> = ({
  chat,
  onBack,
  onMediaClick,
  searchQuery = '',
  darkMode = false,
  onOpenSearch,
  getMediaUrl,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Search state
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [matchingMessageIds, setMatchingMessageIds] = useState<string[]>([]);

  // Sticky date state
  const [currentVisibleDate, setCurrentVisibleDate] = useState<string>('');
  const [showStickyDate, setShowStickyDate] = useState(false);

  // Menu state
  const [showMenu, setShowMenu] = useState(false);
  const [showMediaLinksDocsView, setShowMediaLinksDocsView] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Memoize background style
  const backgroundStyle = useBackgroundStyle(darkMode);

  // Memoize date groups to avoid recalculation on every render
  const dateGroups = useMemo(
    () => groupMessagesByDate(chat.messages),
    [chat.messages]
  );

  // Memoize flattened items for virtual list
  const virtualItems = useMemo(
    () => flattenForVirtualization(dateGroups, chat.isGroup),
    [dateGroups, chat.isGroup]
  );

  // Build message ID to virtual index mapping for search navigation
  const messageIdToIndex = useMemo(() => {
    const map = new Map<string, number>();
    virtualItems.forEach((item, index) => {
      if (item.type === 'bubbleGroup') {
        for (const msg of item.bubbleGroup.messages) {
          map.set(msg.id, index);
        }
      }
    });
    return map;
  }, [virtualItems]);

  // Virtualizer setup
  const virtualizer = useVirtualizer({
    count: virtualItems.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => estimateRowHeight(virtualItems[index]),
    overscan: 10, // Render 10 extra items above/below viewport
  });

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll to bottom on initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      virtualizer.scrollToIndex(virtualItems.length - 1, { align: 'end' });
    }, 100);
    return () => clearTimeout(timer);
  }, [chat.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build search index when query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setMatchingMessageIds([]);
      setCurrentMatchIndex(0);
      return;
    }

    const q = searchQuery.toLowerCase();
    const matches: string[] = [];

    for (const msg of chat.messages) {
      if (msg.content?.toLowerCase().includes(q) ||
          msg.sender?.toLowerCase().includes(q)) {
        matches.push(msg.id);
      }
    }

    setMatchingMessageIds(matches);
    setCurrentMatchIndex(0);

    // Jump to first match
    if (matches.length > 0) {
      const idx = messageIdToIndex.get(matches[0]);
      if (idx !== undefined) {
        setTimeout(() => virtualizer.scrollToIndex(idx, { align: 'center' }), 50);
      }
    }
  }, [searchQuery, chat.messages, messageIdToIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to next match
  const goToNextMatch = useCallback(() => {
    if (matchingMessageIds.length === 0) return;

    const nextIndex = (currentMatchIndex + 1) % matchingMessageIds.length;
    setCurrentMatchIndex(nextIndex);

    const idx = messageIdToIndex.get(matchingMessageIds[nextIndex]);
    if (idx !== undefined) {
      virtualizer.scrollToIndex(idx, { align: 'center' });
    }
  }, [currentMatchIndex, matchingMessageIds, messageIdToIndex, virtualizer]);

  // Navigate to previous match
  const goToPrevMatch = useCallback(() => {
    if (matchingMessageIds.length === 0) return;

    const prevIndex = currentMatchIndex === 0 ? matchingMessageIds.length - 1 : currentMatchIndex - 1;
    setCurrentMatchIndex(prevIndex);

    const idx = messageIdToIndex.get(matchingMessageIds[prevIndex]);
    if (idx !== undefined) {
      virtualizer.scrollToIndex(idx, { align: 'center' });
    }
  }, [currentMatchIndex, matchingMessageIds, messageIdToIndex, virtualizer]);

  // Sticky date: track which date is visible based on virtualizer range
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let hideTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      setShowStickyDate(true);

      // Find the first visible date separator from virtualized items
      const range = virtualizer.range;
      if (range) {
        for (let i = range.startIndex; i >= 0; i--) {
          const item = virtualItems[i];
          if (item.type === 'date') {
            setCurrentVisibleDate(item.dateString);
            break;
          }
        }
      }

      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => setShowStickyDate(false), 1000);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [virtualizer, virtualItems]);

  const totalMatches = matchingMessageIds.length;
  const hasMatches = totalMatches > 0;
  const currentMatchId = hasMatches ? matchingMessageIds[currentMatchIndex] : null;
  
  return (
    <div className="h-full flex flex-col bg-whatsapp-background dark:bg-whatsapp-background-dark relative">
      {/* Chat Header */}
      <div className="bg-whatsapp-header dark:bg-whatsapp-header-dark border-b border-whatsapp-border dark:border-whatsapp-border-dark px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark hover:text-whatsapp-text dark:hover:text-whatsapp-text-dark p-1"
            aria-label="Back to chat list"
          >
            <ArrowLeft size={28} />
          </button>
        )}
        
        <div className="flex-1 flex items-center gap-3 min-w-0">
          {/* Avatar */}
          <div 
            className="w-10 h-10 rounded-full bg-whatsapp-primary flex items-center justify-center text-white font-semibold flex-shrink-0"
            style={{ backgroundColor: chat.participants[0]?.color || '#00a884' }}
          >
            {getInitials(chat.name)}
          </div>
          
          {/* Chat name and info */}
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-whatsapp-text dark:text-whatsapp-text-dark truncate">
              {chat.name}
            </h2>
            <p className="text-xs text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">
              {chat.messages.length} messages
              {chat.isGroup && chat.participants.length > 0 && 
                ` • ${chat.participants.length} participants`
              }
            </p>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-4 text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">
          <button
            onClick={onOpenSearch}
            className="hover:text-whatsapp-text dark:hover:text-whatsapp-text-dark"
            aria-label="Search in chat"
            title="Search in chat"
          >
            <Search size={20} />
          </button>
          <div className="relative" ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="hover:text-whatsapp-text dark:hover:text-whatsapp-text-dark"
            >
              <MoreVertical size={20} />
            </button>
            
            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-whatsapp-panel-dark rounded-lg shadow-lg border border-whatsapp-border dark:border-whatsapp-border-dark py-1 min-w-[180px] z-50">
                <button
                  onClick={() => {
                    setShowMediaLinksDocsView(true);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-whatsapp-text dark:text-whatsapp-text-dark hover:bg-gray-100 dark:hover:bg-whatsapp-border-dark flex items-center gap-3"
                >
                  <Image size={16} />
                  Media, Links, and Docs
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Search Results Bar */}
      {searchQuery && (
        <div className="bg-whatsapp-header dark:bg-whatsapp-header-dark border-b border-whatsapp-border dark:border-whatsapp-border-dark px-4 py-2 flex items-center justify-between">
          <div className="text-sm text-whatsapp-text dark:text-whatsapp-text-dark">
            {hasMatches ? (
              <span>{currentMatchIndex + 1} of {totalMatches} matches</span>
            ) : (
              <span className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">No matches</span>
            )}
          </div>
          {hasMatches && (
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrevMatch}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-whatsapp-border-dark rounded"
                title="Previous match"
              >
                <ChevronUp size={18} />
              </button>
              <button
                onClick={goToNextMatch}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-whatsapp-border-dark rounded"
                title="Next match"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Sticky Date Pill */}
      {showStickyDate && currentVisibleDate && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="bg-white/95 dark:bg-whatsapp-panel-dark/95 shadow-lg px-4 py-2 rounded-lg">
            <span className="text-xs font-medium text-whatsapp-text dark:text-whatsapp-text-dark">
              {currentVisibleDate}
            </span>
          </div>
        </div>
      )}
      
      {/* Messages Area - Virtualized */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden wa-scrollbar relative"
        style={backgroundStyle}
      >
        {virtualItems.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">
              No messages in this chat
            </p>
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const item = virtualItems[virtualRow.index];

              if (item.type === 'date') {
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div
                      className="flex justify-center my-3"
                      data-date-separator={item.dateString}
                    >
                      <div className="bg-white dark:bg-whatsapp-panel-dark shadow-sm px-3 py-1.5 rounded-lg">
                        <span className="text-xs font-medium text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">
                          {item.dateString}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }

              // Bubble group
              const { bubbleGroup, isGroup: showSenderInGroup } = item;
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="space-y-0.5">
                    {bubbleGroup.messages.map((message, msgIdx) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        showSender={showSenderInGroup}
                        isFirstInGroup={msgIdx === 0}
                        isLastInGroup={msgIdx === bubbleGroup.messages.length - 1}
                        onMediaClick={onMediaClick}
                        isActiveMatch={currentMatchId === message.id}
                        getMediaUrl={getMediaUrl}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Media, Links, and Docs View */}
      {showMediaLinksDocsView && (
        <div className="absolute inset-0 z-50">
          <MediaLinksDocsView
            chatName={chat.name}
            messages={chat.messages}
            onBack={() => setShowMediaLinksDocsView(false)}
            onMediaClick={onMediaClick}
            getMediaUrl={getMediaUrl}
          />
        </div>
      )}
    </div>
  );
};
