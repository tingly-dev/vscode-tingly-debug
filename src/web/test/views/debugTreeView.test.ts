/**
 * Test suite for DebugConfigurationProvider refresh functionality
 */

import { strict as assert } from 'assert';
import { DebugConfigurationProvider } from '../../views/debugPanel';

suite('DebugConfigurationProvider Test Suite', () => {
    let provider: DebugConfigurationProvider;

    setup(() => {
        provider = new DebugConfigurationProvider();
    });

    test('refresh should trigger tree data change', () => {
        let changeEventFired = false;
        const disposable = provider.onDidChangeTreeData(() => {
            changeEventFired = true;
        });

        // Call refresh
        provider.refresh();

        // Verify that the change event was fired
        assert.strictEqual(changeEventFired, true, 'Tree data change event should be fired on refresh');

        disposable.dispose();
    });

    test('getConfigurations should return empty array when no launch.json exists', async () => {
        // This test assumes no launch.json file exists in the test workspace
        const configurations = await provider.getConfigurations();
        assert(Array.isArray(configurations), 'Should return an array');
        assert.strictEqual(configurations.length, 0, 'Should return empty array when no configurations exist');
    });

    test('readLaunchJson should return default structure when file does not exist', async () => {
        const launchJson = await provider.readLaunchJson();
        assert.strictEqual(launchJson.version, "0.2.0", 'Should return default version');
        assert(Array.isArray(launchJson.configurations), 'Should have configurations array');
        assert.strictEqual(launchJson.configurations.length, 0, 'Should have empty configurations array');
    });

    test('refresh method should exist and be callable', () => {
        assert.strictEqual(typeof provider.refresh, 'function', 'refresh should be a function');
        assert.doesNotThrow(() => provider.refresh(), 'refresh should not throw');
    });

    test('onDidChangeTreeData should provide event emitter', () => {
        const event = provider.onDidChangeTreeData;
        assert.strictEqual(typeof event, 'object', 'onDidChangeTreeData should return an event object');
        assert.strictEqual(typeof (event as any).fire, 'function', 'Event should have fire method');
    });
});