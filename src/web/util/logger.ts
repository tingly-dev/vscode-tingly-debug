/**
 * Centralized logging utility for Tingly Debug
 * Only outputs in development mode to reduce noise in production
 */

const isDevelopment = process.env.NODE_ENV === 'development' ||
    typeof (global as any).__TINGLY_DEBUG__ !== 'undefined';

/**
 * Logger namespace for consistent prefixing
 */
const NAMESPACE = '[Tingly]';

/**
 * Centralized logger that respects environment settings
 */
export const logger = {
    /**
     * Debug logging - only outputs in development mode
     */
    debug: (...args: unknown[]): void => {
        if (isDevelopment) {
            console.log(NAMESPACE, '[DEBUG]', ...args);
        }
    },

    /**
     * Info logging - always outputs
     */
    info: (...args: unknown[]): void => {
        console.log(NAMESPACE, ...args);
    },

    /**
     * Warning logging - always outputs
     */
    warn: (...args: unknown[]): void => {
        console.warn(NAMESPACE, '[WARN]', ...args);
    },

    /**
     * Error logging - always outputs
     */
    error: (...args: unknown[]): void => {
        console.error(NAMESPACE, '[ERROR]', ...args);
    },

    /**
     * Group logging for related messages
     */
    group: (label: string): void => {
        if (isDevelopment) {
            console.group(`${NAMESPACE} ${label}`);
        }
    },

    /**
     * End group logging
     */
    groupEnd: (): void => {
        if (isDevelopment) {
            console.groupEnd();
        }
    }
};

/**
 * Create a contextual logger with a specific module name
 */
export function createModuleLogger(moduleName: string) {
    return {
        debug: (...args: unknown[]): void => logger.debug(`[${moduleName}]`, ...args),
        info: (...args: unknown[]): void => logger.info(`[${moduleName}]`, ...args),
        warn: (...args: unknown[]): void => logger.warn(`[${moduleName}]`, ...args),
        error: (...args: unknown[]): void => logger.error(`[${moduleName}]`, ...args),
    };
}
