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
    log('debug', 'PopupManager constructor called');
    log('trace', 'Creating debounced search function with 300ms delay');
    this.debouncedSearch = debounce(() => this.performSearch(), 300);
    log('debug', 'Starting popup initialization');
    this.initialize();
    log('trace', 'PopupManager constructor completed');
  }

  private async initialize(): Promise<void> {
    log('debug', 'Starting popup initialization');
    try {
      log('trace', 'Initializing DOM elements');
      this.initializeDOM();
      log('debug', 'DOM elements initialized successfully');

      log('trace', 'Setting up event listeners');
      this.setupEventListeners();
      log('debug', 'Event listeners setup completed');

      log('trace', 'Loading data from background script');
      await this.loadData();
      log('debug', 'Data loaded successfully');

      log('trace', 'Rendering initial UI');
      this.render();
      log('debug', 'Initial UI render completed');

      log('info', 'Popup initialized successfully');
      log('debug', 'Current state:', {
        snippetCount: this.snippets.length,
        hasSettings: !!this.settings,
        searchQuery: this.state.searchQuery,
        isEditing: this.state.isEditing,
        showSettings: this.state.showSettings
      });
    } catch (error) {
      log('error', 'Failed to initialize popup:', error);
      log('trace', 'Initialization error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
    }
  }

  private initializeDOM(): void {
    log('debug', 'Initializing DOM element references');

    log('trace', 'Getting search input element');
    this.searchInput = document.getElementById('search-input') as HTMLInputElement;
    log('trace', 'Search input found:', !!this.searchInput);

    log('trace', 'Getting snippet list element');
    this.snippetList = document.getElementById('snippet-list') as HTMLElement;
    log('trace', 'Snippet list found:', !!this.snippetList);

    log('trace', 'Getting loading element');
    this.loading = document.getElementById('loading') as HTMLElement;
    log('trace', 'Loading element found:', !!this.loading);

    log('trace', 'Getting empty state element');
    this.emptyState = document.getElementById('empty-state') as HTMLElement;
    log('trace', 'Empty state element found:', !!this.emptyState);

    log('trace', 'Getting footer stats element');
    this.footerStats = document.getElementById('footer-stats') as HTMLElement;
    log('trace', 'Footer stats element found:', !!this.footerStats);

    log('trace', 'Getting status indicator element');
    this.statusIndicator = document.getElementById('status-indicator') as HTMLElement;
    log('trace', 'Status indicator found:', !!this.statusIndicator);

    log('trace', 'Getting toggle button');
    this.toggleBtn = document.getElementById('toggle-btn') as HTMLButtonElement;
    log('trace', 'Toggle button found:', !!this.toggleBtn);

    log('trace', 'Getting settings button');
    this.settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
    log('trace', 'Settings button found:', !!this.settingsBtn);

    log('trace', 'Getting new snippet button');
    this.newSnippetBtn = document.getElementById('new-snippet-btn') as HTMLButtonElement;
    log('trace', 'New snippet button found:', !!this.newSnippetBtn);

    log('trace', 'Getting import button');
    this.importBtn = document.getElementById('import-btn') as HTMLButtonElement;
    log('trace', 'Import button found:', !!this.importBtn);

    log('debug', 'DOM initialization completed', {
      searchInput: !!this.searchInput,
      snippetList: !!this.snippetList,
      loading: !!this.loading,
      emptyState: !!this.emptyState,
      footerStats: !!this.footerStats,
      statusIndicator: !!this.statusIndicator,
      toggleBtn: !!this.toggleBtn,
      settingsBtn: !!this.settingsBtn,
      newSnippetBtn: !!this.newSnippetBtn,
      importBtn: !!this.importBtn
    });
  }

  private setupEventListeners(): void {
    log('debug', 'Setting up event listeners');

    // Search input
    log('trace', 'Setting up search input listener');
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        const query = (e.target as HTMLInputElement).value;
        log('trace', `Search input changed: "${query}"`);
        this.state.searchQuery = query;
        this.debouncedSearch();
      });
      log('debug', 'Search input listener setup completed');
    } else {
      log('warn', 'Search input element not found');
    }

    // Toggle extension
    log('trace', 'Setting up toggle button listener');
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => {
        log('debug', 'Toggle button clicked');
        this.toggleExtension();
      });
      log('debug', 'Toggle button listener setup completed');
    } else {
      log('warn', 'Toggle button element not found');
    }

    // Settings
    log('trace', 'Setting up settings button listener');
    if (this.settingsBtn) {
      this.settingsBtn.addEventListener('click', () => {
        log('debug', 'Settings button clicked');
        this.openSettings();
      });
      log('debug', 'Settings button listener setup completed');
    } else {
      log('warn', 'Settings button element not found');
    }

    // New snippet
    log('trace', 'Setting up new snippet button listener');
    if (this.newSnippetBtn) {
      this.newSnippetBtn.addEventListener('click', () => {
        log('debug', 'New snippet button clicked');
        this.createNewSnippet();
      });
      log('debug', 'New snippet button listener setup completed');
    } else {
      log('warn', 'New snippet button element not found');
    }

    // Import
    log('trace', 'Setting up import button listener');
    if (this.importBtn) {
      this.importBtn.addEventListener('click', () => {
        log('debug', 'Import button clicked');
        this.importSnippets();
      });
      log('debug', 'Import button listener setup completed');
    } else {
      log('warn', 'Import button element not found');
    }

    // Keyboard shortcuts
    log('trace', 'Setting up keyboard shortcuts');
    document.addEventListener('keydown', (e) => {
      log('trace', 'Keydown event:', {
        key: e.key,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey
      });

      if (e.key === 'Escape') {
        log('debug', 'Escape key pressed - closing popup');
        window.close();
      } else if (e.ctrlKey && e.key === 'n') {
        log('debug', 'Ctrl+N pressed - creating new snippet');
        e.preventDefault();
        this.createNewSnippet();
      }
    });
    log('debug', 'Keyboard shortcuts setup completed');

    log('info', 'All event listeners setup completed');
  }

  private async loadData(): Promise<void> {
    log('debug', 'Loading data from background script');
    try {
      // Load snippets
      log('trace', 'Sending getSnippets message to background');
      const snippetsResponse = await this.browser.runtime.sendMessage({
        type: 'getSnippets'
      });
      log('trace', 'Received snippets response:', {
        hasSnippets: !!snippetsResponse.snippets,
        snippetCount: snippetsResponse.snippets?.length || 0
      });

      this.snippets = snippetsResponse.snippets || [];
      log('debug', `Loaded ${this.snippets.length} snippets`);

      // Load settings
      log('trace', 'Sending getSettings message to background');
      const settingsResponse = await this.browser.runtime.sendMessage({
        type: 'getSettings'
      });
      log('trace', 'Received settings response:', {
        hasSettings: !!settingsResponse.settings,
        isEnabled: settingsResponse.settings?.isEnabled,
        theme: settingsResponse.settings?.theme
      });

      this.settings = settingsResponse.settings;
      log('debug', 'Settings loaded successfully');

      log('info', 'Data loading completed', {
        snippetCount: this.snippets.length,
        hasSettings: !!this.settings
      });

    } catch (error) {
      log('error', 'Failed to load data:', error);
      log('trace', 'Data loading error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      this.snippets = [];
      log('warn', 'Falling back to empty snippets array');
    }
  }

  private render(): void {
    log('debug', 'Starting UI render');

    log('trace', 'Updating status indicator');
    this.updateStatus();
    log('debug', 'Status indicator updated');

    log('trace', 'Rendering snippets list');
    this.renderSnippets();
    log('debug', 'Snippets list rendered');

    log('trace', 'Updating footer statistics');
    this.updateFooterStats();
    log('debug', 'Footer statistics updated');

    log('trace', 'Hiding loading indicator');
    this.hideLoading();
    log('debug', 'Loading indicator hidden');

    log('info', 'UI render completed');
  }

  private updateStatus(): void {
    log('debug', 'Updating status indicator');

    const isEnabled = this.settings?.isEnabled ?? true;
    log('trace', 'Extension enabled state:', isEnabled);

    const statusClass = `status-indicator ${isEnabled ? 'status-enabled' : 'status-disabled'}`;
    log('trace', 'Setting status indicator class:', statusClass);

    if (this.statusIndicator) {
      this.statusIndicator.className = statusClass;
      log('trace', 'Status indicator class updated');
    } else {
      log('warn', 'Status indicator element not found');
    }

    const buttonTitle = isEnabled ? 'Disable Extension' : 'Enable Extension';
    log('trace', 'Setting toggle button title:', buttonTitle);

    if (this.toggleBtn) {
      this.toggleBtn.title = buttonTitle;
      log('trace', 'Toggle button title updated');
    } else {
      log('warn', 'Toggle button element not found');
    }

    log('debug', 'Status update completed', {
      isEnabled,
      statusClass,
      buttonTitle
    });
  }

  private renderSnippets(): void {
    log('debug', 'Rendering snippets list');

    log('trace', 'Getting filtered snippets');
    const filteredSnippets = this.getFilteredSnippets();
    log('trace', `Filtered snippets count: ${filteredSnippets.length} (from ${this.snippets.length} total)`);

    if (filteredSnippets.length === 0) {
      log('debug', 'No snippets to display - showing empty state');
      this.showEmptyState();
      return;
    }

    log('debug', 'Showing snippet list');
    this.showSnippetList();

    log('trace', 'Clearing snippet list container');
    if (this.snippetList) {
      this.snippetList.innerHTML = '';
      log('trace', 'Snippet list container cleared');
    } else {
      log('warn', 'Snippet list element not found');
      return;
    }

    log('debug', `Creating ${filteredSnippets.length} snippet elements`);
    filteredSnippets.forEach((snippet, index) => {
      log('trace', `Creating element for snippet ${index + 1}: ${snippet.shortcut}`);
      const element = this.createSnippetElement(snippet);
      this.snippetList.appendChild(element);
    });

    log('info', `Snippets rendered successfully: ${filteredSnippets.length} items`);
  }

  private getFilteredSnippets(): Snippet[] {
    log('trace', 'Filtering snippets based on search query');

    if (!this.state.searchQuery) {
      log('trace', 'No search query - returning all snippets sorted by usage count');
      const sorted = this.snippets.sort((a, b) => b.usageCount - a.usageCount);
      log('debug', `Returning ${sorted.length} snippets (no filter)`);
      return sorted;
    }

    const query = this.state.searchQuery.toLowerCase();
    log('trace', `Search query: "${query}"`);

    log('trace', 'Applying search filters');
    const filtered = this.snippets.filter(snippet => {
      const shortcutMatch = snippet.shortcut.toLowerCase().includes(query);
      const nameMatch = snippet.name.toLowerCase().includes(query);
      const contentMatch = snippet.content.toLowerCase().includes(query);
      const tagMatch = snippet.tags?.some(tag => tag.toLowerCase().includes(query));

      const matches = shortcutMatch || nameMatch || contentMatch || tagMatch;

      if (matches) {
        log('trace', `Snippet "${snippet.shortcut}" matches query`, {
          shortcutMatch,
          nameMatch,
          contentMatch,
          tagMatch
        });
      }

      return matches;
    }).sort((a, b) => b.usageCount - a.usageCount);

    log('debug', `Filtered ${filtered.length} snippets from ${this.snippets.length} total`);
    return filtered;
  }

  private createSnippetElement(snippet: Snippet): HTMLElement {
    log('trace', `Creating snippet element for: ${snippet.shortcut}`);

    const element = document.createElement('div');
    element.className = 'snippet-item';

    const contentPreview = snippet.content.substring(0, 50);
    const isContentTruncated = snippet.content.length > 50;

    log('trace', 'Snippet element details:', {
      shortcut: snippet.shortcut,
      name: snippet.name || 'Untitled',
      contentLength: snippet.content.length,
      contentPreview: contentPreview.slice(0, 20) + '...',
      usageCount: snippet.usageCount,
      isContentTruncated
    });

    const elementHTML = `
      <div class="snippet-info">
        <div class="snippet-shortcut">${this.escapeHtml(snippet.shortcut)}</div>
        <div class="snippet-name">${this.escapeHtml(snippet.name || 'Untitled')}</div>
        <div class="snippet-content">${this.escapeHtml(contentPreview)}${isContentTruncated ? '...' : ''}</div>
      </div>
      <div class="snippet-actions">
        <button class="snippet-action" data-action="edit" title="Edit">✏️</button>
        <button class="snippet-action" data-action="copy" title="Copy">📋</button>
        <button class="snippet-action" data-action="delete" title="Delete">🗑️</button>
      </div>
    `;

    element.innerHTML = elementHTML;
    log('trace', 'Snippet element HTML set');

    // Add click handler for snippet selection
    log('trace', 'Adding click handler for snippet element');
    element.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      log('trace', 'Snippet element clicked:', {
        targetClass: target.className,
        isAction: target.classList.contains('snippet-action')
      });

      if (target.classList.contains('snippet-action')) {
        const action = target.getAttribute('data-action');
        log('debug', `Snippet action clicked: ${action} for snippet: ${snippet.shortcut}`);
        this.handleSnippetAction(snippet, action!);
      } else {
        log('debug', `Snippet selected for insertion: ${snippet.shortcut}`);
        this.insertSnippet(snippet);
      }
    });

    log('trace', `Snippet element created successfully for: ${snippet.shortcut}`);
    return element;
  }

  private async handleSnippetAction(snippet: Snippet, action: string): Promise<void> {
    log('info', `Handling snippet action: ${action} for snippet: ${snippet.shortcut}`);
    log('trace', 'Action details:', {
      snippetId: snippet.id,
      snippetName: snippet.name,
      action
    });

    try {
      switch (action) {
        case 'edit':
          log('debug', 'Executing edit action');
          await this.editSnippet(snippet);
          break;
        case 'copy':
          log('debug', 'Executing copy action');
          await this.copySnippet(snippet);
          break;
        case 'delete':
          log('debug', 'Executing delete action');
          await this.deleteSnippet(snippet);
          break;
        default:
          log('warn', `Unknown snippet action: ${action}`);
      }
      log('debug', `Snippet action completed: ${action}`);
    } catch (error) {
      log('error', `Failed to handle snippet action: ${action}`, error);
      log('trace', 'Action error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        snippet: snippet.shortcut,
        action
      });
    }
  }

  private async insertSnippet(snippet: Snippet): Promise<void> {
    log('info', `Inserting snippet: ${snippet.shortcut}`);
    log('trace', 'Insert snippet details:', {
      snippetId: snippet.id,
      snippetName: snippet.name,
      snippetShortcut: snippet.shortcut,
      contentLength: snippet.content.length
    });

    try {
      // Get current active tab
      log('trace', 'Querying for active tab');
      const [tab] = await this.browser.tabs.query({ active: true, currentWindow: true });
      log('debug', 'Active tab found:', {
        tabId: tab.id,
        tabUrl: tab.url,
        tabTitle: tab.title?.slice(0, 50)
      });

      if (tab.id) {
        log('trace', 'Sending insertSnippet message to content script');
        await this.browser.tabs.sendMessage(tab.id, {
          type: 'insertSnippet',
          data: { snippet }
        });
        log('debug', 'Insert message sent successfully');

        log('debug', 'Closing popup after successful insertion');
        window.close();
      } else {
        log('warn', 'No active tab ID found - cannot insert snippet');
      }
    } catch (error) {
      log('error', 'Failed to insert snippet:', error);
      log('trace', 'Insert error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        snippet: snippet.shortcut
      });
    }
  }

  private async editSnippet(snippet: Snippet): Promise<void> {
    log('info', `Opening edit for snippet: ${snippet.shortcut}`);
    log('trace', 'Edit snippet details:', {
      id: snippet.id,
      shortcut: snippet.shortcut,
      name: snippet.name,
      contentLength: snippet.content.length
    });

    try {
      // Open options page with snippet ID
      log('debug', 'Opening options page for snippet editing');
      await this.browser.runtime.openOptionsPage();
      log('debug', 'Options page opened successfully');
      // TODO: Pass snippet ID to options page
      log('warn', 'TODO: Implement snippet ID passing to options page');
    } catch (error) {
      log('error', 'Failed to open options page for editing:', error);
      log('trace', 'Edit error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        snippet: snippet.shortcut
      });
    }
  }

  private async copySnippet(snippet: Snippet): Promise<void> {
    log('info', `Copying snippet to clipboard: ${snippet.shortcut}`);
    log('trace', 'Copy snippet details:', {
      snippetId: snippet.id,
      snippetName: snippet.name,
      contentLength: snippet.content.length,
      contentPreview: snippet.content.slice(0, 50) + (snippet.content.length > 50 ? '...' : '')
    });

    try {
      log('trace', 'Writing snippet content to clipboard');
      await navigator.clipboard.writeText(snippet.content);
      log('debug', 'Snippet content copied to clipboard successfully');

      // Show success notification
      log('trace', 'Showing success notification');
      this.showNotification('Snippet copied to clipboard', 'success');
      log('info', `Snippet copied successfully: ${snippet.shortcut}`);
    } catch (error) {
      log('error', 'Failed to copy snippet:', error);
      log('trace', 'Copy error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        snippet: snippet.shortcut
      });
      this.showNotification('Failed to copy snippet', 'error');
    }
  }

  private async deleteSnippet(snippet: Snippet): Promise<void> {
    log('info', `Delete requested for snippet: ${snippet.shortcut}`);
    log('trace', 'Snippet to delete:', {
      id: snippet.id,
      shortcut: snippet.shortcut,
      name: snippet.name,
      usageCount: snippet.usageCount
    });

    const confirmMessage = `Delete snippet "${snippet.shortcut}"?`;
    log('debug', 'Showing confirmation dialog:', confirmMessage);

    if (!confirm(confirmMessage)) {
      log('debug', 'User cancelled deletion');
      return;
    }

    log('debug', 'User confirmed deletion - proceeding');

    try {
      log('trace', 'Sending deleteSnippet message to background');
      await this.browser.runtime.sendMessage({
        type: 'deleteSnippet',
        data: { id: snippet.id }
      });
      log('debug', 'Snippet deleted successfully from storage');

      // Remove from local array
      log('trace', 'Removing snippet from local array');
      const originalCount = this.snippets.length;
      this.snippets = this.snippets.filter(s => s.id !== snippet.id);
      log('debug', `Local array updated: ${originalCount} -> ${this.snippets.length} snippets`);

      log('trace', 'Re-rendering UI after deletion');
      this.render();

      log('trace', 'Showing success notification');
      this.showNotification('Snippet deleted', 'success');
      log('info', `Snippet deleted successfully: ${snippet.shortcut}`);
    } catch (error) {
      log('error', 'Failed to delete snippet:', error);
      log('trace', 'Deletion error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        snippetId: snippet.id,
        snippetShortcut: snippet.shortcut
      });
      this.showNotification('Failed to delete snippet', 'error');
    }
  }

  private async toggleExtension(): Promise<void> {
    log('info', 'Toggle extension requested');

    const currentEnabled = this.settings?.isEnabled ?? true;
    const newEnabled = !currentEnabled;

    log('debug', 'Extension toggle details:', {
      currentEnabled,
      newEnabled
    });

    try {
      log('trace', 'Sending saveSettings message to background');
      await this.browser.runtime.sendMessage({
        type: 'saveSettings',
        data: { settings: { isEnabled: newEnabled } }
      });
      log('debug', 'Settings saved successfully');

      if (this.settings) {
        log('trace', 'Updating local settings cache');
        this.settings.isEnabled = newEnabled;
        log('debug', 'Local settings updated');
      }

      log('trace', 'Updating status indicator');
      this.updateStatus();

      const message = newEnabled ? 'Extension enabled' : 'Extension disabled';
      log('trace', 'Showing toggle notification:', message);
      this.showNotification(message, 'info');

      log('info', `Extension toggled successfully: ${currentEnabled} -> ${newEnabled}`);
    } catch (error) {
      log('error', 'Failed to toggle extension:', error);
      log('trace', 'Toggle error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        currentEnabled,
        newEnabled
      });
    }
  }

  private async openSettings(): Promise<void> {
    log('info', 'Opening settings page');

    try {
      log('debug', 'Opening options page');
      await this.browser.runtime.openOptionsPage();
      log('debug', 'Options page opened successfully');

      log('debug', 'Closing popup');
      window.close();
    } catch (error) {
      log('error', 'Failed to open settings:', error);
      log('trace', 'Settings open error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
    }
  }

  private createNewSnippet(): void {
    log('info', 'Creating new snippet');

    try {
      // Open options page for creating new snippet
      log('debug', 'Opening options page for new snippet creation');
      this.browser.runtime.openOptionsPage();
      log('debug', 'Options page opened successfully');

      log('debug', 'Closing popup');
      window.close();
    } catch (error) {
      log('error', 'Failed to create new snippet:', error);
      log('trace', 'New snippet error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
    }
  }

  private importSnippets(): void {
    log('info', 'Import snippets requested');

    // Create file input for import
    log('trace', 'Creating file input element');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    log('trace', 'Setting up file input change handler');
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      log('debug', 'File selected for import:', {
        fileName: file?.name,
        fileSize: file?.size,
        fileType: file?.type
      });

      if (file) {
        this.handleImportFile(file);
      } else {
        log('debug', 'No file selected for import');
      }
    };

    log('debug', 'Triggering file input dialog');
    input.click();
    log('trace', 'File input dialog opened');
  }

  private async handleImportFile(file: File): Promise<void> {
    log('info', 'Handling import file');
    log('debug', 'Import file details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified).toISOString()
    });

    try {
      log('trace', 'Reading file content as text');
      const text = await file.text();
      log('debug', 'File content read successfully:', {
        textLength: text.length,
        textPreview: text.slice(0, 100) + (text.length > 100 ? '...' : '')
      });

      log('trace', 'Sending importData message to background');
      await this.browser.runtime.sendMessage({
        type: 'importData',
        data: { data: text }
      });
      log('debug', 'Data imported to background successfully');

      // Reload data
      log('trace', 'Reloading data after import');
      await this.loadData();
      log('trace', 'Re-rendering UI after import');
      this.render();

      log('trace', 'Showing success notification');
      this.showNotification('Snippets imported successfully', 'success');
      log('info', `Snippets imported successfully from file: ${file.name}`);
    } catch (error) {
      log('error', 'Failed to import snippets:', error);
      log('trace', 'Import error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        fileName: file.name,
        fileSize: file.size
      });
      this.showNotification('Failed to import snippets', 'error');
    }
  }

  private performSearch(): void {
    log('debug', 'Performing snippet search');
    log('trace', 'Search query:', this.state.searchQuery);
    this.renderSnippets();
    log('trace', 'Search completed - snippets re-rendered');
  }

  private showSnippetList(): void {
    log('trace', 'Showing snippet list');
    if (this.snippetList && this.emptyState) {
      this.snippetList.style.display = 'block';
      this.emptyState.style.display = 'none';
      log('trace', 'Snippet list visibility updated');
    } else {
      log('warn', 'Snippet list or empty state elements not found');
    }
  }

  private showEmptyState(): void {
    log('trace', 'Showing empty state');
    if (this.snippetList && this.emptyState) {
      this.snippetList.style.display = 'none';
      this.emptyState.style.display = 'block';
      log('trace', 'Empty state visibility updated');
    } else {
      log('warn', 'Snippet list or empty state elements not found');
    }
  }

  private hideLoading(): void {
    log('trace', 'Hiding loading indicator');
    if (this.loading) {
      this.loading.style.display = 'none';
      log('trace', 'Loading indicator hidden');
    } else {
      log('warn', 'Loading element not found');
    }
  }

  private updateFooterStats(): void {
    log('debug', 'Updating footer statistics');

    const count = this.snippets.length;
    const statsText = `${count} snippet${count !== 1 ? 's' : ''}`;

    log('trace', 'Footer stats details:', {
      snippetCount: count,
      statsText
    });

    if (this.footerStats) {
      this.footerStats.textContent = statsText;
      log('debug', 'Footer stats updated successfully');
    } else {
      log('warn', 'Footer stats element not found');
    }
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info'): void {
    log('debug', `Showing notification: ${type} - ${message}`);

    // Simple notification - could be enhanced
    const notification = document.createElement('div');
    notification.textContent = message;

    const backgroundColor = type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3';
    log('trace', 'Notification styling:', {
      message,
      type,
      backgroundColor
    });

    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: ${backgroundColor};
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
    `;

    log('trace', 'Appending notification to document body');
    document.body.appendChild(notification);

    log('trace', 'Scheduling notification removal in 3000ms');
    setTimeout(() => {
      if (notification.parentNode) {
        log('trace', 'Removing notification from DOM');
        notification.parentNode.removeChild(notification);
        log('debug', 'Notification removed');
      }
    }, 3000);
  }

  private escapeHtml(text: string): string {
    log('trace', `Escaping HTML for text: ${text.slice(0, 30)}${text.length > 30 ? '...' : ''}`);
    const div = document.createElement('div');
    div.textContent = text;
    const escaped = div.innerHTML;
    log('trace', 'HTML escaped successfully');
    return escaped;
  }
}

// Initialize popup when DOM is ready
log('info', 'Starting OpenBlaze popup initialization');
log('debug', 'Environment details:', {
  url: window.location.href,
  readyState: document.readyState,
  userAgent: navigator.userAgent.slice(0, 100),
  timestamp: new Date().toISOString()
});

if (document.readyState === 'loading') {
  log('debug', 'Document still loading - waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', () => {
    log('debug', 'DOMContentLoaded event fired - creating PopupManager');
    try {
      new PopupManager();
      log('info', 'OpenBlaze popup instance created successfully');
    } catch (error) {
      log('error', 'Failed to create popup instance:', error);
      log('trace', 'Initialization error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
    }
  });
} else {
  log('debug', 'Document already loaded - creating PopupManager immediately');
  try {
    new PopupManager();
    log('info', 'OpenBlaze popup instance created successfully');
  } catch (error) {
    log('error', 'Failed to create popup instance:', error);
    log('trace', 'Initialization error details:', {
      error,
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
  }
}
