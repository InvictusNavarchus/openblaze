import { 
  Snippet, 
  ExpansionContext, 
  TextInputInfo, 
  SnippetVariable 
} from '../types';
import { log, escapeRegExp } from '../utils';

export interface ExpansionMatch {
  snippet: Snippet;
  startPosition: number;
  endPosition: number;
  matchedText: string;
}

export interface ExpansionResult {
  success: boolean;
  expandedText: string;
  cursorPosition: number;
  variables?: Record<string, any>;
  error?: string;
}

export class ExpansionEngine {
  private static instance: ExpansionEngine;

  static getInstance(): ExpansionEngine {
    if (!ExpansionEngine.instance) {
      ExpansionEngine.instance = new ExpansionEngine();
    }
    return ExpansionEngine.instance;
  }

  /**
   * Find potential snippet matches in the given text
   */
  findMatches(text: string, cursorPosition: number, snippets: Snippet[]): ExpansionMatch[] {
    const matches: ExpansionMatch[] = [];
    
    // Get text before cursor
    const textBeforeCursor = text.substring(0, cursorPosition);
    
    for (const snippet of snippets) {
      if (!snippet.isEnabled) continue;
      
      const match = this.findSnippetMatch(textBeforeCursor, snippet);
      if (match) {
        matches.push({
          snippet,
          startPosition: match.startPosition,
          endPosition: match.endPosition,
          matchedText: match.matchedText
        });
      }
    }
    
    // Sort by position (closest to cursor first) and then by shortcut length (longer first)
    return matches.sort((a, b) => {
      const positionDiff = b.startPosition - a.startPosition;
      if (positionDiff !== 0) return positionDiff;
      return b.snippet.shortcut.length - a.snippet.shortcut.length;
    });
  }

  /**
   * Find a specific snippet match in text
   */
  private findSnippetMatch(text: string, snippet: Snippet): { startPosition: number; endPosition: number; matchedText: string } | null {
    const shortcut = snippet.shortcut.toLowerCase();
    const lowerText = text.toLowerCase();
    
    // Find the last occurrence of the shortcut
    let lastIndex = -1;
    let searchIndex = 0;
    
    while (true) {
      const index = lowerText.indexOf(shortcut, searchIndex);
      if (index === -1) break;
      
      // Check if this is a word boundary match
      if (this.isValidShortcutMatch(text, index, shortcut.length)) {
        lastIndex = index;
      }
      
      searchIndex = index + 1;
    }
    
    if (lastIndex === -1) return null;
    
    return {
      startPosition: lastIndex,
      endPosition: lastIndex + shortcut.length,
      matchedText: text.substring(lastIndex, lastIndex + shortcut.length)
    };
  }

  /**
   * Check if a shortcut match is valid (respects word boundaries)
   */
  private isValidShortcutMatch(text: string, position: number, length: number): boolean {
    // Check character before shortcut
    if (position > 0) {
      const charBefore = text[position - 1];
      // Must be whitespace or punctuation
      if (!/[\s\n\r\t.,;:!?()[\]{}"'`~@#$%^&*+=|\\/<>-]/.test(charBefore)) {
        return false;
      }
    }
    
    // Check character after shortcut
    const endPosition = position + length;
    if (endPosition < text.length) {
      const charAfter = text[endPosition];
      // Must be whitespace, punctuation, or end of text
      if (!/[\s\n\r\t.,;:!?()[\]{}"'`~@#$%^&*+=|\\/<>-]/.test(charAfter)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Expand a snippet with the given context
   */
  async expandSnippet(
    snippet: Snippet, 
    context: ExpansionContext, 
    variables?: Record<string, any>
  ): Promise<ExpansionResult> {
    try {
      // Handle dynamic snippets
      if (snippet.isDynamic && snippet.variables?.length) {
        return await this.expandDynamicSnippet(snippet, context, variables);
      }
      
      // Handle static snippets
      return this.expandStaticSnippet(snippet, context);
      
    } catch (error) {
      log('error', 'Failed to expand snippet:', error);
      return {
        success: false,
        expandedText: context.text,
        cursorPosition: context.cursorPosition,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Expand a static snippet
   */
  private expandStaticSnippet(snippet: Snippet, context: ExpansionContext): ExpansionResult {
    const { text, cursorPosition } = context;
    
    // Find the shortcut in the text
    const matches = this.findMatches(text, cursorPosition, [snippet]);
    if (matches.length === 0) {
      return {
        success: false,
        expandedText: text,
        cursorPosition,
        error: 'Shortcut not found'
      };
    }
    
    const match = matches[0];
    let content = snippet.content;
    
    // Process built-in variables
    content = this.processBuiltInVariables(content);
    
    // Replace the shortcut with the content
    const newText = 
      text.substring(0, match.startPosition) + 
      content + 
      text.substring(match.endPosition);
    
    const newCursorPosition = match.startPosition + content.length;
    
    return {
      success: true,
      expandedText: newText,
      cursorPosition: newCursorPosition
    };
  }

  /**
   * Expand a dynamic snippet with variables
   */
  private async expandDynamicSnippet(
    snippet: Snippet, 
    context: ExpansionContext, 
    variables?: Record<string, any>
  ): Promise<ExpansionResult> {
    const { text, cursorPosition } = context;
    
    // Find the shortcut in the text
    const matches = this.findMatches(text, cursorPosition, [snippet]);
    if (matches.length === 0) {
      return {
        success: false,
        expandedText: text,
        cursorPosition,
        error: 'Shortcut not found'
      };
    }
    
    const match = matches[0];
    let content = snippet.content;
    
    // Process variables
    if (variables && snippet.variables) {
      content = this.processVariables(content, snippet.variables, variables);
    } else {
      // Use default values or placeholders
      content = this.processVariablesWithDefaults(content, snippet.variables || []);
    }
    
    // Process built-in variables
    content = this.processBuiltInVariables(content);
    
    // Replace the shortcut with the content
    const newText = 
      text.substring(0, match.startPosition) + 
      content + 
      text.substring(match.endPosition);
    
    const newCursorPosition = match.startPosition + content.length;
    
    return {
      success: true,
      expandedText: newText,
      cursorPosition: newCursorPosition,
      variables
    };
  }

  /**
   * Process variables in snippet content
   */
  private processVariables(
    content: string, 
    variableDefinitions: SnippetVariable[], 
    values: Record<string, any>
  ): string {
    let processedContent = content;
    
    for (const variable of variableDefinitions) {
      const value = values[variable.name] || variable.defaultValue || '';
      const regex = new RegExp(`{${escapeRegExp(variable.name)}}`, 'g');
      processedContent = processedContent.replace(regex, String(value));
    }
    
    return processedContent;
  }

  /**
   * Process variables with default values
   */
  private processVariablesWithDefaults(content: string, variables: SnippetVariable[]): string {
    let processedContent = content;
    
    for (const variable of variables) {
      const value = variable.defaultValue || `{${variable.name}}`;
      const regex = new RegExp(`{${escapeRegExp(variable.name)}}`, 'g');
      processedContent = processedContent.replace(regex, value);
    }
    
    return processedContent;
  }

  /**
   * Process built-in variables like date, time, etc.
   */
  private processBuiltInVariables(content: string): string {
    const now = new Date();
    
    const builtInVariables: Record<string, string> = {
      'date': now.toLocaleDateString(),
      'time': now.toLocaleTimeString(),
      'datetime': now.toLocaleString(),
      'year': now.getFullYear().toString(),
      'month': (now.getMonth() + 1).toString().padStart(2, '0'),
      'day': now.getDate().toString().padStart(2, '0'),
      'hour': now.getHours().toString().padStart(2, '0'),
      'minute': now.getMinutes().toString().padStart(2, '0'),
      'second': now.getSeconds().toString().padStart(2, '0'),
      'timestamp': now.getTime().toString(),
      'iso': now.toISOString(),
      'clipboard': '' // Would need to be populated from clipboard
    };
    
    let processedContent = content;
    
    for (const [name, value] of Object.entries(builtInVariables)) {
      const regex = new RegExp(`{${escapeRegExp(name)}}`, 'g');
      processedContent = processedContent.replace(regex, value);
    }
    
    return processedContent;
  }

  /**
   * Extract variables from snippet content
   */
  extractVariables(content: string): string[] {
    const variableRegex = /{([^}]+)}/g;
    const variables: string[] = [];
    let match;
    
    while ((match = variableRegex.exec(content)) !== null) {
      const variableName = match[1];
      if (!variables.includes(variableName)) {
        variables.push(variableName);
      }
    }
    
    return variables;
  }

  /**
   * Validate snippet content for syntax errors
   */
  validateSnippetContent(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check for unmatched braces
    let braceCount = 0;
    for (let i = 0; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
      } else if (content[i] === '}') {
        braceCount--;
        if (braceCount < 0) {
          errors.push('Unmatched closing brace at position ' + i);
          break;
        }
      }
    }
    
    if (braceCount > 0) {
      errors.push('Unmatched opening brace(s)');
    }
    
    // Check for empty variable names
    const emptyVariableRegex = /{\s*}/g;
    if (emptyVariableRegex.test(content)) {
      errors.push('Empty variable name found');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get cursor position after expansion
   */
  getCursorPositionAfterExpansion(
    originalText: string,
    expandedText: string,
    originalCursorPosition: number,
    expansionStartPosition: number
  ): number {
    const expansionLength = expandedText.length - originalText.length;
    
    if (originalCursorPosition <= expansionStartPosition) {
      return originalCursorPosition;
    }
    
    return originalCursorPosition + expansionLength;
  }
}
