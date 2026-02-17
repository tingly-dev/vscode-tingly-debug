// Tests for logger utility

import { strict as assert } from 'assert';
import { logger, createModuleLogger } from '../../util/logger';

suite('Logger Utility Test Suite', () => {

    test('logger should have all required methods', () => {
        assert.strictEqual(typeof logger.debug, 'function', 'logger.debug should be a function');
        assert.strictEqual(typeof logger.info, 'function', 'logger.info should be a function');
        assert.strictEqual(typeof logger.warn, 'function', 'logger.warn should be a function');
        assert.strictEqual(typeof logger.error, 'function', 'logger.error should be a function');
        assert.strictEqual(typeof logger.group, 'function', 'logger.group should be a function');
        assert.strictEqual(typeof logger.groupEnd, 'function', 'logger.groupEnd should be a function');
    });

    test('logger methods should not throw', () => {
        assert.doesNotThrow(() => logger.debug('test debug message'), 'logger.debug should not throw');
        assert.doesNotThrow(() => logger.info('test info message'), 'logger.info should not throw');
        assert.doesNotThrow(() => logger.warn('test warn message'), 'logger.warn should not throw');
        assert.doesNotThrow(() => logger.error('test error message'), 'logger.error should not throw');
        assert.doesNotThrow(() => logger.group('test group'), 'logger.group should not throw');
        assert.doesNotThrow(() => logger.groupEnd(), 'logger.groupEnd should not throw');
    });

    test('logger should handle multiple arguments', () => {
        assert.doesNotThrow(() => logger.debug('message', { key: 'value' }, 123), 'logger.debug with multiple args should not throw');
        assert.doesNotThrow(() => logger.info('message', 'arg1', 'arg2'), 'logger.info with multiple args should not throw');
        assert.doesNotThrow(() => logger.error('error', new Error('test')), 'logger.error with Error should not throw');
    });

    test('createModuleLogger should return logger with all methods', () => {
        const moduleLogger = createModuleLogger('TestModule');

        assert.strictEqual(typeof moduleLogger.debug, 'function', 'moduleLogger.debug should be a function');
        assert.strictEqual(typeof moduleLogger.info, 'function', 'moduleLogger.info should be a function');
        assert.strictEqual(typeof moduleLogger.warn, 'function', 'moduleLogger.warn should be a function');
        assert.strictEqual(typeof moduleLogger.error, 'function', 'moduleLogger.error should be a function');
    });

    test('createModuleLogger methods should not throw', () => {
        const moduleLogger = createModuleLogger('TestModule');

        assert.doesNotThrow(() => moduleLogger.debug('test debug'), 'moduleLogger.debug should not throw');
        assert.doesNotThrow(() => moduleLogger.info('test info'), 'moduleLogger.info should not throw');
        assert.doesNotThrow(() => moduleLogger.warn('test warn'), 'moduleLogger.warn should not throw');
        assert.doesNotThrow(() => moduleLogger.error('test error'), 'moduleLogger.error should not throw');
    });

    test('createModuleLogger should work with empty module name', () => {
        const moduleLogger = createModuleLogger('');

        assert.doesNotThrow(() => moduleLogger.info('test'), 'moduleLogger with empty name should not throw');
    });
});
