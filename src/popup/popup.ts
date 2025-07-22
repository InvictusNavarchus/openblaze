import { Snippet, Settings, PopupState } from '../types';
import { getBrowser, log, debounce } from '../utils';

class PopupManager {
  private browser = getBrowser();
  private snippets: Snippet[] = [];
  private settings: Settings | null = null;
  private state: PopupState = {
    searchQuery: '',
    isEditing: false,
    showSettings: false
  };

  // DOM elements
  private searchInput!: HTMLInputElement;
  private snippetList!: HTMLElement;
  private loading!: HTMLElement;
  private emptyState!: HTMLElement;
  private footerStats!: HTMLElement;
  private statusIndicator!: HTMLElement;
  private toggleBtn!: HTMLButtonElement;
  private settingsBtn!: HTMLButtonElement;
  private newSnippetBtn!: HTMLButtonElement;
  private importBtn!: HTMLButtonElement;

  private debouncedSearch: () => void;

  constructor() {
    this.debouncedSearch = debounce(() => this.performSearch(), 300);
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.initializeDOM();
      this.setupEventListeners();
      await this.loadData();
      this.render();
      log('info', 'Popup initialized');
    } catch (error) {
      log('error', 'Failed to initialize popup:', error);
    }
  }

  private initializeDOM(): void {
    this.searchInput = document.getElementById('search-input') as HTMLInputElement;
    this.snippetList = document.getElementById('snippet-list') as HTMLElement;
    this.loading = document.getElementById('loading') as HTMLElement;
    this.emptyState = document.getElementById('empty-state') as HTMLElement;
    this.footerStats = document.getElementById('footer-stats') as HTMLElement;
    this.statusIndicator = document.getElementById('status-indicator') as HTMLElement;
    this.toggleBtn = document.getElementById('toggle-btn') as HTMLButtonElement;
    this.settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
    this.newSnippetBtn = document.getElementById('new-snippet-btn') as HTMLButtonElement;
    this.importBtn = document.getElementById('import-btn') as HTMLButtonElement;
  }

  private setupEventListeners(): void {
    // Search input
    this.searchInput.addEventListener('input', () => {
      this.state.searchQuery = this.searchInput.value;
      this.debouncedSearch();
    });

    // Toggle extension
    this.toggleBtn.addEventListener('click', () => {
      this.toggleExtension();
    });

    // Settings
    this.settingsBtn.addEventListener('click', () => {
      this.openSettings();
    });

    // New snippet
    this.newSnippetBtn.addEventListener('click', () => {
      this.createNewSnippet();
    });

    // Import
    this.importBtn.addEventListener('click', () => {
      this.importSnippets();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.close();
      } else if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        this.createNewSnippet();
      }
    });
  }

  private async loadData(): Promise<void> {
    try {
      // Load snippets
      const snippetsResponse = await this.browser.runtime.sendMessage({
        type: 'getSnippets'
      });
      this.snippets = snippetsResponse.snippets || [];

      // Load settings
      const settingsResponse = await this.browser.runtime.sendMessage({
        type: 'getSettings'
      });
      this.settings = settingsResponse.settings;

    } catch (error) {
      log('error', 'Failed to load data:', error);
      this.snippets = [];
    }
  }

  private render(): void {
    this.updateStatus();
    this.renderSnippets();
    this.updateFooterStats();
    this.hideLoading();
  }

  private updateStatus(): void {
    const isEnabled = this.settings?.isEnabled ?? true;
    this.statusIndicator.className = `status-indicator ${isEnabled ? 'status-enabled' : 'status-disabled'}`;
    this.toggleBtn.title = isEnabled ? 'Disable Extension' : 'Enable Extension';
  }

  private renderSnippets(): void {
    const filteredSnippets = this.getFilteredSnippets();
    
    if (filteredSnippets.length === 0) {
      this.showEmptyState();
      return;
    }

    this.showSnippetList();
    this.snippetList.innerHTML = '';

    filteredSnippets.forEach(snippet => {
      const element = this.createSnippetElement(snippet);
      this.snippetList.appendChild(element);
    });
  }

  private getFilteredSnippets(): Snippet[] {
    if (!this.state.searchQuery) {
      return this.snippets.sort((a, b) => b.usageCount - a.usageCount);
    }

    const query = this.state.searchQuery.toLowerCase();
    return this.snippets.filter(snippet => 
      snippet.shortcut.toLowerCase().includes(query) ||
      snippet.name.toLowerCase().includes(query) ||
      snippet.content.toLowerCase().includes(query) ||
      snippet.tags?.some(tag => tag.toLowerCase().includes(query))
    ).sort((a, b) => b.usageCount - a.usageCount);
  }

  private createSnippetElement(snippet: Snippet): HTMLElement {
    const element = document.createElement('div');
    element.className = 'snippet-item';
    element.innerHTML = `
      <div class="snippet-info">
        <div class="snippet-shortcut">${this.escapeHtml(snippet.shortcut)}</div>
        <div class="snippet-name">${this.escapeHtml(snippet.name || 'Untitled')}</div>
        <div class="snippet-content">${this.escapeHtml(snippet.content.substring(0, 50))}${snippet.content.length > 50 ? '...' : ''}</div>
      </div>
      <div class="snippet-actions">
        <button class="snippet-action" data-action="edit" title="Edit">✏️</button>
        <button class="snippet-action" data-action="copy" title="Copy">📋</button>
        <button class="snippet-action" data-action="delete" title="Delete">🗑️</button>
      </div>
    `;

    // Add click handler for snippet selection
    element.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('snippet-action')) {
        const action = target.getAttribute('data-action');
        this.handleSnippetAction(snippet, action!);
      } else {
        this.insertSnippet(snippet);
      }
    });

    return element;
  }

  private async handleSnippetAction(snippet: Snippet, action: string): Promise<void> {
    switch (action) {
      case 'edit':
        await this.editSnippet(snippet);
        break;
      case 'copy':
        await this.copySnippet(snippet);
        break;
      case 'delete':
        await this.deleteSnippet(snippet);
        break;
    }
  }

  private async insertSnippet(snippet: Snippet): Promise<void> {
    try {
      // Get current active tab
      const [tab] = await this.browser.tabs.query({ active: true, currentWindow: true });
      
      if (tab.id) {
        await this.browser.tabs.sendMessage(tab.id, {
          type: 'insertSnippet',
          data: { snippet }
        });
        window.close();
      }
    } catch (error) {
      log('error', 'Failed to insert snippet:', error);
    }
  }

  private async editSnippet(snippet: Snippet): Promise<void> {
    // Open options page with snippet ID
    await this.browser.runtime.openOptionsPage();
    // TODO: Pass snippet ID to options page
  }

  private async copySnippet(snippet: Snippet): Promise<void> {
    try {
      await navigator.clipboard.writeText(snippet.content);
      // Show success notification
      this.showNotification('Snippet copied to clipboard', 'success');
    } catch (error) {
      log('error', 'Failed to copy snippet:', error);
      this.showNotification('Failed to copy snippet', 'error');
    }
  }

  private async deleteSnippet(snippet: Snippet): Promise<void> {
    if (!confirm(`Delete snippet "${snippet.shortcut}"?`)) return;

    try {
      await this.browser.runtime.sendMessage({
        type: 'deleteSnippet',
        data: { id: snippet.id }
      });

      // Remove from local array
      this.snippets = this.snippets.filter(s => s.id !== snippet.id);
      this.render();
      
      this.showNotification('Snippet deleted', 'success');
    } catch (error) {
      log('error', 'Failed to delete snippet:', error);
      this.showNotification('Failed to delete snippet', 'error');
    }
  }

  private async toggleExtension(): Promise<void> {
    try {
      const newEnabled = !this.settings?.isEnabled;
      
      await this.browser.runtime.sendMessage({
        type: 'saveSettings',
        data: { settings: { isEnabled: newEnabled } }
      });

      if (this.settings) {
        this.settings.isEnabled = newEnabled;
      }

      this.updateStatus();
      this.showNotification(
        newEnabled ? 'Extension enabled' : 'Extension disabled',
        'info'
      );
    } catch (error) {
      log('error', 'Failed to toggle extension:', error);
    }
  }

  private async openSettings(): Promise<void> {
    await this.browser.runtime.openOptionsPage();
    window.close();
  }

  private createNewSnippet(): void {
    // Open options page for creating new snippet
    this.browser.runtime.openOptionsPage();
    window.close();
  }

  private importSnippets(): void {
    // Create file input for import
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        this.handleImportFile(file);
      }
    };
    input.click();
  }

  private async handleImportFile(file: File): Promise<void> {
    try {
      const text = await file.text();
      
      await this.browser.runtime.sendMessage({
        type: 'importData',
        data: { data: text }
      });

      // Reload data
      await this.loadData();
      this.render();
      
      this.showNotification('Snippets imported successfully', 'success');
    } catch (error) {
      log('error', 'Failed to import snippets:', error);
      this.showNotification('Failed to import snippets', 'error');
    }
  }

  private performSearch(): void {
    this.renderSnippets();
  }

  private showSnippetList(): void {
    this.snippetList.style.display = 'block';
    this.emptyState.style.display = 'none';
  }

  private showEmptyState(): void {
    this.snippetList.style.display = 'none';
    this.emptyState.style.display = 'block';
  }

  private hideLoading(): void {
    this.loading.style.display = 'none';
  }

  private updateFooterStats(): void {
    const count = this.snippets.length;
    this.footerStats.textContent = `${count} snippet${count !== 1 ? 's' : ''}`;
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info'): void {
    // Simple notification - could be enhanced
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PopupManager());
} else {
  new PopupManager();
}
