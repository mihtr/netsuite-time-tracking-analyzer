#!/usr/bin/env node

/**
 * HTML Validation Script
 * Validates the structure and integrity of index.html
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating HTML structure...\n');

let passed = 0;
let failed = 0;

function test(name, condition, errorMsg) {
    if (condition) {
        console.log(`✓ ${name}`);
        passed++;
    } else {
        console.log(`✗ ${name}`);
        if (errorMsg) console.log(`  Error: ${errorMsg}`);
        failed++;
    }
}

try {
    // Read index.html
    const htmlPath = path.join(__dirname, '..', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    // Test 1: File exists and is not empty
    test('HTML file exists and is not empty', html.length > 0);

    // Test 2: Has DOCTYPE
    test('Has DOCTYPE declaration', /<!DOCTYPE html>/i.test(html));

    // Test 3: Has html, head, and body tags
    test('Has <html> tag', /<html/i.test(html));
    test('Has <head> tag', /<head>/i.test(html));
    test('Has <body> tag', /<body>/i.test(html));

    // Test 4: Has required meta tags
    test('Has charset meta tag', /<meta charset/i.test(html));
    test('Has viewport meta tag', /<meta name="viewport"/i.test(html));

    // Test 5: Has title
    test('Has <title> tag', /<title>.*NetSuite.*<\/title>/i.test(html));

    // Test 6: Links to app.js
    test('Links to app.js', /<script.*src=["']app\.js["']/i.test(html));

    // Test 7: Has required UI elements
    test('Has file upload section', /id=["']fileUploadSection["']/i.test(html));
    test('Has date filters', /id=["']dateFrom["']/i.test(html) && /id=["']dateTo["']/i.test(html));
    test('Has product filter', /id=["']productFilter["']/i.test(html));
    test('Has project type filter', /id=["']projectTypeFilter["']/i.test(html));

    // Test 8: Has view containers
    test('Has detail view container', /id=["']detailView["']/i.test(html));
    test('Has monthly view container', /id=["']monthlyView["']/i.test(html));

    // Test 9: Has tables
    test('Has data table', /id=["']dataTable["']/i.test(html));
    test('Has monthly tables container', /id=["']monthlyTablesContainer["']/i.test(html));

    // Test 10: Has statistics sections
    test('Has detail stats', /id=["']stats["']/i.test(html));
    test('Has monthly stats', /id=["']statsMonthly["']/i.test(html));

    // Test 11: Has buttons
    test('Has reset filters button', /onclick=["']resetFilters\(\)["']/i.test(html));
    test('Has clear cache button', /onclick=["']clearCache\(\)/i.test(html));

    // Test 12: Has tab navigation
    test('Has tab navigation', /class=["']tabs["']/i.test(html));
    test('Has switchView function calls', /onclick=["']switchView\(/i.test(html));

    // Test 13: Version number present
    const versionMatch = html.match(/v(\d+\.\d+\.\d+)/);
    test('Has version number', versionMatch !== null, 'Version number not found');
    if (versionMatch) {
        console.log(`  Current version: ${versionMatch[0]}`);
    }

    // Test 14: Has Flatpickr library
    test('Includes Flatpickr CSS', /flatpickr.*\.css/i.test(html));
    test('Includes Flatpickr JS', /flatpickr.*\.js/i.test(html));

    // Test 15: Closed tags check (basic)
    const openDivs = (html.match(/<div/gi) || []).length;
    const closeDivs = (html.match(/<\/div>/gi) || []).length;
    test('Balanced <div> tags', openDivs === closeDivs,
        `Open: ${openDivs}, Close: ${closeDivs}`);

    console.log(`\n${'='.repeat(50)}`);
    console.log(`Tests passed: ${passed}`);
    console.log(`Tests failed: ${failed}`);
    console.log(`Total tests: ${passed + failed}`);
    console.log(`${'='.repeat(50)}\n`);

    if (failed > 0) {
        console.log('❌ HTML validation failed!');
        process.exit(1);
    } else {
        console.log('✅ HTML validation passed!');
        process.exit(0);
    }

} catch (error) {
    console.error('❌ Error during validation:', error.message);
    process.exit(1);
}
