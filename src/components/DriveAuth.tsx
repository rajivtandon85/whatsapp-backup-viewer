/**
 * DriveAuth Component
 * Handles Google Drive authentication UI
 */

import React from 'react';
import { Cloud, LogIn, LogOut, RefreshCw, AlertCircle } from 'lucide-react';

interface DriveAuthProps {
  isInitialized: boolean;
  isSignedIn: boolean;
  isLoading: boolean;
  error: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onRefresh: () => void;
}

export const DriveAuth: React.FC<DriveAuthProps> = ({
  isInitialized,
  isSignedIn,
  isLoading,
  error,
  onSignIn,
  onSignOut,
  onRefresh,
}) => {
  if (!isInitialized) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="animate-spin mb-4">
          <RefreshCw size={32} className="text-whatsapp-primary" />
        </div>
        <p className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">
          Initializing Google Drive...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-whatsapp-text dark:text-whatsapp-text-dark mb-2">
          Connection Error
        </h3>
        <p className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark mb-4 max-w-md">
          {error}
        </p>
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-whatsapp-primary hover:bg-whatsapp-primary-dark text-white rounded-lg transition-colors"
        >
          <RefreshCw size={18} />
          Try Again
        </button>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Cloud size={64} className="text-whatsapp-primary mb-4" />
        <h2 className="text-2xl font-semibold text-whatsapp-text dark:text-whatsapp-text-dark mb-2">
          WhatsApp Backup Viewer
        </h2>
        <p className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark mb-6 max-w-md">
          Connect to your Google Drive to view your WhatsApp chat backups.
          Your data stays private and is never uploaded to any server.
        </p>
        <button
          onClick={onSignIn}
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-3 bg-whatsapp-primary hover:bg-whatsapp-primary-dark text-white rounded-lg transition-colors font-medium disabled:opacity-50"
        >
          <LogIn size={20} />
          {isLoading ? 'Connecting...' : 'Connect Google Drive'}
        </button>
        <p className="text-xs text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark mt-4 max-w-sm">
          We only request read access to your Drive. Your backups must be in a folder named "wa_bckp".
        </p>
      </div>
    );
  }

  // Signed in - show refresh and sign out options
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-whatsapp-border dark:border-whatsapp-border-dark">
      <Cloud size={18} className="text-whatsapp-primary" />
      <span className="text-sm text-whatsapp-text dark:text-whatsapp-text-dark flex-1">
        Connected to Google Drive
      </span>
      <button
        onClick={onRefresh}
        disabled={isLoading}
        className="p-1.5 hover:bg-gray-200 dark:hover:bg-whatsapp-border-dark rounded transition-colors"
        title="Refresh from Drive"
      >
        <RefreshCw size={16} className={`text-whatsapp-text-secondary ${isLoading ? 'animate-spin' : ''}`} />
      </button>
      <button
        onClick={onSignOut}
        className="p-1.5 hover:bg-gray-200 dark:hover:bg-whatsapp-border-dark rounded transition-colors"
        title="Sign out"
      >
        <LogOut size={16} className="text-whatsapp-text-secondary" />
      </button>
    </div>
  );
};
