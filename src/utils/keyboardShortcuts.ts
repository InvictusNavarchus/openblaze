import { log } from './index';

export interface KeyboardShortcut {
  id: string;
  keys: string[];
  description: string;
  callback: () => void;
  enabled: boolean;
  global?: boolean;
}

export class KeyboardShortcutManager {
  private static instance: KeyboardShortcutManager;
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private pressedKeys: Set<string> = new Set();
  private isListening = false;

  // Store bound event handlers for proper cleanup
  private boundHandleKeyDown: (event: KeyboardEvent) => void;
  private boundHandleKeyUp: (event: KeyboardEvent) => void;
  private boundHandleBlur: () => void;

  constructor() {
    // Bind event handlers once in constructor
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleKeyUp = this.handleKeyUp.bind(this);
    this.boundHandleBlur = this.handleBlur.bind(this);
  }

  static getInstance(): KeyboardShortcutManager {
    if (!KeyboardShortcutManager.instance) {
      KeyboardShortcutManager.instance = new KeyboardShortcutManager();
    }
    return KeyboardShortcutManager.instance;
  }

  /**
   * Initialize keyboard shortcut listening
   */
  initialize(): void {
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
  destroy(): void {
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
  register(shortcut: KeyboardShortcut): void {
    this.shortcuts.set(shortcut.id, shortcut);
    log('info', `Registered keyboard shortcut: ${shortcut.keys.join('+')}`);
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(id: string): void {
    if (this.shortcuts.delete(id)) {
      log('info', `Unregistered keyboard shortcut: ${id}`);
    }
  }

  /**
   * Enable/disable a shortcut
   */
  setEnabled(id: string, enabled: boolean): void {
    const shortcut = this.shortcuts.get(id);
    if (shortcut) {
      shortcut.enabled = enabled;
    }
  }

  /**
   * Get all registered shortcuts
   */
  getShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Handle keydown events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    const key = this.normalizeKey(event);
    this.pressedKeys.add(key);

    // Check for shortcut matches
    this.checkShortcuts(event);
  }

  /**
   * Handle keyup events
   */
  private handleKeyUp(event: KeyboardEvent): void {
    const key = this.normalizeKey(event);
    this.pressedKeys.delete(key);
  }

  /**
   * Handle blur events (clear pressed keys)
   */
  private handleBlur(): void {
    this.pressedKeys.clear();
  }

  /**
   * Check if current pressed keys match any shortcuts
   */
  private checkShortcuts(event: KeyboardEvent): void {
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
  private normalizeKey(event: KeyboardEvent): string {
    const key = event.key.toLowerCase();

    // Handle modifier keys - only return modifier name when the pressed key itself is the modifier
    if (key === 'control') return 'ctrl';
    if (key === 'alt') return 'alt';
    if (key === 'shift') return 'shift';
    if (key === 'meta') return 'meta';
    
    // Handle special keys
    const keyMap: Record<string, string> = {
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
  private arraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }

  /**
   * Parse shortcut string into keys array
   */
  static parseShortcut(shortcutString: string): string[] {
    return shortcutString
      .toLowerCase()
      .split('+')
      .map(key => key.trim())
      .sort();
  }

  /**
   * Format keys array into readable string
   */
  static formatShortcut(keys: string[]): string {
    const keyMap: Record<string, string> = {
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
export const DEFAULT_SHORTCUTS: Omit<KeyboardShortcut, 'callback'>[] = [
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
export function initializeKeyboardShortcuts(): void {
  KeyboardShortcutManager.getInstance().initialize();
}

export function registerShortcut(shortcut: KeyboardShortcut): void {
  KeyboardShortcutManager.getInstance().register(shortcut);
}

export function unregisterShortcut(id: string): void {
  KeyboardShortcutManager.getInstance().unregister(id);
}

export function parseShortcut(shortcutString: string): string[] {
  return KeyboardShortcutManager.parseShortcut(shortcutString);
}

export function formatShortcut(keys: string[]): string {
  return KeyboardShortcutManager.formatShortcut(keys);
}

// Shortcut validation
export function isValidShortcut(keys: string[]): boolean {
  // Must have at least one key
  if (keys.length === 0) return false;
  
  // Must have at least one modifier for global shortcuts
  const modifiers = ['ctrl', 'alt', 'shift', 'meta'];
  const hasModifier = keys.some(key => modifiers.includes(key));
  
  // Single character shortcuts without modifiers are not recommended
  if (keys.length === 1 && !hasModifier) {
    const key = keys[0];
    // Allow function keys and special keys without modifiers
    return key.startsWith('f') || ['esc', 'space', 'tab', 'enter'].includes(key);
  }
  
  return true;
}

// Check for shortcut conflicts
export function hasShortcutConflict(keys: string[], existingShortcuts: KeyboardShortcut[]): boolean {
  const normalizedKeys = keys.sort();
  
  return existingShortcuts.some(shortcut => {
    const shortcutKeys = shortcut.keys.sort();
    return normalizedKeys.length === shortcutKeys.length &&
           normalizedKeys.every((key, i) => key === shortcutKeys[i]);
  });
}

// Get system shortcuts that might conflict
export function getSystemShortcuts(): string[][] {
  return [
    ['ctrl', 'c'], // Copy
    ['ctrl', 'v'], // Paste
    ['ctrl', 'x'], // Cut
    ['ctrl', 'z'], // Undo
    ['ctrl', 'y'], // Redo
    ['ctrl', 'a'], // Select all
    ['ctrl', 's'], // Save
    ['ctrl', 'f'], // Find
    ['ctrl', 'r'], // Refresh
    ['ctrl', 't'], // New tab
    ['ctrl', 'w'], // Close tab
    ['ctrl', 'n'], // New window
    ['alt', 'tab'], // Switch apps
    ['ctrl', 'tab'], // Switch tabs
  ];
}
