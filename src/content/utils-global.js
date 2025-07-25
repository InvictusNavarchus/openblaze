(function () {
  "use strict";

  // Browser compatibility helper
  function getBrowser() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return chrome;
    }
    // For Firefox compatibility
    if (typeof browser !== 'undefined' && browser.runtime) {
      return browser;
    }
    throw new Error('Browser extension APIs not available');
  }

  // Generate unique IDs
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Debounce function
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // Throttle function
  function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Text processing utilities
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeShortcut(shortcut) {
    return shortcut.toLowerCase().trim();
  }

  function isValidShortcut(shortcut) {
    if (!shortcut || shortcut.length < 2) return false;
    if (shortcut.length > 50) return false;
    // Must start with a letter or underscore
    if (!/^[a-zA-Z_]/.test(shortcut)) return false;
    // Can only contain letters, numbers, underscores, and hyphens
    if (!/^[a-zA-Z0-9_-]+$/.test(shortcut)) return false;
    return true;
  }

  // Storage utilities
  async function getFromStorage(key, defaultValue) {
    try {
      const browser = getBrowser();
      const result = await browser.storage.local.get(key);
      return result[key] !== undefined ? result[key] : defaultValue;
    } catch (error) {
      console.error('Error getting from storage:', error);
      return defaultValue;
    }
  }

  async function setInStorage(key, value) {
    try {
      const browser = getBrowser();
      await browser.storage.local.set({ [key]: value });
    } catch (error) {
      console.error('Error setting in storage:', error);
      throw error;
    }
  }

  async function removeFromStorage(key) {
    try {
      const browser = getBrowser();
      await browser.storage.local.remove(key);
    } catch (error) {
      console.error('Error removing from storage:', error);
      throw error;
    }
  }

  // Default settings
  const DEFAULT_SETTINGS = {
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
  function getDomainFromUrl(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  function isExcludedDomain(url, excludedDomains) {
    const domain = getDomainFromUrl(url);
    return excludedDomains.some(excluded => 
      domain.includes(excluded) || excluded.includes(domain)
    );
  }

  // Element utilities
  function isEditableElement(element) {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    
    // Input elements
    if (tagName === 'input') {
      const type = element.type.toLowerCase();
      return ['text', 'email', 'password', 'search', 'tel', 'url'].includes(type);
    }
    
    // Textarea
    if (tagName === 'textarea') return true;
    
    // Contenteditable
    if (element.getAttribute('contenteditable') === 'true') return true;
    
    return false;
  }

  function getElementText(element) {
    if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
      return element.value;
    }
    
    if (element.getAttribute('contenteditable') === 'true') {
      return element.textContent || '';
    }
    
    return '';
  }

  function setElementText(element, text) {
    if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
      element.value = text;
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

  // Logging utility
  function log(level, message, ...args) {
    const prefix = '[OpenBlaze]';
    console[level](prefix, message, ...args);
  }

  // Expose utilities to global scope
  window.OpenBlaze_Utils = {
    getBrowser,
    generateId,
    debounce,
    throttle,
    escapeRegExp,
    normalizeShortcut,
    isValidShortcut,
    getFromStorage,
    setInStorage,
    removeFromStorage,
    DEFAULT_SETTINGS,
    getDomainFromUrl,
    isExcludedDomain,
    isEditableElement,
    getElementText,
    setElementText,
    log
  };

})();
