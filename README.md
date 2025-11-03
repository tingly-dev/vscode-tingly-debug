# Debug Configurations

A PyCharm-inspired debug and run configuration manager for VS Code that provides a better UI for managing your debug configurations with launch.json synchronization.

## Features

- **🎯 Configuration View**: Clean, organized tree view of all debug configurations and compounds
- **🔄 Launch.json Sync**: Automatically synchronizes with your `.vscode/launch.json` file
- **💡 Quick Configuration**: Create configurations instantly from active files with smart type detection
- **➕ Guided Setup**: Add new debug configurations with step-by-step configuration
- **⚙️ Visual Editor**: Comprehensive configuration editor with form-based editing and JSON preview
- **✏️ In-place Editing**: Edit configuration names and properties directly
- **🗑️ Safe Deletion**: Remove configurations with confirmation prompts
- **📋 Duplicate Configurations**: Quickly copy existing configurations
- **▶️ Quick Launch**: Run configurations with or without debugging
- **🔄 Auto-refresh**: Automatically updates when launch.json changes

## Usage

### Accessing the Configuration View

1. Open the Debug view (Ctrl+Shift+D or Cmd+Shift+D)
2. Look for the "Configurations" panel in the Debug sidebar
3. All your debug configurations will appear in an organized list

### Adding a New Configuration

**Quick Configuration**:
1. Open the file you want to debug
2. Click the lightbulb (💡) button in the Configurations panel
3. A configuration will be automatically created based on the file type

**Manual Configuration**:
1. Click the "Add Configuration" (+) button in the Configurations panel
2. Enter a configuration name
3. Select the configuration type (Node.js, Python, Chrome, etc.)
4. Choose the request type (launch or attach)
5. The configuration will be automatically added to your launch.json

### Managing Configurations

- **Run**: Click the play (▶️) icon to run without debugging
- **Debug**: Click the debug (🐛) icon to start debugging
- **Settings**: Click the gear (⚙️) icon to open the configuration editor
- **Edit**: Right-click and select "Edit" to modify the configuration name
- **Duplicate**: Right-click and select "Duplicate" to copy a configuration
- **Delete**: Right-click and select "Delete" to remove a configuration

### Configuration Editor

Click the gear (⚙️) icon on any configuration to open a comprehensive editor with:

- **Visual Property Editing**: Edit all launch.json fields through a form interface
- **Dynamic Field Management**: Add or remove configuration properties
- **Real-time JSON Preview**: See the resulting JSON as you type
- **Smart Value Parsing**: Automatically detects JSON vs string values

### Configuration Types Supported

- Node.js
- Python
- Chrome
- Edge
- Firefox
- Extension Host (for VS Code extensions)
- CoreCLR (.NET)
- Custom types

## Compatibility

This extension works with standard VS Code launch.json format and supports:

- Debug configurations
- Compound configurations
- All standard VS Code debug attributes
- Workspace-specific launch.json files

## Requirements

- VS Code 1.105.0 or higher
- Web extension compatible

## Settings

This extension provides the following configuration options:

### Click Behavior

**`ddd.clickBehavior`**: Controls what happens when you click on a configuration item in the tree view.

- **`openSettings`** (default): Clicking an item opens the configuration settings editor
- **`none`**: Clicking an item has no action (use toolbar buttons instead)

You can change this setting in VS Code:
1. Open Settings (Ctrl+, or Cmd+,)
2. Search for "Debug Configurations"
3. Find the "Click Behavior" option
4. Select your preferred behavior

## Release Notes

### 0.0.1

Initial release with:
- Configuration tree view
- Launch.json synchronization
- Add, edit, delete, and duplicate configurations
- Run and debug support
- Compound configuration support

---

**Enjoy better debug configuration management in VS Code!**