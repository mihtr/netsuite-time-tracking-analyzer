#!/usr/bin/env node

/**
 * Test Runner - Runs all tests in sequence
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Running All Tests for NetSuite Time Tracking Analyzer\n');
console.log('='.repeat(60));

let allPassed = true;

// Run HTML validation
console.log('\n📝 Step 1: HTML Validation\n');
try {
    execSync('node tests/validate-html.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('\n✅ HTML validation passed!\n');
} catch (error) {
    console.log('\n❌ HTML validation failed!\n');
    allPassed = false;
}

// Run unit tests
console.log('='.repeat(60));
console.log('\n🧪 Step 2: Unit Tests\n');
try {
    execSync('node tests/unit-tests.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('\n✅ Unit tests passed!\n');
} catch (error) {
    console.log('\n❌ Unit tests failed!\n');
    allPassed = false;
}

// Run integration tests
console.log('='.repeat(60));
console.log('\n🔗 Step 3: Integration Tests\n');
try {
    execSync('node tests/integration-tests.js', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('\n✅ Integration tests passed!\n');
} catch (error) {
    console.log('\n❌ Integration tests failed!\n');
    allPassed = false;
}

// Final summary
console.log('='.repeat(60));
console.log('\n📊 Test Summary\n');

if (allPassed) {
    console.log('✅ All tests passed successfully!');
    console.log('\n🎉 Application is ready for deployment!\n');
    process.exit(0);
} else {
    console.log('❌ Some tests failed!');
    console.log('\n⚠️  Please fix the issues before deploying.\n');
    process.exit(1);
}
