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
    this.debouncedSearch = debounce(() => this.performSnippetSearch(), 300);
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.initializeDOM();
      this.setupEventListeners();
      await this.loadData();
      this.render();
      log('info', 'Options page initialized');
    } catch (error) {
      log('error', 'Failed to initialize options page:', error);
    }
  }

  private initializeDOM(): void {
    this.navItems = document.querySelectorAll('.nav-item');
    this.contentSections = document.querySelectorAll('.content-section');
    this.snippetList = document.getElementById('snippet-list') as HTMLElement;
    this.snippetSearch = document.getElementById('snippet-search') as HTMLInputElement;
    this.settingsForm = document.getElementById('settings-form') as HTMLFormElement;
    this.toast = document.getElementById('toast') as HTMLElement;
  }

  private setupEventListeners(): void {
    // Navigation
    this.navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.getAttribute('data-section');
        if (section) {
          this.switchSection(section);
        }
      });
    });

    // Snippet search
    this.snippetSearch.addEventListener('input', () => {
      this.debouncedSearch();
    });

    // New snippet button
    document.getElementById('new-snippet-btn')?.addEventListener('click', () => {
      this.createNewSnippet();
    });

    // Settings form
    this.settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveSettings();
    });

    // Reset settings
    document.getElementById('reset-settings-btn')?.addEventListener('click', () => {
      this.resetSettings();
    });

    // Import/Export
    document.getElementById('export-btn')?.addEventListener('click', () => {
      this.exportData();
    });

    document.getElementById('import-btn')?.addEventListener('click', () => {
      this.importData();
    });

    document.getElementById('clear-all-btn')?.addEventListener('click', () => {
      this.clearAllData();
    });

    // File input for import
    const importFile = document.getElementById('import-file') as HTMLInputElement;
    importFile?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        this.handleImportFile(file);
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
    this.renderSnippets();
    this.renderSettings();
    this.renderStatistics();
  }

  private switchSection(section: string): void {
    this.currentSection = section;

    // Update navigation
    this.navItems.forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('data-section') === section) {
        item.classList.add('active');
      }
    });

    // Update content sections
    this.contentSections.forEach(section => {
      section.classList.remove('active');
    });

    const targetSection = document.getElementById(`${section}-section`);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Load section-specific data
    if (section === 'statistics') {
      this.renderStatistics();
    }
  }

  private renderSnippets(): void {
    const filteredSnippets = this.getFilteredSnippets();
    
    if (filteredSnippets.length === 0) {
      this.snippetList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📝</div>
          <h3>No snippets found</h3>
          <p>Create your first snippet to get started with text expansion.</p>
        </div>
      `;
      return;
    }

    this.snippetList.innerHTML = '';
    
    filteredSnippets.forEach(snippet => {
      const element = this.createSnippetElement(snippet);
      this.snippetList.appendChild(element);
    });
  }

  private getFilteredSnippets(): Snippet[] {
    const query = this.snippetSearch.value.toLowerCase();
    
    if (!query) {
      return this.snippets.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    return this.snippets.filter(snippet => 
      snippet.shortcut.toLowerCase().includes(query) ||
      snippet.name.toLowerCase().includes(query) ||
      snippet.content.toLowerCase().includes(query) ||
      snippet.tags?.some(tag => tag.toLowerCase().includes(query))
    ).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  private createSnippetElement(snippet: Snippet): HTMLElement {
    const element = document.createElement('div');
    element.className = 'snippet-item';
    element.innerHTML = `
      <div class="snippet-info">
        <h4>${this.escapeHtml(snippet.shortcut)}</h4>
        <p><strong>${this.escapeHtml(snippet.name || 'Untitled')}</strong></p>
        <p>${this.escapeHtml(snippet.content.substring(0, 100))}${snippet.content.length > 100 ? '...' : ''}</p>
        <p>Used ${snippet.usageCount} times</p>
      </div>
      <div class="snippet-actions">
        <button class="btn btn-secondary btn-small" data-action="edit">Edit</button>
        <button class="btn btn-secondary btn-small" data-action="duplicate">Duplicate</button>
        <button class="btn btn-danger btn-small" data-action="delete">Delete</button>
      </div>
    `;

    // Add event listeners
    element.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', (e) => {
        const action = (e.target as HTMLElement).getAttribute('data-action');
        this.handleSnippetAction(snippet, action!);
      });
    });

    return element;
  }

  private async handleSnippetAction(snippet: Snippet, action: string): Promise<void> {
    switch (action) {
      case 'edit':
        this.editSnippet(snippet);
        break;
      case 'duplicate':
        await this.duplicateSnippet(snippet);
        break;
      case 'delete':
        await this.deleteSnippet(snippet);
        break;
    }
  }

  private editSnippet(snippet: Snippet): void {
    // Create a simple modal for editing
    const modal = this.createSnippetModal(snippet);
    document.body.appendChild(modal);
  }

  private createSnippetModal(snippet?: Snippet): HTMLElement {
    const isEdit = !!snippet;
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

    modal.innerHTML = `
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

    // Event listeners
    modal.querySelector('#cancel-btn')?.addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    modal.querySelector('#snippet-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const shortcut = (modal.querySelector('#snippet-shortcut') as HTMLInputElement).value;
      const name = (modal.querySelector('#snippet-name') as HTMLInputElement).value;
      const content = (modal.querySelector('#snippet-content') as HTMLTextAreaElement).value;

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

        await this.browser.runtime.sendMessage({
          type: 'saveSnippet',
          data: { snippet: snippetData }
        });

        await this.loadData();
        this.renderSnippets();
        this.showToast(`Snippet ${isEdit ? 'updated' : 'created'} successfully`, 'success');
        document.body.removeChild(modal);

      } catch (error) {
        log('error', 'Failed to save snippet:', error);
        this.showToast('Failed to save snippet', 'error');
      }
    });

    return modal;
  }

  private async duplicateSnippet(snippet: Snippet): Promise<void> {
    try {
      const duplicated: Partial<Snippet> = {
        ...snippet,
        id: undefined,
        shortcut: snippet.shortcut + '_copy',
        name: (snippet.name || '') + ' (Copy)',
        usageCount: 0
      };

      await this.browser.runtime.sendMessage({
        type: 'saveSnippet',
        data: { snippet: duplicated }
      });

      await this.loadData();
      this.renderSnippets();
      this.showToast('Snippet duplicated successfully', 'success');

    } catch (error) {
      log('error', 'Failed to duplicate snippet:', error);
      this.showToast('Failed to duplicate snippet', 'error');
    }
  }

  private async deleteSnippet(snippet: Snippet): Promise<void> {
    if (!confirm(`Delete snippet "${snippet.shortcut}"?`)) return;

    try {
      await this.browser.runtime.sendMessage({
        type: 'deleteSnippet',
        data: { id: snippet.id }
      });

      await this.loadData();
      this.renderSnippets();
      this.showToast('Snippet deleted successfully', 'success');

    } catch (error) {
      log('error', 'Failed to delete snippet:', error);
      this.showToast('Failed to delete snippet', 'error');
    }
  }

  private createNewSnippet(): void {
    const modal = this.createSnippetModal();
    document.body.appendChild(modal);
  }

  private renderSettings(): void {
    if (!this.settings) return;

    (document.getElementById('enabled-checkbox') as HTMLInputElement).checked = this.settings.isEnabled;
    (document.getElementById('trigger-select') as HTMLSelectElement).value = this.settings.shortcutTrigger;
    (document.getElementById('delay-input') as HTMLInputElement).value = this.settings.expansionDelay.toString();
    (document.getElementById('notifications-checkbox') as HTMLInputElement).checked = this.settings.showNotifications;
    (document.getElementById('theme-select') as HTMLSelectElement).value = this.settings.theme;
  }

  private async saveSettings(): Promise<void> {
    try {
      const settings: Partial<Settings> = {
        isEnabled: (document.getElementById('enabled-checkbox') as HTMLInputElement).checked,
        shortcutTrigger: (document.getElementById('trigger-select') as HTMLSelectElement).value as 'space' | 'tab' | 'enter',
        expansionDelay: parseInt((document.getElementById('delay-input') as HTMLInputElement).value),
        showNotifications: (document.getElementById('notifications-checkbox') as HTMLInputElement).checked,
        theme: (document.getElementById('theme-select') as HTMLSelectElement).value as 'light' | 'dark' | 'auto'
      };

      await this.browser.runtime.sendMessage({
        type: 'saveSettings',
        data: { settings }
      });

      if (this.settings) {
        this.settings = { ...this.settings, ...settings };
      }
      this.showToast('Settings saved successfully', 'success');

    } catch (error) {
      log('error', 'Failed to save settings:', error);
      this.showToast('Failed to save settings', 'error');
    }
  }

  private resetSettings(): void {
    if (!confirm('Reset all settings to defaults?')) return;
    
    // Reset form to defaults
    (document.getElementById('enabled-checkbox') as HTMLInputElement).checked = true;
    (document.getElementById('trigger-select') as HTMLSelectElement).value = 'space';
    (document.getElementById('delay-input') as HTMLInputElement).value = '100';
    (document.getElementById('notifications-checkbox') as HTMLInputElement).checked = true;
    (document.getElementById('theme-select') as HTMLSelectElement).value = 'auto';
  }

  private async exportData(): Promise<void> {
    try {
      const response = await this.browser.runtime.sendMessage({
        type: 'exportData'
      });

      const data = response.data;
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `openblaze-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      URL.revokeObjectURL(url);
      this.showToast('Data exported successfully', 'success');

    } catch (error) {
      log('error', 'Failed to export data:', error);
      this.showToast('Failed to export data', 'error');
    }
  }

  private importData(): void {
    const input = document.getElementById('import-file') as HTMLInputElement;
    input.click();
  }

  private async handleImportFile(file: File): Promise<void> {
    try {
      const text = await file.text();
      
      await this.browser.runtime.sendMessage({
        type: 'importData',
        data: { data: text }
      });

      await this.loadData();
      this.render();
      this.showToast('Data imported successfully', 'success');

    } catch (error) {
      log('error', 'Failed to import data:', error);
      this.showToast('Failed to import data', 'error');
    }
  }

  private async clearAllData(): Promise<void> {
    if (!confirm('This will delete ALL snippets and reset settings. Are you sure?')) return;
    if (!confirm('This action cannot be undone. Continue?')) return;

    try {
      // Clear all snippets
      for (const snippet of this.snippets) {
        await this.browser.runtime.sendMessage({
          type: 'deleteSnippet',
          data: { id: snippet.id }
        });
      }

      await this.loadData();
      this.render();
      this.showToast('All data cleared successfully', 'success');

    } catch (error) {
      log('error', 'Failed to clear data:', error);
      this.showToast('Failed to clear data', 'error');
    }
  }

  private renderStatistics(): void {
    const statsGrid = document.getElementById('stats-grid');
    if (!statsGrid) return;

    const totalSnippets = this.snippets.length;
    const totalExpansions = this.snippets.reduce((sum, s) => sum + s.usageCount, 0);
    const avgKeystrokes = Math.round(this.snippets.reduce((sum, s) => sum + s.content.length, 0) / Math.max(totalSnippets, 1));
    const keystrokesSaved = this.snippets.reduce((sum, s) => sum + (s.content.length - s.shortcut.length) * s.usageCount, 0);

    statsGrid.innerHTML = `
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
  }

  private performSnippetSearch(): void {
    this.renderSnippets();
  }

  private showToast(message: string, type: 'success' | 'error' = 'success'): void {
    this.toast.textContent = message;
    this.toast.className = `toast ${type} show`;
    
    setTimeout(() => {
      this.toast.classList.remove('show');
    }, 3000);
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize options page when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new OptionsManager());
} else {
  new OptionsManager();
}
