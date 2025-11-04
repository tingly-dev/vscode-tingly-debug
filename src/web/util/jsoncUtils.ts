/**
 * Simple JSONC (JSON with Comments) Parser Utility
 * Provides parsing and serialization functionality for JSONC format
 */

/**
 * Parse JSONC text and return the data
 */
export function parseJSONC(text: string): any {
    try {
        // Strip comments for parsing
        const { default: stripJsonComments } = require('strip-json-comments');
        const strippedText = stripJsonComments(text);
        return JSON.parse(strippedText);
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
        // If parsing fails, return empty configurations array
        console.warn('Failed to parse launch.json configurations, returning empty array:', error);
        return [];
    }
}

/**
 * Serialize data to JSON format (without comments)
 */
export function serializeJSONC(data: any): string {
    return JSON.stringify(data, null, 2);
}

/**
 * Update a specific configuration in launch.json
 */
export function updateLaunchConfiguration(
    originalText: string,
    configName: string,
    newConfig: any
): string {
    try {
        const data = parseJSONC(originalText);

        // Ensure configurations array exists
        if (!data.configurations) {
            throw new Error('No configurations found in launch.json');
        }

        // Find and update the configuration
        const configIndex = data.configurations.findIndex((config: any) => config.name === configName);
        if (configIndex !== -1) {
            data.configurations[configIndex] = newConfig;
        } else {
            throw new Error(`Configuration "${configName}" not found`);
        }

        return serializeJSONC(data);
    } catch (error) {
        throw new Error(`Failed to update configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Add a new configuration to launch.json
 */
export function addLaunchConfiguration(
    originalText: string,
    newConfig: any
): string {
    try {
        const data = parseJSONC(originalText);

        // Ensure configurations array exists
        if (!data.configurations) {
            data.configurations = [];
        }

        // Add the new configuration
        data.configurations.push(newConfig);

        return serializeJSONC(data);
    } catch (error) {
        throw new Error(`Failed to add configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Remove a configuration from launch.json
 */
export function removeLaunchConfiguration(
    originalText: string,
    configName: string
): string {
    try {
        const data = parseJSONC(originalText);

        // Ensure configurations array exists
        if (!data.configurations) {
            throw new Error('No configurations found in launch.json');
        }

        // Find and remove the configuration
        const configIndex = data.configurations.findIndex((config: any) => config.name === configName);
        if (configIndex !== -1) {
            data.configurations.splice(configIndex, 1);
        } else {
            throw new Error(`Configuration "${configName}" not found`);
        }

        return serializeJSONC(data);
    } catch (error) {
        throw new Error(`Failed to remove configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
}