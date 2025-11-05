import * as vscode from 'vscode';
import { ConfigurationData, LaunchCompound, LaunchConfiguration } from '../core/types';
import { DebugConfigurationProvider } from './debugPanel';
import htmlTemplate from './configurationEditor.html';

export class ConfigurationEditor {
    private static openPanels = new Map<string, vscode.WebviewPanel>();

    /**
     * Check if a specific configuration editor tab is open
     */
    static isTabOpen(configName: string): boolean {
        const panelId = `debugConfigSettings_${configName}`;
        return ConfigurationEditor.openPanels.has(panelId);
    }

    /**
     * Get all open configuration tabs
     */
    static getOpenTabs(): string[] {
        return Array.from(ConfigurationEditor.openPanels.keys())
            .map(panelId => panelId.replace('debugConfigSettings_', ''));
    }


    /**
     * Refresh a specific tab with updated configuration data
     */
    static async refreshTab(configName: string, provider: DebugConfigurationProvider): Promise<void> {
        const panelId = `debugConfigSettings_${configName}`;
        const panel = ConfigurationEditor.openPanels.get(panelId);

        if (!panel) {
            return;
        }

        try {
            console.log(`Refreshing tab for "${configName}"`);

            // Get latest configuration from provider
            const targetConfig = await this.getConfigurationFromProvider(configName, provider);
            if (!targetConfig) {
                console.error(`Configuration "${configName}" not found for refresh`);
                return;
            }

            // Prepare configuration data
            const configData: ConfigurationData = {
                name: targetConfig.name,
                type: targetConfig.type,
                request: targetConfig.request,
                properties: { ...targetConfig }
            };

            // Remove basic properties from the properties object to show only custom properties
            delete (configData.properties as any).name;
            delete (configData.properties as any).type;
            delete (configData.properties as any).request;

            // Update the webview content
            panel.webview.html = this.getConfigurationSettingsWebviewContent();

            // Send refresh message
            setTimeout(() => {
                if (panel.visible) {
                    panel.webview.postMessage({
                        command: 'refreshUI'
                    });
                }
            }, 100);

        } catch (error) {
            console.error(`Error refreshing tab "${configName}":`, error);
            vscode.window.showErrorMessage(`Failed to refresh configuration "${configName}": ${error}`);
        }
    }

    /**
     * Close a specific tab
     */
    static closeTab(configName: string): void {
        const panelId = `debugConfigSettings_${configName}`;
        const panel = ConfigurationEditor.openPanels.get(panelId);

        if (panel) {
            panel.dispose();
            ConfigurationEditor.openPanels.delete(panelId);
            console.log(`Closed tab for "${configName}"`);
        }
    }

    /**
     * Get configuration data from provider
     */
    private static async getConfigurationFromProvider(configName: string, provider: DebugConfigurationProvider): Promise<LaunchConfiguration | null> {
        try {
            console.log(`Getting configuration "${configName}" from provider`);
            const configurations = await provider.readConfigurationsOnly();
            console.log(`Available configurations:`, configurations.map(c => c.name));
            const foundConfig = configurations.find(config => config.name === configName);
            console.log(`Found configuration:`, foundConfig);
            return foundConfig || null;
        } catch (error) {
            console.error('Error reading configuration from provider:', error);
            return null;
        }
    }

    
    static async openConfigurationEditor(
        config: LaunchConfiguration | LaunchCompound,
        provider: DebugConfigurationProvider
    ): Promise<void> {
        // Only allow configuration settings for LaunchConfiguration, not compounds
        if ('configurations' in config) {
            vscode.window.showWarningMessage('Configuration settings are not available for compound configurations');
            return;
        }

        const launchConfig = config as LaunchConfiguration;
        const panelId = `debugConfigSettings_${launchConfig.name}`;

        console.log(`Opening configuration editor tab for "${launchConfig.name}"`);

        // Check if this specific tab is already open
        if (ConfigurationEditor.isTabOpen(launchConfig.name)) {
            // Tab already exists, just focus it
            console.log('Tab already open, focusing existing tab');
            const existingPanel = ConfigurationEditor.openPanels.get(panelId);
            if (existingPanel) {
                existingPanel.reveal();
                // Refresh the tab content to ensure it's up-to-date
                await ConfigurationEditor.refreshTab(launchConfig.name, provider);
                return;
            }
        }

        // Create and show webview panel with unique ID
        const panel = vscode.window.createWebviewPanel(
            panelId,
            `Configuration Settings: ${launchConfig.name}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Store the panel in our tracking map
        ConfigurationEditor.openPanels.set(panelId, panel);

        // Prepare configuration data for the webview
        const configData: ConfigurationData = {
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
        panel.webview.html = this.getConfigurationSettingsWebviewContent();

        // Handle panel disposal to clean up tracking
        panel.onDidDispose(() => {
            ConfigurationEditor.openPanels.delete(panelId);
        });

        // Send a refresh message after a short delay to ensure UI is properly initialized
        setTimeout(() => {
            if (panel.visible) {
                panel.webview.postMessage({
                    command: 'refreshUI'
                });
            }
        }, 200);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'openTab':
                        // Open another configuration in a new tab
                        try {
                            const targetConfig = await ConfigurationEditor.getConfigurationFromProvider(message.configName, provider);
                            if (targetConfig) {
                                await ConfigurationEditor.openConfigurationEditor(targetConfig, provider);
                            } else {
                                vscode.window.showErrorMessage(`Configuration "${message.configName}" not found`);
                            }
                        } catch (error) {
                            vscode.window.showErrorMessage(`Failed to open configuration: ${error}`);
                        }
                        break;
                    case 'browseEnvFile':
                        try {
                            await this.handleEnvFileBrowse(message.currentPath, panel, provider);
                        } catch (error) {
                            panel.webview.postMessage({
                                command: 'showEnvFileError',
                                message: `Failed to browse environment file: ${error}`
                            });
                        }
                        break;
                    case 'runConfiguration':
                        try {
                            // Save the configuration first
                            await provider.updateConfiguration(configData.name, message.config);

                            // Disable all breakpoints for run mode
                            await vscode.commands.executeCommand('workbench.debug.viewlet.action.disableAllBreakpoints');

                            // Then start debugging in run mode
                            const configToRun = { ...message.config };
                            if (configToRun.request === 'launch') {
                                configToRun.request = 'launch';
                            }

                            await vscode.debug.startDebugging(undefined, configToRun);
                            vscode.window.showInformationMessage(`Configuration "${configToRun.name}" is now running (breakpoints disabled)!`);
                            panel.dispose();
                        } catch (error) {
                            panel.webview.postMessage({
                                command: 'showError',
                                message: `Failed to run configuration: ${error}`
                            });
                        }
                        break;
                    case 'debugConfiguration':
                        try {
                            // Save the configuration first
                            await provider.updateConfiguration(configData.name, message.config);

                            // Enable all breakpoints for debug mode
                            await vscode.commands.executeCommand('workbench.debug.viewlet.action.enableAllBreakpoints');

                            // Then start debugging in debug mode
                            const configToDebug = { ...message.config };
                            if (configToDebug.request === 'launch') {
                                configToDebug.request = 'launch';
                            }

                            await vscode.debug.startDebugging(undefined, configToDebug);
                            vscode.window.showInformationMessage(`Configuration "${configToDebug.name}" is now debugging (breakpoints enabled)!`);
                            panel.dispose();
                        } catch (error) {
                            panel.webview.postMessage({
                                command: 'showError',
                                message: `Failed to debug configuration: ${error}`
                            });
                        }
                        break;
                    case 'saveConfiguration':
                        try {
                            const newName = message.config.name;
                            const oldName = configData.name;

                            // Check if name has changed and if there's a conflict
                            if (newName !== oldName) {
                                const launchJson = await provider.readLaunchJson();
                                const existingConfig = launchJson.configurations.find(config => config.name === newName);

                                if (existingConfig) {
                                    // Send error message back to webview
                                    panel.webview.postMessage({
                                        command: 'showError',
                                        message: `Configuration name "${newName}" already exists. Please choose a different name.`
                                    });
                                    return;
                                }
                            }

                            const updatedConfig: LaunchConfiguration = {
                                ...message.config
                            };

                            await provider.updateConfiguration(launchConfig.name, updatedConfig);
                            vscode.window.showInformationMessage(`Configuration "${newName}" updated successfully!`);
                            panel.dispose();
                        } catch (error) {
                            vscode.window.showErrorMessage(`Failed to update configuration: ${error}`);
                        }
                        break;
                    case 'cancel':
                        panel.dispose();
                        break;
                    case 'openLaunchJson':
                        try {
                            const launchJsonPath = provider['launchJsonPath'];
                            const launchUri = vscode.Uri.file(launchJsonPath);
                            const document = await vscode.workspace.openTextDocument(launchUri);
                            await vscode.window.showTextDocument(document);
                        } catch (error) {
                            vscode.window.showErrorMessage(`Failed to open launch.json: ${error}`);
                        }
                        break;
                    case 'checkUnsavedChanges':
                        try {
                            const currentConfig = JSON.parse(message.currentConfig);
                            const initialConfig = JSON.parse(message.initialConfig);
                            const hasChanges = JSON.stringify(currentConfig) !== JSON.stringify(initialConfig);

                            panel.webview.postMessage({
                                command: 'unsavedChangesResponse',
                                hasChanges,
                                currentConfig: message.currentConfig
                            });
                        } catch (error) {
                            console.error('Error checking unsaved changes:', error);
                        }
                        break;
                    case 'ready':
                        // Initialize the webview with configuration data
                        try {
                            const webviewData = {
                                config: {
                                    name: configData.name,
                                    type: configData.type,
                                    request: configData.request,
                                    env: configData.properties.env || {},
                                    envFile: configData.properties.envFile || '',
                                    properties: (() => {
                                        const result = { ...configData.properties };
                                        delete result.env;
                                        delete result.envFile;
                                        return result;
                                    })()
                                },
                                commonTypes: this.getCommonConfigurationTypes(),
                                initialConfig: JSON.stringify(configData, null, 2)
                            };

                            panel.webview.postMessage({
                                command: 'initialize',
                                data: webviewData
                            });
                        } catch (error) {
                            console.error('Error initializing webview:', error);
                            panel.webview.postMessage({
                                command: 'showError',
                                message: `Failed to initialize configuration editor: ${error}`
                            });
                        }
                        break;
                }
            },
            undefined,
            // Note: We don't have direct access to context.subscriptions here, but this is fine
            // as the webview panel will be properly disposed when the panel is closed
            []
        );
    }

    private static getCommonConfigurationTypes(): string[] {
        return [
            'node',
            'node-terminal',
            'python',
            'java',
            'cppdbg',
            'cppvsdbg',
            'chrome',
            'firefox',
            'msedge',
            'coreclr',
            'dart',
            'go',
            'php',
            'ruby',
            'lua',
            'rust',
            'elm',
            'mock',
            'pwa-node',
            'pwa-chrome',
            'pwa-msedge',
            'node2'
        ];
    }

    private static async handleEnvFileBrowse(currentPath: string, panel: vscode.WebviewPanel, provider: DebugConfigurationProvider): Promise<void> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace folder found');
        }

        const workspaceRoot = workspaceFolders[0].uri.fsPath;

        // Replace ${workspaceFolder} with actual path
        const resolvedPath = currentPath.replace('${workspaceFolder}', workspaceRoot);

        try {
            // Check if file exists
            const fileUri = vscode.Uri.file(resolvedPath);
            const stat = await vscode.workspace.fs.stat(fileUri);

            // File exists, open it
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document);

            // Set the path in the webview
            panel.webview.postMessage({
                command: 'setEnvFile',
                path: currentPath
            });

        } catch (error) {
            // File doesn't exist, offer to create it
            const createOption = 'Create File';
            const result = await vscode.window.showErrorMessage(
                `Environment file not found: ${resolvedPath}`,
                createOption,
                'Cancel'
            );

            if (result === createOption) {
                // Create the file with template content
                const templateContent = `# Environment variables
# Copy this template and modify as needed
NODE_ENV=development
API_URL=http://localhost:3000
`;

                const fileUri = vscode.Uri.file(resolvedPath);
                const encoder = new TextEncoder();
                await vscode.workspace.fs.writeFile(fileUri, encoder.encode(templateContent));

                // Open the newly created file
                const document = await vscode.workspace.openTextDocument(fileUri);
                await vscode.window.showTextDocument(document);

                // Set the path in the webview
                panel.webview.postMessage({
                    command: 'setEnvFile',
                    path: currentPath
                });

                vscode.window.showInformationMessage(`Environment file created: ${resolvedPath}`);
            }
        }
    }

    private static getConfigurationSettingsWebviewContent(): string {
        return htmlTemplate;
    }

    
    // Helper methods moved to HTML template (only keeping utility methods in TypeScript)
    private static escapeForJsTemplate(str: string): string {
        return str.replace(/`/g, '\\`').replace(/\${/g, '\\${');
    }

    private static isArrayProperty(key: string): boolean {
        return ['args', 'outFiles', 'preLaunchTask', 'postDebugTask', 'configurations', 'inputs'].includes(key);
    }

    private static arrayToString(arr: any[]): string {
        return JSON.stringify(arr);
    }

    private static escapeHtmlTags(text: string): string {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}