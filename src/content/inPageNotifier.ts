/// <reference path="./global-types.d.ts" />

import type { NotificationData } from '../types';

(function () {
  "use strict";

  // Access global utilities
  const { log } = window.OpenBlaze_Utils;

  interface NotificationElement extends HTMLElement {
    _openBlazeNotification?: boolean;
  }

  class InPageNotifier {
  private container: HTMLElement | null = null;
  private notifications: Map<string, NotificationElement> = new Map();
  private notificationCount = 0;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    this.createContainer();
    this.setupStyles();
  }

  private createContainer(): void {
    // Create notification container
    this.container = document.createElement('div');
    this.container.id = 'openblaze-notification-container';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Add to document
    if (document.body) {
      document.body.appendChild(this.container);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(this.container!);
      });
    }
  }

  private setupStyles(): void {
    // Inject CSS styles
    const styleId = 'openblaze-notification-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .openblaze-notification {
        display: flex;
        align-items: center;
        gap: 12px;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        max-width: 350px;
        pointer-events: auto;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
      }

      .openblaze-notification.show {
        opacity: 1;
        transform: translateX(0);
      }

      .openblaze-notification.success {
        border-left: 4px solid #4caf50;
      }

      .openblaze-notification.error {
        border-left: 4px solid #f44336;
      }

      .openblaze-notification.warning {
        border-left: 4px solid #ff9800;
      }

      .openblaze-notification.info {
        border-left: 4px solid #2196f3;
      }

      .openblaze-notification-icon {
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        color: white;
      }

      .openblaze-notification.success .openblaze-notification-icon {
        background: #4caf50;
      }

      .openblaze-notification.error .openblaze-notification-icon {
        background: #f44336;
      }

      .openblaze-notification.warning .openblaze-notification-icon {
        background: #ff9800;
      }

      .openblaze-notification.info .openblaze-notification-icon {
        background: #2196f3;
      }

      .openblaze-notification-content {
        flex: 1;
        min-width: 0;
      }

      .openblaze-notification-title {
        font-weight: 600;
        font-size: 14px;
        color: #333;
        margin: 0 0 4px 0;
        line-height: 1.2;
      }

      .openblaze-notification-message {
        font-size: 13px;
        color: #666;
        margin: 0;
        line-height: 1.3;
        word-wrap: break-word;
      }

      .openblaze-notification-close {
        flex-shrink: 0;
        background: none;
        border: none;
        font-size: 18px;
        color: #999;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background-color 0.2s;
      }

      .openblaze-notification-close:hover {
        background-color: #f0f0f0;
        color: #666;
      }

      .openblaze-notification-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 2px;
        background: #00acc0;
        transition: width linear;
      }

      .openblaze-notification-actions {
        display: flex;
        gap: 8px;
        margin-top: 8px;
      }

      .openblaze-notification-action {
        background: #00acc0;
        color: white;
        border: none;
        padding: 4px 12px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: background-color 0.2s;
      }

      .openblaze-notification-action:hover {
        background: #0097a7;
      }

      .openblaze-notification-action.secondary {
        background: transparent;
        color: #00acc0;
        border: 1px solid #00acc0;
      }

      .openblaze-notification-action.secondary:hover {
        background: #00acc0;
        color: white;
      }
    `;

    document.head.appendChild(style);
  }

  public show(data: NotificationData): string {
    if (!this.container) return '';

    const id = `notification-${++this.notificationCount}`;
    const notification = this.createNotification(id, data);
    
    this.notifications.set(id, notification);
    this.container.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    // Auto-hide after duration
    if (data.duration !== 0) {
      const duration = data.duration || 5000;
      this.scheduleHide(id, duration);
    }

    return id;
  }

  public hide(id: string): void {
    const notification = this.notifications.get(id);
    if (!notification) return;

    notification.classList.remove('show');
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      this.notifications.delete(id);
    }, 300);
  }

  public hideAll(): void {
    for (const id of this.notifications.keys()) {
      this.hide(id);
    }
  }

  private createNotification(id: string, data: NotificationData): NotificationElement {
    const notification = document.createElement('div') as NotificationElement;
    notification.className = `openblaze-notification ${data.type}`;
    notification._openBlazeNotification = true;

    // Icon
    const icon = document.createElement('div');
    icon.className = 'openblaze-notification-icon';
    icon.textContent = this.getIconForType(data.type);

    // Content
    const content = document.createElement('div');
    content.className = 'openblaze-notification-content';

    const title = document.createElement('div');
    title.className = 'openblaze-notification-title';
    title.textContent = data.title;

    const message = document.createElement('div');
    message.className = 'openblaze-notification-message';
    message.textContent = data.message;

    content.appendChild(title);
    content.appendChild(message);

    // Actions
    if (data.actions?.length) {
      const actionsContainer = document.createElement('div');
      actionsContainer.className = 'openblaze-notification-actions';

      for (const action of data.actions) {
        const button = document.createElement('button');
        button.className = 'openblaze-notification-action';
        button.textContent = action.label;
        button.onclick = () => {
          this.handleAction(action.action, id);
        };
        actionsContainer.appendChild(button);
      }

      content.appendChild(actionsContainer);
    }

    // Close button
    const closeButton = document.createElement('button');
    closeButton.className = 'openblaze-notification-close';
    closeButton.innerHTML = '×';
    closeButton.onclick = () => this.hide(id);

    // Progress bar for timed notifications
    let progressBar: HTMLElement | null = null;
    if (data.duration && data.duration > 0) {
      progressBar = document.createElement('div');
      progressBar.className = 'openblaze-notification-progress';
      progressBar.style.width = '100%';
    }

    notification.appendChild(icon);
    notification.appendChild(content);
    notification.appendChild(closeButton);
    
    if (progressBar) {
      notification.appendChild(progressBar);
    }

    return notification;
  }

  private getIconForType(type: string): string {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'i';
      default: return 'i';
    }
  }

  private scheduleHide(id: string, duration: number): void {
    const notification = this.notifications.get(id);
    if (!notification) return;

    const progressBar = notification.querySelector('.openblaze-notification-progress') as HTMLElement;
    
    if (progressBar) {
      progressBar.style.transition = `width ${duration}ms linear`;
      progressBar.style.width = '0%';
    }

    setTimeout(() => {
      this.hide(id);
    }, duration);
  }

  private handleAction(action: string, notificationId: string): void {
    // Handle notification actions
    log('info', 'Notification action:', action);
    
    // Hide the notification
    this.hide(notificationId);
    
    // You could emit custom events or send messages to background script here
    document.dispatchEvent(new CustomEvent('openblaze-notification-action', {
      detail: { action, notificationId }
    }));
  }
}

// Global function for showing notifications
(window as any).showInPageNotification = (data: NotificationData, autoInit = false) => {
  if (autoInit || !(window as any)._openBlazeNotifier) {
    (window as any)._openBlazeNotifier = new InPageNotifier();
  }
  return (window as any)._openBlazeNotifier.show(data);
};

  // Initialize if not already done
  if (!(window as any)._openBlazeNotifier) {
    (window as any)._openBlazeNotifier = new InPageNotifier();
  }

})();
