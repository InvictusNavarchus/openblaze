/// <reference path="./global-types.d.ts" />

import type {
  Snippet,
  Settings,
  ExpansionContext,
  TextInputInfo,
  Message
} from '../types';

(function () {
  "use strict";

  // Access global namespaces
  const {
    getBrowser,
    log,
    isEditableElement,
    // getElementText, // TODO: Use for text tracking
    setElementText,
    debounce
  } = window.OpenBlaze_Utils;

  // const { getFormContext } = window.OpenBlaze_FormHandler; // TODO: Use for form context detection
  const { initializeKeyboardShortcuts, registerShortcut } = window.OpenBlaze_KeyboardShortcuts;

class ContentScript {
  private browser = getBrowser();
  private settings: Settings | null = null;
  private isEnabled = true;
  private currentElement: HTMLElement | null = null;
  // private lastTypedText = ''; // TODO: Use for text tracking
  private expansionInProgress = false;
  private debouncedCheckExpansion: () => void;

  constructor() {
    this.debouncedCheckExpansion = debounce(() => this.checkForExpansion(), 100);
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.loadSettings();
      this.setupEventListeners();
      this.setupMessageListener();
      this.setupKeyboardShortcuts();
      log('info', 'Content script initialized');
    } catch (error) {
      log('error', 'Failed to initialize content script:', error);
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const response = await this.browser.runtime.sendMessage({
        type: 'getSettings'
      });
      this.settings = response.settings;
      this.isEnabled = this.settings?.isEnabled ?? true;
    } catch (error) {
      log('error', 'Failed to load settings:', error);
      this.isEnabled = true; // Default to enabled
    }
  }

  private setupEventListeners(): void {
    // Listen for input events on all elements
    document.addEventListener('input', this.handleInput.bind(this), true);
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    document.addEventListener('keyup', this.handleKeyUp.bind(this), true);
    document.addEventListener('focus', this.handleFocus.bind(this), true);
    document.addEventListener('blur', this.handleBlur.bind(this), true);
    
    // Listen for dynamic content changes
    const observer = new MutationObserver(() => {
      this.debouncedCheckExpansion();
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  private setupMessageListener(): void {
    this.browser.runtime.onMessage.addListener(
      (message: Message, _sender, sendResponse) => {
        this.handleMessage(message, sendResponse);
        return true;
      }
    );
  }

  private setupKeyboardShortcuts(): void {
    initializeKeyboardShortcuts();

    // Register content script specific shortcuts
    registerShortcut({
      id: 'toggle-expansion-content',
      keys: ['ctrl', 'shift', 'e'],
      description: 'Toggle text expansion',
      callback: () => this.toggleExpansion(),
      enabled: true
    });

    registerShortcut({
      id: 'snippet-picker-content',
      keys: ['ctrl', 'shift', 'space'],
      description: 'Open snippet picker',
      callback: () => this.showSnippetPicker(),
      enabled: true
    });
  }

  private handleMessage(
    message: Message,
    sendResponse: (response?: any) => void
  ): void {
    switch (message.type) {
      case 'toggleExpansion':
        this.isEnabled = message.data.enabled;
        sendResponse({ success: true });
        break;

      case 'showSnippetPicker':
        this.showSnippetPicker(message.data);
        sendResponse({ success: true });
        break;

      case 'insertSnippet':
        this.insertSnippet(message.data.snippet, message.data.variables);
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  }

  private handleInput(event: Event): void {
    if (!this.isEnabled || this.expansionInProgress) return;

    const target = event.target as HTMLElement;
    if (!isEditableElement(target)) return;

    this.currentElement = target;
    // TODO: Track text changes for better expansion detection
    
    // Check for expansion after a short delay
    this.debouncedCheckExpansion();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.isEnabled) return;

    // Handle shortcut trigger keys
    if (this.shouldTriggerExpansion(event)) {
      this.checkForExpansion();
    }

    // Handle Ctrl+Shift+Space for snippet picker
    if (event.ctrlKey && event.shiftKey && event.code === 'Space') {
      event.preventDefault();
      this.showSnippetPicker();
    }
  }

  private handleKeyUp(_event: KeyboardEvent): void {
    // Additional key handling if needed
  }

  private handleFocus(event: Event): void {
    const target = event.target as HTMLElement;
    if (isEditableElement(target)) {
      this.currentElement = target;
    }
  }

  private handleBlur(event: Event): void {
    // Clear current element when focus is lost
    if (event.target === this.currentElement) {
      this.currentElement = null;
    }
  }

  private shouldTriggerExpansion(event: KeyboardEvent): boolean {
    if (!this.settings) return false;

    switch (this.settings.shortcutTrigger) {
      case 'space':
        return event.code === 'Space';
      case 'tab':
        return event.code === 'Tab';
      case 'enter':
        return event.code === 'Enter';
      default:
        return event.code === 'Space';
    }
  }

  private async checkForExpansion(): Promise<void> {
    if (!this.currentElement || !this.isEnabled || this.expansionInProgress) {
      return;
    }

    const textInfo = this.getTextInputInfo(this.currentElement);
    if (!textInfo.isSupported) return;

    const shortcut = this.extractPotentialShortcut(textInfo);
    if (!shortcut) return;

    try {
      const response = await this.browser.runtime.sendMessage({
        type: 'getSnippetByShortcut',
        data: { shortcut }
      });

      if (response.snippet) {
        await this.expandSnippet(response.snippet, textInfo, shortcut);
      }
    } catch (error) {
      log('error', 'Failed to check for expansion:', error);
    }
  }

  private getTextInputInfo(element: HTMLElement): TextInputInfo {
    const tagName = element.tagName.toLowerCase();
    let type: TextInputInfo['type'] = 'other';
    let value = '';
    let selectionStart = 0;
    let selectionEnd = 0;
    let isSupported = false;

    if (tagName === 'input') {
      const input = element as HTMLInputElement;
      type = 'input';
      value = input.value;
      selectionStart = input.selectionStart || 0;
      selectionEnd = input.selectionEnd || 0;
      isSupported = true;
    } else if (tagName === 'textarea') {
      const textarea = element as HTMLTextAreaElement;
      type = 'textarea';
      value = textarea.value;
      selectionStart = textarea.selectionStart || 0;
      selectionEnd = textarea.selectionEnd || 0;
      isSupported = true;
    } else if (element.getAttribute('contenteditable') === 'true') {
      type = 'contenteditable';
      value = element.textContent || '';
      // For contenteditable, we'll use a simpler approach
      selectionStart = value.length;
      selectionEnd = value.length;
      isSupported = true;
    }

    return {
      element,
      type,
      value,
      selectionStart,
      selectionEnd,
      isSupported
    };
  }

  private extractPotentialShortcut(textInfo: TextInputInfo): string | null {
    const { value, selectionStart } = textInfo;

    // Look for word boundaries before cursor
    const textBeforeCursor = value.substring(0, selectionStart);
    const words = textBeforeCursor.split(/\s+/);
    const lastWord = words[words.length - 1];

    // Check if last word could be a shortcut (starts with letter/underscore)
    if (lastWord && /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(lastWord)) {
      return lastWord;
    }

    return null;
  }

  private async expandSnippet(
    snippet: Snippet,
    textInfo: TextInputInfo,
    shortcut: string
  ): Promise<void> {
    if (this.expansionInProgress) return;

    this.expansionInProgress = true;

    try {
      // Create expansion context
      const context: ExpansionContext = {
        element: textInfo.element,
        text: textInfo.value,
        cursorPosition: textInfo.selectionStart,
        shortcut,
        snippet
      };

      // Handle dynamic snippets with variables
      if (snippet.isDynamic && snippet.variables?.length) {
        await this.handleDynamicSnippet(snippet, context);
      } else {
        await this.performTextReplacement(snippet, context, shortcut);
      }

      // Notify background script of expansion
      await this.browser.runtime.sendMessage({
        type: 'expandSnippet',
        data: { snippet, context }
      });

    } catch (error) {
      log('error', 'Failed to expand snippet:', error);
    } finally {
      this.expansionInProgress = false;
    }
  }

  private async performTextReplacement(
    snippet: Snippet,
    context: ExpansionContext,
    shortcut: string
  ): Promise<void> {
    const { element, text, cursorPosition } = context;

    // Find the shortcut position in the text
    const shortcutStart = cursorPosition - shortcut.length;

    if (shortcutStart < 0) return;

    // Replace the shortcut with snippet content
    const newText =
      text.substring(0, shortcutStart) +
      snippet.content +
      text.substring(cursorPosition);

    // Update the element
    setElementText(element, newText);

    // Set cursor position after the inserted content
    const newCursorPosition = shortcutStart + snippet.content.length;
    this.setCursorPosition(element, newCursorPosition);

    // Show notification if enabled
    if (this.settings?.showNotifications) {
      this.showExpansionNotification(snippet);
    }
  }

  private async handleDynamicSnippet(snippet: Snippet, context: ExpansionContext): Promise<void> {
    // For dynamic snippets, we need to show a form to collect variable values
    // This would typically open a modal or popup
    log('info', 'Dynamic snippet expansion not yet implemented');

    // For now, just expand with placeholder values
    await this.performTextReplacement(snippet, context, context.shortcut);
  }

  private setCursorPosition(element: HTMLElement, position: number): void {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'input' || tagName === 'textarea') {
      const input = element as HTMLInputElement | HTMLTextAreaElement;
      input.setSelectionRange(position, position);
      input.focus();
    } else if (element.getAttribute('contenteditable') === 'true') {
      // For contenteditable elements, cursor positioning is more complex
      try {
        const range = document.createRange();
        const selection = window.getSelection();

        if (element.firstChild) {
          range.setStart(element.firstChild, Math.min(position, element.textContent?.length || 0));
          range.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }

        element.focus();
      } catch (error) {
        log('warn', 'Failed to set cursor position in contenteditable:', error);
      }
    }
  }

  private showExpansionNotification(snippet: Snippet): void {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.className = 'openblaze-notification';
    notification.textContent = `Expanded: ${snippet.shortcut} → ${snippet.name}`;

    // Style the notification
    Object.assign(notification.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: '#00ACC0',
      color: 'white',
      padding: '12px 16px',
      borderRadius: '8px',
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      zIndex: '10000',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      opacity: '0',
      transition: 'opacity 0.3s ease'
    });

    document.body.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
    });

    // Remove after delay
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 2000);
  }

  private toggleExpansion(): void {
    this.isEnabled = !this.isEnabled;
    log('info', `Text expansion ${this.isEnabled ? 'enabled' : 'disabled'}`);

    // Show notification
    this.showToggleNotification(this.isEnabled);
  }

  private showToggleNotification(enabled: boolean): void {
    const notification = document.createElement('div');
    notification.textContent = `OpenBlaze ${enabled ? 'Enabled' : 'Disabled'}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${enabled ? '#4caf50' : '#f44336'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-family: Arial, sans-serif;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    document.body.appendChild(notification);

    requestAnimationFrame(() => {
      notification.style.opacity = '1';
    });

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 2000);
  }

  private showSnippetPicker(_data?: any): void {
    // This would show a snippet picker UI
    // For now, just log
    log('info', 'Snippet picker requested');
  }

  private insertSnippet(snippet: Snippet, variables?: Record<string, any>): void {
    if (!this.currentElement) return;

    const textInfo = this.getTextInputInfo(this.currentElement);
    if (!textInfo.isSupported) return;

    // Insert at current cursor position
    const context: ExpansionContext = {
      element: textInfo.element,
      text: textInfo.value,
      cursorPosition: textInfo.selectionStart,
      shortcut: snippet.shortcut,
      snippet,
      variables
    };

    this.performDirectInsertion(snippet, context, variables);
  }

  private async performDirectInsertion(
    snippet: Snippet,
    context: ExpansionContext,
    variables?: Record<string, any>
  ): Promise<void> {
    const { element, text, cursorPosition } = context;
    let content = snippet.content;

    // Replace variables if provided
    if (variables && snippet.variables) {
      for (const variable of snippet.variables) {
        const value = variables[variable.name] || variable.defaultValue || '';
        content = content.replace(new RegExp(`{${variable.name}}`, 'g'), value);
      }
    }

    // Insert content at cursor position
    const newText =
      text.substring(0, cursorPosition) +
      content +
      text.substring(cursorPosition);

    setElementText(element, newText);

    // Set cursor position after inserted content
    const newCursorPosition = cursorPosition + content.length;
    this.setCursorPosition(element, newCursorPosition);

    // Notify background script
    await this.browser.runtime.sendMessage({
      type: 'expandSnippet',
      data: { snippet, context }
    });
  }
}

  // Initialize the content script
  new ContentScript();

})();
