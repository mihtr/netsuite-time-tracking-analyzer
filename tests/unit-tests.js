#!/usr/bin/env node

/**
 * Unit Tests for NetSuite Time Tracking Analyzer
 * Tests individual JavaScript functions
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Running Unit Tests...\n');

let passed = 0;
let failed = 0;
const failedTests = [];

function test(name, testFunction) {
    try {
        testFunction();
        console.log(`✓ ${name}`);
        passed++;
    } catch (error) {
        console.log(`✗ ${name}`);
        console.log(`  Error: ${error.message}`);
        failed++;
        failedTests.push({ name, error: error.message });
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

// Read app.js to test for function existence
const appJsPath = path.join(__dirname, '..', 'app.js');
const appJs = fs.readFileSync(appJsPath, 'utf8');

console.log('Testing function existence...\n');

// Test 1: Core functions exist
test('loadCSVFromFile function exists', () => {
    assert(appJs.includes('function loadCSVFromFile'), 'loadCSVFromFile not found');
});

test('loadCSVFromURL function exists', () => {
    assert(appJs.includes('function loadCSVFromURL'), 'loadCSVFromURL not found');
});

test('parseCSV function exists', () => {
    assert(appJs.includes('function parseCSV'), 'parseCSV not found');
});

test('applyFilters function exists', () => {
    assert(appJs.includes('function applyFilters'), 'applyFilters not found');
});

test('aggregateData function exists', () => {
    assert(appJs.includes('function aggregateData'), 'aggregateData not found');
});

test('displayData function exists', () => {
    assert(appJs.includes('function displayData'), 'displayData not found');
});

// Test 2: Monthly view functions exist
test('aggregateMonthlyData function exists', () => {
    assert(appJs.includes('function aggregateMonthlyData'), 'aggregateMonthlyData not found');
});

test('displayMonthlyData function exists', () => {
    assert(appJs.includes('function displayMonthlyData'), 'displayMonthlyData not found');
});

test('setupMonthlySortingEventListeners function exists', () => {
    assert(appJs.includes('function setupMonthlySortingEventListeners'),
        'setupMonthlySortingEventListeners not found');
});

// Test 3: Cache functions exist
test('saveToCache function exists', () => {
    assert(appJs.includes('function saveToCache'), 'saveToCache not found');
});

test('loadFromCache function exists', () => {
    assert(appJs.includes('function loadFromCache'), 'loadFromCache not found');
});

test('clearCache function exists', () => {
    assert(appJs.includes('function clearCache'), 'clearCache not found');
});

// Test 4: Sorting functions exist
test('setupSorting function exists', () => {
    assert(appJs.includes('function setupSorting'), 'setupSorting not found');
});

// Test 5: Filter functions exist
test('populateFilters function exists', () => {
    assert(appJs.includes('function populateFilters'), 'populateFilters not found');
});

test('resetFilters function exists', () => {
    assert(appJs.includes('function resetFilters'), 'resetFilters not found');
});

// Test 6: Utility functions exist
test('parseDate function exists', () => {
    assert(appJs.includes('function parseDate'), 'parseDate not found');
});

test('parseDecimal function exists', () => {
    assert(appJs.includes('function parseDecimal'), 'parseDecimal not found');
});

test('formatNumber function exists', () => {
    assert(appJs.includes('function formatNumber'), 'formatNumber not found');
});

test('escapeHtml function exists', () => {
    assert(appJs.includes('function escapeHtml'), 'escapeHtml not found');
});

// Test 7: Global variables exist
console.log('\nTesting global variables...\n');

test('rawData variable declared', () => {
    assert(appJs.includes('let rawData = []'), 'rawData variable not found');
});

test('filteredData variable declared', () => {
    assert(appJs.includes('let filteredData = []'), 'filteredData variable not found');
});

test('aggregatedData variable declared', () => {
    assert(appJs.includes('let aggregatedData = []'), 'aggregatedData variable not found');
});

test('monthlyAggregatedData variable declared', () => {
    assert(appJs.includes('let monthlyAggregatedData = []'),
        'monthlyAggregatedData variable not found');
});

test('currentSort variable declared', () => {
    assert(appJs.includes('let currentSort ='), 'currentSort variable not found');
});

test('monthlySortState variable declared', () => {
    assert(appJs.includes('let monthlySortState ='), 'monthlySortState variable not found');
});

// Test 8: Column indices defined
console.log('\nTesting column configuration...\n');

test('COLUMNS constant defined', () => {
    assert(appJs.includes('const COLUMNS ='), 'COLUMNS constant not found');
});

test('COLUMNS has MAIN_PRODUCT', () => {
    assert(appJs.includes('MAIN_PRODUCT:'), 'MAIN_PRODUCT not in COLUMNS');
});

test('COLUMNS has CUSTOMER_PROJECT', () => {
    assert(appJs.includes('CUSTOMER_PROJECT:'), 'CUSTOMER_PROJECT not in COLUMNS');
});

test('COLUMNS has DUR_DEC', () => {
    assert(appJs.includes('DUR_DEC:'), 'DUR_DEC not in COLUMNS');
});

test('COLUMNS has DATE', () => {
    assert(appJs.includes('DATE:'), 'DATE not in COLUMNS');
});

test('COLUMNS has PROJECT_TYPE', () => {
    assert(appJs.includes('PROJECT_TYPE:'), 'PROJECT_TYPE not in COLUMNS');
});

// Test 9: Error handling present
console.log('\nTesting error handling...\n');

test('applyFilters has try-catch', () => {
    const applyFiltersMatch = appJs.match(/function applyFilters\(\)[\s\S]*?^}/m);
    assert(applyFiltersMatch && applyFiltersMatch[0].includes('try') &&
           applyFiltersMatch[0].includes('catch'),
           'applyFilters missing try-catch block');
});

test('Cache functions have error handling', () => {
    const saveToCacheMatch = appJs.match(/function saveToCache[\s\S]*?^}/m);
    assert(saveToCacheMatch && saveToCacheMatch[0].includes('catch'),
           'saveToCache missing error handling');
});

// Test 10: Event listeners setup
console.log('\nTesting event listener setup...\n');

test('DOMContentLoaded event listener exists', () => {
    assert(appJs.includes('DOMContentLoaded'), 'DOMContentLoaded listener not found');
});

test('File upload event listener setup exists', () => {
    assert(appJs.includes('setupFileUpload'), 'setupFileUpload not called');
});

test('Auto-filter setup exists', () => {
    assert(appJs.includes('setupAutoFilterOnLeave'), 'setupAutoFilterOnLeave not called');
});

// Test 11: Cache expiration logic
console.log('\nTesting cache logic...\n');

test('Cache has expiration check', () => {
    assert(appJs.includes('maxAge') && appJs.includes('cacheAge'),
        'Cache expiration logic not found');
});

test('Cache expiration set to 7 days', () => {
    assert(appJs.includes('7 * 24 * 60 * 60 * 1000'),
        '7 day cache expiration not found');
});

// Test 12: Sorting implementation
console.log('\nTesting sorting implementation...\n');

test('Sort indicators used', () => {
    assert(appJs.includes('sort-asc') && appJs.includes('sort-desc'),
        'Sort indicators not found');
});

test('Monthly view has sortable class', () => {
    assert(appJs.includes("className = 'row-header sortable'") ||
           appJs.includes('class="row-header sortable"'),
           'Sortable class not applied to monthly headers');
});

// Results summary
console.log(`\n${'='.repeat(50)}`);
console.log(`Tests passed: ${passed}`);
console.log(`Tests failed: ${failed}`);
console.log(`Total tests: ${passed + failed}`);
console.log(`${'='.repeat(50)}\n`);

if (failed > 0) {
    console.log('Failed tests:');
    failedTests.forEach(({ name, error }) => {
        console.log(`  - ${name}: ${error}`);
    });
    console.log('\n❌ Unit tests failed!');
    process.exit(1);
} else {
    console.log('✅ All unit tests passed!');
    process.exit(0);
}
