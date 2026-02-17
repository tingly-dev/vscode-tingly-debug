// Python environment resolver
// Integrates with VS Code Python extension to get active interpreter

import * as vscode from 'vscode';
import { createModuleLogger } from '../util/logger';

const log = createModuleLogger('PythonResolver');

/**
 * Python environment resolver
 * Uses VS Code Python extension APIs, falls back to system default
 */
export class PythonEnvironmentResolver {
    /**
     * Get Python interpreter path with fallback strategy
     * @returns Interpreter path or undefined (use system default)
     */
    static async resolveInterpreter(): Promise<string | undefined> {
        // Priority 1: Use Python Extension API
        const extensionInterpreter = await this.getFromPythonExtension();
        if (extensionInterpreter) {
            log.debug('Using interpreter from Python extension:', extensionInterpreter);
            return extensionInterpreter;
        }

        // Priority 2: Use Python Environments Extension API
        const envInterpreter = await this.getFromEnvironmentsExtension();
        if (envInterpreter) {
            log.debug('Using interpreter from Environments extension:', envInterpreter);
            return envInterpreter;
        }

        // Priority 3: Use workspace configuration
        const configInterpreter = this.getFromWorkspaceConfig();
        if (configInterpreter) {
            log.debug('Using interpreter from workspace config:', configInterpreter);
            return configInterpreter;
        }

        // Fallback: Return undefined, let Python debugger use system default
        log.debug('No specific interpreter configured, using system default Python');
        return undefined;
    }

    /**
     * Get interpreter from Python extension
     */
    private static async getFromPythonExtension(): Promise<string | null> {
        try {
            const extension = vscode.extensions.getExtension('ms-python.python');
            if (!extension) {
                log.debug('Python extension not found');
                return null;
            }

            await extension.activate();

            // Try extension API (structure may vary)
            const api = extension.exports;
            if (api?.settings?.getExecutionSettings) {
                const settings = await api.settings.getExecutionSettings();
                return settings?.pythonPath || null;
            }
        } catch (error) {
            log.warn('Python extension API error:', error);
        }

        return null;
    }

    /**
     * Get interpreter from Python Environments extension
     */
    private static async getFromEnvironmentsExtension(): Promise<string | null> {
        try {
            const extension = vscode.extensions.getExtension('ms-python.python-environments');
            if (!extension) {
                log.debug('Python Environments extension not found');
                return null;
            }

            await extension.activate();

            const api = extension.exports;
            if (api?.getActiveEnvironment) {
                const env = await api.getActiveEnvironment();
                return env?.executable?.uri?.fsPath || null;
            }
        } catch (error) {
            log.warn('Python Environments extension API error:', error);
        }

        return null;
    }

    /**
     * Get interpreter from workspace configuration
     */
    private static getFromWorkspaceConfig(): string | null {
        const config = vscode.workspace.getConfiguration('python');
        return config.get<string>('defaultInterpreterPath') || null;
    }
}
