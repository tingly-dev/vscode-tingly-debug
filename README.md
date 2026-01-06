# Tingly Debug (Run) Configurations

A JetBrains-inspired debug and run configuration manager for Visual Studio Code with intuitive UI and seamless launch.json synchronization.

> Status: Work-In-Progress.

## 📸 Preview

![](resource/preview.png)

## ✨ Features

- **Visual Configuration Management** - Clean tree view with automatic launch.json sync
- **Smart Configuration Creation** - Create configs from active files with intelligent type detection
- **Visual Configuration Editor** - Form-based editing with real-time JSON preview
- **One-Click Actions** - Debug, run, duplicate, and delete configurations easily
- **Auto-Refresh** - Real-time updates when launch.json changes

## 🚀 Getting Started

1. **Install** - Search "Tingly Run / Debug Configurations" in VS Code extensions
2. **Open Run & Debug View** - Press `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac).
3. **Manage Configs** - Find "Tingly Debug Configurations" panel in Debug sidebar
4. **Suggestion** - Move the panel to the **Top** of Run & Debug View.

## 📖 Usage

### Create Configuration
- **Quick**: Open a file → Click **💡 Quick Configuration**
- **Manual**: Click **➕ Add Configuration** → Set name and type
- **Sync**: Click **Sync** to load existing configs from `launch.json` or create a new one

### Manage Configurations
- **🐛 Debug** - Start debugging session
- **▶️ Run** - Execute without debugging
- **⚙️ Edit** - Open visual configuration editor
- **Right-click** - Edit, duplicate, or delete configurations

## 🛠️ Supported Debug Types

- Node.js, Python, Chrome, Edge, Firefox
- Extension Host (VS Code extensions)
- CoreCLR (.NET)
- Custom debug configurations

## ⚙️ Configuration Editor

- Form-based interface for all launch.json properties
- Live JSON preview
- Dynamic property management
- Smart value type detection
- Error validation and feedback

## 📋 Requirements

VS Code 1.90.0 or higher (web extension compatible)

## Resources

[vscode-schemas](https://github.com/wraith13/vscode-schemas)

---

**Transform your VS Code debugging experience with Tingly!**
