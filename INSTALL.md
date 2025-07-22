# OpenBlaze Installation Guide

## Quick Start

### 1. Load the Extension in Chrome

1. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/` in your Chrome browser
   - Or click the three dots menu → More tools → Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top right corner

3. **Load the Extension**
   - Click "Load unpacked" button
   - Navigate to the `dist` folder in this project
   - Select the `dist` folder and click "Select Folder"

4. **Verify Installation**
   - You should see "OpenBlaze: Text Expansion & Snippets" in your extensions list
   - The OpenBlaze icon should appear in your browser toolbar

### 2. Test the Extension

1. **Open the Test Page**
   - Open the `test.html` file in your browser
   - Or visit any website with text input fields

2. **Try Default Snippets**
   - Type `addr` and press Space
   - Type `email` and press Space  
   - Type `date` and press Space
   - Type `sig` and press Space

3. **Use the Popup**
   - Click the OpenBlaze icon in your toolbar
   - Browse and search your snippets
   - Click any snippet to insert it

## Building from Source

If you want to build the extension yourself:

### Prerequisites

- Node.js 16+ 
- pnpm (recommended) or npm

### Build Steps

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd openblaze
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Build the Extension**
   ```bash
   pnpm run build
   # or
   npm run build
   ```

4. **Development Mode** (optional)
   ```bash
   pnpm run dev
   # or
   npm run dev
   ```
   This will watch for changes and rebuild automatically.

## Features Overview

### ✅ What Works

- **Text Expansion**: Type shortcuts and press Space to expand
- **Default Snippets**: 15+ pre-loaded useful snippets
- **Dynamic Snippets**: Snippets with variables (date, time, etc.)
- **Popup Interface**: Browse and manage snippets
- **Settings Page**: Configure expansion behavior
- **Cross-Site Support**: Works on all websites
- **Multiple Input Types**: Input fields, textareas, contenteditable

### 🚧 In Development

- **Variable Forms**: UI for dynamic snippet variables
- **Snippet Picker**: Quick snippet selection overlay
- **Advanced Settings**: More customization options
- **Import/Export**: Full data backup/restore
- **Statistics**: Usage tracking and analytics

## Default Snippets

The extension comes with these useful snippets:

| Shortcut | Description | Type |
|----------|-------------|------|
| `addr` | Your address | Static |
| `email` | Email address | Static |
| `phone` | Phone number | Static |
| `sig` | Email signature | Static |
| `date` | Current date | Dynamic |
| `time` | Current time | Dynamic |
| `datetime` | Date and time | Dynamic |
| `thanks` | Thank you message | Static |
| `meeting` | Meeting request | Static |
| `lorem` | Lorem ipsum text | Static |
| `br` | Best regards + name | Dynamic |
| `intro` | Introduction template | Dynamic |
| `followup` | Follow-up email | Dynamic |
| `apology` | Apology template | Dynamic |
| `ooo` | Out of office | Dynamic |

## Keyboard Shortcuts

- `Ctrl+Shift+Space` - Open snippet picker (planned)
- `Ctrl+Shift+E` - Toggle expansion on/off
- `Space` - Default expansion trigger (configurable)

## Troubleshooting

### Extension Not Working?

1. **Check if Extension is Enabled**
   - Go to `chrome://extensions/`
   - Make sure OpenBlaze is enabled (toggle switch is on)

2. **Reload the Extension**
   - Click the refresh icon on the OpenBlaze extension card
   - Or disable and re-enable the extension

3. **Check Console for Errors**
   - Right-click on a webpage → Inspect → Console
   - Look for any OpenBlaze-related errors

4. **Refresh Web Pages**
   - The extension only works on pages loaded after installation
   - Refresh any open tabs where you want to use snippets

### Snippets Not Expanding?

1. **Check Trigger Key**
   - Default is Space - make sure you're pressing Space after typing
   - Check settings to see if trigger key was changed

2. **Check if Extension is Enabled**
   - Click the OpenBlaze icon - status indicator should be green
   - If red, click the toggle button to enable

3. **Try Different Input Fields**
   - Some websites may block content script injection
   - Try on the test.html page to verify functionality

### Performance Issues?

1. **Too Many Snippets**
   - The extension is optimized for hundreds of snippets
   - Consider organizing with folders (coming soon)

2. **Memory Usage**
   - Extension uses minimal memory
   - All data is stored locally in Chrome storage

## Support

- **Issues**: Report bugs on GitHub Issues
- **Feature Requests**: Use GitHub Discussions
- **Documentation**: Check the README.md file

## Next Steps

1. **Create Your Own Snippets**
   - Click the OpenBlaze icon → New Snippet
   - Or go to Settings → Snippets

2. **Customize Settings**
   - Right-click OpenBlaze icon → Options
   - Or go to chrome://extensions/ → OpenBlaze → Details → Extension options

3. **Import/Export** (coming soon)
   - Backup your snippets
   - Share with team members

---

**Happy text expanding! 🚀**
