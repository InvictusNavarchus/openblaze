// Core snippet types
export interface Snippet {
  id: string;
  shortcut: string;
  content: string;
  name: string;
  description?: string;
  folder?: string;
  tags?: string[];
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
  isDynamic: boolean;
  variables?: SnippetVariable[];
}

export interface SnippetVariable {
  name: string;
  type: 'text' | 'select' | 'date' | 'number';
  label: string;
  defaultValue?: string;
  options?: string[];
  required: boolean;
}

export interface SnippetFolder {
  id: string;
  name: string;
  parentId?: string;
  isExpanded: boolean;
  createdAt: number;
}

// Expansion context
export interface ExpansionContext {
  element: HTMLElement;
  text: string;
  cursorPosition: number;
  shortcut: string;
  snippet: Snippet;
  variables?: Record<string, any>;
}

// Message types for communication between scripts
export interface Message {
  type: string;
  data?: any;
  tabId?: number;
  frameId?: number;
}

export interface ExpandSnippetMessage extends Message {
  type: 'expandSnippet';
  data: {
    snippet: Snippet;
    context: ExpansionContext;
    variables?: Record<string, any>;
  };
}

export interface GetSnippetsMessage extends Message {
  type: 'getSnippets';
  data?: {
    query?: string;
    folder?: string;
  };
}

export interface SaveSnippetMessage extends Message {
  type: 'saveSnippet';
  data: {
    snippet: Snippet;
  };
}

// Settings
export interface Settings {
  isEnabled: boolean;
  expansionDelay: number;
  showNotifications: boolean;
  autoBackup: boolean;
  syncEnabled: boolean;
  shortcutTrigger: 'space' | 'tab' | 'enter';
  excludedDomains: string[];
  theme: 'light' | 'dark' | 'auto';
}

// Storage keys
export const STORAGE_KEYS = {
  SNIPPETS: 'openblaze_snippets',
  FOLDERS: 'openblaze_folders',
  SETTINGS: 'openblaze_settings',
  STATS: 'openblaze_stats'
} as const;

// Events
export interface SnippetUsageEvent {
  snippetId: string;
  timestamp: number;
  domain: string;
}

export interface Statistics {
  totalExpansions: number;
  keystrokes_saved: number;
  mostUsedSnippets: Array<{
    snippetId: string;
    count: number;
  }>;
  dailyUsage: Record<string, number>;
}

// UI State
export interface PopupState {
  searchQuery: string;
  selectedFolder?: string;
  selectedSnippet?: string;
  isEditing: boolean;
  showSettings: boolean;
}

// Content script detection
export interface TextInputInfo {
  element: HTMLElement;
  type: 'input' | 'textarea' | 'contenteditable' | 'other';
  value: string;
  selectionStart: number;
  selectionEnd: number;
  isSupported: boolean;
}

// Form handling
export interface FormField {
  name: string;
  type: string;
  value: any;
  element: HTMLElement;
}

export interface FormData {
  fields: FormField[];
  url: string;
  title: string;
}

// Notification types
export interface NotificationData {
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  actions?: Array<{
    label: string;
    action: string;
  }>;
}
