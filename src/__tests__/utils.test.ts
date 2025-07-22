import { 
  generateId, 
  debounce, 
  throttle, 
  escapeRegExp, 
  normalizeShortcut, 
  isValidShortcut,
  getDomainFromUrl,
  isExcludedDomain
} from '../utils';

describe('Utility Functions', () => {
  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(0);
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    it('should debounce function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });

  describe('throttle', () => {
    jest.useFakeTimers();

    it('should throttle function calls', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    afterEach(() => {
      jest.clearAllTimers();
    });
  });

  describe('escapeRegExp', () => {
    it('should escape special regex characters', () => {
      expect(escapeRegExp('hello.world')).toBe('hello\\.world');
      expect(escapeRegExp('test*string')).toBe('test\\*string');
      expect(escapeRegExp('a+b?c')).toBe('a\\+b\\?c');
      expect(escapeRegExp('(test)')).toBe('\\(test\\)');
      expect(escapeRegExp('[abc]')).toBe('\\[abc\\]');
    });
  });

  describe('normalizeShortcut', () => {
    it('should normalize shortcuts', () => {
      expect(normalizeShortcut('  HELLO  ')).toBe('hello');
      expect(normalizeShortcut('Test123')).toBe('test123');
      expect(normalizeShortcut('  ')).toBe('');
    });
  });

  describe('isValidShortcut', () => {
    it('should validate shortcuts correctly', () => {
      expect(isValidShortcut('hello')).toBe(true);
      expect(isValidShortcut('test123')).toBe(true);
      expect(isValidShortcut('_private')).toBe(true);
      expect(isValidShortcut('my-shortcut')).toBe(true);
      
      expect(isValidShortcut('')).toBe(false);
      expect(isValidShortcut('a')).toBe(false);
      expect(isValidShortcut('123')).toBe(false);
      expect(isValidShortcut('hello world')).toBe(false);
      expect(isValidShortcut('test@email')).toBe(false);
    });
  });

  describe('getDomainFromUrl', () => {
    it('should extract domain from URL', () => {
      expect(getDomainFromUrl('https://www.example.com/path')).toBe('www.example.com');
      expect(getDomainFromUrl('http://test.org')).toBe('test.org');
      expect(getDomainFromUrl('https://subdomain.example.co.uk/page?param=1')).toBe('subdomain.example.co.uk');
      expect(getDomainFromUrl('invalid-url')).toBe('');
    });
  });

  describe('isExcludedDomain', () => {
    it('should check if domain is excluded', () => {
      const excludedDomains = ['example.com', 'test.org'];
      
      expect(isExcludedDomain('https://www.example.com/page', excludedDomains)).toBe(true);
      expect(isExcludedDomain('https://test.org', excludedDomains)).toBe(true);
      expect(isExcludedDomain('https://allowed.com', excludedDomains)).toBe(false);
      expect(isExcludedDomain('https://sub.allowed.com', excludedDomains)).toBe(false);
    });
  });
});
