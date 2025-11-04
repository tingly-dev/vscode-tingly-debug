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
                command: 'ddd.debugConfig.openSettings',
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

export class DebugConfigurationProvider implements vscode.TreeDataProvider<DebugConfigurationItem> {
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
        // Clear any cached data by firing tree data change event
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: DebugConfigurationItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: DebugConfigurationItem): Thenable<DebugConfigurationItem[]> {
        if (!element) {
            // Root level - return all configurations
            return this.getConfigurations();
        }
        return Promise.resolve([]);
    }

    public async getConfigurations(): Promise<DebugConfigurationItem[]> {
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
            return [];
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
            // Return empty array if file doesn't exist or is invalid
            console.warn('Failed to read launch.json configurations, returning empty array:', error);
            return [];
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
            const launchUri = vscode.Uri.file(this.launchJsonPath);
            const document = await vscode.workspace.openTextDocument(launchUri);
            const existingContent = document.getText();

            // Use simplified JSONC utility to add configuration
            const newContent = addLaunchConfiguration(existingContent, config);

            await vscode.workspace.fs.writeFile(launchUri, new TextEncoder().encode(newContent));
            this.refresh();
        } catch (error) {
            // Fallback to original method if file doesn't exist
            const launchJson = await this.readLaunchJson();
            launchJson.configurations.push(config);
            await this.writeLaunchJson(launchJson);
            this.refresh();
        }
    }

    async updateConfiguration(oldName: string, newConfig: LaunchConfiguration | LaunchCompound): Promise<void> {
        try {
            const launchUri = vscode.Uri.file(this.launchJsonPath);
            const document = await vscode.workspace.openTextDocument(launchUri);
            const existingContent = document.getText();

            // Use JSONC utility to update configuration while preserving comments
            const newContent = updateLaunchConfiguration(existingContent, oldName, newConfig);

            await vscode.workspace.fs.writeFile(launchUri, new TextEncoder().encode(newContent));
            this.refresh();
        } catch (error) {
            // Fallback to original method if something goes wrong
            const launchJson = await this.readLaunchJson();

            // Find and update configuration
            const configIndex = launchJson.configurations.findIndex(config => config.name === oldName);
            if (configIndex !== -1) {
                launchJson.configurations[configIndex] = newConfig as LaunchConfiguration;
            } else {
                // Check if it's a compound
                const compoundIndex = launchJson.compounds?.findIndex(compound => compound.name === oldName);
                if (compoundIndex !== undefined && compoundIndex !== -1) {
                    launchJson.compounds![compoundIndex] = newConfig as LaunchCompound;
                } else {
                    throw new Error(`Configuration "${oldName}" not found`);
                }
            }

            await this.writeLaunchJson(launchJson);
            this.refresh();
        }
    }

    async deleteConfiguration(name: string): Promise<void> {
        try {
            const launchUri = vscode.Uri.file(this.launchJsonPath);
            const document = await vscode.workspace.openTextDocument(launchUri);
            const existingContent = document.getText();

            // Use JSONC utility to remove configuration while preserving comments
            const newContent = removeLaunchConfiguration(existingContent, name);

            await vscode.workspace.fs.writeFile(launchUri, new TextEncoder().encode(newContent));
            this.refresh();
        } catch (error) {
            // Fallback to original method if something goes wrong
            const launchJson = await this.readLaunchJson();

            // Remove from configurations
            const configIndex = launchJson.configurations.findIndex(config => config.name === name);
            if (configIndex !== -1) {
                launchJson.configurations.splice(configIndex, 1);
            } else {
                // Check if it's a compound
                const compoundIndex = launchJson.compounds?.findIndex(compound => compound.name === name);
                if (compoundIndex !== undefined && compoundIndex !== -1) {
                    launchJson.compounds!.splice(compoundIndex, 1);
                } else {
                    throw new Error(`Configuration "${name}" not found`);
                }
            }

            await this.writeLaunchJson(launchJson);
            this.refresh();
        }
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