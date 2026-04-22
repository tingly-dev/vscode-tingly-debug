/**
 * JSONC (JSON with Comments) Parser Utility
 * Uses jsonc-parser for targeted edits that preserve comments and formatting.
 */

import { createModuleLogger } from './logger';
import { parse, modify, applyEdits } from 'jsonc-parser';
import type { FormattingOptions } from 'jsonc-parser';

const log = createModuleLogger('JSONC');

const FORMATTING: FormattingOptions = { tabSize: 4, insertSpaces: true };

/**
 * Parse JSONC text and return the data
 */
export function parseJSONC(text: string): any {
    try {
        const errors: any[] = [];
        const result = parse(text, errors);
        if (errors.length > 0) {
            throw new Error(`JSONC parse error: ${errors[0].error}`);
        }
        return result;
    } catch (error) {
        throw new Error(`JSONC parsing failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Parse JSONC text and return only the configurations array
 */
export function parseJSONCConfigurations(text: string): any[] {
    try {
        const data = parseJSONC(text);
        return data.configurations || [];
    } catch (error) {
        log.error('Failed to parse launch.json configurations:', error);
        throw error;
    }
}

/**
 * Serialize data to JSON string (used only for new file creation)
 */
export function serializeJSONC(data: any): string {
    return JSON.stringify(data, null, 2);
}

/**
 * Apply a targeted edit to the original JSONC text at the given JSON path.
 * Preserves all comments and existing formatting.
 */
function applyModification(originalText: string, jsonPath: (string | number)[], value: any): string {
    const edits = modify(originalText, jsonPath, value, { formattingOptions: FORMATTING });
    return applyEdits(originalText, edits);
}

/**
 * Update a specific configuration in launch.json, preserving comments.
 */
export function updateLaunchConfiguration(
    originalText: string,
    configName: string,
    newConfig: any
): string {
    try {
        const data = parseJSONC(originalText);

        if (!data.configurations) {
            throw new Error('No configurations found in launch.json');
        }

        const configIndex = data.configurations.findIndex((config: any) => config.name === configName);
        if (configIndex === -1) {
            throw new Error(`Configuration "${configName}" not found`);
        }

        return applyModification(originalText, ['configurations', configIndex], newConfig);
    } catch (error) {
        throw new Error(`Failed to update configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Add a new configuration to launch.json, preserving comments.
 */
export function addLaunchConfiguration(
    originalText: string,
    newConfig: any
): string {
    try {
        const data = parseJSONC(originalText);
        const insertIndex = data.configurations ? data.configurations.length : 0;
        return applyModification(originalText, ['configurations', insertIndex], newConfig);
    } catch (error) {
        throw new Error(`Failed to add configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Remove a configuration from launch.json, preserving comments.
 */
export function removeLaunchConfiguration(
    originalText: string,
    configName: string
): string {
    try {
        const data = parseJSONC(originalText);

        if (!data.configurations) {
            throw new Error('No configurations found in launch.json');
        }

        const configIndex = data.configurations.findIndex((config: any) => config.name === configName);
        if (configIndex === -1) {
            throw new Error(`Configuration "${configName}" not found`);
        }

        // Setting value to undefined removes the item from the array
        return applyModification(originalText, ['configurations', configIndex], undefined);
    } catch (error) {
        throw new Error(`Failed to remove configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
}
