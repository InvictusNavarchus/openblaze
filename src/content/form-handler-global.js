(function () {
  "use strict";

  // Access global utilities
  const { log, isEditableElement } = window.OpenBlaze_Utils;

  class FormHandler {
    constructor() {
      // Singleton pattern
      if (FormHandler.instance) {
        return FormHandler.instance;
      }
      FormHandler.instance = this;
    }

    static getInstance() {
      if (!FormHandler.instance) {
        FormHandler.instance = new FormHandler();
      }
      return FormHandler.instance;
    }

    /**
     * Detect and analyze forms on the current page
     */
    detectForms() {
      return Array.from(document.querySelectorAll('form'));
    }

    /**
     * Get form data from a specific form
     */
    getFormData(form) {
      const fields = [];
      
      // Get all form controls
      const controls = form.querySelectorAll('input, textarea, select');
      
      controls.forEach(control => {
        if (this.shouldIncludeField(control)) {
          const field = this.createFormField(control);
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
    fillForm(form, data) {
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
    autoFillCommonFields(snippetData) {
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
    fillFieldByName(fieldName, value) {
      // Try exact name match first
      let element = document.querySelector(`[name="${fieldName}"]`);

      // Try ID match
      if (!element) {
        element = document.getElementById(fieldName);
      }

      // Try partial name match
      if (!element) {
        element = document.querySelector(`[name*="${fieldName}"]`);
      }

      // Try placeholder match
      if (!element) {
        element = document.querySelector(`[placeholder*="${fieldName}"]`);
      }

      if (element && isEditableElement(element)) {
        this.setFieldValue(element, value);
        return true;
      }

      return false;
    }

    /**
     * Get form context for snippet suggestions
     */
    getFormContext(element) {
      const form = element.closest('form');
      const suggestions = [];
      
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

    /**
     * Private helper methods
     */
    shouldIncludeField(element) {
      const tagName = element.tagName.toLowerCase();
      
      // Skip hidden fields, buttons, and non-input elements
      if (tagName === 'input') {
        const type = element.type.toLowerCase();
        return !['hidden', 'submit', 'button', 'reset', 'image'].includes(type);
      }
      
      return ['textarea', 'select'].includes(tagName);
    }

    createFormField(element) {
      const tagName = element.tagName.toLowerCase();
      let type = 'text';
      let value = '';
      let name = '';

      if (tagName === 'input') {
        type = element.type;
        value = element.value;
        name = element.name || element.id || element.placeholder || '';
      } else if (tagName === 'textarea') {
        type = 'textarea';
        value = element.value;
        name = element.name || element.id || element.placeholder || '';
      } else if (tagName === 'select') {
        type = 'select';
        value = element.value;
        name = element.name || element.id || '';
      }

      if (!name) return null;

      return {
        name: name.toLowerCase(),
        type,
        value,
        element
      };
    }

    setFieldValue(element, value) {
      const tagName = element.tagName.toLowerCase();
      
      if (tagName === 'input') {
        element.value = String(value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (tagName === 'textarea') {
        element.value = String(value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (tagName === 'select') {
        element.value = String(value);
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    normalizeFieldName(name) {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    }
  }

  // Utility functions
  function detectForms() {
    return FormHandler.getInstance().detectForms();
  }

  function fillFormField(fieldName, value) {
    return FormHandler.getInstance().fillFieldByName(fieldName, value);
  }

  function autoFillForm(data) {
    FormHandler.getInstance().autoFillCommonFields(data);
  }

  function getFormContext(element) {
    return FormHandler.getInstance().getFormContext(element);
  }

  // Expose to global scope
  window.OpenBlaze_FormHandler = {
    FormHandler,
    detectForms,
    fillFormField,
    autoFillForm,
    getFormContext
  };

})();
