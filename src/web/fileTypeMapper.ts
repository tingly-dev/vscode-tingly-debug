// File type to debug configuration type mapping system

export interface FileTypeInfo {
    debugType: string;
    displayName: string;
    description: string;
    defaultProperties: Record<string, any>;
    filePatterns: string[];
}

export class FileTypeMapper {
    private static readonly fileTypeMappings: Record<string, FileTypeInfo> = {
        // JavaScript/TypeScript
        'js': {
            debugType: 'node',
            displayName: 'Node.js',
            description: 'JavaScript application',
            defaultProperties: {
                console: 'integratedTerminal',
                stopOnEntry: false,
                runtimeExecutable: 'node'
            },
            filePatterns: ['*.js', '*.mjs', '*.cjs']
        },
        'ts': {
            debugType: 'node',
            displayName: 'Node.js (TypeScript)',
            description: 'TypeScript application',
            defaultProperties: {
                console: 'integratedTerminal',
                stopOnEntry: false,
                runtimeExecutable: 'node',
                runtimeArgs: ['-r', 'ts-node/register'],
                env: {
                    'TS_NODE_PROJECT': '${workspaceFolder}/tsconfig.json'
                }
            },
            filePatterns: ['*.ts', '*.tsx']
        },
        'jsx': {
            debugType: 'node',
            displayName: 'Node.js (React)',
            description: 'React application',
            defaultProperties: {
                console: 'integratedTerminal',
                stopOnEntry: false,
                runtimeExecutable: 'node',
                env: {
                    'NODE_ENV': 'development'
                }
            },
            filePatterns: ['*.jsx', '*.tsx']
        },

        // Python
        'py': {
            debugType: 'python',
            displayName: 'Python',
            description: 'Python application',
            defaultProperties: {
                console: 'integratedTerminal',
                justMyCode: true,
                stopOnEntry: false
            },
            filePatterns: ['*.py', '*.pyw', '*.py3']
        },

        // Java
        'java': {
            debugType: 'java',
            displayName: 'Java',
            description: 'Java application',
            defaultProperties: {
                projectName: '${workspaceFolder}',
                stopOnEntry: false
            },
            filePatterns: ['*.java']
        },

        // C/C++
        'cpp': {
            debugType: 'cppdbg',
            displayName: 'C++',
            description: 'C++ application',
            defaultProperties: {
                program: '${workspaceFolder}/a.out',
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
            filePatterns: ['*.cpp', '*.cxx', '*.cc', '*.c++', '*.hpp', '*.hxx', '*.hh', '*.h++']
        },
        'c': {
            debugType: 'cppdbg',
            displayName: 'C',
            description: 'C application',
            defaultProperties: {
                program: '${workspaceFolder}/a.out',
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
            filePatterns: ['*.c', '*.h']
        },

        // Go
        'go': {
            debugType: 'go',
            displayName: 'Go',
            description: 'Go application',
            defaultProperties: {
                console: 'integratedTerminal',
                stopOnEntry: false
            },
            filePatterns: ['*.go']
        },

        // Rust
        'rs': {
            debugType: 'cppdbg',
            displayName: 'Rust',
            description: 'Rust application',
            defaultProperties: {
                program: '${workspaceFolder}/target/debug/${workspaceFolderBasename}',
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
            filePatterns: ['*.rs']
        },

        // PHP
        'php': {
            debugType: 'php',
            displayName: 'PHP',
            description: 'PHP application',
            defaultProperties: {
                stopOnEntry: false
            },
            filePatterns: ['*.php', '*.phtml']
        },

        // Ruby
        'rb': {
            debugType: 'ruby',
            displayName: 'Ruby',
            description: 'Ruby application',
            defaultProperties: {
                useBundler: true,
                stopOnEntry: false
            },
            filePatterns: ['*.rb', '*.rbw']
        },

        // C#
        'cs': {
            debugType: 'coreclr',
            displayName: 'C#/.NET',
            description: 'C# application',
            defaultProperties: {
                stopOnEntry: false,
                console: 'integratedTerminal'
            },
            filePatterns: ['*.cs', '*.csx']
        },

        // Web (Browser debugging)
        'html': {
            debugType: 'chrome',
            displayName: 'Chrome',
            description: 'Web application (HTML)',
            defaultProperties: {
                file: '${file}',
                runtimeExecutable: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                runtimeArgs: ['--new-window', '--remote-debugging-port=9222'],
                sourceMaps: true
            },
            filePatterns: ['*.html', '*.htm']
        },

        // Dart/Flutter
        'dart': {
            debugType: 'dart',
            displayName: 'Dart',
            description: 'Dart application',
            defaultProperties: {
                console: 'integratedTerminal',
                stopOnEntry: false
            },
            filePatterns: ['*.dart']
        },

        // PowerShell
        'ps1': {
            debugType: 'powershell',
            displayName: 'PowerShell',
            description: 'PowerShell script',
            defaultProperties: {
                createTemporaryIntegratedConsole: true
            },
            filePatterns: ['*.ps1', '*.psm1', '*.psd1']
        },

        // Shell scripts
        'sh': {
            debugType: 'node',
            displayName: 'Shell Script',
            description: 'Shell script (via Node.js)',
            defaultProperties: {
                runtimeExecutable: 'node',
                runtimeArgs: ['-e', 'process.exit(require("child_process").execSync(`bash ${file}`))'],
                console: 'integratedTerminal'
            },
            filePatterns: ['*.sh', '*.bash', '*.zsh', '*.fish']
        },

        // Lua
        'lua': {
            debugType: 'lua',
            displayName: 'Lua',
            description: 'Lua script',
            defaultProperties: {
                stopOnEntry: false
            },
            filePatterns: ['*.lua', '*.luac']
        },

        // Elixir
        'ex': {
            debugType: 'mix',
            displayName: 'Elixir',
            description: 'Elixir application',
            defaultProperties: {
                stopOnEntry: false
            },
            filePatterns: ['*.ex', '*.exs']
        },

        // Kotlin
        'kt': {
            debugType: 'kotlin',
            displayName: 'Kotlin',
            description: 'Kotlin application',
            defaultProperties: {
                stopOnEntry: false
            },
            filePatterns: ['*.kt', '*.kts']
        },

        // Scala
        'scala': {
            debugType: 'scala',
            displayName: 'Scala',
            description: 'Scala application',
            defaultProperties: {
                stopOnEntry: false
            },
            filePatterns: ['*.scala', '*.sc']
        }
    };

    /**
     * Get file type information based on file extension
     */
    public static getFileTypeInfo(filePath: string): FileTypeInfo | null {
        const extension = filePath.split('.').pop()?.toLowerCase();
        return extension ? this.fileTypeMappings[extension] : null;
    }

    /**
     * Get debug type for a file
     */
    public static getDebugType(filePath: string): string {
        const info = this.getFileTypeInfo(filePath);
        return info?.debugType || 'node'; // Default to Node.js
    }

    /**
     * Generate a configuration name based on file path
     */
    public static generateConfigName(filePath: string, workspaceRoot: string): string {
        let relativePath = filePath.replace(workspaceRoot, '');
        if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
            relativePath = relativePath.substring(1);
        }

        let configName = relativePath
            .replace(/\.(js|ts|py|java|cpp|c|go|rs|php|rb|cs|html|dart|ps1|sh|lua|ex|kt|scala)$/, '')
            .replace(/[\/\\]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (!configName) {
            const fileName = filePath.split(/[\/\\]/).pop() || 'current-file';
            configName = fileName.replace(/\.[^.]*$/, '');
        }

        return configName;
    }

    /**
     * Create a default launch configuration for a file
     */
    public static createDefaultConfiguration(
        filePath: string,
        workspaceRoot: string,
        configName?: string
    ): any {
        const fileTypeInfo = this.getFileTypeInfo(filePath);
        const debugType = fileTypeInfo?.debugType || 'node';
        const displayName = fileTypeInfo?.displayName || 'Unknown';

        const finalConfigName = configName || this.generateConfigName(filePath, workspaceRoot);
        const relativePath = filePath.replace(workspaceRoot, '').replace(/^[\/\\]/, '');

        const baseConfig: any = {
            name: finalConfigName,
            type: debugType,
            request: 'launch'
        };

        // Add file-specific configurations
        if (debugType === 'node' || debugType === 'python') {
            baseConfig.program = `\${workspaceFolder}/${relativePath}`;
        } else if (debugType === 'chrome') {
            baseConfig.file = `\${workspaceFolder}/${relativePath}`;
        } else if (debugType === 'java') {
            baseConfig.mainClass = relativePath.replace(/\.[^.]*$/, '').replace(/[\/\\]/g, '.');
        } else if (debugType === 'coreclr') {
            baseConfig.program = `\${workspaceFolder}/${relativePath.replace(/\.[^.]*$/, '')}.dll`;
        }

        // Merge with default properties
        if (fileTypeInfo?.defaultProperties) {
            Object.assign(baseConfig, fileTypeInfo.defaultProperties);
        }

        return baseConfig;
    }

    /**
     * Get all supported file types
     */
    public static getSupportedFileTypes(): Record<string, string> {
        const result: Record<string, string> = {};
        Object.entries(this.fileTypeMappings).forEach(([ext, info]) => {
            result[ext] = info.displayName;
        });
        return result;
    }
}