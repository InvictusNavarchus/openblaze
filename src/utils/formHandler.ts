import { FormField, FormData } from '../types';
import { log, isEditableElement } from './index';

export class FormHandler {
  private static instance: FormHandler;

  static getInstance(): FormHandler {
    if (!FormHandler.instance) {
      FormHandler.instance = new FormHandler();
    }
    return FormHandler.instance;
  }

  /**
   * Detect and analyze forms on the current page
   */
  detectForms(): HTMLFormElement[] {
    return Array.from(document.querySelectorAll('form'));
  }

  /**
   * Get form data from a specific form
   */
  getFormData(form: HTMLFormElement): FormData {
    const fields: FormField[] = [];
    
    // Get all form controls
    const controls = form.querySelectorAll('input, textarea, select');
    
    controls.forEach(control => {
      const element = control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      
      if (this.shouldIncludeField(element)) {
        const field = this.createFormField(element);
        if (field) {
          fields.push(field);
        }
      }
    });

    return {
      fields,
      url: window.location.href,
      title: document.title
    };
  }

  /**
   * Fill form with snippet data
   */
  fillForm(form: HTMLFormElement, data: Record<string, any>): void {
    const formData = this.getFormData(form);
    
    formData.fields.forEach(field => {
      const value = data[field.name] || data[this.normalizeFieldName(field.name)];
      
      if (value !== undefined) {
        this.setFieldValue(field.element, value);
      }
    });
  }

  /**
   * Auto-fill common form fields
   */
  autoFillCommonFields(snippetData: Record<string, any>): void {
    const commonMappings = {
      // Email fields
      'email': ['email', 'e-mail', 'mail', 'email_address'],
      'name': ['name', 'full_name', 'fullname', 'first_name', 'last_name'],
      'phone': ['phone', 'telephone', 'mobile', 'phone_number'],
      'address': ['address', 'street', 'address_line_1'],
      'city': ['city', 'town'],
      'state': ['state', 'province', 'region'],
      'zip': ['zip', 'postal_code', 'postcode'],
      'country': ['country'],
      'company': ['company', 'organization', 'employer'],
      'title': ['title', 'job_title', 'position']
    };

    Object.entries(commonMappings).forEach(([dataKey, fieldNames]) => {
      const value = snippetData[dataKey];
      if (value) {
        fieldNames.forEach(fieldName => {
          this.fillFieldByName(fieldName, value);
        });
      }
    });
  }

  /**
   * Fill a specific field by name or selector
   */
  fillFieldByName(fieldName: string, value: any): boolean {
    // Try exact name match first
    let element = document.querySelector(`[name="${fieldName}"]`) as HTMLElement | null;

    // Try ID match
    if (!element) {
      element = document.getElementById(fieldName);
    }

    // Try partial name match
    if (!element) {
      element = document.querySelector(`[name*="${fieldName}"]`) as HTMLElement | null;
    }

    // Try placeholder match
    if (!element) {
      element = document.querySelector(`[placeholder*="${fieldName}"]`) as HTMLElement | null;
    }

    if (element && isEditableElement(element)) {
      this.setFieldValue(element, value);
      return true;
    }

    return false;
  }

  /**
   * Smart form field detection for snippet creation
   */
  suggestSnippetFromForm(form: HTMLFormElement): { shortcut: string; content: string; variables: string[] } {
    const formData = this.getFormData(form);
    const variables: string[] = [];
    let content = '';
    
    // Generate content template
    formData.fields.forEach(field => {
      const varName = this.normalizeFieldName(field.name);
      variables.push(varName);
      
      if (field.type === 'email') {
        content += `Email: {${varName}}\n`;
      } else if (field.name.toLowerCase().includes('name')) {
        content += `Name: {${varName}}\n`;
      } else if (field.name.toLowerCase().includes('phone')) {
        content += `Phone: {${varName}}\n`;
      } else {
        content += `${this.capitalizeFirst(field.name)}: {${varName}}\n`;
      }
    });

    // Generate shortcut suggestion
    const formTitle = form.getAttribute('title') || form.className || 'form';
    const shortcut = this.generateShortcut(formTitle);

    return {
      shortcut,
      content: content.trim(),
      variables
    };
  }

  /**
   * Handle form submission with snippet data
   */
  handleFormSubmission(form: HTMLFormElement, snippetData: Record<string, any>): void {
    // Fill form before submission
    this.fillForm(form, snippetData);
    
    // Trigger form validation
    this.triggerFormValidation(form);
    
    log('info', 'Form filled with snippet data');
  }

  /**
   * Private helper methods
   */
  private shouldIncludeField(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase();
    
    // Skip hidden fields, buttons, and non-input elements
    if (tagName === 'input') {
      const input = element as HTMLInputElement;
      const type = input.type.toLowerCase();
      
      return !['hidden', 'submit', 'button', 'reset', 'image'].includes(type);
    }
    
    return ['textarea', 'select'].includes(tagName);
  }

  private createFormField(element: HTMLElement): FormField | null {
    const tagName = element.tagName.toLowerCase();
    let type = 'text';
    let value: any = '';
    let name = '';

    if (tagName === 'input') {
      const input = element as HTMLInputElement;
      type = input.type;
      value = input.value;
      name = input.name || input.id || input.placeholder || '';
    } else if (tagName === 'textarea') {
      const textarea = element as HTMLTextAreaElement;
      type = 'textarea';
      value = textarea.value;
      name = textarea.name || textarea.id || textarea.placeholder || '';
    } else if (tagName === 'select') {
      const select = element as HTMLSelectElement;
      type = 'select';
      value = select.value;
      name = select.name || select.id || '';
    }

    if (!name) return null;

    return {
      name: name.toLowerCase(),
      type,
      value,
      element
    };
  }

  private setFieldValue(element: HTMLElement, value: any): void {
    const tagName = element.tagName.toLowerCase();
    
    if (tagName === 'input') {
      const input = element as HTMLInputElement;
      input.value = String(value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (tagName === 'textarea') {
      const textarea = element as HTMLTextAreaElement;
      textarea.value = String(value);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (tagName === 'select') {
      const select = element as HTMLSelectElement;
      select.value = String(value);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  private normalizeFieldName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
  }

  private generateShortcut(formTitle: string): string {
    return formTitle
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 8) || 'form';
  }

  private triggerFormValidation(form: HTMLFormElement): void {
    // Trigger HTML5 validation
    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      if (input instanceof HTMLInputElement) {
        input.checkValidity();
      }
    });
  }

  /**
   * Get form context for snippet suggestions
   */
  getFormContext(element: HTMLElement): { formType: string; fieldType: string; suggestions: string[] } {
    const form = element.closest('form');
    const suggestions: string[] = [];
    
    // Determine form type
    let formType = 'unknown';
    if (form) {
      const action = form.action.toLowerCase();
      const className = form.className.toLowerCase();
      
      if (action.includes('login') || className.includes('login')) {
        formType = 'login';
        suggestions.push('email', 'username');
      } else if (action.includes('register') || className.includes('register')) {
        formType = 'registration';
        suggestions.push('name', 'email', 'phone');
      } else if (action.includes('contact') || className.includes('contact')) {
        formType = 'contact';
        suggestions.push('name', 'email', 'phone', 'message');
      } else if (action.includes('checkout') || className.includes('checkout')) {
        formType = 'checkout';
        suggestions.push('addr', 'phone', 'email');
      }
    }

    // Determine field type
    let fieldType = 'text';
    if (element instanceof HTMLInputElement) {
      fieldType = element.type;
      
      const name = element.name.toLowerCase();
      const placeholder = element.placeholder.toLowerCase();
      
      if (name.includes('email') || placeholder.includes('email')) {
        suggestions.push('email');
      } else if (name.includes('name') || placeholder.includes('name')) {
        suggestions.push('name');
      } else if (name.includes('phone') || placeholder.includes('phone')) {
        suggestions.push('phone');
      } else if (name.includes('address') || placeholder.includes('address')) {
        suggestions.push('addr');
      }
    }

    return { formType, fieldType, suggestions };
  }
}

// Utility functions
export function detectForms(): HTMLFormElement[] {
  return FormHandler.getInstance().detectForms();
}

export function fillFormField(fieldName: string, value: any): boolean {
  return FormHandler.getInstance().fillFieldByName(fieldName, value);
}

export function autoFillForm(data: Record<string, any>): void {
  FormHandler.getInstance().autoFillCommonFields(data);
}

export function getFormContext(element: HTMLElement) {
  return FormHandler.getInstance().getFormContext(element);
}
