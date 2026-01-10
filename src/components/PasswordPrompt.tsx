/**
 * PasswordPrompt Component
 * Modal for entering password to unlock private chats
 */

import React, { useState } from 'react';
import { Lock, Eye, EyeOff, X } from 'lucide-react';

interface PasswordPromptProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (password: string) => Promise<boolean>;
  chatName?: string;
}

export const PasswordPrompt: React.FC<PasswordPromptProps> = ({
  isOpen,
  onClose,
  onSubmit,
  chatName,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const success = await onSubmit(password);
      if (success) {
        setPassword('');
        onClose();
      } else {
        setError('Incorrect password');
      }
    } catch {
      setError('Failed to verify password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-whatsapp-panel-dark rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-whatsapp-border dark:border-whatsapp-border-dark">
          <div className="flex items-center gap-2">
            <Lock size={20} className="text-whatsapp-primary" />
            <h3 className="font-semibold text-whatsapp-text dark:text-whatsapp-text-dark">
              Private Chat
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-whatsapp-border-dark rounded"
          >
            <X size={20} className="text-whatsapp-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4">
          {chatName && (
            <p className="text-sm text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark mb-4">
              Enter password to view <strong>{chatName}</strong>
            </p>
          )}

          <div className="relative mb-4">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-3 pr-12 bg-white dark:bg-whatsapp-panel-dark border border-whatsapp-border dark:border-whatsapp-border-dark rounded-lg text-whatsapp-text dark:text-whatsapp-text-dark focus:outline-none focus:ring-2 focus:ring-whatsapp-primary"
              autoFocus
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-whatsapp-text-secondary hover:text-whatsapp-text dark:hover:text-whatsapp-text-dark"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {error && (
            <p className="text-red-500 text-sm mb-4">{error}</p>
          )}

          <button
            type="submit"
            disabled={!password.trim() || isLoading}
            className="w-full py-3 bg-whatsapp-primary hover:bg-whatsapp-primary-dark text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Verifying...' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
};
