/**
 * @jest-environment jsdom
 */

// Test the global namespace pattern for content scripts
describe('Content Script Global Namespaces', () => {
  beforeEach(() => {
    // Clear any existing global namespaces
    delete window.OpenBlaze_Types;
    delete window.OpenBlaze_Utils;
    delete window.OpenBlaze_FormHandler;
    delete window.OpenBlaze_KeyboardShortcuts;
  });

  describe('OpenBlaze_Types', () => {
    beforeEach(() => {
      // Manually execute the types-global.js content
      eval(require('fs').readFileSync(require('path').join(__dirname, '../../src/content/types-global.js'), 'utf8'));
    });

    test('should expose types namespace to window', () => {
      expect(window.OpenBlaze_Types).toBeDefined();
    });

    test('should have STORAGE_KEYS', () => {
      expect(window.OpenBlaze_Types.STORAGE_KEYS).toBeDefined();
      expect(window.OpenBlaze_Types.STORAGE_KEYS.SNIPPETS).toBe('openblaze_snippets');
      expect(window.OpenBlaze_Types.STORAGE_KEYS.FOLDERS).toBe('openblaze_folders');
      expect(window.OpenBlaze_Types.STORAGE_KEYS.SETTINGS).toBe('openblaze_settings');
      expect(window.OpenBlaze_Types.STORAGE_KEYS.STATS).toBe('openblaze_stats');
    });

    test('should have type checking functions', () => {
      expect(typeof window.OpenBlaze_Types.isSnippet).toBe('function');
      expect(typeof window.OpenBlaze_Types.isSettings).toBe('function');
      expect(typeof window.OpenBlaze_Types.isTextInputInfo).toBe('function');
      expect(typeof window.OpenBlaze_Types.isMessage).toBe('function');
    });

    test('isSnippet should validate snippet objects', () => {
      const validSnippet = {
        id: 'test-id',
        shortcut: 'test',
        content: 'Test content',
        name: 'Test Snippet',
        isEnabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        usageCount: 0,
        isDynamic: false
      };

      const invalidSnippet = {
        id: 'test-id',
        shortcut: 'test'
        // missing required fields
      };

      expect(window.OpenBlaze_Types.isSnippet(validSnippet)).toBe(true);
      expect(window.OpenBlaze_Types.isSnippet(invalidSnippet)).toBe(false);
      expect(window.OpenBlaze_Types.isSnippet(null)).toBe(false);
      expect(window.OpenBlaze_Types.isSnippet(undefined)).toBe(false);
    });
  });

  describe('OpenBlaze_Utils', () => {
    beforeEach(() => {
      // Mock chrome API
      global.chrome = {
        runtime: {
          sendMessage: jest.fn(),
          onMessage: {
            addListener: jest.fn()
          }
        },
        storage: {
          local: {
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn()
          }
        }
      };

      // Manually execute the utils-global.js content
      eval(require('fs').readFileSync(require('path').join(__dirname, '../../src/content/utils-global.js'), 'utf8'));
    });

    afterEach(() => {
      delete global.chrome;
    });

    test('should expose utils namespace to window', () => {
      expect(window.OpenBlaze_Utils).toBeDefined();
    });

    test('should have utility functions', () => {
      expect(typeof window.OpenBlaze_Utils.getBrowser).toBe('function');
      expect(typeof window.OpenBlaze_Utils.generateId).toBe('function');
      expect(typeof window.OpenBlaze_Utils.debounce).toBe('function');
      expect(typeof window.OpenBlaze_Utils.throttle).toBe('function');
      expect(typeof window.OpenBlaze_Utils.log).toBe('function');
      expect(typeof window.OpenBlaze_Utils.isEditableElement).toBe('function');
    });

    test('getBrowser should return chrome API', () => {
      const browser = window.OpenBlaze_Utils.getBrowser();
      expect(browser).toBe(chrome);
    });

    test('generateId should return unique strings', () => {
      const id1 = window.OpenBlaze_Utils.generateId();
      const id2 = window.OpenBlaze_Utils.generateId();
      
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1.length).toBeGreaterThan(0);
    });

    test('debounce should delay function execution', (done) => {
      const mockFn = jest.fn();
      const debouncedFn = window.OpenBlaze_Utils.debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      // Should not be called immediately
      expect(mockFn).not.toHaveBeenCalled();

      setTimeout(() => {
        // Should be called once after delay
        expect(mockFn).toHaveBeenCalledTimes(1);
        done();
      }, 150);
    });

    test('isEditableElement should identify editable elements', () => {
      // Create test elements
      const input = document.createElement('input');
      input.type = 'text';
      
      const textarea = document.createElement('textarea');
      
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      
      const span = document.createElement('span');

      expect(window.OpenBlaze_Utils.isEditableElement(input)).toBe(true);
      expect(window.OpenBlaze_Utils.isEditableElement(textarea)).toBe(true);
      expect(window.OpenBlaze_Utils.isEditableElement(div)).toBe(true);
      expect(window.OpenBlaze_Utils.isEditableElement(span)).toBe(false);
    });

    test('should have DEFAULT_SETTINGS', () => {
      expect(window.OpenBlaze_Utils.DEFAULT_SETTINGS).toBeDefined();
      expect(window.OpenBlaze_Utils.DEFAULT_SETTINGS.isEnabled).toBe(true);
      expect(window.OpenBlaze_Utils.DEFAULT_SETTINGS.expansionDelay).toBe(100);
      expect(window.OpenBlaze_Utils.DEFAULT_SETTINGS.showNotifications).toBe(true);
    });
  });

  describe('Integration Test', () => {
    test('should load all global namespaces in correct order', () => {
      // Load in the same order as manifest.json
      eval(require('fs').readFileSync(require('path').join(__dirname, '../../src/content/types-global.js'), 'utf8'));
      eval(require('fs').readFileSync(require('path').join(__dirname, '../../src/content/utils-global.js'), 'utf8'));
      eval(require('fs').readFileSync(require('path').join(__dirname, '../../src/content/form-handler-global.js'), 'utf8'));
      eval(require('fs').readFileSync(require('path').join(__dirname, '../../src/content/keyboard-shortcuts-global.js'), 'utf8'));

      // All namespaces should be available
      expect(window.OpenBlaze_Types).toBeDefined();
      expect(window.OpenBlaze_Utils).toBeDefined();
      expect(window.OpenBlaze_FormHandler).toBeDefined();
      expect(window.OpenBlaze_KeyboardShortcuts).toBeDefined();

      // Cross-namespace dependencies should work
      expect(typeof window.OpenBlaze_FormHandler.getFormContext).toBe('function');
      expect(typeof window.OpenBlaze_KeyboardShortcuts.initializeKeyboardShortcuts).toBe('function');
    });
  });
});
