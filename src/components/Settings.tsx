/**
 * Settings Component
 * Shows app version, cache status, and provides cache management
 */

import React, { useState, useEffect } from 'react';
import { X, Trash2, Info, RefreshCw, Database } from 'lucide-react';
import { chatCache } from '../services/chatCache';
import { mediaCache } from '../services/mediaCache';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CacheStats {
  chats: {
    count: number;
    messages: number;
    size: string;
  };
  media: {
    count: number;
    size: string;
  };
  serviceWorker: {
    count: number;
    items: number;
  };
}

export const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const [appVersion, setAppVersion] = useState<string>('Loading...');
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    chats: { count: 0, messages: 0, size: '0 KB' },
    media: { count: 0, size: '0 KB' },
    serviceWorker: { count: 0, items: 0 },
  });
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadVersionInfo();
      loadCacheInfo();
    }
  }, [isOpen]);

  const loadVersionInfo = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration.active) {
          // Request version from service worker
          const messageChannel = new MessageChannel();
          messageChannel.port1.onmessage = (event) => {
            if (event.data && event.data.version) {
              const version = event.data.version;
              // If it's still the placeholder, show "Development"
              if (version === '__BUILD_VERSION__') {
                setAppVersion('Development');
              } else {
                // Format timestamp nicely
                const date = new Date(parseInt(version));
                if (!isNaN(date.getTime())) {
                  setAppVersion(date.toLocaleString());
                } else {
                  setAppVersion(version);
                }
              }
            }
          };
          registration.active.postMessage({ type: 'GET_VERSION' }, [messageChannel.port2]);
        } else {
          setAppVersion('No service worker');
        }
      } catch (err) {
        setAppVersion('Unknown');
      }
    } else {
      setAppVersion('Not supported');
    }
  };

  const loadCacheInfo = async () => {
    try {
      // Get chat cache stats
      const chatStats = await chatCache.getStats();

      // Get media cache stats
      const mediaStats = await mediaCache.getStats();

      // Get service worker cache stats
      let swCacheCount = 0;
      let swItemCount = 0;
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        swCacheCount = cacheNames.length;

        for (const cacheName of cacheNames) {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          swItemCount += keys.length;
        }
      }

      setCacheStats({
        chats: {
          count: chatStats.chatCount,
          messages: chatStats.messageCount,
          size: chatStats.estimatedSize,
        },
        media: {
          count: mediaStats.count,
          size: mediaStats.size,
        },
        serviceWorker: {
          count: swCacheCount,
          items: swItemCount,
        },
      });
    } catch (err) {
      console.error('Failed to load cache stats:', err);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Clear all cached data? This will reload the app.')) {
      return;
    }

    setIsClearing(true);

    try {
      // Clear IndexedDB caches
      await Promise.all([
        chatCache.clearAll(),
        mediaCache.clearAll(),
      ]);

      // Clear service worker caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Unregister service worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }

      // Clear local storage (optional - be careful with this)
      // localStorage.clear();

      // Reload the page to get fresh content
      window.location.reload();
    } catch (err) {
      console.error('Failed to clear cache:', err);
      alert('Failed to clear cache. Please try again.');
      setIsClearing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-whatsapp-panel-dark rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-whatsapp-primary dark:bg-whatsapp-primary-dark text-white px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* App Info */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-whatsapp-text dark:text-whatsapp-text-dark flex items-center gap-2">
              <Info className="w-4 h-4" />
              App Information
            </h3>
            <div className="bg-gray-100 dark:bg-whatsapp-background-dark rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">Name:</span>
                <span className="font-medium text-whatsapp-text dark:text-whatsapp-text-dark">WhatsApp Backup Viewer</span>
              </div>
              <div className="flex justify-between">
                <span className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">Version:</span>
                <span className="font-medium text-whatsapp-text dark:text-whatsapp-text-dark">{appVersion}</span>
              </div>
            </div>
          </div>

          {/* Cache Info */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-whatsapp-text dark:text-whatsapp-text-dark flex items-center gap-2">
              <Database className="w-4 h-4" />
              Cache Status
            </h3>

            {/* Chat Cache */}
            <div className="bg-gray-100 dark:bg-whatsapp-background-dark rounded-lg p-3 space-y-2 text-sm">
              <div className="font-medium text-whatsapp-text dark:text-whatsapp-text-dark mb-1">Chat Messages</div>
              <div className="flex justify-between">
                <span className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">Chats:</span>
                <span className="font-medium text-whatsapp-text dark:text-whatsapp-text-dark">{cacheStats.chats.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">Messages:</span>
                <span className="font-medium text-whatsapp-text dark:text-whatsapp-text-dark">{cacheStats.chats.messages.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">Size:</span>
                <span className="font-medium text-whatsapp-text dark:text-whatsapp-text-dark">{cacheStats.chats.size}</span>
              </div>
            </div>

            {/* Media Cache */}
            <div className="bg-gray-100 dark:bg-whatsapp-background-dark rounded-lg p-3 space-y-2 text-sm">
              <div className="font-medium text-whatsapp-text dark:text-whatsapp-text-dark mb-1">Media Files</div>
              <div className="flex justify-between">
                <span className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">Files:</span>
                <span className="font-medium text-whatsapp-text dark:text-whatsapp-text-dark">{cacheStats.media.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">Size:</span>
                <span className="font-medium text-whatsapp-text dark:text-whatsapp-text-dark">{cacheStats.media.size}</span>
              </div>
            </div>

            {/* Service Worker Cache */}
            <div className="bg-gray-100 dark:bg-whatsapp-background-dark rounded-lg p-3 space-y-2 text-sm">
              <div className="font-medium text-whatsapp-text dark:text-whatsapp-text-dark mb-1">App Cache</div>
              <div className="flex justify-between">
                <span className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">Caches:</span>
                <span className="font-medium text-whatsapp-text dark:text-whatsapp-text-dark">{cacheStats.serviceWorker.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">Items:</span>
                <span className="font-medium text-whatsapp-text dark:text-whatsapp-text-dark">{cacheStats.serviceWorker.items}</span>
              </div>
            </div>
          </div>

          {/* Cache Actions */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-whatsapp-text dark:text-whatsapp-text-dark flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Cache Management
            </h3>
            <div className="space-y-2">
              <button
                onClick={handleClearCache}
                disabled={isClearing}
                className="w-full bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Clear All Cache & Reload
                  </>
                )}
              </button>
              <p className="text-xs text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">
                Use this if you're experiencing issues or not seeing the latest updates. This will clear all cached data and reload the app.
              </p>
            </div>
          </div>

          {/* About */}
          <div className="border-t border-gray-200 dark:border-whatsapp-border-dark pt-4 text-xs text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">
            <p>WhatsApp Backup Viewer is a privacy-focused tool for viewing your WhatsApp backups. All data stays on your device.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
