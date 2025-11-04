// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { registerCommandHandlers } from './core/commandHandlers';
import { DebugConfigurationProvider } from './views/debugPanel';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    // Create debug configuration provider
    const provider = new DebugConfigurationProvider();

    // Create tree view
    const treeView = vscode.window.createTreeView('ddd.debugConfigurations', {
        treeDataProvider: provider,
        showCollapseAll: false
    });

    // Register all command handlers
    registerCommandHandlers(context, provider, treeView);

    // Register tree view
    context.subscriptions.push(treeView);

    // Watch for changes in launch.json
    const fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/launch.json');
    fileSystemWatcher.onDidChange(async () => {
        try {
            await provider.refresh();
        } catch (error) {
            console.error('Failed to refresh on file change:', error);
        }
    });
    fileSystemWatcher.onDidCreate(async () => {
        try {
            await provider.refresh();
        } catch (error) {
            console.error('Failed to refresh on file creation:', error);
        }
    });
    fileSystemWatcher.onDidDelete(async () => {
        try {
            await provider.refresh();
        } catch (error) {
            console.error('Failed to refresh on file deletion:', error);
        }
    });

    context.subscriptions.push(fileSystemWatcher);

    // Watch for configuration changes
    const configWatcher = vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('ddd.clickBehavior')) {
            try {
                await provider.refresh();
            } catch (error) {
                console.error('Failed to refresh on configuration change:', error);
            }
        }
    });

    context.subscriptions.push(configWatcher);
}

// This method is called when your extension is deactivated
export function deactivate() { }