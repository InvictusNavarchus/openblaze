import {
  Snippet,
  SnippetFolder,
  Settings,
  Statistics,
  STORAGE_KEYS
} from '../types';
import {
  getFromStorage,
  setInStorage,
  generateId,
  DEFAULT_SETTINGS,
  log
} from '../utils';
import { createDefaultSnippets } from '../data/defaultSnippets';

export class StorageManager {
  private static instance: StorageManager;
  private snippetsCache: Map<string, Snippet> = new Map();
  private foldersCache: Map<string, SnippetFolder> = new Map();
  private settingsCache: Settings | null = null;
  private isInitialized = false;

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.loadSnippets();
      await this.loadFolders();
      await this.loadSettings();

      // Seed default snippets if none exist
      if (this.snippetsCache.size === 0) {
        await this.seedDefaultSnippets();
      }

      this.isInitialized = true;
      log('info', 'StorageManager initialized');
    } catch (error) {
      log('error', 'Failed to initialize StorageManager:', error);
      throw error;
    }
  }

  // Snippets management
  async getSnippets(): Promise<Snippet[]> {
    if (!this.isInitialized) await this.initialize();
    return Array.from(this.snippetsCache.values());
  }

  async getSnippet(id: string): Promise<Snippet | null> {
    if (!this.isInitialized) await this.initialize();
    return this.snippetsCache.get(id) || null;
  }

  async getSnippetByShortcut(shortcut: string): Promise<Snippet | null> {
    if (!this.isInitialized) await this.initialize();
    const normalizedShortcut = shortcut.toLowerCase().trim();
    
    for (const snippet of this.snippetsCache.values()) {
      if (snippet.shortcut.toLowerCase() === normalizedShortcut && snippet.isEnabled) {
        return snippet;
      }
    }
    return null;
  }

  async saveSnippet(snippet: Partial<Snippet>): Promise<Snippet> {
    if (!this.isInitialized) await this.initialize();

    const now = Date.now();
    const fullSnippet: Snippet = {
      id: snippet.id || generateId(),
      shortcut: snippet.shortcut || '',
      content: snippet.content || '',
      name: snippet.name || '',
      description: snippet.description || '',
      folder: snippet.folder,
      tags: snippet.tags || [],
      isEnabled: snippet.isEnabled !== undefined ? snippet.isEnabled : true,
      createdAt: snippet.createdAt || now,
      updatedAt: now,
      usageCount: snippet.usageCount || 0,
      isDynamic: snippet.isDynamic || false,
      variables: snippet.variables || []
    };

    this.snippetsCache.set(fullSnippet.id, fullSnippet);
    await this.persistSnippets();
    
    log('info', 'Snippet saved:', fullSnippet.shortcut);
    return fullSnippet;
  }

  async deleteSnippet(id: string): Promise<boolean> {
    if (!this.isInitialized) await this.initialize();

    if (this.snippetsCache.has(id)) {
      this.snippetsCache.delete(id);
      await this.persistSnippets();
      log('info', 'Snippet deleted:', id);
      return true;
    }
    return false;
  }

  async searchSnippets(query: string): Promise<Snippet[]> {
    if (!this.isInitialized) await this.initialize();
    
    const lowerQuery = query.toLowerCase();
    const snippets = Array.from(this.snippetsCache.values());
    
    return snippets.filter(snippet => 
      snippet.shortcut.toLowerCase().includes(lowerQuery) ||
      snippet.name.toLowerCase().includes(lowerQuery) ||
      snippet.content.toLowerCase().includes(lowerQuery) ||
      (snippet.description && snippet.description.toLowerCase().includes(lowerQuery)) ||
      snippet.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  // Folders management
  async getFolders(): Promise<SnippetFolder[]> {
    if (!this.isInitialized) await this.initialize();
    return Array.from(this.foldersCache.values());
  }

  async saveFolder(folder: Partial<SnippetFolder>): Promise<SnippetFolder> {
    if (!this.isInitialized) await this.initialize();

    const fullFolder: SnippetFolder = {
      id: folder.id || generateId(),
      name: folder.name || '',
      parentId: folder.parentId,
      isExpanded: folder.isExpanded !== undefined ? folder.isExpanded : true,
      createdAt: folder.createdAt || Date.now()
    };

    this.foldersCache.set(fullFolder.id, fullFolder);
    await this.persistFolders();
    
    return fullFolder;
  }

  async deleteFolder(id: string): Promise<boolean> {
    if (!this.isInitialized) await this.initialize();

    if (this.foldersCache.has(id)) {
      // Move snippets in this folder to root
      const snippets = Array.from(this.snippetsCache.values());
      for (const snippet of snippets) {
        if (snippet.folder === id) {
          snippet.folder = undefined;
          this.snippetsCache.set(snippet.id, snippet);
        }
      }
      
      this.foldersCache.delete(id);
      await this.persistFolders();
      await this.persistSnippets();
      return true;
    }
    return false;
  }

  // Settings management
  async getSettings(): Promise<Settings> {
    if (!this.isInitialized) await this.initialize();
    return this.settingsCache || DEFAULT_SETTINGS;
  }

  async saveSettings(settings: Partial<Settings>): Promise<Settings> {
    if (!this.isInitialized) await this.initialize();

    const fullSettings: Settings = {
      ...DEFAULT_SETTINGS,
      ...this.settingsCache,
      ...settings
    };

    this.settingsCache = fullSettings;
    await setInStorage(STORAGE_KEYS.SETTINGS, fullSettings);
    
    log('info', 'Settings saved');
    return fullSettings;
  }

  // Statistics
  async incrementSnippetUsage(snippetId: string): Promise<void> {
    const snippet = this.snippetsCache.get(snippetId);
    if (snippet) {
      snippet.usageCount++;
      snippet.updatedAt = Date.now();
      this.snippetsCache.set(snippetId, snippet);
      await this.persistSnippets();
    }
  }

  // Private methods
  private async loadSnippets(): Promise<void> {
    const snippets = await getFromStorage<Snippet[]>(STORAGE_KEYS.SNIPPETS, []);
    this.snippetsCache.clear();
    snippets.forEach(snippet => {
      this.snippetsCache.set(snippet.id, snippet);
    });
  }

  private async loadFolders(): Promise<void> {
    const folders = await getFromStorage<SnippetFolder[]>(STORAGE_KEYS.FOLDERS, []);
    this.foldersCache.clear();
    folders.forEach(folder => {
      this.foldersCache.set(folder.id, folder);
    });
  }

  private async loadSettings(): Promise<void> {
    this.settingsCache = await getFromStorage<Settings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }

  private async persistSnippets(): Promise<void> {
    const snippets = Array.from(this.snippetsCache.values());
    await setInStorage(STORAGE_KEYS.SNIPPETS, snippets);
  }

  private async persistFolders(): Promise<void> {
    const folders = Array.from(this.foldersCache.values());
    await setInStorage(STORAGE_KEYS.FOLDERS, folders);
  }

  // Seed default snippets
  private async seedDefaultSnippets(): Promise<void> {
    try {
      const defaultSnippets = createDefaultSnippets();

      for (const snippet of defaultSnippets) {
        this.snippetsCache.set(snippet.id, snippet);
      }

      await this.persistSnippets();
      log('info', `Seeded ${defaultSnippets.length} default snippets`);
    } catch (error) {
      log('error', 'Failed to seed default snippets:', error);
    }
  }

  // Export/Import functionality
  async exportData(): Promise<string> {
    if (!this.isInitialized) await this.initialize();

    const data = {
      snippets: Array.from(this.snippetsCache.values()),
      folders: Array.from(this.foldersCache.values()),
      settings: this.settingsCache,
      exportedAt: Date.now(),
      version: '1.0.0'
    };

    return JSON.stringify(data, null, 2);
  }

  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.snippets) {
        this.snippetsCache.clear();
        data.snippets.forEach((snippet: Snippet) => {
          this.snippetsCache.set(snippet.id, snippet);
        });
        await this.persistSnippets();
      }

      if (data.folders) {
        this.foldersCache.clear();
        data.folders.forEach((folder: SnippetFolder) => {
          this.foldersCache.set(folder.id, folder);
        });
        await this.persistFolders();
      }

      if (data.settings) {
        this.settingsCache = { ...DEFAULT_SETTINGS, ...data.settings };
        await setInStorage(STORAGE_KEYS.SETTINGS, this.settingsCache);
      }

      log('info', 'Data imported successfully');
    } catch (error) {
      log('error', 'Failed to import data:', error);
      throw new Error('Invalid import data format');
    }
  }
}
