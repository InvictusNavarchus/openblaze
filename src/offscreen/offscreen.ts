import { getBrowser, log } from '../utils';

class OffscreenManager {
  private browser = getBrowser();
  private clipboardElement: HTMLTextAreaElement;

  constructor() {
    this.clipboardElement = document.getElementById('clip-write') as HTMLTextAreaElement;
    this.initialize();
  }

  private initialize(): void {
    this.setupMessageListener();
    log('info', 'Offscreen document initialized');
  }

  private setupMessageListener(): void {
    this.browser.runtime.onMessage.addListener(
      (message, sender, sendResponse) => {
        this.handleMessage(message, sender, sendResponse);
        return true; // Keep message channel open
      }
    );
  }

  private async handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      switch (message.type) {
        case 'writeClipboard':
          await this.writeToClipboard(message.data.text);
          sendResponse({ success: true });
          break;

        case 'readClipboard':
          const text = await this.readFromClipboard();
          sendResponse({ success: true, text });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      log('error', 'Offscreen message error:', error);
      sendResponse({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  private async writeToClipboard(text: string): Promise<void> {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }

      // Fallback to textarea method
      this.clipboardElement.value = text;
      this.clipboardElement.select();
      this.clipboardElement.setSelectionRange(0, 99999);
      
      const success = document.execCommand('copy');
      if (!success) {
        throw new Error('Failed to copy to clipboard');
      }
      
    } catch (error) {
      log('error', 'Failed to write to clipboard:', error);
      throw error;
    }
  }

  private async readFromClipboard(): Promise<string> {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.readText) {
        return await navigator.clipboard.readText();
      }

      // Fallback method - focus textarea and paste
      this.clipboardElement.value = '';
      this.clipboardElement.focus();
      
      const success = document.execCommand('paste');
      if (!success) {
        throw new Error('Failed to read from clipboard');
      }
      
      return this.clipboardElement.value;
      
    } catch (error) {
      log('error', 'Failed to read from clipboard:', error);
      throw error;
    }
  }
}

// Initialize offscreen manager
new OffscreenManager();
