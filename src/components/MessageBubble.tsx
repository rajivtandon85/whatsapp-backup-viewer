/**
 * MessageBubble Component
 * Renders a single message bubble matching WhatsApp's exact styling
 * Handles different message types: text, image, video, audio, document
 */

import React, { useState, useEffect, useRef } from 'react';
import type { Message } from '../types';
import { formatMessageTime } from '../utils/timelineBuilder';
import { 
  FileText, 
  Download, 
  Image as ImageIcon,
  Film,
  Phone,
  Video,
  PhoneOff,
  Music,
  Play,
  User,
  Copy,
  Check
} from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  showSender?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  onMediaClick?: (message: Message) => void;
  isActiveMatch?: boolean;
  getMediaUrl?: (driveFileId: string, mimeType: string) => Promise<string>;
}

// Parse VCF content to extract contact info
interface VcfContact {
  name: string;
  phones: string[];
  emails: string[];
  org?: string;
}

function parseVcf(content: string): VcfContact | null {
  try {
    const lines = content.split(/\r?\n/);
    const contact: VcfContact = { name: '', phones: [], emails: [] };
    
    for (const line of lines) {
      if (line.startsWith('FN:')) {
        contact.name = line.substring(3).trim();
      } else if (line.startsWith('TEL') && line.includes(':')) {
        const phone = line.split(':').pop()?.trim();
        if (phone) contact.phones.push(phone);
      } else if (line.startsWith('EMAIL') && line.includes(':')) {
        const email = line.split(':').pop()?.trim();
        if (email) contact.emails.push(email);
      } else if (line.startsWith('ORG:')) {
        contact.org = line.substring(4).trim();
      }
    }
    
    return contact.name ? contact : null;
  } catch {
    return null;
  }
}

export const MessageBubble = React.memo(function MessageBubble({
  message,
  showSender = false,
  isFirstInGroup = false,
  isLastInGroup = false,
  onMediaClick,
  isActiveMatch = false,
  getMediaUrl,
}: MessageBubbleProps) {
  const [loadedMediaUrl, setLoadedMediaUrl] = useState<string | undefined>(message.mediaUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [vcfContact, setVcfContact] = useState<VcfContact | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  
  // Use thumbnail for quick preview, full URL once loaded
  const thumbnailUrl = message.thumbnailUrl;
  const mediaUrl = loadedMediaUrl || message.mediaUrl;
  // Show thumbnail immediately if available, otherwise show loaded/original URL
  const displayUrl = mediaUrl || thumbnailUrl;
  const isVcf = message.mediaFileName?.toLowerCase().endsWith('.vcf') || message.mediaMimeType === 'text/vcard';
  
  
  // Intersection Observer for lazy loading
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Stop observing once visible
        }
      },
      { rootMargin: '200px' } // Start loading 200px before visible
    );
    
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  
  // Auto-load images, videos, and VCF files from Drive when visible (lazy load)
  useEffect(() => {
    if (!isVisible) return;
    
    const shouldAutoLoad = (message.type === 'image' || message.type === 'video' || isVcf) && 
                           message.driveFileId && 
                           !message.mediaUrl && 
                           !loadedMediaUrl &&
                           getMediaUrl && 
                           message.mediaMimeType;
    
    if (shouldAutoLoad) {
      setIsLoading(true);
      getMediaUrl(message.driveFileId!, message.mediaMimeType!)
        .then(url => setLoadedMediaUrl(url))
        .catch(err => console.error('Failed to auto-load media:', err))
        .finally(() => setIsLoading(false));
    }
  }, [isVisible, message.driveFileId, message.mediaUrl, message.type, message.mediaMimeType, getMediaUrl, loadedMediaUrl, isVcf]);
  
  // Parse VCF content when URL is available
  useEffect(() => {
    if (isVcf && mediaUrl && !vcfContact) {
      fetch(mediaUrl)
        .then(res => res.text())
        .then(text => {
          const contact = parseVcf(text);
          if (contact) setVcfContact(contact);
        })
        .catch(err => console.error('Failed to parse VCF:', err));
    }
  }, [isVcf, mediaUrl, vcfContact]);
  
  // Load media URL on-demand (for documents, etc.)
  const loadMedia = async () => {
    if (loadedMediaUrl || isLoading || !message.driveFileId || !getMediaUrl || !message.mediaMimeType) {
      return loadedMediaUrl;
    }
    
    setIsLoading(true);
    try {
      const url = await getMediaUrl(message.driveFileId, message.mediaMimeType);
      setLoadedMediaUrl(url);
      return url;
    } catch (err) {
      console.error('Failed to load media:', err);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  };
  
  const isOutgoing = message.isOutgoing;
  const isSystem = message.type === 'system';
  const emojiOnly = isEmojiOnly(message);
  
  // System messages have special styling
  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-3 py-1.5 rounded-lg text-xs max-w-md text-center">
          {message.content}
        </div>
      </div>
    );
  }
  
  return (
    <div
      ref={elementRef}
      id={`msg-${message.id}`}
      data-msg-id={message.id}
      className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} px-2 md:px-4 ${isFirstInGroup ? 'mt-2' : 'mt-0.5'}`}
    >
      <div 
        className={`
          relative max-w-[85%] md:max-w-md min-w-[60px]
          ${isOutgoing 
            ? 'bg-whatsapp-outgoing dark:bg-whatsapp-outgoing-dark text-white' 
            : 'bg-whatsapp-incoming dark:bg-whatsapp-incoming-dark text-white'
          }
          ${emojiOnly ? 'bg-transparent shadow-none' : ''}
          ${isFirstInGroup && !isOutgoing ? 'rounded-tl-none' : ''}
          ${isFirstInGroup && isOutgoing ? 'rounded-tr-none' : ''}
          ${isLastInGroup ? 'rounded-b-lg' : 'rounded-lg'}
          ${!isFirstInGroup && !isLastInGroup ? 'rounded-lg' : ''}
          ${emojiOnly ? '' : 'shadow-sm'}
          ${isActiveMatch ? 'ring-2 ring-yellow-300/80 ring-offset-2 ring-offset-transparent' : ''}
        `}
      >
        {/* Sender name (for group chats, only on incoming messages) */}
        {showSender && !isOutgoing && isFirstInGroup && (
          <div className="text-xs font-semibold text-cyan-400 pt-1.5 px-2">
            {message.sender}
          </div>
        )}

        {/* Quoted / reply preview */}
        {message.quotedMessage && (
          <div className="mx-2 mt-1.5 mb-1 rounded-md overflow-hidden bg-black/15">
            <div className="px-2 py-1 border-l-4 border-emerald-300">
              <div className="text-[11px] font-semibold opacity-90">
                {message.quotedMessage.sender}
              </div>
              <div className="text-[11px] opacity-90 line-clamp-2">
                {message.quotedMessage.content}
              </div>
            </div>
          </div>
        )}
        
        {/* Media content */}
        {message.type === 'image' && !displayUrl && (
          <div 
            className="p-3 flex items-center gap-3 cursor-pointer hover:bg-black/10"
            onClick={() => loadMedia()}
          >
            <div className="w-10 h-10 rounded-full bg-black/15 flex items-center justify-center">
              {isLoading ? (
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <ImageIcon className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="text-sm font-semibold opacity-95">
              {isLoading ? 'Loading photo...' : 'Photo'}
            </div>
          </div>
        )}

        {message.type === 'image' && displayUrl && (
          <div 
            className="cursor-pointer overflow-hidden rounded-t-lg relative"
            onClick={() => {
              // Use loaded full image URL, fallback to display URL
              const urlToUse = loadedMediaUrl || mediaUrl || displayUrl;
              onMediaClick?.({ ...message, mediaUrl: urlToUse });
            }}
          >
            <img 
              src={displayUrl} 
              alt={message.mediaFileName || 'Image'}
              className="max-w-full h-auto max-h-96 object-contain hover:opacity-90 transition-opacity"
              loading="lazy"
            />
            {/* Show loading indicator while loading */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <div className="animate-spin w-8 h-8 border-3 border-white border-t-transparent rounded-full" />
              </div>
            )}
          </div>
        )}
        
        {message.type === 'video' && mediaUrl && (
          <div 
            className="relative cursor-pointer overflow-hidden rounded-t-lg bg-black"
            onClick={() => onMediaClick?.({ ...message, mediaUrl })}
          >
            <video 
              src={mediaUrl}
              className="max-w-full h-auto max-h-96 object-contain"
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-40 transition-opacity">
              <Play className="w-16 h-16 text-white" fill="white" />
            </div>
          </div>
        )}

        {message.type === 'video' && !mediaUrl && (
          <div className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-black/15 flex items-center justify-center">
              {isLoading ? (
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <Film className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="text-sm font-semibold opacity-95">
              {isLoading ? 'Loading video...' : 'Video'}
            </div>
          </div>
        )}
        
        {message.type === 'audio' && mediaUrl && (
          <div className="p-2 flex items-center gap-2">
            <Music className="w-6 h-6 text-whatsapp-primary" />
            <audio 
              controls 
              src={mediaUrl}
              className="flex-1 max-w-xs"
              preload="metadata"
            >
              Your browser does not support audio playback.
            </audio>
          </div>
        )}
        
        {/* VCF Contact Card - Inline Display */}
        {message.type === 'document' && isVcf && (
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            {isLoading && (
              <div className="flex items-center gap-2">
                <div className="animate-spin w-5 h-5 border-2 border-whatsapp-primary border-t-transparent rounded-full" />
                <span className="text-sm opacity-70">Loading contact...</span>
              </div>
            )}
            {vcfContact && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{vcfContact.name}</div>
                    {vcfContact.org && (
                      <div className="text-xs opacity-70">{vcfContact.org}</div>
                    )}
                  </div>
                </div>
                {vcfContact.phones.map((phone, i) => (
                  <div 
                    key={i} 
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 p-1 rounded"
                    onClick={() => {
                      navigator.clipboard.writeText(phone);
                      setCopiedPhone(phone);
                      setTimeout(() => setCopiedPhone(null), 2000);
                    }}
                  >
                    <Phone className="w-4 h-4 text-whatsapp-primary" />
                    <span>{phone}</span>
                    {copiedPhone === phone ? (
                      <Check className="w-4 h-4 text-green-500 ml-auto" />
                    ) : (
                      <Copy className="w-4 h-4 opacity-50 ml-auto" />
                    )}
                  </div>
                ))}
                {vcfContact.emails.map((email, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-whatsapp-primary">@</span>
                    <span>{email}</span>
                  </div>
                ))}
              </div>
            )}
            {!isLoading && !vcfContact && (
              <div className="flex items-center gap-3">
                <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded">
                  <User className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                </div>
                <div className="text-sm">{message.mediaFileName || 'Contact'}</div>
              </div>
            )}
          </div>
        )}

        {/* Other Documents */}
        {message.type === 'document' && !isVcf && (
          <div 
            className="p-2 flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            onClick={async () => {
              if (mediaUrl) {
                window.open(mediaUrl, '_blank');
              } else {
                const url = await loadMedia();
                if (url) window.open(url, '_blank');
              }
            }}
          >
            <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded">
              <FileText className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {message.mediaFileName || 'Document'}
              </div>
              {message.mediaMimeType === 'application/pdf' && (
                <div className="text-xs text-whatsapp-primary">PDF Document</div>
              )}
              {message.mediaSize && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFileSize(message.mediaSize)}
                </div>
              )}
            </div>
            {isLoading && (
              <div className="animate-spin w-5 h-5 border-2 border-whatsapp-primary border-t-transparent rounded-full" />
            )}
            {mediaUrl && !isLoading && (
              <a
                href={mediaUrl}
                download={message.mediaFileName}
                onClick={(e) => e.stopPropagation()}
                className="text-whatsapp-primary hover:text-whatsapp-primary-dark"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </a>
            )}
          </div>
        )}

        {/* Call log */}
        {message.type === 'call' && (
          <div className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-black/15 flex items-center justify-center">
              {message.callMissed ? (
                <PhoneOff className="w-5 h-5 text-red-300" />
              ) : message.callKind === 'video' ? (
                <Video className="w-5 h-5 text-white" />
              ) : (
                <Phone className="w-5 h-5 text-white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-semibold ${message.callMissed ? 'text-red-200' : ''}`}>
                {message.callMissed
                  ? `Missed ${message.callKind === 'video' ? 'video' : 'voice'} call`
                  : `${message.callKind === 'video' ? 'Video' : 'Voice'} call`}
              </div>
              {!message.callMissed && message.callDuration && (
                <div className="text-xs opacity-80">{message.callDuration}</div>
              )}
            </div>
          </div>
        )}
        
        {/* Text content */}
        {message.content && message.type !== 'call' && (
          <div className={`px-2 ${message.type !== 'text' ? 'pt-1' : 'pt-1.5'} pb-1.5 ${message.isEdited ? 'pr-24' : 'pr-16'}`}>
            <div className={`${emojiOnly ? 'text-5xl leading-none' : 'text-sm'} whitespace-pre-wrap break-words text-white`}>
              {message.content}
            </div>
          </div>
        )}
        
        {/* If media without caption */}
        {!message.content && message.type !== 'text' && message.type !== 'audio' && (
          <div className="h-1"></div>
        )}
        
        {/* Timestamp */}
        <div className="absolute bottom-1 right-2 text-[10px] text-gray-300 opacity-80">
          {message.isEdited ? `Edited · ${formatMessageTime(message.timestamp)}` : formatMessageTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
});

function isEmojiOnly(message: Message): boolean {
  if (message.type !== 'text') return false;
  const t = (message.content || '').trim();
  if (!t) return false;
  // If it's long, it's not an emoji-only bubble.
  if (t.length > 12) return false;

  // Remove variation selectors and whitespace for matching.
  const normalized = t.replace(/[\uFE0F\u200D\s]/g, '');
  try {
    // Extended pictographic covers most emoji.
    // Allow 1-3 emoji.
    const re = /^(\p{Extended_Pictographic}){1,3}$/u;
    return re.test(normalized);
  } catch {
    return false;
  }
}

/**
 * Formats file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}


