import { getBrowser, log } from './index';

export class ClipboardManager {
  private static instance: ClipboardManager;
  private browser = getBrowser();
  private offscreenDocumentId = 'openblaze-offscreen';

  static getInstance(): ClipboardManager {
    if (!ClipboardManager.instance) {
      ClipboardManager.instance = new ClipboardManager();
    }
    return ClipboardManager.instance;
  }

  /**
   * Read text from clipboard
   */
  async readText(): Promise<string> {
    try {
      // Try modern clipboard API first (works in secure contexts)
      if (navigator.clipboard && navigator.clipboard.readText) {
        return await navigator.clipboard.readText();
      }

      // Fallback to offscreen document for background script
      return await this.readTextViaOffscreen();
      
    } catch (error) {
      log('error', 'Failed to read from clipboard:', error);
      return '';
    }
  }

  /**
   * Write text to clipboard
   */
  async writeText(text: string): Promise<boolean> {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }

      // Fallback to offscreen document
      return await this.writeTextViaOffscreen(text);
      
    } catch (error) {
      log('error', 'Failed to write to clipboard:', error);
      return false;
    }
  }

  /**
   * Read clipboard via offscreen document
   */
  private async readTextViaOffscreen(): Promise<string> {
    try {
      await this.ensureOffscreenDocument();
      
      const response = await this.browser.runtime.sendMessage({
        type: 'readClipboard'
      });

      if (response.success) {
        return response.text || '';
      } else {
        throw new Error(response.error || 'Failed to read clipboard');
      }
      
    } catch (error) {
      log('error', 'Offscreen clipboard read failed:', error);
      return '';
    }
  }

  /**
   * Write clipboard via offscreen document
   */
  private async writeTextViaOffscreen(text: string): Promise<boolean> {
    try {
      await this.ensureOffscreenDocument();
      
      const response = await this.browser.runtime.sendMessage({
        type: 'writeClipboard',
        data: { text }
      });

      return response.success;
      
    } catch (error) {
      log('error', 'Offscreen clipboard write failed:', error);
      return false;
    }
  }

  /**
   * Ensure offscreen document exists
   */
  private async ensureOffscreenDocument(): Promise<void> {
    try {
      // For now, skip offscreen document creation as it requires specific Chrome APIs
      // This is a placeholder for future implementation
      log('info', 'Offscreen document creation skipped - using fallback methods');

    } catch (error) {
      log('error', 'Failed to create offscreen document:', error);
      throw error;
    }
  }

  /**
   * Get clipboard content for snippet variables
   */
  async getClipboardForVariable(): Promise<string> {
    const text = await this.readText();
    
    // Sanitize clipboard content for snippet use
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')
      .trim();
  }

  /**
   * Copy snippet content to clipboard
   */
  async copySnippetContent(content: string): Promise<boolean> {
    const success = await this.writeText(content);
    
    if (success) {
      log('info', 'Snippet content copied to clipboard');
    }
    
    return success;
  }

  /**
   * Check if clipboard access is available
   */
  async isClipboardAccessible(): Promise<boolean> {
    try {
      // Test read access
      await this.readText();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Request clipboard permissions
   */
  async requestClipboardPermissions(): Promise<boolean> {
    try {
      // For Chrome extensions, clipboard permissions are declared in manifest
      // This method can be used to check if permissions are granted
      const permissions = await this.browser.permissions.contains({
        permissions: ['clipboardRead', 'clipboardWrite']
      });

      return permissions;
      
    } catch (error) {
      log('error', 'Failed to check clipboard permissions:', error);
      return false;
    }
  }

  /**
   * Perform smart text insertion using clipboard without overwriting user's clipboard
   * This method temporarily uses the clipboard to insert text naturally, 
   * preserving complex DOM structures and website-specific text handling
   */
  async performSmartInsertion(
    element: HTMLElement, 
    textToInsert: string,
    preserveFormatting: boolean = true
  ): Promise<boolean> {
    log('debug', 'Starting smart clipboard-based insertion');
    
    let originalClipboard = '';
    let clipboardBackupSuccess = false;

    try {
      // Step 1: Backup current clipboard content
      log('trace', 'Backing up current clipboard content');
      originalClipboard = await this.readText();
      clipboardBackupSuccess = true;
      log('debug', `Clipboard backup successful, content length: ${originalClipboard.length}`);

      // Step 2: Put our text in clipboard temporarily
      log('trace', 'Writing snippet content to clipboard');
      const writeSuccess = await this.writeText(textToInsert);
      if (!writeSuccess) {
        log('error', 'Failed to write snippet content to clipboard');
        return false;
      }

      // Step 3: Focus the element and paste
      log('trace', 'Focusing element and performing paste operation');
      element.focus();
      
      // Small delay to ensure focus is set
      await new Promise(resolve => setTimeout(resolve, 10));

      // Try modern approach first, then fallback to execCommand
      let pasteSuccess = false;
      
      if (navigator.clipboard && 'read' in navigator.clipboard) {
        try {
          // Use modern clipboard API with paste event simulation
          log('trace', 'Attempting modern clipboard paste simulation');
          const clipboardData = await navigator.clipboard.read();
          
          // Create and dispatch paste event
          const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: new DataTransfer()
          });
          
          // Add text data to clipboard event
          pasteEvent.clipboardData?.setData('text/plain', textToInsert);
          if (preserveFormatting) {
            pasteEvent.clipboardData?.setData('text/html', textToInsert.replace(/\n/g, '<br>'));
          }
          
          const eventResult = element.dispatchEvent(pasteEvent);
          pasteSuccess = eventResult;
          log('trace', `Modern paste event result: ${eventResult}`);
          
        } catch (modernError) {
          log('trace', 'Modern clipboard approach failed, falling back to execCommand');
        }
      }
      
      // Fallback to execCommand if modern approach fails
      if (!pasteSuccess) {
        try {
          log('trace', 'Using execCommand paste fallback');
          pasteSuccess = document.execCommand('paste');
          log('trace', `execCommand paste result: ${pasteSuccess}`);
        } catch (execError) {
          log('warn', 'execCommand paste failed:', execError);
        }
      }

      // Step 4: Restore original clipboard content
      log('trace', 'Restoring original clipboard content');
      if (clipboardBackupSuccess) {
        const restoreSuccess = await this.writeText(originalClipboard);
        if (restoreSuccess) {
          log('debug', 'Original clipboard content restored successfully');
        } else {
          log('warn', 'Failed to restore original clipboard content');
        }
      }

      if (pasteSuccess) {
        log('info', 'Smart clipboard insertion completed successfully');
        return true;
      } else {
        log('warn', 'Smart clipboard insertion failed - paste operation unsuccessful');
        return false;
      }

    } catch (error) {
      log('error', 'Smart clipboard insertion failed:', error);
      
      // Emergency restore of clipboard if something went wrong
      if (clipboardBackupSuccess && originalClipboard !== '') {
        try {
          await this.writeText(originalClipboard);
          log('debug', 'Emergency clipboard restore completed');
        } catch (restoreError) {
          log('error', 'Emergency clipboard restore failed:', restoreError);
        }
      }
      
      return false;
    }
  }

  /**
   * Monitor clipboard changes (if supported)
   */
  async startClipboardMonitoring(callback: (text: string) => void): Promise<void> {
    // Note: Clipboard monitoring is limited in browser extensions
    // This is a placeholder for potential future implementation
    log('info', 'Clipboard monitoring not implemented yet');
  }

  /**
   * Stop clipboard monitoring
   */
  stopClipboardMonitoring(): void {
    log('info', 'Clipboard monitoring stopped');
  }
}

// Utility functions for easy access
export async function readClipboard(): Promise<string> {
  return ClipboardManager.getInstance().readText();
}

export async function writeClipboard(text: string): Promise<boolean> {
  return ClipboardManager.getInstance().writeText(text);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  return ClipboardManager.getInstance().copySnippetContent(text);
}

export async function getClipboardContent(): Promise<string> {
  return ClipboardManager.getInstance().getClipboardForVariable();
}

/**
 * Perform smart text insertion using clipboard-based approach
 * This preserves the user's clipboard while enabling natural text insertion
 */
export async function performSmartTextInsertion(
  element: HTMLElement, 
  text: string,
  preserveFormatting: boolean = true
): Promise<boolean> {
  return ClipboardManager.getInstance().performSmartInsertion(element, text, preserveFormatting);
}
