import { log } from '../utils';

class SandboxManager {
  private insertionElement: HTMLElement;
  private fontSizeElement: HTMLElement;

  constructor() {
    this.insertionElement = document.getElementById('insertion-html') as HTMLElement;
    this.fontSizeElement = document.getElementById('abs-font-size') as HTMLElement;
    this.initialize();
  }

  private initialize(): void {
    this.setupMessageListener();
    log('info', 'Sandbox initialized');
  }

  private setupMessageListener(): void {
    window.addEventListener('message', (event) => {
      this.handleMessage(event);
    });
  }

  private handleMessage(event: MessageEvent): void {
    const { type, data } = event.data;

    switch (type) {
      case 'processText':
        this.processText(data);
        break;
      case 'measureText':
        this.measureText(data);
        break;
      case 'sanitizeHtml':
        this.sanitizeHtml(data);
        break;
      default:
        log('warn', 'Unknown sandbox message type:', type);
    }
  }

  private processText(data: any): void {
    try {
      const { text, id } = data;
      
      // Process text in sandbox
      this.insertionElement.textContent = text;
      const processedText = this.insertionElement.textContent || '';
      
      // Send result back
      window.parent.postMessage({
        type: 'textProcessed',
        data: { processedText, id }
      }, '*');
      
    } catch (error) {
      window.parent.postMessage({
        type: 'textProcessError',
        data: { error: error instanceof Error ? error.message : 'Unknown error', id: data.id }
      }, '*');
    }
  }

  private measureText(data: any): void {
    try {
      const { text, styles, id } = data;
      
      // Apply styles to measurement element
      if (styles) {
        Object.assign(this.fontSizeElement.style, styles);
      }
      
      this.fontSizeElement.textContent = text;
      
      const measurements = {
        width: this.fontSizeElement.offsetWidth,
        height: this.fontSizeElement.offsetHeight
      };
      
      window.parent.postMessage({
        type: 'textMeasured',
        data: { measurements, id }
      }, '*');
      
    } catch (error) {
      window.parent.postMessage({
        type: 'textMeasureError',
        data: { error: error instanceof Error ? error.message : 'Unknown error', id: data.id }
      }, '*');
    }
  }

  private sanitizeHtml(data: any): void {
    try {
      const { html, id } = data;
      
      // Use the browser's built-in sanitization
      this.insertionElement.innerHTML = html;
      const sanitizedHtml = this.insertionElement.innerHTML;
      
      window.parent.postMessage({
        type: 'htmlSanitized',
        data: { sanitizedHtml, id }
      }, '*');
      
    } catch (error) {
      window.parent.postMessage({
        type: 'htmlSanitizeError',
        data: { error: error instanceof Error ? error.message : 'Unknown error', id: data.id }
      }, '*');
    }
  }
}

// Initialize sandbox
new SandboxManager();
