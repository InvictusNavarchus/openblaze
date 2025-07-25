import { StorageManager } from '../storage/StorageManager';
import { 
  Message, 
  ExpandSnippetMessage, 
  GetSnippetsMessage, 
  SaveSnippetMessage,
  Snippet,
  Settings
} from '../types';
import { getBrowser, log, getDomainFromUrl, isExcludedDomain } from '../utils';

class BackgroundService {
  private storageManager: StorageManager;
  private browser = getBrowser();

  constructor() {
    this.storageManager = StorageManager.getInstance();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.storageManager.initialize();
      this.setupEventListeners();
      log('info', 'Background service initialized');
    } catch (error) {
      log('error', 'Failed to initialize background service:', error);
    }
  }

  private setupEventListeners(): void {
    // Handle messages from content scripts and popup
    this.browser.runtime.onMessage.addListener(
      (message: Message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true; // Keep message channel open for async response
      }
    );

    // Handle extension icon click
    this.browser.action.onClicked.addListener((tab) => {
      this.handleActionClick(tab);
    });

    // Handle context menu
    this.browser.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });

    // Handle keyboard commands
    this.browser.commands.onCommand.addListener((command) => {
      this.handleCommand(command);
    });

    // Handle tab updates to inject content scripts if needed
    this.browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.handleTabUpdate(tabId, tab);
      }
    });

    // Setup context menu
    this.setupContextMenu();
  }

  private async handleMessage(
    message: Message, 
    sender: chrome.runtime.MessageSender, 
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'getSnippets':
          await this.handleGetSnippets(message as GetSnippetsMessage, sendResponse);
          break;

        case 'getSnippetByShortcut':
          await this.handleGetSnippetByShortcut(message, sendResponse);
          break;

        case 'saveSnippet':
          await this.handleSaveSnippet(message as SaveSnippetMessage, sendResponse);
          break;

        case 'deleteSnippet':
          await this.handleDeleteSnippet(message, sendResponse);
          break;

        case 'expandSnippet':
          await this.handleExpandSnippet(message as ExpandSnippetMessage, sender);
          break;

        case 'getSettings':
          await this.handleGetSettings(sendResponse);
          break;

        case 'saveSettings':
          await this.handleSaveSettings(message, sendResponse);
          break;

        case 'searchSnippets':
          await this.handleSearchSnippets(message, sendResponse);
          break;

        case 'exportData':
          await this.handleExportData(sendResponse);
          break;

        case 'importData':
          await this.handleImportData(message, sendResponse);
          break;

        case 'ping':
          sendResponse({ status: 'ok' });
          break;

        default:
          log('warn', 'Unknown message type:', message.type);
          sendResponse({ error: 'Unknown message type' });
      }
    } catch (error) {
      log('error', 'Error handling message:', error);
      sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async handleGetSnippets(
    message: GetSnippetsMessage, 
    sendResponse: (response: any) => void
  ): Promise<void> {
    const snippets = await this.storageManager.getSnippets();
    sendResponse({ snippets });
  }

  private async handleGetSnippetByShortcut(
    message: Message, 
    sendResponse: (response: any) => void
  ): Promise<void> {
    const { shortcut } = message.data;
    const snippet = await this.storageManager.getSnippetByShortcut(shortcut);
    sendResponse({ snippet });
  }

  private async handleSaveSnippet(
    message: SaveSnippetMessage, 
    sendResponse: (response: any) => void
  ): Promise<void> {
    const savedSnippet = await this.storageManager.saveSnippet(message.data.snippet);
    sendResponse({ snippet: savedSnippet });
  }

  private async handleDeleteSnippet(
    message: Message, 
    sendResponse: (response: any) => void
  ): Promise<void> {
    const { id } = message.data;
    const success = await this.storageManager.deleteSnippet(id);
    sendResponse({ success });
  }

  private async handleExpandSnippet(
    message: ExpandSnippetMessage, 
    sender: chrome.runtime.MessageSender
  ): Promise<void> {
    const { snippet } = message.data;
    
    // Increment usage count
    await this.storageManager.incrementSnippetUsage(snippet.id);
    
    // Log expansion for analytics
    log('info', `Snippet expanded: ${snippet.shortcut}`);
  }

  private async handleGetSettings(sendResponse: (response: any) => void): Promise<void> {
    const settings = await this.storageManager.getSettings();
    sendResponse({ settings });
  }

  private async handleSaveSettings(
    message: Message, 
    sendResponse: (response: any) => void
  ): Promise<void> {
    const { settings } = message.data;
    const savedSettings = await this.storageManager.saveSettings(settings);
    sendResponse({ settings: savedSettings });
  }

  private async handleSearchSnippets(
    message: Message, 
    sendResponse: (response: any) => void
  ): Promise<void> {
    const { query } = message.data;
    const snippets = await this.storageManager.searchSnippets(query);
    sendResponse({ snippets });
  }

  private async handleExportData(sendResponse: (response: any) => void): Promise<void> {
    const data = await this.storageManager.exportData();
    sendResponse({ data });
  }

  private async handleImportData(
    message: Message, 
    sendResponse: (response: any) => void
  ): Promise<void> {
    try {
      const { data } = message.data;
      await this.storageManager.importData(data);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async handleActionClick(tab: chrome.tabs.Tab): Promise<void> {
    // Open popup or perform default action
    log('info', 'Extension icon clicked');
  }

  private async handleContextMenuClick(
    info: chrome.contextMenus.OnClickData, 
    tab?: chrome.tabs.Tab
  ): Promise<void> {
    if (info.menuItemId === 'openblaze-insert-snippet' && tab?.id) {
      // Show snippet picker
      await this.browser.tabs.sendMessage(tab.id, {
        type: 'showSnippetPicker',
        data: {}
      });
    }
  }

  private async handleCommand(command: string): Promise<void> {
    const [tab] = await this.browser.tabs.query({ active: true, currentWindow: true });
    
    if (!tab?.id) return;

    switch (command) {
      case '_execute_action':
        // Show snippet picker
        await this.browser.tabs.sendMessage(tab.id, {
          type: 'showSnippetPicker'
        });
        break;

      case 'toggle_expansion':
        // Toggle expansion on/off
        const settings = await this.storageManager.getSettings();
        await this.storageManager.saveSettings({ 
          isEnabled: !settings.isEnabled 
        });
        
        // Notify content script
        await this.browser.tabs.sendMessage(tab.id, {
          type: 'toggleExpansion',
          data: { enabled: !settings.isEnabled }
        });
        break;
    }
  }

  private async handleTabUpdate(tabId: number, tab: chrome.tabs.Tab): Promise<void> {
    if (!tab.url) return;

    // Check if domain is excluded
    const settings = await this.storageManager.getSettings();
    if (isExcludedDomain(tab.url, settings.excludedDomains)) {
      return;
    }

    // Update badge based on settings
    await this.updateBadge(tabId, settings);
  }

  private async updateBadge(tabId: number, settings: Settings): Promise<void> {
    const badgeText = settings.isEnabled ? '' : 'OFF';
    const badgeColor = settings.isEnabled ? '#00ACC0' : '#FF5722';
    
    await this.browser.action.setBadgeText({ text: badgeText, tabId });
    await this.browser.action.setBadgeBackgroundColor({ color: badgeColor, tabId });
  }

  private async setupContextMenu(): Promise<void> {
    await this.browser.contextMenus.removeAll();
    
    this.browser.contextMenus.create({
      id: 'openblaze-insert-snippet',
      title: 'Insert snippet...',
      contexts: ['editable']
    });
  }
}

// Initialize the background service
new BackgroundService();
