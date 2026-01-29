// Python language debugging module

import * as vscode from 'vscode';
import { LanguageModule, LanguageFramework, LanguageDebugConfig, LanguageTestConfig } from './types';
import { SymbolInfo } from '../config/debugCommandGenerator';
import { PythonEnvironmentResolver } from './pythonEnvironmentResolver';

/**
 * Create pytest debug configuration with environment resolution
 */
async function createPytestDebugConfig(symbol: SymbolInfo): Promise<LanguageDebugConfig> {
    // Get interpreter path (may be undefined)
    const interpreterPath = await PythonEnvironmentResolver.resolveInterpreter();

    const config: LanguageDebugConfig = {
        name: `pytest: ${symbol.name}`,
        type: 'python',
        request: 'launch',
        module: 'pytest',
        purpose: ['debug-test'],
        args: [
            '-s', '-v',
            `${vscode.workspace.asRelativePath(symbol.filePath)}::${symbol.path.join('::')}`
        ],
        cwd: '${workspaceFolder}',
        env: {
            PYTHONPATH: '${workspaceFolder}'
        },
        console: 'integratedTerminal',
        justMyCode: false,
        subProcess: true
    };

    // Only add pythonPath if we found a specific one
    if (interpreterPath) {
        config.pythonPath = interpreterPath;
    }

    return config;
}

/**
 * Create unittest debug configuration with environment resolution
 */
async function createUnittestDebugConfig(symbol: SymbolInfo): Promise<LanguageDebugConfig> {
    // Get interpreter path (may be undefined)
    const interpreterPath = await PythonEnvironmentResolver.resolveInterpreter();

    const config: LanguageDebugConfig = {
        name: `unittest: ${symbol.name}`,
        type: 'python',
        request: 'launch',
        module: 'unittest',
        purpose: ['debug-test'],
        args: [
            vscode.workspace.asRelativePath(symbol.filePath).replace('.py', '') + '.' + symbol.path.slice(1).join('.')
        ],
        cwd: '${workspaceFolder}',
        console: 'integratedTerminal',
        justMyCode: true,
        subProcess: true
    };

    // Only add pythonPath if we found a specific one
    if (interpreterPath) {
        config.pythonPath = interpreterPath;
    }

    return config;
}

export const pythonModule: LanguageModule = {
    language: 'python',
    displayName: 'Python',
    fileExtensions: ['py', 'pyw', 'py3'],
    defaultDebugType: 'python',

    frameworks: [
        {
            name: 'pytest',
            filePatterns: ['**/test_*.py', '**/*_test.py', '**/tests/**', '**/conftest.py', 'pytest.ini', 'pyproject.toml', 'setup.cfg'],
            priority: 10,
            debugConfig: createPytestDebugConfig,
            testConfig: (symbol: SymbolInfo): LanguageTestConfig => ({
                framework: 'pytest',
                testCommand: 'pytest',
                args: ['-s', '-v', `${vscode.workspace.asRelativePath(symbol.filePath)}::${symbol.path.join('::')}`],
                env: { PYTHONPATH: '${workspaceFolder}' },
                cwd: '${workspaceFolder}'
            }),
            setupInstructions: 'Install pytest: pip install pytest',
            requirements: ['pytest', 'python', 'Python extension for VS Code']
        },
        {
            name: 'unittest',
            filePatterns: ['**/test_*.py', '**/*_test.py', '**/tests/**'],
            priority: 5,
            debugConfig: createUnittestDebugConfig,
            setupInstructions: 'unittest is built into Python standard library',
            requirements: ['python', 'Python extension for VS Code']
        }
    ],

    defaultConfig: (filePath: string, workspaceRoot: string): LanguageDebugConfig => {
        const relativePath = filePath.replace(workspaceRoot, '').replace(/^[\/\\]/, '');
        return {
            name: 'Python: Current File',
            type: 'python',
            request: 'launch',
            program: `\${workspaceFolder}/${relativePath}`,
            console: 'integratedTerminal',
            justMyCode: true,
            cwd: '${workspaceFolder}'
        };
    },

    setupInstructions: `
# Python Debugging Setup

## Required Extensions
1. **Python** (ms-python.python) - Official Python extension from Microsoft
2. **Python Debugger** (ms-python.debugpy) - Usually included with Python extension

## Installation
\`\`\`bash
# Install Python (if not already installed)
# macOS: brew install python3
# Ubuntu: sudo apt install python3 python3-pip
# Windows: Download from python.org

# Install pytest for testing (recommended)
pip install pytest
\`\`\`

## VSCode Configuration
Ensure your Python interpreter is properly configured:
1. Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
2. Type "Python: Select Interpreter"
3. Choose your Python environment

## Environment Detection
Tingly Debug automatically detects your Python interpreter from:
- Python extension's active interpreter
- Python Environments extension (if installed)
- Workspace configuration (python.defaultInterpreterPath)
- Falls back to system default Python

## Common Issues
- Make sure the Python extension is enabled
- Verify your Python interpreter is correctly selected
- For virtual environments, activate them before starting VS Code
    `,

    requirements: ['Python 3.7+', 'Python extension for VS Code'],
    documentation: 'https://code.visualstudio.com/docs/python/python-tutorial'
};