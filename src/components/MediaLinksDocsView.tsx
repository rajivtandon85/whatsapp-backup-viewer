/**
 * MediaLinksDocsView Component
 * Shows media, links, and documents from a chat in a tabbed view
 */

import React, { useState, useMemo } from 'react';
import type { Message } from '../types';
import { ArrowLeft, Image, Link2, FileText, Play } from 'lucide-react';
import { format } from 'date-fns';

interface MediaLinksDocsViewProps {
  chatName: string;
  messages: Message[];
  onBack: () => void;
  onMediaClick?: (message: Message) => void;
  getMediaUrl?: (driveFileId: string, mimeType: string) => Promise<string>;
}

type TabType = 'media' | 'links' | 'docs';

// Extract URLs from text
function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;
  return text.match(urlRegex) || [];
}

export const MediaLinksDocsView: React.FC<MediaLinksDocsViewProps> = ({
  chatName,
  messages,
  onBack,
  onMediaClick,
  getMediaUrl,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('media');

  // Extract media, links, and docs from messages
  const { mediaItems, linkItems, docItems } = useMemo(() => {
    const media: Message[] = [];
    const links: { url: string; message: Message }[] = [];
    const docs: Message[] = [];

    for (const msg of messages) {
      // Media (images and videos)
      if (msg.type === 'image' || msg.type === 'video') {
        media.push(msg);
      }

      // Documents (excluding VCF which are shown inline)
      if (msg.type === 'document' && !msg.mediaFileName?.toLowerCase().endsWith('.vcf')) {
        docs.push(msg);
      }

      // Links from text content
      if (msg.content) {
        const urls = extractUrls(msg.content);
        for (const url of urls) {
          links.push({ url, message: msg });
        }
      }
    }

    return {
      mediaItems: media.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
      linkItems: links.sort((a, b) => b.message.timestamp.getTime() - a.message.timestamp.getTime()),
      docItems: docs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
    };
  }, [messages]);

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: 'media', label: 'Media', count: mediaItems.length },
    { id: 'links', label: 'Links', count: linkItems.length },
    { id: 'docs', label: 'Docs', count: docItems.length },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-[#111b21]">
      {/* Header */}
      <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-4 py-3 flex items-center gap-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onBack}
          className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark hover:text-whatsapp-text dark:hover:text-whatsapp-text-dark"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-whatsapp-text dark:text-whatsapp-text-dark">
            Media, Links, and Docs
          </h2>
          <p className="text-sm text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">
            {chatName}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-[#202c33]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-whatsapp-primary border-b-2 border-whatsapp-primary'
                : 'text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-100 dark:bg-[#111b21]">
        {/* Media Tab */}
        {activeTab === 'media' && (
          <div className="grid grid-cols-3 gap-1">
            {mediaItems.length === 0 ? (
              <div className="col-span-3 text-center py-8 text-whatsapp-text-secondary">
                No media found
              </div>
            ) : (
              mediaItems.map((msg) => (
                <MediaThumbnail
                  key={msg.id}
                  message={msg}
                  onClick={() => onMediaClick?.(msg)}
                  getMediaUrl={getMediaUrl}
                />
              ))
            )}
          </div>
        )}

        {/* Links Tab */}
        {activeTab === 'links' && (
          <div className="space-y-2">
            {linkItems.length === 0 ? (
              <div className="text-center py-8 text-whatsapp-text-secondary">
                No links found
              </div>
            ) : (
              linkItems.map((item, idx) => (
                <a
                  key={idx}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 bg-white dark:bg-whatsapp-panel-dark rounded-lg hover:bg-gray-50 dark:hover:bg-whatsapp-border-dark transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Link2 className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-blue-500 truncate">{item.url}</p>
                      <p className="text-xs text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark mt-1">
                        {format(item.message.timestamp, 'MMM d, yyyy')} · {item.message.sender}
                      </p>
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        )}

        {/* Docs Tab */}
        {activeTab === 'docs' && (
          <div className="space-y-2">
            {docItems.length === 0 ? (
              <div className="text-center py-8 text-whatsapp-text-secondary">
                No documents found
              </div>
            ) : (
              docItems.map((msg) => (
                <DocItem
                  key={msg.id}
                  message={msg}
                  getMediaUrl={getMediaUrl}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Media thumbnail component with proper lazy loading
// Only loads thumbnail when it comes into viewport (Intersection Observer)
const MediaThumbnail: React.FC<{
  message: Message;
  onClick: () => void;
  getMediaUrl?: (driveFileId: string, mimeType: string) => Promise<string>;
}> = ({ message, onClick }) => {
  const [isVisible, setIsVisible] = React.useState(false);
  const imgRef = React.useRef<HTMLDivElement>(null);

  // Intersection Observer - only load when visible
  React.useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            // Once visible, stop observing (we don't need to unload)
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px', // Start loading 100px before entering viewport
        threshold: 0.01,
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, []);

  const thumbnailUrl = message.thumbnailUrl;

  return (
    <div
      ref={imgRef}
      className="aspect-square bg-gray-200 dark:bg-gray-700 cursor-pointer overflow-hidden relative group"
      onClick={onClick}
    >
      {/* Only render image if visible */}
      {isVisible && thumbnailUrl && message.type === 'image' && (
        <>
          <img
            src={thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </>
      )}
      {isVisible && thumbnailUrl && message.type === 'video' && (
        <>
          <img
            src={thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <Play className="w-8 h-8 text-white" fill="white" />
          </div>
        </>
      )}
      {/* Show placeholder while not loaded */}
      {(!isVisible || !thumbnailUrl) && (
        <div className="absolute inset-0 flex items-center justify-center">
          {message.type === 'image' ? (
            <Image className="w-8 h-8 text-gray-400" />
          ) : (
            <Play className="w-8 h-8 text-gray-400" />
          )}
        </div>
      )}
    </div>
  );
};

// Document item component
const DocItem: React.FC<{
  message: Message;
  getMediaUrl?: (driveFileId: string, mimeType: string) => Promise<string>;
}> = ({ message, getMediaUrl }) => {
  const [loadedUrl, setLoadedUrl] = useState<string | undefined>(message.mediaUrl);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    let url = loadedUrl || message.mediaUrl;
    
    if (!url && message.driveFileId && getMediaUrl && message.mediaMimeType) {
      setIsLoading(true);
      try {
        url = await getMediaUrl(message.driveFileId, message.mediaMimeType);
        setLoadedUrl(url);
      } catch (err) {
        console.error('Failed to load document:', err);
        return;
      } finally {
        setIsLoading(false);
      }
    }
    
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div
      onClick={handleClick}
      className="p-3 bg-white dark:bg-whatsapp-panel-dark rounded-lg hover:bg-gray-50 dark:hover:bg-whatsapp-border-dark transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
          {isLoading ? (
            <div className="animate-spin w-5 h-5 border-2 border-whatsapp-primary border-t-transparent rounded-full" />
          ) : (
            <FileText className="w-5 h-5 text-gray-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-whatsapp-text dark:text-whatsapp-text-dark truncate">
            {message.mediaFileName || 'Document'}
          </p>
          <p className="text-xs text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark mt-0.5">
            {format(message.timestamp, 'MMM d, yyyy')} · {message.sender}
          </p>
        </div>
      </div>
    </div>
  );
};
