/**
 * ChatView Component
 * Main chat display area with messages timeline
 * Renders messages with proper grouping and date separators
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Chat, Message } from '../types';
import { MessageBubble } from './MessageBubble';
import { MediaLinksDocsView } from './MediaLinksDocsView';
import { 
  groupMessagesByDate, 
  groupMessagesIntoBubbles,
  getInitials
} from '../utils/timelineBuilder';
import { ArrowLeft, Search, MoreVertical, ChevronDown, ChevronUp, Image } from 'lucide-react';

interface ChatViewProps {
  chat: Chat;
  onBack?: () => void;
  onMediaClick?: (message: Message) => void;
  searchQuery?: string;
  darkMode?: boolean;
  onOpenSearch?: () => void;
  getMediaUrl?: (driveFileId: string, mimeType: string) => Promise<string>;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Search state
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const matchingMessageIdsRef = useRef<string[]>([]);
  
  // Sticky date state
  const [currentVisibleDate, setCurrentVisibleDate] = useState<string>('');
  const [showStickyDate, setShowStickyDate] = useState(false);
  
  // Menu state
  const [showMenu, setShowMenu] = useState(false);
  const [showMediaLinksDocsView, setShowMediaLinksDocsView] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [chat.id]);
  
  // Group messages by date
  const dateGroups = groupMessagesByDate(chat.messages);
  
  // Build search index when query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      matchingMessageIdsRef.current = [];
      setCurrentMatchIndex(0);
      return;
    }
    
    const q = searchQuery.toLowerCase();
    const matches: string[] = [];
    
    // Simple linear search through all messages
    for (const msg of chat.messages) {
      if (msg.content?.toLowerCase().includes(q) || 
          msg.sender?.toLowerCase().includes(q)) {
        matches.push(msg.id);
      }
    }
    
    matchingMessageIdsRef.current = matches;
    setCurrentMatchIndex(0);
    
    // Jump to first match immediately
    if (matches.length > 0) {
      setTimeout(() => {
        const msgId = `msg-${matches[0]}`;
        const el = document.getElementById(msgId);
        const container = scrollContainerRef.current;
        
        if (el && container) {
          const containerRect = container.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const scrollTop = container.scrollTop;
          const offset = elRect.top - containerRect.top + scrollTop - (containerRect.height / 2) + (elRect.height / 2);
          
          container.scrollTo({
            top: offset,
            behavior: 'smooth'
          });
        }
      }, 50);
    }
  }, [searchQuery, chat.messages]);
  
  // Navigate to next match
  const goToNextMatch = useCallback(() => {
    const matches = matchingMessageIdsRef.current;
    if (matches.length === 0) return;
    
    const nextIndex = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIndex);
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      const msgId = `msg-${matches[nextIndex]}`;
      const el = document.getElementById(msgId);
      const container = scrollContainerRef.current;
      
      if (el && container) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const scrollTop = container.scrollTop;
        const offset = elRect.top - containerRect.top + scrollTop - (containerRect.height / 2) + (elRect.height / 2);
        
        container.scrollTo({
          top: offset,
          behavior: 'smooth'
        });
      } else {
        console.warn('Element or container not found:', msgId);
      }
    });
  }, [currentMatchIndex]);
  
  // Navigate to previous match
  const goToPrevMatch = useCallback(() => {
    const matches = matchingMessageIdsRef.current;
    if (matches.length === 0) return;
    
    const prevIndex = currentMatchIndex === 0 ? matches.length - 1 : currentMatchIndex - 1;
    setCurrentMatchIndex(prevIndex);
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      const msgId = `msg-${matches[prevIndex]}`;
      const el = document.getElementById(msgId);
      const container = scrollContainerRef.current;
      
      if (el && container) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const scrollTop = container.scrollTop;
        const offset = elRect.top - containerRect.top + scrollTop - (containerRect.height / 2) + (elRect.height / 2);
        
        container.scrollTo({
          top: offset,
          behavior: 'smooth'
        });
      } else {
        console.warn('Element or container not found:', msgId);
      }
    });
  }, [currentMatchIndex]);
  
  // Sticky date on scroll
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    let hideTimeout: number | null = null;
    
    const handleScroll = () => {
      // Show sticky date while scrolling
      setShowStickyDate(true);
      
      // Find which date separator is currently at the top
      const separators = container.querySelectorAll('[data-date-separator]');
      const containerTop = container.getBoundingClientRect().top;
      
      let currentDate = '';
      separators.forEach((sep) => {
        const rect = sep.getBoundingClientRect();
        if (rect.top <= containerTop + 100) { // 100px threshold
          currentDate = sep.getAttribute('data-date-separator') || '';
        }
      });
      
      if (currentDate) {
        setCurrentVisibleDate(currentDate);
      }
      
      // Hide after 1 second of no scrolling
      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = window.setTimeout(() => {
        setShowStickyDate(false);
      }, 1000);
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, []);
  
  const matchingIds = matchingMessageIdsRef.current;
  const totalMatches = matchingIds.length;
  const hasMatches = totalMatches > 0;
  
  return (
    <div className="h-full flex flex-col bg-whatsapp-background dark:bg-whatsapp-background-dark relative">
      {/* Chat Header */}
      <div className="bg-whatsapp-header dark:bg-whatsapp-header-dark border-b border-whatsapp-border dark:border-whatsapp-border-dark px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="lg:hidden text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark hover:text-whatsapp-text dark:hover:text-whatsapp-text-dark"
          >
            <ArrowLeft size={24} />
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
      
      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto wa-scrollbar px-2 md:px-4 py-4 relative"
        style={{
          backgroundImage: darkMode
            ? `url('/wa-bg-dark.png')`
            : `url('/wa-bg-light.png'), url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cg fill='none' stroke='%2399a1a8' stroke-opacity='0.18' stroke-width='1'%3E%3Cpath d='M18 30c8-10 18-10 26 0'/%3E%3Cpath d='M62 26c6 0 10 4 10 10s-4 10-10 10-10-4-10-10 4-10 10-10z'/%3E%3Cpath d='M110 24l16 16-16 16-16-16z'/%3E%3Cpath d='M20 92c10-6 20-6 30 0'/%3E%3Cpath d='M72 92c10-6 20-6 30 0'/%3E%3Cpath d='M124 92c10-6 20-6 30 0'/%3E%3Cpath d='M30 130c8-8 16-8 24 0'/%3E%3Cpath d='M92 128c0-10 8-18 18-18s18 8 18 18-8 18-18 18-18-8-18-18z'/%3E%3Cpath d='M6 56h18M15 47v18'/%3E%3Cpath d='M140 52h18M149 43v18'/%3E%3Cpath d='M52 56l10 10M62 56L52 66'/%3E%3Cpath d='M100 60c4-4 10-4 14 0'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: darkMode ? '420px' : '420px, 320px',
          backgroundPosition: 'top left',
          backgroundRepeat: 'repeat',
          backgroundColor: darkMode ? '#0b141a' : '#e5ddd5',
        }}
      >
        {dateGroups.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">
              No messages in this chat
            </p>
          </div>
        ) : (
          <>
            {dateGroups.map((dateGroup, idx) => (
              <div key={idx} className="mb-4">
                {/* Date Separator */}
                <div 
                  className="flex justify-center my-3"
                  data-date-separator={dateGroup.dateString}
                >
                  <div className="bg-white dark:bg-whatsapp-panel-dark shadow-sm px-3 py-1.5 rounded-lg">
                    <span className="text-xs font-medium text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">
                      {dateGroup.dateString}
                    </span>
                  </div>
                </div>
                
                {/* Messages grouped by sender */}
                {groupMessagesIntoBubbles(dateGroup.messages).map((bubbleGroup, bubbleIdx) => (
                  <div key={bubbleIdx} className="space-y-0.5">
                    {bubbleGroup.messages.map((message, msgIdx) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        showSender={chat.isGroup}
                        isFirstInGroup={msgIdx === 0}
                        isLastInGroup={msgIdx === bubbleGroup.messages.length - 1}
                        onMediaClick={onMediaClick}
                        isActiveMatch={!!(searchQuery && matchingMessageIdsRef.current[currentMatchIndex] === message.id)}
                        getMediaUrl={getMediaUrl}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
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
