/**
 * Main App Component
 * WhatsApp Backup Viewer - Supports Google Drive and local file upload
 */

import { useState, useCallback } from 'react';
import type { Chat, Message } from './types';
import { extractWhatsAppBackup } from './utils/zipExtractor';
import { parseChatFile } from './utils/chatParser';
import { extractMediaMessages } from './utils/timelineBuilder';
import { FileUpload } from './components/FileUpload';
import { ChatList } from './components/ChatList';
import { ChatView } from './components/ChatView';
import { MediaGallery } from './components/MediaGallery';
import { DriveAuth } from './components/DriveAuth';
import { PasswordPrompt } from './components/PasswordPrompt';
import { useDarkMode } from './hooks/useDarkMode';
import { useDriveChats } from './hooks/useDriveChats';
import { Moon, Sun, Search, Menu, X, Upload, Cloud } from 'lucide-react';
import type { ChatFolder } from './services/driveService';

type DataSource = 'drive' | 'local';

function App() {
  const { darkMode, toggleDarkMode } = useDarkMode();
  
  // Data source mode
  const [dataSource, setDataSource] = useState<DataSource>('drive');
  
  // Google Drive state
  const drive = useDriveChats();
  
  // Local file state
  const [localChats, setLocalChats] = useState<Chat[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  
  // Shared state
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [selectedChatFolder, setSelectedChatFolder] = useState<ChatFolder | null>(null);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Private chat state
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [pendingPrivateChat, setPendingPrivateChat] = useState<ChatFolder | null>(null);
  const [visiblePrivateChats, setVisiblePrivateChats] = useState<ChatFolder[]>([]);
  
  // Handle local file upload
  const handleFileSelect = useCallback(async (file: File) => {
    setLocalLoading(true);
    setLocalError(null);
    
    try {
      const zipContent = await extractWhatsAppBackup(file);
      const chats: Chat[] = [];
      
      for (const chatFile of zipContent.chatFiles) {
        const result = parseChatFile(chatFile.name, chatFile.content, zipContent.mediaFiles);
        if (result.chat.messages.length > 0) {
          chats.push(result.chat);
        }
      }
      
      if (chats.length === 0) {
        throw new Error('No valid chats found in the backup file');
      }
      
      // Use ZIP filename as chat name if unnamed
      if (chats.length === 1 && chats[0].name === 'Unnamed Chat') {
        let name = file.name.replace(/\.zip$/i, '').replace(/^WhatsApp Chat\s*[-–]?\s*(with\s*)?/i, '').trim();
        if (name) chats[0] = { ...chats[0], name };
      }
      
      setLocalChats(chats);
      setSelectedChat(chats[0]);
      setDataSource('local');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLocalLoading(false);
    }
  }, []);
  
  // Handle Drive chat selection
  const handleDriveChatSelect = useCallback(async (chatFolder: ChatFolder) => {
    setSelectedChatFolder(chatFolder);
    setSidebarOpen(false);
    
    // If private and not unlocked, show password prompt
    if (chatFolder.isPrivate && !drive.privateUnlocked) {
      setPendingPrivateChat(chatFolder);
      setShowPasswordPrompt(true);
      return;
    }
    
    // Load chat from Drive
    const chat = await drive.loadChat(chatFolder);
    if (chat) {
      setSelectedChat(chat);
    }
  }, [drive]);
  
  // Handle password submit
  const handlePasswordSubmit = useCallback(async (password: string): Promise<boolean> => {
    const success = await drive.unlockPrivate(password);
    if (success && pendingPrivateChat) {
      // Add to visible private chats
      setVisiblePrivateChats(prev => [...prev, pendingPrivateChat]);
      // Load the chat
      const chat = await drive.loadChat(pendingPrivateChat);
      if (chat) {
        setSelectedChat(chat);
      }
      setPendingPrivateChat(null);
    }
    return success;
  }, [drive, pendingPrivateChat]);
  
  // Handle back/navigation - lock private chats
  const handleBackToList = useCallback(() => {
    setSidebarOpen(true);
    
    // If current chat is private, lock it
    if (selectedChatFolder?.isPrivate) {
      setVisiblePrivateChats([]);
      drive.lockPrivate();
    }
    
    setSelectedChat(null);
    setSelectedChatFolder(null);
  }, [selectedChatFolder, drive]);
  
  // Unified search - searches both public and private chats
  // Private results only shown when searched (not listed by default)
  const privateSearchResults = sidebarSearchQuery.trim() 
    ? drive.searchPrivateChats(sidebarSearchQuery) 
    : [];
  
  // Handle media click
  const handleMediaClick = useCallback((message: Message) => {
    if (!selectedChat) return;
    const mediaMessages = extractMediaMessages(selectedChat.messages);
    const index = mediaMessages.findIndex(m => m.id === message.id);
    if (index !== -1) {
      setSelectedMediaIndex(index);
    }
  }, [selectedChat]);
  
  // Get media messages for gallery
  const mediaMessages = selectedChat ? extractMediaMessages(selectedChat.messages) : [];
  
  // Helper to get messages for a folder - use actual messages if loaded, otherwise placeholder
  const getMessagesForFolder = (folder: ChatFolder, placeholder: string) => {
    // If this folder is currently selected and has loaded messages, use those
    if (selectedChat && selectedChat.id === folder.id && selectedChat.messages.length > 0) {
      return selectedChat.messages;
    }
    return [{ id: 'placeholder', timestamp: new Date(), sender: '', type: 'text' as const, content: placeholder, isOutgoing: false }];
  };
  
  // Convert Drive chat folders to Chat-like objects for ChatList
  const driveChatItems: Chat[] = [
    // Public chats
    ...drive.publicChats.map(folder => ({
      id: folder.id,
      name: folder.name,
      messages: getMessagesForFolder(folder, 'Tap to view'),
      participants: [],
      isGroup: false,
      _driveFolder: folder, // Store reference
    } as Chat & { _driveFolder: ChatFolder })),
    // Visible private chats (after password entry)
    ...visiblePrivateChats.map(folder => ({
      id: folder.id,
      name: folder.name,
      messages: getMessagesForFolder(folder, 'Tap to view'),
      participants: [],
      isGroup: false,
      _driveFolder: folder,
    } as Chat & { _driveFolder: ChatFolder })),
    // Private search results (only when searching) - shown at bottom
    ...(sidebarSearchQuery.trim() ? privateSearchResults
      .filter(folder => !visiblePrivateChats.some(v => v.id === folder.id)) // Don't show already visible ones
      .map(folder => ({
        id: folder.id,
        name: folder.name,
        messages: [{ id: 'placeholder', timestamp: new Date(), sender: '', type: 'text' as const, content: '🔒 Enter password to view', isOutgoing: false }],
        participants: [],
        isGroup: false,
        _driveFolder: folder,
      } as Chat & { _driveFolder: ChatFolder })) : []),
  ];
  
  // Show initial screen if no data loaded
  const showInitialScreen = (dataSource === 'local' && localChats.length === 0) || 
                            (dataSource === 'drive' && !drive.isSignedIn);
  
  // Initial screen (auth or upload)
  if (showInitialScreen) {
    return (
      <div className="min-h-screen bg-whatsapp-panel dark:bg-whatsapp-background-dark flex flex-col">
        {/* Mode toggle */}
        <div className="p-4 flex justify-center gap-4">
          <button
            onClick={() => setDataSource('drive')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              dataSource === 'drive' 
                ? 'bg-whatsapp-primary text-white' 
                : 'bg-gray-200 dark:bg-whatsapp-panel-dark text-whatsapp-text dark:text-whatsapp-text-dark'
            }`}
          >
            <Cloud size={18} />
            Google Drive
          </button>
          <button
            onClick={() => setDataSource('local')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              dataSource === 'local' 
                ? 'bg-whatsapp-primary text-white' 
                : 'bg-gray-200 dark:bg-whatsapp-panel-dark text-whatsapp-text dark:text-whatsapp-text-dark'
            }`}
          >
            <Upload size={18} />
            Local File
          </button>
        </div>
        
        <div className="flex-1 flex items-center justify-center">
          {dataSource === 'drive' ? (
            <DriveAuth
              isInitialized={drive.isInitialized}
              isSignedIn={drive.isSignedIn}
              isLoading={drive.isLoading}
              error={drive.error}
              onSignIn={drive.signIn}
              onSignOut={drive.signOut}
              onRefresh={drive.refresh}
            />
          ) : (
            <FileUpload
              onFileSelect={handleFileSelect}
              isLoading={localLoading}
              error={localError}
            />
          )}
        </div>
        
        {/* Dark mode toggle */}
        <button
          onClick={toggleDarkMode}
          className="fixed top-4 right-4 p-3 bg-white dark:bg-whatsapp-panel-dark rounded-full shadow-lg"
        >
          {darkMode ? <Sun size={24} className="text-yellow-500" /> : <Moon size={24} className="text-gray-700" />}
        </button>
      </div>
    );
  }
  
  // Main app interface
  return (
    <div className="h-screen flex flex-col bg-whatsapp-panel dark:bg-whatsapp-background-dark">
      {/* Top bar (mobile) */}
      <div className="lg:hidden bg-whatsapp-header dark:bg-whatsapp-header-dark border-b border-whatsapp-border dark:border-whatsapp-border-dark p-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-whatsapp-text dark:text-whatsapp-text-dark">
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <h1 className="text-lg font-semibold text-whatsapp-text dark:text-whatsapp-text-dark">WhatsApp Viewer</h1>
        <button onClick={toggleDarkMode} className="text-whatsapp-text dark:text-whatsapp-text-dark">
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'block' : 'hidden'} lg:block w-full lg:w-96 flex-shrink-0 border-r border-whatsapp-border dark:border-whatsapp-border-dark flex flex-col`}>
          {/* Drive status bar */}
          {dataSource === 'drive' && drive.isSignedIn && (
            <DriveAuth
              isInitialized={drive.isInitialized}
              isSignedIn={drive.isSignedIn}
              isLoading={drive.isLoading}
              error={drive.error}
              onSignIn={drive.signIn}
              onSignOut={drive.signOut}
              onRefresh={drive.refresh}
            />
          )}
          
          
          {/* Chat list */}
          <div className="flex-1 overflow-hidden">
            <ChatList
              chats={dataSource === 'drive' ? driveChatItems : localChats}
              selectedChatId={selectedChat?.id || null}
              onSelectChat={(chatId) => {
                if (dataSource === 'drive') {
                  const chatItem = driveChatItems.find(c => c.id === chatId) as (Chat & { _driveFolder?: ChatFolder }) | undefined;
                  if (chatItem?._driveFolder) {
                    handleDriveChatSelect(chatItem._driveFolder);
                  }
                } else {
                  const chat = localChats.find(c => c.id === chatId);
                  if (chat) {
                    setSelectedChat(chat);
                    setSidebarOpen(false);
                  }
                }
              }}
              searchQuery={sidebarSearchQuery}
              onSearchQueryChange={setSidebarSearchQuery}
            />
          </div>
        </div>
        
        {/* Chat view */}
        <div className="flex-1 relative">
          {selectedChat ? (
            <>
              <ChatView
                chat={selectedChat}
                onBack={handleBackToList}
                onMediaClick={handleMediaClick}
                darkMode={darkMode}
                onOpenSearch={() => setShowSearch(true)}
                searchQuery={showSearch ? chatSearchQuery : ''}
                getMediaUrl={dataSource === 'drive' ? drive.getMediaUrl : undefined}
              />
              
              {/* Search overlay */}
              {showSearch && (
                <div className="absolute top-0 left-0 right-0 bg-whatsapp-header dark:bg-whatsapp-header-dark border-b border-whatsapp-border dark:border-whatsapp-border-dark p-3 flex items-center gap-3 z-10">
                  <Search size={20} className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark" />
                  <input
                    type="text"
                    placeholder="Search in conversation..."
                    value={chatSearchQuery}
                    onChange={(e) => setChatSearchQuery(e.target.value)}
                    className="flex-1 bg-white dark:bg-whatsapp-panel-dark border border-whatsapp-border dark:border-whatsapp-border-dark rounded-lg px-3 py-2 text-sm"
                    autoFocus
                  />
                  <button onClick={() => { setShowSearch(false); setChatSearchQuery(''); }}>
                    <X size={20} className="text-whatsapp-text-secondary" />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-whatsapp-background dark:bg-whatsapp-background-dark">
              <Cloud size={64} className="text-whatsapp-primary opacity-50 mb-4" />
              <h2 className="text-2xl font-semibold text-whatsapp-text dark:text-whatsapp-text-dark mb-2">
                WhatsApp Backup Viewer
              </h2>
              <p className="text-whatsapp-text-secondary dark:text-whatsapp-text-secondary-dark max-w-md mb-4">
                {drive.isLoading ? 'Loading chats...' : 'Select a chat from the sidebar to view messages'}
              </p>
              {dataSource === 'drive' && drive.publicChats.length === 0 && !drive.isLoading && !drive.error && (
                <p className="text-sm text-orange-500">
                  No chats found. Please check your backup folder setup.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Media Gallery */}
      {selectedMediaIndex !== null && mediaMessages.length > 0 && (
        <MediaGallery
          media={mediaMessages}
          initialIndex={selectedMediaIndex}
          onClose={() => setSelectedMediaIndex(null)}
          getMediaUrl={drive.getMediaUrl}
        />
      )}
      
      {/* Password Prompt */}
      <PasswordPrompt
        isOpen={showPasswordPrompt}
        onClose={() => { setShowPasswordPrompt(false); setPendingPrivateChat(null); }}
        onSubmit={handlePasswordSubmit}
        chatName={pendingPrivateChat?.name}
      />
    </div>
  );
}

export default App;
