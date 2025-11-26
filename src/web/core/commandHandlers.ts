import * as vscode from 'vscode';
import { ConfigurationGenerator, ConfigurationTarget } from '../config/configurationGenerator';
import { CommandGenerator, SymbolDetector, SymbolInfo } from '../config/debugCommandGenerator';
import { FileTypeMapper } from '../util/fileTypeMapper';
import { ConfigurationEditor } from '../views/configurationEditor';
import { DebugConfigurationItem, DebugConfigurationProvider, DebugErrorItem } from '../views/debugPanel';
import { LaunchConfiguration } from './types';

export function registerCommandHandlers(
    context: vscode.ExtensionContext,
    provider: DebugConfigurationProvider,
    treeView: vscode.TreeView<DebugConfigurationItem | DebugErrorItem>
): void {

    /**
     * Handle command generation for both run and debug (unified configuration generation)
     * Configuration generation is the same for both run and debug modes
     */
    async function handleGenerateCommand(commandType: 'run' | 'debug'): Promise<void> {
        try {
            // Get the selected symbol
            let symbol = await SymbolDetector.getSelectedSymbolPath();

            if (!symbol) {
                // Try to show symbol selector
                symbol = await showSymbolSelector();
                if (!symbol) {
                    return;
                }
            }

            // Generate the debug configuration (used for both run and debug)
            const commandTemplate = await CommandGenerator.generateDebugCommand(symbol);

            if (!commandTemplate) {
                vscode.window.showErrorMessage(`Could not generate ${commandType} command for ${symbol.language} symbol "${symbol.name}"`);
                return;
            }

            // Format the command for display
            const formattedCommand = CommandGenerator.formatCommand(commandTemplate);

            // Show action options
            const action = await vscode.window.showQuickPick([
                { label: '$(gear) Create', description: `Create debug configuration`, value: 'create' },
                { label: '$(run) Create and Run', description: `Create debug configuration and run it`, value: 'create-and-run' },
                { label: '$(debug) Create and Debug', description: `Create debug configuration and debug it`, value: 'create-and-debug' }
            ], {
                placeHolder: `Generated ${commandType} command: ${formattedCommand}`,
                title: `${commandType === 'run' ? 'Run' : 'Debug'} Command for "${symbol.name}"`
            });

            if (!action) {
                return;
            }

            switch (action.value) {
                case 'create':
                    await createDebugConfigurationAndOpen(commandTemplate, symbol, provider);
                    break;
                case 'create-and-run':
                    await createAndRunConfiguration(commandTemplate, symbol, provider);
                    break;
                case 'create-and-debug':
                    await createAndDebugConfiguration(commandTemplate, symbol, provider);
                    break;
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to generate command: ${errorMessage}`);
            console.error('Command generation error:', error);
        }
    }

    /**
     * Type guard to check if an item is a DebugConfigurationItem
     */
    function isDebugConfigurationItem(item: any): item is DebugConfigurationItem {
        return item && 'config' in item && 'type' in item.config && item.config.type !== 'error';
    }

    /**
     * Type guard to check if an item is a DebugErrorItem
     */
    function isDebugErrorItem(item: any): item is DebugErrorItem {
        return item && 'config' in item && item.config.type === 'error';
    }

    /**
     * Check if the configurations contain only an error item
     */
    function hasConfigurationError(configs: any[]): configs is [DebugErrorItem] {
        return configs.length === 1 && configs[0] && isDebugErrorItem(configs[0]);
    }

    /**
     * Generate a unique configuration name by adding suffix based on user preference
     */
    async function generateUniqueConfigurationName(baseName: string, debugProvider: DebugConfigurationProvider): Promise<string | null> {
        const config = vscode.workspace.getConfiguration('tingly-debug');
        const suffixStyle = config.get<string>('nameCollisionSuffixStyle', 'index');

        try {
            const existingConfigs = await debugProvider.getConfigurations();

            // Check if there's an error in the configurations
            if (hasConfigurationError(existingConfigs)) {
                // There's an error reading configurations, use simple naming strategy
                const timestamp = new Date().getTime();
                return `${baseName}-${timestamp}`;
            }

            const existingNames = new Set(existingConfigs.filter(isDebugConfigurationItem).map(item => item.config.name));

            if (suffixStyle === 'timestamp') {
                // Try timestamp suffix first
                const now = new Date();
                const timestamp = now.getFullYear() +
                    String(now.getMonth() + 1).padStart(2, '0') +
                    String(now.getDate()).padStart(2, '0') + '-' +
                    String(now.getHours()).padStart(2, '0') +
                    String(now.getMinutes()).padStart(2, '0') +
                    String(now.getSeconds()).padStart(2, '0');

                const timestampName = `${baseName}-${timestamp}`;
                if (!existingNames.has(timestampName)) {
                    return timestampName;
                }
            }

            // Fallback to index suffix (or use it directly if configured)
            let counter = 1;
            while (true) {
                const indexedName = `${baseName} - ${counter}`;
                if (!existingNames.has(indexedName)) {
                    return indexedName;
                }
                counter++;

                // Prevent infinite loop
                if (counter > 9999) {
                    throw new Error('Unable to generate unique configuration name after many attempts');
                }
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate unique configuration name: ${error}`);
            return null;
        }
    }

    /**
     * Create debug configuration from command template and open it
     */
    async function createDebugConfigurationAndOpen(commandTemplate: any, symbol: SymbolInfo, debugProvider: DebugConfigurationProvider): Promise<void> {
        const originalConfig = CommandGenerator.createDebugConfiguration(commandTemplate, symbol);

        try {
            // Check for existing configuration with the same name
            const existingConfigs = await debugProvider.getConfigurations();

            // Check if there's an error reading configurations
            if (hasConfigurationError(existingConfigs)) {
                vscode.window.showErrorMessage(`Cannot create configuration: ${existingConfigs[0].config.error.message}`);
                return;
            }

            const existingConfig = existingConfigs.filter(isDebugConfigurationItem).find(item => item.config.name === originalConfig.name);

            if (existingConfig) {
                // Name collision detected - show options to user
                const action = await vscode.window.showQuickPick([
                    { label: '$(file-text) Open Existing', description: `Open existing configuration "${originalConfig.name}"`, value: 'open-existing' },
                    { label: '$(add) Create New', description: `Create new configuration with modified name`, value: 'create-new' },
                    { label: '$(x) Cancel', description: `Cancel operation`, value: 'cancel' }
                ], {
                    placeHolder: `Configuration "${originalConfig.name}" already exists`,
                    title: 'Name Collision'
                });

                switch (action?.value) {
                    case 'open-existing':
                        await ConfigurationEditor.openConfigurationEditor(existingConfig.config, debugProvider);
                        return;
                    case 'create-new':
                        // Generate unique name and create new config
                        const uniqueName = await generateUniqueConfigurationName(originalConfig.name, debugProvider);
                        if (!uniqueName) {
                            return; // User cancelled
                        }
                        originalConfig.name = uniqueName;
                        break;
                    case 'cancel':
                    default:
                        return; // User cancelled
                }
            }

            // Create the configuration
            await debugProvider.addConfiguration(originalConfig);
            vscode.window.showInformationMessage(`Debug configuration "${originalConfig.name}" created successfully!`);

            // Open the newly created configuration after a short delay to ensure UI updates
            setTimeout(async () => {
                try {
                    const configItems = await debugProvider.getConfigurations();

                    // Check if there's an error reading configurations
                    if (hasConfigurationError(configItems)) {
                        console.error('Failed to open configuration editor due to configuration error:', configItems[0].config.error.message);
                        return;
                    }

                    const createdItem = configItems.filter(isDebugConfigurationItem).find(item => item.config.name === originalConfig.name);
                    if (createdItem) {
                        await ConfigurationEditor.openConfigurationEditor(createdItem.config, debugProvider);
                    }
                } catch (error) {
                    console.error('Failed to open configuration editor:', error);
                }
            }, 500);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create debug configuration: ${error}`);
        }
    }

    /**
     * Create debug configuration and immediately run it
     */
    async function createAndRunConfiguration(commandTemplate: any, symbol: SymbolInfo, debugProvider: DebugConfigurationProvider): Promise<void> {
        let debugConfig = CommandGenerator.createDebugConfiguration(commandTemplate, symbol);

        try {
            // Check for existing configuration with the same name
            const existingConfigs = await debugProvider.getConfigurations();

            // Check if there's an error reading configurations
            if (hasConfigurationError(existingConfigs)) {
                vscode.window.showErrorMessage(`Cannot create configuration: ${existingConfigs[0].config.error.message}`);
                return;
            }

            const existingConfig = existingConfigs.filter(isDebugConfigurationItem).find(item => item.config.name === debugConfig.name);

            if (existingConfig) {
                // Name collision detected - show options to user
                const action = await vscode.window.showQuickPick([
                    { label: '$(run) Run Existing', description: `Run existing configuration "${debugConfig.name}"`, value: 'run-existing' },
                    { label: '$(add) Create New', description: `Create new configuration with modified name`, value: 'create-new' },
                    { label: '$(x) Cancel', description: `Cancel operation`, value: 'cancel' }
                ], {
                    placeHolder: `Configuration "${debugConfig.name}" already exists`,
                    title: 'Name Collision'
                });

                switch (action?.value) {
                    case 'run-existing':
                        debugConfig = existingConfig.config;
                        break;
                    case 'create-new':
                        // Generate unique name and create new config
                        const uniqueName = await generateUniqueConfigurationName(debugConfig.name, debugProvider);
                        if (!uniqueName) {
                            return; // User cancelled
                        }
                        debugConfig.name = uniqueName;
                        await debugProvider.addConfiguration(debugConfig);
                        break;
                    case 'cancel':
                    default:
                        return; // User cancelled
                }
            } else {
                // Create the configuration
                await debugProvider.addConfiguration(debugConfig);
            }

            vscode.window.showInformationMessage(`Debug configuration "${debugConfig.name}" created and running!`);

            // Run the configuration immediately after creation
            setTimeout(async () => {
                try {
                    // Disable all breakpoints for run mode
                    await vscode.commands.executeCommand('workbench.debug.viewlet.action.disableAllBreakpoints');

                    await vscode.debug.startDebugging(undefined, debugConfig);
                } catch (error) {
                    console.error('Failed to start debug session:', error);
                    vscode.window.showErrorMessage(`Failed to run configuration: ${error}`);
                }
            }, 500);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create debug configuration: ${error}`);
        }
    }

    /**
     * Create debug configuration and immediately debug it
     */
    async function createAndDebugConfiguration(commandTemplate: any, symbol: SymbolInfo, debugProvider: DebugConfigurationProvider): Promise<void> {
        let debugConfig = CommandGenerator.createDebugConfiguration(commandTemplate, symbol);

        try {
            // Check for existing configuration with the same name
            const existingConfigs = await debugProvider.getConfigurations();

            // Check if there's an error reading configurations
            if (hasConfigurationError(existingConfigs)) {
                vscode.window.showErrorMessage(`Cannot create configuration: ${existingConfigs[0].config.error.message}`);
                return;
            }

            const existingConfig = existingConfigs.filter(isDebugConfigurationItem).find(item => item.config.name === debugConfig.name);

            if (existingConfig) {
                // Name collision detected - show options to user
                const action = await vscode.window.showQuickPick([
                    { label: '$(debug) Debug Existing', description: `Debug existing configuration "${debugConfig.name}"`, value: 'debug-existing' },
                    { label: '$(add) Create New', description: `Create new configuration with modified name`, value: 'create-new' },
                    { label: '$(x) Cancel', description: `Cancel operation`, value: 'cancel' }
                ], {
                    placeHolder: `Configuration "${debugConfig.name}" already exists`,
                    title: 'Name Collision'
                });

                switch (action?.value) {
                    case 'debug-existing':
                        debugConfig = existingConfig.config;
                        break;
                    case 'create-new':
                        // Generate unique name and create new config
                        const uniqueName = await generateUniqueConfigurationName(debugConfig.name, debugProvider);
                        if (!uniqueName) {
                            return; // User cancelled
                        }
                        debugConfig.name = uniqueName;
                        await debugProvider.addConfiguration(debugConfig);
                        break;
                    case 'cancel':
                    default:
                        return; // User cancelled
                }
            } else {
                // Create the configuration
                await debugProvider.addConfiguration(debugConfig);
            }

            vscode.window.showInformationMessage(`Debug configuration "${debugConfig.name}" created and debugging!`);

            // Debug the configuration immediately after creation
            setTimeout(async () => {
                try {
                    // Enable all breakpoints for debug mode
                    await vscode.commands.executeCommand('workbench.debug.viewlet.action.enableAllBreakpoints');

                    await vscode.debug.startDebugging(undefined, debugConfig);
                } catch (error) {
                    console.error('Failed to start debug session:', error);
                    vscode.window.showErrorMessage(`Failed to debug configuration: ${error}`);
                }
            }, 500);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create debug configuration: ${error}`);
        }
    }

    // Refresh command
    const refreshCommand = vscode.commands.registerCommand('tingly.debug.debugConfig.refresh', async () => {
        try {
            // Show loading indicator
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Refreshing debug configurations...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "Reading launch.json..." });

                try {
                    // Force re-read of launch.json file
                    const configurations = await provider.getConfigurations();

                    progress.report({ increment: 50, message: "Updating configuration list..." });

                    // Refresh the tree view (this will handle closing open panels if needed)
                    await provider.refresh();

                    progress.report({ increment: 100, message: "Complete!" });

                    // Show success message with configuration count
                    if (hasConfigurationError(configurations)) {
                        vscode.window.showErrorMessage(`Failed to load debug configurations: ${configurations[0].config.error.message}`);
                    } else {
                        const configCount = configurations.length;
                        const message = configCount === 0
                            ? "No debug configurations found. Use the + button to add one."
                            : `Successfully refreshed! Found ${configCount} debug configuration${configCount === 1 ? '' : 's'}.`;

                        vscode.window.showInformationMessage(message);
                    }

                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error('Refresh error:', error);

                    // Check if user cancelled the refresh
                    if (errorMessage.includes('cancelled by user')) {
                        vscode.window.showInformationMessage('Refresh cancelled by user.');
                    } else {
                        vscode.window.showErrorMessage(`Failed to refresh debug configurations: ${errorMessage}`);
                    }
                }
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Refresh initialization error:', error);
            vscode.window.showErrorMessage(`Failed to initialize refresh: ${errorMessage}`);
        }
    });

    // Add configuration command
    const addCommand = vscode.commands.registerCommand('tingly.debug.debugConfig.add', async () => {
        const name = await vscode.window.showInputBox({
            placeHolder: 'Enter configuration name',
            prompt: 'Configuration name'
        });

        if (name === undefined) {
            return;
        }

        const typeItems = [
            { label: 'Node.js', description: 'Launch Node.js application' },
            { label: 'Python', description: 'Launch Python application' },
            { label: 'Chrome', description: 'Launch Chrome browser' },
            { label: 'Edge', description: 'Launch Edge browser' },
            { label: 'Firefox', description: 'Launch Firefox browser' },
            { label: 'Extension Host', description: 'Launch VS Code Extension Host' },
            { label: 'CoreCLR (.NET)', description: 'Launch .NET application' },
            { label: 'Custom', description: 'Custom debug configuration' }
        ];

        const selectedType = await vscode.window.showQuickPick(typeItems, {
            placeHolder: 'Select configuration type'
        });

        if (selectedType === undefined) {
            return;
        }

        const requestType = await vscode.window.showQuickPick([
            { label: 'Launch', description: 'Start a new debug session' },
            { label: 'Attach', description: 'Attach to a running process' }
        ], {
            placeHolder: 'Select request type'
        });

        if (requestType === undefined) {
            return;
        }

        const typeMap: Record<string, string> = {
            'Node.js': 'node',
            'Python': 'python',
            'Chrome': 'chrome',
            'Edge': 'msedge',
            'Firefox': 'firefox',
            'Extension Host': 'extensionHost',
            'CoreCLR (.NET)': 'coreclr',
            'Custom': 'node'
        };

        const newConfig: LaunchConfiguration = {
            name: name,
            type: typeMap[selectedType.label],
            request: requestType.label.toLowerCase() as 'launch' | 'attach'
        };

        try {
            await provider.addConfiguration(newConfig);
            vscode.window.showInformationMessage(`Configuration "${name}" created successfully!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create configuration: ${error}`);
        }
    });

    // Edit configuration command
    const editCommand = vscode.commands.registerCommand('tingly.debug.debugConfig.edit', async (item: DebugConfigurationItem) => {
        await ConfigurationEditor.openConfigurationEditor(item.config, provider);
    });

    // Delete configuration command
    const deleteCommand = vscode.commands.registerCommand('tingly.debug.debugConfig.delete', async (item: DebugConfigurationItem) => {
        const result = await vscode.window.showWarningMessage(
            `Are you sure you want to delete configuration "${item.config.name}"?`,
            'Delete',
            'Cancel'
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

    // Duplicate configuration command
    const duplicateCommand = vscode.commands.registerCommand('tingly.debug.debugConfig.duplicate', async (item: DebugConfigurationItem) => {
        try {
            await provider.duplicateConfiguration(item.config);
            vscode.window.showInformationMessage(`Configuration "${item.config.name}" duplicated successfully!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to duplicate configuration: ${error}`);
        }
    });

    // Run configuration command
    const runCommand = vscode.commands.registerCommand('tingly.debug.debugConfig.run', async (item: DebugConfigurationItem) => {
        try {
            // Only run configurations, not compounds
            if ('configurations' in item.config) {
                vscode.window.showWarningMessage('Cannot run compound configurations directly. Please select an individual configuration.');
                return;
            }

            // Disable all breakpoints for run mode
            await vscode.commands.executeCommand('workbench.debug.viewlet.action.disableAllBreakpoints');

            await vscode.debug.startDebugging(undefined, item.config as LaunchConfiguration);
            vscode.window.showInformationMessage(`Configuration "${item.config.name}" is now running (breakpoints disabled)!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start debug session: ${error}`);
        }
    });

    // Debug configuration command
    const debugCommand = vscode.commands.registerCommand('tingly.debug.debugConfig.debug', async (item: DebugConfigurationItem) => {
        try {
            // Only debug configurations, not compounds
            if ('configurations' in item.config) {
                vscode.window.showWarningMessage('Cannot debug compound configurations directly. Please select an individual configuration.');
                return;
            }

            // Enable all breakpoints for debug mode
            await vscode.commands.executeCommand('workbench.debug.viewlet.action.enableAllBreakpoints');

            await vscode.debug.startDebugging(undefined, item.config as LaunchConfiguration);
            vscode.window.showInformationMessage(`Configuration "${item.config.name}" is now debugging (breakpoints enabled)!`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start debug session: ${error}`);
        }
    });

    // Create configuration from current file
    const createFromFileCommand = vscode.commands.registerCommand('tingly.debug.debugConfig.createFromFile', async () => {
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

        // Check if file type is supported
        const fileTypeInfo = FileTypeMapper.getFileTypeInfo(currentFile);
        if (!fileTypeInfo) {
            const fileExtension = currentFile.split('.').pop()?.toLowerCase();
            vscode.window.showWarningMessage(
                `File type ".${fileExtension}" is not supported for automatic configuration creation. ` +
                `Supported types: ${Object.keys(FileTypeMapper.getSupportedFileTypes()).map(ext => `.${ext}`).join(', ')}`
            );
            return;
        }

        // Generate unique configuration name
        const baseConfigName = FileTypeMapper.generateConfigName(currentFile, workspaceRoot);
        const configurations = await provider.readConfigurationsOnly();
        let finalConfigName = baseConfigName;
        let counter = 1;

        while (configurations.some(config => config.name === finalConfigName)) {
            finalConfigName = `${baseConfigName} - ${counter}`;
            counter++;
        }

        // Create default configuration using the mapper
        const newConfig = FileTypeMapper.createDefaultConfiguration(currentFile, workspaceRoot, finalConfigName);

        try {
            await provider.addConfiguration(newConfig);
            vscode.window.showInformationMessage(
                `Debug configuration "${finalConfigName}" created for ${fileTypeInfo.displayName} file!`
            );

            // Open the configuration editor for the newly created configuration
            setTimeout(async () => {
                try {
                    // Find the newly created configuration in the provider
                    const configItems = await provider.getConfigurations();
                    const createdItem = configItems.filter(isDebugConfigurationItem).find(item => item.config.name === finalConfigName);
                    if (createdItem) {
                        await ConfigurationEditor.openConfigurationEditor(createdItem.config, provider);
                    }
                } catch (error) {
                    console.error('Failed to open configuration editor:', error);
                }
            }, 500); // Small delay to ensure the UI updates
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create configuration: ${error}`);
        }
    });

    // Open settings command (using configuration editor)
    const openSettingsCommand = vscode.commands.registerCommand('tingly.debug.debugConfig.openSettings', async (item: DebugConfigurationItem) => {
        console.log('openSettingsCommand triggered for item:', item.config.name);
        await ConfigurationEditor.openConfigurationEditor(item.config, provider);
    });

    // Generate debug command from symbol (used for both run and debug modes)
    const generateDebugCommandCommand = vscode.commands.registerCommand('tingly.debug.generateDebugCommand', async () => {
        await handleGenerateCommand('debug');
    });

    // Generate debug configuration from directory
    const generateDebugConfigFromDirectoryCommand = vscode.commands.registerCommand('tingly.debug.generateDebugConfigFromDirectory', async (uri: vscode.Uri) => {
        await handleGenerateDirectoryDebugConfig(uri, provider);
    });


    // Hello world command
    const helloWorldCommand = vscode.commands.registerCommand('tingly.debug.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from Debug and Run Configurations extension!');
    });

    // Register all disposables
    context.subscriptions.push(
        refreshCommand,
        addCommand,
        editCommand,
        deleteCommand,
        duplicateCommand,
        runCommand,
        debugCommand,
        createFromFileCommand,
        openSettingsCommand,
        generateDebugCommandCommand,
        generateDebugConfigFromDirectoryCommand,
        helloWorldCommand
    );
}

/**
 * Show symbol selector when no symbol is selected
 */
async function showSymbolSelector(): Promise<SymbolInfo | null> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor found.');
        return null;
    }

    const document = editor.document;

    // Get document symbols
    let symbols: vscode.DocumentSymbol[] | undefined;
    try {
        symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            document.uri
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || '';

        const documentInfo = {
            uri: document.uri.toString(),
            fsPath: document.uri.fsPath,
            scheme: document.uri.scheme,
            language: document.languageId,
            workspace: workspaceRoot
        };

        // Enhanced logging for developers
        console.error('=== Symbol Selector Error Details ===');
        console.error('Error:', errorMessage);
        console.error('Stack:', errorStack);
        console.error('Document Info:', JSON.stringify(documentInfo, null, 2));
        console.error('VSCode Version:', vscode.version);
        console.error('=======================================');

        // Show user-friendly message with option to view details
        const showDetails = 'Show Details';
        const result = await vscode.window.showErrorMessage(
            `Failed to analyze symbols: ${errorMessage}`,
            showDetails
        );

        if (result === showDetails) {
            // Show detailed error information in output channel
            const outputChannel = vscode.window.createOutputChannel('DDD Debug Errors');
            outputChannel.appendLine('=== Symbol Selector Error Details ===');
            outputChannel.appendLine(`Timestamp: ${new Date().toISOString()}`);
            outputChannel.appendLine(`Error: ${errorMessage}`);
            if (errorStack) {
                outputChannel.appendLine(`Stack Trace:\n${errorStack}`);
            }
            outputChannel.appendLine(`Document URI: ${documentInfo.uri}`);
            outputChannel.appendLine(`Document Path: ${documentInfo.fsPath}`);
            outputChannel.appendLine(`Language: ${documentInfo.language}`);
            outputChannel.appendLine(`Workspace Root: ${documentInfo.workspace}`);
            outputChannel.appendLine(`VSCode Version: ${vscode.version}`);
            outputChannel.appendLine('=======================================');
            outputChannel.show();
        }

        return null;
    }

    if (!symbols || symbols.length === 0) {
        vscode.window.showWarningMessage('No symbols found in this file. You can select functions, classes, methods, or tests. Make sure appropriate language extensions are installed.');
        return null;
    }

    // Flatten symbols into a quick pick list
    const symbolItems = await flattenSymbolItems(symbols, document);

    if (symbolItems.length === 0) {
        vscode.window.showWarningMessage('No selectable symbols found in this file.');
        return null;
    }

    // Show quick pick
    const selected = await vscode.window.showQuickPick(symbolItems, {
        placeHolder: 'Select a symbol to generate command',
        title: `Symbols in ${document.fileName.split(/[/\\]/).pop()}`
    });

    if (!selected) {
        return null;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || '';

    return {
        name: selected.symbol.name,
        path: selected.path,
        kind: selected.symbol.kind,
        language: document.languageId,
        filePath: document.uri.fsPath,
        workspaceRoot
    };
}

/**
 * Flatten symbol tree into quick pick items
 */
async function flattenSymbolItems(
    symbols: vscode.DocumentSymbol[],
    document: vscode.TextDocument,
    parentPath: string[] = [],
    level: number = 0
): Promise<Array<{ label: string; description: string; detail: string; symbol: vscode.DocumentSymbol; path: string[] }>> {
    const items: Array<{ label: string; description: string; detail: string; symbol: vscode.DocumentSymbol; path: string[] }> = [];
    const indent = '  '.repeat(level);

    for (const symbol of symbols) {
        const currentPath = [...parentPath, symbol.name];
        const kindIcon = getSymbolIcon(symbol.kind);
        const label = `${indent}${kindIcon} ${symbol.name}`;

        // Only add executable symbols (functions, methods, classes with methods, tests)
        if (isExecutableSymbol(symbol)) {
            items.push({
                label,
                description: getSymbolTypeDescription(symbol.kind),
                detail: `Line ${symbol.range.start.line + 1}`,
                symbol,
                path: currentPath
            });
        }

        // Recursively add children
        const childItems = await flattenSymbolItems(symbol.children, document, currentPath, level + 1);
        items.push(...childItems);
    }

    return items;
}

/**
 * Check if a symbol is executable (can be run/debugged)
 */
function isExecutableSymbol(symbol: vscode.DocumentSymbol): boolean {
    switch (symbol.kind) {
        case vscode.SymbolKind.Function:
        case vscode.SymbolKind.Method:
        case vscode.SymbolKind.Constructor:
        case vscode.SymbolKind.Class:
        case vscode.SymbolKind.Module:
        case vscode.SymbolKind.Package:
            return true;
        case vscode.SymbolKind.Variable:
        case vscode.SymbolKind.Constant:
            // Check if it might be a test function based on name
            const name = symbol.name.toLowerCase();
            return name.includes('test') || name.startsWith('should') || name.startsWith('it');
        default:
            return false;
    }
}

/**
 * Get icon for symbol kind
 */
function getSymbolIcon(kind: vscode.SymbolKind): string {
    switch (kind) {
        case vscode.SymbolKind.Function: return '$(symbol-method)';
        case vscode.SymbolKind.Method: return '$(symbol-method)';
        case vscode.SymbolKind.Constructor: return '$(symbol-method)';
        case vscode.SymbolKind.Class: return '$(symbol-class)';
        case vscode.SymbolKind.Module: return '$(symbol-misc)';
        case vscode.SymbolKind.Package: return '$(symbol-namespace)';
        case vscode.SymbolKind.Variable: return '$(symbol-variable)';
        case vscode.SymbolKind.Constant: return '$(symbol-constant)';
        default: return '$(symbol-misc)';
    }
}

/**
 * Get description for symbol type
 */
function getSymbolTypeDescription(kind: vscode.SymbolKind): string {
    switch (kind) {
        case vscode.SymbolKind.Function: return 'function';
        case vscode.SymbolKind.Method: return 'method';
        case vscode.SymbolKind.Constructor: return 'constructor';
        case vscode.SymbolKind.Class: return 'class';
        case vscode.SymbolKind.Module: return 'module';
        case vscode.SymbolKind.Package: return 'package';
        case vscode.SymbolKind.Variable: return 'variable';
        case vscode.SymbolKind.Constant: return 'constant';
        default: return 'symbol';
    }
}

/**
 * Handle directory debug configuration generation
 */
async function handleGenerateDirectoryDebugConfig(uri: vscode.Uri, debugProvider: DebugConfigurationProvider): Promise<void> {
    try {
        if (!uri) {
            vscode.window.showErrorMessage('No directory selected.');
            return;
        }

        const directoryPath = uri.fsPath;
        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || '';

        // Get relative path from workspace
        const relativePath = vscode.workspace.asRelativePath(directoryPath);
        const directoryName = directoryPath.split(/[/\\]/).pop() || relativePath;

        // Detect framework in directory
        const detectedFramework = await ConfigurationGenerator.detectFrameworkForDirectory(directoryPath, workspaceRoot);

        // Show framework selection
        const selectedFramework = await ConfigurationGenerator.showFrameworkSelector(
            detectedFramework || undefined,
            'directory'
        );

        if (!selectedFramework) {
            return; // User cancelled
        }

        // Create configuration target
        const target: ConfigurationTarget = {
            type: 'directory',
            name: directoryName,
            path: relativePath,
            workspaceRoot
        };

        // Generate and save configuration
        const success = await ConfigurationGenerator.createAndSaveConfiguration(
            target,
            selectedFramework,
            debugProvider
        );

        if (success) {
            vscode.window.showInformationMessage(
                `Debug configuration for ${selectedFramework.name} in "${directoryName}" created successfully!`
            );
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to generate debug configuration: ${errorMessage}`);
        console.error('Directory debug config generation error:', error);
    }
}