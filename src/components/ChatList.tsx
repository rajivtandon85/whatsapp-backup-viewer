/**
 * ChatList Component
 * Sidebar showing all available chats
 * Matches WhatsApp Web's chat list design
 */

import React, { useMemo } from 'react';
import type { Chat } from '../types';
import { getInitials } from '../utils/timelineBuilder';
import { Search, Users } from 'lucide-react';

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
}

export const ChatList: React.FC<ChatListProps> = ({
  chats,
  selectedChatId,
  onSelectChat,
  searchQuery,
  onSearchQueryChange,
}) => {
  const filteredChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return chats;

    return chats.filter((chat) => {
      if (chat.name.toLowerCase().includes(q)) return true;
      const last = chat.messages[chat.messages.length - 1];
      if (last?.content?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [chats, searchQuery]);

  return (
    <div className="h-full flex flex-col bg-whatsapp-panel dark:bg-whatsapp-panel-dark border-r border-whatsapp-border dark:border-whatsapp-border-dark">
      {/* Header */}
      <div className="bg-whatsapp-header dark:bg-whatsapp-header-dark p-4 border-b border-whatsapp-border dark:border-whatsapp-border-dark">
        <h1 className="text-xl font-semibold text-whatsapp-text dark:text-whatsapp-text-dark">
          Chats
        </h1>
        <p className="text-xs text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark mt-0.5">
          {filteredChats.length} conversation{filteredChats.length !== 1 ? 's' : ''}
        </p>

        {/* Search (WhatsApp-style) */}
        <div className="mt-3">
          <div className="flex items-center gap-2 bg-white dark:bg-whatsapp-panel-dark border border-whatsapp-border dark:border-whatsapp-border-dark rounded-lg px-3 py-2">
            <Search size={16} className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark" />
            <input
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder="Search chats"
              className="w-full bg-transparent outline-none text-sm text-whatsapp-text dark:text-whatsapp-text-dark placeholder:text-whatsapp-text-secondary dark:placeholder:text-whatsapp-text-secondary-dark"
            />
          </div>
        </div>
      </div>
      
      {/* Chat list */}
      <div className="flex-1 overflow-y-auto wa-scrollbar">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="text-gray-400 dark:text-gray-600 mb-2">
              <Users size={48} />
            </div>
            <p className="text-sm text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">
              {searchQuery.trim() ? 'No matching chats' : 'No chats found in backup'}
            </p>
          </div>
        ) : (
          <div>
            {filteredChats.map(chat => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isSelected={chat.id === selectedChatId}
                onClick={() => onSelectChat(chat.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface ChatListItemProps {
  chat: Chat;
  isSelected: boolean;
  onClick: () => void;
}

const ChatListItem: React.FC<ChatListItemProps> = ({ chat, isSelected, onClick }) => {
  const lastMessage = chat.messages[chat.messages.length - 1];
  const initials = getInitials(chat.name);
  
  // Get preview text from last message
  const getPreviewText = () => {
    if (!lastMessage) return 'No messages';
    
    if (lastMessage.type === 'text') {
      return lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : '');
    }
    
    const typeLabels: Record<string, string> = {
      image: '📷 Photo',
      video: '🎥 Video',
      audio: '🎵 Audio',
      document: '📄 Document',
      sticker: 'Sticker',
      system: lastMessage.content
    };
    
    return typeLabels[lastMessage.type] || 'Message';
  };
  
  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-3 p-3 cursor-pointer
        border-b border-whatsapp-border dark:border-whatsapp-border-dark
        hover:bg-gray-50 dark:hover:bg-whatsapp-header-dark
        transition-colors
        ${isSelected ? 'bg-gray-100 dark:bg-whatsapp-header-dark' : ''}
      `}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {chat.isGroup ? (
          <div className="w-12 h-12 rounded-full bg-whatsapp-primary flex items-center justify-center text-white font-semibold">
            <Users size={24} />
          </div>
        ) : (
          <div 
            className="w-12 h-12 rounded-full bg-whatsapp-primary flex items-center justify-center text-white font-semibold"
            style={{ backgroundColor: chat.participants[0]?.color || '#00a884' }}
          >
            {initials}
          </div>
        )}
      </div>
      
      {/* Chat info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <h3 className="font-semibold text-sm text-whatsapp-text dark:text-whatsapp-text-dark truncate">
            {chat.name}
          </h3>
          {lastMessage && (
            <span className="text-[11px] text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark ml-2 flex-shrink-0">
              {formatRelativeTime(lastMessage.timestamp)}
            </span>
          )}
        </div>
        <p className="text-xs text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark truncate">
          {getPreviewText()}
        </p>
      </div>
    </div>
  );
};

/**
 * Formats relative time for chat list (e.g., "5m", "2h", "Yesterday")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMins < 60) {
    return diffMins <= 1 ? 'now' : `${diffMins}m`;
  }
  
  if (diffHours < 24) {
    return `${diffHours}h`;
  }
  
  if (diffDays === 1) {
    return 'Yesterday';
  }
  
  if (diffDays < 7) {
    return `${diffDays}d`;
  }
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

