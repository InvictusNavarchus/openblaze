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
import { performSmartTextInsertion } from '../utils/clipboard';

class ContentScript {
  private browser = getBrowser();
  private settings: Settings | null = null;
  private isEnabled = true;
  private currentElement: HTMLElement | null = null;
  private lastTypedText = '';
  private expansionInProgress = false;
  private debouncedCheckExpansion: {
    (): void;
    cancel(): void;
  };

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
      if (this.expansionInProgress) {
        log('trace', 'Input event ignored - expansion in progress');
      }
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
    
    // Add null checks to prevent undefined errors
    if (!target) {
      log('trace', 'Focus event - no target element');
      return;
    }
    
    log('trace', 'Focus event on:', {
      tagName: target.tagName || 'undefined',
      type: (target as HTMLInputElement).type || 'undefined',
      id: target.id || 'undefined',
      className: target.className || 'undefined'
    });

    if (isEditableElement(target)) {
      log('debug', 'Focus on editable element - setting as current element');
      this.currentElement = target;
      log('trace', 'Current element updated:', {
        tagName: target.tagName || 'undefined',
        hasValue: !!(target as HTMLInputElement).value,
        hasTextContent: !!target.textContent
      });
    } else {
      log('trace', 'Focus on non-editable element - ignoring');
    }
  }

  private handleBlur(event: Event): void {
    const target = event.target as HTMLElement;
    
    // Add null checks to prevent undefined errors
    if (!target) {
      log('trace', 'Blur event - no target element');
      return;
    }
    
    log('trace', 'Blur event on:', {
      tagName: target.tagName || 'undefined',
      id: target.id || 'undefined',
      isCurrentElement: target === this.currentElement
    });

    // Clear current element when focus is lost
    if (event.target === this.currentElement) {
      log('debug', 'Clearing current element due to blur');
      this.currentElement = null;
    }
  }

  /**
   * Determine if an element has complex DOM structure that requires smart insertion
   * This detects elements where direct text manipulation might not work properly
   */
  private hasComplexDOMStructure(element: HTMLElement): boolean {
    log('trace', 'Analyzing DOM structure complexity');

    // Check if it's a contenteditable element
    if (element.getAttribute('contenteditable') === 'true') {
      log('trace', 'Contenteditable element detected - checking internal structure');
      
      // Look for complex internal structure
      const hasComplexChildren = this.hasComplexChildStructure(element);
      
      if (hasComplexChildren) {
        log('debug', 'Complex contenteditable structure detected - will use smart insertion');
        return true;
      }
    }

    // Check if element has rich text editor characteristics
    if (this.isRichTextEditor(element)) {
      log('debug', 'Rich text editor detected - will use smart insertion');
      return true;
    }

    // Check for framework-specific patterns (React, Vue, etc.)
    if (this.hasFrameworkSpecificPatterns(element)) {
      log('debug', 'Framework-specific patterns detected - will use smart insertion');
      return true;
    }

    log('trace', 'Simple DOM structure detected - will use direct text manipulation');
    return false;
  }

  /**
   * Check if element has complex child structure with multiple text nodes
   */
  private hasComplexChildStructure(element: HTMLElement): boolean {
    const childElements = element.querySelectorAll('p, span, div, br');
    const textNodes = this.getTextNodes(element);
    
    log('trace', 'DOM structure analysis:', {
      childElements: childElements.length,
      textNodes: textNodes.length,
      hasMultipleChildren: childElements.length > 0,
      hasMultipleTextNodes: textNodes.length > 1
    });

    // Consider it complex if there are multiple formatting elements or text nodes
    return childElements.length > 0 || textNodes.length > 1;
  }

  /**
   * Get all text nodes within an element
   */
  private getTextNodes(element: HTMLElement): Text[] {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.textContent?.trim()) { // Only count non-empty text nodes
        textNodes.push(node as Text);
      }
    }

    return textNodes;
  }

  /**
   * Detect if element is part of a rich text editor
   */
  private isRichTextEditor(element: HTMLElement): boolean {
    // Check for common rich text editor class names and attributes
    const richTextIndicators = [
      'ql-editor', // Quill
      'DraftEditor-root', // Draft.js
      'tox-edit-area', // TinyMCE
      'cke_editable', // CKEditor
      'fr-element', // Froala
      'note-editable', // Summernote
      'ace_editor', // ACE Editor
      'CodeMirror', // CodeMirror
      'ProseMirror' // ProseMirror
    ];

    const className = element.className || '';
    const hasRichTextClass = richTextIndicators.some(indicator => 
      className.includes(indicator)
    );

    // Check parent elements too
    let parent = element.parentElement;
    let parentHasRichTextClass = false;
    let depth = 0;
    while (parent && depth < 5) { // Check up to 5 levels up
      const parentClassName = parent.className || '';
      if (richTextIndicators.some(indicator => parentClassName.includes(indicator))) {
        parentHasRichTextClass = true;
        break;
      }
      parent = parent.parentElement;
      depth++;
    }

    log('trace', 'Rich text editor detection:', {
      hasRichTextClass,
      parentHasRichTextClass,
      className: className.slice(0, 100), // First 100 chars
      isProseMirror: className.includes('ProseMirror')
    });

    return hasRichTextClass || parentHasRichTextClass;
  }

  /**
   * Check if element is a ProseMirror editor specifically
   */
  private isProseMirrorEditor(element: HTMLElement): boolean {
    const className = element.className || '';
    const isProseMirror = className.includes('ProseMirror');
    
    // Also check parent elements
    let parent = element.parentElement;
    let parentIsProseMirror = false;
    let depth = 0;
    while (parent && depth < 3) {
      const parentClassName = parent.className || '';
      if (parentClassName.includes('ProseMirror')) {
        parentIsProseMirror = true;
        break;
      }
      parent = parent.parentElement;
      depth++;
    }
    
    return isProseMirror || parentIsProseMirror;
  }

  /**
   * Check if element is a Quill editor specifically
   */
  private isQuillEditor(element: HTMLElement): boolean {
    const className = element.className || '';
    const isQuill = className.includes('ql-editor');
    
    // Also check parent elements for Quill container classes
    let parent = element.parentElement;
    let parentIsQuill = false;
    let depth = 0;
    while (parent && depth < 3) {
      const parentClassName = parent.className || '';
      if (parentClassName.includes('ql-container') || parentClassName.includes('ql-bubble') || parentClassName.includes('ql-snow')) {
        parentIsQuill = true;
        break;
      }
      parent = parent.parentElement;
      depth++;
    }
    
    log('trace', 'Quill editor detection:', {
      isQuill,
      parentIsQuill,
      className: className.slice(0, 100),
      hasQuillEditor: className.includes('ql-editor')
    });
    
    return isQuill || parentIsQuill;
  }

  /**
   * Detect framework-specific patterns that might interfere with text manipulation
   */
  private hasFrameworkSpecificPatterns(element: HTMLElement): boolean {
    // Check for React/Vue data attributes
    const hasReactAttributes = Object.keys(element.dataset).some(key => 
      key.startsWith('react') || key.startsWith('vue')
    );

    // Check for Angular attributes
    const hasAngularAttributes = Array.from(element.attributes).some(attr => 
      attr.name.startsWith('ng-') || attr.name.startsWith('data-ng-')
    );

    // Check for shadow DOM
    const hasShadowDOM = element.shadowRoot !== null;

    log('trace', 'Framework pattern detection:', {
      hasReactAttributes,
      hasAngularAttributes,
      hasShadowDOM
    });

    return hasReactAttributes || hasAngularAttributes || hasShadowDOM;
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
      log('trace', 'Expansion already in progress - skipping check', {
        timestamp: Date.now(),
        currentElement: this.currentElement?.tagName,
        lastTypedText: this.lastTypedText.slice(-20)
      });
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
    log('trace', 'Getting text input info for element:', element?.tagName || 'undefined');

    if (!element || !element.tagName) {
      log('warn', 'getTextInputInfo called with invalid element');
      return {
        element: element,
        type: 'other',
        value: '',
        selectionStart: 0,
        selectionEnd: 0,
        isSupported: false
      };
    }

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

    const { value, selectionStart, element } = textInfo;
    log('trace', 'Text analysis:', {
      totalLength: value.length,
      cursorPosition: selectionStart,
      textBeforeCursor: value.substring(0, selectionStart).slice(-20) // Last 20 chars
    });

    // For complex DOM structures, try to get text more intelligently
    if (this.hasComplexDOMStructure(element)) {
      log('debug', 'Using complex DOM shortcut extraction');
      return this.extractShortcutFromComplexDOM(element);
    }

    // Standard extraction for simple elements
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

  /**
   * Extract shortcut from complex DOM structures by analyzing text nodes and cursor position
   */
  private extractShortcutFromComplexDOM(element: HTMLElement): string | null {
    log('trace', 'Extracting shortcut from complex DOM structure');

    try {
      // Get current selection/cursor position
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        log('trace', 'No selection available in complex DOM');
        return null;
      }

      const range = selection.getRangeAt(0);
      const cursorNode = range.startContainer;
      const cursorOffset = range.startOffset;

      log('trace', 'Cursor position in complex DOM:', {
        nodeType: cursorNode.nodeType,
        nodeValue: cursorNode.nodeValue?.slice(-20), // Last 20 chars
        offset: cursorOffset
      });

      // If cursor is in a text node, extract text before cursor
      if (cursorNode.nodeType === Node.TEXT_NODE) {
        const textContent = cursorNode.textContent || '';
        const textBeforeCursor = textContent.substring(0, cursorOffset);
        
        // Find the last word before cursor
        const words = textBeforeCursor.split(/\s+/);
        const lastWord = words[words.length - 1];

        log('trace', 'Complex DOM word analysis:', {
          textBeforeCursor: textBeforeCursor.slice(-20),
          lastWord,
          wordCount: words.length
        });

        if (lastWord && /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(lastWord)) {
          log('debug', `Valid shortcut found in complex DOM: "${lastWord}"`);
          return lastWord;
        }
      } else if (cursorNode.nodeType === Node.ELEMENT_NODE) {
        // Cursor is at element boundary, check text content
        const textContent = cursorNode.textContent || '';
        const words = textContent.trim().split(/\s+/);
        const lastWord = words[words.length - 1];

        log('trace', 'Element node shortcut analysis:', {
          textContent: textContent.slice(-30),
          lastWord
        });

        if (lastWord && /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(lastWord)) {
          log('debug', `Valid shortcut found in element node: "${lastWord}"`);
          return lastWord;
        }
      }

    } catch (error) {
      log('warn', 'Failed to extract shortcut from complex DOM:', error);
    }

    log('trace', 'No valid shortcut found in complex DOM');
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

    // Additional check: verify the shortcut is still present and hasn't been modified
    const currentText = textInfo.element.textContent || '';
    if (!currentText.includes(shortcut)) {
      log('warn', `Shortcut "${shortcut}" no longer found in element - aborting expansion`);
      return;
    }

    log('debug', 'Setting expansion in progress flag', {
      timestamp: Date.now(),
      shortcut,
      snippetName: snippet.name
    });
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

      // Clear expansion flag early after UI updates are complete
      log('debug', 'Text replacement/cursor update done, clearing flag early', {
        timestamp: Date.now(),
        shortcut,
        snippetName: snippet.name
      });
      this.expansionInProgress = false;
      this.debouncedCheckExpansion.cancel();
      log('trace', 'Expansion flag cleared and pending checks cancelled');

      log('trace', 'Notifying background script of expansion');
      // Notify background script of expansion - serialize context to avoid DOM element cloning issues
      const serializableContext = {
        elementTag: context.element.tagName,
        elementId: context.element.id,
        elementClass: context.element.className,
        text: context.text,
        cursorPosition: context.cursorPosition,
        shortcut: context.shortcut,
        variables: context.variables
      };
      
      await this.browser.runtime.sendMessage({
        type: 'expandSnippet',
        data: { snippet, context: serializableContext }
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
      // Safety net - ensure flag is cleared even if early clearing failed
      if (this.expansionInProgress) {
        log('warn', 'Expansion flag still set in finally block, clearing now');
        this.expansionInProgress = false;
        this.debouncedCheckExpansion.cancel();
      }
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

    // Check if we should use smart clipboard insertion
    const useSmartInsertion = this.hasComplexDOMStructure(element);
    
    if (useSmartInsertion) {
      log('debug', 'Using smart clipboard-based insertion for complex DOM');
      await this.performSmartReplacement(snippet, context, shortcut);
    } else {
      log('debug', 'Using direct text manipulation for simple DOM');
      await this.performDirectReplacement(snippet, context, shortcut);
    }

    // Show notification if enabled
    if (this.settings?.showNotifications) {
      log('debug', 'Showing expansion notification');
      this.showExpansionNotification(snippet);
    } else {
      log('trace', 'Notifications disabled - skipping notification');
    }

    log('info', `Text replacement completed: "${shortcut}" -> "${snippet.content.slice(0, 50)}${snippet.content.length > 50 ? '...' : ''}"`);
  }

  /**
   * Perform robust replacement using multiple fallback strategies for all complex DOM structures
   * This unified approach works better across all platforms and editors
   */
  private async performSmartReplacement(
    snippet: Snippet,
    context: ExpansionContext,
    shortcut: string
  ): Promise<void> {
    log('debug', 'Performing robust multi-strategy replacement for complex DOM');

    const { element } = context;

    // Double-check that expansion is still in progress and element is still valid
    if (!this.expansionInProgress) {
      log('warn', 'Expansion no longer in progress, aborting smart replacement');
      return;
    }

    if (!element || !element.isConnected) {
      log('warn', 'Target element is no longer valid, aborting smart replacement');
      return;
    }

    try {
      // Step 1: Select the shortcut text to be replaced
      await this.selectShortcutInComplexDOM(element, shortcut);
      
      // Step 2: Try multiple approaches for content insertion with fallbacks
      let success = false;
      
      // Approach 1: Try modern input events (works for most editors)
      success = await this.tryModernInputEvents(element, snippet.content);
      
      if (!success) {
        log('debug', 'Modern input events failed, trying enhanced clipboard approach');
        // Approach 2: Enhanced clipboard approach with proper HTML structure
        success = await this.tryEnhancedClipboardInsertion(element, snippet.content);
      }
      
      if (!success) {
        log('debug', 'Clipboard approach failed, trying persistent DOM manipulation');
        // Approach 3: Direct DOM manipulation with persistence and retries
        await this.tryPersistentDOMReplacement(element, snippet.content, shortcut);
      }

    } catch (error) {
      log('error', 'All smart replacement strategies failed:', error);
      log('debug', 'Falling back to direct replacement as last resort');
      await this.performDirectReplacement(snippet, context, shortcut);
    }
  }

  /**
   * Try modern input events compatible with rich text editors
   */
  private async tryModernInputEvents(element: HTMLElement, content: string): Promise<boolean> {
    log('debug', 'Trying modern input events for text replacement');

    try {
      // Try beforeinput events first (more modern approach)
      let success = await this.tryBeforeInputEvents(element, content);
      
      if (!success) {
        log('debug', 'beforeinput events failed, trying regular input events');
        success = await this.tryRegularInputEvents(element, content);
      }

      return success;

    } catch (error) {
      log('warn', 'Modern input events failed:', error);
      return false;
    }
  }

  /**
   * Try beforeinput events (more modern, better support for rich text editors)
   */
  private async tryBeforeInputEvents(element: HTMLElement, content: string): Promise<boolean> {
    log('trace', 'Attempting beforeinput events approach');

    try {
      // First delete the selected text with a beforeinput event
      const deleteEvent = new InputEvent('beforeinput', {
        inputType: 'deleteContentBackward',
        bubbles: true,
        cancelable: true
      });
      
      const deleteResult = element.dispatchEvent(deleteEvent);
      log('trace', `Delete beforeinput result: ${deleteResult}`);
      
      // Only proceed with insertion if deletion was handled
      if (!deleteResult) {
        log('trace', 'Delete beforeinput was cancelled/not handled');
        return false;
      }
      
      // Small delay for processing
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Then insert the new content
      const insertEvent = new InputEvent('beforeinput', {
        inputType: 'insertText',
        data: content,
        bubbles: true,
        cancelable: true
      });
      
      const insertResult = element.dispatchEvent(insertEvent);
      log('trace', `Insert beforeinput result: ${insertResult}`);
      
      // If the beforeinput was not handled properly, return false
      if (!insertResult) {
        log('trace', 'Insert beforeinput was cancelled/not handled');
        return false;
      }

      // Clear any text selection to prevent interference
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
      
      // Wait for editor to process changes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return this.verifyContentReplacement(element, content);

    } catch (error) {
      log('trace', 'beforeinput events failed:', error);
      return false;
    }
  }

  /**
   * Try regular input events (fallback approach)
   */
  private async tryRegularInputEvents(element: HTMLElement, content: string): Promise<boolean> {
    log('trace', 'Attempting regular input events approach');

    try {
      // Dispatch only a single input event
      const inputEvent = new InputEvent('input', {
        inputType: 'insertText',
        data: content,
        bubbles: true,
        cancelable: true
      });
      
      const result = element.dispatchEvent(inputEvent);
      log('trace', `Regular input event result: ${result}`);

      // Clear any text selection to prevent interference
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
      
      // Wait for editor to process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return this.verifyContentReplacement(element, content);

    } catch (error) {
      log('trace', 'Regular input events failed:', error);
      return false;
    }
  }

  /**
   * Verify that content was replaced correctly
   */
  private verifyContentReplacement(element: HTMLElement, expectedContent: string): boolean {
    const currentContent = element.textContent || '';
    const cleanExpectedContent = expectedContent.replace(/\n/g, '');
    
    // Check if content was inserted
    const hasExpectedContent = currentContent.includes(cleanExpectedContent);
    
    log('debug', `Content verification: ${hasExpectedContent}`, {
      expectedContent: cleanExpectedContent.slice(0, 50),
      actualContent: currentContent.slice(0, 100),
      hasExpectedContent
    });
    
    return hasExpectedContent;
  }

  /**
   * Try enhanced clipboard insertion with proper HTML structure
   */
  private async tryEnhancedClipboardInsertion(element: HTMLElement, content: string): Promise<boolean> {
    log('debug', 'Trying enhanced clipboard insertion');

    try {
      // Create proper HTML structure based on content
      const lines = content.split('\n');
      let htmlContent: string;
      
      // Detect if this is a rich text editor that uses specific markup
      if (this.isProseMirrorEditor(element)) {
        // ProseMirror expects paragraph structure
        htmlContent = lines.map(line => 
          line.trim() ? `<p>${line}</p>` : '<p><br></p>'
        ).join('');
      } else if (element.className.includes('CodeMirror')) {
        // CodeMirror prefers simple line breaks
        htmlContent = content.replace(/\n/g, '<br>');
      } else {
        // Generic rich text editor - use div structure
        htmlContent = lines.map(line => 
          line.trim() ? `<div>${line}</div>` : '<div><br></div>'
        ).join('');
      }
      
      // Create DataTransfer with both plain text and HTML
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', content);
      clipboardData.setData('text/html', htmlContent);
      
      // Dispatch paste event
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: clipboardData
      });

      const pasteResult = element.dispatchEvent(pasteEvent);
      log('trace', `Enhanced paste result: ${pasteResult}`);

      // Clear any text selection to prevent interference
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }

      // Wait for editor to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify content was inserted correctly
      const currentContent = element.textContent || '';
      const contentLines = content.split('\n').filter(line => line.trim());
      
      // Check if all expected lines are present
      const hasAllExpectedContent = contentLines.every(line => 
        currentContent.includes(line.trim())
      );

      log('debug', `Enhanced clipboard insertion - Content check: ${hasAllExpectedContent}`, {
        hasAllExpectedContent,
        currentContentLength: currentContent.length,
        expectedLines: contentLines.length
      });
      
      return hasAllExpectedContent;

    } catch (error) {
      log('warn', 'Enhanced clipboard insertion failed:', error);
      return false;
    }
  }

  /**
   * Try persistent DOM replacement with retries and exponential backoff
   */
  private async tryPersistentDOMReplacement(
    element: HTMLElement, 
    content: string, 
    shortcut: string
  ): Promise<void> {
    log('debug', 'Trying persistent DOM replacement with retries');

    // Cancel any pending expansion checks to avoid interference
    this.debouncedCheckExpansion.cancel();

    // Special handling for Quill editors (like Gemini)
    if (this.isQuillEditor(element)) {
      log('debug', 'Detected Quill editor - using specialized approach');
      return this.tryQuillEditorReplacement(element, content, shortcut);
    }

    const lines = content.split('\n');
    const maxAttempts = 5;
    let attempt = 0;

    const attemptReplacement = async (): Promise<boolean> => {
      attempt++;
      log('trace', `DOM replacement attempt ${attempt}/${maxAttempts}`);

      try {
        // Determine the best DOM structure for this editor
        let newContent: string;
        
        if (this.isProseMirrorEditor(element)) {
          // ProseMirror structure
          if (lines.length > 1) {
            const paragraphs = lines.map(line => {
              const p = document.createElement('p');
              if (line.trim()) {
                p.textContent = line;
              } else {
                p.appendChild(document.createElement('br'));
              }
              return p.outerHTML;
            }).join('');
            newContent = paragraphs;
          } else {
            newContent = `<p>${content}</p>`;
          }
        } else if (element.className.includes('CodeMirror')) {
          // CodeMirror structure
          newContent = content.replace(/\n/g, '<br>');
        } else if (element.getAttribute('contenteditable') === 'true') {
          // Generic contenteditable
          if (lines.length > 1) {
            newContent = lines.map(line => 
              line.trim() ? `<div>${line}</div>` : '<div><br></div>'
            ).join('');
          } else {
            newContent = content;
          }
        } else {
          // Fallback to simple text
          newContent = content;
        }

        // Apply the content
        element.innerHTML = newContent;

        // Set cursor position after the content
        this.setCursorPosition(element, content.length);

        // Trigger change events to notify the editor
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        // Wait a bit and verify the content persists
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const currentContent = element.textContent || '';
        const hasExpectedContent = content.split('\n').every(line => 
          !line.trim() || currentContent.includes(line.trim())
        );

        log('trace', `Attempt ${attempt} - Content persisted: ${hasExpectedContent}`, {
          expected: content.slice(0, 50),
          actual: currentContent.slice(0, 50)
        });

        return hasExpectedContent;

      } catch (error) {
        log('warn', `DOM replacement attempt ${attempt} failed:`, error);
        return false;
      }
    };

    // Try multiple times with increasing delays
    for (let i = 0; i < maxAttempts; i++) {
      const success = await attemptReplacement();
      if (success) {
        log('info', `Persistent DOM replacement succeeded on attempt ${i + 1}`);
        return;
      }
      
      // Wait before next attempt, with exponential backoff
      if (i < maxAttempts - 1) {
        const delay = Math.min(50 * Math.pow(2, i), 500);
        log('trace', `Waiting ${delay}ms before next attempt`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    log('warn', 'All persistent DOM replacement attempts failed');
  }

  /**
   * Specialized replacement for Quill editors (like Gemini)
   * Quill editors are very aggressive about controlling content and need special handling
   */
  private async tryQuillEditorReplacement(
    element: HTMLElement,
    content: string,
    shortcut: string
  ): Promise<void> {
    log('debug', 'Using specialized Quill editor replacement strategy');

    try {
      // Step 1: Try to access Quill instance directly
      const quillInstance = this.getQuillInstance(element);
      if (quillInstance) {
        log('debug', 'Found Quill instance - using API-based replacement');
        return this.replaceUsingQuillAPI(quillInstance, content, shortcut);
      }

      // Step 2: Use selection-based replacement with Quill-specific timing
      log('debug', 'No Quill instance found - using selection-based approach');
      await this.replaceUsingQuillSelection(element, content, shortcut);

    } catch (error) {
      log('error', 'Quill editor replacement failed:', error);
      // Fallback to standard DOM replacement
      log('debug', 'Falling back to standard DOM replacement');
      await this.tryStandardDOMReplacement(element, content, shortcut);
    }
  }

  /**
   * Try to get the Quill instance from the element or its parents
   */
  private getQuillInstance(element: HTMLElement): any {
    log('trace', 'Searching for Quill instance');

    // Check if the element has a __quill property
    if ((element as any).__quill) {
      log('debug', 'Found Quill instance on element itself');
      return (element as any).__quill;
    }

    // Check parent elements for Quill instance
    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 5) {
      if ((parent as any).__quill) {
        log('debug', `Found Quill instance on parent at depth ${depth}`);
        return (parent as any).__quill;
      }
      parent = parent.parentElement;
      depth++;
    }

    // Try to find Quill in the global scope or common patterns
    if (typeof (window as any).Quill !== 'undefined') {
      log('trace', 'Quill constructor available globally');
      // Look for Quill instances in common locations
      const containers = document.querySelectorAll('.ql-container, .ql-editor');
      for (const container of Array.from(containers)) {
        if (container.contains(element) && (container as any).__quill) {
          log('debug', 'Found Quill instance in container');
          return (container as any).__quill;
        }
      }
    }

    log('trace', 'No Quill instance found');
    return null;
  }

  /**
   * Replace text using Quill API directly
   */
  private async replaceUsingQuillAPI(
    quill: any,
    content: string,
    shortcut: string
  ): Promise<void> {
    log('debug', 'Replacing text using Quill API');

    try {
      // Get current text and find shortcut position
      const currentText = quill.getText();
      const shortcutIndex = currentText.lastIndexOf(shortcut);
      
      if (shortcutIndex === -1) {
        log('warn', 'Shortcut not found in Quill text');
        return;
      }

      log('trace', 'Quill API replacement details:', {
        currentTextLength: currentText.length,
        shortcutIndex,
        shortcutLength: shortcut.length,
        contentLength: content.length
      });

      // Delete the shortcut text
      quill.deleteText(shortcutIndex, shortcut.length);
      
      // Insert the new content
      quill.insertText(shortcutIndex, content);
      
      // Set cursor position after the inserted content
      const newPosition = shortcutIndex + content.length;
      quill.setSelection(newPosition, 0);

      log('info', 'Quill API replacement completed successfully');

    } catch (error) {
      log('error', 'Quill API replacement failed:', error);
      throw error;
    }
  }

  /**
   * Replace text using selection-based approach optimized for Quill
   */
  private async replaceUsingQuillSelection(
    element: HTMLElement,
    content: string,
    shortcut: string
  ): Promise<void> {
    log('debug', 'Using Quill-optimized selection replacement');

    try {
      // First, ensure we have proper selection of the shortcut
      await this.selectShortcutInQuillEditor(element, shortcut);
      
      // Wait a bit for Quill to process the selection
      await new Promise(resolve => setTimeout(resolve, 50));

      // Try multiple approaches in sequence
      let success = false;

      // Approach 1: Use document.execCommand (still works in some cases)
      if (!success && document.queryCommandSupported('insertText')) {
        log('trace', 'Trying execCommand insertText');
        success = document.execCommand('insertText', false, content);
        log('trace', `execCommand result: ${success}`);
        
        if (success) {
          await new Promise(resolve => setTimeout(resolve, 100));
          success = this.verifyContentReplacement(element, content);
        }
      }

      // Approach 2: Use composition events (works well with modern editors)
      if (!success) {
        log('trace', 'Trying composition events');
        success = await this.tryCompositionEvents(element, content);
      }

      // Approach 3: Use keyboard simulation
      if (!success) {
        log('trace', 'Trying keyboard simulation');
        success = await this.tryKeyboardSimulation(element, content);
      }

      if (!success) {
        throw new Error('All Quill selection methods failed');
      }

      log('info', 'Quill selection replacement completed successfully');

    } catch (error) {
      log('error', 'Quill selection replacement failed:', error);
      throw error;
    }
  }

  /**
   * Select shortcut text specifically in Quill editors
   */
  private async selectShortcutInQuillEditor(element: HTMLElement, shortcut: string): Promise<void> {
    log('debug', 'Selecting shortcut in Quill editor');

    const selection = window.getSelection();
    if (!selection) {
      throw new Error('No selection API available');
    }

    // Clear any existing selection
    selection.removeAllRanges();

    // Find the text content and shortcut position
    const textContent = element.textContent || '';
    const shortcutIndex = textContent.lastIndexOf(shortcut);
    
    if (shortcutIndex === -1) {
      throw new Error('Shortcut not found in element text');
    }

    log('trace', 'Quill shortcut selection:', {
      textContent: textContent.slice(0, 100),
      shortcutIndex,
      shortcut
    });

    // Create range and select the shortcut text
    const range = document.createRange();
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentOffset = 0;
    let textNode: Text | null = null;
    let nodeStartOffset = 0;

    // Find the text node containing the shortcut
    let node;
    while (node = walker.nextNode()) {
      const nodeText = node.textContent || '';
      if (currentOffset <= shortcutIndex && currentOffset + nodeText.length > shortcutIndex) {
        textNode = node as Text;
        nodeStartOffset = shortcutIndex - currentOffset;
        break;
      }
      currentOffset += nodeText.length;
    }

    if (!textNode) {
      throw new Error('Could not find text node containing shortcut');
    }

    // Set the range to select the shortcut
    range.setStart(textNode, nodeStartOffset);
    range.setEnd(textNode, nodeStartOffset + shortcut.length);
    selection.addRange(range);

    log('trace', 'Shortcut selected in Quill editor');
  }

  /**
   * Try composition events for text replacement
   */
  private async tryCompositionEvents(element: HTMLElement, content: string): Promise<boolean> {
    log('trace', 'Attempting composition events');

    try {
      // Start composition
      element.dispatchEvent(new CompositionEvent('compositionstart', {
        bubbles: true,
        cancelable: true,
        data: ''
      }));

      // Update composition
      element.dispatchEvent(new CompositionEvent('compositionupdate', {
        bubbles: true,
        cancelable: true,
        data: content
      }));

      // End composition
      element.dispatchEvent(new CompositionEvent('compositionend', {
        bubbles: true,
        cancelable: true,
        data: content
      }));

      // Also dispatch input event
      element.dispatchEvent(new InputEvent('input', {
        inputType: 'insertCompositionText',
        data: content,
        bubbles: true,
        cancelable: true
      }));

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      return this.verifyContentReplacement(element, content);

    } catch (error) {
      log('trace', 'Composition events failed:', error);
      return false;
    }
  }

  /**
   * Try keyboard simulation for text replacement
   */
  private async tryKeyboardSimulation(element: HTMLElement, content: string): Promise<boolean> {
    log('trace', 'Attempting keyboard simulation');

    try {
      // Focus the element
      element.focus();
      
      // Simulate typing each character
      for (let i = 0; i < content.length; i++) {
        const char = content[i];
        
        // Dispatch keydown
        element.dispatchEvent(new KeyboardEvent('keydown', {
          key: char,
          bubbles: true,
          cancelable: true
        }));

        // Dispatch keypress
        element.dispatchEvent(new KeyboardEvent('keypress', {
          key: char,
          bubbles: true,
          cancelable: true
        }));

        // Dispatch input
        element.dispatchEvent(new InputEvent('input', {
          inputType: 'insertText',
          data: char,
          bubbles: true,
          cancelable: true
        }));

        // Dispatch keyup
        element.dispatchEvent(new KeyboardEvent('keyup', {
          key: char,
          bubbles: true,
          cancelable: true
        }));

        // Small delay between characters
        if (i < content.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      return this.verifyContentReplacement(element, content);

    } catch (error) {
      log('trace', 'Keyboard simulation failed:', error);
      return false;
    }
  }

  /**
   * Fallback to standard DOM replacement
   */
  private async tryStandardDOMReplacement(
    element: HTMLElement,
    content: string,
    shortcut: string
  ): Promise<void> {
    log('debug', 'Using standard DOM replacement as fallback');

    const lines = content.split('\n');
    const maxAttempts = 3; // Fewer attempts for fallback
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      log('trace', `Standard DOM replacement attempt ${attempt}/${maxAttempts}`);

      try {
        // For Quill editors, we need to maintain proper paragraph structure
        let newContent: string;
        if (lines.length > 1) {
          newContent = lines.map(line => 
            line.trim() ? `<p>${line}</p>` : '<p><br></p>'
          ).join('');
        } else {
          newContent = `<p>${content}</p>`;
        }

        // Apply the content
        element.innerHTML = newContent;

        // Trigger events
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        // Set cursor position
        this.setCursorPosition(element, content.length);

        // Wait and verify
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const currentText = element.textContent || '';
        const hasExpectedContent = content.split('\n').every(line => 
          !line.trim() || currentText.includes(line.trim())
        );

        if (hasExpectedContent) {
          log('info', `Standard DOM replacement succeeded on attempt ${attempt}`);
          return;
        }

        log('trace', `Attempt ${attempt} failed - content not persisted`);

      } catch (error) {
        log('warn', `Standard DOM replacement attempt ${attempt} failed:`, error);
      }

      // Wait before next attempt
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }

    log('warn', 'All standard DOM replacement attempts failed');
  }

  /**
   * Select the shortcut text in complex DOM structures
   */
  private async selectShortcutInComplexDOM(element: HTMLElement, shortcut: string): Promise<void> {
    log('debug', `Selecting shortcut "${shortcut}" in complex DOM`);

    try {
      const selection = window.getSelection();
      if (!selection) {
        throw new Error('No selection API available');
      }

      // Clear any existing selection first
      selection.removeAllRanges();

      // Find the shortcut text and select it
      const range = document.createRange();
      const textNodes = this.getTextNodes(element);
      
      log('trace', `Searching for shortcut in ${textNodes.length} text nodes`);

      // Search from the end to find the most recent occurrence
      for (let i = textNodes.length - 1; i >= 0; i--) {
        const textNode = textNodes[i];
        const textContent = textNode.textContent || '';
        const shortcutIndex = textContent.lastIndexOf(shortcut);
        
        if (shortcutIndex !== -1) {
          // Verify this is the shortcut we want by checking word boundaries
          const beforeChar = shortcutIndex > 0 ? textContent[shortcutIndex - 1] : ' ';
          const afterChar = shortcutIndex + shortcut.length < textContent.length 
            ? textContent[shortcutIndex + shortcut.length] 
            : ' ';
          
          const isAtWordBoundary = /\s/.test(beforeChar) || /\s/.test(afterChar) || shortcutIndex === 0;
          
          if (isAtWordBoundary) {
            log('debug', `Found shortcut in text node at index ${shortcutIndex}`);
            
            // Select exactly the shortcut text
            range.setStart(textNode, shortcutIndex);
            range.setEnd(textNode, shortcutIndex + shortcut.length);
            
            selection.addRange(range);
            
            // Verify the selection was made correctly
            const selectedText = selection.toString();
            if (selectedText === shortcut) {
              log('trace', 'Shortcut text selected successfully');
              return;
            } else {
              log('warn', `Selection mismatch: expected "${shortcut}", got "${selectedText}"`);
              selection.removeAllRanges();
            }
          }
        }
      }

      log('warn', 'Could not find shortcut text to select in complex DOM');
      
    } catch (error) {
      log('error', 'Failed to select shortcut in complex DOM:', error);
      throw error;
    }
  }

  /**
   * Perform direct text replacement for simple DOM structures
   */
  private async performDirectReplacement(
    snippet: Snippet,
    context: ExpansionContext,
    shortcut: string
  ): Promise<void> {
    log('debug', 'Performing direct text replacement');

    const { element, text, cursorPosition } = context;

    // Find the shortcut position in the text
    const shortcutStart = cursorPosition - shortcut.length;
    log('trace', `Shortcut position: ${shortcutStart} to ${cursorPosition}`);

    if (shortcutStart < 0) {
      log('warn', 'Invalid shortcut position - aborting replacement');
      return;
    }

    // For rich text editors, try a more robust approach
    if (this.isRichTextEditor(element)) {
      log('debug', 'Using enhanced direct replacement for rich text editor');
      await this.performEnhancedDirectReplacement(element, snippet.content, shortcut, shortcutStart);
    } else {
      // Standard direct replacement for simple elements
      await this.performStandardDirectReplacement(element, text, cursorPosition, snippet.content, shortcut, shortcutStart);
    }
  }

  /**
   * Enhanced direct replacement for rich text editors that might override content
   */
  private async performEnhancedDirectReplacement(
    element: HTMLElement,
    content: string,
    shortcut: string,
    shortcutStart: number
  ): Promise<void> {
    log('debug', 'Performing enhanced direct replacement for rich text editor');

    try {
      // Step 1: Select the shortcut text precisely
      await this.selectShortcutInComplexDOM(element, shortcut);

      // Step 2: Use multiple strategies to ensure content sticks
      
      // Strategy A: Input event with proper timing
      const inputSuccess = await this.tryInputEventReplacement(element, content);
      
      if (inputSuccess) {
        log('debug', 'Input event replacement successful');
        return;
      }

      // Strategy B: Direct DOM manipulation with mutation observer handling
      log('debug', 'Input event failed, trying DOM manipulation with persistence');
      await this.tryPersistentDOMReplacement(element, content, shortcut);

    } catch (error) {
      log('error', 'Enhanced direct replacement failed:', error);
      
      // Final fallback to standard replacement
      const currentText = element.textContent || '';
      const currentCursor = currentText.length;
      await this.performStandardDirectReplacement(element, currentText, currentCursor, content, shortcut, shortcutStart);
    }
  }

  /**
   * Try using input events to replace content naturally
   */
  private async tryInputEventReplacement(element: HTMLElement, content: string): Promise<boolean> {
    log('trace', 'Attempting input event replacement');

    try {
      // Create input event that should be handled by the editor
      const inputEvent = new InputEvent('input', {
        inputType: 'insertText',
        data: content,
        bubbles: true,
        cancelable: true
      });

      // Dispatch the event
      const eventResult = element.dispatchEvent(inputEvent);
      
      // Give the editor time to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check if the content was actually inserted
      const currentContent = element.textContent || element.innerText || '';
      const contentFound = currentContent.includes(content.substring(0, Math.min(20, content.length)));

      log('trace', `Input event replacement result: ${eventResult}, content found: ${contentFound}`);
      
      return eventResult && contentFound;

    } catch (error) {
      log('trace', 'Input event replacement failed:', error);
      return false;
    }
  }

  /**
   * Standard direct replacement for simple elements
   */
  private async performStandardDirectReplacement(
    element: HTMLElement,
    text: string,
    cursorPosition: number,
    content: string,
    shortcut: string,
    shortcutStart: number
  ): Promise<void> {
    log('trace', 'Performing standard direct replacement');

    // Replace the shortcut with snippet content
    const textBefore = text.substring(0, shortcutStart);
    const textAfter = text.substring(cursorPosition);
    const newText = textBefore + content + textAfter;

    log('trace', 'Text replacement details:', {
      originalLength: text.length,
      newLength: newText.length,
      textBeforeLength: textBefore.length,
      textAfterLength: textAfter.length,
      insertedContentLength: content.length
    });

    log('debug', 'Updating element text');
    // Update the element
    setElementText(element, newText);

    // Set cursor position after the inserted content
    const newCursorPosition = shortcutStart + content.length;
    log('trace', `Setting cursor position to: ${newCursorPosition}`);
    this.setCursorPosition(element, newCursorPosition);
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

    if (!element || !element.tagName) {
      log('warn', 'setCursorPosition called with invalid element');
      return;
    }

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
      try {
        input.setSelectionRange(position, position);
        input.focus();
        log('debug', 'Cursor position set successfully for input/textarea');
      } catch (error) {
        log('warn', 'Failed to set cursor position for input/textarea:', error);
      }
    } else if (element.getAttribute('contenteditable') === 'true') {
      log('trace', 'Setting cursor position for contenteditable element');
      // For contenteditable elements, cursor positioning is more complex
      try {
        const range = document.createRange();
        const selection = window.getSelection();
        
        // Get the actual current text content length after the text has been updated
        const currentTextLength = element.textContent?.length || 0;
        const safePosition = Math.min(position, currentTextLength);

        log('trace', 'Contenteditable cursor details:', {
          requestedPosition: position,
          currentTextLength,
          safePosition,
          hasTextContent: !!element.textContent,
          hasChildNodes: element.childNodes.length > 0
        });

        // Try to find a text node to position the cursor
        let targetNode = null;
        let targetOffset = safePosition;

        if (element.childNodes.length > 0) {
          // Walk through child nodes to find the right text node
          let currentOffset = 0;
          for (let i = 0; i < element.childNodes.length; i++) {
            const child = element.childNodes[i];
            if (child.nodeType === Node.TEXT_NODE) {
              const textLength = child.textContent?.length || 0;
              if (currentOffset + textLength >= safePosition) {
                targetNode = child;
                targetOffset = safePosition - currentOffset;
                break;
              }
              currentOffset += textLength;
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              const textLength = child.textContent?.length || 0;
              if (currentOffset + textLength >= safePosition) {
                // For complex elements, just position at the start of this element
                targetNode = child.firstChild || child;
                targetOffset = 0;
                break;
              }
              currentOffset += textLength;
            }
          }
        }

        if (targetNode && selection) {
          range.setStart(targetNode, Math.min(targetOffset, targetNode.textContent?.length || 0));
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          log('debug', 'Cursor position set successfully for contenteditable');
        } else {
          // Fallback: place cursor at the end
          log('debug', 'Using fallback positioning - placing cursor at end of element');
          range.selectNodeContents(element);
          range.collapse(false);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }

        element.focus();
      } catch (error) {
        log('warn', 'Failed to set cursor position in contenteditable:', error);
        log('trace', 'Cursor positioning error details:', { error, position, element: element.tagName });
        
        // Final fallback - just focus the element
        try {
          element.focus();
        } catch (focusError) {
          log('warn', 'Failed to focus element:', focusError);
        }
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
        const placeholder = `{{${variable.name}}}`;
        content = content.replace(new RegExp(placeholder, 'g'), value);
        log('trace', `Replaced variable ${variable.name}: ${placeholder} -> ${value.slice(0, 50)}`);
      }
      log('debug', 'Variable processing completed');
    }

    // Check if we should use smart insertion
    const useSmartInsertion = this.hasComplexDOMStructure(element);
    
    if (useSmartInsertion) {
      log('debug', 'Using smart clipboard insertion for direct insertion');
      
      const insertionSuccess = await performSmartTextInsertion(element, content, true);
      
      if (!insertionSuccess) {
        log('warn', 'Smart insertion failed, falling back to direct text manipulation');
        await this.performDirectTextInsertion(element, text, cursorPosition, content);
      }
    } else {
      log('debug', 'Using direct text manipulation for insertion');
      await this.performDirectTextInsertion(element, text, cursorPosition, content);
    }

    log('trace', 'Notifying background script of direct insertion');
    // Notify background script - serialize context to avoid DOM element cloning issues
    try {
      const serializableContext = {
        elementTag: context.element.tagName,
        elementId: context.element.id,
        elementClass: context.element.className,
        text: context.text,
        cursorPosition: context.cursorPosition,
        shortcut: context.shortcut,
        variables: context.variables
      };
      
      await this.browser.runtime.sendMessage({
        type: 'expandSnippet',
        data: { snippet, context: serializableContext }
      });
      log('debug', 'Background script notified successfully');
    } catch (error) {
      log('error', 'Failed to notify background script:', error);
    }

    log('info', `Direct insertion completed: ${snippet.name}`);
  }

  /**
   * Perform direct text insertion for simple elements
   */
  private async performDirectTextInsertion(
    element: HTMLElement,
    text: string,
    cursorPosition: number,
    content: string
  ): Promise<void> {
    log('trace', 'Constructing new text for direct insertion');
    
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
