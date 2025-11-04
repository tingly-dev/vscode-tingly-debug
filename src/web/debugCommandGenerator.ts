// Symbol detection and command generation system

import * as vscode from 'vscode';

export interface SymbolInfo {
    name: string;
    path: string[];
    kind: vscode.SymbolKind;
    language: string;
    filePath: string;
    workspaceRoot: string;
}

export interface CommandTemplate {
    command: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
    preLaunchTask?: string;
}

export interface FrameworkConfig {
    name: string;
    filePatterns: string[];
    commands: {
        debug: (symbol: SymbolInfo) => CommandTemplate;
        run?: (symbol: SymbolInfo) => CommandTemplate; // Optional: only if different from debug
    };
}

export class SymbolDetector {
    /**
     * Get the symbol path for the selected text or cursor position
     */
    static async getSelectedSymbolPath(): Promise<SymbolInfo | null> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return null;
        }

        const document = editor.document;
        const selection = editor.selection;
        const selectedText = document.getText(selection).trim();

        // Get document symbols
        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            'vscode.executeDocumentSymbolProvider',
            document.uri
        );

        if (!symbols) {
            return null;
        }

        let symbolPath: string[] = [];
        let symbolName: string = '';
        let symbolKind: vscode.SymbolKind = vscode.SymbolKind.Variable;

        // Try to find symbol by selected text first
        if (selectedText) {
            symbolPath = this.findSymbolPath(symbols, selectedText);
            if (symbolPath.length > 0) {
                symbolName = selectedText;
                symbolKind = this.getSymbolKind(symbols, selectedText);
            }
        }

        // If no symbol found with selected text, try cursor position
        if (symbolPath.length === 0) {
            const cursorPosition = selection.active;
            const cursorSymbol = this.findSymbolAtPosition(symbols, cursorPosition);
            if (cursorSymbol) {
                symbolPath = cursorSymbol.path;
                symbolName = cursorSymbol.name;
                symbolKind = cursorSymbol.kind;
            }
        }

        // If still no symbol found, try word at cursor
        if (symbolPath.length === 0) {
            const wordRange = document.getWordRangeAtPosition(selection.active);
            if (wordRange) {
                const word = document.getText(wordRange);
                const wordSymbolPath = this.findSymbolPath(symbols, word);
                if (wordSymbolPath.length > 0) {
                    symbolPath = wordSymbolPath;
                    symbolName = word;
                    symbolKind = this.getSymbolKind(symbols, word);
                }
            }
        }

        if (symbolPath.length === 0) {
            return null;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || '';

        return {
            name: symbolName,
            path: symbolPath,
            kind: symbolKind,
            language: document.languageId,
            filePath: document.uri.fsPath,
            workspaceRoot
        };
    }

    /**
     * Find symbol at specific position
     */
    private static findSymbolAtPosition(symbols: vscode.DocumentSymbol[], position: vscode.Position): { name: string; path: string[]; kind: vscode.SymbolKind } | null {
        for (const sym of symbols) {
            // Check if position is within this symbol's range
            if (sym.range.contains(position)) {
                // First try to find in children
                const childResult = this.findSymbolAtPosition(sym.children, position);
                if (childResult) {
                    return {
                        name: childResult.name,
                        path: [sym.name, ...childResult.path],
                        kind: childResult.kind
                    };
                }
                // If no child found, this is the symbol
                return {
                    name: sym.name,
                    path: [sym.name],
                    kind: sym.kind
                };
            }
        }
        return null;
    }

    /**
     * Recursively find symbol path
     */
    private static findSymbolPath(symbols: vscode.DocumentSymbol[], target: string): string[] {
        for (const sym of symbols) {
            if (sym.name === target) {
                return [sym.name];
            }
            const childPath = this.findSymbolPath(sym.children, target);
            if (childPath.length > 0) {
                return [sym.name, ...childPath];
            }
        }
        return [];
    }

    /**
     * Get the symbol kind for the target
     */
    private static getSymbolKind(symbols: vscode.DocumentSymbol[], target: string): vscode.SymbolKind {
        for (const sym of symbols) {
            if (sym.name === target) {
                return sym.kind;
            }
            const childKind = this.getSymbolKind(sym.children, target);
            if (childKind !== undefined) {
                return childKind;
            }
        }
        return vscode.SymbolKind.Variable;
    }
}

export class FrameworkDetector {
    private static frameworks: Map<string, FrameworkConfig[]> = new Map([
        ['python', [
            {
                name: 'pytest',
                filePatterns: ['**/test_*.py', '**/*_test.py', '**/tests/**', '**/conftest.py', 'pytest.ini', 'pyproject.toml', 'setup.cfg'],
                commands: {
                    debug: (symbol: SymbolInfo) => ({
                        command: 'pytest',
                        args: ['-s', '-v', `${vscode.workspace.asRelativePath(symbol.filePath)}::${symbol.path.join('::')}`,],
                        cwd: "${workspaceFolder}",
                        env: { PYTHONPATH: "${workspaceFolder}" },
                        justMyCode: false,
                    })
                }
            },
            {
                name: 'unittest',
                filePatterns: ['**/test_*.py', '**/*_test.py', '**/tests/**'],
                commands: {
                    debug: (symbol: SymbolInfo) => ({
                        command: 'python',
                        args: ['-m', 'unittest', `${vscode.workspace.asRelativePath(symbol.filePath).replace('.py', '')}.${symbol.path.slice(1).join('.')}`],
                        cwd: "${workspaceFolder}"
                    })
                }
            }
        ]],
        ['javascript', [
            {
                name: 'jest',
                filePatterns: ['**/*.test.js', '**/*.spec.js', '**/test/**', '**/tests/**', 'jest.config.*', 'package.json'],
                commands: {
                    debug: (symbol: SymbolInfo) => ({
                        command: 'node',
                        args: ['--inspect-brk', 'node_modules/.bin/jest', '--runInBand', '--testNamePattern', symbol.name],
                        cwd: "${workspaceFolder}"
                    })
                }
            },
            {
                name: 'mocha',
                filePatterns: ['**/test/**', '**/tests/**', '*test.js', '*spec.js', 'mocha.opts'],
                commands: {
                    debug: (symbol: SymbolInfo) => ({
                        command: 'node',
                        args: ['--inspect-brk', 'node_modules/.bin/mocha', '--grep', symbol.name],
                        cwd: "${workspaceFolder}"
                    })
                }
            }
        ]],
        ['typescript', [
            {
                name: 'jest',
                filePatterns: ['**/*.test.ts', '**/*.spec.ts', '**/test/**', '**/tests/**', 'jest.config.*', 'package.json'],
                commands: {
                    debug: (symbol: SymbolInfo) => ({
                        command: 'node',
                        args: ['--inspect-brk', '-r', 'ts-node/register', 'node_modules/.bin/jest', '--runInBand', '--testNamePattern', symbol.name],
                        cwd: "${workspaceFolder}",
                        env: { TS_NODE_PROJECT: '${workspaceFolder}/tsconfig.json' }
                    })
                }
            }
        ]],
        ['java', [
            {
                name: 'junit',
                filePatterns: ['**/src/test/**', '**/*Test.java', '**/*Tests.java', 'pom.xml', 'build.gradle'],
                commands: {
                    debug: (symbol: SymbolInfo) => {
                        const className = vscode.workspace.asRelativePath(symbol.filePath).replace('.java', '').replace(/[\/\\]/g, '.');
                        return {
                            command: './gradlew',
                            args: ['test', '--debug-jvm', '--tests', `${className}.${symbol.name}`],
                            cwd: "${workspaceFolder}"
                        };
                    }
                }
            },
            {
                name: 'maven',
                filePatterns: ['pom.xml'],
                commands: {
                    debug: (symbol: SymbolInfo) => {
                        const className = vscode.workspace.asRelativePath(symbol.filePath).replace('.java', '').replace(/[\/\\]/g, '.');
                        return {
                            command: 'mvn',
                            args: ['test', '-Dmaven.surefire.debug', '-Dtest', `${className}#${symbol.name}`],
                            cwd: "${workspaceFolder}"
                        };
                    }
                }
            }
        ]],
        ['go', [
            {
                name: 'go-test',
                filePatterns: ['**/*_test.go'],
                commands: {
                    debug: (symbol: SymbolInfo) => ({
                        command: 'dlv',
                        args: ['test', '--test', '.', '--', '-test.run', `^${symbol.name}$`],
                        cwd: "${workspaceFolder}"
                    })
                }
            }
        ]],
        ['rust', [
            {
                name: 'cargo-test',
                filePatterns: ['**/tests/**', '**/*_test.rs', 'Cargo.toml'],
                commands: {
                    debug: (symbol: SymbolInfo) => ({
                        command: 'cargo',
                        args: ['test', symbol.name, '--no-run'],
                        cwd: "${workspaceFolder}",
                        preLaunchTask: 'cargo build'
                    })
                }
            }
        ]],
        ['cpp', [
            {
                name: 'googletest',
                filePatterns: ['**/*test.cpp', '**/*_test.cpp', '**/test/**', '**/CMakeLists.txt'],
                commands: {
                    debug: (symbol: SymbolInfo) => ({
                        command: 'gdb',
                        args: ['./build/tests', '--args', '--gtest_filter', `${symbol.name}`],
                        cwd: "${workspaceFolder}"
                    })
                }
            }
        ]]
    ]);

    /**
     * Detect the appropriate framework for the given symbol
     */
    static async detectFramework(symbol: SymbolInfo): Promise<FrameworkConfig | null> {
        const frameworks = this.frameworks.get(symbol.language) || [];

        for (const framework of frameworks) {
            const detected = await this.checkFrameworkFiles(framework.filePatterns, "${workspaceFolder}");
            if (detected) {
                return framework;
            }
        }

        // Return default framework if available
        return frameworks[0] || null;
    }

    /**
     * Check if framework files exist in the workspace
     */
    private static async checkFrameworkFiles(patterns: string[], workspaceRoot: string): Promise<boolean> {
        for (const pattern of patterns) {
            try {
                const files = await vscode.workspace.findFiles(pattern, null, 1);
                if (files.length > 0) {
                    return true;
                }
            } catch (error) {
                // Ignore errors and continue checking
            }
        }
        return false;
    }
}

export class CommandGenerator {
    /**
     * Generate debug configuration for a symbol (used for both run and debug)
     * The configuration generation is the same for both run and debug modes
     */
    static async generateDebugCommand(symbol: SymbolInfo): Promise<CommandTemplate | null> {
        const framework = await FrameworkDetector.detectFramework(symbol);
        if (!framework) {
            return this.generateDefaultDebugCommand(symbol);
        }
        return framework.commands.debug(symbol);
    }

    /**
     * Generate default debug command when no framework is detected
     */
    private static generateDefaultDebugCommand(symbol: SymbolInfo): CommandTemplate {
        const relativePath = vscode.workspace.asRelativePath(symbol.filePath);

        switch (symbol.language) {
            case 'python':
                return {
                    command: 'python',
                    args: ['-m', 'pdb', relativePath],
                    cwd: "${workspaceFolder}"
                };
            case 'javascript':
            case 'typescript':
                return {
                    command: 'node',
                    args: ['--inspect-brk', relativePath],
                    cwd: "${workspaceFolder}"
                };
            case 'java':
                const className = relativePath.replace('.java', '').replace(/[\/\\]/g, '.');
                return {
                    command: 'java',
                    args: ['-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=5005', className],
                    cwd: "${workspaceFolder}"
                };
            case 'go':
                return {
                    command: 'dlv',
                    args: ['debug', relativePath],
                    cwd: "${workspaceFolder}"
                };
            case 'rust':
                return {
                    command: 'gdb',
                    args: [`target/debug/${"${workspaceFolder}".split(/[\/\\]/).pop()}`],
                    cwd: "${workspaceFolder}"
                };
            default:
                return {
                    command: 'echo',
                    args: [`No debug command configured for ${symbol.language}`],
                    cwd: "${workspaceFolder}"
                };
        }
    }

    /**
     * Convert command template to terminal command string
     */
    static formatCommand(command: CommandTemplate): string {
        let result = command.command;

        if (command.args && command.args.length > 0) {
            result += ' ' + command.args.map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(' ');
        }

        return result;
    }

    /**
     * Create VS Code debug configuration from command template
     */
    static createDebugConfiguration(command: CommandTemplate, symbol: SymbolInfo): any {
        const baseConfig: any = {
            name: `${symbol.name}`,
            type: this.getDebugType(symbol.language),
            request: 'launch',
            cwd: command.cwd || "${workspaceFolder}"
        };

        switch (symbol.language) {
            case 'python':
                if (command.command === 'pytest') {
                    baseConfig.module = 'pytest';
                    baseConfig.name = `pytest for ${baseConfig.name}`;
                } else {
                    baseConfig.module = undefined;
                }
                baseConfig.args = command.args;
                baseConfig.justMyCode = true;
                baseConfig.console = 'integratedTerminal';
                break;
            case 'javascript':
            case 'typescript':
                baseConfig.program = command.command === 'node' && command.args?.[0] ?
                    `\${workspaceFolder}/${command.args[0]}` : command.command;
                baseConfig.args = command.args?.slice(1) || [];
                baseConfig.console = 'integratedTerminal';
                break;
            case 'java':
                baseConfig.mainClass = command.args?.[0];
                baseConfig.projectName = "${workspaceFolder}".split(/[\/\\]/).pop();
                break;
            case 'go':
                baseConfig.module = "${workspaceFolder}";
                baseConfig.args = command.args;
                baseConfig.showLog = true;
                break;
            case 'cpp':
            case 'rust':
                baseConfig.program = command.args?.[0] || './build/app';
                baseConfig.args = command.args?.slice(1) || [];
                baseConfig.externalConsole = false;
                baseConfig.MIMode = 'gdb';
                break;
        }

        if (command.env) {
            baseConfig.env = command.env;
        }

        if (command.preLaunchTask) {
            baseConfig.preLaunchTask = command.preLaunchTask;
        }

        return baseConfig;
    }

    private static getDebugType(language: string): string {
        const typeMap: Record<string, string> = {
            'python': 'python',
            'javascript': 'node',
            'typescript': 'node',
            'java': 'java',
            'go': 'go',
            'cpp': 'cppdbg',
            'rust': 'cppdbg',
            'c': 'cppdbg'
        };
        return typeMap[language] || 'node';
    }
}