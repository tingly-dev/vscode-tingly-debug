// Enhanced test for Python debugging configuration generation

import { languageRegistry } from '../modules/registry';
import { SymbolInfo } from '../config/debugCommandGenerator';

async function testPythonDebug() {
    console.log('=== Testing Python Debug Configuration Generation ===');

    // Test Python symbol
    const pythonSymbol: SymbolInfo = {
        name: 'test_example',
        path: ['TestClass', 'test_example'],
        kind: 12 as any, // Method
        language: 'python',
        filePath: '/workspace/test_example.py',
        workspaceRoot: '/workspace'
    };

    try {
        const debugConfig = await languageRegistry.generateDebugConfig(pythonSymbol);
        console.log('Generated Python debug config:', JSON.stringify(debugConfig, null, 2));

        // Check basic properties
        if (debugConfig.type === 'python' && debugConfig.name.includes('test_example')) {
            console.log('✅ Python debug configuration generated successfully!');

            // Check for new features
            if (debugConfig.purpose && Array.isArray(debugConfig.purpose) && debugConfig.purpose.includes('debug-test')) {
                console.log('✅ Purpose attribute for test debugging is set');
            } else {
                console.log('⚠️  Purpose attribute missing');
            }

            if (debugConfig.subProcess === true) {
                console.log('✅ SubProcess support enabled');
            } else {
                console.log('⚠️  SubProcess support missing');
            }

            if (debugConfig.pythonPath) {
                console.log(`✅ Python interpreter path: ${debugConfig.pythonPath}`);
            } else {
                console.log('ℹ️  No specific interpreter configured (will use system default)');
            }
        } else {
            console.log('❌ Python debug configuration has issues');
        }
    } catch (error) {
        console.error('❌ Error generating Python debug config:', error);
    }
}

async function testUnittestDebug() {
    console.log('\n=== Testing Python Unittest Debug Configuration ===');

    const unittestSymbol: SymbolInfo = {
        name: 'test_unittest_example',
        path: ['TestUnittest', 'test_unittest_example'],
        kind: 12 as any,
        language: 'python',
        filePath: '/workspace/test_unittest.py',
        workspaceRoot: '/workspace'
    };

    try {
        const debugConfig = await languageRegistry.generateDebugConfig(unittestSymbol);
        console.log('Generated unittest debug config:', JSON.stringify(debugConfig, null, 2));

        if (debugConfig.module === 'unittest') {
            console.log('✅ Unittest configuration generated successfully!');

            if (debugConfig.purpose && debugConfig.purpose.includes('debug-test')) {
                console.log('✅ Purpose attribute for unittest debugging is set');
            }

            if (debugConfig.subProcess === true) {
                console.log('✅ SubProcess support enabled for unittest');
            }
        }
    } catch (error) {
        console.error('❌ Error generating unittest debug config:', error);
    }
}

async function testGoDebug() {
    console.log('\n=== Testing Go Debug Configuration Generation ===');

    // Test Go symbol
    const goSymbol: SymbolInfo = {
        name: 'TestExample',
        path: ['TestExample'],
        kind: 12 as any, // Method
        language: 'go',
        filePath: '/workspace/example_test.go',
        workspaceRoot: '/workspace'
    };

    try {
        const debugConfig = await languageRegistry.generateDebugConfig(goSymbol);
        console.log('Generated Go debug config:', JSON.stringify(debugConfig, null, 2));

        // Check basic properties
        if (debugConfig.type === 'go' && debugConfig.name.includes('TestExample')) {
            console.log('✅ Go debug configuration generated successfully!');

            if (debugConfig.mode === 'test') {
                console.log('✅ Test mode is set correctly');
            }

            if (debugConfig.args && debugConfig.args.includes('-test.run')) {
                console.log('✅ Test run arguments are present');
            }
        } else {
            console.log('❌ Go debug configuration has issues');
        }
    } catch (error) {
        console.error('❌ Error generating Go debug config:', error);
    }
}

// Run tests
async function runAllTests() {
    console.log('🚀 Starting debug configuration tests...\n');

    await testPythonDebug();
    await testUnittestDebug();
    await testGoDebug();

    console.log('\n✅ All tests completed!');
}

runAllTests().catch(error => {
    console.error('💥 Test execution failed:', error);
});