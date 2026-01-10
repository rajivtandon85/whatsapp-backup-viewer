/**
 * FileUpload Component
 * Landing page for uploading WhatsApp backup ZIP files
 * Beautiful, drag-and-drop enabled interface
 */

import React, { useCallback, useState } from 'react';
import { Upload, FileArchive, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
  error: string | null;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  isLoading,
  error
}) => {
  const [isDragging, setIsDragging] = useState(false);
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  }, [onFileSelect]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.zip')) {
      onFileSelect(file);
    }
  }, [onFileSelect]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-whatsapp-primary/10 to-whatsapp-primary/5 dark:from-whatsapp-background-dark dark:to-whatsapp-panel-dark p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-whatsapp-primary rounded-full mb-4">
            <FileArchive size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold text-whatsapp-text dark:text-whatsapp-text-dark mb-2">
            WhatsApp Backup Viewer
          </h1>
          <p className="text-lg text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark">
            View your exported WhatsApp chats beautifully
          </p>
        </div>
        
        {/* Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative bg-white dark:bg-whatsapp-panel-dark rounded-2xl shadow-lg p-12
            border-2 border-dashed transition-all
            ${isDragging 
              ? 'border-whatsapp-primary bg-whatsapp-primary/5 scale-105' 
              : 'border-gray-300 dark:border-gray-700'
            }
            ${isLoading ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          <div className="text-center">
            <div className="mb-6">
              <Upload 
                size={64} 
                className={`mx-auto ${
                  isDragging 
                    ? 'text-whatsapp-primary animate-bounce' 
                    : 'text-gray-400 dark:text-gray-600'
                }`}
              />
            </div>
            
            <h2 className="text-2xl font-semibold text-whatsapp-text dark:text-whatsapp-text-dark mb-2">
              {isLoading ? 'Processing...' : 'Upload Your WhatsApp Backup'}
            </h2>
            
            <p className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark mb-6">
              Drag and drop your .zip file here, or click to browse
            </p>
            
            <label className="inline-block">
              <input
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                className="hidden"
                disabled={isLoading}
              />
              <span className="inline-flex items-center gap-2 bg-whatsapp-primary hover:bg-whatsapp-primary-dark text-white font-medium px-6 py-3 rounded-lg cursor-pointer transition-colors">
                <Upload size={20} />
                Select ZIP File
              </span>
            </label>
          </div>
          
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-whatsapp-panel-dark bg-opacity-90 rounded-2xl">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-whatsapp-primary border-t-transparent mb-4"></div>
                <p className="text-whatsapp-text dark:text-whatsapp-text-dark font-medium">
                  Extracting and parsing your backup...
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Error Display */}
        {error && (
          <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="font-semibold text-red-800 dark:text-red-400 mb-1">
                Error Loading Backup
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            </div>
          </div>
        )}
        
        {/* Instructions */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">
            📱 How to export your WhatsApp chat:
          </h3>
          <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
            <li>1. Open WhatsApp and go to the chat you want to export</li>
            <li>2. Tap the three dots menu → More → Export chat</li>
            <li>3. Choose "Include Media" or "Without Media"</li>
            <li>4. Save the ZIP file to your device</li>
            <li>5. Upload it here to view</li>
          </ol>
          
          <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-400">
              🔒 <strong>Privacy:</strong> Everything is processed locally in your browser. 
              No data is uploaded to any server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

