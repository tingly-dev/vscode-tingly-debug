// Tests for Python environment resolver

import { strict as assert } from 'assert';
import { PythonEnvironmentResolver } from '../../modules/pythonEnvironmentResolver';

suite('Python Environment Resolver Test Suite', () => {

    test('resolveInterpreter should return a promise', async () => {
        const result = PythonEnvironmentResolver.resolveInterpreter();
        assert.ok(result instanceof Promise, 'resolveInterpreter should return a Promise');
    });

    test('resolveInterpreter should resolve to string or undefined', async () => {
        const result = await PythonEnvironmentResolver.resolveInterpreter();
        // Result should be either a string, null, or undefined
        const isValid = result === undefined || result === null || typeof result === 'string';
        assert.ok(isValid, 'resolveInterpreter should resolve to string, null, or undefined');
    });

    test('resolveInterpreter should not throw', async () => {
        // This test verifies that the resolver handles missing extensions gracefully
        await assert.doesNotReject(
            async () => PythonEnvironmentResolver.resolveInterpreter(),
            'resolveInterpreter should not reject'
        );
    });

    test('resolveInterpreter should return same type on multiple calls', async () => {
        // Call multiple times to ensure consistency
        const result1 = await PythonEnvironmentResolver.resolveInterpreter();
        const result2 = await PythonEnvironmentResolver.resolveInterpreter();

        const type1 = typeof result1;
        const type2 = typeof result2;

        // Both results should have the same type (string or undefined)
        assert.strictEqual(type1, type2, 'Multiple calls should return consistent types');
    });
});
