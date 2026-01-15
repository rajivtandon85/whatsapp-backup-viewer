/**
 * UpdateNotification Component
 * Shows a banner when a new version of the app is available
 */

import React, { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';

export const UpdateNotification: React.FC = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Listen for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // A new service worker has taken control
        setShowUpdate(true);
      });

      // Check for waiting service worker on mount
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          setShowUpdate(true);
        }

        // Listen for new service worker installing
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker is installed and waiting
                setShowUpdate(true);
              }
            });
          }
        });
      });
    }
  }, []);

  const handleUpdate = async () => {
    setIsRefreshing(true);

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;

      // Tell the waiting service worker to skip waiting and activate
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }

    // Reload the page to get the new version
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
      <div className="bg-whatsapp-primary dark:bg-whatsapp-primary-dark text-white rounded-lg shadow-2xl px-4 py-3 flex items-center gap-3 max-w-md">
        <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        <div className="flex-1">
          <div className="font-semibold text-sm">Update Available</div>
          <div className="text-xs opacity-90">A new version is ready</div>
        </div>
        <button
          onClick={handleUpdate}
          disabled={isRefreshing}
          className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isRefreshing ? 'Updating...' : 'Refresh'}
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-white/10 rounded transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
