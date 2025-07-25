// Global namespace declarations for content scripts

import type {
  Snippet,
  Settings,
  ExpansionContext,
  TextInputInfo,
  Message,
  SnippetVariable,
  SnippetFolder,
  FormField,
  FormData,
  NotificationData
} from '../types';

declare global {
  interface Window {
    OpenBlaze_Types: {
      // Type placeholders (null in runtime, but we need them for TypeScript)
      Snippet: null;
      SnippetVariable: null;
      SnippetFolder: null;
      ExpansionContext: null;
      Message: null;
      ExpandSnippetMessage: null;
      GetSnippetsMessage: null;
      SaveSnippetMessage: null;
      Settings: null;
      STORAGE_KEYS: {
        SNIPPETS: string;
        FOLDERS: string;
        SETTINGS: string;
        STATS: string;
      };
      SnippetUsageEvent: null;
      Statistics: null;
      PopupState: null;
      TextInputInfo: null;
      FormField: null;
      FormData: null;
      NotificationData: null;
      
      // Type checking functions
      isSnippet: (obj: any) => obj is Snippet;
      isSettings: (obj: any) => obj is Settings;
      isTextInputInfo: (obj: any) => obj is TextInputInfo;
      isMessage: (obj: any) => obj is Message;
    };

    OpenBlaze_Utils: {
      getBrowser: () => typeof chrome;
      generateId: () => string;
      debounce: <T extends (...args: any[]) => any>(func: T, wait: number) => (...args: Parameters<T>) => void;
      throttle: <T extends (...args: any[]) => any>(func: T, limit: number) => (...args: Parameters<T>) => void;
      escapeRegExp: (string: string) => string;
      normalizeShortcut: (shortcut: string) => string;
      isValidShortcut: (shortcut: string) => boolean;
      getFromStorage: <T>(key: string, defaultValue: T) => Promise<T>;
      setInStorage: (key: string, value: any) => Promise<void>;
      removeFromStorage: (key: string) => Promise<void>;
      DEFAULT_SETTINGS: Settings;
      getDomainFromUrl: (url: string) => string;
      isExcludedDomain: (url: string, excludedDomains: string[]) => boolean;
      isEditableElement: (element: Element) => boolean;
      getElementText: (element: HTMLElement) => string;
      setElementText: (element: HTMLElement, text: string) => void;
      log: (level: 'info' | 'warn' | 'error', message: string, ...args: any[]) => void;
    };

    OpenBlaze_FormHandler: {
      FormHandler: any;
      detectForms: () => HTMLFormElement[];
      fillFormField: (fieldName: string, value: any) => boolean;
      autoFillForm: (data: Record<string, any>) => void;
      getFormContext: (element: HTMLElement) => { formType: string; fieldType: string; suggestions: string[] };
    };

    OpenBlaze_KeyboardShortcuts: {
      KeyboardShortcutManager: any;
      DEFAULT_SHORTCUTS: Array<{
        id: string;
        keys: string[];
        description: string;
        enabled: boolean;
        global?: boolean;
      }>;
      initializeKeyboardShortcuts: () => void;
      registerShortcut: (shortcut: {
        id: string;
        keys: string[];
        description: string;
        callback: () => void;
        enabled: boolean;
        global?: boolean;
      }) => void;
      unregisterShortcut: (id: string) => void;
      parseShortcut: (shortcutString: string) => string[];
      formatShortcut: (keys: string[]) => string;
    };
  }
}

// For TypeScript to recognize this as a module
export {};
