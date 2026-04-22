# Tingly Debug (Run) Configurations

A JetBrains-inspired debug and run configuration manager for Visual Studio Code with intuitive UI and seamless launch.json synchronization.

## ✨ Features

- **Visual Configuration Management** - Clean tree view with automatic launch.json sync
- **Smart Configuration Creation** - Create configs from active files, symbols, or directories
- **Visual Configuration Editor** - Form-based editing with real-time JSON preview
- **One-Click Actions** - Debug, run, duplicate, and delete configurations easily
- **Auto-Refresh** - Real-time updates when launch.json changes
- **Symbol-Based Debugging** - Generate debug configs for specific test symbols (e.g., pytest tests)
- **Compound Configurations** - Support for multiple launch targets in compound mode

## 📸 Preview

![](./resource/preview.png)

## 🚀 Getting Started

### Installation

Search **"Tingly Run / Debug Configurations"** in VS Code extensions marketplace or install from [VSIX](https://github.com/Tingly-Dev/vscode-tingly-debug/releases).

### Basic Usage

1. Open Run & Debug View (`Ctrl+Shift+D` / `Cmd+Shift+D`)
2. Find **"Tingly Debug Configurations"** panel in the Debug sidebar
3. **Recommended**: Move the panel to the **top** of Run & Debug View for better visibility

## 📖 Usage

### Create Configuration

- **From File**: Open a file → Click **💡 Debug from File** in editor title bar
- **From Symbol**: Right-click on a symbol → Select **Tingly: Debug from Symbol** (supports test frameworks like pytest)
- **From Directory**: Right-click folder → **Tingly: Debug from Directory**
- **Manual**: Click **➕ Add Configuration** → Set name and type
- **Sync**: Click **Sync** to load existing configs from `launch.json` or create new

### Manage Configurations

- **🐛 Debug** - Start debugging session (inline button)
- **▶️ Run** - Execute without debugging (inline button)
- **⚙️ Settings** - Open configuration settings panel (inline button)
- **Right-click** for more options:
  - Edit configuration
  - Duplicate configuration
  - Delete configuration

## 🛠️ Supported Debug Types

- Node.js, JavaScript, TypeScript
- Python (with test integration)
- Go (Golang)
- Chrome, Edge, Firefox
- Extension Host (VS Code extensions)
- CoreCLR (.NET)
- Java, C++, PHP, Ruby
- And many more via VS Code's debug adapters

## ⚙️ Settings

### `tingly.debug.clickBehavior`
- **`openSettings`** (default) - Click on configuration item to open settings
- **`none`** - Disable click action (use toolbar buttons)

### `tingly.debug.nameCollisionSuffixStyle`
- **`index`** (default) - Use numeric suffix for duplicates (e.g., "- 1", "- 2")
- **`timestamp`** - Use timestamp suffix (e.g., "-20250811-129900")

## ⚙️ Configuration Editor

- Form-based interface for all launch.json properties
- Live JSON preview
- Dynamic property management
- Smart value type detection
- Error validation and feedback
- Save button to persist changes

## 📋 Requirements

- VS Code 1.90.0 or higher
- Web extension compatible (works in vscode.dev)

## 🏗️ Development

```bash
# Install dependencies
npm install

# Compile
npm run compile-web

# Watch for changes
npm run watch-web

# Run tests
npm test

# Run in browser
npm run run-in-browser

# Package extension
npm run package-web
```

## 📝 License

[License.txt](./LICENSE.txt)

## 🙏 Acknowledgments

Uses [vscode-schemas](https://github.com/wraith13/vscode-schemas) for debug configuration schemas.

---

**Transform your VS Code debugging experience with Tingly!**
