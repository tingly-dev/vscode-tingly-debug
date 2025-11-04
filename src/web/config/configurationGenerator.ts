// Configuration generation system for symbols and directories

import * as vscode from 'vscode';
import { DebugConfigurationProvider } from '../views/debugPanel';
import { CommandGenerator, SymbolInfo } from './debugCommandGenerator';

export interface ConfigurationTarget {
    type: 'symbol' | 'directory';
    name: string;
    path: string;
    language?: string;
    workspaceRoot: string;
    context?: any; // Additional context like symbol info or directory structure
}

export interface FrameworkOption {
    name: string;
    description: string;
    debugType: string;
    defaultProperties: Record<string, any>;
    supportedContexts: string[];
}

export class ConfigurationGenerator {
    /**
     * Available frameworks for directory-based configuration
     */
    private static readonly directoryFrameworks: FrameworkOption[] = [
        {
            name: 'pytest',
            description: 'Python testing framework',
            debugType: 'python',
            defaultProperties: {
                console: 'integratedTerminal',
                justMyCode: true,
                stopOnEntry: false,
                module: 'pytest'
            },
            supportedContexts: ['python', 'directory']
        },
        {
            name: 'jest',
            description: 'JavaScript testing framework',
            debugType: 'node',
            defaultProperties: {
                console: 'integratedTerminal',
                stopOnEntry: false,
                runtimeExecutable: 'node',
                runtimeArgs: ['--inspect-brk', 'node_modules/.bin/jest', '--runInBand']
            },
            supportedContexts: ['javascript', 'typescript', 'directory']
        },
        {
            name: 'go test',
            description: 'Go testing framework',
            debugType: 'go',
            defaultProperties: {
                console: 'integratedTerminal',
                stopOnEntry: false,
                showLog: true
            },
            supportedContexts: ['go', 'directory']
        },
        {
            name: 'cargo test',
            description: 'Rust testing framework',
            debugType: 'cppdbg',
            defaultProperties: {
                console: 'integratedTerminal',
                stopOnEntry: false,
                cwd: '${workspaceFolder}',
                externalConsole: false,
                MIMode: 'gdb',
                setupCommands: [
                    {
                        description: 'Enable pretty-printing for gdb',
                        text: '-enable-pretty-printing',
                        ignoreFailures: true
                    }
                ]
            },
            supportedContexts: ['rust', 'directory']
        },
        {
            name: 'junit',
            description: 'Java testing framework',
            debugType: 'java',
            defaultProperties: {
                projectName: '${workspaceFolder}',
                stopOnEntry: false
            },
            supportedContexts: ['java', 'directory']
        }
    ];

    /**
     * Generate debug configuration for a target (symbol or directory)
     */
    static async generateDebugConfiguration(
        target: ConfigurationTarget,
        framework?: FrameworkOption
    ): Promise<any | null> {
        if (target.type === 'symbol') {
            return this.generateSymbolDebugConfiguration(target as ConfigurationTarget & { context: SymbolInfo });
        } else if (target.type === 'directory') {
            return this.generateDirectoryDebugConfiguration(target, framework);
        }
        return null;
    }

    /**
     * Generate debug configuration for a symbol
     */
    private static async generateSymbolDebugConfiguration(
        target: ConfigurationTarget & { context: SymbolInfo }
    ): Promise<any | null> {
        const symbol = target.context;
        const commandTemplate = await CommandGenerator.generateDebugCommand(symbol);

        if (!commandTemplate) {
            return null;
        }

        return CommandGenerator.createDebugConfiguration(commandTemplate, symbol);
    }

    /**
     * Generate debug configuration for a directory
     */
    private static generateDirectoryDebugConfiguration(
        target: ConfigurationTarget,
        framework?: FrameworkOption
    ): any | null {
        if (!framework) {
            // Default to pytest if no framework specified
            framework = this.directoryFrameworks.find(f => f.name === 'pytest') || this.directoryFrameworks[0];
        }

        const config: any = {
            name: `${framework.name} for ${target.name}`,
            type: framework.debugType,
            request: 'launch',
            ...framework.defaultProperties
        };

        // Configure based on framework
        switch (framework.name) {
            case 'pytest':
                config.args = [target.path];
                break;
            case 'jest':
                config.runtimeArgs = ['--inspect-brk', 'node_modules/.bin/jest', '--runInBand', target.path];
                break;
            case 'go test':
                config.args = ['-test', target.path];
                config.env = {
                    ...config.env,
                    'GO_TEST_PATH': target.path
                };
                break;
            case 'cargo test':
                config.preLaunchTask = 'cargo build';
                config.args = ['test', '--no-run', target.path];
                break;
            case 'junit':
                config.args = [target.path];
                break;
        }

        return config;
    }

    /**
     * Detect appropriate framework for a directory
     */
    static async detectFrameworkForDirectory(
        directoryPath: string,
        workspaceRoot: string
    ): Promise<FrameworkOption | null> {
        try {
            // Look for framework indicators in the directory
            const frameworkFiles = [
                { framework: 'pytest', patterns: ['**/pytest.ini', '**/pyproject.toml', '**/setup.cfg', '**/conftest.py'] },
                { framework: 'jest', patterns: ['**/jest.config.*', '**/package.json', '**/*.test.js', '**/*.test.ts'] },
                { framework: 'go test', patterns: ['**/*_test.go'] },
                { framework: 'cargo test', patterns: ['**/Cargo.toml'] },
                { framework: 'junit', patterns: ['**/pom.xml', '**/build.gradle', '**/*Test.java'] }
            ];

            for (const { framework, patterns } of frameworkFiles) {
                for (const pattern of patterns) {
                    const files = await vscode.workspace.findFiles(
                        new vscode.RelativePattern(directoryPath, pattern),
                        null,
                        1
                    );
                    if (files.length > 0) {
                        return this.directoryFrameworks.find(f => f.name === framework) || null;
                    }
                }
            }
        } catch (error) {
            console.error('Error detecting framework:', error);
        }

        return null;
    }

    /**
     * Get available frameworks for a context
     */
    static getAvailableFrameworks(context: string = 'directory'): FrameworkOption[] {
        return this.directoryFrameworks.filter(framework =>
            framework.supportedContexts.includes(context) ||
            framework.supportedContexts.includes('directory')
        );
    }

    /**
     * Show framework selection dialog
     */
    static async showFrameworkSelector(
        detectedFramework?: FrameworkOption,
        context: string = 'directory'
    ): Promise<FrameworkOption | undefined> {
        const frameworks = this.getAvailableFrameworks(context);

        const items = frameworks.map(framework => ({
            label: framework.name,
            description: framework.description,
            framework,
            picked: detectedFramework?.name === framework.name
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: detectedFramework
                ? `Detected framework: ${detectedFramework.name}. Choose a different one if needed.`
                : 'Select a testing framework',
            title: 'Choose Framework'
        });

        return selected?.framework;
    }

    /**
     * Create and save debug configuration
     */
    static async createAndSaveConfiguration(
        target: ConfigurationTarget,
        framework?: FrameworkOption,
        provider?: DebugConfigurationProvider
    ): Promise<boolean> {
        try {
            const config = await this.generateDebugConfiguration(target, framework);

            if (!config) {
                vscode.window.showErrorMessage('Failed to generate debug configuration.');
                return false;
            }

            if (provider) {
                // Use the existing DebugConfigurationProvider to add configuration
                // This ensures it syncs with launch.json and appears in debug config tree
                await provider.addConfiguration(config);
                vscode.window.showInformationMessage(`Debug configuration "${config.name}" created successfully!`);
            } else {
                vscode.window.showErrorMessage('Debug configuration provider not available.');
                return false;
            }

            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to create debug configuration: ${errorMessage}`);
            return false;
        }
    }
}