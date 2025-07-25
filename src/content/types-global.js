(function () {
  "use strict";

  // Storage keys
  const STORAGE_KEYS = {
    SNIPPETS: 'openblaze_snippets',
    FOLDERS: 'openblaze_folders',
    SETTINGS: 'openblaze_settings',
    STATS: 'openblaze_stats'
  };

  // Type constructors/validators (since we can't have actual TypeScript interfaces in JS)
  const Types = {
    // Core snippet types
    Snippet: null, // Interface placeholder
    SnippetVariable: null, // Interface placeholder
    SnippetFolder: null, // Interface placeholder
    
    // Expansion context
    ExpansionContext: null, // Interface placeholder
    
    // Message types
    Message: null, // Interface placeholder
    ExpandSnippetMessage: null, // Interface placeholder
    GetSnippetsMessage: null, // Interface placeholder
    SaveSnippetMessage: null, // Interface placeholder
    
    // Settings
    Settings: null, // Interface placeholder
    
    // Storage keys
    STORAGE_KEYS: STORAGE_KEYS,
    
    // Events
    SnippetUsageEvent: null, // Interface placeholder
    Statistics: null, // Interface placeholder
    
    // UI State
    PopupState: null, // Interface placeholder
    
    // Content script detection
    TextInputInfo: null, // Interface placeholder
    
    // Form handling
    FormField: null, // Interface placeholder
    FormData: null, // Interface placeholder
    
    // Notification types
    NotificationData: null, // Interface placeholder
    
    // Utility functions for type checking
    isSnippet: function(obj) {
      return !!(obj && typeof obj === 'object' &&
             typeof obj.id === 'string' &&
             typeof obj.shortcut === 'string' &&
             typeof obj.content === 'string' &&
             typeof obj.name === 'string' &&
             typeof obj.isEnabled === 'boolean' &&
             typeof obj.createdAt === 'number' &&
             typeof obj.updatedAt === 'number' &&
             typeof obj.usageCount === 'number' &&
             typeof obj.isDynamic === 'boolean');
    },
    
    isSettings: function(obj) {
      return !!(obj && typeof obj === 'object' &&
             typeof obj.isEnabled === 'boolean' &&
             typeof obj.expansionDelay === 'number' &&
             typeof obj.showNotifications === 'boolean' &&
             typeof obj.autoBackup === 'boolean' &&
             typeof obj.syncEnabled === 'boolean' &&
             typeof obj.shortcutTrigger === 'string' &&
             Array.isArray(obj.excludedDomains) &&
             typeof obj.theme === 'string');
    },
    
    isTextInputInfo: function(obj) {
      return !!(obj && typeof obj === 'object' &&
             obj.element instanceof HTMLElement &&
             typeof obj.type === 'string' &&
             typeof obj.value === 'string' &&
             typeof obj.selectionStart === 'number' &&
             typeof obj.selectionEnd === 'number' &&
             typeof obj.isSupported === 'boolean');
    },
    
    isMessage: function(obj) {
      return !!(obj && typeof obj === 'object' &&
             typeof obj.type === 'string');
    }
  };

  // Expose to global scope
  window.OpenBlaze_Types = Types;

})();
