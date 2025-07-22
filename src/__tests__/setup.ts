// Jest setup file for OpenBlaze tests

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    getURL: jest.fn((path: string) => `chrome-extension://test/${path}`),
    id: 'test-extension-id'
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    onUpdated: {
      addListener: jest.fn()
    }
  },
  action: {
    onClicked: {
      addListener: jest.fn()
    },
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn()
  },
  contextMenus: {
    create: jest.fn(),
    onClicked: {
      addListener: jest.fn()
    },
    removeAll: jest.fn()
  },
  commands: {
    onCommand: {
      addListener: jest.fn()
    }
  },
  permissions: {
    contains: jest.fn(),
    request: jest.fn()
  }
};

// Make chrome available globally
(global as any).chrome = mockChrome;

// Mock browser for Firefox compatibility
(global as any).browser = mockChrome;

// Mock DOM APIs that might not be available in jsdom
Object.defineProperty(window, 'getSelection', {
  value: jest.fn(() => ({
    removeAllRanges: jest.fn(),
    addRange: jest.fn()
  }))
});

Object.defineProperty(document, 'createRange', {
  value: jest.fn(() => ({
    setStart: jest.fn(),
    collapse: jest.fn()
  }))
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    readText: jest.fn(),
    writeText: jest.fn()
  },
  writable: true
});

// Mock console methods to avoid noise in tests
const originalConsole = console;
beforeEach(() => {
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
});

afterEach(() => {
  global.console = originalConsole;
  jest.clearAllMocks();
});

// Helper function to create mock HTML elements
export function createMockElement(tagName: string, attributes: Record<string, string> = {}): HTMLElement {
  const element = document.createElement(tagName);
  
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  
  return element;
}

// Helper function to create mock input element
export function createMockInput(type = 'text', value = ''): HTMLInputElement {
  const input = document.createElement('input') as HTMLInputElement;
  input.type = type;
  input.value = value;
  
  // Mock selection methods
  input.setSelectionRange = jest.fn();
  input.select = jest.fn();
  
  return input;
}

// Helper function to create mock textarea
export function createMockTextarea(value = ''): HTMLTextAreaElement {
  const textarea = document.createElement('textarea') as HTMLTextAreaElement;
  textarea.value = value;
  
  // Mock selection methods
  textarea.setSelectionRange = jest.fn();
  textarea.select = jest.fn();
  
  return textarea;
}

// Helper function to simulate keyboard events
export function simulateKeyboardEvent(
  element: HTMLElement, 
  type: 'keydown' | 'keyup' | 'keypress',
  options: Partial<KeyboardEventInit> = {}
): void {
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    ...options
  });
  
  element.dispatchEvent(event);
}

// Helper function to simulate input events
export function simulateInputEvent(element: HTMLElement, value: string): void {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value = value;
  } else {
    element.textContent = value;
  }
  
  const event = new Event('input', { bubbles: true });
  element.dispatchEvent(event);
}

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock URL constructor
global.URL.createObjectURL = jest.fn();
global.URL.revokeObjectURL = jest.fn();
