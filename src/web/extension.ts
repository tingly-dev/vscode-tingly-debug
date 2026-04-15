// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { registerCommandHandlers } from './core/commandHandlers';
import { DebugConfigurationProvider, DebugConfigurationItem, DebugErrorItem } from './views/debugPanel';
import { createModuleLogger } from './util/logger';

const log = createModuleLogger('Extension');

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    // Create shared output channel for error details
    const outputChannel = vscode.window.createOutputChannel('Tingly Debug Errors');
    context.subscriptions.push(outputChannel);

    // Create debug configuration provider
    const provider = new DebugConfigurationProvider();

    // Create tree view
    const treeView = vscode.window.createTreeView('tingly.debug.debugConfigurations', {
        treeDataProvider: provider,
        showCollapseAll: false
    }) as vscode.TreeView<DebugConfigurationItem | DebugErrorItem>;

    // Register all command handlers
    registerCommandHandlers(context, provider, treeView, outputChannel);

    // Register tree view
    context.subscriptions.push(treeView);

    // Watch for changes in launch.json
    const fileSystemWatcher = vscode.workspace.createFileSystemWatcher('**/.vscode/launch.json');
    fileSystemWatcher.onDidChange(async () => {
        try {
            await provider.refresh();
        } catch (error) {
            log.error('Failed to refresh on file change:', error);
        }
    });
    fileSystemWatcher.onDidCreate(async () => {
        try {
            await provider.refresh();
        } catch (error) {
            log.error('Failed to refresh on file creation:', error);
        }
    });
    fileSystemWatcher.onDidDelete(async () => {
        try {
            await provider.refresh();
        } catch (error) {
            log.error('Failed to refresh on file deletion:', error);
        }
    });

    context.subscriptions.push(fileSystemWatcher);

    // Watch for configuration changes
    const configWatcher = vscode.workspace.onDidChangeConfiguration(async (e) => {
        if (e.affectsConfiguration('tingly.debug.clickBehavior')) {
            try {
                await provider.refresh();
            } catch (error) {
                log.error('Failed to refresh on configuration change:', error);
            }
        }
    });

    context.subscriptions.push(configWatcher);
}

// This method is called when your extension is deactivated
export function deactivate() { }