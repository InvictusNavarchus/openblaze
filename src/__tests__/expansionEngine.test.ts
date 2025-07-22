import { ExpansionEngine } from '../engine/ExpansionEngine';
import { Snippet, ExpansionContext } from '../types';

describe('ExpansionEngine', () => {
  let engine: ExpansionEngine;
  let mockSnippets: Snippet[];

  beforeEach(() => {
    engine = ExpansionEngine.getInstance();
    
    mockSnippets = [
      {
        id: '1',
        shortcut: 'hello',
        content: 'Hello, World!',
        name: 'Greeting',
        description: 'Simple greeting',
        isEnabled: true,
        isDynamic: false,
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        variables: []
      },
      {
        id: '2',
        shortcut: 'addr',
        content: '123 Main St\nAnytown, ST 12345',
        name: 'Address',
        description: 'My address',
        isEnabled: true,
        isDynamic: false,
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        variables: []
      },
      {
        id: '3',
        shortcut: 'date',
        content: '{date}',
        name: 'Current Date',
        description: 'Insert current date',
        isEnabled: true,
        isDynamic: true,
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
        variables: []
      }
    ];
  });

  describe('findMatches', () => {
    it('should find exact matches', () => {
      const text = 'Type hello here';
      const matches = engine.findMatches(text, text.length, mockSnippets);
      
      expect(matches).toHaveLength(1);
      expect(matches[0].snippet.shortcut).toBe('hello');
      expect(matches[0].startPosition).toBe(5);
      expect(matches[0].endPosition).toBe(10);
    });

    it('should not find matches for disabled snippets', () => {
      mockSnippets[0].isEnabled = false;
      const text = 'Type hello here';
      const matches = engine.findMatches(text, text.length, mockSnippets);
      
      expect(matches).toHaveLength(0);
    });

    it('should find multiple matches', () => {
      const text = 'hello addr test';
      const matches = engine.findMatches(text, text.length, mockSnippets);
      
      expect(matches).toHaveLength(2);
      expect(matches.map(m => m.snippet.shortcut)).toContain('hello');
      expect(matches.map(m => m.snippet.shortcut)).toContain('addr');
    });

    it('should respect word boundaries', () => {
      const text = 'hellothere';
      const matches = engine.findMatches(text, text.length, mockSnippets);
      
      expect(matches).toHaveLength(0);
    });
  });

  describe('expandSnippet', () => {
    it('should expand static snippets', async () => {
      const snippet = mockSnippets[0]; // hello
      const context: ExpansionContext = {
        element: document.createElement('input'),
        text: 'Say hello now',
        cursorPosition: 9,
        shortcut: 'hello',
        snippet
      };

      const result = await engine.expandSnippet(snippet, context);

      expect(result.success).toBe(true);
      expect(result.expandedText).toBe('Say Hello, World! now');
      expect(result.cursorPosition).toBe(17);
    });

    it('should expand dynamic snippets', async () => {
      const snippet = mockSnippets[2]; // date
      const context: ExpansionContext = {
        element: document.createElement('input'),
        text: 'Today is date',
        cursorPosition: 13,
        shortcut: 'date',
        snippet
      };

      const result = await engine.expandSnippet(snippet, context);

      expect(result.success).toBe(true);
      expect(result.expandedText).toContain('Today is ');
      expect(result.expandedText).not.toContain('{date}');
    });

    it('should handle expansion errors gracefully', async () => {
      const snippet = mockSnippets[0];
      const context: ExpansionContext = {
        element: document.createElement('input'),
        text: 'No match here',
        cursorPosition: 13,
        shortcut: 'hello',
        snippet
      };

      const result = await engine.expandSnippet(snippet, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('extractVariables', () => {
    it('should extract variables from content', () => {
      const content = 'Hello {name}, today is {date}. Your email is {email}.';
      const variables = engine.extractVariables(content);

      expect(variables).toHaveLength(3);
      expect(variables).toContain('name');
      expect(variables).toContain('date');
      expect(variables).toContain('email');
    });

    it('should handle duplicate variables', () => {
      const content = 'Hello {name}, nice to meet you {name}!';
      const variables = engine.extractVariables(content);

      expect(variables).toHaveLength(1);
      expect(variables).toContain('name');
    });

    it('should handle content without variables', () => {
      const content = 'This is just plain text.';
      const variables = engine.extractVariables(content);

      expect(variables).toHaveLength(0);
    });
  });

  describe('validateSnippetContent', () => {
    it('should validate correct content', () => {
      const content = 'Hello {name}, today is {date}.';
      const result = engine.validateSnippetContent(content);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect unmatched braces', () => {
      const content = 'Hello {name, missing closing brace';
      const result = engine.validateSnippetContent(content);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect empty variable names', () => {
      const content = 'Hello {}, empty variable';
      const result = engine.validateSnippetContent(content);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
