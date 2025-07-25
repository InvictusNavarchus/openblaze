(function () {
  "use strict";

  // Access global utilities
  const { log } = window.OpenBlaze_Utils;

  class KeyboardShortcutManager {
    constructor() {
      // Singleton pattern
      if (KeyboardShortcutManager.instance) {
        return KeyboardShortcutManager.instance;
      }
      
      this.shortcuts = new Map();
      this.pressedKeys = new Set();
      this.isListening = false;

      // Store bound event handlers for proper cleanup
      this.boundHandleKeyDown = this.handleKeyDown.bind(this);
      this.boundHandleKeyUp = this.handleKeyUp.bind(this);
      this.boundHandleBlur = this.handleBlur.bind(this);
      
      KeyboardShortcutManager.instance = this;
    }

    static getInstance() {
      if (!KeyboardShortcutManager.instance) {
        KeyboardShortcutManager.instance = new KeyboardShortcutManager();
      }
      return KeyboardShortcutManager.instance;
    }

    /**
     * Initialize keyboard shortcut listening
     */
    initialize() {
      if (this.isListening) return;

      document.addEventListener('keydown', this.boundHandleKeyDown);
      document.addEventListener('keyup', this.boundHandleKeyUp);
      document.addEventListener('blur', this.boundHandleBlur);

      this.isListening = true;
      log('info', 'Keyboard shortcut manager initialized');
    }

    /**
     * Cleanup keyboard shortcut listeners and reset state
     */
    destroy() {
      if (!this.isListening) return;

      document.removeEventListener('keydown', this.boundHandleKeyDown);
      document.removeEventListener('keyup', this.boundHandleKeyUp);
      document.removeEventListener('blur', this.boundHandleBlur);

      this.isListening = false;
      this.pressedKeys.clear();
      this.shortcuts.clear();

      log('info', 'Keyboard shortcut manager destroyed');
    }

    /**
     * Register a keyboard shortcut
     */
    register(shortcut) {
      this.shortcuts.set(shortcut.id, shortcut);
      log('info', `Registered keyboard shortcut: ${shortcut.keys.join('+')}`);
    }

    /**
     * Unregister a keyboard shortcut
     */
    unregister(id) {
      if (this.shortcuts.delete(id)) {
        log('info', `Unregistered keyboard shortcut: ${id}`);
      }
    }

    /**
     * Enable/disable a shortcut
     */
    setEnabled(id, enabled) {
      const shortcut = this.shortcuts.get(id);
      if (shortcut) {
        shortcut.enabled = enabled;
      }
    }

    /**
     * Get all registered shortcuts
     */
    getShortcuts() {
      return Array.from(this.shortcuts.values());
    }

    /**
     * Handle keydown events
     */
    handleKeyDown(event) {
      const key = this.normalizeKey(event);
      this.pressedKeys.add(key);

      // Check for shortcut matches
      this.checkShortcuts(event);
    }

    /**
     * Handle keyup events
     */
    handleKeyUp(event) {
      const key = this.normalizeKey(event);
      this.pressedKeys.delete(key);
    }

    /**
     * Handle blur events (clear pressed keys)
     */
    handleBlur() {
      this.pressedKeys.clear();
    }

    /**
     * Check if current pressed keys match any shortcuts
     */
    checkShortcuts(event) {
      const currentKeys = Array.from(this.pressedKeys).sort();

      for (const shortcut of this.shortcuts.values()) {
        if (!shortcut.enabled) continue;

        const shortcutKeys = shortcut.keys.map(k => k.toLowerCase()).sort();
        
        if (this.arraysEqual(currentKeys, shortcutKeys)) {
          // Prevent default behavior for matched shortcuts
          event.preventDefault();
          event.stopPropagation();
          
          try {
            shortcut.callback();
            log('info', `Executed shortcut: ${shortcut.id}`);
          } catch (error) {
            log('error', `Error executing shortcut ${shortcut.id}:`, error);
          }
          
          break;
        }
      }
    }

    /**
     * Normalize key names for consistency
     */
    normalizeKey(event) {
      const key = event.key.toLowerCase();

      // Handle modifier keys - only return modifier name when the pressed key itself is the modifier
      if (key === 'control') return 'ctrl';
      if (key === 'alt') return 'alt';
      if (key === 'shift') return 'shift';
      if (key === 'meta') return 'meta';
      
      // Handle special keys
      const keyMap = {
        ' ': 'space',
        'arrowup': 'up',
        'arrowdown': 'down',
        'arrowleft': 'left',
        'arrowright': 'right',
        'escape': 'esc'
      };
      
      return keyMap[key] || key;
    }

    /**
     * Check if two arrays are equal
     */
    arraysEqual(a, b) {
      return a.length === b.length && a.every((val, i) => val === b[i]);
    }

    /**
     * Parse shortcut string into keys array
     */
    static parseShortcut(shortcutString) {
      return shortcutString
        .toLowerCase()
        .split('+')
        .map(key => key.trim())
        .sort();
    }

    /**
     * Format keys array into readable string
     */
    static formatShortcut(keys) {
      const keyMap = {
        'ctrl': 'Ctrl',
        'alt': 'Alt',
        'shift': 'Shift',
        'meta': 'Cmd',
        'space': 'Space',
        'esc': 'Escape',
        'up': '↑',
        'down': '↓',
        'left': '←',
        'right': '→'
      };

      return keys
        .map(key => keyMap[key] || key.toUpperCase())
        .join(' + ');
    }
  }

  // Default shortcuts for OpenBlaze
  const DEFAULT_SHORTCUTS = [
    {
      id: 'toggle-expansion',
      keys: ['ctrl', 'shift', 'e'],
      description: 'Toggle text expansion on/off',
      enabled: true,
      global: true
    },
    {
      id: 'open-snippet-picker',
      keys: ['ctrl', 'shift', 'space'],
      description: 'Open snippet picker',
      enabled: true,
      global: true
    },
    {
      id: 'quick-insert',
      keys: ['ctrl', 'shift', 'i'],
      description: 'Quick insert last used snippet',
      enabled: true,
      global: true
    },
    {
      id: 'open-settings',
      keys: ['ctrl', 'shift', 'o'],
      description: 'Open OpenBlaze settings',
      enabled: true,
      global: true
    }
  ];

  // Utility functions
  function initializeKeyboardShortcuts() {
    KeyboardShortcutManager.getInstance().initialize();
  }

  function registerShortcut(shortcut) {
    KeyboardShortcutManager.getInstance().register(shortcut);
  }

  function unregisterShortcut(id) {
    KeyboardShortcutManager.getInstance().unregister(id);
  }

  function parseShortcut(shortcutString) {
    return KeyboardShortcutManager.parseShortcut(shortcutString);
  }

  function formatShortcut(keys) {
    return KeyboardShortcutManager.formatShortcut(keys);
  }

  // Expose to global scope
  window.OpenBlaze_KeyboardShortcuts = {
    KeyboardShortcutManager,
    DEFAULT_SHORTCUTS,
    initializeKeyboardShortcuts,
    registerShortcut,
    unregisterShortcut,
    parseShortcut,
    formatShortcut
  };

})();
