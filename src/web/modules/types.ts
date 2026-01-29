// Language module interfaces and types

import * as vscode from 'vscode';
import { SymbolInfo, CommandTemplate } from '../config/debugCommandGenerator';

export interface LanguageDebugConfig {
    type: string;
    name: string;
    request: 'launch' | 'attach';
    [key: string]: any;
}

export interface LanguageTestConfig {
    framework: string;
    testCommand: string;
    args: string[];
    env?: Record<string, string>;
    cwd?: string;
}

export interface LanguageFramework {
    name: string;
    filePatterns: string[];
    priority: number; // Higher number = higher priority
    debugConfig: ((symbol: SymbolInfo) => LanguageDebugConfig) | ((symbol: SymbolInfo) => Promise<LanguageDebugConfig>);
    testConfig?: ((symbol: SymbolInfo) => LanguageTestConfig) | ((symbol: SymbolInfo) => Promise<LanguageTestConfig>);
    setupInstructions?: string;
    requirements?: string[];
}

export interface LanguageModule {
    language: string;
    displayName: string;
    fileExtensions: string[];
    defaultDebugType: string;
    frameworks: LanguageFramework[];
    defaultConfig: (filePath: string, workspaceRoot: string) => LanguageDebugConfig;
    setupInstructions?: string;
    requirements?: string[];
    documentation?: string;
}

