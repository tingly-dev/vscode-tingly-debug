// Tests for JSONC utility functions

import { strict as assert } from 'assert';
import {
    parseJSONC,
    parseJSONCConfigurations,
    serializeJSONC,
    updateLaunchConfiguration,
    addLaunchConfiguration,
    removeLaunchConfiguration
} from '../../util/jsoncUtils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MINIMAL_LAUNCH = JSON.stringify({ version: '0.2.0', configurations: [] }, null, 4);

const LAUNCH_WITH_TWO_CONFIGS = JSON.stringify({
    version: '0.2.0',
    configurations: [
        { name: 'App', type: 'node', request: 'launch', program: '${workspaceFolder}/index.js' },
        { name: 'Tests', type: 'node', request: 'launch', program: '${workspaceFolder}/test.js' }
    ]
}, null, 4);

// A realistic launch.json that has comments — the critical comment-preservation fixture
const LAUNCH_WITH_COMMENTS = `{
    // Top-level comment
    "version": "0.2.0",
    "configurations": [
        // First config
        {
            "name": "App",
            "type": "node",
            "request": "launch"
        }
    ]
}`;

// ---------------------------------------------------------------------------
// parseJSONC
// ---------------------------------------------------------------------------

suite('parseJSONC', () => {
    test('parses plain JSON', () => {
        const result = parseJSONC(MINIMAL_LAUNCH);
        assert.strictEqual(result.version, '0.2.0');
        assert.deepStrictEqual(result.configurations, []);
    });

    test('parses JSONC with single-line comments', () => {
        const result = parseJSONC(LAUNCH_WITH_COMMENTS);
        assert.strictEqual(result.version, '0.2.0');
        assert.strictEqual(result.configurations.length, 1);
        assert.strictEqual(result.configurations[0].name, 'App');
    });

    test('throws on malformed JSON', () => {
        assert.throws(() => parseJSONC('{bad json'), /JSONC parsing failed/);
    });

    test('parses nested objects correctly', () => {
        const text = JSON.stringify({ a: { b: { c: 42 } } });
        assert.strictEqual(parseJSONC(text).a.b.c, 42);
    });
});

// ---------------------------------------------------------------------------
// parseJSONCConfigurations
// ---------------------------------------------------------------------------

suite('parseJSONCConfigurations', () => {
    test('returns configurations array', () => {
        const configs = parseJSONCConfigurations(LAUNCH_WITH_TWO_CONFIGS);
        assert.strictEqual(configs.length, 2);
        assert.strictEqual(configs[0].name, 'App');
        assert.strictEqual(configs[1].name, 'Tests');
    });

    test('returns empty array when configurations key is absent', () => {
        const text = JSON.stringify({ version: '0.2.0' });
        const configs = parseJSONCConfigurations(text);
        assert.deepStrictEqual(configs, []);
    });

    test('throws on malformed JSONC', () => {
        assert.throws(() => parseJSONCConfigurations('{not valid'), /JSONC parsing failed/);
    });
});

// ---------------------------------------------------------------------------
// serializeJSONC
// ---------------------------------------------------------------------------

suite('serializeJSONC', () => {
    test('serializes an object to indented JSON', () => {
        const obj = { version: '0.2.0', configurations: [] };
        const result = serializeJSONC(obj);
        assert.ok(result.includes('"version"'));
        assert.ok(result.includes('"configurations"'));
        // Should be pretty-printed
        assert.ok(result.includes('\n'));
    });
});

// ---------------------------------------------------------------------------
// addLaunchConfiguration
// ---------------------------------------------------------------------------

suite('addLaunchConfiguration', () => {
    test('appends a new config', () => {
        const newConfig = { name: 'New', type: 'node', request: 'launch' };
        const result = addLaunchConfiguration(LAUNCH_WITH_TWO_CONFIGS, newConfig);
        const parsed = parseJSONC(result);
        assert.strictEqual(parsed.configurations.length, 3);
        assert.strictEqual(parsed.configurations[2].name, 'New');
    });

    test('adds to empty configurations array', () => {
        const newConfig = { name: 'First', type: 'node', request: 'launch' };
        const result = addLaunchConfiguration(MINIMAL_LAUNCH, newConfig);
        const parsed = parseJSONC(result);
        assert.strictEqual(parsed.configurations.length, 1);
        assert.strictEqual(parsed.configurations[0].name, 'First');
    });

    test('preserves comments when adding a config', () => {
        const newConfig = { name: 'Added', type: 'node', request: 'launch' };
        const result = addLaunchConfiguration(LAUNCH_WITH_COMMENTS, newConfig);
        // Comments must still be in the output text
        assert.ok(result.includes('// Top-level comment'), 'top-level comment must be preserved');
        assert.ok(result.includes('// First config'), 'inline comment must be preserved');
        // And the new config must be present
        const parsed = parseJSONC(result);
        assert.strictEqual(parsed.configurations.length, 2);
        assert.strictEqual(parsed.configurations[1].name, 'Added');
    });

    test('adds configurations key when absent', () => {
        const text = JSON.stringify({ version: '0.2.0' }, null, 4);
        const newConfig = { name: 'App', type: 'node', request: 'launch' };
        const result = addLaunchConfiguration(text, newConfig);
        const parsed = parseJSONC(result);
        assert.strictEqual(parsed.configurations.length, 1);
    });
});

// ---------------------------------------------------------------------------
// updateLaunchConfiguration
// ---------------------------------------------------------------------------

suite('updateLaunchConfiguration', () => {
    test('updates an existing config by name', () => {
        const updated = { name: 'App', type: 'node', request: 'launch', program: 'new.js' };
        const result = updateLaunchConfiguration(LAUNCH_WITH_TWO_CONFIGS, 'App', updated);
        const parsed = parseJSONC(result);
        assert.strictEqual(parsed.configurations[0].program, 'new.js');
        // Other config untouched
        assert.strictEqual(parsed.configurations[1].name, 'Tests');
    });

    test('throws when config name not found', () => {
        const updated = { name: 'Missing', type: 'node', request: 'launch' };
        assert.throws(
            () => updateLaunchConfiguration(LAUNCH_WITH_TWO_CONFIGS, 'Missing', updated),
            /Configuration "Missing" not found/
        );
    });

    test('preserves comments when updating', () => {
        const updated = { name: 'App', type: 'node', request: 'launch', program: 'new.js' };
        const result = updateLaunchConfiguration(LAUNCH_WITH_COMMENTS, 'App', updated);
        assert.ok(result.includes('// Top-level comment'), 'top-level comment must be preserved');
        const parsed = parseJSONC(result);
        assert.strictEqual(parsed.configurations[0].program, 'new.js');
    });

    test('can rename a configuration', () => {
        const updated = { name: 'Renamed', type: 'node', request: 'launch' };
        const result = updateLaunchConfiguration(LAUNCH_WITH_TWO_CONFIGS, 'App', updated);
        const parsed = parseJSONC(result);
        assert.strictEqual(parsed.configurations[0].name, 'Renamed');
    });

    test('throws when no configurations key', () => {
        const text = JSON.stringify({ version: '0.2.0' });
        assert.throws(
            () => updateLaunchConfiguration(text, 'App', {}),
            /No configurations found/
        );
    });
});

// ---------------------------------------------------------------------------
// removeLaunchConfiguration
// ---------------------------------------------------------------------------

suite('removeLaunchConfiguration', () => {
    test('removes a config by name', () => {
        const result = removeLaunchConfiguration(LAUNCH_WITH_TWO_CONFIGS, 'App');
        const parsed = parseJSONC(result);
        assert.strictEqual(parsed.configurations.length, 1);
        assert.strictEqual(parsed.configurations[0].name, 'Tests');
    });

    test('throws when config name not found', () => {
        assert.throws(
            () => removeLaunchConfiguration(LAUNCH_WITH_TWO_CONFIGS, 'Ghost'),
            /Configuration "Ghost" not found/
        );
    });

    test('preserves comments when removing', () => {
        const withTwo = addLaunchConfiguration(
            LAUNCH_WITH_COMMENTS,
            { name: 'Extra', type: 'node', request: 'launch' }
        );
        const result = removeLaunchConfiguration(withTwo, 'Extra');
        assert.ok(result.includes('// Top-level comment'), 'top-level comment must be preserved');
        const parsed = parseJSONC(result);
        assert.strictEqual(parsed.configurations.length, 1);
    });

    test('throws when no configurations key', () => {
        const text = JSON.stringify({ version: '0.2.0' });
        assert.throws(
            () => removeLaunchConfiguration(text, 'App'),
            /No configurations found/
        );
    });

    test('leaves other configs intact after removal', () => {
        const text = JSON.stringify({
            version: '0.2.0',
            configurations: [
                { name: 'A', type: 'node', request: 'launch' },
                { name: 'B', type: 'node', request: 'launch' },
                { name: 'C', type: 'node', request: 'launch' }
            ]
        }, null, 4);
        const result = removeLaunchConfiguration(text, 'B');
        const parsed = parseJSONC(result);
        assert.strictEqual(parsed.configurations.length, 2);
        assert.strictEqual(parsed.configurations[0].name, 'A');
        assert.strictEqual(parsed.configurations[1].name, 'C');
    });
});
