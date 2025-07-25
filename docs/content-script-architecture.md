# Content Script Architecture

## Overview

This document explains the architecture used for content scripts in the OpenBlaze browser extension, which cleverly works around the ES module limitations in browser extension content scripts.

## The Problem

Browser extension content scripts run as raw JavaScript files and cannot use ES module imports (`import`/`export` statements). This creates a challenge when you want to:

1. Use modern TypeScript/JavaScript development practices
2. Share code between different parts of the extension
3. Maintain type safety and good code organization

## The Solution: Global Namespace Pattern with IIFE

We've implemented a hybrid approach inspired by successful extensions like Gemini History:

### 1. Global Namespace Files (JavaScript)

Content scripts use **global namespace patterns** with IIFE (Immediately Invoked Function Expression):

```javascript
(function () {
  "use strict";
  
  // Module code here
  const Utils = {
    // utility functions
  };
  
  // Expose to global scope
  window.OpenBlaze_Utils = Utils;
})();
```

### 2. Main Extension Parts (TypeScript with ES Modules)

Other parts of the extension (popup, background, options) continue to use modern ES modules with Vite bundling:

```typescript
import { createApp } from "vue";
import App from "./App.vue";
```

## File Structure

### Global Namespace Files

- `src/content/types-global.js` - Type definitions and validators
- `src/content/utils-global.js` - Utility functions
- `src/content/form-handler-global.js` - Form handling functionality
- `src/content/keyboard-shortcuts-global.js` - Keyboard shortcut management

### Content Scripts

- `src/content/contentScript.ts` - Main content script (uses IIFE pattern)
- `src/content/inPageNotifier.ts` - In-page notification system (uses IIFE pattern)

### TypeScript Support

- `src/content/global-types.d.ts` - TypeScript declarations for global namespaces

## Loading Order

The manifest.json loads files in dependency order:

```json
{
  "content_scripts": [
    {
      "js": [
        "js/types-global.js",           // 1. Types and constants
        "js/utils-global.js",           // 2. Basic utilities
        "js/form-handler-global.js",    // 3. Form handling (depends on utils)
        "js/keyboard-shortcuts-global.js", // 4. Keyboard shortcuts (depends on utils)
        "js/inPageNotifier.js",         // 5. Notification system
        "js/contentScript.js"           // 6. Main content script (depends on all above)
      ]
    }
  ]
}
```

## Usage in Content Scripts

Content scripts access the global namespaces:

```typescript
/// <reference path="./global-types.d.ts" />

import type { Snippet, Settings } from '../types';

(function () {
  "use strict";

  // Access global namespaces
  const { getBrowser, log, debounce } = window.OpenBlaze_Utils;
  const { registerShortcut } = window.OpenBlaze_KeyboardShortcuts;

  class ContentScript {
    // Implementation using the global utilities
  }

  new ContentScript();
})();
```

## Benefits

1. **Modern Development**: TypeScript support with full type checking
2. **Code Sharing**: Utilities can be shared between content scripts
3. **Browser Compatibility**: Works in all browsers that support extensions
4. **Performance**: Minimal overhead, efficient loading
5. **Maintainability**: Clear separation of concerns

## Build Process

Vite handles the compilation:

1. TypeScript files are compiled to JavaScript
2. Global namespace files are copied as-is (already in IIFE format)
3. Content scripts are wrapped in IIFE and minified
4. All files are output to the `dist/js/` directory

## Type Safety

TypeScript declarations in `global-types.d.ts` provide full type safety:

```typescript
declare global {
  interface Window {
    OpenBlaze_Utils: {
      getBrowser: () => typeof chrome;
      log: (level: 'info' | 'warn' | 'error', message: string, ...args: any[]) => void;
      // ... other utilities
    };
  }
}
```

## Testing

The architecture allows for easy testing:

1. Global namespace functions can be tested independently
2. Content scripts can be tested by mocking the global namespaces
3. Type safety ensures compatibility between components

## Migration from ES Modules

To migrate existing ES module content scripts:

1. Create global namespace files for shared dependencies
2. Update content scripts to use IIFE pattern
3. Add TypeScript declarations for global namespaces
4. Update manifest.json loading order
5. Update build configuration

This architecture provides the best of both worlds: modern development practices with browser extension compatibility.
