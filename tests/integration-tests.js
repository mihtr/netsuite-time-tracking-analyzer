#!/usr/bin/env node

/**
 * Integration Tests for NetSuite Time Tracking Analyzer
 * Tests how different components work together
 */

const fs = require('fs');
const path = require('path');

console.log('🔗 Running Integration Tests...\n');

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

// Read files
const htmlPath = path.join(__dirname, '..', 'index.html');
const appJsPath = path.join(__dirname, '..', 'app.js');
const readmePath = path.join(__dirname, '..', 'README.md');
const todoPath = path.join(__dirname, '..', 'TODO.md');

const html = fs.readFileSync(htmlPath, 'utf8');
const appJs = fs.readFileSync(appJsPath, 'utf8');
const readme = fs.readFileSync(readmePath, 'utf8');
const todo = fs.readFileSync(todoPath, 'utf8');

console.log('Testing HTML and JavaScript integration...\n');

// Test 1: HTML elements match JavaScript selectors
test('HTML has element for dateFrom filter referenced in JS', () => {
    assert(html.includes('id="dateFrom"'), 'dateFrom element not in HTML');
    assert(appJs.includes('getElementById(\'dateFrom\')'), 'dateFrom not referenced in JS');
});

test('HTML has element for dateTo filter referenced in JS', () => {
    assert(html.includes('id="dateTo"'), 'dateTo element not in HTML');
    assert(appJs.includes('getElementById(\'dateTo\')'), 'dateTo not referenced in JS');
});

test('HTML has productFilter referenced in JS', () => {
    assert(html.includes('id="productFilter"'), 'productFilter not in HTML');
    assert(appJs.includes('getElementById(\'productFilter\')'), 'productFilter not in JS');
});

test('HTML has projectTypeFilter referenced in JS', () => {
    assert(html.includes('id="projectTypeFilter"'), 'projectTypeFilter not in HTML');
    assert(appJs.includes('getElementById(\'projectTypeFilter\')'), 'projectTypeFilter not in JS');
});

test('HTML has dataTable referenced in JS', () => {
    assert(html.includes('id="dataTable"'), 'dataTable not in HTML');
    assert(appJs.includes('getElementById(\'dataTable\')'), 'dataTable not in JS');
});

test('HTML has stats section referenced in JS', () => {
    assert(html.includes('id="stats"'), 'stats not in HTML');
    assert(appJs.includes('getElementById(\'stats\')'), 'stats not in JS');
});

test('HTML has monthlyTablesContainer referenced in JS', () => {
    assert(html.includes('id="monthlyTablesContainer"'), 'monthlyTablesContainer not in HTML');
    assert(appJs.includes('getElementById(\'monthlyTablesContainer\')'),
        'monthlyTablesContainer not in JS');
});

// Test 2: Function calls match function definitions
console.log('\nTesting function call integrity...\n');

test('resetFilters called in HTML and defined in JS', () => {
    assert(html.includes('resetFilters()'), 'resetFilters() not called in HTML');
    assert(appJs.includes('function resetFilters'), 'resetFilters not defined in JS');
});

test('clearCache called in HTML and defined in JS', () => {
    assert(html.includes('clearCache()'), 'clearCache() not called in HTML');
    assert(appJs.includes('function clearCache'), 'clearCache not defined in JS');
});

test('switchView called in HTML and defined in JS', () => {
    assert(html.includes('switchView('), 'switchView not called in HTML');
    assert(appJs.includes('function switchView'), 'switchView not defined in JS');
});

// Test 3: View switching integration
console.log('\nTesting view switching integration...\n');

test('Detail view container exists with correct ID', () => {
    assert(html.includes('id="detailView"'), 'detailView container not found');
    assert(appJs.includes('detailView'), 'detailView not referenced in JS');
});

test('Monthly view container exists with correct ID', () => {
    assert(html.includes('id="monthlyView"'), 'monthlyView container not found');
    assert(appJs.includes('monthlyView'), 'monthlyView not referenced in JS');
});

test('Tab navigation has both view options', () => {
    assert(html.includes('switchView(\'detail\')'), 'Detail view switch not found');
    assert(html.includes('switchView(\'monthly\')'), 'Monthly view switch not found');
});

// Test 4: Cache integration
console.log('\nTesting cache integration...\n');

test('Cache functions called after data loading', () => {
    assert(appJs.includes('saveToCache(rawData)'), 'saveToCache not called after loading');
    assert(appJs.includes('loadFromCache()'), 'loadFromCache not called on startup');
});

test('Cache clear button triggers both clearCache and reload', () => {
    assert(html.match(/clearCache\(\).*location\.reload\(\)/),
        'Clear cache button doesn\'t reload page');
});

// Test 5: Filter integration
console.log('\nTesting filter integration...\n');

test('Filters are multi-select in HTML', () => {
    const productFilterMatch = html.match(/<select[^>]*id="productFilter"[^>]*>/);
    const projectTypeFilterMatch = html.match(/<select[^>]*id="projectTypeFilter"[^>]*>/);
    assert(productFilterMatch && productFilterMatch[0].includes('multiple'),
        'productFilter not multi-select');
    assert(projectTypeFilterMatch && projectTypeFilterMatch[0].includes('multiple'),
        'projectTypeFilter not multi-select');
});

test('Filter auto-apply setup exists', () => {
    assert(appJs.includes('setupAutoFilterOnLeave'), 'Auto-apply setup not found');
    assert(appJs.includes('DOMContentLoaded'), 'Auto-apply not called on page load');
});

test('populateFilters called after data load', () => {
    const loadFunctionMatch = appJs.match(/function loadCSVFromFile[\s\S]*?^}/m);
    assert(loadFunctionMatch && loadFunctionMatch[0].includes('populateFilters'),
        'populateFilters not called after CSV load');
});

// Test 6: Sorting integration
console.log('\nTesting sorting integration...\n');

test('Sorting setup called on page load', () => {
    assert(appJs.includes('setupSorting()'), 'setupSorting not called');
    assert(appJs.includes('setupMonthlySorting()'), 'setupMonthlySorting not called');
});

test('Sort state variables initialized', () => {
    assert(appJs.includes('let currentSort ='), 'currentSort not initialized');
    assert(appJs.includes('let monthlySortState ='), 'monthlySortState not initialized');
});

test('Monthly sorting event listeners setup after display', () => {
    const displayMonthlyMatch = appJs.match(/function displayMonthlyData[\s\S]*?^}/m);
    assert(displayMonthlyMatch &&
           displayMonthlyMatch[0].includes('setupMonthlySortingEventListeners'),
           'setupMonthlySortingEventListeners not called in displayMonthlyData');
});

// Test 7: Documentation integration
console.log('\nTesting documentation consistency...\n');

test('Version numbers match across files', () => {
    const htmlVersion = html.match(/v(\d+\.\d+\.\d+)/);
    const todoVersion = todo.match(/Current Version.*v(\d+\.\d+\.\d+)/);
    const packageJson = JSON.parse(fs.readFileSync(
        path.join(__dirname, '..', 'package.json'), 'utf8'));

    assert(htmlVersion && todoVersion,
        'Version numbers not found in HTML or TODO');
    assert(htmlVersion[1] === todoVersion[1],
        `Version mismatch: HTML=${htmlVersion[1]}, TODO=${todoVersion[1]}`);
    assert(htmlVersion[1] === packageJson.version,
        `Version mismatch: HTML=${htmlVersion[1]}, package.json=${packageJson.version}`);
});

test('README mentions caching feature', () => {
    assert(readme.includes('cache') || readme.includes('Cache'),
        'Cache feature not documented in README');
});

test('README mentions sorting feature', () => {
    assert(readme.includes('sort') || readme.includes('Sort'),
        'Sorting feature not documented in README');
});

test('README mentions monthly view', () => {
    assert(readme.includes('Monthly') || readme.includes('Pivot'),
        'Monthly view not documented in README');
});

// Test 8: Statistics integration
console.log('\nTesting statistics integration...\n');

test('Statistics elements exist for both views', () => {
    assert(html.includes('id="totalRecords"'), 'totalRecords stat not in HTML');
    assert(html.includes('id="totalHours"'), 'totalHours stat not in HTML');
    assert(html.includes('id="statsMonthly"'), 'Monthly stats section not in HTML');
});

test('updateStats and updateMonthlyStats functions exist', () => {
    assert(appJs.includes('function updateStats'), 'updateStats not defined');
    assert(appJs.includes('function updateMonthlyStats'), 'updateMonthlyStats not defined');
});

// Test 9: Error handling integration
console.log('\nTesting error handling integration...\n');

test('showError function exists and is called', () => {
    assert(appJs.includes('function showError'), 'showError function not found');
    assert(appJs.match(/catch.*showError/s), 'showError not called in catch blocks');
});

test('showSuccess function exists and is called', () => {
    assert(appJs.includes('function showSuccess'), 'showSuccess function not found');
    assert(appJs.includes('showSuccess('), 'showSuccess never called');
});

// Test 10: Data flow integration
console.log('\nTesting data flow...\n');

test('Data flows from raw to filtered to aggregated', () => {
    assert(appJs.includes('rawData'), 'rawData variable not found');
    assert(appJs.includes('filteredData'), 'filteredData variable not found');
    assert(appJs.includes('aggregatedData'), 'aggregatedData variable not found');
    assert(appJs.includes('applyFilters'), 'applyFilters not found');
    assert(appJs.includes('aggregateData'), 'aggregateData not found');
});

test('Display functions called after aggregation', () => {
    const applyFiltersMatch = appJs.match(/function applyFilters[\s\S]*?^}/m);
    assert(applyFiltersMatch && applyFiltersMatch[0].includes('displayData'),
        'displayData not called after filtering');
});

// Test anomaly detection integration
console.log('\nTesting anomaly detection integration...\n');

test('Anomaly detection integrated with insights', () => {
    assert(appJs.includes('anomalies: detectAnomalies(data)'),
        'Anomalies not integrated with calculateInsights');
});

test('Data quality section navigation button exists', () => {
    assert(appJs.includes('section-data-quality'),
        'Data quality section navigation not found');
});

test('Data quality HTML builder called', () => {
    assert(appJs.includes('buildDataQualityHTML(insights.anomalies)'),
        'buildDataQualityHTML not called in render function');
});

test('Anomaly badge shows when issues detected', () => {
    assert(appJs.includes('insights.anomalies.total > 0'),
        'Anomaly badge conditional not found');
});

test('All six anomaly types detected', () => {
    assert(appJs.includes('detectWeekendEntries') &&
           appJs.includes('detectTimeGaps') &&
           appJs.includes('detectDuplicateEntries') &&
           appJs.includes('detectUnusualDescriptions') &&
           appJs.includes('detectInactiveProjects') &&
           appJs.includes('detectHourSpikes'),
        'Not all anomaly detection functions are called');
});

test('Anomaly results structure correct', () => {
    assert(appJs.includes('total:') && appJs.includes('byType:') && appJs.includes('details:'),
        'Anomaly results structure incomplete');
});

test('Anomaly table shows severity badges', () => {
    assert(appJs.includes('anomaly.severity') && appJs.includes('severityColor'),
        'Severity badges not implemented in anomaly table');
});

test('Recommendations shown for detected anomalies', () => {
    assert(appJs.includes('Recommendations') && appJs.includes('anomalies.byType'),
        'Context-specific recommendations not found');
});

test('Clean data confirmation displayed', () => {
    assert(appJs.includes('No data quality issues detected'),
        'Clean data confirmation message not found');
});

test('Anomaly count limited for performance', () => {
    assert(appJs.includes('.slice(0, 100)'),
        'Anomaly count limiting not implemented');
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
    console.log('\n❌ Integration tests failed!');
    process.exit(1);
} else {
    console.log('✅ All integration tests passed!');
    process.exit(0);
}
