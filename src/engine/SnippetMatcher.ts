import { Snippet } from '../types';
import { normalizeShortcut, escapeRegExp } from '../utils';

export interface MatchResult {
  snippet: Snippet;
  confidence: number;
  matchType: 'exact' | 'prefix' | 'fuzzy';
  matchedText: string;
}

export class SnippetMatcher {
  private static instance: SnippetMatcher;

  static getInstance(): SnippetMatcher {
    if (!SnippetMatcher.instance) {
      SnippetMatcher.instance = new SnippetMatcher();
    }
    return SnippetMatcher.instance;
  }

  /**
   * Find the best matching snippet for a given input
   */
  findBestMatch(input: string, snippets: Snippet[]): MatchResult | null {
    const matches = this.findMatches(input, snippets);
    
    if (matches.length === 0) return null;
    
    // Sort by confidence (highest first)
    matches.sort((a, b) => b.confidence - a.confidence);
    
    return matches[0];
  }

  /**
   * Find all matching snippets for a given input
   */
  findMatches(input: string, snippets: Snippet[]): MatchResult[] {
    const normalizedInput = normalizeShortcut(input);
    const matches: MatchResult[] = [];

    for (const snippet of snippets) {
      if (!snippet.isEnabled) continue;

      const match = this.matchSnippet(normalizedInput, snippet);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  }

  /**
   * Match a single snippet against input
   */
  private matchSnippet(input: string, snippet: Snippet): MatchResult | null {
    const normalizedShortcut = normalizeShortcut(snippet.shortcut);

    // Exact match
    if (normalizedShortcut === input) {
      return {
        snippet,
        confidence: 1.0,
        matchType: 'exact',
        matchedText: input
      };
    }

    // Prefix match
    if (normalizedShortcut.startsWith(input) && input.length >= 2) {
      const confidence = input.length / normalizedShortcut.length;
      return {
        snippet,
        confidence: confidence * 0.8, // Slightly lower than exact match
        matchType: 'prefix',
        matchedText: input
      };
    }

    // Fuzzy match
    const fuzzyScore = this.calculateFuzzyScore(input, normalizedShortcut);
    if (fuzzyScore > 0.6) {
      return {
        snippet,
        confidence: fuzzyScore * 0.6, // Lower than prefix match
        matchType: 'fuzzy',
        matchedText: input
      };
    }

    return null;
  }

  /**
   * Calculate fuzzy matching score using Levenshtein distance
   */
  private calculateFuzzyScore(input: string, target: string): number {
    if (input.length === 0) return target.length === 0 ? 1 : 0;
    if (target.length === 0) return 0;

    const distance = this.levenshteinDistance(input, target);
    const maxLength = Math.max(input.length, target.length);
    
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Extract potential shortcuts from text
   */
  extractPotentialShortcuts(text: string, cursorPosition: number): string[] {
    const shortcuts: string[] = [];
    
    // Get text before cursor
    const textBeforeCursor = text.substring(0, cursorPosition);
    
    // Split by whitespace and punctuation
    const words = textBeforeCursor.split(/[\s\n\r\t.,;:!?()[\]{}"'`~@#$%^&*+=|\\/<>-]+/);
    
    // Get the last word (potential shortcut)
    const lastWord = words[words.length - 1];
    if (lastWord && lastWord.length >= 1) {
      shortcuts.push(lastWord);
    }

    // Also check for partial words (for real-time matching)
    if (lastWord && lastWord.length >= 2) {
      for (let i = 2; i <= lastWord.length; i++) {
        shortcuts.push(lastWord.substring(0, i));
      }
    }

    return shortcuts.filter(s => s.length > 0);
  }

  /**
   * Check if a character should trigger expansion
   */
  isTriggerCharacter(char: string, triggerType: 'space' | 'tab' | 'enter'): boolean {
    switch (triggerType) {
      case 'space':
        return char === ' ';
      case 'tab':
        return char === '\t';
      case 'enter':
        return char === '\n' || char === '\r';
      default:
        return char === ' ';
    }
  }

  /**
   * Find word boundaries in text
   */
  findWordBoundaries(text: string): number[] {
    const boundaries: number[] = [0]; // Start of text
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (/[\s\n\r\t.,;:!?()[\]{}"'`~@#$%^&*+=|\\/<>-]/.test(char)) {
        boundaries.push(i);
        boundaries.push(i + 1);
      }
    }
    
    boundaries.push(text.length); // End of text
    
    // Remove duplicates and sort
    return [...new Set(boundaries)].sort((a, b) => a - b);
  }

  /**
   * Get word at position
   */
  getWordAtPosition(text: string, position: number): { word: string; start: number; end: number } | null {
    const boundaries = this.findWordBoundaries(text);
    
    // Find the word boundaries that contain the position
    let start = 0;
    let end = text.length;
    
    for (let i = 0; i < boundaries.length - 1; i++) {
      if (boundaries[i] <= position && position <= boundaries[i + 1]) {
        start = boundaries[i];
        end = boundaries[i + 1];
        break;
      }
    }
    
    // Trim whitespace
    while (start < end && /\s/.test(text[start])) {
      start++;
    }
    while (end > start && /\s/.test(text[end - 1])) {
      end--;
    }
    
    if (start >= end) return null;
    
    const word = text.substring(start, end);
    return { word, start, end };
  }

  /**
   * Check if position is at word boundary
   */
  isAtWordBoundary(text: string, position: number): boolean {
    if (position === 0 || position === text.length) return true;
    
    const charBefore = text[position - 1];
    const charAfter = text[position];
    
    const isBoundaryChar = (char: string) => 
      /[\s\n\r\t.,;:!?()[\]{}"'`~@#$%^&*+=|\\/<>-]/.test(char);
    
    return isBoundaryChar(charBefore) || isBoundaryChar(charAfter);
  }

  /**
   * Suggest snippets based on partial input
   */
  suggestSnippets(input: string, snippets: Snippet[], maxSuggestions = 5): MatchResult[] {
    if (input.length < 1) return [];
    
    const matches = this.findMatches(input, snippets);
    
    // Filter and sort suggestions
    return matches
      .filter(match => match.matchType === 'prefix' || match.confidence > 0.7)
      .sort((a, b) => {
        // Prioritize exact and prefix matches
        if (a.matchType !== b.matchType) {
          const typeOrder = { exact: 3, prefix: 2, fuzzy: 1 };
          return typeOrder[b.matchType] - typeOrder[a.matchType];
        }
        
        // Then by confidence
        if (a.confidence !== b.confidence) {
          return b.confidence - a.confidence;
        }
        
        // Then by usage count
        return b.snippet.usageCount - a.snippet.usageCount;
      })
      .slice(0, maxSuggestions);
  }

  /**
   * Check if a shortcut conflicts with existing snippets
   */
  hasConflict(shortcut: string, snippets: Snippet[], excludeId?: string): boolean {
    const normalizedShortcut = normalizeShortcut(shortcut);
    
    return snippets.some(snippet => 
      snippet.id !== excludeId &&
      snippet.isEnabled &&
      normalizeShortcut(snippet.shortcut) === normalizedShortcut
    );
  }

  /**
   * Find similar shortcuts that might cause confusion
   */
  findSimilarShortcuts(shortcut: string, snippets: Snippet[], threshold = 0.8): Snippet[] {
    const normalizedShortcut = normalizeShortcut(shortcut);
    const similar: Snippet[] = [];
    
    for (const snippet of snippets) {
      if (!snippet.isEnabled) continue;
      
      const normalizedExisting = normalizeShortcut(snippet.shortcut);
      const similarity = this.calculateFuzzyScore(normalizedShortcut, normalizedExisting);
      
      if (similarity >= threshold && similarity < 1.0) {
        similar.push(snippet);
      }
    }
    
    return similar.sort((a, b) => {
      const scoreA = this.calculateFuzzyScore(normalizedShortcut, normalizeShortcut(a.shortcut));
      const scoreB = this.calculateFuzzyScore(normalizedShortcut, normalizeShortcut(b.shortcut));
      return scoreB - scoreA;
    });
  }
}
