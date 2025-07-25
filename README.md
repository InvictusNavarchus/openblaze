# OpenBlaze - Open Source Text Expansion Extension

OpenBlaze is a powerful, open-source Chrome extension for text expansion and snippet management. It's reverse-engineered from TextBlaze to provide the same functionality while being completely free and open source.

## Features

### 🚀 Core Features
- **Text Expansion**: Type shortcuts to instantly expand them into longer text
- **Smart Snippets**: Create static and dynamic snippets with variables
- **Real-time Expansion**: Automatic expansion as you type
- **Cross-Platform**: Works on all websites and text fields
- **Offline Support**: No internet connection required

### 📝 Snippet Management
- **Rich Editor**: Create and edit snippets with an intuitive interface
- **Variables**: Dynamic snippets with customizable variables
- **Categories**: Organize snippets with folders and tags
- **Search**: Quickly find snippets with powerful search
- **Import/Export**: Backup and share your snippets

### ⚙️ Advanced Features
- **Built-in Variables**: Date, time, clipboard content, and more
- **Form Support**: Handle complex forms with dynamic content
- **Keyboard Shortcuts**: Customizable trigger keys
- **Notifications**: Visual feedback for expansions
- **Statistics**: Track usage and keystrokes saved

## Installation

### From Source (Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/InvictusNavarchus/openblaze.git
   cd openblaze
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build the extension**
   ```bash
   pnpm run build
   ```

4. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder

### From Chrome Web Store
*Coming soon - extension will be published to the Chrome Web Store*

## Usage

### Creating Your First Snippet

1. Click the OpenBlaze icon in your browser toolbar
2. Click "New Snippet" or go to Settings → Snippets
3. Enter a shortcut (e.g., "addr")
4. Enter the content (e.g., your address)
5. Save the snippet

### Using Snippets

1. Type your shortcut in any text field
2. Press Space (or your configured trigger key)
3. Watch as the shortcut expands to your full content!

### Dynamic Snippets

Create snippets with variables for personalized content:

```
Hi {name},

Thank you for your interest in {product}. 
I'll follow up with you on {date}.

Best regards,
{myname}
```

## Default Snippets

OpenBlaze comes with useful default snippets:

- `addr` - Address template
- `email` - Email address
- `phone` - Phone number
- `sig` - Email signature
- `date` - Current date
- `time` - Current time
- `thanks` - Thank you message
- `meeting` - Meeting request template
- And many more!

## Configuration

### Settings

Access settings by clicking the gear icon in the popup or going to the options page:

- **Enable/Disable**: Toggle text expansion on/off
- **Trigger Key**: Choose Space, Tab, or Enter
- **Expansion Delay**: Adjust timing for expansion
- **Notifications**: Show/hide expansion notifications
- **Theme**: Light, dark, or auto theme

### Keyboard Shortcuts

- `Ctrl+Shift+Space` - Open snippet picker
- `Ctrl+Shift+E` - Toggle expansion on/off

## Development

### Project Structure

```
src/
├── background/          # Background service worker
├── content/            # Content scripts for text expansion
├── popup/              # Extension popup interface
├── options/            # Settings and management page
├── engine/             # Text expansion engine
├── storage/            # Data storage and management
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── data/               # Default snippets and data
```

### Building

The project uses **Vite 7** as the build tool, providing fast builds and excellent development experience.

```bash
# Development build with watch mode
pnpm run dev

# Development build (single run)
pnpm run build:dev

# Production build
pnpm run build

# Type checking
pnpm run type-check

# Linting
pnpm run lint
```

#### Build System Features

- **Vite 7**: Latest version with Rust-powered performance improvements
- **TypeScript Support**: Full TypeScript compilation with type checking
- **Source Maps**: Available in development builds for debugging
- **Asset Handling**: Automatic copying of manifest, HTML, CSS, and image files
- **Browser Extension Optimization**: Configured specifically for Chrome extension development
- **Watch Mode**: Automatic rebuilding during development

### Architecture

OpenBlaze uses a modular architecture:

- **Background Service Worker**: Handles snippet storage and management
- **Content Scripts**: Detect typing and perform text expansion
- **Expansion Engine**: Core logic for matching and expanding snippets
- **Storage Manager**: Handles data persistence and synchronization
- **UI Components**: Popup and options pages for user interaction

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Privacy

OpenBlaze is privacy-focused:

- **No Data Collection**: We don't collect any personal data
- **Local Storage**: All snippets are stored locally on your device
- **No Analytics**: No tracking or analytics
- **Open Source**: Full transparency with open source code

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Inspired by TextBlaze for the original concept
- Built with TypeScript, Vite 7, and modern web technologies
- Thanks to all contributors and users

## Support

- **Issues**: Report bugs on [GitHub Issues](https://github.com/InvictusNavarchus/openblaze/issues)
- **Discussions**: Join conversations on [GitHub Discussions](https://github.com/InvictusNavarchus/openblaze/discussions)
- **Documentation**: Visit our [Wiki](https://github.com/InvictusNavarchus/openblaze/wiki)

## Roadmap

- [ ] Firefox extension support
- [ ] Cloud synchronization (optional)
- [ ] Advanced snippet templates
- [ ] Team collaboration features
- [ ] Mobile app companion
- [ ] API for third-party integrations

---

**Made with ❤️ by the OpenBlaze community**
