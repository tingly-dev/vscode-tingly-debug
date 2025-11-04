import * as vscode from 'vscode';
import { ConfigurationData, LaunchCompound, LaunchConfiguration } from '../core/types';
import { DebugConfigurationProvider } from './debugPanel';

export class ConfigurationEditor {
    private static openPanels = new Map<string, vscode.WebviewPanel>();

    /**
     * Check if any configuration editor panel is currently open
     */
    static hasOpenPanel(): boolean {
        return ConfigurationEditor.openPanels.size > 0;
    }

    /**
     * Get the currently open panel configuration name
     */
    static getOpenPanelConfig(): string | null {
        if (ConfigurationEditor.openPanels.size === 0) {
            return null;
        }
        // Return the first (and only) panel's configuration name
        const panelId = Array.from(ConfigurationEditor.openPanels.keys())[0];
        return panelId.replace('debugConfigSettings_', '');
    }

    /**
     * Request panel switch with confirmation
     */
    static async requestPanelSwitch(newConfigName: string): Promise<boolean> {
        if (ConfigurationEditor.openPanels.size === 0) {
            return true; // No panel open, allow switch
        }

        const panelId = Array.from(ConfigurationEditor.openPanels.keys())[0];
        const panel = ConfigurationEditor.openPanels.get(panelId);

        if (!panel) {
            return true; // Panel not found, allow switch
        }

        // Focus the existing panel
        panel.reveal();

        // Send message to panel to handle switch confirmation
        panel.webview.postMessage({
            command: 'requestSwitch',
            newConfigName: newConfigName
        });

        return false; // Don't switch immediately, wait for user response
    }

    /**
     * Force close current panel (called after user confirms)
     */
    static closeCurrentPanel(): void {
        if (ConfigurationEditor.openPanels.size === 0) {
            return;
        }

        const panelId = Array.from(ConfigurationEditor.openPanels.keys())[0];
        const panel = ConfigurationEditor.openPanels.get(panelId);

        if (panel) {
            panel.dispose();
        }

        ConfigurationEditor.openPanels.delete(panelId);
    }

    /**
     * Escape template literals in JavaScript contexts but preserve VS Code variables
     */
    private static escapeForJsTemplate(value: string): string {
        // Escape $ to prevent template literal evaluation in JavaScript
        // This preserves VS Code variables like ${workspaceFolder} for runtime use
        return value.replace(/\${/g, '\\${}');
    }

    /**
     * Check if a property is typically an array type
     */
    private static isArrayProperty(key: string): boolean {
        const arrayProperties = ['args', 'outFiles', 'preLaunchTask', 'postDebugTask', 'configurations', 'inputs'];
        return arrayProperties.includes(key);
    }

    /**
     * Convert array to JSON string for display in input field
     */
    private static arrayToString(value: any[]): string {
        return JSON.stringify(value);
    }

    /**
     * Convert JSON string to array
     */
    private static stringToArray(value: string): any[] {
        if (!value || !value.trim()) return [];
        // Try to parse as JSON array
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            // If JSON parsing fails, treat as comma-separated values for backwards compatibility
            return value.split(',').map(item => {
                const trimmed = item.trim();
                // Try to parse each item as JSON, if fails keep as string
                try {
                    return JSON.parse(trimmed);
                } catch {
                    return trimmed;
                }
            });
        }
    }

    /**
     * Escape HTML tags to prevent XSS
     */
    private static escapeHtmlTags(value: string): string {
        return value.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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

        // Check if any panel is already open
        if (ConfigurationEditor.hasOpenPanel()) {
            const openConfigName = ConfigurationEditor.getOpenPanelConfig();
            if (openConfigName === launchConfig.name) {
                // Same configuration is already open, just focus it
                const existingPanel = ConfigurationEditor.openPanels.get(panelId);
                if (existingPanel) {
                    existingPanel.reveal();
                    return;
                }
            } else {
                // Different configuration is open, request panel switch
                const canSwitch = await ConfigurationEditor.requestPanelSwitch(launchConfig.name);
                if (!canSwitch) {
                    return; // Switch request is being handled by the panel
                }
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

        // Store initial config data for change detection
        const initialConfigJson = JSON.stringify(launchConfig, null, 2);

        // Generate HTML for the webview
        panel.webview.html = this.getConfigurationSettingsWebviewContent(panel.webview, configData, initialConfigJson);

        // Handle panel disposal to clean up tracking
        panel.onDidDispose(() => {
            ConfigurationEditor.openPanels.delete(panelId);
        });

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'confirmSwitch':
                        // User confirmed the switch action
                        if (message.action === 'discard') {
                            // Close current panel and allow switch
                            ConfigurationEditor.closeCurrentPanel();
                            // Re-open with new configuration
                            await ConfigurationEditor.openConfigurationEditor(
                                { name: message.newConfigName, type: '', request: 'launch' } as LaunchConfiguration,
                                provider
                            );
                        } else if (message.action === 'switch') {
                            // Direct switch (no unsaved changes)
                            ConfigurationEditor.closeCurrentPanel();
                            // Re-open with new configuration
                            await ConfigurationEditor.openConfigurationEditor(
                                { name: message.newConfigName, type: '', request: 'launch' } as LaunchConfiguration,
                                provider
                            );
                        }
                        break;
                    case 'performSwitch':
                        // Perform the actual switch (no data changes)
                        ConfigurationEditor.closeCurrentPanel();
                        // Show notification and re-open with new configuration
                        vscode.window.showInformationMessage(`Switching to configuration "${message.newConfigName}"`);
                        await ConfigurationEditor.openConfigurationEditor(
                            { name: message.newConfigName, type: '', request: 'launch' } as LaunchConfiguration,
                            provider
                        );
                        break;
                    case 'saveAndSwitch':
                        try {
                            // Save current configuration first
                            await provider.updateConfiguration(launchConfig.name, message.config);
                            vscode.window.showInformationMessage(`Configuration "${launchConfig.name}" updated successfully!`);

                            // Close current panel and switch to new one
                            ConfigurationEditor.closeCurrentPanel();
                            await ConfigurationEditor.openConfigurationEditor(
                                { name: message.newConfigName, type: '', request: 'launch' } as LaunchConfiguration,
                                provider
                            );
                        } catch (error) {
                            vscode.window.showErrorMessage(`Failed to save configuration: ${error}`);
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

    private static getConfigurationSettingsWebviewContent(webview: vscode.Webview, configData: ConfigurationData, initialConfigJson: string): string {
        // Generate type dropdown options
        const typeOptions = this.getCommonConfigurationTypes()
            .map(type => `<option value="${type}" ${type === configData.type ? 'selected' : ''}>${type}</option>`)
            .join('');

        // Extract env and envFile from properties, keep other properties separate
        const env = configData.properties.env || {};
        const envFile = configData.properties.envFile || '';
        const otherProperties = { ...configData.properties };
        delete otherProperties.env;
        delete otherProperties.envFile;

        // Generate env table rows
        const envRows = Object.entries(env)
            .map(([key, value], index) => {
                const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
                return `
                    <tr data-index="${index}">
                        <td>
                            <input type="text" id="env-key-${index}" name="env-key-${index}" value="${key.replace(/"/g, '&quot;')}" placeholder="Environment variable name">
                        </td>
                        <td>
                            <input type="text" id="env-value-${index}" name="env-value-${index}" value="${displayValue.replace(/"/g, '&quot;')}" placeholder="Environment variable value">
                        </td>
                        <td class="env-actions">
                            <button type="button" class="env-btn remove" onclick="removeEnvRow(${index})" title="Remove variable">🗑️</button>
                        </td>
                    </tr>
                `;
            })
            .join('');

        const propertiesHtml = Object.entries(otherProperties)
            .map(([key, value]) => {
                const isArray = this.isArrayProperty(key);
                let displayValue;
                let inputHtml;

                if (isArray) {
                    displayValue = Array.isArray(value) ? this.arrayToString(value) : '';
                    inputHtml = `
                        <div class="array-input-container" id="array-container-${key}">
                            <div class="array-input-mode">
                                <div class="array-mode-buttons">
                                    <button type="button" class="array-mode-btn ${!displayValue.includes('\n') ? 'active' : ''}"
                                            onclick="setArrayMode('${key}', 'single')" title="Single line input">
                                        <span class="codicon codicon-symbol-string"></span>
                                    </button>
                                    <button type="button" class="array-mode-btn ${displayValue.includes('\n') ? 'active' : ''}"
                                            onclick="setArrayMode('${key}', 'list')" title="List input">
                                        <span class="codicon codicon-list-flat"></span>
                                    </button>
                                </div>
                            </div>
                            <div class="array-input-content">
                                <input type="text" id="prop-${key}" name="${key}"
                                       value="${displayValue.replace(/"/g, '&quot;')}"
                                       placeholder="Enter JSON array for ${key} (e.g., [\\"value1\\", \\"value2\\"])"
                                       class="array-single-input"
                                       oninput="updateJsonPreview()">
                                <textarea id="prop-${key}-list" name="${key}-list"
                                          placeholder="Enter one value per line for ${key}"
                                          class="array-list-input"
                                          style="display: none;"
                                          oninput="updateJsonPreviewFromList('${key}')">${this.escapeHtmlTags(Array.isArray(value) ? value.join('\n') : '')}</textarea>
                            </div>
                        </div>
                    `;
                } else {
                    displayValue = typeof value === 'string' ? value : JSON.stringify(value);
                    inputHtml = `
                        <input type="text" id="prop-${key}" name="${key}"
                               value="${displayValue.replace(/"/g, '&quot;')}"
                               placeholder="Enter ${key}"
                               oninput="updateJsonPreview()">
                    `;
                }

                return `
                    <div class="field-group ${isArray ? 'array-field' : ''}">
                        <label for="prop-${key}">${key} ${isArray ? '<span class="array-badge">Array</span>' : ''}</label>
                        <div class="field-content">
                            ${inputHtml}
                            <button type="button" class="remove-btn" onclick="removeField('${key}')">🗑️</button>
                        </div>
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
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .header-actions {
            display: flex;
            gap: 8px;
        }
        .launch-json-btn, .run-btn, .debug-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 6px 12px;
            border: 1px solid var(--vscode-button-border);
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            border-radius: 3px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            transition: background-color 0.2s;
        }
        .launch-json-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .run-btn, .debug-btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .run-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .debug-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
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
        .hybrid-input {
            display: flex;
            gap: 5px;
            align-items: stretch;
            flex: 1;
        }
        .hybrid-input input[type="text"] {
            flex: 1;
        }
        .hybrid-input select {
            flex: 0 0 auto;
            min-width: 130px;
            max-width: 200px;
        }
        .or-divider {
            color: var(--vscode-foreground);
            font-size: 12px;
            padding: 0 5px;
            display: flex;
            align-items: center;
            opacity: 0.7;
            white-space: nowrap;
        }
        .env-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        .env-table th,
        .env-table td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .env-table th {
            font-weight: bold;
            color: var(--vscode-foreground);
            font-size: 13px;
        }
        .env-table input[type="text"] {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            padding: 4px 6px;
        }
        .env-table input[type="text"]:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        .env-actions {
            display: flex;
            gap: 5px;
            justify-content: center;
        }
        .env-btn {
            background: none;
            border: 1px solid var(--vscode-button-border);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-family: var(--vscode-font-family);
        }
        .env-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .env-btn.remove {
            color: var(--vscode-errorForeground);
            border-color: var(--vscode-errorBorder);
        }
        .env-btn.remove:hover {
            background-color: var(--vscode-errorBackground);
        }
        .file-input-group {
            display: flex;
            gap: 8px;
            align-items: center;
            margin-top: 10px;
        }
        .file-input-group input[type="text"] {
            flex: 1;
        }
        .file-input-group button {
            flex: 0 0 auto;
            padding: 6px 12px;
            border: 1px solid var(--vscode-button-border);
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            border-radius: 3px;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }
        .file-input-group button:hover {
            background-color: var(--vscode-button-hoverBackground);
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
        .error-message {
            margin-top: 10px;
            padding: 10px;
            background-color: var(--vscode-errorBackground);
            border: 1px solid var(--vscode-errorBorder);
            border-radius: 4px;
            color: var(--vscode-errorForeground);
            font-size: var(--vscode-font-size);
            display: none;
        }
        .array-field {
            align-items: flex-start;
        }
        .array-badge {
            font-size: 10px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 3px;
            margin-left: 8px;
            font-weight: normal;
        }
        .field-content {
            display: flex;
            gap: 10px;
            align-items: center;
            flex: 1;
        }
        .array-input-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
            flex: 1;
        }
        .array-input-mode {
            display: flex;
            justify-content: flex-end;
        }
        .array-mode-buttons {
            display: flex;
            border: 1px solid var(--vscode-button-border);
            border-radius: 3px;
            overflow: hidden;
        }
        .array-mode-btn {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            transition: background-color 0.2s;
        }
        .array-mode-btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .array-mode-btn.active {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        .array-input-content {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .array-list-input {
            min-height: 80px;
            resize: vertical;
            border: 1px solid var(--vscode-input-border);
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            padding: 6px 8px;
            border-radius: 3px;
        }
        .array-list-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: -1px;
        }
        .array-single-input {
            width: 100%;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Configuration Settings</h2>
            <div class="header-actions">
                <button type="button" class="launch-json-btn" onclick="openLaunchJson()" title="Open launch.json file">
                    <span class="codicon codicon-file-json"></span> launch.json
                </button>
                <button type="button" class="run-btn" onclick="runConfiguration()" title="Run configuration without breakpoints">
                    <span class="codicon codicon-play"></span> Run
                </button>
                <button type="button" class="debug-btn" onclick="debugConfiguration()" title="Debug configuration with breakpoints">
                    <span class="codicon codicon-debug-alt"></span> Debug
                </button>
            </div>
        </div>

        <form id="configForm">
        <div class="section">
            <div class="section-title">Basic Information</div>
            <div class="field-group">
                <label for="configName">Name</label>
                <input type="text" id="configName" name="name" value="${configData.name}" placeholder="Configuration name">
            </div>
            <div class="field-group">
                <label for="configType">Type</label>
                <div class="hybrid-input">
                    <input type="text" id="configType" name="type" value="${configData.type}" placeholder="Enter configuration type..." oninput="clearTypeSelect()">
                    <div class="or-divider">or</div>
                    <select id="configTypeSelect" onchange="updateTypeFromSelect()">
                        <option value="">Select preset...</option>
                        ${typeOptions}
                    </select>
                </div>
            </div>
            <div class="field-group">
                <label for="configRequest">Request</label>
                <div class="hybrid-input">
                    <input type="text" id="configRequest" name="request" value="${configData.request}" placeholder="Enter request type..." oninput="clearRequestSelect()">
                    <div class="or-divider">or</div>
                    <select id="configRequestSelect" onchange="updateRequestFromSelect()">
                        <option value="">Select preset...</option>
                        <option value="launch" ${configData.request === 'launch' ? 'selected' : ''}>launch</option>
                        <option value="attach" ${configData.request === 'attach' ? 'selected' : ''}>attach</option>
                    </select>
                </div>
            </div>
            <div id="errorMessage" class="error-message"></div>
        </div>

            <div class="section">
                <div class="section-title">Environment Variables</div>
                
                <div style="margin-bottom: 15px;">
                    <table class="env-table" id="envTable">
                        <thead>
                            <tr>
                                <th style="width: 35%;">Variable Name</th>
                                <th style="width: 45%;">Value</th>
                                <th style="width: 20%;">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="envTableBody">
                            ${envRows}
                            ${envRows === '' ? '<tr id="emptyEnvRow"><td colspan="3" style="text-align: center; opacity: 0.6; padding: 20px;">No environment variables configured. Click "Add Variable" to get started.</td></tr>' : ''}
                        </tbody>
                    </table>
                    <div class="env-actions">
                        <button type="button" class="env-btn" onclick="addEnvRow()">➕ Add Variable</button>
                    </div>
                </div>

                <div class="file-input-group">
                    <label for="envFile" style="flex: 0 0 auto; min-width: 80px;">Env File:</label>
                    <input type="text" id="envFile" name="envFile" value="${envFile}" placeholder="\${workspaceFolder}/.env">
                    <button type="button" onclick="browseEnvFile()">Browse</button>
                </div>
            </div>

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

        // Store initial configuration for change detection
        const initialConfig = \`${this.escapeForJsTemplate(initialConfigJson)}\`;
        let isDirty = false;

        // Debug function to check if all required DOM elements are present
        function debugDomElements() {
            const requiredElements = [
                'configForm',
                'jsonPreview',
                'configName',
                'configType',
                'configRequest'
            ];

            const missingElements = requiredElements.filter(id => !document.getElementById(id));

            if (missingElements.length > 0) {
                console.error('Missing DOM elements:', missingElements);
                return false;
            }

            console.log('All required DOM elements are present');
            return true;
        }

        // Array input handling functions
        function setArrayMode(propertyName, mode) {
            const singleInput = document.getElementById(\`prop-\${propertyName}\`);
            const listInput = document.getElementById(\`prop-\${propertyName}-list\`);
            const singleBtn = document.querySelector(\`#array-container-\${propertyName} .array-mode-btn:first-child\`);
            const listBtn = document.querySelector(\`#array-container-\${propertyName} .array-mode-btn:last-child\`);

            if (mode === 'single') {
                // Switch to single line mode
                if (listInput && singleInput) {
                    // Convert list to JSON array string
                    const listValue = listInput.value.trim();
                    if (listValue) {
                        const arrayValue = listValue.split('\\n').filter(line => line.trim()).map(line => line.trim());
                        singleInput.value = JSON.stringify(arrayValue);
                    } else {
                        singleInput.value = '[]';
                    }
                }

                if (singleInput) singleInput.style.display = 'block';
                if (listInput) listInput.style.display = 'none';
                if (singleBtn) singleBtn.classList.add('active');
                if (listBtn) listBtn.classList.remove('active');
            } else if (mode === 'list') {
                // Switch to list mode
                if (singleInput && listInput) {
                    // Convert JSON array string to list
                    const singleValue = singleInput.value.trim();
                    if (singleValue) {
                        try {
                            const arrayValue = JSON.parse(singleValue);
                            if (Array.isArray(arrayValue)) {
                                listInput.value = arrayValue.map(item => String(item)).join('\\n');
                            } else {
                                listInput.value = String(arrayValue);
                            }
                        } catch {
                            // If JSON parsing fails, treat as comma-separated for backwards compatibility
                            const arrayValue = singleValue.split(',').map(item => item.trim()).filter(item => item);
                            listInput.value = arrayValue.join('\\n');
                        }
                    }
                }

                if (singleInput) singleInput.style.display = 'none';
                if (listInput) listInput.style.display = 'block';
                if (singleBtn) singleBtn.classList.remove('active');
                if (listBtn) listBtn.classList.add('active');
            }

            updateJsonPreview();
        }

        function updateJsonPreviewFromList(propertyName) {
            // Update the corresponding single input field
            const listInput = document.getElementById(\`prop-\${propertyName}-list\`);
            const singleInput = document.getElementById(\`prop-\${propertyName}\`);

            if (listInput && singleInput) {
                const listValue = listInput.value.trim();
                if (listValue) {
                    const arrayValue = listValue.split('\\n').filter(line => line.trim()).map(line => line.trim());
                    singleInput.value = JSON.stringify(arrayValue);
                } else {
                    singleInput.value = '[]';
                }
            }

            updateJsonPreview();
        }

        function handlePanelSwitchRequest(newConfigName) {
            const currentConfigName = document.getElementById('configName').value;

            // Check if data has actually changed
            if (!hasDataChanged()) {
                // No actual data changes, directly switch with notification
                vscode.postMessage({
                    command: 'performSwitch',
                    newConfigName: newConfigName
                });
                return;
            }

            // There are actual changes, show confirmation dialog
            const shouldShowDialog = () => {
                const modal = document.createElement('div');
                modal.style.cssText = \`
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                \`;

                const dialog = document.createElement('div');
                dialog.style.cssText = \`
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 6px;
                    padding: 20px;
                    min-width: 400px;
                    max-width: 600px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                \`;

                dialog.innerHTML = \`
                    <h3 style="margin: 0 0 15px 0; color: var(--vscode-foreground);">
                        Switch Configuration?
                    </h3>
                    <p style="margin: 0 0 20px 0; color: var(--vscode-foreground);">
                        You have unsaved changes to "\${currentConfigName}". What would you like to do with these changes?
                    </p>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button type="button" id="btn-cancel" style="
                            padding: 8px 16px;
                            border: 1px solid var(--vscode-button-border);
                            background-color: var(--vscode-button-secondaryBackground);
                            color: var(--vscode-button-secondaryForeground);
                            border-radius: 3px;
                            cursor: pointer;
                        ">Cancel</button>
                        <button type="button" id="btn-discard" style="
                            padding: 8px 16px;
                            border: 1px solid var(--vscode-button-border);
                            background-color: var(--vscode-button-secondaryBackground);
                            color: var(--vscode-button-secondaryForeground);
                            border-radius: 3px;
                            cursor: pointer;
                        ">Discard Changes</button>
                        <button type="button" id="btn-save" style="
                            padding: 8px 16px;
                            border: 1px solid var(--vscode-button-border);
                            background-color: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                            border-radius: 3px;
                            cursor: pointer;
                        ">Save & Switch</button>
                    </div>
                \`;

                modal.appendChild(dialog);
                document.body.appendChild(modal);

                // Add event listeners
                document.getElementById('btn-cancel').addEventListener('click', () => {
                    document.body.removeChild(modal);
                    vscode.postMessage({
                        command: 'confirmSwitch',
                        action: 'cancel',
                        newConfigName: newConfigName
                    });
                });

                document.getElementById('btn-discard').addEventListener('click', () => {
                    document.body.removeChild(modal);
                    vscode.postMessage({
                        command: 'confirmSwitch',
                        action: 'discard',
                        newConfigName: newConfigName
                    });
                });

                document.getElementById('btn-save').addEventListener('click', () => {
                    document.body.removeChild(modal);
                    // Save current configuration first
                    const currentConfig = getCurrentFormConfig();
                    vscode.postMessage({
                        command: 'saveAndSwitch',
                        config: currentConfig,
                        newConfigName: newConfigName
                    });
                });

                // Close on outside click
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        document.body.removeChild(modal);
                        vscode.postMessage({
                            command: 'confirmSwitch',
                            action: 'cancel',
                            newConfigName: newConfigName
                        });
                    }
                });

                // Close on Escape key
                const handleEscape = (e) => {
                    if (e.key === 'Escape') {
                        document.body.removeChild(modal);
                        document.removeEventListener('keydown', handleEscape);
                        vscode.postMessage({
                            command: 'confirmSwitch',
                            action: 'cancel',
                            newConfigName: newConfigName
                        });
                    }
                };
                document.addEventListener('keydown', handleEscape);
            };

            shouldShowDialog();
        }

        function updateTypeFromSelect() {
            const select = document.getElementById('configTypeSelect');
            const input = document.getElementById('configType');

            if (select.value) {
                input.value = select.value;
            }
            updateJsonPreview();
        }

        function updateRequestFromSelect() {
            const select = document.getElementById('configRequestSelect');
            const input = document.getElementById('configRequest');

            if (select.value) {
                input.value = select.value;
            }
            updateJsonPreview();
        }

        function clearTypeSelect() {
            document.getElementById('configTypeSelect').value = '';
        }

        function clearRequestSelect() {
            document.getElementById('configRequestSelect').value = '';
        }

        let envRowIndex = ${Object.keys(env).length};

        function addEnvRow() {
            const tbody = document.getElementById('envTableBody');

            // Remove empty state row if it exists
            const emptyRow = document.getElementById('emptyEnvRow');
            if (emptyRow) {
                emptyRow.remove();
            }

            const index = envRowIndex++;
            const row = document.createElement('tr');
            row.setAttribute('data-index', index);
            row.innerHTML = \`
                <td>
                    <input type="text" id="env-key-\${index}" name="env-key-\${index}" placeholder="Environment variable name">
                </td>
                <td>
                    <input type="text" id="env-value-\${index}" name="env-value-\${index}" placeholder="Environment variable value">
                </td>
                <td class="env-actions">
                    <button type="button" class="env-btn remove" onclick="removeEnvRow(\${index})" title="Remove variable">🗑️</button>
                </td>
            \`;
            tbody.appendChild(row);

            // Add event listeners to new inputs
            row.querySelectorAll('input[type="text"]').forEach(input => {
                input.addEventListener('input', updateJsonPreview);
            });

            // Focus on the key input field
            document.getElementById(\`env-key-\${index}\`).focus();

            updateJsonPreview();
        }

        function removeEnvRow(index) {
            const row = document.querySelector(\`#env-key-\${index}\`)?.closest('tr');
            if (row) {
                row.remove();

                // If no more rows, show empty state
                const tbody = document.getElementById('envTableBody');
                if (tbody.children.length === 0) {
                    tbody.innerHTML = \'<tr id="emptyEnvRow"><td colspan="3" style="text-align: center; opacity: 0.6; padding: 20px;">No environment variables configured. Click "Add Variable" to get started.</td></tr>\';
                }

                updateJsonPreview();
            }
        }

        function browseEnvFile() {
            const currentValue = document.getElementById('envFile').value;

            // Send message to extension to handle file browsing
            vscode.postMessage({
                command: 'browseEnvFile',
                currentPath: currentValue || '\${workspaceFolder}/.env'
            });
        }

        function getEnvObject() {
            const env = {};
            const envInputs = document.querySelectorAll('[id^="env-key-"]');

            envInputs.forEach(input => {
                const key = input.value.trim();
                const index = input.id.split('-')[2];
                const valueInput = document.getElementById(\`env-value-\${index}\`);
                const value = valueInput ? valueInput.value.trim() : '';

                if (key) {
                    env[key] = value;
                }
            });

            return env;
        }

        function checkForChanges() {
            const currentConfig = getCurrentFormConfig();
            const currentConfigJson = JSON.stringify(currentConfig, null, 2);
            const hasChanges = currentConfigJson !== initialConfig;

            // Update dirty state
            isDirty = hasChanges;

            // Update title to show unsaved changes indicator
            if (hasChanges) {
                document.title = document.title.replace(/^[●]?\s*/, '● ');
            } else {
                document.title = document.title.replace(/^[●]\s*/, '');
            }
        }

        function getCurrentFormConfig() {
            try {
                const form = document.getElementById('configForm');
                if (!form) {
                    console.error('Form element not found');
                    return {};
                }

                const formData = new FormData(form);
                const config = {};

                // Add basic properties from form (name, type, request)
                for (let [key, value] of formData.entries()) {
                    if (key && !key.startsWith('env-') && !key.endsWith('-list')) {
                        // Check if this is an array property
                        const isArrayField = ['args', 'outFiles', 'preLaunchTask', 'postDebugTask', 'configurations', 'inputs'].includes(key);

                        if (isArrayField) {
                            // Parse as JSON array
                            if (value && value.trim()) {
                                try {
                                    const parsed = JSON.parse(value);
                                    config[key] = Array.isArray(parsed) ? parsed : [parsed];
                                } catch {
                                    // If JSON parsing fails, treat as comma-separated for backwards compatibility
                                    config[key] = value.split(',').map(item => {
                                        const trimmed = item.trim();
                                        // Try to parse as JSON, if fails keep as string
                                        try {
                                            return JSON.parse(trimmed);
                                        } catch {
                                            return trimmed;
                                        }
                                    });
                                }
                            } else {
                                config[key] = [];
                            }
                        } else {
                            // Try to parse as JSON, otherwise keep as string
                            try {
                                config[key] = JSON.parse(value);
                            } catch {
                                config[key] = value;
                            }
                        }
                    }
                }

                // Add environment variables
                const env = getEnvObject();
                if (Object.keys(env).length > 0) {
                    config.env = env;
                }

                // Add env file if specified
                const envFileInput = document.getElementById('envFile');
                if (envFileInput) {
                    const envFile = envFileInput.value.trim();
                    if (envFile) {
                        config.envFile = envFile;
                    }
                }

                return config;
            } catch (error) {
                console.error('Error getting form configuration:', error);
                return {};
            }
        }

        function hasDataChanged() {
            const currentConfig = getCurrentFormConfig();
            return !deepEqual(currentConfig, JSON.parse(initialConfig));
        }

        function deepEqual(obj1, obj2) {
            if (obj1 === obj2) return true;

            if (obj1 == null || obj2 == null) return obj1 === obj2;

            if (typeof obj1 !== typeof obj2) return false;

            if (typeof obj1 !== 'object') return obj1 === obj2;

            if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;

            if (Array.isArray(obj1)) {
                if (obj1.length !== obj2.length) return false;
                for (let i = 0; i < obj1.length; i++) {
                    if (!deepEqual(obj1[i], obj2[i])) return false;
                }
                return true;
            }

            const keys1 = Object.keys(obj1);
            const keys2 = Object.keys(obj2);

            if (keys1.length !== keys2.length) return false;

            for (const key of keys1) {
                if (!keys2.includes(key)) return false;
                if (!deepEqual(obj1[key], obj2[key])) return false;
            }

            return true;
        }

        function updateJsonPreview() {
            try {
                const config = getCurrentFormConfig();
                const jsonString = JSON.stringify(config, null, 2);
                const previewElement = document.getElementById('jsonPreview');

                if (previewElement) {
                    previewElement.textContent = jsonString;
                    checkForChanges();
                } else {
                    console.error('JSON Preview element not found in DOM');
                    // Try again after a short delay
                    setTimeout(updateJsonPreview, 50);
                }
            } catch (error) {
                console.error('Error updating JSON preview:', error);
                const previewElement = document.getElementById('jsonPreview');
                if (previewElement) {
                    previewElement.textContent = 'Error generating JSON preview: ' + (error instanceof Error ? error.message : String(error));
                }
            }
        }

        function showError(message) {
            const errorElement = document.getElementById('errorMessage');
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }

        function hideError() {
            const errorElement = document.getElementById('errorMessage');
            errorElement.style.display = 'none';
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
            hideError(); // Hide any previous errors

            const formData = new FormData(document.getElementById('configForm'));
            const config = {};

            // Add basic properties from form (name, type, request)
            for (let [key, value] of formData.entries()) {
                if (key && !key.startsWith('env-')) {
                    // Try to parse as JSON, otherwise keep as string
                    try {
                        config[key] = JSON.parse(value);
                    } catch {
                        config[key] = value;
                    }
                }
            }

            // Add environment variables
            const env = getEnvObject();
            if (Object.keys(env).length > 0) {
                config.env = env;
            }

            // Add env file if specified
            const envFile = document.getElementById('envFile').value.trim();
            if (envFile) {
                config.envFile = envFile;
            }

            vscode.postMessage({
                command: 'saveConfiguration',
                config: config
            });
        }

        function cancel() {
            if (isDirty) {
                const result = confirm('You have unsaved changes. Are you sure you want to close without saving?');
                if (!result) {
                    return; // User cancelled the close
                }
            }
            vscode.postMessage({
                command: 'cancel'
            });
        }

        function runConfiguration() {
            hideError(); // Hide any previous errors

            // Get current configuration
            const formData = new FormData(document.getElementById('configForm'));
            const config = {};

            // Add basic properties from form (name, type, request)
            for (let [key, value] of formData.entries()) {
                if (key && !key.startsWith('env-')) {
                    // Try to parse as JSON, otherwise keep as string
                    try {
                        config[key] = JSON.parse(value);
                    } catch {
                        config[key] = value;
                    }
                }
            }

            // Add environment variables
            const env = getEnvObject();
            if (Object.keys(env).length > 0) {
                config.env = env;
            }

            // Add env file if specified
            const envFile = document.getElementById('envFile').value.trim();
            if (envFile) {
                config.envFile = envFile;
            }

            // Send run command
            vscode.postMessage({
                command: 'runConfiguration',
                config: config
            });
        }

        function openLaunchJson() {
            vscode.postMessage({
                command: 'openLaunchJson'
            });
        }

        function debugConfiguration() {
            hideError(); // Hide any previous errors

            // Get current configuration
            const formData = new FormData(document.getElementById('configForm'));
            const config = {};

            // Add basic properties from form (name, type, request)
            for (let [key, value] of formData.entries()) {
                if (key && !key.startsWith('env-')) {
                    // Try to parse as JSON, otherwise keep as string
                    try {
                        config[key] = JSON.parse(value);
                    } catch {
                        config[key] = value;
                    }
                }
            }

            // Add environment variables
            const env = getEnvObject();
            if (Object.keys(env).length > 0) {
                config.env = env;
            }

            // Add env file if specified
            const envFile = document.getElementById('envFile').value.trim();
            if (envFile) {
                config.envFile = envFile;
            }

            // Send debug command
            vscode.postMessage({
                command: 'debugConfiguration',
                config: config
            });
        }

        // Add event listeners to all existing fields
        document.querySelectorAll('input[type="text"]').forEach(input => {
            input.addEventListener('input', updateJsonPreview);
        });

        // Add event listeners to select dropdowns
        document.querySelectorAll('select').forEach(select => {
            select.addEventListener('change', updateJsonPreview);
        });

        // Add event listeners to env table inputs
        document.querySelectorAll('#envTableBody input[type="text"]').forEach(input => {
            input.addEventListener('input', updateJsonPreview);
        });

        // Add event listener to envFile input
        const envFileInput = document.getElementById('envFile');
        if (envFileInput) {
            envFileInput.addEventListener('input', updateJsonPreview);
        }

        // Initialize select dropdowns based on current input values
        const commonTypes = ${JSON.stringify(this.getCommonConfigurationTypes())};
        const typeInput = document.getElementById('configType');
        const typeSelect = document.getElementById('configTypeSelect');
        if (typeInput.value && commonTypes.includes(typeInput.value)) {
            typeSelect.value = typeInput.value;
        }

        const requestInput = document.getElementById('configRequest');
        const requestSelect = document.getElementById('configRequestSelect');
        if (['launch', 'attach'].includes(requestInput.value)) {
            requestSelect.value = requestInput.value;
        }

        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'showError':
                    showError(message.message);
                    break;
                case 'setEnvFile':
                    document.getElementById('envFile').value = message.path;
                    updateJsonPreview();
                    break;
                case 'showEnvFileError':
                    showError(message.message);
                    break;
                case 'requestSwitch':
                    handlePanelSwitchRequest(message.newConfigName);
                    break;
                case 'confirmSwitch':
                    // Handle user's response to switch confirmation
                    if (message.action === 'switch') {
                        vscode.postMessage({
                            command: 'performSwitch',
                            newConfigName: message.newConfigName
                        });
                    }
                    break;
            }
        });

        // Initial JSON preview - wait for DOM to be ready
        document.addEventListener('DOMContentLoaded', () => {
            debugDomElements();
            updateJsonPreview();
        });

        // Fallback: try to update immediately in case DOM is already loaded
        if (document.readyState === 'loading') {
            // DOM is still loading, event listener will handle it
        } else {
            // DOM is already loaded, update immediately
            setTimeout(() => {
                debugDomElements();
                updateJsonPreview();
            }, 100);
        }

        // Add beforeunload listener to catch window closing
        window.addEventListener('beforeunload', (event) => {
            if (isDirty) {
                event.preventDefault();
                event.returnValue = '';
            }
        });
    </script>
</body>
</html>`;
    }
}