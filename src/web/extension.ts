// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

interface LaunchConfiguration {
    name: string;
    type: string;
    request: string;
    [key: string]: any;
}

interface LaunchCompound {
    name: string;
    configurations: string[];
}

interface LaunchJson {
    version: string;
    configurations: LaunchConfiguration[];
    compounds?: LaunchCompound[];
}

class DebugConfigurationItem extends vscode.TreeItem {
    constructor(
        public readonly config: LaunchConfiguration | LaunchCompound,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
        private clickBehavior?: 'openSettings' | 'none'
    ) {
        super(config.name, collapsibleState);
        this.tooltip = config.name;
        this.description = this.getDescription(config);
        this.contextValue = 'configuration';
        this.iconPath = new vscode.ThemeIcon('gear');

        // Set command based on click behavior configuration
        if (clickBehavior === 'openSettings') {
            this.command = {
                command: 'ddd.debugConfig.openSettings',
                title: 'Open Configuration Settings',
                arguments: [this]
            };
        }
    }

    private getDescription(config: LaunchConfiguration | LaunchCompound): string {
        if ('configurations' in config) {
            return `Compound (${config.configurations.length} configurations)`;
        }
        return `${config.type} - ${config.request}`;
    }
}

class DebugConfigurationProvider implements vscode.TreeDataProvider<DebugConfigurationItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DebugConfigurationItem | undefined | null | void> = new vscode.EventEmitter<DebugConfigurationItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DebugConfigurationItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private workspaceRoot: string;
    private launchJsonPath: string;

    constructor() {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            this.workspaceRoot = workspaceFolders[0].uri.fsPath;
        } else {
            this.workspaceRoot = '';
        }
        this.launchJsonPath = `${this.workspaceRoot}/.vscode/launch.json`;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DebugConfigurationItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: DebugConfigurationItem): Thenable<DebugConfigurationItem[]> {
        if (!element) {
            // Root level - return all configurations and compounds
            return this.getConfigurations();
        }
        return Promise.resolve([]);
    }

    public async getConfigurations(): Promise<DebugConfigurationItem[]> {
        try {
            const launchJson = await this.readLaunchJson();
            const config = vscode.workspace.getConfiguration('ddd');
            const clickBehavior = config.get<'openSettings' | 'none'>('clickBehavior', 'openSettings');

            const items: DebugConfigurationItem[] = [];

            // Add configurations
            for (const config of launchJson.configurations) {
                items.push(new DebugConfigurationItem(config, vscode.TreeItemCollapsibleState.None, clickBehavior));
            }

            // Add compounds if they exist
            if (launchJson.compounds) {
                for (const compound of launchJson.compounds) {
                    items.push(new DebugConfigurationItem(compound, vscode.TreeItemCollapsibleState.None, clickBehavior));
                }
            }

            return items;
        } catch (error) {
            console.error('Error reading launch.json:', error);
            return [];
        }
    }

    public async readLaunchJson(): Promise<LaunchJson> {
        try {
            const launchUri = vscode.Uri.file(this.launchJsonPath);
            const document = await vscode.workspace.openTextDocument(launchUri);
            const content = document.getText();
            return JSON.parse(content);
        } catch (error) {
            // Return default structure if file doesn't exist or is invalid
            return {
                version: "0.2.0",
                configurations: []
            };
        }
    }

    async writeLaunchJson(launchJson: LaunchJson): Promise<void> {
        try {
            const content = JSON.stringify(launchJson, null, 2);
            const launchUri = vscode.Uri.file(this.launchJsonPath);

            // Create .vscode directory if it doesn't exist
            const vscodeDir = this.launchJsonPath.substring(0, this.launchJsonPath.lastIndexOf('/'));
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(vscodeDir));
            } catch {
                await vscode.workspace.fs.createDirectory(vscode.Uri.file(vscodeDir));
            }

            await vscode.workspace.fs.writeFile(launchUri, new TextEncoder().encode(content));
        } catch (error) {
            throw new Error(`Failed to write launch.json: ${error}`);
        }
    }

    async addConfiguration(config: LaunchConfiguration): Promise<void> {
        const launchJson = await this.readLaunchJson();
        launchJson.configurations.push(config);
        await this.writeLaunchJson(launchJson);
        this.refresh();
    }

    async updateConfiguration(oldName: string, newConfig: LaunchConfiguration): Promise<void> {
        const launchJson = await this.readLaunchJson();
        const index = launchJson.configurations.findIndex(c => c.name === oldName);
        if (index !== -1) {
            launchJson.configurations[index] = newConfig;
            await this.writeLaunchJson(launchJson);
            this.refresh();
        }
    }

    async deleteConfiguration(name: string): Promise<void> {
        const launchJson = await this.readLaunchJson();

        // Remove from configurations
        launchJson.configurations = launchJson.configurations.filter(c => c.name !== name);

        // Remove from compounds
        if (launchJson.compounds) {
            launchJson.compounds = launchJson.compounds.filter(c => c.name !== name);
        }

        // Remove from compounds' configuration lists
        if (launchJson.compounds) {
            launchJson.compounds.forEach(compound => {
                compound.configurations = compound.configurations.filter(c => c !== name);
            });
        }

        await this.writeLaunchJson(launchJson);
        this.refresh();
    }

    async duplicateConfiguration(config: LaunchConfiguration | LaunchCompound): Promise<void> {
        const launchJson = await this.readLaunchJson();

        if ('configurations' in config) {
            // Duplicate compound
            const newCompound: LaunchCompound = {
                name: `${config.name} Copy`,
                configurations: [...(config as LaunchCompound).configurations]
            };
            launchJson.compounds = launchJson.compounds || [];
            launchJson.compounds.push(newCompound);
        } else {
            // Duplicate configuration
            const newConfig: LaunchConfiguration = {
                ...config,
                name: `${config.name} Copy`
            };
            launchJson.configurations.push(newConfig);
        }

        await this.writeLaunchJson(launchJson);
        this.refresh();
    }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    console.log('Debug and Run Configurations extension is now active!');

    // Create tree data provider
    const provider = new DebugConfigurationProvider();

    // Register tree view
    const treeView = vscode.window.createTreeView('ddd.debugConfigurations', {
        treeDataProvider: provider,
        showCollapseAll: false
    });

    // Register commands
    const refreshCommand = vscode.commands.registerCommand('ddd.debugConfig.refresh', () => {
        provider.refresh();
    });

    const addCommand = vscode.commands.registerCommand('ddd.debugConfig.add', async () => {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter configuration name',
            placeHolder: 'My Debug Configuration'
        });

        if (!name) return;

        const type = await vscode.window.showQuickPick([
            'Node.js',
            'Python',
            'Chrome',
            'Edge',
            'Firefox',
            'Extension Host',
            'CoreCLR',
            'Other'
        ], {
            placeHolder: 'Select configuration type'
        });

        if (!type) return;

        const request = await vscode.window.showQuickPick(['launch', 'attach'], {
            placeHolder: 'Select request type'
        });

        if (!request) return;

        let configType = type.toLowerCase().replace(/\s+/g, '');
        if (configType === 'node.js') configType = 'node';
        if (configType === 'coreclr') configType = 'coreclr';
        if (configType === 'other') {
            configType = await vscode.window.showInputBox({
                prompt: 'Enter configuration type',
                placeHolder: 'custom'
            }) || 'custom';
        }

        const config: LaunchConfiguration = {
            name,
            type: configType,
            request
        };

        // Add some basic properties based on type
        if (configType === 'node') {
            config.program = '${file}';
            config.console = 'integratedTerminal';
            config.stopOnEntry = false;
        } else if (configType === 'python') {
            config.program = '${file}';
            config.console = 'integratedTerminal';
            config.justMyCode = true;
        }

        try {
            await provider.addConfiguration(config);
            vscode.window.showInformationMessage(`Configuration "${name}" added successfully!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to add configuration: ${error}`);
        }
    });

    const editCommand = vscode.commands.registerCommand('ddd.debugConfig.edit', async (item: DebugConfigurationItem) => {
        const config = item.config;
        const isCompound = 'configurations' in config;

        if (isCompound) {
            // Edit compound
            const name = await vscode.window.showInputBox({
                prompt: 'Compound name',
                value: config.name
            });

            if (name === undefined) return;

            const configs = await provider.getConfigurations();
            const configNames = configs.map(c => c.config.name);

            const configItems = configNames.map(name => ({ label: name }));
            const selectedConfigs = await vscode.window.showQuickPick(configItems, {
                placeHolder: 'Select configurations to include',
                canPickMany: true
            });

            if (selectedConfigs === undefined) return;

            const newCompound: LaunchCompound = {
                name,
                configurations: selectedConfigs.map(item => item.label)
            };

            try {
                await provider.updateConfiguration(config.name, newCompound as any);
                vscode.window.showInformationMessage(`Compound "${name}" updated successfully!`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to update compound: ${error}`);
            }
        } else {
            // Edit configuration
            const name = await vscode.window.showInputBox({
                prompt: 'Configuration name',
                value: config.name
            });

            if (name === undefined) return;

            const newConfig: LaunchConfiguration = {
                ...config,
                name
            };

            try {
                await provider.updateConfiguration(config.name, newConfig);
                vscode.window.showInformationMessage(`Configuration "${name}" updated successfully!`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to update configuration: ${error}`);
            }
        }
    });

    const deleteCommand = vscode.commands.registerCommand('ddd.debugConfig.delete', async (item: DebugConfigurationItem) => {
        const result = await vscode.window.showWarningMessage(
            `Are you sure you want to delete "${item.config.name}"?`,
            { modal: true },
            'Delete', 'Cancel'
        );

        if (result === 'Delete') {
            try {
                await provider.deleteConfiguration(item.config.name);
                vscode.window.showInformationMessage(`Configuration "${item.config.name}" deleted successfully!`);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to delete configuration: ${error}`);
            }
        }
    });

    const duplicateCommand = vscode.commands.registerCommand('ddd.debugConfig.duplicate', async (item: DebugConfigurationItem) => {
        try {
            await provider.duplicateConfiguration(item.config);
            vscode.window.showInformationMessage(`Configuration "${item.config.name}" duplicated successfully!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to duplicate configuration: ${error}`);
        }
    });

    const runCommand = vscode.commands.registerCommand('ddd.debugConfig.run', async (item: DebugConfigurationItem) => {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            const debugConfig: vscode.DebugConfiguration = item.config as vscode.DebugConfiguration;
            const success = await vscode.debug.startDebugging(workspaceFolder, debugConfig, { noDebug: true });

            if (success) {
                vscode.window.showInformationMessage(`Started "${item.config.name}" without debugging`);
            } else {
                vscode.window.showErrorMessage(`Failed to start "${item.config.name}"`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start configuration: ${error}`);
        }
    });

    const debugCommand = vscode.commands.registerCommand('ddd.debugConfig.debug', async (item: DebugConfigurationItem) => {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder found');
                return;
            }

            const debugConfig: vscode.DebugConfiguration = item.config as vscode.DebugConfiguration;
            const success = await vscode.debug.startDebugging(workspaceFolder, debugConfig);

            if (success) {
                vscode.window.showInformationMessage(`Started debugging "${item.config.name}"`);
            } else {
                vscode.window.showErrorMessage(`Failed to start debugging "${item.config.name}"`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start debugging: ${error}`);
        }
    });

    const createFromFileCommand = vscode.commands.registerCommand('ddd.debugConfig.createFromFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active file found. Please open a file to create a configuration.');
            return;
        }

        const currentFile = editor.document.uri.fsPath;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder found');
            return;
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        // Get relative path from workspace root
        let relativePath = currentFile.replace(workspaceRoot, '');
        if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
            relativePath = relativePath.substring(1);
        }

        // Create configuration name based on relative path
        let configName = relativePath
            .replace(/\.(js|ts|py|java|cpp|c|go|rs|php|rb)$/, '') // Remove file extension
            .replace(/[\/\\]/g, ' ') // Replace path separators with spaces
            .replace(/\s+/g, ' ') // Replace multiple spaces with single space
            .trim();

        // If no name after processing, use file name without extension
        if (!configName) {
            const fileName = currentFile.split(/[\/\\]/).pop() || 'current-file';
            configName = fileName.replace(/\.[^.]*$/, '');
        }

        // Check for existing configurations and add suffix if needed
        const launchJson = await provider.readLaunchJson();
        let finalConfigName = configName;
        let counter = 1;

        while (launchJson.configurations.some(config => config.name === finalConfigName)) {
            finalConfigName = `${configName} - ${counter}`;
            counter++;
        }

        // Detect configuration type based on file extension
        const fileExtension = currentFile.split('.').pop()?.toLowerCase();
        let configType = 'node';

        switch (fileExtension) {
            case 'py':
                configType = 'python';
                break;
            case 'js':
            case 'mjs':
                configType = 'node';
                break;
            case 'ts':
                configType = 'node';
                break;
            case 'java':
                configType = 'java';
                break;
            case 'cpp':
            case 'c':
                configType = 'cppdbg';
                break;
            case 'go':
                configType = 'go';
                break;
            case 'rs':
                configType = 'rust';
                break;
            case 'php':
                configType = 'php';
                break;
            case 'rb':
                configType = 'ruby';
                break;
            default:
                configType = 'node';
        }

        const newConfig: LaunchConfiguration = {
            name: finalConfigName,
            type: configType,
            request: 'launch',
            program: relativePath
        };

        // Add type-specific properties
        if (configType === 'node') {
            newConfig.console = 'integratedTerminal';
            newConfig.stopOnEntry = false;
            if (fileExtension === 'ts') {
                newConfig.args = [relativePath];
                newConfig.runtimeArgs = ['-r', 'ts-node/register'];
            }
        } else if (configType === 'python') {
            newConfig.program = relativePath;
            newConfig.console = 'integratedTerminal';
            newConfig.justMyCode = true;
        } else if (configType === 'java') {
            newConfig.mainClass = relativePath.replace(/\.[^.]*$/, '').replace(/[\/\\]/g, '.');
            newConfig.projectName = 'Default Project';
        }

        try {
            await provider.addConfiguration(newConfig);
            vscode.window.showInformationMessage(`Quick configuration "${finalConfigName}" created for ${fileExtension?.toUpperCase() || 'current'} file!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create configuration: ${error}`);
        }
    });

    const openSettingsCommand = vscode.commands.registerCommand('ddd.debugConfig.openSettings', async (item: DebugConfigurationItem) => {
        const config = item.config;

        // Only allow configuration settings for LaunchConfiguration, not compounds
        if ('configurations' in config) {
            vscode.window.showWarningMessage('Configuration settings are not available for compound configurations');
            return;
        }

        const launchConfig = config as LaunchConfiguration;

        // Create and show webview panel
        const panel = vscode.window.createWebviewPanel(
            'debugConfigSettings',
            `Configuration Settings: ${launchConfig.name}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Prepare configuration data for the webview
        const configData = {
            name: launchConfig.name,
            type: launchConfig.type,
            request: launchConfig.request,
            properties: { ...launchConfig }
        };

        // Remove basic properties from the properties object to show only custom properties
        delete (configData.properties as any).name;
        delete (configData.properties as any).type;
        delete (configData.properties as any).request;

        // Generate HTML for the webview
        panel.webview.html = getConfigurationSettingsWebviewContent(panel.webview, configData);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'saveConfiguration':
                        try {
                            const updatedConfig: LaunchConfiguration = {
                                ...message.config,
                                name: configData.name
                            };

                            await provider.updateConfiguration(launchConfig.name, updatedConfig);
                            vscode.window.showInformationMessage(`Configuration "${launchConfig.name}" updated successfully!`);
                            panel.dispose();
                        } catch (error) {
                            vscode.window.showErrorMessage(`Failed to update configuration: ${error}`);
                        }
                        break;
                    case 'cancel':
                        panel.dispose();
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    // Original hello world command
    const helloWorldCommand = vscode.commands.registerCommand('ddd.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from Debug and Run Configurations extension!');
    });

    // Register all disposables
    context.subscriptions.push(
        treeView,
        refreshCommand,
        addCommand,
        editCommand,
        deleteCommand,
        duplicateCommand,
        runCommand,
        debugCommand,
        createFromFileCommand,
        openSettingsCommand,
        helloWorldCommand
    );

    // Watch for changes in launch.json
    const fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/launch.json');
    fileSystemWatcher.onDidChange(() => provider.refresh());
    fileSystemWatcher.onDidCreate(() => provider.refresh());
    fileSystemWatcher.onDidDelete(() => provider.refresh());

    context.subscriptions.push(fileSystemWatcher);

    // Watch for configuration changes
    const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('ddd.clickBehavior')) {
            provider.refresh();
        }
    });

    context.subscriptions.push(configWatcher);
}

function getConfigurationSettingsWebviewContent(webview: vscode.Webview, configData: any): string {
    const propertiesHtml = Object.entries(configData.properties)
        .map(([key, value]) => {
            const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
            return `
                <div class="field-group">
                    <label for="prop-${key}">${key}</label>
                    <input type="text" id="prop-${key}" name="${key}" value="${displayValue.replace(/"/g, '&quot;')}" placeholder="Enter ${key}">
                    <button type="button" class="remove-btn" onclick="removeField('${key}')">🗑️</button>
                </div>
            `;
        })
        .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Configuration Settings</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
        }
        .header {
            margin-bottom: 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
        }
        .config-info {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            padding: 10px 15px;
            margin-bottom: 20px;
        }
        .section {
            margin-bottom: 25px;
        }
        .section-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 15px;
            color: var(--vscode-foreground);
        }
        .field-group {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
            gap: 10px;
        }
        label {
            flex: 0 0 120px;
            font-size: 13px;
            color: var(--vscode-foreground);
        }
        input[type="text"], select {
            flex: 1;
            padding: 6px 8px;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        input[type="text"]:focus, select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        .remove-btn {
            background: none;
            border: none;
            color: var(--vscode-icon-foreground);
            cursor: pointer;
            padding: 4px;
            border-radius: 3px;
            font-size: 16px;
        }
        .remove-btn:hover {
            background-color: var(--vscode-button-secondaryBackground);
        }
        .button-group {
            display: flex;
            gap: 10px;
            margin-top: 30px;
            justify-content: flex-end;
        }
        button {
            padding: 8px 16px;
            border: 1px solid var(--vscode-button-border);
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            border-radius: 3px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        button.primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        button.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .add-field-section {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        .add-field-group {
            display: flex;
            gap: 10px;
            align-items: center;
        }
        .add-field-group input {
            flex: 1;
        }
        .json-view {
            margin-top: 20px;
            background-color: var(--vscode-textBlockQuote-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            padding: 15px;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            white-space: pre-wrap;
            max-height: 200px;
            overflow-y: auto;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Configuration Settings</h2>
        </div>

        <div class="config-info">
            <strong>Name:</strong> ${configData.name}<br>
            <strong>Type:</strong> ${configData.type}<br>
            <strong>Request:</strong> ${configData.request}
        </div>

        <form id="configForm">
            <div class="section">
                <div class="section-title">Configuration Properties</div>
                <div id="propertiesContainer">
                    ${propertiesHtml}
                </div>
            </div>

            <div class="add-field-section">
                <div class="section-title">Add New Property</div>
                <div class="add-field-group">
                    <input type="text" id="newPropName" placeholder="Property name">
                    <input type="text" id="newPropValue" placeholder="Property value">
                    <button type="button" onclick="addField()">Add Property</button>
                </div>
            </div>

            <div class="section">
                <div class="section-title">JSON Preview</div>
                <div id="jsonPreview" class="json-view"></div>
            </div>

            <div class="button-group">
                <button type="button" class="secondary" onclick="cancel()">Cancel</button>
                <button type="button" class="primary" onclick="saveConfiguration()">Save</button>
            </div>
        </form>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function updateJsonPreview() {
            const formData = new FormData(document.getElementById('configForm'));
            const config = {
                name: "${configData.name}",
                type: "${configData.type}",
                request: "${configData.request}"
            };

            // Add all properties from form
            for (let [key, value] of formData.entries()) {
                if (key && value) {
                    // Try to parse as JSON, otherwise keep as string
                    try {
                        config[key] = JSON.parse(value);
                    } catch {
                        config[key] = value;
                    }
                }
            }

            document.getElementById('jsonPreview').textContent = JSON.stringify(config, null, 2);
        }

        function addField() {
            const name = document.getElementById('newPropName').value.trim();
            const value = document.getElementById('newPropValue').value.trim();

            if (!name) {
                alert('Please enter a property name');
                return;
            }

            const container = document.getElementById('propertiesContainer');
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'field-group';
            fieldDiv.innerHTML = \`
                <label for="prop-\${name}">\${name}</label>
                <input type="text" id="prop-\${name}" name="\${name}" value="\${value.replace(/"/g, '&quot;')}" placeholder="Enter \${name}">
                <button type="button" class="remove-btn" onclick="removeField('\${name}')">🗑️</button>
            \`;
            container.appendChild(fieldDiv);

            // Clear add field inputs
            document.getElementById('newPropName').value = '';
            document.getElementById('newPropValue').value = '';

            // Add event listener to new field
            fieldDiv.querySelector('input').addEventListener('input', updateJsonPreview);

            updateJsonPreview();
        }

        function removeField(fieldName) {
            const field = document.querySelector(\`input[name="\${fieldName}"]\`);
            if (field && field.parentElement) {
                field.parentElement.remove();
                updateJsonPreview();
            }
        }

        function saveConfiguration() {
            const formData = new FormData(document.getElementById('configForm'));
            const config = {
                name: "${configData.name}",
                type: "${configData.type}",
                request: "${configData.request}"
            };

            // Add all properties from form
            for (let [key, value] of formData.entries()) {
                if (key && value) {
                    // Try to parse as JSON, otherwise keep as string
                    try {
                        config[key] = JSON.parse(value);
                    } catch {
                        config[key] = value;
                    }
                }
            }

            vscode.postMessage({
                command: 'saveConfiguration',
                config: config
            });
        }

        function cancel() {
            vscode.postMessage({
                command: 'cancel'
            });
        }

        // Add event listeners to all existing fields
        document.querySelectorAll('input[type="text"]').forEach(input => {
            input.addEventListener('input', updateJsonPreview);
        });

        // Initial JSON preview
        updateJsonPreview();
    </script>
</body>
</html>`;
}

// This method is called when your extension is deactivated
export function deactivate() {}