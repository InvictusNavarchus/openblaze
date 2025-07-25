import {
  Snippet,
  Settings,
  ExpansionContext,
  TextInputInfo,
  Message
} from '../types';
import {
  getBrowser,
  log,
  isEditableElement,
  getElementText,
  setElementText,
  debounce
} from '../utils';
import { getFormContext } from '../utils/formHandler';
import { initializeKeyboardShortcuts, registerShortcut } from '../utils/keyboardShortcuts';

class ContentScript {
  private browser = getBrowser();
  private settings: Settings | null = null;
  private isEnabled = true;
  private currentElement: HTMLElement | null = null;
  private lastTypedText = '';
  private expansionInProgress = false;
  private debouncedCheckExpansion: () => void;

  constructor() {
    log('debug', 'ContentScript constructor called');
    this.debouncedCheckExpansion = debounce(() => this.checkForExpansion(), 100);
    this.initialize();
    log('debug', 'ContentScript constructor completed');
  }

  private async initialize(): Promise<void> {
    log('debug', 'Starting content script initialization');
    try {
      await this.loadSettings();
      log('debug', 'Settings loaded successfully');

      this.setupEventListeners();
      log('debug', 'Event listeners setup completed');

      this.setupMessageListener();
      log('debug', 'Message listener setup completed');

      this.setupKeyboardShortcuts();
      log('debug', 'Keyboard shortcuts setup completed');

      log('info', 'Content script initialized successfully');
      log('debug', `Current state - isEnabled: ${this.isEnabled}, settings loaded: ${!!this.settings}`);
    } catch (error) {
      log('error', 'Failed to initialize content script:', error);
      log('debug', 'Error details:', { error, stack: error instanceof Error ? error.stack : 'No stack trace' });
    }
  }

  private async loadSettings(): Promise<void> {
    log('debug', 'Loading settings from background script');
    try {
      const response = await this.browser.runtime.sendMessage({
        type: 'getSettings'
      });

      this.settings = response.settings;
      this.isEnabled = this.settings?.isEnabled ?? true;

      log('debug', 'Settings loaded successfully:', {
        isEnabled: this.isEnabled,
        shortcutTrigger: this.settings?.shortcutTrigger,
        showNotifications: this.settings?.showNotifications,
        excludedDomains: this.settings?.excludedDomains?.length || 0
      });
    } catch (error) {
      log('error', 'Failed to load settings:', error);
      log('warn', 'Falling back to default settings - extension will be enabled');
      this.isEnabled = true; // Default to enabled
    }
  }

  private setupEventListeners(): void {
    log('debug', 'Setting up DOM event listeners');

    document.addEventListener('input', this.handleInput.bind(this), true);
    document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
    document.addEventListener('keyup', this.handleKeyUp.bind(this), true);
    document.addEventListener('focus', this.handleFocus.bind(this), true);
    document.addEventListener('blur', this.handleBlur.bind(this), true);

    log('debug', 'All DOM event listeners added successfully');

    // Listen for dynamic content changes
    const observer = new MutationObserver((mutations) => {
      log('debug', `MutationObserver triggered with ${mutations.length} mutations`);
      this.debouncedCheckExpansion();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    log('debug', 'MutationObserver setup completed');
  }

  private setupMessageListener(): void {
    log('debug', 'Setting up runtime message listener');
    this.browser.runtime.onMessage.addListener(
      (message: Message, sender, sendResponse) => {
        log('debug', 'Received runtime message:', {
          type: message.type,
          senderId: sender.id,
          senderTab: sender.tab?.id
        });
        this.handleMessage(message, sendResponse);
        return true; // Keep message channel open for async response
      }
    );
  }

  private setupKeyboardShortcuts(): void {
    log('debug', 'Setting up keyboard shortcuts');

    initializeKeyboardShortcuts();

    // Register content script specific shortcuts
    registerShortcut({
      id: 'toggle-expansion-content',
      keys: ['ctrl', 'shift', 'e'],
      description: 'Toggle text expansion',
      callback: () => {
        log('debug', 'Toggle expansion shortcut triggered');
        this.toggleExpansion();
      },
      enabled: true
    });

    registerShortcut({
      id: 'snippet-picker-content',
      keys: ['ctrl', 'shift', 'space'],
      description: 'Open snippet picker',
      callback: () => {
        log('debug', 'Snippet picker shortcut triggered');
        this.showSnippetPicker();
      },
      enabled: true
    });
    log('debug', 'Keyboard shortcuts setup completed');
  }

  private handleMessage(
    message: Message,
    sendResponse: (response?: any) => void
  ): void {
    log('debug', `Handling message of type: ${message.type}`);

    switch (message.type) {
      case 'toggleExpansion':
        log('info', `Toggle expansion requested - new state: ${message.data.enabled}`);
        this.isEnabled = message.data.enabled;
        sendResponse({ success: true });
        break;

      case 'showSnippetPicker':
        log('info', 'Show snippet picker requested');
        this.showSnippetPicker(message.data);
        sendResponse({ success: true });
        break;

      case 'insertSnippet':
        log('info', `Insert snippet requested: ${message.data.snippet?.shortcut || 'unknown'}`);
        this.insertSnippet(message.data.snippet, message.data.variables);
        sendResponse({ success: true });
        break;

      default:
        log('warn', `Unknown message type received: ${message.type}`);
        sendResponse({ error: 'Unknown message type' });
    }
  }

  private handleInput(event: Event): void {
    if (!this.isEnabled || this.expansionInProgress) {
      return;
    }

    const target = event.target as HTMLElement;

    if (!isEditableElement(target)) {
      return;
    }

    log('debug', 'Processing input on editable element:', target.tagName);
    this.currentElement = target;
    this.lastTypedText = getElementText(target);

    // Check for expansion after a short delay
    this.debouncedCheckExpansion();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    log('trace', 'KeyDown event:', {
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
      target: (event.target as HTMLElement)?.tagName
    });

    if (!this.isEnabled) {
      log('trace', 'KeyDown ignored - expansion disabled');
      return;
    }

    // Handle shortcut trigger keys
    if (this.shouldTriggerExpansion(event)) {
      log('debug', 'Trigger key detected, checking for expansion');
      this.checkForExpansion();
    }

    // Handle Ctrl+Shift+Space for snippet picker
    if (event.ctrlKey && event.shiftKey && event.code === 'Space') {
      log('info', 'Snippet picker shortcut detected (Ctrl+Shift+Space)');
      event.preventDefault();
      this.showSnippetPicker();
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    log('trace', 'KeyUp event:', {
      key: event.key,
      code: event.code,
      target: (event.target as HTMLElement)?.tagName
    });
    // Additional key handling if needed
  }

  private handleFocus(event: Event): void {
    const target = event.target as HTMLElement;
    log('trace', 'Focus event on:', {
      tagName: target.tagName,
      type: (target as HTMLInputElement).type,
      id: target.id,
      className: target.className
    });

    if (isEditableElement(target)) {
      log('debug', 'Focus on editable element - setting as current element');
      this.currentElement = target;
      log('trace', 'Current element updated:', {
        tagName: target.tagName,
        hasValue: !!(target as HTMLInputElement).value,
        hasTextContent: !!target.textContent
      });
    } else {
      log('trace', 'Focus on non-editable element - ignoring');
    }
  }

  private handleBlur(event: Event): void {
    const target = event.target as HTMLElement;
    log('trace', 'Blur event on:', {
      tagName: target.tagName,
      id: target.id,
      isCurrentElement: target === this.currentElement
    });

    // Clear current element when focus is lost
    if (event.target === this.currentElement) {
      log('debug', 'Clearing current element due to blur');
      this.currentElement = null;
    }
  }

  private shouldTriggerExpansion(event: KeyboardEvent): boolean {
    log('trace', 'Checking if key should trigger expansion');

    if (!this.settings) {
      log('trace', 'No settings available - cannot determine trigger');
      return false;
    }

    const triggerKey = this.settings.shortcutTrigger || 'space';
    log('trace', `Configured trigger key: ${triggerKey}, pressed key: ${event.code}`);

    let shouldTrigger = false;
    switch (triggerKey) {
      case 'space':
        shouldTrigger = event.code === 'Space';
        break;
      case 'tab':
        shouldTrigger = event.code === 'Tab';
        break;
      case 'enter':
        shouldTrigger = event.code === 'Enter';
        break;
      default:
        shouldTrigger = event.code === 'Space';
        break;
    }

    log('trace', `Should trigger expansion: ${shouldTrigger}`);
    return shouldTrigger;
  }

  private async checkForExpansion(): Promise<void> {
    log('debug', 'Checking for potential snippet expansion');

    if (!this.currentElement) {
      log('trace', 'No current element - skipping expansion check');
      return;
    }

    if (!this.isEnabled) {
      log('trace', 'Expansion disabled - skipping expansion check');
      return;
    }

    if (this.expansionInProgress) {
      log('trace', 'Expansion already in progress - skipping check');
      return;
    }

    log('trace', 'Getting text input info from current element');
    const textInfo = this.getTextInputInfo(this.currentElement);
    log('trace', 'Text input info:', {
      type: textInfo.type,
      isSupported: textInfo.isSupported,
      valueLength: textInfo.value.length,
      selectionStart: textInfo.selectionStart,
      selectionEnd: textInfo.selectionEnd
    });

    if (!textInfo.isSupported) {
      log('trace', 'Element type not supported for expansion');
      return;
    }

    log('trace', 'Extracting potential shortcut from text');
    const shortcut = this.extractPotentialShortcut(textInfo);
    if (!shortcut) {
      log('trace', 'No potential shortcut found');
      return;
    }

    log('debug', `Potential shortcut detected: "${shortcut}"`);

    try {
      log('trace', 'Sending getSnippetByShortcut message to background');
      const response = await this.browser.runtime.sendMessage({
        type: 'getSnippetByShortcut',
        data: { shortcut }
      });

      log('trace', 'Received snippet lookup response:', {
        hasSnippet: !!response.snippet,
        snippetName: response.snippet?.name
      });

      if (response.snippet) {
        log('info', `Found matching snippet for shortcut "${shortcut}": ${response.snippet.name}`);
        await this.expandSnippet(response.snippet, textInfo, shortcut);
      } else {
        log('trace', `No snippet found for shortcut "${shortcut}"`);
      }
    } catch (error) {
      log('error', 'Failed to check for expansion:', error);
      log('trace', 'Error details:', { error, stack: error instanceof Error ? error.stack : 'No stack trace' });
    }
  }

  private getTextInputInfo(element: HTMLElement): TextInputInfo {
    log('trace', 'Getting text input info for element:', element.tagName);

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
      log('trace', 'Input element info:', {
        inputType: input.type,
        valueLength: value.length,
        selectionStart,
        selectionEnd
      });
    } else if (tagName === 'textarea') {
      const textarea = element as HTMLTextAreaElement;
      type = 'textarea';
      value = textarea.value;
      selectionStart = textarea.selectionStart || 0;
      selectionEnd = textarea.selectionEnd || 0;
      isSupported = true;
      log('trace', 'Textarea element info:', {
        valueLength: value.length,
        selectionStart,
        selectionEnd,
        rows: textarea.rows,
        cols: textarea.cols
      });
    } else if (element.getAttribute('contenteditable') === 'true') {
      type = 'contenteditable';
      value = element.textContent || '';
      // For contenteditable, we'll use a simpler approach
      selectionStart = value.length;
      selectionEnd = value.length;
      isSupported = true;
      log('trace', 'Contenteditable element info:', {
        textContentLength: value.length,
        innerHTML: element.innerHTML.slice(0, 100) // First 100 chars
      });
    } else {
      log('trace', 'Unsupported element type:', tagName);
    }

    const textInfo = {
      element,
      type,
      value,
      selectionStart,
      selectionEnd,
      isSupported
    };

    log('trace', 'Text input info result:', textInfo);
    return textInfo;
  }

  private extractPotentialShortcut(textInfo: TextInputInfo): string | null {
    log('trace', 'Extracting potential shortcut from text input');

    const { value, selectionStart } = textInfo;
    log('trace', 'Text analysis:', {
      totalLength: value.length,
      cursorPosition: selectionStart,
      textBeforeCursor: value.substring(0, selectionStart).slice(-20) // Last 20 chars
    });

    // Look for word boundaries before cursor
    const textBeforeCursor = value.substring(0, selectionStart);
    const words = textBeforeCursor.split(/\s+/);
    const lastWord = words[words.length - 1];

    log('trace', 'Word analysis:', {
      totalWords: words.length,
      lastWord: lastWord,
      lastWordLength: lastWord?.length || 0
    });

    // Check if last word could be a shortcut (starts with letter/underscore)
    if (lastWord && /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(lastWord)) {
      log('debug', `Valid shortcut pattern found: "${lastWord}"`);
      return lastWord;
    }

    log('trace', 'No valid shortcut pattern found');
    return null;
  }

  private async expandSnippet(
    snippet: Snippet,
    textInfo: TextInputInfo,
    shortcut: string
  ): Promise<void> {
    log('info', `Starting snippet expansion: "${shortcut}" -> "${snippet.name}"`);

    if (this.expansionInProgress) {
      log('warn', 'Expansion already in progress - aborting');
      return;
    }

    log('debug', 'Setting expansion in progress flag');
    this.expansionInProgress = true;

    try {
      log('trace', 'Creating expansion context');
      // Create expansion context
      const context: ExpansionContext = {
        element: textInfo.element,
        text: textInfo.value,
        cursorPosition: textInfo.selectionStart,
        shortcut,
        snippet
      };

      log('trace', 'Expansion context:', {
        elementTag: context.element.tagName,
        textLength: context.text.length,
        cursorPosition: context.cursorPosition,
        shortcut: context.shortcut,
        snippetId: context.snippet.id,
        snippetName: context.snippet.name
      });

      // Handle dynamic snippets with variables
      if (snippet.isDynamic && snippet.variables?.length) {
        log('debug', `Handling dynamic snippet with ${snippet.variables.length} variables`);
        await this.handleDynamicSnippet(snippet, context);
      } else {
        log('debug', 'Handling static snippet expansion');
        await this.performTextReplacement(snippet, context, shortcut);
      }

      log('trace', 'Notifying background script of expansion');
      // Notify background script of expansion
      await this.browser.runtime.sendMessage({
        type: 'expandSnippet',
        data: { snippet, context }
      });
      log('debug', 'Background script notified successfully');

    } catch (error) {
      log('error', 'Failed to expand snippet:', error);
      log('trace', 'Expansion error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        snippet: snippet.name,
        shortcut
      });
    } finally {
      log('debug', 'Clearing expansion in progress flag');
      this.expansionInProgress = false;
      log('info', `Snippet expansion completed: "${shortcut}"`);
    }
  }

  private async performTextReplacement(
    snippet: Snippet,
    context: ExpansionContext,
    shortcut: string
  ): Promise<void> {
    log('debug', 'Performing text replacement');

    const { element, text, cursorPosition } = context;
    log('trace', 'Replacement context:', {
      textLength: text.length,
      cursorPosition,
      shortcutLength: shortcut.length,
      snippetContentLength: snippet.content.length
    });

    // Find the shortcut position in the text
    const shortcutStart = cursorPosition - shortcut.length;
    log('trace', `Shortcut position: ${shortcutStart} to ${cursorPosition}`);

    if (shortcutStart < 0) {
      log('warn', 'Invalid shortcut position - aborting replacement');
      return;
    }

    // Replace the shortcut with snippet content
    const textBefore = text.substring(0, shortcutStart);
    const textAfter = text.substring(cursorPosition);
    const newText = textBefore + snippet.content + textAfter;

    log('trace', 'Text replacement details:', {
      originalLength: text.length,
      newLength: newText.length,
      textBeforeLength: textBefore.length,
      textAfterLength: textAfter.length,
      insertedContentLength: snippet.content.length
    });

    log('debug', 'Updating element text');
    // Update the element
    setElementText(element, newText);

    // Set cursor position after the inserted content
    const newCursorPosition = shortcutStart + snippet.content.length;
    log('trace', `Setting cursor position to: ${newCursorPosition}`);
    this.setCursorPosition(element, newCursorPosition);

    // Show notification if enabled
    if (this.settings?.showNotifications) {
      log('debug', 'Showing expansion notification');
      this.showExpansionNotification(snippet);
    } else {
      log('trace', 'Notifications disabled - skipping notification');
    }

    log('info', `Text replacement completed: "${shortcut}" -> "${snippet.content.slice(0, 50)}${snippet.content.length > 50 ? '...' : ''}"`);
  }

  private async handleDynamicSnippet(snippet: Snippet, context: ExpansionContext): Promise<void> {
    log('debug', `Handling dynamic snippet: ${snippet.name}`);
    log('trace', 'Dynamic snippet variables:', snippet.variables);

    // For dynamic snippets, we need to show a form to collect variable values
    // This would typically open a modal or popup
    log('warn', 'Dynamic snippet expansion not yet implemented - using placeholder expansion');
    log('trace', 'Variables that would be collected:', snippet.variables?.map(v => ({
      name: v.name,
      type: v.type,
      defaultValue: v.defaultValue,
      required: v.required
    })));

    // For now, just expand with placeholder values
    log('debug', 'Falling back to static expansion for dynamic snippet');
    await this.performTextReplacement(snippet, context, context.shortcut);
  }

  private setCursorPosition(element: HTMLElement, position: number): void {
    log('debug', `Setting cursor position to: ${position}`);

    const tagName = element.tagName.toLowerCase();
    log('trace', 'Cursor positioning for element:', {
      tagName,
      isInput: tagName === 'input',
      isTextarea: tagName === 'textarea',
      isContentEditable: element.getAttribute('contenteditable') === 'true'
    });

    if (tagName === 'input' || tagName === 'textarea') {
      const input = element as HTMLInputElement | HTMLTextAreaElement;
      log('trace', 'Setting selection range for input/textarea');
      input.setSelectionRange(position, position);
      input.focus();
      log('debug', 'Cursor position set successfully for input/textarea');
    } else if (element.getAttribute('contenteditable') === 'true') {
      log('trace', 'Setting cursor position for contenteditable element');
      // For contenteditable elements, cursor positioning is more complex
      try {
        const range = document.createRange();
        const selection = window.getSelection();
        const maxPosition = element.textContent?.length || 0;
        const safePosition = Math.min(position, maxPosition);

        log('trace', 'Contenteditable cursor details:', {
          requestedPosition: position,
          maxPosition,
          safePosition,
          hasFirstChild: !!element.firstChild
        });

        if (element.firstChild) {
          range.setStart(element.firstChild, safePosition);
          range.collapse(true);
          selection?.removeAllRanges();
          selection?.addRange(range);
          log('debug', 'Cursor position set successfully for contenteditable');
        } else {
          log('warn', 'No first child found in contenteditable element');
        }

        element.focus();
      } catch (error) {
        log('warn', 'Failed to set cursor position in contenteditable:', error);
        log('trace', 'Cursor positioning error details:', { error, position, element: element.tagName });
      }
    } else {
      log('warn', 'Unsupported element type for cursor positioning:', tagName);
    }
  }

  private showExpansionNotification(snippet: Snippet): void {
    log('debug', `Showing expansion notification for: ${snippet.name}`);

    // Create a simple notification
    const notification = document.createElement('div');
    notification.className = 'openblaze-notification';
    notification.textContent = `Expanded: ${snippet.shortcut} → ${snippet.name}`;

    log('trace', 'Created notification element:', {
      className: notification.className,
      textContent: notification.textContent
    });

    // Style the notification
    const styles = {
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
    };

    Object.assign(notification.style, styles);
    log('trace', 'Applied notification styles');

    log('trace', 'Appending notification to document body');
    document.body.appendChild(notification);

    // Animate in
    log('trace', 'Starting notification fade-in animation');
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
      log('trace', 'Notification fade-in animation started');
    });

    // Remove after delay
    log('trace', 'Scheduling notification removal in 2000ms');
    setTimeout(() => {
      log('trace', 'Starting notification fade-out');
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          log('trace', 'Removing notification from DOM');
          notification.parentNode.removeChild(notification);
          log('debug', 'Expansion notification removed');
        }
      }, 300);
    }, 2000);
  }

  private toggleExpansion(): void {
    const previousState = this.isEnabled;
    this.isEnabled = !this.isEnabled;

    log('info', `Text expansion toggled: ${previousState ? 'enabled' : 'disabled'} -> ${this.isEnabled ? 'enabled' : 'disabled'}`);
    log('debug', 'Current expansion state:', {
      isEnabled: this.isEnabled,
      hasSettings: !!this.settings,
      hasCurrentElement: !!this.currentElement,
      expansionInProgress: this.expansionInProgress
    });

    // Show notification
    log('debug', 'Showing toggle notification');
    this.showToggleNotification(this.isEnabled);
  }

  private showToggleNotification(enabled: boolean): void {
    log('debug', `Showing toggle notification - enabled: ${enabled}`);

    const notification = document.createElement('div');
    notification.textContent = `OpenBlaze ${enabled ? 'Enabled' : 'Disabled'}`;

    const backgroundColor = enabled ? '#4caf50' : '#f44336';
    log('trace', 'Toggle notification styling:', {
      text: notification.textContent,
      backgroundColor,
      enabled
    });

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${backgroundColor};
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

    log('trace', 'Appending toggle notification to document body');
    document.body.appendChild(notification);

    log('trace', 'Starting toggle notification fade-in');
    requestAnimationFrame(() => {
      notification.style.opacity = '1';
    });

    log('trace', 'Scheduling toggle notification removal');
    setTimeout(() => {
      log('trace', 'Starting toggle notification fade-out');
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          log('trace', 'Removing toggle notification from DOM');
          notification.parentNode.removeChild(notification);
          log('debug', 'Toggle notification removed');
        }
      }, 300);
    }, 2000);
  }

  private showSnippetPicker(data?: any): void {
    log('info', 'Snippet picker requested');
    log('trace', 'Snippet picker data:', data);
    log('debug', 'Current state for snippet picker:', {
      isEnabled: this.isEnabled,
      hasCurrentElement: !!this.currentElement,
      currentElementTag: this.currentElement?.tagName,
      expansionInProgress: this.expansionInProgress
    });

    // This would show a snippet picker UI
    // For now, just log
    log('warn', 'Snippet picker UI not yet implemented');

    // TODO: Implement snippet picker UI
    // - Show modal/popup with snippet list
    // - Allow search/filtering
    // - Handle selection and insertion
  }

  private insertSnippet(snippet: Snippet, variables?: Record<string, any>): void {
    log('info', `Inserting snippet directly: ${snippet.name}`);
    log('trace', 'Insert snippet details:', {
      snippetId: snippet.id,
      snippetName: snippet.name,
      snippetShortcut: snippet.shortcut,
      hasVariables: !!variables,
      variableCount: variables ? Object.keys(variables).length : 0
    });

    if (!this.currentElement) {
      log('warn', 'No current element - cannot insert snippet');
      return;
    }

    log('debug', 'Getting text info for current element');
    const textInfo = this.getTextInputInfo(this.currentElement);
    if (!textInfo.isSupported) {
      log('warn', 'Current element not supported for snippet insertion');
      return;
    }

    log('debug', 'Creating insertion context');
    // Insert at current cursor position
    const context: ExpansionContext = {
      element: textInfo.element,
      text: textInfo.value,
      cursorPosition: textInfo.selectionStart,
      shortcut: snippet.shortcut,
      snippet,
      variables
    };

    log('trace', 'Insertion context:', {
      elementTag: context.element.tagName,
      textLength: context.text.length,
      cursorPosition: context.cursorPosition,
      hasVariables: !!context.variables
    });

    log('debug', 'Performing direct snippet insertion');
    this.performDirectInsertion(snippet, context, variables);
  }

  private async performDirectInsertion(
    snippet: Snippet,
    context: ExpansionContext,
    variables?: Record<string, any>
  ): Promise<void> {
    log('debug', 'Performing direct snippet insertion');

    const { element, text, cursorPosition } = context;
    let content = snippet.content;

    log('trace', 'Direct insertion details:', {
      originalContent: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
      contentLength: content.length,
      cursorPosition,
      hasVariables: !!(variables && snippet.variables)
    });

    // Replace variables if provided
    if (variables && snippet.variables) {
      log('debug', `Processing ${snippet.variables.length} variables`);
      for (const variable of snippet.variables) {
        const value = variables[variable.name] || variable.defaultValue || '';
        const regex = new RegExp(`{${variable.name}}`, 'g');
        const beforeReplace = content;
        content = content.replace(regex, value);

        log('trace', 'Variable replacement:', {
          variableName: variable.name,
          value,
          replacementsMade: beforeReplace !== content
        });
      }
      log('debug', 'Variable processing completed');
    }

    log('trace', 'Constructing new text');
    // Insert content at cursor position
    const textBefore = text.substring(0, cursorPosition);
    const textAfter = text.substring(cursorPosition);
    const newText = textBefore + content + textAfter;

    log('trace', 'Text construction details:', {
      originalLength: text.length,
      newLength: newText.length,
      insertedLength: content.length,
      textBeforeLength: textBefore.length,
      textAfterLength: textAfter.length
    });

    log('debug', 'Updating element with new text');
    setElementText(element, newText);

    // Set cursor position after inserted content
    const newCursorPosition = cursorPosition + content.length;
    log('debug', `Setting cursor to position: ${newCursorPosition}`);
    this.setCursorPosition(element, newCursorPosition);

    log('trace', 'Notifying background script of direct insertion');
    // Notify background script
    try {
      await this.browser.runtime.sendMessage({
        type: 'expandSnippet',
        data: { snippet, context }
      });
      log('debug', 'Background script notified successfully');
    } catch (error) {
      log('error', 'Failed to notify background script:', error);
    }

    log('info', `Direct insertion completed: ${snippet.name}`);
  }
}

// Initialize the content script
log('info', 'Starting OpenBlaze content script initialization');
log('debug', 'Environment details:', {
  url: window.location.href,
  domain: window.location.hostname,
  userAgent: navigator.userAgent.slice(0, 100),
  timestamp: new Date().toISOString()
});

try {
  new ContentScript();
  log('info', 'OpenBlaze content script instance created successfully');
} catch (error) {
  log('error', 'Failed to create content script instance:', error);
  log('trace', 'Initialization error details:', {
    error,
    stack: error instanceof Error ? error.stack : 'No stack trace'
  });
}
