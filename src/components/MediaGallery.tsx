/**
 * MediaGallery Component
 * Full-screen media viewer with navigation
 * Shows images/videos in a lightbox-style modal
 */

import React, { useEffect, useCallback, useState } from 'react';
import type { Message } from '../types';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { formatMessageTimestamp } from '../utils/timelineBuilder';

interface MediaGalleryProps {
  media: Message[];
  initialIndex: number;
  onClose: () => void;
  getMediaUrl?: (driveFileId: string, mimeType: string) => Promise<string>;
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({
  media,
  initialIndex,
  onClose,
  getMediaUrl,
}) => {
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [loadedUrls, setLoadedUrls] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  
  const currentMedia = media[currentIndex];
  
  // Load media URL for current index
  useEffect(() => {
    const loadCurrentMedia = async () => {
      if (!currentMedia) return;
      
      // Already have URL (from message or already loaded)
      if (currentMedia.mediaUrl || loadedUrls[currentIndex]) return;
      
      // Need to load from Drive
      if (currentMedia.driveFileId && currentMedia.mediaMimeType && getMediaUrl) {
        setIsLoading(true);
        try {
          const url = await getMediaUrl(currentMedia.driveFileId, currentMedia.mediaMimeType);
          setLoadedUrls(prev => ({ ...prev, [currentIndex]: url }));
        } catch (err) {
          console.error('Failed to load media in gallery:', err);
        } finally {
          setIsLoading(false);
        }
      }
    };
    
    loadCurrentMedia();
  }, [currentIndex, currentMedia, getMediaUrl, loadedUrls]);
  
  // Get the URL to display (loaded or from message)
  const displayUrl = loadedUrls[currentIndex] || currentMedia?.mediaUrl;
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < media.length - 1;
  
  const handlePrev = useCallback(() => {
    if (canGoPrev) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [canGoPrev]);
  
  const handleNext = useCallback(() => {
    if (canGoNext) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [canGoNext]);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext, onClose]);
  
  if (!currentMedia) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex flex-col overflow-hidden safe-bottom">
      {/* Header */}
      <div className="flex-shrink-0 bg-black bg-opacity-80 px-4 pb-4 flex items-center justify-between safe-top">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold truncate">
            {currentMedia.sender}
          </h3>
          <p className="text-gray-300 text-sm">
            {formatMessageTimestamp(currentMedia.timestamp)}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {displayUrl && (
            <a
              href={displayUrl}
              download={currentMedia.mediaFileName}
              className="text-white hover:text-gray-300 transition-colors"
            >
              <Download size={24} />
            </a>
          )}
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <X size={28} />
          </button>
        </div>
      </div>
      
      {/* Media Display */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center p-4 overflow-auto">
        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full" />
          </div>
        )}
        
        {currentMedia.type === 'image' && displayUrl && (
          <img
            src={displayUrl}
            alt={currentMedia.content || 'Image'}
            className="max-w-full max-h-full object-contain"
          />
        )}
        
        {currentMedia.type === 'video' && displayUrl && (
          <video
            src={displayUrl}
            controls
            autoPlay
            className="max-w-full max-h-full"
          >
            Your browser does not support video playback.
          </video>
        )}
        
        {/* No URL available */}
        {!isLoading && !displayUrl && (
          <div className="text-white text-center">
            <p>Unable to load media</p>
          </div>
        )}
        
        {/* Navigation Buttons */}
        {canGoPrev && (
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition-all"
          >
            <ChevronLeft size={32} />
          </button>
        )}
        
        {canGoNext && (
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition-all"
          >
            <ChevronRight size={32} />
          </button>
        )}
      </div>
      
      {/* Caption */}
      {currentMedia.content && (
        <div className="bg-black bg-opacity-80 p-4">
          <p className="text-white text-center max-w-2xl mx-auto">
            {currentMedia.content}
          </p>
        </div>
      )}
      
      {/* Counter */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-70 px-3 py-1.5 rounded-full">
        <span className="text-white text-sm font-medium">
          {currentIndex + 1} / {media.length}
        </span>
      </div>
    </div>
  );
};

