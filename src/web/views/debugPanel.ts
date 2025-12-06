import * as vscode from 'vscode';
import { ClickBehavior, LaunchCompound, LaunchConfiguration, LaunchJson } from '../core/types';
import { parseJSONC, parseJSONCConfigurations, serializeJSONC, updateLaunchConfiguration, addLaunchConfiguration, removeLaunchConfiguration } from '../util/jsoncUtils';

export class DebugConfigurationItem extends vscode.TreeItem {
    constructor(
        public readonly config: LaunchConfiguration | LaunchCompound,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
        private clickBehavior?: ClickBehavior
    ) {
        super(config.name, collapsibleState);
        this.tooltip = config.name;
        this.description = this.getDescription(config);
        this.contextValue = 'configuration';
        this.iconPath = this.getIconForConfig(config);

        // Set command based on click behavior configuration
        // Default to 'openSettings' if clickBehavior is not set
        const behavior = clickBehavior || 'openSettings';
        console.log(`DebugConfigurationItem: behavior=${behavior} for config=${config.name}`);

        if (behavior === 'openSettings') {
            this.command = {
                command: 'tingly.debug.debugConfig.openSettings',
                title: 'Open Configuration Settings',
                arguments: [this]
            };
            console.log(`DebugConfigurationItem: Set command for ${config.name}`);
        } else {
            console.log(`DebugConfigurationItem: No command set for ${config.name} due to behavior=${behavior}`);
        }
    }

    private getDescription(config: LaunchConfiguration | LaunchCompound): string {
        if ('configurations' in config) {
            return `Compound (${config.configurations.length} configurations)`;
        }
        return `${config.type} - ${config.request}`;
    }

    private getIconForConfig(config: LaunchConfiguration | LaunchCompound): vscode.ThemeIcon {
        if ('configurations' in config) {
            // Compound configurations get a special icon
            return new vscode.ThemeIcon('gear');
        }

        const launchConfig = config as LaunchConfiguration;
        const type = launchConfig.type.toLowerCase();
        console.log("type", type);

        // Map configuration types to appropriate language icons
        switch (type) {
            case 'node':
            case 'node2':
                return new vscode.ThemeIcon('nodejs'); // Node.js icon
            case 'python':
            case 'debugpy':
                return new vscode.ThemeIcon('python'); // Python icon
            case 'chrome':
            case 'msedge':
            case 'edge':
                return new vscode.ThemeIcon('browser'); // Browser-related icon
            case 'firefox':
                return new vscode.ThemeIcon('browser'); // Browser-related icon
            case 'java':
                return new vscode.ThemeIcon('java'); // Java icon
            case 'cppdbg':
            case 'cpp':
                return new vscode.ThemeIcon('cpp'); // C++ icon
            case 'go':
                return new vscode.ThemeIcon('go'); // Go icon
            case 'rust':
                return new vscode.ThemeIcon('rust'); // Rust icon
            case 'php':
                return new vscode.ThemeIcon('php'); // PHP icon
            case 'ruby':
                return new vscode.ThemeIcon('ruby'); // Ruby icon
            case 'coreclr':
            case 'dotnet':
                return new vscode.ThemeIcon('csharp'); // C#/.NET icon
            case 'extensionhost':
                return new vscode.ThemeIcon('extensions'); // VS Code extension icon
            case 'powershell':
                return new vscode.ThemeIcon('powershell'); // PowerShell icon
            case 'mono':
                return new vscode.ThemeIcon('csharp'); // Mono C# icon
            case 'java+':
                return new vscode.ThemeIcon('java'); // Java icon
            case 'lua':
                return new vscode.ThemeIcon('lua'); // Lua icon
            case 'dart':
                return new vscode.ThemeIcon('dart'); // Dart icon
            case 'swift':
                return new vscode.ThemeIcon('swift'); // Swift icon
            case 'kotlin':
                return new vscode.ThemeIcon('kotlin'); // Kotlin icon
            case 'scala':
                return new vscode.ThemeIcon('scala'); // Scala icon
            default:
                // Fallback for unknown types - use launch icon
                return new vscode.ThemeIcon('debug-start');
        }
    }
}

export interface ErrorConfiguration {
    name: string;
    type: 'error';
    request: 'error';
    error: {
        message: string;
        details?: string;
    };
}

export class DebugErrorItem extends vscode.TreeItem {
    constructor(
        public readonly config: ErrorConfiguration,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
        private launchJsonPath?: string
    ) {
        super(config.name, collapsibleState);
        this.tooltip = `${config.error.message}\n\nClick to open launch.json for editing`;
        this.description = 'Error loading configurations';
        this.contextValue = 'error';
        this.iconPath = this.getIconForError(config);

        // Error items should have click command to open launch.json
        this.command = {
            command: 'vscode.open',
            title: 'Open launch.json',
            arguments: [vscode.Uri.file(launchJsonPath || '')]
        };
    }

    private getIconForError(config: ErrorConfiguration): vscode.ThemeIcon {
        return new vscode.ThemeIcon('warning');
    }
}

export class DebugConfigurationProvider implements vscode.TreeDataProvider<DebugConfigurationItem | DebugErrorItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DebugConfigurationItem | DebugErrorItem | undefined | null | void> = new vscode.EventEmitter<DebugConfigurationItem | DebugErrorItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DebugConfigurationItem | DebugErrorItem | undefined | null | void> = this._onDidChangeTreeData.event;

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

    /**
     * Check if launch.json exists and prompt user to create it if it doesn't
     * @param operation The operation being attempted (for user message)
     * @param allowCreate Whether to offer creating the file (for add/duplicate operations)
     * @returns true if file exists or user chose to create it, false if user cancelled or file can't be created
     */
    private async ensureLaunchJsonExists(operation: string, allowCreate: boolean = false): Promise<boolean> {
        const launchUri = vscode.Uri.file(this.launchJsonPath);

        try {
            await vscode.workspace.fs.stat(launchUri);
            return true; // File exists
        } catch (error) {
            // File doesn't exist
            if (allowCreate) {
                const createFile = await vscode.window.showInformationMessage(
                    `launch.json does not exist. Would you like to create it ${operation}?`,
                    'Create',
                    'Cancel'
                );

                if (createFile === 'Create') {
                    return true; // User chose to create
                }
                return false; // User cancelled
            } else {
                vscode.window.showErrorMessage(`Cannot ${operation}: launch.json does not exist.`);
                return false;
            }
        }
    }

    refresh(): void {
        // Clear any cached data by firing tree data change event
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DebugConfigurationItem | DebugErrorItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: DebugConfigurationItem | DebugErrorItem): Thenable<DebugConfigurationItem[] | DebugErrorItem[]> {
        if (!element) {
            // Root level - return all configurations or error items
            return this.getConfigurations();
        }
        return Promise.resolve([]);
    }

    public async getConfigurations(): Promise<DebugConfigurationItem[] | DebugErrorItem[]> {
        try {
            const configurations = await this.readConfigurationsOnly();
            const config = vscode.workspace.getConfiguration('ddd');
            const clickBehavior = config.get<ClickBehavior>('clickBehavior', 'openSettings');

            console.log(`DebugConfigurationProvider: read ${configurations.length} configurations, clickBehavior=${clickBehavior}`);

            const items: DebugConfigurationItem[] = [];

            // Add configurations only
            for (const config of configurations) {
                items.push(new DebugConfigurationItem(config, vscode.TreeItemCollapsibleState.None, clickBehavior));
            }

            console.log(`DebugConfigurationProvider: created ${items.length} DebugConfigurationItems`);
            return items;
        } catch (error) {
            console.error('Error reading launch.json configurations:', error);

            // Return error item instead of empty array
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorDetails = `Failed to load debug configurations from launch.json. Please check the file format and try again.\n\nError details: ${errorMessage}`;

            console.log(`Creating error item for: ${errorMessage}`);

            const errorConfig: ErrorConfiguration = {
                name: 'Configuration Error',
                type: 'error',
                request: 'error',
                error: {
                    message: errorMessage,
                    details: errorDetails
                }
            };

            return [new DebugErrorItem(errorConfig, vscode.TreeItemCollapsibleState.None, this.launchJsonPath)];
        }
    }

    public async readLaunchJson(): Promise<LaunchJson> {
        try {
            const launchUri = vscode.Uri.file(this.launchJsonPath);
            const document = await vscode.workspace.openTextDocument(launchUri);
            const content = document.getText();
            const data = parseJSONC(content);
            return data;
        } catch (error) {
            // Return default structure if file doesn't exist or is invalid
            return {
                version: "0.2.0",
                configurations: []
            };
        }
    }

    public async readConfigurationsOnly(): Promise<LaunchConfiguration[]> {
        try {
            const launchUri = vscode.Uri.file(this.launchJsonPath);
            const document = await vscode.workspace.openTextDocument(launchUri);
            const content = document.getText();
            return parseJSONCConfigurations(content);
        } catch (error) {
            // Check if the error is due to file not found - check various possible error codes/messages
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorCode = (error && typeof error === 'object' && 'code' in error) ? error.code : undefined;

            const isFileNotFound =
                errorCode === 'FileNotFound' ||
                errorCode === 'ENOENT' ||
                errorMessage.includes('file not found') ||
                errorMessage.includes('does not exist') ||
                errorMessage.includes('no such file');

            if (isFileNotFound) {
                // File doesn't exist - this is a normal case, return empty array
                console.log('launch.json not found, returning empty configurations');
                return [];
            }

            // For other errors (parsing errors, permission issues, etc.), throw to let the caller handle it
            console.warn('Failed to read launch.json configurations:', error);
            throw error;
        }
    }

    async writeLaunchJson(launchJson: LaunchJson): Promise<void> {
        try {
            // Use simplified JSONC serialization
            const content = serializeJSONC(launchJson);

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
        try {
            // Check if launch.json exists and prompt user to create it
            if (!await this.ensureLaunchJsonExists('with this configuration', true)) {
                return; // User cancelled or file can't be created
            }

            const launchUri = vscode.Uri.file(this.launchJsonPath);

            try {
                // Try to read existing file
                const document = await vscode.workspace.openTextDocument(launchUri);
                const existingContent = document.getText();

                // Use simplified JSONC utility to add configuration
                const newContent = addLaunchConfiguration(existingContent, config);

                await vscode.workspace.fs.writeFile(launchUri, new TextEncoder().encode(newContent));
                this.refresh();
            } catch (error) {
                // If reading fails, create new file with the configuration
                const launchJson: LaunchJson = {
                    version: "0.2.0",
                    configurations: [config]
                };
                await this.writeLaunchJson(launchJson);
                this.refresh();
            }
        } catch (error) {
            throw new Error(`Failed to add configuration: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async updateConfiguration(oldName: string, newConfig: LaunchConfiguration | LaunchCompound): Promise<void> {
        try {
            // Check if launch.json exists
            if (!await this.ensureLaunchJsonExists('update configuration')) {
                return; // File doesn't exist and error was shown
            }

            const launchUri = vscode.Uri.file(this.launchJsonPath);
            const document = await vscode.workspace.openTextDocument(launchUri);
            const existingContent = document.getText();

            // Use JSONC utility to update configuration while preserving comments
            const newContent = updateLaunchConfiguration(existingContent, oldName, newConfig);

            await vscode.workspace.fs.writeFile(launchUri, new TextEncoder().encode(newContent));
            this.refresh();
        } catch (error) {
            throw new Error(`Failed to update configuration: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async deleteConfiguration(name: string): Promise<void> {
        try {
            // Check if launch.json exists
            if (!await this.ensureLaunchJsonExists('delete configuration')) {
                return; // File doesn't exist and error was shown
            }

            const launchUri = vscode.Uri.file(this.launchJsonPath);
            const document = await vscode.workspace.openTextDocument(launchUri);
            const existingContent = document.getText();

            // Use JSONC utility to remove configuration while preserving comments
            const newContent = removeLaunchConfiguration(existingContent, name);

            await vscode.workspace.fs.writeFile(launchUri, new TextEncoder().encode(newContent));
            this.refresh();
        } catch (error) {
            throw new Error(`Failed to delete configuration: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async duplicateConfiguration(config: LaunchConfiguration | LaunchCompound): Promise<void> {
        try {
            // Check if launch.json exists and prompt user to create it
            if (!await this.ensureLaunchJsonExists('with this duplicated configuration', true)) {
                return; // User cancelled or file can't be created
            }

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
        } catch (error) {
            throw new Error(`Failed to duplicate configuration: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}