import { Snippet, Settings, SnippetFolder } from '../types';
import { getBrowser, log, generateId, debounce } from '../utils';

class OptionsManager {
  private browser = getBrowser();
  private snippets: Snippet[] = [];
  private settings: Settings | null = null;
  private currentSection = 'snippets';

  // DOM elements
  private navItems!: NodeListOf<HTMLElement>;
  private contentSections!: NodeListOf<HTMLElement>;
  private snippetList!: HTMLElement;
  private snippetSearch!: HTMLInputElement;
  private settingsForm!: HTMLFormElement;
  private toast!: HTMLElement;

  private debouncedSearch: () => void;

  constructor() {
    log('debug', 'OptionsManager constructor called');
    log('trace', 'Creating debounced search function with 300ms delay');
    this.debouncedSearch = debounce(() => this.performSnippetSearch(), 300);
    log('debug', 'Starting options page initialization');
    this.initialize();
    log('trace', 'OptionsManager constructor completed');
  }

  private async initialize(): Promise<void> {
    log('debug', 'Starting options page initialization');
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

      log('info', 'Options page initialized successfully');
      log('debug', 'Current state:', {
        snippetCount: this.snippets.length,
        hasSettings: !!this.settings,
        currentSection: this.currentSection
      });
    } catch (error) {
      log('error', 'Failed to initialize options page:', error);
      log('trace', 'Initialization error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
    }
  }

  private initializeDOM(): void {
    log('debug', 'Initializing DOM element references');

    log('trace', 'Querying navigation items');
    this.navItems = document.querySelectorAll('.nav-item');
    log('trace', `Found ${this.navItems.length} navigation items`);

    log('trace', 'Querying content sections');
    this.contentSections = document.querySelectorAll('.content-section');
    log('trace', `Found ${this.contentSections.length} content sections`);

    log('trace', 'Getting snippet list element');
    this.snippetList = document.getElementById('snippet-list') as HTMLElement;
    log('trace', 'Snippet list element found:', !!this.snippetList);

    log('trace', 'Getting snippet search input');
    this.snippetSearch = document.getElementById('snippet-search') as HTMLInputElement;
    log('trace', 'Snippet search input found:', !!this.snippetSearch);

    log('trace', 'Getting settings form');
    this.settingsForm = document.getElementById('settings-form') as HTMLFormElement;
    log('trace', 'Settings form found:', !!this.settingsForm);

    log('trace', 'Getting toast element');
    this.toast = document.getElementById('toast') as HTMLElement;
    log('trace', 'Toast element found:', !!this.toast);

    log('debug', 'DOM initialization completed', {
      navItems: this.navItems.length,
      contentSections: this.contentSections.length,
      hasSnippetList: !!this.snippetList,
      hasSnippetSearch: !!this.snippetSearch,
      hasSettingsForm: !!this.settingsForm,
      hasToast: !!this.toast
    });
  }

  private setupEventListeners(): void {
    log('debug', 'Setting up event listeners');

    // Navigation
    log('trace', `Setting up navigation listeners for ${this.navItems.length} items`);
    this.navItems.forEach((item, index) => {
      const section = item.getAttribute('data-section');
      log('trace', `Navigation item ${index}: section="${section}"`);

      item.addEventListener('click', (e) => {
        log('debug', `Navigation clicked: ${section}`);
        e.preventDefault();
        if (section) {
          this.switchSection(section);
        }
      });
    });
    log('debug', 'Navigation listeners setup completed');

    // Snippet search
    log('trace', 'Setting up snippet search listener');
    this.snippetSearch.addEventListener('input', (e) => {
      const query = (e.target as HTMLInputElement).value;
      log('trace', `Search input changed: "${query}"`);
      this.debouncedSearch();
    });
    log('debug', 'Snippet search listener setup completed');

    // New snippet button
    log('trace', 'Setting up new snippet button listener');
    const newSnippetBtn = document.getElementById('new-snippet-btn');
    if (newSnippetBtn) {
      newSnippetBtn.addEventListener('click', () => {
        log('debug', 'New snippet button clicked');
        this.createNewSnippet();
      });
      log('debug', 'New snippet button listener setup completed');
    } else {
      log('warn', 'New snippet button not found');
    }

    // Settings form
    log('trace', 'Setting up settings form listener');
    this.settingsForm.addEventListener('submit', (e) => {
      log('debug', 'Settings form submitted');
      e.preventDefault();
      this.saveSettings();
    });
    log('debug', 'Settings form listener setup completed');

    // Reset settings
    log('trace', 'Setting up reset settings button listener');
    const resetBtn = document.getElementById('reset-settings-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        log('debug', 'Reset settings button clicked');
        this.resetSettings();
      });
      log('debug', 'Reset settings button listener setup completed');
    } else {
      log('warn', 'Reset settings button not found');
    }

    // Import/Export
    log('trace', 'Setting up export button listener');
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        log('debug', 'Export button clicked');
        this.exportData();
      });
      log('debug', 'Export button listener setup completed');
    } else {
      log('warn', 'Export button not found');
    }

    log('trace', 'Setting up import button listener');
    const importBtn = document.getElementById('import-btn');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        log('debug', 'Import button clicked');
        this.importData();
      });
      log('debug', 'Import button listener setup completed');
    } else {
      log('warn', 'Import button not found');
    }

    log('trace', 'Setting up clear all button listener');
    const clearAllBtn = document.getElementById('clear-all-btn');
    if (clearAllBtn) {
      clearAllBtn.addEventListener('click', () => {
        log('debug', 'Clear all button clicked');
        this.clearAllData();
      });
      log('debug', 'Clear all button listener setup completed');
    } else {
      log('warn', 'Clear all button not found');
    }

    // File input for import
    log('trace', 'Setting up import file input listener');
    const importFile = document.getElementById('import-file') as HTMLInputElement;
    if (importFile) {
      importFile.addEventListener('change', (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        log('debug', 'Import file selected:', {
          fileName: file?.name,
          fileSize: file?.size,
          fileType: file?.type
        });
        if (file) {
          this.handleImportFile(file);
        }
      });
      log('debug', 'Import file input listener setup completed');
    } else {
      log('warn', 'Import file input not found');
    }

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

    log('trace', 'Rendering snippets section');
    this.renderSnippets();
    log('debug', 'Snippets section rendered');

    log('trace', 'Rendering settings section');
    this.renderSettings();
    log('debug', 'Settings section rendered');

    log('trace', 'Rendering statistics section');
    this.renderStatistics();
    log('debug', 'Statistics section rendered');

    log('info', 'UI render completed');
  }

  private switchSection(section: string): void {
    log('info', `Switching to section: ${section}`);
    log('trace', 'Previous section:', this.currentSection);

    this.currentSection = section;

    // Update navigation
    log('trace', 'Updating navigation active states');
    let activeNavCount = 0;
    this.navItems.forEach((item, index) => {
      const itemSection = item.getAttribute('data-section');
      const wasActive = item.classList.contains('active');

      item.classList.remove('active');
      if (itemSection === section) {
        item.classList.add('active');
        activeNavCount++;
        log('trace', `Navigation item ${index} activated for section: ${section}`);
      }

      if (wasActive && itemSection !== section) {
        log('trace', `Navigation item ${index} deactivated (was: ${itemSection})`);
      }
    });
    log('debug', `Navigation updated - ${activeNavCount} items active`);

    // Update content sections
    log('trace', 'Updating content section visibility');
    let activeSectionCount = 0;
    this.contentSections.forEach((contentSection, index) => {
      const wasActive = contentSection.classList.contains('active');
      contentSection.classList.remove('active');

      if (wasActive) {
        log('trace', `Content section ${index} deactivated`);
      }
    });

    const targetSection = document.getElementById(`${section}-section`);
    if (targetSection) {
      targetSection.classList.add('active');
      activeSectionCount++;
      log('debug', `Target section activated: ${section}-section`);
    } else {
      log('warn', `Target section not found: ${section}-section`);
    }

    // Load section-specific data
    log('trace', 'Checking for section-specific data loading');
    if (section === 'statistics') {
      log('debug', 'Loading statistics data for statistics section');
      this.renderStatistics();
    }

    log('info', `Section switch completed: ${section}`, {
      activeNavItems: activeNavCount,
      activeSections: activeSectionCount,
      targetSectionFound: !!targetSection
    });
  }

  private renderSnippets(): void {
    log('debug', 'Rendering snippets list');

    log('trace', 'Getting filtered snippets');
    const filteredSnippets = this.getFilteredSnippets();
    log('trace', `Filtered snippets count: ${filteredSnippets.length} (from ${this.snippets.length} total)`);

    if (filteredSnippets.length === 0) {
      log('debug', 'No snippets to display - showing empty state');
      this.snippetList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <h3>No snippets found</h3>
          <p>Create your first snippet to get started with text expansion.</p>
        </div>
      `;
      log('trace', 'Empty state HTML set');
      return;
    }

    log('trace', 'Clearing snippet list container');
    this.snippetList.innerHTML = '';

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

    const query = this.snippetSearch.value.toLowerCase();
    log('trace', `Search query: "${query}"`);

    if (!query) {
      log('trace', 'No search query - returning all snippets sorted by update time');
      const sorted = this.snippets.sort((a, b) => b.updatedAt - a.updatedAt);
      log('debug', `Returning ${sorted.length} snippets (no filter)`);
      return sorted;
    }

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
    }).sort((a, b) => b.updatedAt - a.updatedAt);

    log('debug', `Filtered ${filtered.length} snippets from ${this.snippets.length} total`);
    return filtered;
  }

  private createSnippetElement(snippet: Snippet): HTMLElement {
    log('trace', `Creating snippet element for: ${snippet.shortcut}`);

    const element = document.createElement('div');
    element.className = 'snippet-item';

    const contentPreview = snippet.content.substring(0, 100);
    const isContentTruncated = snippet.content.length > 100;

    log('trace', 'Snippet element details:', {
      shortcut: snippet.shortcut,
      name: snippet.name || 'Untitled',
      contentLength: snippet.content.length,
      contentPreview: contentPreview.slice(0, 30) + '...',
      usageCount: snippet.usageCount,
      isContentTruncated
    });

    element.innerHTML = `
      <div class="snippet-info">
        <h4>${this.escapeHtml(snippet.shortcut)}</h4>
        <p><strong>${this.escapeHtml(snippet.name || 'Untitled')}</strong></p>
        <p>${this.escapeHtml(contentPreview)}${isContentTruncated ? '...' : ''}</p>
        <p>Used ${snippet.usageCount} times</p>
      </div>
      <div class="snippet-actions">
        <button class="btn btn-secondary btn-small" data-action="edit">Edit</button>
        <button class="btn btn-secondary btn-small" data-action="duplicate">Duplicate</button>
        <button class="btn btn-danger btn-small" data-action="delete">Delete</button>
      </div>
    `;

    // Add event listeners
    log('trace', 'Adding action button event listeners');
    const actionButtons = element.querySelectorAll('[data-action]');
    log('trace', `Found ${actionButtons.length} action buttons`);

    actionButtons.forEach((button, index) => {
      const action = button.getAttribute('data-action');
      log('trace', `Setting up listener for button ${index}: ${action}`);

      button.addEventListener('click', (e) => {
        const clickedAction = (e.target as HTMLElement).getAttribute('data-action');
        log('debug', `Snippet action clicked: ${clickedAction} for snippet: ${snippet.shortcut}`);
        this.handleSnippetAction(snippet, clickedAction!);
      });
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
          this.editSnippet(snippet);
          break;
        case 'duplicate':
          log('debug', 'Executing duplicate action');
          await this.duplicateSnippet(snippet);
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

  private editSnippet(snippet: Snippet): void {
    log('info', `Opening edit modal for snippet: ${snippet.shortcut}`);
    log('trace', 'Edit snippet details:', {
      id: snippet.id,
      shortcut: snippet.shortcut,
      name: snippet.name,
      contentLength: snippet.content.length
    });

    // Create a simple modal for editing
    log('debug', 'Creating snippet edit modal');
    const modal = this.createSnippetModal(snippet);
    log('trace', 'Appending modal to document body');
    document.body.appendChild(modal);
    log('debug', 'Edit modal opened successfully');
  }

  private createSnippetModal(snippet?: Snippet): HTMLElement {
    const isEdit = !!snippet;
    log('debug', `Creating snippet modal - mode: ${isEdit ? 'edit' : 'create'}`);

    if (snippet) {
      log('trace', 'Modal for existing snippet:', {
        id: snippet.id,
        shortcut: snippet.shortcut,
        name: snippet.name,
        contentLength: snippet.content.length
      });
    }

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;
    log('trace', 'Modal overlay styles applied');

    const modalContent = `
      <div style="background: white; padding: 24px; border-radius: 8px; width: 500px; max-width: 90vw;">
        <h3>${isEdit ? 'Edit' : 'Create'} Snippet</h3>
        <form id="snippet-form">
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px;">Shortcut</label>
            <input type="text" id="snippet-shortcut" value="${snippet?.shortcut || ''}"
                   style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px;">Name</label>
            <input type="text" id="snippet-name" value="${snippet?.name || ''}"
                   style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px;">Content</label>
            <textarea id="snippet-content" rows="6"
                      style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" required>${snippet?.content || ''}</textarea>
          </div>
          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button type="button" class="btn btn-secondary" id="cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </div>
    `;

    modal.innerHTML = modalContent;
    log('trace', 'Modal HTML content set');

    // Event listeners
    log('trace', 'Setting up modal event listeners');

    const cancelBtn = modal.querySelector('#cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        log('debug', 'Cancel button clicked - closing modal');
        document.body.removeChild(modal);
        log('trace', 'Modal removed from DOM');
      });
      log('trace', 'Cancel button listener added');
    }

    const snippetForm = modal.querySelector('#snippet-form');
    if (snippetForm) {
      snippetForm.addEventListener('submit', async (e) => {
        log('debug', 'Snippet form submitted');
        e.preventDefault();

        const shortcut = (modal.querySelector('#snippet-shortcut') as HTMLInputElement).value;
        const name = (modal.querySelector('#snippet-name') as HTMLInputElement).value;
        const content = (modal.querySelector('#snippet-content') as HTMLTextAreaElement).value;

        log('trace', 'Form data collected:', {
          shortcut,
          name,
          contentLength: content.length,
          isEdit
        });

        try {
          const snippetData: Partial<Snippet> = {
            id: snippet?.id,
            shortcut,
            name,
            content,
            isEnabled: true,
            isDynamic: false,
            tags: [],
            variables: []
          };

          log('debug', 'Sending saveSnippet message to background');
          await this.browser.runtime.sendMessage({
            type: 'saveSnippet',
            data: { snippet: snippetData }
          });
          log('debug', 'Snippet saved successfully');

          log('trace', 'Reloading data after save');
          await this.loadData();
          log('trace', 'Re-rendering snippets list');
          this.renderSnippets();

          const successMessage = `Snippet ${isEdit ? 'updated' : 'created'} successfully`;
          log('info', successMessage);
          this.showToast(successMessage, 'success');

          log('trace', 'Closing modal after successful save');
          document.body.removeChild(modal);

        } catch (error) {
          log('error', 'Failed to save snippet:', error);
          log('trace', 'Save error details:', {
            error,
            stack: error instanceof Error ? error.stack : 'No stack trace',
            snippetData: { shortcut, name, contentLength: content.length }
          });
          this.showToast('Failed to save snippet', 'error');
        }
      });
      log('trace', 'Form submit listener added');
    }

    log('debug', 'Modal created with event listeners');
    return modal;
  }

  private async duplicateSnippet(snippet: Snippet): Promise<void> {
    log('info', `Duplicating snippet: ${snippet.shortcut}`);
    log('trace', 'Original snippet details:', {
      id: snippet.id,
      shortcut: snippet.shortcut,
      name: snippet.name,
      usageCount: snippet.usageCount,
      contentLength: snippet.content.length
    });

    try {
      const duplicated: Partial<Snippet> = {
        ...snippet,
        id: undefined,
        shortcut: snippet.shortcut + '_copy',
        name: (snippet.name || '') + ' (Copy)',
        usageCount: 0
      };

      log('debug', 'Duplicated snippet data:', {
        shortcut: duplicated.shortcut,
        name: duplicated.name,
        usageCount: duplicated.usageCount,
        hasId: !!duplicated.id
      });

      log('trace', 'Sending saveSnippet message for duplicate');
      await this.browser.runtime.sendMessage({
        type: 'saveSnippet',
        data: { snippet: duplicated }
      });
      log('debug', 'Duplicate snippet saved successfully');

      log('trace', 'Reloading data after duplication');
      await this.loadData();
      log('trace', 'Re-rendering snippets after duplication');
      this.renderSnippets();

      log('info', `Snippet duplicated successfully: ${snippet.shortcut} -> ${duplicated.shortcut}`);
      this.showToast('Snippet duplicated successfully', 'success');

    } catch (error) {
      log('error', 'Failed to duplicate snippet:', error);
      log('trace', 'Duplication error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        originalSnippet: snippet.shortcut
      });
      this.showToast('Failed to duplicate snippet', 'error');
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

      log('trace', 'Reloading data after deletion');
      await this.loadData();
      log('trace', 'Re-rendering snippets after deletion');
      this.renderSnippets();

      log('info', `Snippet deleted successfully: ${snippet.shortcut}`);
      this.showToast('Snippet deleted successfully', 'success');

    } catch (error) {
      log('error', 'Failed to delete snippet:', error);
      log('trace', 'Deletion error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        snippetId: snippet.id,
        snippetShortcut: snippet.shortcut
      });
      this.showToast('Failed to delete snippet', 'error');
    }
  }

  private createNewSnippet(): void {
    log('info', 'Creating new snippet');
    log('debug', 'Opening new snippet modal');

    const modal = this.createSnippetModal();
    log('trace', 'Appending new snippet modal to document body');
    document.body.appendChild(modal);
    log('debug', 'New snippet modal opened successfully');
  }

  private renderSettings(): void {
    log('debug', 'Rendering settings form');

    if (!this.settings) {
      log('warn', 'No settings available - skipping settings render');
      return;
    }

    log('trace', 'Current settings:', {
      isEnabled: this.settings.isEnabled,
      shortcutTrigger: this.settings.shortcutTrigger,
      expansionDelay: this.settings.expansionDelay,
      showNotifications: this.settings.showNotifications,
      theme: this.settings.theme
    });

    log('trace', 'Setting enabled checkbox');
    const enabledCheckbox = document.getElementById('enabled-checkbox') as HTMLInputElement;
    if (enabledCheckbox) {
      enabledCheckbox.checked = this.settings.isEnabled;
      log('trace', `Enabled checkbox set to: ${this.settings.isEnabled}`);
    } else {
      log('warn', 'Enabled checkbox element not found');
    }

    log('trace', 'Setting trigger select');
    const triggerSelect = document.getElementById('trigger-select') as HTMLSelectElement;
    if (triggerSelect) {
      triggerSelect.value = this.settings.shortcutTrigger;
      log('trace', `Trigger select set to: ${this.settings.shortcutTrigger}`);
    } else {
      log('warn', 'Trigger select element not found');
    }

    log('trace', 'Setting delay input');
    const delayInput = document.getElementById('delay-input') as HTMLInputElement;
    if (delayInput) {
      delayInput.value = this.settings.expansionDelay.toString();
      log('trace', `Delay input set to: ${this.settings.expansionDelay}`);
    } else {
      log('warn', 'Delay input element not found');
    }

    log('trace', 'Setting notifications checkbox');
    const notificationsCheckbox = document.getElementById('notifications-checkbox') as HTMLInputElement;
    if (notificationsCheckbox) {
      notificationsCheckbox.checked = this.settings.showNotifications;
      log('trace', `Notifications checkbox set to: ${this.settings.showNotifications}`);
    } else {
      log('warn', 'Notifications checkbox element not found');
    }

    log('trace', 'Setting theme select');
    const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
    if (themeSelect) {
      themeSelect.value = this.settings.theme;
      log('trace', `Theme select set to: ${this.settings.theme}`);
    } else {
      log('warn', 'Theme select element not found');
    }

    log('debug', 'Settings form rendered successfully');
  }

  private async saveSettings(): Promise<void> {
    log('info', 'Saving settings');

    try {
      log('trace', 'Collecting settings from form elements');

      const enabledCheckbox = document.getElementById('enabled-checkbox') as HTMLInputElement;
      const triggerSelect = document.getElementById('trigger-select') as HTMLSelectElement;
      const delayInput = document.getElementById('delay-input') as HTMLInputElement;
      const notificationsCheckbox = document.getElementById('notifications-checkbox') as HTMLInputElement;
      const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;

      const settings: Partial<Settings> = {
        isEnabled: enabledCheckbox?.checked ?? true,
        shortcutTrigger: (triggerSelect?.value as 'space' | 'tab' | 'enter') ?? 'space',
        expansionDelay: parseInt(delayInput?.value ?? '100'),
        showNotifications: notificationsCheckbox?.checked ?? true,
        theme: (themeSelect?.value as 'light' | 'dark' | 'auto') ?? 'auto'
      };

      log('debug', 'Settings collected from form:', settings);
      log('trace', 'Form element states:', {
        enabledFound: !!enabledCheckbox,
        triggerFound: !!triggerSelect,
        delayFound: !!delayInput,
        notificationsFound: !!notificationsCheckbox,
        themeFound: !!themeSelect
      });

      log('trace', 'Sending saveSettings message to background');
      await this.browser.runtime.sendMessage({
        type: 'saveSettings',
        data: { settings }
      });
      log('debug', 'Settings saved to background successfully');

      if (this.settings) {
        log('trace', 'Updating local settings cache');
        this.settings = { ...this.settings, ...settings };
        log('debug', 'Local settings cache updated');
      }

      log('info', 'Settings saved successfully');
      this.showToast('Settings saved successfully', 'success');

    } catch (error) {
      log('error', 'Failed to save settings:', error);
      log('trace', 'Settings save error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      this.showToast('Failed to save settings', 'error');
    }
  }

  private resetSettings(): void {
    log('info', 'Reset settings requested');

    const confirmMessage = 'Reset all settings to defaults?';
    log('debug', 'Showing reset confirmation dialog:', confirmMessage);

    if (!confirm(confirmMessage)) {
      log('debug', 'User cancelled settings reset');
      return;
    }

    log('debug', 'User confirmed settings reset - applying defaults');

    // Reset form to defaults
    log('trace', 'Resetting enabled checkbox to true');
    const enabledCheckbox = document.getElementById('enabled-checkbox') as HTMLInputElement;
    if (enabledCheckbox) {
      enabledCheckbox.checked = true;
    }

    log('trace', 'Resetting trigger select to space');
    const triggerSelect = document.getElementById('trigger-select') as HTMLSelectElement;
    if (triggerSelect) {
      triggerSelect.value = 'space';
    }

    log('trace', 'Resetting delay input to 100');
    const delayInput = document.getElementById('delay-input') as HTMLInputElement;
    if (delayInput) {
      delayInput.value = '100';
    }

    log('trace', 'Resetting notifications checkbox to true');
    const notificationsCheckbox = document.getElementById('notifications-checkbox') as HTMLInputElement;
    if (notificationsCheckbox) {
      notificationsCheckbox.checked = true;
    }

    log('trace', 'Resetting theme select to auto');
    const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
    if (themeSelect) {
      themeSelect.value = 'auto';
    }

    log('info', 'Settings reset to defaults completed');
  }

  private async exportData(): Promise<void> {
    log('info', 'Exporting data');

    try {
      log('trace', 'Sending exportData message to background');
      const response = await this.browser.runtime.sendMessage({
        type: 'exportData'
      });
      log('debug', 'Export data received from background');

      const data = response.data;
      log('trace', 'Export data details:', {
        dataLength: data?.length || 0,
        dataType: typeof data
      });

      log('trace', 'Creating blob for download');
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const filename = `openblaze-backup-${new Date().toISOString().split('T')[0]}.json`;
      log('debug', 'Download filename:', filename);

      log('trace', 'Creating download link');
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      log('debug', 'Download triggered');

      log('trace', 'Cleaning up blob URL');
      URL.revokeObjectURL(url);

      log('info', 'Data exported successfully');
      this.showToast('Data exported successfully', 'success');

    } catch (error) {
      log('error', 'Failed to export data:', error);
      log('trace', 'Export error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      this.showToast('Failed to export data', 'error');
    }
  }

  private importData(): void {
    log('info', 'Import data requested');

    const input = document.getElementById('import-file') as HTMLInputElement;
    if (input) {
      log('debug', 'Triggering file input click');
      input.click();
      log('trace', 'File input dialog opened');
    } else {
      log('error', 'Import file input element not found');
    }
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

      log('trace', 'Reloading data after import');
      await this.loadData();
      log('trace', 'Re-rendering UI after import');
      this.render();

      log('info', `Data imported successfully from file: ${file.name}`);
      this.showToast('Data imported successfully', 'success');

    } catch (error) {
      log('error', 'Failed to import data:', error);
      log('trace', 'Import error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        fileName: file.name,
        fileSize: file.size
      });
      this.showToast('Failed to import data', 'error');
    }
  }

  private async clearAllData(): Promise<void> {
    log('info', 'Clear all data requested');
    log('debug', `Current data state: ${this.snippets.length} snippets`);

    const firstConfirm = 'This will delete ALL snippets and reset settings. Are you sure?';
    log('debug', 'Showing first confirmation dialog:', firstConfirm);
    if (!confirm(firstConfirm)) {
      log('debug', 'User cancelled at first confirmation');
      return;
    }

    const secondConfirm = 'This action cannot be undone. Continue?';
    log('debug', 'Showing second confirmation dialog:', secondConfirm);
    if (!confirm(secondConfirm)) {
      log('debug', 'User cancelled at second confirmation');
      return;
    }

    log('warn', 'User confirmed data clearing - proceeding with deletion');

    try {
      // Clear all snippets
      log('debug', `Starting deletion of ${this.snippets.length} snippets`);
      for (let i = 0; i < this.snippets.length; i++) {
        const snippet = this.snippets[i];
        log('trace', `Deleting snippet ${i + 1}/${this.snippets.length}: ${snippet.shortcut}`);

        await this.browser.runtime.sendMessage({
          type: 'deleteSnippet',
          data: { id: snippet.id }
        });

        log('trace', `Snippet deleted: ${snippet.shortcut}`);
      }
      log('debug', 'All snippets deleted successfully');

      log('trace', 'Reloading data after clearing');
      await this.loadData();
      log('trace', 'Re-rendering UI after clearing');
      this.render();

      log('info', 'All data cleared successfully');
      this.showToast('All data cleared successfully', 'success');

    } catch (error) {
      log('error', 'Failed to clear data:', error);
      log('trace', 'Clear data error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace',
        snippetCount: this.snippets.length
      });
      this.showToast('Failed to clear data', 'error');
    }
  }

  private renderStatistics(): void {
    log('debug', 'Rendering statistics');

    const statsGrid = document.getElementById('stats-grid');
    if (!statsGrid) {
      log('warn', 'Stats grid element not found - skipping statistics render');
      return;
    }

    log('trace', 'Calculating statistics from snippets');
    const totalSnippets = this.snippets.length;
    const totalExpansions = this.snippets.reduce((sum, s) => sum + s.usageCount, 0);
    const avgKeystrokes = Math.round(this.snippets.reduce((sum, s) => sum + s.content.length, 0) / Math.max(totalSnippets, 1));
    const keystrokesSaved = this.snippets.reduce((sum, s) => sum + (s.content.length - s.shortcut.length) * s.usageCount, 0);

    const stats = {
      totalSnippets,
      totalExpansions,
      avgKeystrokes,
      keystrokesSaved
    };

    log('debug', 'Calculated statistics:', stats);

    log('trace', 'Generating statistics HTML');
    const statsHTML = `
      <div class="stat-card">
        <div class="stat-number">${totalSnippets}</div>
        <div class="stat-label">Total Snippets</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${totalExpansions}</div>
        <div class="stat-label">Total Expansions</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${avgKeystrokes}</div>
        <div class="stat-label">Avg. Content Length</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${keystrokesSaved}</div>
        <div class="stat-label">Keystrokes Saved</div>
      </div>
    `;

    statsGrid.innerHTML = statsHTML;
    log('info', 'Statistics rendered successfully', stats);
  }

  private performSnippetSearch(): void {
    log('debug', 'Performing snippet search');
    log('trace', 'Search query:', this.snippetSearch.value);
    this.renderSnippets();
    log('trace', 'Search completed - snippets re-rendered');
  }

  private showToast(message: string, type: 'success' | 'error' = 'success'): void {
    log('debug', `Showing toast: ${type} - ${message}`);

    this.toast.textContent = message;
    this.toast.className = `toast ${type} show`;

    log('trace', 'Toast displayed, scheduling hide in 3000ms');
    setTimeout(() => {
      log('trace', 'Hiding toast');
      this.toast.classList.remove('show');
    }, 3000);
  }

  private escapeHtml(text: string): string {
    log('trace', `Escaping HTML for text: ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`);
    const div = document.createElement('div');
    div.textContent = text;
    const escaped = div.innerHTML;
    log('trace', 'HTML escaped successfully');
    return escaped;
  }
}

// Initialize options page when DOM is ready
log('info', 'Starting OpenBlaze options page initialization');
log('debug', 'Environment details:', {
  url: window.location.href,
  readyState: document.readyState,
  userAgent: navigator.userAgent.slice(0, 100),
  timestamp: new Date().toISOString()
});

if (document.readyState === 'loading') {
  log('debug', 'Document still loading - waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', () => {
    log('debug', 'DOMContentLoaded event fired - creating OptionsManager');
    try {
      new OptionsManager();
      log('info', 'OpenBlaze options page instance created successfully');
    } catch (error) {
      log('error', 'Failed to create options page instance:', error);
      log('trace', 'Initialization error details:', {
        error,
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
    }
  });
} else {
  log('debug', 'Document already loaded - creating OptionsManager immediately');
  try {
    new OptionsManager();
    log('info', 'OpenBlaze options page instance created successfully');
  } catch (error) {
    log('error', 'Failed to create options page instance:', error);
    log('trace', 'Initialization error details:', {
      error,
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
  }
}
