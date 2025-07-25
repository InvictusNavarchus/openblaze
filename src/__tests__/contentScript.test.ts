import { createMockInput, simulateInputEvent, simulateKeyboardEvent } from './setup';

// Mock the utils module
jest.mock('../utils', () => ({
  ...jest.requireActual('../utils'),
  log: jest.fn(),
  debounce: jest.fn((fn, delay) => {
    const debouncedFn = (...args: any[]) => {
      clearTimeout(debouncedFn._timeout);
      debouncedFn._timeout = setTimeout(() => fn(...args), delay);
    };
    debouncedFn.cancel = () => {
      clearTimeout(debouncedFn._timeout);
      debouncedFn._timeout = null;
    };
    debouncedFn._timeout = null;
    return debouncedFn;
  })
}));

// Mock the content script module
const mockExpandSnippet = jest.fn();
const mockCheckForExpansion = jest.fn();

// Create a mock ContentScript class for testing
class MockContentScript {
  private expansionInProgress = false;
  private debouncedCheckExpansion: any;
  private settings = { isEnabled: true, showNotifications: true };
  private isEnabled = true;
  private currentElement: HTMLElement | null = null;

  constructor() {
    const { debounce } = require('../utils');
    this.debouncedCheckExpansion = debounce(() => this.checkForExpansion(), 100);
  }

  async expandSnippet(snippet: any, textInfo: any, shortcut: string): Promise<void> {
    if (this.expansionInProgress) {
      return;
    }

    this.expansionInProgress = true;

    try {
      // Simulate text replacement
      await this.performTextReplacement(snippet, textInfo, shortcut);
      
      // Clear expansion flag early after UI updates are complete
      this.expansionInProgress = false;
      this.debouncedCheckExpansion.cancel();

      // Simulate background notification
      await new Promise(resolve => setTimeout(resolve, 10));
    } catch (error) {
      // Error handling
    } finally {
      // Safety net
      if (this.expansionInProgress) {
        this.expansionInProgress = false;
        this.debouncedCheckExpansion.cancel();
      }
    }
  }

  async performTextReplacement(snippet: any, textInfo: any, shortcut: string): Promise<void> {
    // Simulate text replacement
    const element = textInfo.element;
    const newText = textInfo.value.replace(shortcut, snippet.content);
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.value = newText;
    }
    await new Promise(resolve => setTimeout(resolve, 5));
  }

  async checkForExpansion(): Promise<void> {
    mockCheckForExpansion();
    
    if (!this.currentElement || !this.isEnabled || this.expansionInProgress) {
      return;
    }

    // Simulate finding a snippet
    const snippet = { id: '1', name: 'Test', content: 'Test Content', shortcut: 'test' };
    const textInfo = {
      element: this.currentElement,
      value: (this.currentElement as any).value || '',
      selectionStart: 0
    };

    await this.expandSnippet(snippet, textInfo, 'test');
  }

  setCurrentElement(element: HTMLElement): void {
    this.currentElement = element;
  }

  isExpansionInProgress(): boolean {
    return this.expansionInProgress;
  }
}

describe('ContentScript Expansion Flag Management', () => {
  let contentScript: MockContentScript;
  let inputElement: HTMLInputElement;

  beforeEach(() => {
    jest.clearAllMocks();
    contentScript = new MockContentScript();
    inputElement = createMockInput('text', 'test ');
    contentScript.setCurrentElement(inputElement);
  });

  test('expansion flag is cleared early after text replacement', async () => {
    const snippet = { id: '1', name: 'Test', content: 'Test Content', shortcut: 'test' };
    const textInfo = {
      element: inputElement,
      value: 'test ',
      selectionStart: 5
    };

    // Start expansion
    const expansionPromise = contentScript.expandSnippet(snippet, textInfo, 'test');
    
    // Flag should be set initially
    expect(contentScript.isExpansionInProgress()).toBe(true);
    
    // Wait for expansion to complete
    await expansionPromise;
    
    // Flag should be cleared
    expect(contentScript.isExpansionInProgress()).toBe(false);
  });

  test('subsequent expansions work after first expansion completes', async () => {
    const snippet1 = { id: '1', name: 'Test1', content: 'First Content', shortcut: 'test1' };
    const snippet2 = { id: '2', name: 'Test2', content: 'Second Content', shortcut: 'test2' };
    
    const textInfo1 = {
      element: inputElement,
      value: 'test1 ',
      selectionStart: 6
    };
    
    const textInfo2 = {
      element: inputElement,
      value: 'test2 ',
      selectionStart: 6
    };

    // First expansion
    await contentScript.expandSnippet(snippet1, textInfo1, 'test1');
    expect(contentScript.isExpansionInProgress()).toBe(false);

    // Second expansion should work
    await contentScript.expandSnippet(snippet2, textInfo2, 'test2');
    expect(contentScript.isExpansionInProgress()).toBe(false);
  });

  test('expansion is blocked when already in progress', async () => {
    const snippet = { id: '1', name: 'Test', content: 'Test Content', shortcut: 'test' };
    const textInfo = {
      element: inputElement,
      value: 'test ',
      selectionStart: 5
    };

    // Start first expansion (don't await)
    const firstExpansion = contentScript.expandSnippet(snippet, textInfo, 'test');
    
    // Try to start second expansion while first is in progress
    await contentScript.expandSnippet(snippet, textInfo, 'test');
    
    // Wait for first expansion to complete
    await firstExpansion;
    
    // Flag should be cleared
    expect(contentScript.isExpansionInProgress()).toBe(false);
  });

  test('debounced check is cancelled when expansion flag is cleared', async () => {
    const snippet = { id: '1', name: 'Test', content: 'Test Content', shortcut: 'test' };
    const textInfo = {
      element: inputElement,
      value: 'test ',
      selectionStart: 5
    };

    // Mock the cancel method to track if it's called
    const cancelSpy = jest.spyOn(contentScript['debouncedCheckExpansion'], 'cancel');

    await contentScript.expandSnippet(snippet, textInfo, 'test');
    
    // Cancel should have been called when flag was cleared
    expect(cancelSpy).toHaveBeenCalled();
  });
});
