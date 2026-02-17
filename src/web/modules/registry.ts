// Language module registry and manager

import * as vscode from 'vscode';
import { LanguageModule, LanguageFramework } from './types';
import { SymbolInfo } from '../config/debugCommandGenerator';
import { pythonModule } from './python';
import { golangModule } from './golang';
import { javascriptModule } from './javascript';
import { createModuleLogger } from '../util/logger';

const log = createModuleLogger('Registry');

export class LanguageModuleRegistry {
    private static instance: LanguageModuleRegistry;
    private modules: Map<string, LanguageModule> = new Map();

    private constructor() {
        this.registerDefaultModules();
    }

    public static getInstance(): LanguageModuleRegistry {
        if (!LanguageModuleRegistry.instance) {
            LanguageModuleRegistry.instance = new LanguageModuleRegistry();
        }
        return LanguageModuleRegistry.instance;
    }

    private registerDefaultModules(): void {
        this.register(pythonModule);
        this.register(golangModule);
        this.register(javascriptModule);
    }

    public register(module: LanguageModule): void {
        this.modules.set(module.language, module);
        log.debug(`Registered language module: ${module.displayName}`);
    }

    public unregister(language: string): void {
        if (this.modules.delete(language)) {
            log.debug(`Unregistered language module: ${language}`);
        }
    }

    public getModule(language: string): LanguageModule | undefined {
        return this.modules.get(language);
    }

    public getAllModules(): LanguageModule[] {
        return Array.from(this.modules.values());
    }

    public getSupportedLanguages(): string[] {
        return Array.from(this.modules.keys());
    }

    public getModuleByExtension(extension: string): LanguageModule | undefined {
        for (const module of this.modules.values()) {
            if (module.fileExtensions.includes(extension.toLowerCase())) {
                return module;
            }
        }
        return undefined;
    }

    public async detectFramework(symbol: SymbolInfo): Promise<LanguageFramework | null> {
        const module = this.getModule(symbol.language);
        if (!module) {
            return null;
        }

        const sortedFrameworks = module.frameworks
            .sort((a, b) => b.priority - a.priority);

        for (const framework of sortedFrameworks) {
            if (await this.matchesFramework(symbol, framework)) {
                return framework;
            }
        }

        return null;
    }

    private async matchesFramework(symbol: SymbolInfo, framework: LanguageFramework): Promise<boolean> {
        for (const pattern of framework.filePatterns) {
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

    public async generateDebugConfig(symbol: SymbolInfo): Promise<any> {
        const module = this.getModule(symbol.language);
        if (!module) {
            throw new Error(`No module registered for language: ${symbol.language}`);
        }

        const framework = await this.detectFramework(symbol);
        if (framework) {
            // Handle both sync and async debugConfig functions
            const config = framework.debugConfig(symbol);
            return config instanceof Promise ? await config : config;
        }

        return module.defaultConfig(symbol.filePath, symbol.workspaceRoot);
    }

    public async generateTestConfig(symbol: SymbolInfo): Promise<any | null> {
        const framework = await this.detectFramework(symbol);
        if (framework && framework.testConfig) {
            // Handle both sync and async testConfig functions
            const config = framework.testConfig(symbol);
            return config instanceof Promise ? await config : config;
        }
        return null;
    }

    public getSetupInstructions(language: string): string | undefined {
        const module = this.getModule(language);
        return module?.setupInstructions;
    }

    public getRequirements(language: string): string[] | undefined {
        const module = this.getModule(language);
        return module?.requirements;
    }

    public validateSetup(language: string): Promise<boolean> {
        // TODO: Implement setup validation logic
        // Check if required tools and extensions are installed
        return Promise.resolve(true);
    }

    public getFrameworkInfo(language: string): { name: string; priority: number }[] {
        const module = this.getModule(language);
        if (!module) {
            return [];
        }

        return module.frameworks
            .sort((a, b) => b.priority - a.priority)
            .map(fw => ({
                name: fw.name,
                priority: fw.priority
            }));
    }
}

// Export singleton instance
export const languageRegistry = LanguageModuleRegistry.getInstance();