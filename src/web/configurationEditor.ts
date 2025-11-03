import * as vscode from 'vscode';
import { LaunchConfiguration, LaunchCompound, ConfigurationData } from './types';
import { DebugConfigurationProvider } from './debugTreeView';

export class ConfigurationEditor {
    static openConfigurationEditor(
        config: LaunchConfiguration | LaunchCompound,
        provider: DebugConfigurationProvider
    ): void {
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
        panel.webview.html = this.getConfigurationSettingsWebviewContent(panel.webview, configData);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
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
                }
            },
            undefined,
            // Note: We don't have direct access to context.subscriptions here, but this is fine
            // as the webview panel will be properly disposed when the panel is closed
            []
        );
    }

    private static getConfigurationSettingsWebviewContent(webview: vscode.Webview, configData: ConfigurationData): string {
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
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Configuration Settings</h2>
        </div>

        <div class="section">
            <div class="section-title">Basic Information</div>
            <div class="field-group">
                <label for="configName">Name</label>
                <input type="text" id="configName" name="name" value="${configData.name}" placeholder="Configuration name">
            </div>
            <div class="field-group">
                <label for="configType">Type</label>
                <input type="text" id="configType" name="type" value="${configData.type}" readonly>
            </div>
            <div class="field-group">
                <label for="configRequest">Request</label>
                <input type="text" id="configRequest" name="request" value="${configData.request}" readonly>
            </div>
            <div id="errorMessage" class="error-message"></div>
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
                name: document.getElementById('configName').value,
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
            const config = {
                name: document.getElementById('configName').value,
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

        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'showError':
                    showError(message.message);
                    break;
            }
        });

        // Initial JSON preview
        updateJsonPreview();
    </script>
</body>
</html>`;
    }
}