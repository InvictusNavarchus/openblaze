import { Snippet, Settings, STORAGE_KEYS } from '../types';

// Browser compatibility helper
export function getBrowser(): typeof chrome {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    return chrome;
  }
  // @ts-ignore - for Firefox compatibility
  if (typeof browser !== 'undefined' && browser.runtime) {
    // @ts-ignore
    return browser;
  }
  throw new Error('Browser extension APIs not available');
}

// Generate unique IDs
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Debounce function with cancel support
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): {
  (...args: Parameters<T>): void;
  cancel(): void;
} {
  let timeout: NodeJS.Timeout | null = null;

  const debouncedFunction = (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      timeout = null;
      func(...args);
    }, wait);
  };

  debouncedFunction.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debouncedFunction;
}

// Throttle function
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Text processing utilities
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeShortcut(shortcut: string): string {
  return shortcut.toLowerCase().trim();
}

export function isValidShortcut(shortcut: string): boolean {
  if (!shortcut || shortcut.length < 2) return false;
  if (shortcut.length > 50) return false;
  // Must start with a letter or underscore
  if (!/^[a-zA-Z_]/.test(shortcut)) return false;
  // Can only contain letters, numbers, underscores, and hyphens
  if (!/^[a-zA-Z0-9_-]+$/.test(shortcut)) return false;
  return true;
}

// Storage utilities
export async function getFromStorage<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const browser = getBrowser();
    const result = await browser.storage.local.get(key);
    return result[key] !== undefined ? result[key] : defaultValue;
  } catch (error) {
    console.error('Error getting from storage:', error);
    return defaultValue;
  }
}

export async function setInStorage(key: string, value: any): Promise<void> {
  try {
    const browser = getBrowser();
    await browser.storage.local.set({ [key]: value });
  } catch (error) {
    console.error('Error setting in storage:', error);
    throw error;
  }
}

export async function removeFromStorage(key: string): Promise<void> {
  try {
    const browser = getBrowser();
    await browser.storage.local.remove(key);
  } catch (error) {
    console.error('Error removing from storage:', error);
    throw error;
  }
}

// Default settings
export const DEFAULT_SETTINGS: Settings = {
  isEnabled: true,
  expansionDelay: 100,
  showNotifications: true,
  autoBackup: false,
  syncEnabled: false,
  shortcutTrigger: 'space',
  excludedDomains: [],
  theme: 'auto'
};

// URL utilities
export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function isExcludedDomain(url: string, excludedDomains: string[]): boolean {
  const domain = getDomainFromUrl(url);
  return excludedDomains.some(excluded => 
    domain.includes(excluded) || excluded.includes(domain)
  );
}

// Element utilities
export function isEditableElement(element: Element): boolean {
  if (!element || !element.tagName) return false;
  
  const tagName = element.tagName.toLowerCase();
  
  // Input elements
  if (tagName === 'input') {
    const type = (element as HTMLInputElement).type.toLowerCase();
    return ['text', 'email', 'password', 'search', 'tel', 'url'].includes(type);
  }
  
  // Textarea
  if (tagName === 'textarea') return true;
  
  // Contenteditable
  if (element.getAttribute('contenteditable') === 'true') return true;
  
  return false;
}

export function getElementText(element: HTMLElement): string {
  if (!element || !element.tagName) return '';
  
  const tagName = element.tagName.toLowerCase();
  
  if (tagName === 'input' || tagName === 'textarea') {
    return (element as HTMLInputElement | HTMLTextAreaElement).value || '';
  }
  
  if (element.getAttribute('contenteditable') === 'true') {
    return element.textContent || '';
  }
  
  return '';
}

export function setElementText(element: HTMLElement, text: string): void {
  if (!element || !element.tagName) return;
  
  const tagName = element.tagName.toLowerCase();
  
  if (tagName === 'input' || tagName === 'textarea') {
    (element as HTMLInputElement | HTMLTextAreaElement).value = text;
    // Trigger input event
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  
  if (element.getAttribute('contenteditable') === 'true') {
    element.textContent = text;
    // Trigger input event
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
}

// Logging utility with all log levels
export function log(level: 'trace' | 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
  const prefix = '[OpenBlaze]';
  const timestamp = new Date().toISOString();
  const formattedPrefix = `${prefix}[${timestamp}][${level.toUpperCase()}]`;

  switch (level) {
    case 'trace':
      console.debug(formattedPrefix, message, ...args);
      break;
    case 'debug':
      console.debug(formattedPrefix, message, ...args);
      break;
    case 'info':
      console.info(formattedPrefix, message, ...args);
      break;
    case 'warn':
      console.warn(formattedPrefix, message, ...args);
      break;
    case 'error':
      console.error(formattedPrefix, message, ...args);
      break;
    default:
      console.log(formattedPrefix, message, ...args);
  }
}
