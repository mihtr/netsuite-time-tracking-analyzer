// Global variables
let rawData = [];
let filteredData = [];
let aggregatedData = [];
let monthlyAggregatedData = [];
let monthlyDisplayedRows = 500; // Initial number of rows to display
let kenPBI1AggregatedData = [];
let employeeAggregatedData = [];
let currentView = 'detail';
let currentSort = {
    column: 'totalHours',
    direction: 'desc'
};
let monthlySortState = {
    column: 'year',
    direction: 'desc'
};
let pivotBuilderSortState = {
    column: null,
    direction: 'desc'
};
let pivotDrilldownData = new Map(); // Store detail records for drill-down
let drilldownRecords = []; // Current drilldown records for sorting/export
let drilldownSortState = { column: null, direction: 'asc' };
let importStats = {
    totalLines: 0,
    headerSkipped: 0,
    emptyLines: 0,
    invalidLines: 0,
    imported: 0,
    rejected: 0,
    errorLog: [], // Array of error objects: {line, type, message, columnCount}
    timestamp: null,
    fileName: null
};
let currentFileName = 'Unknown'; // Track current file name for import stats

// Virtual scrolling state
let virtualScroll = {
    rowHeight: 40, // Approximate row height in pixels
    visibleRows: 20, // Number of rows visible in viewport
    startIndex: 0,
    endIndex: 20,
    scrollTop: 0
};

// Search state
let searchTerm = '';
let aggregatedDataBeforeSearch = [];

// Settings state
let appSettings = {
    darkMode: null, // null = follow system, true = force dark, false = force light
    decimalSeparator: 'comma', // 'period' or 'comma'
    normHoursPerWeek: { // Norm hours per week by subsidiary
        'EGDK': 37,
        'EGXX': 37,
        'ZASE': 37,
        'EGPL': 40,
        'EGSU': 40,
        'Other': 37
    }
};

// CSV Column indices (0-based, subtract 1 from FIELD_CATALOG.md numbers)
const COLUMNS = {
    MAIN_PRODUCT: 31,           // EG - Main Product (Project Task Time Tracking) - Field #32
    CUSTOMER_PROJECT: 2,        // Customer:Project - Field #3
    NAME: 1,                    // Name - Field #2
    MTYPE2: 43,                 // MTYPE2 - Field #44
    TASK: 22,                   // Task - Field #23
    DUR_DEC: 18,                // dur_dec - Field #19
    DATE: 19,                   // Date - Field #20
    PROJECT_TYPE: 4,            // Project Type - Field #5
    DEPARTMENT: 15,             // Department - Field #16
    EMPLOYEE: 26,               // Employee - Field #27
    FULL_NAME: 50,              // Full Name - Field #51
    BILLABLE: 8,                // Billable - Field #9
    SUBSIDIARY: 47,             // Subsidiary - Field #48
    ACTIVITY_CODE: 16,          // EG - Activity Code - Field #17
    MANAGER: 41,                // MManager - Field #42
    TEAM: 42,                   // Mteam - Field #43
    SUPERVISOR: 51,             // Supervisor - Field #52
    JOB_GROUP: 58               // EG - Job Group - Field #59
};

// Auto-load CSV file on page load
window.addEventListener('DOMContentLoaded', async function() {
    // Initialize settings first
    initializeSettings();

    // Check if cached data exists (IndexedDB is async)
    const cachedData = await loadFromCache();
    if (cachedData) {
        rawData = cachedData;
        document.getElementById('fileName').textContent = 'Loaded from IndexedDB cache';
        document.getElementById('fileUploadSection').style.display = 'none';
        populateFilters();
        updatePresetDropdown();

        // Try to load "default" preset, otherwise apply filters normally
        const presets = getFilterPresets();
        if (presets['default']) {
            loadDefaultPreset();
        } else {
            applyFilters();
        }

        showSuccess('Data loaded from IndexedDB cache (' + rawData.length.toLocaleString() + ' rows)');
    } else {
        loadCSVFromURL();
    }

    setupFileUpload();
    setupSorting();
    setupMonthlySorting();
    setupDateFormatting();
    setupAutoFilterOnLeave();
    setupSearch();
});

// Setup file upload as fallback
function setupFileUpload() {
    document.getElementById('csvFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('fileName').textContent = file.name;
            loadCSVFromFile(file);
        }
    });
}

// Switch between views
async function switchView(viewName) {
    currentView = viewName;

    // Update tabs
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');

    // Update views
    document.querySelectorAll('.view-container').forEach(view => view.classList.remove('active'));

    if (viewName === 'detail') {
        document.getElementById('detailView').classList.add('active');
    } else if (viewName === 'monthly') {
        document.getElementById('monthlyView').classList.add('active');
        monthlyDisplayedRows = 500; // Reset to initial limit
        await aggregateMonthlyData();
        displayMonthlyData();
        updateMonthlyStats();
    } else if (viewName === 'kenpbi1') {
        document.getElementById('kenpbi1View').classList.add('active');
        await aggregateKenPBI1Data();
        displayKenPBI1Data();
        updateKenPBI1Stats();
    } else if (viewName === 'pivotbuilder') {
        document.getElementById('pivotbuilderView').classList.add('active');
        initializePivotBuilder();
    } else if (viewName === 'employees') {
        document.getElementById('employeesView').classList.add('active');
        await aggregateEmployeeData();
        populateEmployeeFilter();
        displayEmployeeData();
        updateEmployeeStats();
        createEmployeeTrendChart();
    } else if (viewName === 'charts') {
        document.getElementById('chartsView').classList.add('active');
        updateCharts();
    } else if (viewName === 'compare') {
        document.getElementById('compareView').classList.add('active');
        updateComparePeriods();
    } else if (viewName === 'insights') {
        document.getElementById('insightsView').classList.add('active');
        updateInsightsStats();
        updateTimeDistribution();
        updateAdditionalAnalytics();
        updateSuggestedImprovements();
    } else if (viewName === 'recommendations') {
        document.getElementById('recommendationsView').classList.add('active');
        await displayRecommendations();
    }
}

// Scroll to top function
function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Setup column sorting for detail view
function setupSorting() {
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            const column = this.dataset.column;
            const type = this.dataset.type;

            // Toggle sort direction
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = type === 'number' ? 'desc' : 'asc';
            }

            // Update UI
            document.querySelectorAll('th.sortable').forEach(h => {
                h.classList.remove('sort-asc', 'sort-desc');
            });
            this.classList.add(currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');

            // Re-sort and display
            sortAndDisplayData();
        });
    });
}

// Setup date input formatting with date picker
function setupDateFormatting() {
    // Initialize Flatpickr date pickers
    flatpickr('#dateFrom', {
        dateFormat: 'd/m/Y',
        allowInput: true,
        locale: {
            firstDayOfWeek: 1
        },
        onChange: function() {
            applyFilters();
        }
    });

    flatpickr('#dateTo', {
        dateFormat: 'd/m/Y',
        allowInput: true,
        locale: {
            firstDayOfWeek: 1
        },
        onChange: function() {
            applyFilters();
        }
    });
}

// Date validation functions
function validateDateFormat(dateString) {
    if (!dateString || dateString.trim() === '') {
        return { valid: true, message: '' }; // Empty is valid
    }

    // Check format DD/MM/YYYY or DD.MM.YYYY
    const dateRegex = /^(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})$/;
    const match = dateString.match(dateRegex);

    if (!match) {
        return { valid: false, message: 'Invalid format. Use DD/MM/YYYY' };
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    // Check valid ranges
    if (month < 1 || month > 12) {
        return { valid: false, message: 'Invalid month (1-12)' };
    }

    if (day < 1 || day > 31) {
        return { valid: false, message: 'Invalid day (1-31)' };
    }

    if (year < 1900 || year > 2100) {
        return { valid: false, message: 'Invalid year (1900-2100)' };
    }

    // Check if date is valid (e.g., not Feb 31)
    const testDate = new Date(year, month - 1, day);
    if (testDate.getMonth() !== month - 1 || testDate.getDate() !== day) {
        return { valid: false, message: 'Invalid date (e.g., Feb 31)' };
    }

    return { valid: true, message: '' };
}

function validateDateInput(inputId, errorId) {
    const input = document.getElementById(inputId);
    const errorDiv = document.getElementById(errorId);
    const value = input.value.trim();

    const result = validateDateFormat(value);

    if (!result.valid) {
        input.classList.add('invalid-date');
        input.classList.remove('valid-date');
        errorDiv.textContent = result.message;
        errorDiv.classList.add('show');
        return false;
    } else {
        input.classList.remove('invalid-date');
        if (value !== '') {
            input.classList.add('valid-date');
        } else {
            input.classList.remove('valid-date');
        }
        errorDiv.classList.remove('show');
        return true;
    }
}

function validateAllDates() {
    const dateFromValid = validateDateInput('dateFrom', 'dateFromError');
    const dateToValid = validateDateInput('dateTo', 'dateToError');
    return dateFromValid && dateToValid;
}

// Setup auto-apply filter on field leave
function setupAutoFilterOnLeave() {
    // Apply filters when date inputs lose focus
    document.getElementById('dateFrom').addEventListener('blur', function() {
        validateDateInput('dateFrom', 'dateFromError');
        if (rawData.length > 0 && validateAllDates()) {
            applyFilters();
        }
    });

    document.getElementById('dateTo').addEventListener('blur', function() {
        validateDateInput('dateTo', 'dateToError');
        if (rawData.length > 0 && validateAllDates()) {
            applyFilters();
        }
    });

    // Apply filters when multi-select changes
    document.getElementById('productFilter').addEventListener('change', function() {
        if (rawData.length > 0) {
            applyFilters();
        }
    });

    document.getElementById('projectTypeFilter').addEventListener('change', function() {
        if (rawData.length > 0) {
            applyFilters();
        }
    });

    document.getElementById('departmentFilter').addEventListener('change', function() {
        if (rawData.length > 0) {
            applyFilters();
        }
    });
}

// Setup search functionality
function setupSearch() {
    const searchBox = document.getElementById('searchBox');
    if (!searchBox) return;

    // Add input event listener with debouncing for better performance
    let searchTimeout;
    searchBox.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (aggregatedDataBeforeSearch.length > 0) {
                applySearch();
                displayData();
                updateStats();
            }
        }, 300); // 300ms debounce
    });

    // Also handle Enter key for immediate search
    searchBox.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && aggregatedDataBeforeSearch.length > 0) {
            clearTimeout(searchTimeout);
            applySearch();
            displayData();
            updateStats();
        }
    });
}

// Load CSV file from user upload
function loadCSVFromFile(file) {
    showLoading();
    showProgress('Reading file...');
    currentFileName = file.name; // Store filename for import stats

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const text = e.target.result;
            showProgress('Parsing CSV data...');
            await parseCSV(text, true); // Enable progress tracking
            hideProgress();
            logImportStats(); // Log detailed import statistics
            await saveToCache(rawData); // Cache the parsed data in IndexedDB
            showSuccess(getImportSummary());
            populateFilters();
            updatePresetDropdown();

            // Try to load "default" preset, otherwise apply filters normally
            const presets = getFilterPresets();
            if (presets['default']) {
                loadDefaultPreset();
            } else {
                applyFilters();
            }
        } catch (error) {
            hideProgress();
            showError('Error parsing CSV file: ' + error.message);
            console.error(error);
        }
    };
    reader.onerror = function() {
        hideProgress();
        showError('Error reading file');
    };
    reader.readAsText(file, 'UTF-8');
}

// Load CSV file from the same directory
function loadCSVFromURL() {
    showLoading();
    showProgress('Downloading CSV file...');
    currentFileName = 'MIT Time Tracking Dataset (NewOrg).csv'; // Store filename for import stats

    fetch('MIT Time Tracking Dataset (NewOrg).csv')
        .then(response => {
            if (!response.ok) {
                throw new Error('Could not auto-load CSV file');
            }
            return response.text();
        })
        .then(async text => {
            try {
                showProgress('Parsing CSV data...');
                await parseCSV(text, true); // Enable progress tracking
                hideProgress();
                logImportStats(); // Log detailed import statistics
                await saveToCache(rawData); // Cache the parsed data in IndexedDB
                document.getElementById('fileName').textContent = 'MIT Time Tracking Dataset (NewOrg).csv (auto-loaded)';
                showSuccess(getImportSummary());
                populateFilters();
                updatePresetDropdown();

                // Try to load "default" preset, otherwise apply filters normally
                const presets = getFilterPresets();
                if (presets['default']) {
                    loadDefaultPreset();
                } else {
                    applyFilters();
                }
            } catch (error) {
                hideProgress();
                showError('Error parsing CSV file: ' + error.message);
                console.error(error);
            }
        })
        .catch(error => {
            // Auto-load failed, show file upload option
            hideProgress();
            document.getElementById('fileName').textContent = 'Auto-load failed - please select the CSV file manually';
            document.getElementById('loadingIndicator').style.display = 'none';
            document.getElementById('noData').style.display = 'block';
            document.getElementById('noData').textContent = '⚠️ Please click "Load CSV File" and select "MIT Time Tracking Dataset (NewOrg).csv"';
            console.warn('Auto-load failed (likely CORS restriction):', error.message);
        });
}

// Parse CSV with semicolon delimiter and handle European formatting
// Progress tracking for CSV parsing
function updateProgress(current, total, startTime) {
    const percent = Math.round((current / total) * 100);
    const elapsed = Date.now() - startTime;
    const rate = current / elapsed; // rows per ms
    const remaining = total - current;
    const etaMs = remaining / rate;
    const etaSec = Math.round(etaMs / 1000);

    document.getElementById('progressBar').style.width = percent + '%';
    document.getElementById('progressPercent').textContent = percent + '%';
    document.getElementById('progressRows').textContent = `${current.toLocaleString()} / ${total.toLocaleString()} rows`;

    if (etaSec > 0) {
        const minutes = Math.floor(etaSec / 60);
        const seconds = etaSec % 60;
        if (minutes > 0) {
            document.getElementById('progressETA').textContent = `ETA: ${minutes}m ${seconds}s`;
        } else {
            document.getElementById('progressETA').textContent = `ETA: ${seconds}s`;
        }
    } else {
        document.getElementById('progressETA').textContent = 'Almost done...';
    }
}

function showProgress(status = 'Loading CSV...') {
    document.getElementById('loadingProgress').style.display = 'block';
    document.getElementById('progressStatus').textContent = status;
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('progressPercent').textContent = '0%';
    document.getElementById('progressRows').textContent = '0 / 0 rows';
    document.getElementById('progressETA').textContent = 'Calculating...';
}

function hideProgress() {
    document.getElementById('loadingProgress').style.display = 'none';
}

// Parse CSV with progress tracking and chunked processing
function parseCSV(text, onProgress) {
    return new Promise((resolve, reject) => {
        try {
            // Remove BOM if present
            text = text.replace(/^\uFEFF/, '');

            // Parse CSV rows properly (handles newlines within quoted fields)
            const lines = parseCSVRows(text);
            rawData = [];

            // Reset import statistics
            importStats = {
                totalLines: lines.length,
                headerSkipped: 1,
                emptyLines: 0,
                invalidLines: 0,
                imported: 0,
                rejected: 0,
                errorLog: [],
                timestamp: new Date(),
                fileName: currentFileName || 'Unknown'
            };

            const totalLines = lines.length;
            const chunkSize = 1000; // Process 1000 rows at a time
            let currentLine = 1; // Skip header row
            const startTime = Date.now();

            function processChunk() {
                const endLine = Math.min(currentLine + chunkSize, totalLines);

                for (let i = currentLine; i < endLine; i++) {
                    const line = lines[i].trim();

                    // Track empty lines
                    if (line === '') {
                        importStats.emptyLines++;
                        importStats.rejected++;
                        continue;
                    }

                    const row = parseCSVLine(lines[i]);

                    // Validate row has minimum expected columns
                    if (row.length < 50) {
                        importStats.invalidLines++;
                        importStats.rejected++;

                        // Store error in log (limit to 1000 errors to avoid memory issues)
                        if (importStats.errorLog.length < 1000) {
                            importStats.errorLog.push({
                                line: i + 1,
                                type: 'invalid_columns',
                                message: `Invalid row with only ${row.length} columns (expected 56)`,
                                columnCount: row.length
                            });
                        }

                        console.warn(`Line ${i + 1}: Invalid row with only ${row.length} columns (expected 56)`);
                        continue;
                    }

                    // Successfully imported
                    rawData.push(row);
                    importStats.imported++;
                }

                currentLine = endLine;

                // Update progress
                if (onProgress) {
                    updateProgress(currentLine, totalLines, startTime);
                }

                // Continue processing or finish
                if (currentLine < totalLines) {
                    // Schedule next chunk (use setTimeout to allow UI updates)
                    setTimeout(processChunk, 0);
                } else {
                    resolve(rawData);
                }
            }

            // Start processing
            processChunk();

        } catch (error) {
            reject(error);
        }
    });
}

// Parse a single CSV line with quoted fields (handles semicolons and newlines in quotes)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote (doubled quotes)
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ';' && !inQuotes) {
            // Field separator (semicolon outside quotes)
            result.push(current.trim());
            current = '';
        } else {
            // Regular character (including newlines if inside quotes)
            current += char;
        }
    }

    // Add last field
    result.push(current.trim());

    return result;
}

// Parse CSV text into rows (handles newlines within quoted fields)
function parseCSVRows(text) {
    const rows = [];
    let currentRow = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            currentRow += char;
            if (inQuotes && nextChar === '"') {
                // Escaped quote (doubled quotes)
                currentRow += nextChar;
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
            // End of row (newline outside quotes)
            if (currentRow.trim() !== '') {
                rows.push(currentRow);
            }
            currentRow = '';
            if (char === '\r') i++; // Skip \n in \r\n
        } else if (char !== '\r') {
            // Regular character (skip standalone \r)
            currentRow += char;
        }
    }

    // Add last row if exists
    if (currentRow.trim() !== '') {
        rows.push(currentRow);
    }

    return rows;
}

// Generate import summary message
function getImportSummary() {
    const stats = importStats;
    let message = `Successfully imported ${stats.imported.toLocaleString()} records`;

    if (stats.rejected > 0) {
        message += `\n⚠️ Rejected: ${stats.rejected.toLocaleString()} records`;
        const details = [];
        if (stats.headerSkipped > 0) details.push(`${stats.headerSkipped} header row`);
        if (stats.emptyLines > 0) details.push(`${stats.emptyLines} empty lines`);
        if (stats.invalidLines > 0) details.push(`${stats.invalidLines} invalid rows`);
        if (details.length > 0) {
            message += ` (${details.join(', ')})`;
        }
    }

    return message;
}

// Log detailed import statistics to console
function logImportStats() {
    console.group('📊 Import Statistics');
    console.log(`Total Lines: ${importStats.totalLines.toLocaleString()}`);
    console.log(`✅ Imported: ${importStats.imported.toLocaleString()}`);
    console.log(`❌ Rejected: ${importStats.rejected.toLocaleString()}`);
    if (importStats.rejected > 0) {
        console.group('Rejection Details:');
        if (importStats.headerSkipped > 0) {
            console.log(`  - Header row: ${importStats.headerSkipped}`);
        }
        if (importStats.emptyLines > 0) {
            console.log(`  - Empty lines: ${importStats.emptyLines.toLocaleString()}`);
        }
        if (importStats.invalidLines > 0) {
            console.log(`  - Invalid rows (< 50 columns): ${importStats.invalidLines.toLocaleString()}`);
        }
        console.groupEnd();
    }
    const successRate = ((importStats.imported / (importStats.totalLines - importStats.headerSkipped)) * 100).toFixed(2);
    console.log(`Import Success Rate: ${successRate}%`);
    console.groupEnd();
}

// Populate filter dropdowns
function populateFilters() {
    const products = new Set();
    const projectTypes = new Set();
    const departments = new Set();

    rawData.forEach((row, index) => {
        const product = row[COLUMNS.MAIN_PRODUCT];
        const projectType = row[COLUMNS.PROJECT_TYPE];
        const department = row[COLUMNS.DEPARTMENT];

        if (product) products.add(product);
        if (projectType) projectTypes.add(projectType);
        if (department) departments.add(department);
    });

    // Populate product filter
    const productFilter = document.getElementById('productFilter');
    productFilter.innerHTML = '<option value="">All Products</option>';
    Array.from(products).sort().forEach(product => {
        const option = document.createElement('option');
        option.value = product;
        option.textContent = product;
        productFilter.appendChild(option);
    });

    // Populate project type filter
    const projectTypeFilter = document.getElementById('projectTypeFilter');
    projectTypeFilter.innerHTML = '<option value="">All Project Types</option>';
    Array.from(projectTypes).sort().forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        projectTypeFilter.appendChild(option);
    });

    // Populate department filter
    const departmentFilter = document.getElementById('departmentFilter');
    departmentFilter.innerHTML = '<option value="">All Departments</option>';
    Array.from(departments).sort().forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        departmentFilter.appendChild(option);
    });
}

// Parse European date format (DD.MM.YYYY or DD/MM/YYYY) to Date object
function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split(/[.\/]/);
    if (parts.length !== 3) return null;
    // Month is 0-indexed in JavaScript Date
    return new Date(parts[2], parts[1] - 1, parts[0]);
}

// Parse European decimal format (comma as decimal separator)
function parseDecimal(str) {
    if (!str) return 0;
    // Replace comma with period and remove spaces
    const normalized = str.replace(/\s/g, '').replace(',', '.');
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
}

// Apply filters and aggregate data
function applyFilters() {
    try {
        if (rawData.length === 0) {
            console.log('No data loaded yet');
            return;
        }

        // Validate date inputs before applying filters
        if (!validateAllDates()) {
            console.log('Invalid date format detected. Please correct dates before filtering.');
            return;
        }

        const dateFromStr = document.getElementById('dateFrom').value;
        const dateToStr = document.getElementById('dateTo').value;

        // Get selected values from multi-select dropdowns
        const productFilterElement = document.getElementById('productFilter');
        const selectedProducts = Array.from(productFilterElement.selectedOptions)
            .map(opt => opt.value)
            .filter(val => val !== ''); // Remove "All Products" empty value

        const projectTypeFilterElement = document.getElementById('projectTypeFilter');
        const selectedProjectTypes = Array.from(projectTypeFilterElement.selectedOptions)
            .map(opt => opt.value)
            .filter(val => val !== ''); // Remove "All Project Types" empty value

        const departmentFilterElement = document.getElementById('departmentFilter');
        const selectedDepartments = Array.from(departmentFilterElement.selectedOptions)
            .map(opt => opt.value)
            .filter(val => val !== ''); // Remove "All Departments" empty value

        // Parse filter dates (DD/MM/YYYY format)
        const dateFrom = dateFromStr ? parseDate(dateFromStr) : null;
        const dateTo = dateToStr ? parseDate(dateToStr) : null;

        // Filter data
        filteredData = rawData.filter((row, index) => {

        // Date filter
        if (dateFrom || dateTo) {
            const rowDate = parseDate(row[COLUMNS.DATE]);
            if (!rowDate) return false;

            if (dateFrom) {
                if (rowDate < dateFrom) return false;
            }

            if (dateTo) {
                if (rowDate > dateTo) return false;
            }
        }

        // Product filter (multi-select)
        if (selectedProducts.length > 0) {
            const rowProduct = row[COLUMNS.MAIN_PRODUCT];
            if (!selectedProducts.includes(rowProduct)) {
                return false;
            }
        }

        // Project type filter (multi-select)
        if (selectedProjectTypes.length > 0) {
            const rowProjectType = row[COLUMNS.PROJECT_TYPE];
            if (!selectedProjectTypes.includes(rowProjectType)) {
                return false;
            }
        }

        // Department filter (multi-select)
        if (selectedDepartments.length > 0) {
            const rowDepartment = row[COLUMNS.DEPARTMENT];
            if (!selectedDepartments.includes(rowDepartment)) {
                return false;
            }
        }

        return true;
    });

    // Aggregate data
    aggregateData();

    // Apply search filter to aggregated data
    applySearch();

    // Reset to first page when filters change
    currentPage = 1;

    // Display results
    displayData();
    updateStats();

    // If currently on monthly view, update it as well
    if (currentView === 'monthly') {
        const loadingMonthly = document.getElementById('loadingIndicatorMonthly');
        if (loadingMonthly) loadingMonthly.style.display = 'block';

        // Reset displayed rows when filtering
        monthlyDisplayedRows = 500;

        // Use setTimeout to allow UI to update with loading indicator
        setTimeout(async () => {
            try {
                await aggregateMonthlyData();
                displayMonthlyData();
                updateMonthlyStats();
            } catch (monthlyError) {
                console.error('Error updating monthly view:', monthlyError);
            } finally {
                if (loadingMonthly) loadingMonthly.style.display = 'none';
            }
        }, 10);
    }

    // If currently on insights view, update it as well
    if (currentView === 'insights') {
        updateInsightsStats();
        updateTimeDistribution();
        updateAdditionalAnalytics();
        updateSuggestedImprovements();
    }

    // If currently on Ken.PBI.1 view, update it as well
    if (currentView === 'kenpbi1') {
        const loadingKenPBI1 = document.getElementById('loadingIndicatorKenPBI1');
        if (loadingKenPBI1) loadingKenPBI1.style.display = 'block';

        setTimeout(async () => {
            try {
                await aggregateKenPBI1Data();
                displayKenPBI1Data();
                updateKenPBI1Stats();
            } catch (kenPBI1Error) {
                console.error('Error updating Ken.PBI.1 view:', kenPBI1Error);
            } finally {
                if (loadingKenPBI1) loadingKenPBI1.style.display = 'none';
            }
        }, 10);
    }

    // If currently on employees view, update it as well
    if (currentView === 'employees') {
        const loadingEmployees = document.getElementById('loadingIndicatorEmployees');
        if (loadingEmployees) loadingEmployees.style.display = 'flex';

        setTimeout(async () => {
            try {
                await aggregateEmployeeData();
                populateEmployeeFilter();
                displayEmployeeData();
                updateEmployeeStats();
                createEmployeeTrendChart();
            } catch (employeesError) {
                console.error('Error updating employees view:', employeesError);
            } finally {
                if (loadingEmployees) loadingEmployees.style.display = 'none';
            }
        }, 10);
    }

    } catch (error) {
        console.error('Error applying filters:', error);
        alert('Error applying filters: ' + error.message + '\n\nPlease check the console for details.');
    }
}

// Aggregate data by Main Product, Customer:Project, Name, MTYPE2, and Task
function aggregateData() {
    const aggregationMap = new Map();

    filteredData.forEach(row => {
        const mainProduct = row[COLUMNS.MAIN_PRODUCT] || '(Empty)';
        const customerProject = row[COLUMNS.CUSTOMER_PROJECT] || '(Empty)';
        const name = row[COLUMNS.NAME] || '(Empty)';
        const mtype2 = row[COLUMNS.MTYPE2] || '(Empty)';
        const task = row[COLUMNS.TASK] || '(Empty)';
        const durDec = parseDecimal(row[COLUMNS.DUR_DEC]);

        // Create unique key for aggregation
        const key = `${mainProduct}|${customerProject}|${name}|${mtype2}|${task}`;

        if (aggregationMap.has(key)) {
            aggregationMap.get(key).totalHours += durDec;
        } else {
            aggregationMap.set(key, {
                mainProduct,
                customerProject,
                name,
                mtype2,
                task,
                totalHours: durDec
            });
        }
    });

    // Convert map to array
    aggregatedData = Array.from(aggregationMap.values());

    // Save full aggregated data before search filtering
    aggregatedDataBeforeSearch = [...aggregatedData];

    // Apply current sort
    sortData();
}

// Sort aggregated data
function sortData() {
    const column = currentSort.column;
    const direction = currentSort.direction;

    aggregatedData.sort((a, b) => {
        let aVal = a[column];
        let bVal = b[column];

        // Handle empty values
        if (!aVal) aVal = '';
        if (!bVal) bVal = '';

        // Compare based on type
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return direction === 'asc' ? aVal - bVal : bVal - aVal;
        } else {
            // String comparison
            const comparison = String(aVal).localeCompare(String(bVal));
            return direction === 'asc' ? comparison : -comparison;
        }
    });
}

// Apply search filter to aggregated data
function applySearch() {
    // Get search term from input
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
        searchTerm = searchBox.value.trim().toLowerCase();
    }

    // If no search term, use all aggregated data
    if (!searchTerm) {
        aggregatedData = [...aggregatedDataBeforeSearch];
        return;
    }

    // Filter aggregated data based on search term
    aggregatedData = aggregatedDataBeforeSearch.filter(item => {
        // Search across all visible columns
        const searchableText = [
            item.mainProduct,
            item.customerProject,
            item.name,
            item.mtype2,
            item.task,
            item.totalHours.toString()
        ].join(' ').toLowerCase();

        return searchableText.includes(searchTerm);
    });
}

// Clear search and refresh display
function clearSearch() {
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
        searchBox.value = '';
        searchTerm = '';
    }
    applySearch();
    displayData();
    updateStats();
}

// Sort and display data (called when clicking column headers)
function sortAndDisplayData() {
    sortData();
    displayData();
}

// Display aggregated data in table with virtual scrolling
function displayData() {
    const tableBody = document.getElementById('tableBody');
    const table = document.getElementById('dataTable');
    const tableFooter = document.getElementById('tableFooter');
    const noData = document.getElementById('noData');
    const loading = document.getElementById('loadingIndicator');

    loading.style.display = 'none';

    if (aggregatedData.length === 0) {
        table.style.display = 'none';
        tableFooter.style.display = 'none';
        noData.style.display = 'block';
        noData.textContent = 'No data matches the current filters.';
        return;
    }

    noData.style.display = 'none';
    table.style.display = 'table';
    tableFooter.style.display = 'table-footer-group';

    // Initialize virtual scrolling on first load
    if (!virtualScroll.initialized) {
        setupVirtualScrolling();
    }

    // Calculate visible range
    const totalRows = aggregatedData.length;
    const startIndex = virtualScroll.startIndex;
    const endIndex = Math.min(virtualScroll.endIndex, totalRows);
    const visibleData = aggregatedData.slice(startIndex, endIndex);

    // Clear existing rows
    tableBody.innerHTML = '';

    // Calculate total hours for ALL data
    let totalHours = aggregatedData.reduce((sum, item) => sum + item.totalHours, 0);

    // Create spacer rows for virtual scrolling
    const topSpacerHeight = startIndex * virtualScroll.rowHeight;
    const bottomSpacerHeight = (totalRows - endIndex) * virtualScroll.rowHeight;

    // Add top spacer
    if (topSpacerHeight > 0) {
        const topSpacer = document.createElement('tr');
        topSpacer.style.height = `${topSpacerHeight}px`;
        topSpacer.innerHTML = '<td colspan="6"></td>';
        tableBody.appendChild(topSpacer);
    }

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();

    // Add visible rows only
    visibleData.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(item.mainProduct)}</td>
            <td>${escapeHtml(item.customerProject)}</td>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.mtype2)}</td>
            <td>${escapeHtml(item.task)}</td>
            <td>${formatNumber(item.totalHours)}</td>
        `;
        fragment.appendChild(row);
    });

    // Append visible rows
    tableBody.appendChild(fragment);

    // Add bottom spacer
    if (bottomSpacerHeight > 0) {
        const bottomSpacer = document.createElement('tr');
        bottomSpacer.style.height = `${bottomSpacerHeight}px`;
        bottomSpacer.innerHTML = '<td colspan="6"></td>';
        tableBody.appendChild(bottomSpacer);
    }

    // Update footer total
    document.getElementById('totalHoursFooter').textContent = formatNumber(totalHours);
}

// Virtual scrolling setup
function setupVirtualScrolling() {
    const tableContainer = document.querySelector('.table-container');
    if (!tableContainer) return;

    // Calculate viewport height and visible rows
    const viewportHeight = window.innerHeight - 300; // Subtract header/controls height
    virtualScroll.visibleRows = Math.ceil(viewportHeight / virtualScroll.rowHeight) + 5; // Add buffer
    virtualScroll.endIndex = virtualScroll.visibleRows;
    virtualScroll.initialized = true;

    // Add scroll event listener
    let scrollTimeout;
    window.addEventListener('scroll', function() {
        if (currentView !== 'detail') return;
        if (aggregatedData.length === 0) return;

        // Debounce scroll event
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            handleVirtualScroll();
        }, 16); // ~60fps
    });
}

function handleVirtualScroll() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const tableContainer = document.querySelector('.table-container');
    if (!tableContainer) return;

    const tableTop = tableContainer.offsetTop;
    const relativeScroll = Math.max(0, scrollTop - tableTop);

    // Calculate which rows should be visible
    const startIndex = Math.floor(relativeScroll / virtualScroll.rowHeight);
    const endIndex = startIndex + virtualScroll.visibleRows;

    // Only update if the visible range has changed significantly
    if (Math.abs(startIndex - virtualScroll.startIndex) > 5) {
        virtualScroll.startIndex = Math.max(0, startIndex - 5); // Add buffer above
        virtualScroll.endIndex = endIndex + 5; // Add buffer below
        displayData();
    }
}

// Update statistics
function updateStats() {
    const statsDiv = document.getElementById('stats');

    if (filteredData.length === 0) {
        statsDiv.style.display = 'none';
        return;
    }

    statsDiv.style.display = 'grid';

    // Calculate stats
    const totalRecords = aggregatedData.length;
    const totalHours = aggregatedData.reduce((sum, item) => sum + item.totalHours, 0);
    const uniqueProjects = new Set(filteredData.map(row => row[COLUMNS.CUSTOMER_PROJECT])).size;
    const uniqueProducts = new Set(filteredData.map(row => row[COLUMNS.MAIN_PRODUCT]).filter(p => p)).size;

    document.getElementById('totalRecords').textContent = totalRecords.toLocaleString();
    document.getElementById('totalHours').textContent = formatNumber(totalHours);
    document.getElementById('uniqueProjects').textContent = uniqueProjects.toLocaleString();
    document.getElementById('uniqueProducts').textContent = uniqueProducts.toLocaleString();
}

// Update Insights view statistics
function updateInsightsStats() {
    const statsDiv = document.getElementById('statsInsights');

    if (filteredData.length === 0) {
        statsDiv.style.display = 'none';
        return;
    }

    statsDiv.style.display = 'grid';

    // Calculate stats
    const totalRecords = aggregatedData.length;
    const totalHours = aggregatedData.reduce((sum, item) => sum + item.totalHours, 0);
    const uniqueProjects = new Set(filteredData.map(row => row[COLUMNS.CUSTOMER_PROJECT])).size;
    const uniqueProducts = new Set(filteredData.map(row => row[COLUMNS.MAIN_PRODUCT]).filter(p => p)).size;

    document.getElementById('totalRecordsInsights').textContent = totalRecords.toLocaleString();
    document.getElementById('totalHoursInsights').textContent = formatNumber(totalHours);
    document.getElementById('uniqueProjectsInsights').textContent = uniqueProjects.toLocaleString();
    document.getElementById('uniqueProductsInsights').textContent = uniqueProducts.toLocaleString();
}

// Chart instances (global to allow destruction/recreation)
let timeTrendChartInstance = null;
let billingPieChartInstance = null;
let topProjectsChartInstance = null;
let compareChartInstance = null;

// Update all charts
function updateCharts() {
    if (filteredData.length === 0) {
        return;
    }

    updateTimeTrendChart();
    updateBillingPieChart();
    updateTopProjectsChart();
}

// Time Trend Line Chart
function updateTimeTrendChart() {
    const canvas = document.getElementById('timeTrendChart');
    if (!canvas) return;

    // Destroy existing chart
    if (timeTrendChartInstance) {
        timeTrendChartInstance.destroy();
    }

    // Aggregate hours by date
    const dateMap = new Map();
    filteredData.forEach(row => {
        const dateStr = row[COLUMNS.DATE];
        const rowDate = parseDate(dateStr);
        if (!rowDate) return;

        const dateKey = rowDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const hours = parseDecimal(row[COLUMNS.DUR_DEC]);
        dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + hours);
    });

    // Sort by date
    const sortedDates = Array.from(dateMap.keys()).sort();
    const hours = sortedDates.map(date => dateMap.get(date));

    // Format dates for display (show only first of month or sample if too many points)
    let displayDates = sortedDates;
    let displayHours = hours;
    if (sortedDates.length > 30) {
        // Sample every Nth point to keep chart readable
        const step = Math.ceil(sortedDates.length / 30);
        displayDates = sortedDates.filter((_, i) => i % step === 0);
        displayHours = hours.filter((_, i) => i % step === 0);
    }

    const ctx = canvas.getContext('2d');
    timeTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: displayDates.map(d => {
                const parts = d.split('-');
                return `${parts[2]}/${parts[1]}`; // DD/MM
            }),
            datasets: [{
                label: 'Hours',
                data: displayHours,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Hours'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date (DD/MM)'
                    }
                }
            }
        }
    });
}

// Billing Type Pie Chart
function updateBillingPieChart() {
    const canvas = document.getElementById('billingPieChart');
    if (!canvas) return;

    // Destroy existing chart
    if (billingPieChartInstance) {
        billingPieChartInstance.destroy();
    }

    // Aggregate hours by billing type (MTYPE2)
    const billingMap = new Map();
    filteredData.forEach(row => {
        const billingType = row[COLUMNS.MTYPE2] || 'Unknown';
        const hours = parseDecimal(row[COLUMNS.DUR_DEC]);
        billingMap.set(billingType, (billingMap.get(billingType) || 0) + hours);
    });

    const labels = Array.from(billingMap.keys());
    const data = Array.from(billingMap.values());

    // Color palette
    const colors = [
        'rgba(255, 99, 132, 0.8)',
        'rgba(54, 162, 235, 0.8)',
        'rgba(255, 206, 86, 0.8)',
        'rgba(75, 192, 192, 0.8)',
        'rgba(153, 102, 255, 0.8)',
        'rgba(255, 159, 64, 0.8)',
        'rgba(199, 199, 199, 0.8)'
    ];

    const ctx = canvas.getContext('2d');
    billingPieChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value.toFixed(1)} hrs (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Top Projects Bar Chart
function updateTopProjectsChart() {
    const canvas = document.getElementById('topProjectsChart');
    if (!canvas) return;

    // Destroy existing chart
    if (topProjectsChartInstance) {
        topProjectsChartInstance.destroy();
    }

    // Aggregate hours by project
    const projectMap = new Map();
    filteredData.forEach(row => {
        const project = row[COLUMNS.CUSTOMER_PROJECT] || 'Unknown';
        const hours = parseDecimal(row[COLUMNS.DUR_DEC]);
        projectMap.set(project, (projectMap.get(project) || 0) + hours);
    });

    // Sort and take top 10
    const sortedProjects = Array.from(projectMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    const labels = sortedProjects.map(([project, _]) => {
        // Truncate long project names
        return project.length > 30 ? project.substring(0, 27) + '...' : project;
    });
    const data = sortedProjects.map(([_, hours]) => hours);

    const ctx = canvas.getContext('2d');
    topProjectsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Hours',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.8)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Hours'
                    }
                }
            }
        }
    });
}

// Render Compare Periods Chart
function renderCompareChart(periodMetrics) {
    const canvas = document.getElementById('compareChart');
    const chartSection = document.getElementById('compareChartSection');
    if (!canvas || !chartSection) return;

    // Show chart section
    chartSection.style.display = 'block';

    // Destroy existing chart
    if (compareChartInstance) {
        compareChartInstance.destroy();
    }

    // Prepare labels (period names)
    const labels = periodMetrics.map(pm => `Period ${pm.num}\n${pm.fromStr} - ${pm.toStr}`);

    // Prepare datasets for each metric
    const datasets = [
        {
            label: 'Total Hours',
            data: periodMetrics.map(pm => pm.hours),
            backgroundColor: 'rgba(75, 192, 192, 0.8)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
        },
        {
            label: 'Total Records',
            data: periodMetrics.map(pm => pm.records),
            backgroundColor: 'rgba(54, 162, 235, 0.8)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
        },
        {
            label: 'Active Projects',
            data: periodMetrics.map(pm => pm.projects),
            backgroundColor: 'rgba(255, 206, 86, 0.8)',
            borderColor: 'rgba(255, 206, 86, 1)',
            borderWidth: 1
        },
        {
            label: 'Active Employees',
            data: periodMetrics.map(pm => pm.employees),
            backgroundColor: 'rgba(153, 102, 255, 0.8)',
            borderColor: 'rgba(153, 102, 255, 1)',
            borderWidth: 1
        }
    ];

    const ctx = canvas.getContext('2d');
    compareChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                title: {
                    display: true,
                    text: 'Period Comparison Metrics',
                    font: {
                        size: 16
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Value'
                    }
                }
            }
        }
    });
}

// Update Compare Periods section
function updateComparePeriods() {
    if (filteredData.length === 0) {
        return;
    }

    // Setup date pickers for compare periods (only once)
    const period1From = document.getElementById('comparePeriod1From');
    if (period1From && !period1From.dataset.initialized) {
        flatpickr('#comparePeriod1From', { dateFormat: 'd/m/Y' });
        flatpickr('#comparePeriod1To', { dateFormat: 'd/m/Y' });
        flatpickr('#comparePeriod2From', { dateFormat: 'd/m/Y' });
        flatpickr('#comparePeriod2To', { dateFormat: 'd/m/Y' });
        flatpickr('#comparePeriod3From', { dateFormat: 'd/m/Y' });
        flatpickr('#comparePeriod3To', { dateFormat: 'd/m/Y' });
        flatpickr('#comparePeriod4From', { dateFormat: 'd/m/Y' });
        flatpickr('#comparePeriod4To', { dateFormat: 'd/m/Y' });
        period1From.dataset.initialized = 'true';
    }
}

// Set quick period for date range shortcuts
function setQuickPeriod(periodNum, rangeType) {
    // Get target period from dropdown if periodNum is 1
    if (periodNum === 1) {
        const target = document.getElementById('quickFilterTarget');
        if (target) {
            periodNum = parseInt(target.value);
        }
    }

    const now = new Date();
    let fromDate, toDate;

    switch (rangeType) {
        case 'thisMonth':
            fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
            toDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        case 'lastMonth':
            fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            toDate = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
        case 'thisQuarter':
            const currentQuarter = Math.floor(now.getMonth() / 3);
            fromDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
            toDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
            break;
        case 'lastQuarter':
            const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
            const year = lastQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear();
            const quarter = lastQuarter < 0 ? 3 : lastQuarter;
            fromDate = new Date(year, quarter * 3, 1);
            toDate = new Date(year, (quarter + 1) * 3, 0);
            break;
        case 'thisYear':
            fromDate = new Date(now.getFullYear(), 0, 1);
            toDate = new Date(now.getFullYear(), 11, 31);
            break;
        case 'lastYear':
            fromDate = new Date(now.getFullYear() - 1, 0, 1);
            toDate = new Date(now.getFullYear() - 1, 11, 31);
            break;
        case 'last7Days':
            toDate = new Date(now);
            fromDate = new Date(now);
            fromDate.setDate(now.getDate() - 6);
            break;
        case 'last30Days':
            toDate = new Date(now);
            fromDate = new Date(now);
            fromDate.setDate(now.getDate() - 29);
            break;
        case 'last90Days':
            toDate = new Date(now);
            fromDate = new Date(now);
            fromDate.setDate(now.getDate() - 89);
            break;
        default:
            return;
    }

    // Format dates as DD/MM/YYYY
    const formatDate = (date) => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Set the date inputs
    const fromInput = document.getElementById(`comparePeriod${periodNum}From`);
    const toInput = document.getElementById(`comparePeriod${periodNum}To`);

    if (fromInput && toInput) {
        fromInput.value = formatDate(fromDate);
        toInput.value = formatDate(toDate);
    }
}

// Compare up to 4 periods
function comparePeriods() {
    // Collect period data
    const periods = [];
    for (let i = 1; i <= 4; i++) {
        const fromValue = document.getElementById(`comparePeriod${i}From`).value;
        const toValue = document.getElementById(`comparePeriod${i}To`).value;

        if (fromValue && toValue) {
            const fromDate = parseDate(fromValue);
            const toDate = parseDate(toValue);

            if (!fromDate || !toDate) {
                showError(`Invalid date format in Period ${i}. Please use DD/MM/YYYY`);
                return;
            }

            periods.push({
                num: i,
                fromStr: fromValue,
                toStr: toValue,
                fromDate: fromDate,
                toDate: toDate
            });
        }
    }

    if (periods.length < 2) {
        showError('Please enter at least 2 periods to compare');
        return;
    }

    // Calculate metrics for each period
    const periodMetrics = periods.map(period => {
        const data = filteredData.filter(row => {
            const rowDate = parseDate(row[COLUMNS.DATE]);
            return rowDate && rowDate >= period.fromDate && rowDate <= period.toDate;
        });

        return {
            num: period.num,
            fromStr: period.fromStr,
            toStr: period.toStr,
            hours: data.reduce((sum, row) => sum + parseDecimal(row[COLUMNS.DUR_DEC]), 0),
            records: data.length,
            projects: new Set(data.map(row => row[COLUMNS.CUSTOMER_PROJECT])).size,
            employees: new Set(data.map(row => row[COLUMNS.NAME])).size
        };
    });

    // Build result HTML
    const resultsDiv = document.getElementById('compareResults');
    resultsDiv.style.display = 'block';

    // Build table headers
    let headersHTML = '<th style="padding: 10px; text-align: left; color: #495057;">Metric</th>';
    periodMetrics.forEach(pm => {
        headersHTML += `<th style="padding: 10px; text-align: right; color: #495057;">Period ${pm.num}<br><span style="font-size: 0.8em; font-weight: normal;">${pm.fromStr} - ${pm.toStr}</span></th>`;
    });

    // Build table rows
    const buildRow = (label, getValue) => {
        let rowHTML = `<td style="padding: 10px; font-weight: 500;">${label}</td>`;
        periodMetrics.forEach(pm => {
            rowHTML += `<td style="padding: 10px; text-align: right;">${getValue(pm)}</td>`;
        });
        return `<tr style="border-bottom: 1px solid #dee2e6;">${rowHTML}</tr>`;
    };

    const rows = [
        buildRow('Total Hours', pm => pm.hours.toFixed(1)),
        buildRow('Total Records', pm => pm.records.toLocaleString()),
        buildRow('Active Projects', pm => pm.projects),
        buildRow('Active Employees', pm => pm.employees)
    ];

    resultsDiv.innerHTML = `
        <div style="background: white; padding: 15px; border-radius: 8px; margin-top: 15px;">
            <h3 style="margin-bottom: 15px; color: #495057;">Comparison Results</h3>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; min-width: 600px;">
                    <thead>
                        <tr style="border-bottom: 2px solid #dee2e6;">
                            ${headersHTML}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Render comparison chart
    renderCompareChart(periodMetrics);
}

// Time Distribution Patterns Analytics
function updateTimeDistribution() {
    const insightsDiv = document.getElementById('timeInsights');

    if (!insightsDiv || filteredData.length === 0) {
        if (insightsDiv) insightsDiv.style.display = 'none';
        return;
    }

    insightsDiv.style.display = 'block';

    // Analyze by day of week
    const dayOfWeekData = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Analyze by billing type
    const billingTypeData = {};

    // Analyze by month
    const monthlyData = {};

    filteredData.forEach(row => {
        const dateStr = row[COLUMNS.DATE];
        const hours = parseFloat(row[COLUMNS.DUR_DEC]) || 0;
        const billingType = row[COLUMNS.MTYPE2] || 'Unknown';

        if (dateStr) {
            const date = parseDate(dateStr);
            if (date) {
                // Day of week analysis
                const dayOfWeek = date.getDay();
                const dayName = dayNames[dayOfWeek];
                dayOfWeekData[dayName] = (dayOfWeekData[dayName] || 0) + hours;

                // Monthly analysis
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                monthlyData[monthKey] = (monthlyData[monthKey] || 0) + hours;
            }
        }

        // Billing type analysis
        billingTypeData[billingType] = (billingTypeData[billingType] || 0) + hours;
    });

    // Find peak day of week
    let peakDay = '';
    let peakDayHours = 0;
    Object.entries(dayOfWeekData).forEach(([day, hours]) => {
        if (hours > peakDayHours) {
            peakDay = day;
            peakDayHours = hours;
        }
    });

    // Find top billing type
    let topBillingType = '';
    let topBillingHours = 0;
    Object.entries(billingTypeData).forEach(([type, hours]) => {
        if (hours > topBillingHours) {
            topBillingType = type;
            topBillingHours = hours;
        }
    });

    // Calculate average hours per month
    const monthCount = Object.keys(monthlyData).length;
    const totalHours = Object.values(monthlyData).reduce((sum, h) => sum + h, 0);
    const avgHoursPerMonth = monthCount > 0 ? totalHours / monthCount : 0;

    // Build insights HTML
    let insightsHTML = '<div class="insights-grid">';

    if (peakDay) {
        insightsHTML += `
            <div class="insight-card">
                <div class="insight-icon">📅</div>
                <div class="insight-content">
                    <div class="insight-label">Peak Day</div>
                    <div class="insight-value">${peakDay}</div>
                    <div class="insight-detail">${formatNumber(peakDayHours)} hours</div>
                </div>
            </div>`;
    }

    if (topBillingType) {
        const billingPercent = totalHours > 0 ? (topBillingHours / totalHours * 100).toFixed(1) : 0;
        insightsHTML += `
            <div class="insight-card">
                <div class="insight-icon">💰</div>
                <div class="insight-content">
                    <div class="insight-label">Top Billing Type</div>
                    <div class="insight-value">${topBillingType}</div>
                    <div class="insight-detail">${billingPercent}% of total hours</div>
                </div>
            </div>`;
    }

    if (monthCount > 0) {
        insightsHTML += `
            <div class="insight-card">
                <div class="insight-icon">📊</div>
                <div class="insight-content">
                    <div class="insight-label">Avg Hours/Month</div>
                    <div class="insight-value">${formatNumber(avgHoursPerMonth)}</div>
                    <div class="insight-detail">Across ${monthCount} month${monthCount > 1 ? 's' : ''}</div>
                </div>
            </div>`;
    }

    // Calculate workload distribution (weekday vs weekend)
    const weekdayHours = (dayOfWeekData['Monday'] || 0) + (dayOfWeekData['Tuesday'] || 0) +
                         (dayOfWeekData['Wednesday'] || 0) + (dayOfWeekData['Thursday'] || 0) +
                         (dayOfWeekData['Friday'] || 0);
    const weekendHours = (dayOfWeekData['Saturday'] || 0) + (dayOfWeekData['Sunday'] || 0);
    const weekdayPercent = totalHours > 0 ? (weekdayHours / totalHours * 100).toFixed(1) : 0;

    insightsHTML += `
        <div class="insight-card">
            <div class="insight-icon">⏰</div>
            <div class="insight-content">
                <div class="insight-label">Weekday Distribution</div>
                <div class="insight-value">${weekdayPercent}%</div>
                <div class="insight-detail">Weekdays vs ${(100 - weekdayPercent).toFixed(1)}% weekends</div>
            </div>
        </div>`;

    insightsHTML += '</div>';

    insightsDiv.innerHTML = insightsHTML;
}

// Additional Analytics Dashboard
function updateAdditionalAnalytics() {
    const analyticsDiv = document.getElementById('additionalAnalytics');

    if (!analyticsDiv || filteredData.length === 0) {
        if (analyticsDiv) analyticsDiv.style.display = 'none';
        return;
    }

    analyticsDiv.style.display = 'block';

    // Top Performers by Hours
    const employeeHours = {};
    filteredData.forEach(row => {
        const fullName = row[COLUMNS.FULL_NAME] || row[COLUMNS.EMPLOYEE] || 'Unknown';
        const hours = parseFloat(row[COLUMNS.DUR_DEC]) || 0;
        employeeHours[fullName] = (employeeHours[fullName] || 0) + hours;
    });
    const topPerformers = Object.entries(employeeHours)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    // Most Active Projects
    const projectHours = {};
    filteredData.forEach(row => {
        const project = row[COLUMNS.CUSTOMER_PROJECT] || 'Unknown Project';
        const projectName = row[COLUMNS.NAME] || '';
        const hours = parseFloat(row[COLUMNS.DUR_DEC]) || 0;

        if (!projectHours[project]) {
            projectHours[project] = { name: projectName, hours: 0 };
        }
        projectHours[project].hours += hours;
    });
    const topProjects = Object.entries(projectHours)
        .sort((a, b) => b[1].hours - a[1].hours)
        .slice(0, 5)
        .map(([project, data]) => [project, data.name, data.hours]);

    // Enhanced Billing Type Breakdown
    const billingData = {};
    let totalHours = 0;
    filteredData.forEach(row => {
        const billingType = row[COLUMNS.MTYPE2] || 'Unknown';
        const hours = parseFloat(row[COLUMNS.DUR_DEC]) || 0;
        billingData[billingType] = (billingData[billingType] || 0) + hours;
        totalHours += hours;
    });
    const billingBreakdown = Object.entries(billingData)
        .sort((a, b) => b[1] - a[1]);

    // Department Utilization
    const departmentHours = {};
    filteredData.forEach(row => {
        const dept = row[COLUMNS.DEPARTMENT] || 'Unknown Department';
        const hours = parseFloat(row[COLUMNS.DUR_DEC]) || 0;
        departmentHours[dept] = (departmentHours[dept] || 0) + hours;
    });
    const topDepartments = Object.entries(departmentHours)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    // Build analytics HTML
    let analyticsHTML = '<div class="analytics-section">';

    // Top Performers
    analyticsHTML += '<div class="analytics-card">';
    analyticsHTML += '<h3 class="analytics-title">👥 Top 5 Performers by Hours</h3>';
    analyticsHTML += '<div class="analytics-list">';
    topPerformers.forEach(([name, hours], index) => {
        const percent = totalHours > 0 ? (hours / totalHours * 100).toFixed(1) : 0;
        analyticsHTML += `
            <div class="analytics-item">
                <div class="analytics-rank">#${index + 1}</div>
                <div class="analytics-name">${escapeHtml(name)}</div>
                <div class="analytics-value">${formatNumber(hours)} hrs</div>
                <div class="analytics-bar-container">
                    <div class="analytics-bar" style="width: ${percent}%"></div>
                </div>
            </div>`;
    });
    analyticsHTML += '</div></div>';

    // Top Projects
    analyticsHTML += '<div class="analytics-card">';
    analyticsHTML += '<h3 class="analytics-title">📁 Top 5 Most Active Projects</h3>';
    analyticsHTML += '<div class="analytics-list">';
    topProjects.forEach(([project, projectName, hours], index) => {
        const percent = totalHours > 0 ? (hours / totalHours * 100).toFixed(1) : 0;
        const displayText = projectName ? `${escapeHtml(project)} - ${escapeHtml(projectName)}` : escapeHtml(project);
        analyticsHTML += `
            <div class="analytics-item">
                <div class="analytics-rank">#${index + 1}</div>
                <div class="analytics-name">${displayText}</div>
                <div class="analytics-value">${formatNumber(hours)} hrs</div>
                <div class="analytics-bar-container">
                    <div class="analytics-bar" style="width: ${percent}%"></div>
                </div>
            </div>`;
    });
    analyticsHTML += '</div></div>';

    // Billing Breakdown
    analyticsHTML += '<div class="analytics-card">';
    analyticsHTML += '<h3 class="analytics-title">💰 Billing Type Breakdown</h3>';
    analyticsHTML += '<div class="analytics-list">';
    billingBreakdown.forEach(([type, hours]) => {
        const percent = totalHours > 0 ? (hours / totalHours * 100).toFixed(1) : 0;
        analyticsHTML += `
            <div class="analytics-item">
                <div class="analytics-name">${escapeHtml(type)}</div>
                <div class="analytics-value">${formatNumber(hours)} hrs</div>
                <div class="analytics-percent">${percent}%</div>
                <div class="analytics-bar-container">
                    <div class="analytics-bar" style="width: ${percent}%"></div>
                </div>
            </div>`;
    });
    analyticsHTML += '</div></div>';

    // Department Utilization
    analyticsHTML += '<div class="analytics-card">';
    analyticsHTML += '<h3 class="analytics-title">🏢 Top 5 Departments by Hours</h3>';
    analyticsHTML += '<div class="analytics-list">';
    topDepartments.forEach(([dept, hours], index) => {
        const percent = totalHours > 0 ? (hours / totalHours * 100).toFixed(1) : 0;
        analyticsHTML += `
            <div class="analytics-item">
                <div class="analytics-rank">#${index + 1}</div>
                <div class="analytics-name">${escapeHtml(dept)}</div>
                <div class="analytics-value">${formatNumber(hours)} hrs</div>
                <div class="analytics-bar-container">
                    <div class="analytics-bar" style="width: ${percent}%"></div>
                </div>
            </div>`;
    });
    analyticsHTML += '</div></div>';

    analyticsHTML += '</div>';

    analyticsDiv.innerHTML = analyticsHTML;
}

// Suggested Improvements Analysis
function updateSuggestedImprovements() {
    const improvementsDiv = document.getElementById('suggestedImprovements');

    if (!improvementsDiv || filteredData.length === 0) {
        if (improvementsDiv) improvementsDiv.style.display = 'none';
        return;
    }

    const improvements = [];

    // 1. Analyze Underutilized Resources
    const employeeHours = {};
    filteredData.forEach(row => {
        const fullName = row[COLUMNS.FULL_NAME] || row[COLUMNS.EMPLOYEE] || 'Unknown';
        const hours = parseFloat(row[COLUMNS.DUR_DEC]) || 0;
        employeeHours[fullName] = (employeeHours[fullName] || 0) + hours;
    });

    const totalEmployees = Object.keys(employeeHours).length;
    const avgHoursPerEmployee = Object.values(employeeHours).reduce((sum, h) => sum + h, 0) / totalEmployees;
    const underutilizedThreshold = avgHoursPerEmployee * 0.3; // 30% of average

    const underutilizedEmployees = Object.entries(employeeHours)
        .filter(([name, hours]) => hours < underutilizedThreshold && hours > 0)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 5);

    if (underutilizedEmployees.length > 0) {
        improvements.push({
            type: 'warning',
            icon: '⚠️',
            title: 'Underutilized Resources',
            content: `${underutilizedEmployees.length} employee(s) have significantly fewer hours than average (${formatNumber(avgHoursPerEmployee)} hrs/person).`,
            list: underutilizedEmployees.map(([name, hours]) =>
                `${name}: <span class="improvement-metric">${formatNumber(hours)} hrs</span> (${((hours / avgHoursPerEmployee) * 100).toFixed(0)}% of avg)`)
        });
    }

    // 2. Analyze Over-allocated Projects
    const projectHoursImprov = {};
    filteredData.forEach(row => {
        const project = row[COLUMNS.CUSTOMER_PROJECT] || 'Unknown';
        const projectName = row[COLUMNS.NAME] || '';
        const hours = parseFloat(row[COLUMNS.DUR_DEC]) || 0;

        if (!projectHoursImprov[project]) {
            projectHoursImprov[project] = { name: projectName, hours: 0 };
        }
        projectHoursImprov[project].hours += hours;
    });

    const avgHoursPerProject = Object.values(projectHoursImprov).reduce((sum, data) => sum + data.hours, 0) / Object.keys(projectHoursImprov).length;
    const overallocatedThreshold = avgHoursPerProject * 2.5; // 250% of average

    const overallocatedProjects = Object.entries(projectHoursImprov)
        .filter(([proj, data]) => data.hours > overallocatedThreshold)
        .sort((a, b) => b[1].hours - a[1].hours)
        .slice(0, 5);

    if (overallocatedProjects.length > 0) {
        improvements.push({
            type: 'alert',
            icon: '🔥',
            title: 'Over-allocated Projects',
            content: `${overallocatedProjects.length} project(s) have significantly more hours than average (${formatNumber(avgHoursPerProject)} hrs/project).`,
            list: overallocatedProjects.map(([proj, data]) => {
                const displayName = data.name ? `${proj} - ${data.name}` : proj;
                return `${displayName}: <span class="improvement-metric">${formatNumber(data.hours)} hrs</span> (${((data.hours / avgHoursPerProject) * 100).toFixed(0)}% of avg)`;
            })
        });
    }

    // 3. Analyze Billing Inconsistencies
    const projectBillingTypes = {};
    const projectNames = {};
    filteredData.forEach(row => {
        const project = row[COLUMNS.CUSTOMER_PROJECT] || 'Unknown';
        const projectName = row[COLUMNS.NAME] || '';
        const billingType = row[COLUMNS.MTYPE2] || 'Unknown';
        if (!projectBillingTypes[project]) {
            projectBillingTypes[project] = new Set();
            projectNames[project] = projectName;
        }
        projectBillingTypes[project].add(billingType);
    });

    const mixedBillingProjects = Object.entries(projectBillingTypes)
        .filter(([proj, types]) => types.size > 2) // More than 2 different billing types
        .map(([proj, types]) => ({ proj, name: projectNames[proj], count: types.size, types: Array.from(types) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    if (mixedBillingProjects.length > 0) {
        improvements.push({
            type: 'warning',
            icon: '💰',
            title: 'Mixed Billing Types',
            content: `${mixedBillingProjects.length} project(s) have multiple billing types, which may indicate billing inconsistencies.`,
            list: mixedBillingProjects.map(item => {
                const displayName = item.name ? `${item.proj} - ${item.name}` : item.proj;
                return `${displayName}: <span class="improvement-metric">${item.count} types</span> (${item.types.join(', ')})`;
            })
        });
    }

    // 4. Analyze Time Tracking Gaps
    const dateHours = {};
    filteredData.forEach(row => {
        const dateStr = row[COLUMNS.DATE];
        if (!dateStr) return;
        const hours = parseFloat(row[COLUMNS.DUR_DEC]) || 0;
        dateHours[dateStr] = (dateHours[dateStr] || 0) + hours;
    });

    const dates = Object.keys(dateHours).sort();
    if (dates.length > 0) {
        const firstDate = parseDate(dates[0]);
        const lastDate = parseDate(dates[dates.length - 1]);

        if (firstDate && lastDate) {
            const daysDiff = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24)) + 1;
            const daysWithData = dates.length;
            const coveragePercent = ((daysWithData / daysDiff) * 100).toFixed(1);

            if (coveragePercent < 80) {
                const missingDays = daysDiff - daysWithData;
                improvements.push({
                    type: 'warning',
                    icon: '📅',
                    title: 'Time Tracking Gaps',
                    content: `Only ${coveragePercent}% of days have time entries. There are ${missingDays} days without any recorded hours.`,
                    list: [`Date range: ${dates[0]} to ${dates[dates.length - 1]}`, `Days with data: ${daysWithData} / ${daysDiff} days`]
                });
            }
        }
    }

    // Display improvements or hide section
    if (improvements.length === 0) {
        improvementsDiv.style.display = 'none';
        return;
    }

    improvementsDiv.style.display = 'block';

    let improvementsHTML = '<div class="improvements-header">💡 Suggested Improvements & Insights</div>';
    improvementsHTML += '<div class="improvements-grid">';

    improvements.forEach(improvement => {
        improvementsHTML += `<div class="improvement-card ${improvement.type}">`;
        improvementsHTML += `<div class="improvement-title">`;
        improvementsHTML += `<span class="improvement-icon">${improvement.icon}</span>`;
        improvementsHTML += `${improvement.title}`;
        improvementsHTML += `</div>`;
        improvementsHTML += `<div class="improvement-content">`;
        improvementsHTML += improvement.content;
        if (improvement.list && improvement.list.length > 0) {
            improvementsHTML += '<ul class="improvement-list">';
            improvement.list.forEach(item => {
                improvementsHTML += `<li>${item}</li>`;
            });
            improvementsHTML += '</ul>';
        }
        improvementsHTML += `</div>`;
        improvementsHTML += `</div>`;
    });

    improvementsHTML += '</div>';
    improvementsDiv.innerHTML = improvementsHTML;
}

// Reset filters
function resetFilters() {
    // Clear date inputs and validation state
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    dateFromInput.value = '';
    dateToInput.value = '';
    dateFromInput.classList.remove('invalid-date', 'valid-date');
    dateToInput.classList.remove('invalid-date', 'valid-date');
    document.getElementById('dateFromError').classList.remove('show');
    document.getElementById('dateToError').classList.remove('show');

    // Clear multi-select filters
    const productFilterElement = document.getElementById('productFilter');
    Array.from(productFilterElement.options).forEach(option => {
        option.selected = false;
    });

    const projectTypeFilterElement = document.getElementById('projectTypeFilter');
    Array.from(projectTypeFilterElement.options).forEach(option => {
        option.selected = false;
    });

    const departmentFilterElement = document.getElementById('departmentFilter');
    Array.from(departmentFilterElement.options).forEach(option => {
        option.selected = false;
    });

    if (rawData.length > 0) {
        applyFilters();
    }
}

// Clear individual filters
function clearDateFrom() {
    const input = document.getElementById('dateFrom');
    const errorDiv = document.getElementById('dateFromError');
    input.value = '';
    input.classList.remove('invalid-date', 'valid-date');
    errorDiv.classList.remove('show');
    if (rawData.length > 0) {
        applyFilters();
    }
}

function clearDateTo() {
    const input = document.getElementById('dateTo');
    const errorDiv = document.getElementById('dateToError');
    input.value = '';
    input.classList.remove('invalid-date', 'valid-date');
    errorDiv.classList.remove('show');
    if (rawData.length > 0) {
        applyFilters();
    }
}

function clearProductFilter() {
    const productFilterElement = document.getElementById('productFilter');
    Array.from(productFilterElement.options).forEach(option => {
        option.selected = false;
    });
    if (rawData.length > 0) {
        applyFilters();
    }
}

function clearProjectTypeFilter() {
    const projectTypeFilterElement = document.getElementById('projectTypeFilter');
    Array.from(projectTypeFilterElement.options).forEach(option => {
        option.selected = false;
    });
    if (rawData.length > 0) {
        applyFilters();
    }
}

function clearDepartmentFilter() {
    const departmentFilterElement = document.getElementById('departmentFilter');
    Array.from(departmentFilterElement.options).forEach(option => {
        option.selected = false;
    });
    if (rawData.length > 0) {
        applyFilters();
    }
}

// Filter Preset Management
function getCurrentFilters() {
    const productFilterElement = document.getElementById('productFilter');
    const selectedProducts = Array.from(productFilterElement.selectedOptions)
        .map(opt => opt.value)
        .filter(val => val !== '');

    const projectTypeFilterElement = document.getElementById('projectTypeFilter');
    const selectedProjectTypes = Array.from(projectTypeFilterElement.selectedOptions)
        .map(opt => opt.value)
        .filter(val => val !== '');

    const departmentFilterElement = document.getElementById('departmentFilter');
    const selectedDepartments = Array.from(departmentFilterElement.selectedOptions)
        .map(opt => opt.value)
        .filter(val => val !== '');

    return {
        dateFrom: document.getElementById('dateFrom').value,
        dateTo: document.getElementById('dateTo').value,
        products: selectedProducts,
        projectTypes: selectedProjectTypes,
        departments: selectedDepartments
    };
}

function saveFilterPreset() {
    const presetName = prompt('Enter a name for this filter preset:');
    if (!presetName || presetName.trim() === '') {
        return;
    }

    const filters = getCurrentFilters();
    const presets = getFilterPresets();
    presets[presetName.trim()] = filters;

    localStorage.setItem('filterPresets', JSON.stringify(presets));
    updatePresetDropdown();
    showSuccess(`Filter preset "${presetName}" saved successfully!`);
}

function getFilterPresets() {
    const presetsJson = localStorage.getItem('filterPresets');
    return presetsJson ? JSON.parse(presetsJson) : {};
}

function loadFilterPreset(presetName) {
    const presets = getFilterPresets();
    const filters = presets[presetName];

    if (!filters) {
        showError(`Preset "${presetName}" not found`);
        return;
    }

    // Apply saved filters
    document.getElementById('dateFrom').value = filters.dateFrom || '';
    document.getElementById('dateTo').value = filters.dateTo || '';

    // Set multi-select products
    const productFilterElement = document.getElementById('productFilter');
    Array.from(productFilterElement.options).forEach(option => {
        option.selected = filters.products.includes(option.value);
    });

    // Set multi-select project types
    const projectTypeFilterElement = document.getElementById('projectTypeFilter');
    Array.from(projectTypeFilterElement.options).forEach(option => {
        option.selected = filters.projectTypes.includes(option.value);
    });

    // Set multi-select departments
    const departmentFilterElement = document.getElementById('departmentFilter');
    Array.from(departmentFilterElement.options).forEach(option => {
        option.selected = (filters.departments || []).includes(option.value);
    });

    applyFilters();
    showSuccess(`Filter preset "${presetName}" loaded successfully!`);
}

function deleteFilterPreset(presetName) {
    if (!confirm(`Are you sure you want to delete the preset "${presetName}"?`)) {
        return;
    }

    const presets = getFilterPresets();
    delete presets[presetName];

    localStorage.setItem('filterPresets', JSON.stringify(presets));
    updatePresetDropdown();
    showSuccess(`Filter preset "${presetName}" deleted successfully!`);
}

function updatePresetDropdown() {
    const presets = getFilterPresets();
    const dropdown = document.getElementById('presetSelector');

    if (!dropdown) return;

    // Clear existing options except the default one
    dropdown.innerHTML = '<option value="">Select a saved preset...</option>';

    // Add preset options
    Object.keys(presets).sort().forEach(presetName => {
        const option = document.createElement('option');
        option.value = presetName;
        option.textContent = presetName;
        dropdown.appendChild(option);
    });
}

function loadDefaultPreset() {
    const presets = getFilterPresets();
    if (presets['default']) {
        loadFilterPreset('default');
        // Update dropdown to show "default" is selected
        const dropdown = document.getElementById('presetSelector');
        if (dropdown) {
            dropdown.value = 'default';
        }
        console.log('Auto-loaded "default" filter preset');
    }
}

// Utility functions
function showLoading() {
    document.getElementById('loadingIndicator').style.display = 'block';
    document.getElementById('noData').style.display = 'none';
    document.getElementById('dataTable').style.display = 'none';
    document.getElementById('stats').style.display = 'none';
}

function showError(message) {
    const container = document.querySelector('.container');
    const existing = container.querySelector('.error');
    if (existing) existing.remove();

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    container.insertBefore(errorDiv, container.children[1]);

    document.getElementById('loadingIndicator').style.display = 'none';

    setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
    const container = document.querySelector('.container');
    const existing = container.querySelector('.success');
    if (existing) existing.remove();

    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;
    container.insertBefore(successDiv, container.children[1]);

    setTimeout(() => successDiv.remove(), 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatNumber(num) {
    const formatted = num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    // Apply user's decimal separator preference
    if (appSettings.decimalSeparator === 'comma') {
        return formatted.replace(/\./g, ',');
    }
    return formatted;
}

// ========== MONTHLY VIEW FUNCTIONS ==========

// Setup monthly view sorting
function setupMonthlySortingEventListeners() {
    document.querySelectorAll('.pivot-table th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            const column = this.dataset.column;
            const type = this.dataset.type;

            // Toggle sort direction
            if (monthlySortState.column === column) {
                monthlySortState.direction = monthlySortState.direction === 'asc' ? 'desc' : 'asc';
            } else {
                monthlySortState.column = column;
                monthlySortState.direction = type === 'number' ? 'desc' : 'asc';
            }

            // Re-display (sorting is done in displayMonthlyData)
            displayMonthlyData();
        });
    });
}

// Legacy function for initial setup - now just a placeholder
function setupMonthlySorting() {
    // Event listeners are now set up dynamically in displayMonthlyData()
}

// Aggregate data by Year, Month, and all other fields
// Chunked aggregation to avoid blocking UI
async function aggregateMonthlyData() {
    const aggregationMap = new Map();
    const chunkSize = 5000; // Process 5000 rows at a time
    const totalRows = filteredData.length;

    // Show loading indicator
    const loading = document.getElementById('loadingIndicatorMonthly');
    if (loading) {
        loading.style.display = 'flex';
        loading.innerHTML = `
            <div class="spinner"></div>
            <p>Aggregating monthly data... <span id="monthlyAggProgress">0%</span></p>
        `;
    }

    for (let i = 0; i < totalRows; i += chunkSize) {
        const chunk = filteredData.slice(i, Math.min(i + chunkSize, totalRows));

        chunk.forEach(row => {
            const dateStr = row[COLUMNS.DATE];
            const rowDate = parseDate(dateStr);

            if (!rowDate) return; // Skip rows with invalid dates

            const year = rowDate.getFullYear();
            const month = rowDate.getMonth() + 1; // 1-12

            const mainProduct = row[COLUMNS.MAIN_PRODUCT] || '(Empty)';
            const customerProject = row[COLUMNS.CUSTOMER_PROJECT] || '(Empty)';
            const name = row[COLUMNS.NAME] || '(Empty)';
            const mtype2 = row[COLUMNS.MTYPE2] || '(Empty)';
            const task = row[COLUMNS.TASK] || '(Empty)';
            const durDec = parseDecimal(row[COLUMNS.DUR_DEC]);

            // Create unique key for aggregation
            const key = `${year}|${month}|${mainProduct}|${customerProject}|${name}|${mtype2}|${task}`;

            if (aggregationMap.has(key)) {
                aggregationMap.get(key).totalHours += durDec;
            } else {
                aggregationMap.set(key, {
                    year,
                    month,
                    mainProduct,
                    customerProject,
                    name,
                    mtype2,
                    task,
                    totalHours: durDec
                });
            }
        });

        // Update progress
        const progress = Math.round(((i + chunk.length) / totalRows) * 100);
        const progressSpan = document.getElementById('monthlyAggProgress');
        if (progressSpan) {
            progressSpan.textContent = `${progress}%`;
        }

        // Yield to browser to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Convert map to array
    monthlyAggregatedData = Array.from(aggregationMap.values());

    if (loading) {
        loading.style.display = 'none';
    }
}

// Display monthly aggregated data as pivot table
function displayMonthlyData() {
    const container = document.getElementById('monthlyTablesContainer');
    const noData = document.getElementById('noDataMonthly');
    const loading = document.getElementById('loadingIndicatorMonthly');

    loading.style.display = 'none';

    if (monthlyAggregatedData.length === 0) {
        container.innerHTML = '';
        noData.style.display = 'block';
        noData.textContent = 'No data matches the current filters.';
        return;
    }

    noData.style.display = 'none';

    // Get all unique months sorted
    const monthsSet = new Set();
    monthlyAggregatedData.forEach(item => {
        monthsSet.add(`${item.year}-${String(item.month).padStart(2, '0')}`);
    });
    const sortedMonths = Array.from(monthsSet).sort();

    // Create row keys (combination of all dimensions except year/month)
    const rowsMap = new Map();
    monthlyAggregatedData.forEach(item => {
        const rowKey = `${item.mainProduct}|${item.customerProject}|${item.name}|${item.mtype2}|${item.task}`;
        if (!rowsMap.has(rowKey)) {
            rowsMap.set(rowKey, {
                mainProduct: item.mainProduct,
                customerProject: item.customerProject,
                name: item.name,
                mtype2: item.mtype2,
                task: item.task,
                months: {},
                rowTotal: 0
            });
        }
        const monthKey = `${item.year}-${String(item.month).padStart(2, '0')}`;
        rowsMap.get(rowKey).months[monthKey] = item.totalHours;
        rowsMap.get(rowKey).rowTotal += item.totalHours;
    });

    // Convert to array for sorting
    let rowsArray = Array.from(rowsMap.values());

    // Sort rows based on current sort state
    if (monthlySortState.column) {
        rowsArray.sort((a, b) => {
            let aVal, bVal;

            // Handle month column sorting
            if (monthlySortState.column.startsWith('month_')) {
                const monthKey = monthlySortState.column.substring(6); // Remove 'month_' prefix
                aVal = a.months[monthKey] || 0;
                bVal = b.months[monthKey] || 0;
            } else {
                // Regular column sorting
                aVal = a[monthlySortState.column];
                bVal = b[monthlySortState.column];
            }

            // Handle empty values
            if (aVal === undefined || aVal === null) aVal = '';
            if (bVal === undefined || bVal === null) bVal = '';

            // Compare based on type
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return monthlySortState.direction === 'asc' ? aVal - bVal : bVal - aVal;
            } else {
                // String comparison
                const comparison = String(aVal).localeCompare(String(bVal));
                return monthlySortState.direction === 'asc' ? comparison : -comparison;
            }
        });
    }

    // Month names
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Build pivot table
    container.innerHTML = '';
    const pivotContainer = document.createElement('div');
    pivotContainer.className = 'pivot-table-container';

    const table = document.createElement('table');
    table.className = 'pivot-table';

    // Header row with months
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Add sortable row headers
    ['mainProduct', 'customerProject', 'name', 'mtype2', 'task'].forEach((field, index) => {
        const labels = ['Main Product', 'Customer:Project', 'Name', 'Type', 'Task'];
        const th = document.createElement('th');
        th.className = 'row-header sortable';
        th.dataset.column = field;
        th.dataset.type = 'string';
        th.textContent = labels[index];
        th.style.cursor = 'pointer';

        // Add sort indicator if this column is currently sorted
        if (monthlySortState.column === field) {
            th.classList.add(monthlySortState.direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }

        headerRow.appendChild(th);
    });

    sortedMonths.forEach(monthKey => {
        const [year, month] = monthKey.split('-');
        const th = document.createElement('th');
        th.className = 'month-header sortable';
        th.dataset.column = `month_${monthKey}`;
        th.dataset.type = 'number';
        th.dataset.monthKey = monthKey;
        th.textContent = `${monthNames[parseInt(month) - 1]} ${year}`;
        th.style.cursor = 'pointer';

        // Add sort indicator if this column is currently sorted
        if (monthlySortState.column === `month_${monthKey}`) {
            th.classList.add(monthlySortState.direction === 'asc' ? 'sort-asc' : 'sort-desc');
        }

        headerRow.appendChild(th);
    });

    // Add sortable total column
    const totalHeader = document.createElement('th');
    totalHeader.className = 'month-header sortable';
    totalHeader.dataset.column = 'rowTotal';
    totalHeader.dataset.type = 'number';
    totalHeader.textContent = 'Total';
    totalHeader.style.cursor = 'pointer';

    // Add sort indicator if this column is currently sorted
    if (monthlySortState.column === 'rowTotal') {
        totalHeader.classList.add(monthlySortState.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }

    headerRow.appendChild(totalHeader);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body rows - limit initial rendering for performance
    const tbody = document.createElement('tbody');
    const monthTotals = {};
    sortedMonths.forEach(m => monthTotals[m] = 0);
    let grandTotal = 0;

    const rowsToDisplay = rowsArray.slice(0, monthlyDisplayedRows);
    const hasMoreRows = rowsArray.length > monthlyDisplayedRows;

    rowsToDisplay.forEach((rowData) => {
        const tr = document.createElement('tr');

        // Row labels
        tr.innerHTML = `
            <td class="row-label">${escapeHtml(rowData.mainProduct)}</td>
            <td class="row-label">${escapeHtml(rowData.customerProject)}</td>
            <td class="row-label">${escapeHtml(rowData.name)}</td>
            <td class="row-label">${escapeHtml(rowData.mtype2)}</td>
            <td class="row-label">${escapeHtml(rowData.task)}</td>
        `;

        // Month values
        let rowTotal = 0;
        sortedMonths.forEach(monthKey => {
            const value = rowData.months[monthKey] || 0;
            rowTotal += value;
            monthTotals[monthKey] += value;
            grandTotal += value;

            const td = document.createElement('td');
            if (value === 0) {
                td.className = 'zero';
                td.textContent = '-';
            } else {
                td.className = 'has-value';
                td.textContent = formatNumber(value);
            }
            tr.appendChild(td);
        });

        // Row total
        const totalTd = document.createElement('td');
        totalTd.className = 'has-value';
        totalTd.style.fontWeight = 'bold';
        totalTd.textContent = formatNumber(rowTotal);
        tr.appendChild(totalTd);

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    // Footer with totals
    const tfoot = document.createElement('tfoot');
    const totalRow = document.createElement('tr');
    totalRow.className = 'total-row';
    totalRow.innerHTML = `
        <td colspan="5" style="text-align: right; padding-right: 20px;">TOTAL:</td>
    `;

    sortedMonths.forEach(monthKey => {
        const td = document.createElement('td');
        td.textContent = formatNumber(monthTotals[monthKey]);
        totalRow.appendChild(td);
    });

    // Grand total
    const grandTotalTd = document.createElement('td');
    grandTotalTd.style.fontWeight = 'bold';
    grandTotalTd.textContent = formatNumber(grandTotal);
    totalRow.appendChild(grandTotalTd);

    tfoot.appendChild(totalRow);
    table.appendChild(tfoot);

    pivotContainer.appendChild(table);
    container.appendChild(pivotContainer);

    // Add "Load More" button if there are more rows
    if (hasMoreRows) {
        const loadMoreDiv = document.createElement('div');
        loadMoreDiv.style.cssText = 'text-align: center; padding: 20px; background: #f8f9fa;';
        loadMoreDiv.innerHTML = `
            <p style="margin-bottom: 10px; color: #6c757d;">
                Showing ${monthlyDisplayedRows.toLocaleString()} of ${rowsArray.length.toLocaleString()} rows
            </p>
            <button onclick="loadMoreMonthlyRows()" class="btn-primary" style="padding: 10px 20px;">
                Load More Rows (+500)
            </button>
        `;
        container.appendChild(loadMoreDiv);
    } else if (rowsArray.length > 500) {
        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = 'text-align: center; padding: 15px; background: #d4edda; color: #155724;';
        infoDiv.innerHTML = `
            <p>✓ All ${rowsArray.length.toLocaleString()} rows displayed</p>
        `;
        container.appendChild(infoDiv);
    }

    // Setup sorting event listeners for the newly created table
    setupMonthlySortingEventListeners();
}

// Load more rows in monthly view
function loadMoreMonthlyRows() {
    monthlyDisplayedRows += 500;
    displayMonthlyData();
}

// Update monthly statistics
function updateMonthlyStats() {
    const statsDiv = document.getElementById('statsMonthly');

    if (monthlyAggregatedData.length === 0) {
        statsDiv.style.display = 'none';
        return;
    }

    statsDiv.style.display = 'grid';

    // Calculate stats
    const totalMonths = new Set(monthlyAggregatedData.map(item => `${item.year}-${item.month}`)).size;
    const totalHours = monthlyAggregatedData.reduce((sum, item) => sum + item.totalHours, 0);
    const avgHoursPerMonth = totalMonths > 0 ? totalHours / totalMonths : 0;

    // Find date range
    const years = monthlyAggregatedData.map(item => item.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const dateRange = minYear === maxYear ? `${minYear}` : `${minYear} - ${maxYear}`;

    document.getElementById('totalMonths').textContent = totalMonths.toLocaleString();
    document.getElementById('totalHoursMonthly').textContent = formatNumber(totalHours);
    document.getElementById('avgHoursMonthly').textContent = formatNumber(avgHoursPerMonth);
    document.getElementById('dateRangeMonthly').textContent = dateRange;
}

// ========== KEN.PBI.1 VIEW FUNCTIONS ==========

// Aggregate data by Main Product, Customer:Project with MTYPE2 as columns
async function aggregateKenPBI1Data() {
    const aggregationMap = new Map();
    const chunkSize = 5000;
    const totalRows = filteredData.length;

    // Show loading indicator
    const loading = document.getElementById('loadingIndicatorKenPBI1');
    if (loading) {
        loading.style.display = 'flex';
        loading.innerHTML = `
            <div class="spinner"></div>
            <p>Aggregating Ken.PBI.1 data... <span id="kenPBI1AggProgress">0%</span></p>
        `;
    }

    for (let i = 0; i < totalRows; i += chunkSize) {
        const chunk = filteredData.slice(i, Math.min(i + chunkSize, totalRows));

        chunk.forEach(row => {
            const mainProduct = row[COLUMNS.MAIN_PRODUCT] || '(Empty)';
            const customerProject = row[COLUMNS.CUSTOMER_PROJECT] || '(Empty)';
            const mtype2 = row[COLUMNS.MTYPE2] || '(Empty)';
            const durDec = parseDecimal(row[COLUMNS.DUR_DEC]);

            // Create unique key for aggregation (without MTYPE2)
            const key = `${mainProduct}|${customerProject}`;

            if (!aggregationMap.has(key)) {
                aggregationMap.set(key, {
                    mainProduct,
                    customerProject,
                    billingTypes: {}
                });
            }

            const entry = aggregationMap.get(key);
            if (!entry.billingTypes[mtype2]) {
                entry.billingTypes[mtype2] = 0;
            }
            entry.billingTypes[mtype2] += durDec;
        });

        // Update progress
        const progress = Math.round(((i + chunk.length) / totalRows) * 100);
        const progressSpan = document.getElementById('kenPBI1AggProgress');
        if (progressSpan) {
            progressSpan.textContent = `${progress}%`;
        }

        // Yield to browser
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Convert map to array
    kenPBI1AggregatedData = Array.from(aggregationMap.values());

    if (loading) {
        loading.style.display = 'none';
    }
}

// Display Ken.PBI.1 data as pivot table
function displayKenPBI1Data() {
    const container = document.getElementById('kenPBI1TablesContainer');
    const noData = document.getElementById('noDataKenPBI1');
    const loading = document.getElementById('loadingIndicatorKenPBI1');

    loading.style.display = 'none';

    if (kenPBI1AggregatedData.length === 0) {
        container.innerHTML = '';
        noData.style.display = 'block';
        noData.textContent = 'No data matches the current filters.';
        return;
    }

    noData.style.display = 'none';

    // Get all unique billing types sorted
    const billingTypesSet = new Set();
    kenPBI1AggregatedData.forEach(item => {
        Object.keys(item.billingTypes).forEach(type => billingTypesSet.add(type));
    });
    const sortedBillingTypes = Array.from(billingTypesSet).sort();

    // Build pivot table
    container.innerHTML = '';
    const pivotContainer = document.createElement('div');
    pivotContainer.className = 'pivot-table-container';

    const table = document.createElement('table');
    table.className = 'pivot-table';

    // Header row with billing types
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Add row headers
    const labels = ['Main Product', 'Customer:Project'];
    labels.forEach(label => {
        const th = document.createElement('th');
        th.className = 'row-header';
        th.textContent = label;
        headerRow.appendChild(th);
    });

    // Add billing type columns
    sortedBillingTypes.forEach(billingType => {
        const th = document.createElement('th');
        th.className = 'month-header';
        th.textContent = billingType;
        headerRow.appendChild(th);
    });

    // Add total column
    const totalHeader = document.createElement('th');
    totalHeader.className = 'month-header';
    totalHeader.textContent = 'Total';
    headerRow.appendChild(totalHeader);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body rows
    const tbody = document.createElement('tbody');
    const billingTypeTotals = {};
    sortedBillingTypes.forEach(type => billingTypeTotals[type] = 0);
    let grandTotal = 0;

    kenPBI1AggregatedData.forEach((rowData) => {
        const tr = document.createElement('tr');

        // Row labels
        tr.innerHTML = `
            <td class="row-label">${escapeHtml(rowData.mainProduct)}</td>
            <td class="row-label">${escapeHtml(rowData.customerProject)}</td>
        `;

        // Billing type values
        let rowTotal = 0;
        sortedBillingTypes.forEach(billingType => {
            const value = rowData.billingTypes[billingType] || 0;
            rowTotal += value;
            billingTypeTotals[billingType] += value;
            grandTotal += value;

            const td = document.createElement('td');
            if (value === 0) {
                td.className = 'zero';
                td.textContent = '-';
            } else {
                td.className = 'has-value';
                td.textContent = formatNumber(value);
            }
            tr.appendChild(td);
        });

        // Row total
        const totalTd = document.createElement('td');
        totalTd.className = 'has-value';
        totalTd.style.fontWeight = 'bold';
        totalTd.textContent = formatNumber(rowTotal);
        tr.appendChild(totalTd);

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    // Footer with totals
    const tfoot = document.createElement('tfoot');
    const totalRow = document.createElement('tr');
    totalRow.className = 'total-row';
    totalRow.innerHTML = `
        <td colspan="2" style="text-align: right; padding-right: 20px;">GRAND TOTAL:</td>
    `;

    sortedBillingTypes.forEach(billingType => {
        const td = document.createElement('td');
        td.textContent = formatNumber(billingTypeTotals[billingType]);
        totalRow.appendChild(td);
    });

    // Grand total
    const grandTotalTd = document.createElement('td');
    grandTotalTd.style.fontWeight = 'bold';
    grandTotalTd.textContent = formatNumber(grandTotal);
    totalRow.appendChild(grandTotalTd);

    tfoot.appendChild(totalRow);
    table.appendChild(tfoot);

    pivotContainer.appendChild(table);
    container.appendChild(pivotContainer);
}

// Update Ken.PBI.1 statistics
function updateKenPBI1Stats() {
    const statsDiv = document.getElementById('statsKenPBI1');

    if (kenPBI1AggregatedData.length === 0) {
        statsDiv.style.display = 'none';
        return;
    }

    statsDiv.style.display = 'grid';

    // Calculate stats
    const billingTypesSet = new Set();
    let totalHours = 0;
    const projectsSet = new Set();

    kenPBI1AggregatedData.forEach(item => {
        Object.keys(item.billingTypes).forEach(type => {
            billingTypesSet.add(type);
            totalHours += item.billingTypes[type];
        });
        projectsSet.add(item.customerProject);
    });

    document.getElementById('totalBillingTypes').textContent = billingTypesSet.size.toLocaleString();
    document.getElementById('totalHoursKenPBI1').textContent = formatNumber(totalHours);
    document.getElementById('totalRecordsKenPBI1').textContent = filteredData.length.toLocaleString();
    document.getElementById('totalProjectsKenPBI1').textContent = projectsSet.size.toLocaleString();
}

// ========== EMPLOYEE VIEW FUNCTIONS ==========

// Aggregate employee data
async function aggregateEmployeeData() {
    const employeeMap = new Map();
    const chunkSize = 5000;
    const totalRows = filteredData.length;

    // Show loading indicator
    const loading = document.getElementById('loadingIndicatorEmployees');
    if (loading) {
        loading.style.display = 'flex';
        loading.innerHTML = `
            <div class="spinner"></div>
            <p>Aggregating employee data...</p>
        `;
    }

    for (let i = 0; i < totalRows; i += chunkSize) {
        const chunk = filteredData.slice(i, Math.min(i + chunkSize, totalRows));

        chunk.forEach(row => {
            const fullName = row[COLUMNS.FULL_NAME] || row[COLUMNS.EMPLOYEE] || '(Unknown)';
            const employeeId = row[COLUMNS.EMPLOYEE] || '';
            const duration = parseFloat((row[COLUMNS.DUR_DEC] || '0').toString().replace(',', '.')) || 0;
            const isBillable = (row[COLUMNS.BILLABLE] || '').toString().toLowerCase() === 'true';
            const task = row[COLUMNS.TASK] || '(No Task)';
            const customerProject = row[COLUMNS.CUSTOMER_PROJECT] || '';
            const projectName = row[COLUMNS.NAME] || '';
            const date = row[COLUMNS.DATE] || '';
            const subsidiary = row[COLUMNS.SUBSIDIARY] || '(No Subsidiary)';
            const activityCode = row[COLUMNS.ACTIVITY_CODE] || '(No Activity Code)';
            const projectType = row[COLUMNS.PROJECT_TYPE] || '(No Project Type)';
            const department = row[COLUMNS.DEPARTMENT] || '(No Department)';
            const manager = row[COLUMNS.MANAGER] || '(No Manager)';
            const team = row[COLUMNS.TEAM] || '(No Team)';
            const supervisor = row[COLUMNS.SUPERVISOR] || '(No Supervisor)';
            const jobGroup = row[COLUMNS.JOB_GROUP] || '(No Job Group)';

            if (!employeeMap.has(fullName)) {
                employeeMap.set(fullName, {
                    employeeName: fullName,
                    employeeId: employeeId,
                    subsidiary: subsidiary,
                    department: department,
                    manager: manager,
                    team: team,
                    supervisor: supervisor,
                    jobGroup: jobGroup,
                    totalHours: 0,
                    billableHours: 0,
                    nonBillableHours: 0,
                    tasks: new Map(),
                    monthlyHours: new Map(),
                    activityCodes: new Map(),
                    projects: new Map(),
                    projectTypes: new Map()
                });
            }

            const employee = employeeMap.get(fullName);
            employee.totalHours += duration;

            if (isBillable) {
                employee.billableHours += duration;
            } else {
                employee.nonBillableHours += duration;
            }

            // Track top tasks/projects
            const taskKey = customerProject ? `${customerProject} - ${task}` : task;
            employee.tasks.set(taskKey, (employee.tasks.get(taskKey) || 0) + duration);

            // Track by activity code
            employee.activityCodes.set(activityCode, (employee.activityCodes.get(activityCode) || 0) + duration);

            // Track by project - store both code and name
            if (customerProject) {
                if (!employee.projects.has(customerProject)) {
                    employee.projects.set(customerProject, {
                        hours: 0,
                        name: projectName
                    });
                }
                employee.projects.get(customerProject).hours += duration;
            }

            // Track by project type
            employee.projectTypes.set(projectType, (employee.projectTypes.get(projectType) || 0) + duration);

            // Track monthly hours
            if (date) {
                const dateParts = date.split('.');
                if (dateParts.length === 3) {
                    const month = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}`;
                    employee.monthlyHours.set(month, (employee.monthlyHours.get(month) || 0) + duration);
                }
            }
        });

        // Yield to browser
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Calculate date range for norm hours calculation
    let minDate = null;
    let maxDate = null;
    filteredData.forEach(row => {
        const dateStr = row[COLUMNS.DATE] || '';
        if (dateStr) {
            const parts = dateStr.split('.');
            if (parts.length === 3) {
                const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                if (!minDate || date < minDate) minDate = date;
                if (!maxDate || date > maxDate) maxDate = date;
            }
        }
    });

    // Calculate number of weeks in period
    let weeksInPeriod = 1;
    if (minDate && maxDate) {
        const daysDiff = (maxDate - minDate) / (1000 * 60 * 60 * 24);
        weeksInPeriod = Math.max(1, daysDiff / 7);
    }

    // Convert to array and calculate additional fields
    employeeAggregatedData = Array.from(employeeMap.values()).map(employee => {
        // Calculate billable percentage
        employee.billablePercent = employee.totalHours > 0
            ? (employee.billableHours / employee.totalHours * 100).toFixed(1)
            : 0;

        // Get top 3 tasks
        const sortedTasks = Array.from(employee.tasks.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
        employee.topTasks = sortedTasks.map(([task, hours]) => `${task} (${formatNumber(hours)}h)`).join(', ');

        // Calculate norm hours based on subsidiary
        const normHoursPerWeek = appSettings.normHoursPerWeek[employee.subsidiary] || appSettings.normHoursPerWeek['Other'] || 37;
        employee.normHours = (normHoursPerWeek * weeksInPeriod).toFixed(1);

        // Calculate utilization percentage (total hours / norm hours * 100)
        employee.utilizationPercent = employee.normHours > 0
            ? (employee.totalHours / parseFloat(employee.normHours) * 100).toFixed(1)
            : 0;

        return employee;
    });

    // Sort by total hours descending
    employeeAggregatedData.sort((a, b) => b.totalHours - a.totalHours);

    // Calculate department billable % averages
    const departmentStats = new Map();
    employeeAggregatedData.forEach(employee => {
        const dept = employee.department || '(No Department)';
        if (!departmentStats.has(dept)) {
            departmentStats.set(dept, {
                totalBillablePercent: 0,
                employeeCount: 0
            });
        }
        const stats = departmentStats.get(dept);
        stats.totalBillablePercent += parseFloat(employee.billablePercent);
        stats.employeeCount++;
    });

    // Calculate averages and add comparison to each employee
    employeeAggregatedData.forEach(employee => {
        const dept = employee.department || '(No Department)';
        const stats = departmentStats.get(dept);
        const deptAverage = stats.employeeCount > 0 ? stats.totalBillablePercent / stats.employeeCount : 0;
        employee.deptBillableAvg = deptAverage.toFixed(1);
        employee.billableVsDept = (parseFloat(employee.billablePercent) - deptAverage).toFixed(1);
    });

    // Calculate job group billable % averages
    const jobGroupStats = new Map();
    employeeAggregatedData.forEach(employee => {
        const jobGroup = employee.jobGroup || '(No Job Group)';
        if (!jobGroupStats.has(jobGroup)) {
            jobGroupStats.set(jobGroup, {
                totalBillablePercent: 0,
                employeeCount: 0
            });
        }
        const stats = jobGroupStats.get(jobGroup);
        stats.totalBillablePercent += parseFloat(employee.billablePercent);
        stats.employeeCount++;
    });

    // Calculate averages and add comparison to each employee
    employeeAggregatedData.forEach(employee => {
        const jobGroup = employee.jobGroup || '(No Job Group)';
        const stats = jobGroupStats.get(jobGroup);
        const jobGroupAverage = stats.employeeCount > 0 ? stats.totalBillablePercent / stats.employeeCount : 0;
        employee.jobGroupBillableAvg = jobGroupAverage.toFixed(1);
        employee.billableVsJobGroup = (parseFloat(employee.billablePercent) - jobGroupAverage).toFixed(1);
    });

    // Hide loading
    if (loading) {
        loading.style.display = 'none';
    }
}

// Display employee data
function displayEmployeeData() {
    const tbody = document.getElementById('employeeTableBody');
    tbody.innerHTML = '';

    // Filter employees based on selected employees
    let displayData = employeeAggregatedData;
    if (selectedEmployees.size > 0 && selectedEmployees.size < allEmployeeNames.length) {
        displayData = employeeAggregatedData.filter(emp => selectedEmployees.has(emp.employeeName));
    }

    if (displayData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="no-data">No employee data available</td></tr>';
        return;
    }

    // Create popup element if it doesn't exist
    let popup = document.getElementById('employeePopup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'employeePopup';
        popup.className = 'employee-popup';
        document.body.appendChild(popup);
    }

    displayData.forEach(employee => {
        const row = document.createElement('tr');
        const utilizationColor = parseFloat(employee.utilizationPercent) > 100 ? '#dc3545' :
                                 parseFloat(employee.utilizationPercent) > 90 ? '#ffc107' :
                                 '#28a745';

        // Color code vs dept average: green if above, red if below
        const vsDeptValue = parseFloat(employee.billableVsDept);
        const vsDeptColor = vsDeptValue > 0 ? '#28a745' : vsDeptValue < 0 ? '#dc3545' : '#6c757d';
        const vsDeptDisplay = vsDeptValue > 0 ? `+${formatNumber(employee.billableVsDept)}%` : `${formatNumber(employee.billableVsDept)}%`;

        // Color code vs job group average: green if above, red if below
        const vsJobGroupValue = parseFloat(employee.billableVsJobGroup);
        const vsJobGroupColor = vsJobGroupValue > 0 ? '#28a745' : vsJobGroupValue < 0 ? '#dc3545' : '#6c757d';
        const vsJobGroupDisplay = vsJobGroupValue > 0 ? `+${formatNumber(employee.billableVsJobGroup)}%` : `${formatNumber(employee.billableVsJobGroup)}%`;

        row.innerHTML = `
            <td class="employee-name-hover">${employee.employeeName}</td>
            <td>${employee.subsidiary || '(No Subsidiary)'}</td>
            <td style="text-align: right;">${formatNumber(employee.totalHours)}</td>
            <td style="text-align: right;">${formatNumber(employee.normHours)}</td>
            <td style="text-align: right; color: ${utilizationColor}; font-weight: 600;">${formatNumber(employee.utilizationPercent)}%</td>
            <td style="text-align: right;">${formatNumber(employee.billableHours)}</td>
            <td style="text-align: right;">${formatNumber(employee.nonBillableHours)}</td>
            <td style="text-align: right;">${formatNumber(employee.billablePercent)}%</td>
            <td style="text-align: right; color: ${vsDeptColor}; font-weight: 600;" title="Dept Avg: ${formatNumber(employee.deptBillableAvg)}%">${vsDeptDisplay}</td>
            <td style="text-align: right; color: ${vsJobGroupColor}; font-weight: 600;" title="Job Group Avg: ${formatNumber(employee.jobGroupBillableAvg)}%">${vsJobGroupDisplay}</td>
            <td style="font-size: 0.85em;">${employee.topTasks || '(None)'}</td>
        `;

        // Add hover event listeners to employee name cell
        const nameCell = row.querySelector('.employee-name-hover');
        nameCell.addEventListener('mouseenter', (e) => showEmployeePopup(e, employee));
        nameCell.addEventListener('mouseleave', hideEmployeePopup);
        nameCell.addEventListener('mousemove', (e) => positionEmployeePopup(e));

        tbody.appendChild(row);
    });

    // Setup sorting for employee table
    setupEmployeeTableSorting();
}

// Show employee popup with detailed stats
function showEmployeePopup(event, employee) {
    const popup = document.getElementById('employeePopup');
    if (!popup) return;

    // Sort activity codes by hours
    const activityCodes = Array.from(employee.activityCodes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    // Sort projects by hours
    const projects = Array.from(employee.projects.entries())
        .sort((a, b) => b[1].hours - a[1].hours)
        .slice(0, 10);

    // Sort project types by hours
    const projectTypes = Array.from(employee.projectTypes.entries())
        .sort((a, b) => b[1] - a[1]);

    // Build popup content
    let popupHTML = `
        <div class="employee-popup-header">Employee Data: ${employee.employeeName}</div>

        <div class="employee-popup-section">
            <div class="employee-popup-section-title">Organizational Information</div>
            <div class="employee-popup-stats">
                <div class="employee-popup-stat">
                    <span class="employee-popup-stat-label">Job Group:</span>
                    <span class="employee-popup-stat-value">${employee.jobGroup || '(None)'}</span>
                </div>
                <div class="employee-popup-stat">
                    <span class="employee-popup-stat-label">Subsidiary:</span>
                    <span class="employee-popup-stat-value">${employee.subsidiary || '(None)'}</span>
                </div>
                <div class="employee-popup-stat">
                    <span class="employee-popup-stat-label">Department:</span>
                    <span class="employee-popup-stat-value">${employee.department || '(None)'}</span>
                </div>
                <div class="employee-popup-stat">
                    <span class="employee-popup-stat-label">Supervisor:</span>
                    <span class="employee-popup-stat-value">${employee.supervisor || '(None)'}</span>
                </div>
                <div class="employee-popup-stat">
                    <span class="employee-popup-stat-label">Manager:</span>
                    <span class="employee-popup-stat-value">${employee.manager || '(None)'}</span>
                </div>
                <div class="employee-popup-stat">
                    <span class="employee-popup-stat-label">Team:</span>
                    <span class="employee-popup-stat-value">${employee.team || '(None)'}</span>
                </div>
            </div>
        </div>

        <div class="employee-popup-section">
            <div class="employee-popup-section-title">Summary</div>
            <div class="employee-popup-stats">
                <div class="employee-popup-stat">
                    <span class="employee-popup-stat-label">Total Hours:</span>
                    <span class="employee-popup-stat-value">${formatNumber(employee.totalHours)}h</span>
                </div>
                <div class="employee-popup-stat">
                    <span class="employee-popup-stat-label">Norm Hours:</span>
                    <span class="employee-popup-stat-value">${formatNumber(employee.normHours)}h</span>
                </div>
                <div class="employee-popup-stat">
                    <span class="employee-popup-stat-label">Billable:</span>
                    <span class="employee-popup-stat-value">${formatNumber(employee.billableHours)}h</span>
                </div>
                <div class="employee-popup-stat">
                    <span class="employee-popup-stat-label">Non-Billable:</span>
                    <span class="employee-popup-stat-value">${formatNumber(employee.nonBillableHours)}h</span>
                </div>
            </div>
        </div>`;

    // Activity Codes section
    if (activityCodes.length > 0) {
        popupHTML += `
        <div class="employee-popup-section">
            <div class="employee-popup-section-title">Hours by Activity Code</div>
            <div class="employee-popup-list">`;
        activityCodes.forEach(([code, hours]) => {
            popupHTML += `
                <div class="employee-popup-list-item">
                    <span class="employee-popup-list-item-name" title="${code}">${code}</span>
                    <span class="employee-popup-list-item-value">${formatNumber(hours)}h</span>
                </div>`;
        });
        popupHTML += `</div></div>`;
    }

    // Projects section
    if (projects.length > 0) {
        popupHTML += `
        <div class="employee-popup-section">
            <div class="employee-popup-section-title">Hours by Project</div>
            <div class="employee-popup-list">`;
        projects.forEach(([projectCode, projectData]) => {
            const displayName = projectData.name ? `${projectData.name} (${projectCode})` : projectCode;
            const fullTitle = projectData.name ? `${projectData.name} - ${projectCode}` : projectCode;
            popupHTML += `
                <div class="employee-popup-list-item">
                    <span class="employee-popup-list-item-name" title="${fullTitle}">${displayName}</span>
                    <span class="employee-popup-list-item-value">${formatNumber(projectData.hours)}h</span>
                </div>`;
        });
        popupHTML += `</div></div>`;
    }

    // Project Types section
    if (projectTypes.length > 0) {
        popupHTML += `
        <div class="employee-popup-section">
            <div class="employee-popup-section-title">Hours by Project Type</div>
            <div class="employee-popup-list">`;
        projectTypes.forEach(([type, hours]) => {
            popupHTML += `
                <div class="employee-popup-list-item">
                    <span class="employee-popup-list-item-name" title="${type}">${type}</span>
                    <span class="employee-popup-list-item-value">${formatNumber(hours)}h</span>
                </div>`;
        });
        popupHTML += `</div></div>`;
    }

    popup.innerHTML = popupHTML;
    popup.classList.add('show');
    positionEmployeePopup(event);
}

// Position employee popup near cursor
function positionEmployeePopup(event) {
    const popup = document.getElementById('employeePopup');
    if (!popup || !popup.classList.contains('show')) return;

    const padding = 15;
    const popupWidth = popup.offsetWidth;
    const popupHeight = popup.offsetHeight;

    let left = event.clientX + padding;
    let top = event.clientY + padding;

    // Adjust if popup would go off right edge
    if (left + popupWidth > window.innerWidth) {
        left = event.clientX - popupWidth - padding;
    }

    // Adjust if popup would go off bottom edge
    if (top + popupHeight > window.innerHeight) {
        top = event.clientY - popupHeight - padding;
    }

    // Ensure popup doesn't go off left or top edge
    left = Math.max(padding, left);
    top = Math.max(padding, top);

    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
}

// Hide employee popup
function hideEmployeePopup() {
    const popup = document.getElementById('employeePopup');
    if (popup) {
        popup.classList.remove('show');
    }
}

// Setup sorting for employee table
function setupEmployeeTableSorting() {
    const employeeTable = document.querySelector('#employeesView table');
    if (!employeeTable) return;

    employeeTable.querySelectorAll('th.sortable').forEach(th => {
        // Remove existing listeners by cloning
        const newTh = th.cloneNode(true);
        th.parentNode.replaceChild(newTh, th);

        newTh.addEventListener('click', function() {
            const column = this.dataset.column;
            const type = this.dataset.type;
            const currentDirection = this.classList.contains('sort-asc') ? 'asc' : 'desc';
            const newDirection = currentDirection === 'asc' ? 'desc' : 'asc';

            // Remove all sort classes
            employeeTable.querySelectorAll('th.sortable').forEach(h => {
                h.classList.remove('sort-asc', 'sort-desc');
            });

            // Add new sort class
            this.classList.add(newDirection === 'asc' ? 'sort-asc' : 'sort-desc');

            // Sort data
            employeeAggregatedData.sort((a, b) => {
                let aVal = a[column];
                let bVal = b[column];

                if (type === 'number') {
                    aVal = parseFloat(aVal) || 0;
                    bVal = parseFloat(bVal) || 0;
                } else {
                    aVal = (aVal || '').toString().toLowerCase();
                    bVal = (bVal || '').toString().toLowerCase();
                }

                if (newDirection === 'asc') {
                    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                } else {
                    return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
                }
            });

            displayEmployeeData();
        });
    });
}

// Update employee stats
function updateEmployeeStats() {
    const statsDiv = document.getElementById('statsEmployees');

    if (employeeAggregatedData.length === 0) {
        statsDiv.style.display = 'none';
        return;
    }

    statsDiv.style.display = 'grid';

    // Filter employees based on selected employees
    let displayData = employeeAggregatedData;
    if (selectedEmployees.size > 0 && selectedEmployees.size < allEmployeeNames.length) {
        displayData = employeeAggregatedData.filter(emp => selectedEmployees.has(emp.employeeName));
    }

    // Calculate totals
    let totalHours = 0;
    let billableHours = 0;
    let nonBillableHours = 0;

    displayData.forEach(employee => {
        totalHours += employee.totalHours;
        billableHours += employee.billableHours;
        nonBillableHours += employee.nonBillableHours;
    });

    document.getElementById('totalEmployees').textContent = displayData.length.toLocaleString();
    document.getElementById('totalHoursEmployees').textContent = formatNumber(totalHours);
    document.getElementById('billableHoursEmployees').textContent = formatNumber(billableHours);
    document.getElementById('nonBillableHoursEmployees').textContent = formatNumber(nonBillableHours);
}

// Create employee 12-month trend chart
let employeeTrendChartInstance = null;
let pivotChartInstance = null;

function createEmployeeTrendChart() {
    const ctx = document.getElementById('employeeTrendChart');
    if (!ctx) return;

    // Destroy existing chart
    if (employeeTrendChartInstance) {
        employeeTrendChartInstance.destroy();
    }

    // Get last 12 months
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        months.push({
            key: monthKey,
            label: d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
        });
    }

    // Filter employees based on selected employees
    let displayData = employeeAggregatedData;
    if (selectedEmployees.size > 0 && selectedEmployees.size < allEmployeeNames.length) {
        displayData = employeeAggregatedData.filter(emp => selectedEmployees.has(emp.employeeName));
    }

    // Aggregate hours by month from filtered employees
    const monthlyTotals = new Map();
    const monthlyBillable = new Map();
    const monthlyNonBillable = new Map();

    displayData.forEach(employee => {
        employee.monthlyHours.forEach((hours, month) => {
            if (months.some(m => m.key === month)) {
                monthlyTotals.set(month, (monthlyTotals.get(month) || 0) + hours);
            }
        });
    });

    // Calculate billable/non-billable per month from filtered raw data
    filteredData.forEach(row => {
        const fullName = row[COLUMNS.FULL_NAME] || row[COLUMNS.EMPLOYEE] || '(Unknown)';

        // Check if this employee is in selected employees
        if (selectedEmployees.size > 0 && selectedEmployees.size < allEmployeeNames.length) {
            if (!selectedEmployees.has(fullName)) {
                return; // Skip this row if employee not selected
            }
        }

        const date = row[COLUMNS.DATE] || '';
        if (date) {
            const dateParts = date.split('.');
            if (dateParts.length === 3) {
                const month = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}`;
                if (months.some(m => m.key === month)) {
                    const duration = parseFloat((row[COLUMNS.DUR_DEC] || '0').toString().replace(',', '.')) || 0;
                    const isBillable = (row[COLUMNS.BILLABLE] || '').toString().toLowerCase() === 'true';

                    if (isBillable) {
                        monthlyBillable.set(month, (monthlyBillable.get(month) || 0) + duration);
                    } else {
                        monthlyNonBillable.set(month, (monthlyNonBillable.get(month) || 0) + duration);
                    }
                }
            }
        }
    });

    // Calculate norm hours per month for filtered employees
    const monthlyNormHours = new Map();
    months.forEach(monthInfo => {
        const [year, month] = monthInfo.key.split('-');
        const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
        const weeksInMonth = daysInMonth / 7;

        let normTotal = 0;
        displayData.forEach(employee => {
            const normHoursPerWeek = appSettings.normHoursPerWeek[employee.subsidiary] || appSettings.normHoursPerWeek['Other'] || 37;
            normTotal += normHoursPerWeek * weeksInMonth;
        });

        monthlyNormHours.set(monthInfo.key, normTotal);
    });

    const chartData = {
        labels: months.map(m => m.label),
        datasets: [
            {
                label: 'Total Hours',
                data: months.map(m => monthlyTotals.get(m.key) || 0),
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'Billable Hours',
                data: months.map(m => monthlyBillable.get(m.key) || 0),
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'Non-Billable Hours',
                data: months.map(m => monthlyNonBillable.get(m.key) || 0),
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                tension: 0.4,
                fill: true
            },
            {
                label: 'Norm Hours',
                data: months.map(m => monthlyNormHours.get(m.key) || 0),
                borderColor: '#ff6b6b',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                tension: 0,
                fill: false,
                pointRadius: 0
            }
        ]
    };

    employeeTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatNumber(context.parsed.y) + ' hours';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Hours'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Month'
                    }
                }
            }
        }
    });
}

// Employee filter state
let selectedEmployees = new Set();
let allEmployeeNames = [];

// Populate employee filter checkboxes
function populateEmployeeFilter() {
    // Get all employee names sorted alphabetically
    allEmployeeNames = [...new Set(employeeAggregatedData.map(emp => emp.employeeName))].sort();

    // Initialize selectedEmployees with all employees
    selectedEmployees = new Set(allEmployeeNames);

    renderEmployeeCheckboxList();
}

// Render employee checkbox list
function renderEmployeeCheckboxList() {
    const container = document.getElementById('employeeCheckboxList');
    if (!container) return;

    const searchTerm = (document.getElementById('employeeSearchBox')?.value || '').toLowerCase();

    // Filter employees based on search
    const filteredEmployees = allEmployeeNames.filter(name =>
        name.toLowerCase().includes(searchTerm)
    );

    container.innerHTML = '';

    filteredEmployees.forEach(name => {
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.padding = '4px';
        label.style.cursor = 'pointer';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = name;
        checkbox.checked = selectedEmployees.has(name);
        checkbox.style.marginRight = '8px';
        checkbox.onchange = () => updateEmployeeSelection();

        const span = document.createElement('span');
        span.textContent = name;
        span.style.fontSize = '0.9em';

        label.appendChild(checkbox);
        label.appendChild(span);
        container.appendChild(label);
    });
}

// Filter employee list based on search box
function filterEmployeeList() {
    renderEmployeeCheckboxList();
}

// Toggle employee filter dropdown
function toggleEmployeeFilter() {
    const dropdown = document.getElementById('employeeFilterDropdown');
    if (dropdown) {
        const isVisible = dropdown.style.display !== 'none';
        dropdown.style.display = isVisible ? 'none' : 'block';

        if (!isVisible) {
            // Populate on open
            populateEmployeeFilter();
        }
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const container = document.querySelector('.employee-filter-container');
    const dropdown = document.getElementById('employeeFilterDropdown');

    if (container && dropdown && !container.contains(event.target)) {
        dropdown.style.display = 'none';
    }
});

// Update employee selection
function updateEmployeeSelection() {
    const checkboxes = document.querySelectorAll('#employeeCheckboxList input[type="checkbox"]');
    selectedEmployees.clear();

    checkboxes.forEach(cb => {
        if (cb.checked) {
            selectedEmployees.add(cb.value);
        }
    });

    // Update Select All checkbox
    const selectAll = document.getElementById('selectAllEmployees');
    if (selectAll) {
        const allChecked = selectedEmployees.size === allEmployeeNames.length;
        const noneChecked = selectedEmployees.size === 0;
        selectAll.checked = allChecked;
        selectAll.indeterminate = !allChecked && !noneChecked;
    }
}

// Toggle Select All
function toggleSelectAllEmployees() {
    const selectAll = document.getElementById('selectAllEmployees');
    const checkboxes = document.querySelectorAll('#employeeCheckboxList input[type="checkbox"]');

    if (selectAll.checked) {
        // Select all visible employees
        checkboxes.forEach(cb => {
            cb.checked = true;
            selectedEmployees.add(cb.value);
        });
    } else {
        // Deselect all visible employees
        checkboxes.forEach(cb => {
            cb.checked = false;
            selectedEmployees.delete(cb.value);
        });
    }
}

// Apply employee filter
function applyEmployeeFilter() {
    // Update label
    const label = document.getElementById('employeeFilterLabel');
    if (label) {
        if (selectedEmployees.size === 0) {
            label.textContent = 'No Employees Selected';
        } else if (selectedEmployees.size === allEmployeeNames.length) {
            label.textContent = 'All Employees';
        } else if (selectedEmployees.size === 1) {
            label.textContent = Array.from(selectedEmployees)[0];
        } else {
            label.textContent = `${selectedEmployees.size} Employees Selected`;
        }
    }

    // Close dropdown
    const dropdown = document.getElementById('employeeFilterDropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }

    // Update display
    displayEmployeeData();
    updateEmployeeStats();
    createEmployeeTrendChart();
}

// Clear employee filter
function clearEmployeeFilter() {
    // Select all employees
    selectedEmployees = new Set(allEmployeeNames);

    // Update checkboxes
    const checkboxes = document.querySelectorAll('#employeeCheckboxList input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = true;
    });

    // Update Select All
    const selectAll = document.getElementById('selectAllEmployees');
    if (selectAll) {
        selectAll.checked = true;
        selectAll.indeterminate = false;
    }

    // Apply filter
    applyEmployeeFilter();
}

// ========== PIVOT BUILDER FUNCTIONS ==========

// Initialize Pivot Builder view
function initializePivotBuilder() {
    loadPivotPresetsIntoDropdown();
}

// Build custom pivot table based on user configuration
async function buildPivotTable() {
    const loading = document.getElementById('loadingIndicatorPivotBuilder');
    const resultsDiv = document.getElementById('pivotBuilderResults');

    // Get configuration
    const config = {
        rows: [
            document.getElementById('pivotRow1').value,
            document.getElementById('pivotRow2').value,
            document.getElementById('pivotRow3').value
        ].filter(r => r !== ''), // Remove empty selections
        column: document.getElementById('pivotColumn').value,
        measureField: document.getElementById('pivotMeasureField').value,
        aggregation: document.getElementById('pivotAggregation').value
    };

    // Validate configuration
    if (config.rows.length === 0) {
        alert('Please select at least one Row field');
        return;
    }

    // Show loading
    loading.style.display = 'flex';
    resultsDiv.style.display = 'none';

    try {
        // Aggregate data
        const aggregatedData = await aggregatePivotData(config);

        // Store config and data for sorting
        window.lastPivotConfig = config;
        window.lastPivotData = aggregatedData;

        // Render pivot table
        renderPivotTable(aggregatedData, config);

        // Show results
        resultsDiv.style.display = 'block';
    } catch (error) {
        console.error('Error building pivot table:', error);
        alert('Error building pivot table: ' + error.message);
    } finally {
        loading.style.display = 'none';
    }
}

// Aggregate data based on pivot configuration
async function aggregatePivotData(config) {
    const aggregationMap = new Map();
    const chunkSize = 5000;
    const totalRows = filteredData.length;

    for (let i = 0; i < totalRows; i += chunkSize) {
        const chunk = filteredData.slice(i, Math.min(i + chunkSize, totalRows));

        chunk.forEach(row => {
            // Get row field values
            const rowValues = config.rows.map(field => getFieldValue(row, field));
            const rowKey = rowValues.join('|');

            // Get column field value (if any)
            const columnValue = config.column ? getFieldValue(row, config.column) : null;

            // Get measure value
            const measureValue = getMeasureValue(row, config.measureField);

            // Create aggregation key
            const fullKey = columnValue ? `${rowKey}|${columnValue}` : rowKey;

            if (!aggregationMap.has(fullKey)) {
                aggregationMap.set(fullKey, {
                    rowValues: rowValues,
                    columnValue: columnValue,
                    values: [],
                    detailRecords: [], // Store full records for drill-down
                    sum: 0,
                    count: 0,
                    min: Infinity,
                    max: -Infinity
                });
            }

            const entry = aggregationMap.get(fullKey);
            entry.values.push(measureValue);
            entry.detailRecords.push(row); // Store the full row
            entry.sum += measureValue;
            entry.count++;
            entry.min = Math.min(entry.min, measureValue);
            entry.max = Math.max(entry.max, measureValue);
        });

        // Yield to browser
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    return Array.from(aggregationMap.values());
}

// Sort columns intelligently (chronological for months, alphabetical otherwise)
function sortColumns(columns, fieldType) {
    // Check if columns are months (format: "Jan 2024", "Feb 2024", etc.)
    const isMonth = fieldType === 'month' || columns.some(col => /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{4}$/.test(col));

    if (isMonth) {
        // Parse month strings and sort chronologically
        const monthMap = {
            'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
            'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
        };

        return columns.sort((a, b) => {
            const [monthA, yearA] = a.split(' ');
            const [monthB, yearB] = b.split(' ');

            const yearDiff = parseInt(yearA) - parseInt(yearB);
            if (yearDiff !== 0) return yearDiff;

            return monthMap[monthA] - monthMap[monthB];
        });
    } else {
        // Alphabetical sorting for non-month columns
        return columns.sort();
    }
}

// Get field value from row
function getFieldValue(row, field) {
    const fieldMap = {
        'mainProduct': row[COLUMNS.MAIN_PRODUCT] || '(Empty)',
        'customerProject': row[COLUMNS.CUSTOMER_PROJECT] || '(Empty)',
        'name': row[COLUMNS.NAME] || '(Empty)',
        'mtype2': row[COLUMNS.MTYPE2] || '(Empty)',
        'task': row[COLUMNS.TASK] || '(Empty)',
        'department': row[COLUMNS.DEPARTMENT] || '(Empty)',
        'projectType': row[COLUMNS.PROJECT_TYPE] || '(Empty)',
        'month': (() => {
            const dateStr = row[COLUMNS.DATE];
            const rowDate = parseDate(dateStr);
            if (rowDate) {
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return `${monthNames[rowDate.getMonth()]} ${rowDate.getFullYear()}`;
            }
            return '(Unknown)';
        })()
    };

    return fieldMap[field] || '(Unknown)';
}

// Get measure value from row
function getMeasureValue(row, measureField) {
    if (measureField === 'count') {
        return 1; // Each row counts as 1
    } else if (measureField === 'durDec') {
        return parseDecimal(row[COLUMNS.DUR_DEC]);
    }
    return 0;
}

// Get conditional formatting color based on value
function getConditionalFormattingColor(value, maxValue) {
    if (value === 0 || maxValue === 0) {
        return { background: 'transparent', color: '#212529' };
    }

    const percentage = (value / maxValue) * 100;

    // Color scale: light green to dark green
    if (percentage >= 80) {
        // Very high values: dark green with white text
        return { background: '#28a745', color: 'white' };
    } else if (percentage >= 60) {
        // High values: medium-dark green
        return { background: '#5cb85c', color: 'white' };
    } else if (percentage >= 40) {
        // Medium values: medium green
        return { background: '#8fce8f', color: '#212529' };
    } else if (percentage >= 20) {
        // Low values: light green
        return { background: '#c3e6c3', color: '#212529' };
    } else {
        // Very low values: very light green
        return { background: '#e7f4e7', color: '#212529' };
    }
}

// Render pivot table
function renderPivotTable(aggregatedData, config) {
    const resultsDiv = document.getElementById('pivotBuilderResults');

    if (aggregatedData.length === 0) {
        resultsDiv.innerHTML = '<p style="padding: 20px; text-align: center; color: #6c757d;">No data to display. Try adjusting your filters.</p>';
        return;
    }

    // Clear previous drill-down data
    pivotDrilldownData.clear();

    // Group data by rows and columns
    const rowsMap = new Map();
    const columnsSet = new Set();

    aggregatedData.forEach(item => {
        const rowKey = item.rowValues.join('|');
        if (!rowsMap.has(rowKey)) {
            rowsMap.set(rowKey, {
                rowValues: item.rowValues,
                columns: {}
            });
        }

        const rowEntry = rowsMap.get(rowKey);
        const columnKey = item.columnValue || '_total';

        if (item.columnValue) {
            columnsSet.add(item.columnValue);
        }

        // Calculate aggregated value based on aggregation type
        let aggregatedValue = 0;
        switch (config.aggregation) {
            case 'sum':
                aggregatedValue = item.sum;
                break;
            case 'avg':
                aggregatedValue = item.count > 0 ? item.sum / item.count : 0;
                break;
            case 'count':
                aggregatedValue = item.count;
                break;
            case 'min':
                aggregatedValue = item.min !== Infinity ? item.min : 0;
                break;
            case 'max':
                aggregatedValue = item.max !== -Infinity ? item.max : 0;
                break;
        }

        rowEntry.columns[columnKey] = aggregatedValue;

        // Store detail records for drill-down
        const drilldownKey = `${rowKey}|${columnKey}`;
        pivotDrilldownData.set(drilldownKey, {
            rowValues: item.rowValues,
            columnValue: item.columnValue,
            detailRecords: item.detailRecords || []
        });
    });

    // Sort columns - chronologically for months, alphabetically for others
    const sortedColumns = config.column ? sortColumns(Array.from(columnsSet), config.column) : [];

    // Convert rowsMap to array for sorting
    let rowsArray = Array.from(rowsMap.values());

    // Apply sorting if a sort column is set
    if (pivotBuilderSortState.column !== null) {
        const sortColumn = pivotBuilderSortState.column;
        const sortDirection = pivotBuilderSortState.direction;

        rowsArray.sort((a, b) => {
            let aValue, bValue;

            // Check if sorting by a column or by a row field
            if (sortColumn.startsWith('col_')) {
                // Sorting by a column value
                const colName = sortColumn.substring(4); // Remove 'col_' prefix
                aValue = a.columns[colName] || 0;
                bValue = b.columns[colName] || 0;
            } else if (sortColumn === 'total') {
                // Sorting by row total
                aValue = Object.values(a.columns).reduce((sum, val) => sum + val, 0);
                bValue = Object.values(b.columns).reduce((sum, val) => sum + val, 0);
            } else {
                // Sorting by row field (row0, row1, row2)
                const rowIndex = parseInt(sortColumn.replace('row', ''));
                aValue = a.rowValues[rowIndex] || '';
                bValue = b.rowValues[rowIndex] || '';
            }

            // Compare based on type
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
            } else {
                const comparison = String(aValue).localeCompare(String(bValue));
                return sortDirection === 'asc' ? comparison : -comparison;
            }
        });
    }

    // Build HTML
    const pivotContainer = document.createElement('div');
    pivotContainer.className = 'pivot-table-container';
    pivotContainer.style.marginTop = '20px';

    const table = document.createElement('table');
    table.className = 'pivot-table';

    // Header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Row field headers
    const rowFieldLabels = {
        'mainProduct': 'Main Product',
        'customerProject': 'Customer:Project',
        'name': 'Name (Employee)',
        'mtype2': 'Type (MTYPE2)',
        'task': 'Task',
        'department': 'Department',
        'projectType': 'Project Type'
    };

    config.rows.forEach((field, index) => {
        const th = document.createElement('th');
        th.className = 'row-header sortable';
        th.dataset.column = `row${index}`;
        th.dataset.type = 'text';

        const label = rowFieldLabels[field] || field;
        const sortIndicator = pivotBuilderSortState.column === `row${index}`
            ? (pivotBuilderSortState.direction === 'asc' ? ' ▲' : ' ▼')
            : '';
        th.textContent = label + sortIndicator;

        headerRow.appendChild(th);
    });

    // Column headers (if pivot by column)
    if (config.column && sortedColumns.length > 0) {
        sortedColumns.forEach(col => {
            const th = document.createElement('th');
            th.className = 'month-header sortable';
            th.dataset.column = `col_${col}`;
            th.dataset.type = 'number';

            const sortIndicator = pivotBuilderSortState.column === `col_${col}`
                ? (pivotBuilderSortState.direction === 'asc' ? ' ▲' : ' ▼')
                : '';
            th.textContent = col + sortIndicator;

            headerRow.appendChild(th);
        });
    }

    // Total column
    const totalHeader = document.createElement('th');
    totalHeader.className = 'month-header sortable';
    totalHeader.dataset.column = 'total';
    totalHeader.dataset.type = 'number';

    const totalSortIndicator = pivotBuilderSortState.column === 'total'
        ? (pivotBuilderSortState.direction === 'asc' ? ' ▲' : ' ▼')
        : '';
    totalHeader.textContent = 'Total' + totalSortIndicator;

    headerRow.appendChild(totalHeader);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Calculate max value for conditional formatting
    let maxValue = 0;
    rowsArray.forEach((rowEntry) => {
        Object.values(rowEntry.columns).forEach(val => {
            if (val > maxValue) maxValue = val;
        });
    });

    // Body rows
    const tbody = document.createElement('tbody');
    const columnTotals = {};
    sortedColumns.forEach(col => columnTotals[col] = 0);
    let grandTotal = 0;

    rowsArray.forEach((rowEntry) => {
        const tr = document.createElement('tr');

        // Row values
        rowEntry.rowValues.forEach(value => {
            const td = document.createElement('td');
            td.className = 'row-label';
            td.textContent = value;
            tr.appendChild(td);
        });

        // Column values
        let rowTotal = 0;
        if (config.column && sortedColumns.length > 0) {
            sortedColumns.forEach(col => {
                const value = rowEntry.columns[col] || 0;
                rowTotal += value;
                columnTotals[col] += value;

                const td = document.createElement('td');
                if (value === 0) {
                    td.className = 'zero';
                    td.textContent = '-';
                } else {
                    td.className = 'has-value clickable-cell';
                    td.textContent = formatNumber(value);
                    td.style.cursor = 'pointer';
                    td.title = 'Click to see detail records';

                    // Apply conditional formatting if enabled
                    const colorHighlightEnabled = document.getElementById('pivotColorHighlight').checked;
                    if (colorHighlightEnabled) {
                        const colors = getConditionalFormattingColor(value, maxValue);
                        td.style.backgroundColor = colors.background;
                        td.style.color = colors.color;
                    }

                    // Add click handler for drill-down
                    const rowKey = rowEntry.rowValues.join('|');
                    const drilldownKey = `${rowKey}|${col}`;
                    td.onclick = function() {
                        const drilldownInfo = pivotDrilldownData.get(drilldownKey);
                        if (drilldownInfo) {
                            const cellInfo = {
                                rows: rowEntry.rowValues.join(' → '),
                                column: col
                            };
                            showDrilldownModal(drilldownInfo.detailRecords, cellInfo);
                        }
                    };
                }
                tr.appendChild(td);
            });
        } else {
            // No column pivot, just use total
            rowTotal = rowEntry.columns['_total'] || 0;
        }

        grandTotal += rowTotal;

        // Row total
        const totalTd = document.createElement('td');
        totalTd.className = 'has-value clickable-cell';
        totalTd.style.fontWeight = 'bold';
        totalTd.style.cursor = 'pointer';
        totalTd.title = 'Click to see all detail records for this row';
        totalTd.textContent = formatNumber(rowTotal);

        // Apply conditional formatting to row total if enabled
        const colorHighlightEnabled = document.getElementById('pivotColorHighlight').checked;
        if (colorHighlightEnabled) {
            const colors = getConditionalFormattingColor(rowTotal, maxValue);
            totalTd.style.backgroundColor = colors.background;
            totalTd.style.color = colors.color;
        }

        // Add click handler for row total drill-down
        const rowKey = rowEntry.rowValues.join('|');
        const drilldownKey = `${rowKey}|_total`;
        totalTd.onclick = function() {
            const drilldownInfo = pivotDrilldownData.get(drilldownKey);
            if (drilldownInfo) {
                const cellInfo = {
                    rows: rowEntry.rowValues.join(' → '),
                    column: null
                };
                showDrilldownModal(drilldownInfo.detailRecords, cellInfo);
            }
        };

        tr.appendChild(totalTd);

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    // Footer with totals
    if (config.column && sortedColumns.length > 0) {
        const tfoot = document.createElement('tfoot');
        const totalRow = document.createElement('tr');
        totalRow.className = 'total-row';

        const totalLabelTd = document.createElement('td');
        totalLabelTd.colSpan = config.rows.length;
        totalLabelTd.style.textAlign = 'right';
        totalLabelTd.style.paddingRight = '20px';
        totalLabelTd.textContent = 'GRAND TOTAL:';
        totalRow.appendChild(totalLabelTd);

        sortedColumns.forEach(col => {
            const td = document.createElement('td');
            td.textContent = formatNumber(columnTotals[col]);
            totalRow.appendChild(td);
        });

        const grandTotalTd = document.createElement('td');
        grandTotalTd.style.fontWeight = 'bold';
        grandTotalTd.textContent = formatNumber(grandTotal);
        totalRow.appendChild(grandTotalTd);

        tfoot.appendChild(totalRow);
        table.appendChild(tfoot);
    }

    pivotContainer.appendChild(table);

    // Add summary info
    const summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = 'margin-top: 15px; padding: 15px; background: #d4edda; border-radius: 8px;';
    summaryDiv.innerHTML = `
        <p style="margin: 0; color: #155724;">
            <strong>✓ Pivot table generated</strong><br>
            Rows: ${rowsArray.length.toLocaleString()} |
            ${config.column ? `Columns: ${sortedColumns.length} | ` : ''}
            Aggregation: ${config.aggregation.toUpperCase()} |
            Grand Total: ${formatNumber(grandTotal)}
        </p>
    `;

    resultsDiv.innerHTML = '';
    resultsDiv.appendChild(summaryDiv);
    resultsDiv.appendChild(pivotContainer);

    // Setup sorting event listeners
    setupPivotBuilderSorting();

    // Store data for chart updates
    window.lastPivotData = rowsArray;
    window.lastPivotColumns = sortedColumns;
    window.lastPivotColumnTotals = columnTotals;
    window.lastPivotGrandTotal = grandTotal;

    // Generate chart
    createPivotChart(rowsArray, sortedColumns, config, columnTotals, grandTotal);
}

// Create pivot chart
function createPivotChart(rowsArray, sortedColumns, config, columnTotals, grandTotal) {
    // Destroy previous chart if exists
    if (pivotChartInstance) {
        pivotChartInstance.destroy();
        pivotChartInstance = null;
    }

    // Get selected chart type
    const chartTypeSelect = document.getElementById('pivotChartType');
    const chartType = chartTypeSelect ? chartTypeSelect.value : 'bar';

    // Clean up old notes
    const oldNotes = document.querySelectorAll('.chart-note, .chart-note-rows');
    oldNotes.forEach(note => note.remove());

    // Get or create chart container
    let chartContainer = document.getElementById('pivotChartContainer');
    if (!chartContainer) {
        chartContainer = document.createElement('div');
        chartContainer.id = 'pivotChartContainer';
        chartContainer.style.cssText = 'padding: 20px 30px; background: var(--bg-primary); margin-top: 20px; border-top: 2px solid var(--border-color);';

        const titleRow = document.createElement('div');
        titleRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;';

        const title = document.createElement('h3');
        title.textContent = '📊 Pivot Chart';
        title.style.margin = '0';
        titleRow.appendChild(title);

        // Chart controls
        const controlsDiv = document.createElement('div');
        controlsDiv.style.cssText = 'display: flex; gap: 15px; align-items: center; flex-wrap: wrap;';

        // Chart type selector
        const chartTypeLabel = document.createElement('label');
        chartTypeLabel.style.cssText = 'font-size: 0.9em; display: flex; align-items: center; gap: 8px;';
        chartTypeLabel.innerHTML = '<span>Chart Type:</span>';

        const chartTypeSelect = document.createElement('select');
        chartTypeSelect.id = 'pivotChartType';
        chartTypeSelect.style.cssText = 'padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); font-size: 0.9em;';
        chartTypeSelect.innerHTML = `
            <option value="bar">Bar Chart</option>
            <option value="line">Line Chart</option>
            <option value="pie">Pie Chart</option>
            <option value="doughnut">Doughnut Chart</option>
            <option value="horizontalBar">Horizontal Bar</option>
        `;
        chartTypeSelect.onchange = () => {
            if (window.lastPivotConfig && window.lastPivotData) {
                createPivotChart(window.lastPivotData, window.lastPivotColumns || [], window.lastPivotConfig, window.lastPivotColumnTotals || {}, window.lastPivotGrandTotal || 0);
            }
        };
        chartTypeLabel.appendChild(chartTypeSelect);
        controlsDiv.appendChild(chartTypeLabel);

        // Chart limit controls
        const limitsLabel = document.createElement('label');
        limitsLabel.style.cssText = 'font-size: 0.9em; display: flex; align-items: center; gap: 8px;';
        limitsLabel.innerHTML = '<span>Max Items:</span>';

        const maxItemsInput = document.createElement('input');
        maxItemsInput.id = 'pivotChartMaxItems';
        maxItemsInput.type = 'number';
        maxItemsInput.min = '5';
        maxItemsInput.max = '100';
        maxItemsInput.value = '20';
        maxItemsInput.style.cssText = 'width: 60px; padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-primary); color: var(--text-primary); font-size: 0.9em;';
        maxItemsInput.title = 'Maximum rows/columns to show in chart';
        maxItemsInput.onchange = () => {
            if (window.lastPivotConfig && window.lastPivotData) {
                createPivotChart(window.lastPivotData, window.lastPivotColumns || [], window.lastPivotConfig, window.lastPivotColumnTotals || {}, window.lastPivotGrandTotal || 0);
            }
        };
        limitsLabel.appendChild(maxItemsInput);
        controlsDiv.appendChild(limitsLabel);

        // Swap axes button (only show if there are columns)
        const swapButton = document.createElement('button');
        swapButton.id = 'pivotChartSwapAxes';
        swapButton.style.cssText = 'padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); cursor: pointer; font-size: 0.9em;';
        swapButton.innerHTML = '🔄 Swap Axes';
        swapButton.title = 'Swap rows and columns in chart';
        swapButton.onclick = () => {
            const currentState = swapButton.dataset.swapped === 'true';
            swapButton.dataset.swapped = !currentState ? 'true' : 'false';
            swapButton.innerHTML = swapButton.dataset.swapped === 'true' ? '🔄 Swap Axes (Active)' : '🔄 Swap Axes';
            if (window.lastPivotConfig && window.lastPivotData) {
                createPivotChart(window.lastPivotData, window.lastPivotColumns || [], window.lastPivotConfig, window.lastPivotColumnTotals || {}, window.lastPivotGrandTotal || 0);
            }
        };
        swapButton.dataset.swapped = 'false';
        controlsDiv.appendChild(swapButton);

        // Hide swap button initially if no columns
        if (!config.column || sortedColumns.length === 0) {
            swapButton.style.display = 'none';
        }

        titleRow.appendChild(controlsDiv);
        chartContainer.appendChild(titleRow);

        const canvasWrapper = document.createElement('div');
        canvasWrapper.style.cssText = 'position: relative; height: 400px; max-height: 600px;';

        const canvas = document.createElement('canvas');
        canvas.id = 'pivotChart';
        canvasWrapper.appendChild(canvas);

        chartContainer.appendChild(canvasWrapper);

        // Will be appended after the pivot table
        const resultsDiv = document.getElementById('pivotBuilderResults');
        resultsDiv.appendChild(chartContainer);
    }

    const ctx = document.getElementById('pivotChart');
    if (!ctx) return;

    // Get swap axes state
    const swapButton = document.getElementById('pivotChartSwapAxes');
    const isSwapped = swapButton && swapButton.dataset.swapped === 'true';

    // Get max items limit
    const maxItemsInput = document.getElementById('pivotChartMaxItems');
    const maxItems = maxItemsInput ? parseInt(maxItemsInput.value) || 20 : 20;

    // Update swap button visibility based on whether we have columns
    if (swapButton) {
        if (config.column && sortedColumns.length > 0 && chartType !== 'pie' && chartType !== 'doughnut') {
            swapButton.style.display = 'inline-block';
        } else {
            swapButton.style.display = 'none';
        }
    }

    // Prepare chart data
    let labels = rowsArray.map(row => row.rowValues.join(' → '));
    let datasets = [];

    // If swapped and we have columns, transpose the data
    if (isSwapped && config.column && sortedColumns.length > 0 && chartType !== 'pie' && chartType !== 'doughnut') {
        // Swapped: columns become labels, rows become datasets
        labels = sortedColumns.slice(0, maxItems);

        const colors = [
            '#667eea', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
            '#6f42c1', '#fd7e14', '#20c997', '#e83e8c', '#6c757d'
        ];

        const maxRows = Math.min(maxItems, rowsArray.length);
        rowsArray.slice(0, maxRows).forEach((row, index) => {
            const data = sortedColumns.slice(0, maxItems).map(col => row.columns[col] || 0);
            datasets.push({
                label: row.rowValues.join(' → '),
                data: data,
                backgroundColor: chartType === 'line' ? 'transparent' : colors[index % colors.length],
                borderColor: colors[index % colors.length],
                borderWidth: chartType === 'line' ? 2 : 1,
                fill: chartType === 'line' ? false : undefined,
                tension: chartType === 'line' ? 0.4 : undefined
            });
        });

        if (rowsArray.length > maxItems) {
            const noteDiv = document.createElement('div');
            noteDiv.style.cssText = 'margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 6px; color: #856404;';
            noteDiv.textContent = `Note: Showing top ${maxItems} of ${rowsArray.length} rows as separate series. Adjust "Max Items" to show more.`;
            if (!chartContainer.querySelector('.chart-note-rows')) {
                noteDiv.className = 'chart-note-rows';
                chartContainer.appendChild(noteDiv);
            }
        }
    } else if (config.column && sortedColumns.length > 0) {
        // Grouped/stacked bar chart with multiple series (one per column)
        const displayColumns = sortedColumns.slice(0, maxItems);

        const colors = [
            '#667eea', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
            '#6f42c1', '#fd7e14', '#20c997', '#e83e8c', '#6c757d'
        ];

        displayColumns.forEach((col, index) => {
            const data = rowsArray.map(row => row.columns[col] || 0);
            datasets.push({
                label: col,
                data: data,
                backgroundColor: chartType === 'line' ? 'transparent' : colors[index % colors.length],
                borderColor: colors[index % colors.length],
                borderWidth: chartType === 'line' ? 2 : 1,
                fill: chartType === 'line' ? false : undefined,
                tension: chartType === 'line' ? 0.4 : undefined
            });
        });

        if (sortedColumns.length > maxItems) {
            // Add a note if columns were truncated
            const noteDiv = document.createElement('div');
            noteDiv.style.cssText = 'margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 6px; color: #856404;';
            noteDiv.textContent = `Note: Showing top ${maxItems} of ${sortedColumns.length} columns. Adjust "Max Items" to show more.`;
            chartContainer.appendChild(noteDiv);
        }
    } else {
        // Simple bar chart with totals
        const data = rowsArray.map(row => {
            const rowTotal = Object.values(row.columns).reduce((sum, val) => sum + val, 0);
            return rowTotal;
        });

        datasets.push({
            label: config.aggregation.toUpperCase(),
            data: data,
            backgroundColor: '#667eea',
            borderColor: '#667eea',
            borderWidth: 1
        });
    }

    // Limit to user-specified max rows for chart readability
    if (labels.length > maxItems && chartType !== 'pie' && chartType !== 'doughnut') {
        labels.splice(maxItems);
        datasets.forEach(ds => ds.data.splice(maxItems));

        const noteDiv = document.createElement('div');
        noteDiv.style.cssText = 'margin-top: 10px; padding: 10px; background: #fff3cd; border-radius: 6px; color: #856404;';
        noteDiv.textContent = `Note: Showing top ${maxItems} of ${rowsArray.length} rows. Adjust "Max Items" to show more.`;

        if (!chartContainer.querySelector('.chart-note')) {
            noteDiv.className = 'chart-note';
            chartContainer.appendChild(noteDiv);
        }
    }

    // For pie/doughnut charts, restructure data to use single dataset
    if (chartType === 'pie' || chartType === 'doughnut') {
        const colors = [
            '#667eea', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
            '#6f42c1', '#fd7e14', '#20c997', '#e83e8c', '#6c757d',
            '#f8b739', '#5856d6', '#ff2d55', '#5ac8fa', '#34c759'
        ];

        if (config.column && sortedColumns.length > 0) {
            // Multiple series: show totals per column
            const columnTotalsArray = sortedColumns.map(col => columnTotals[col] || 0);
            datasets = [{
                data: columnTotalsArray,
                backgroundColor: colors.slice(0, sortedColumns.length),
                borderColor: '#fff',
                borderWidth: 2
            }];
            // Use column names as labels for pie/doughnut
            labels.length = 0;
            labels.push(...sortedColumns);
        } else {
            // Single series: show top N rows
            const topN = Math.min(maxItems, rowsArray.length);
            const data = rowsArray.slice(0, topN).map(row => {
                return Object.values(row.columns).reduce((sum, val) => sum + val, 0);
            });
            const pieLabels = rowsArray.slice(0, topN).map(row => row.rowValues.join(' → '));
            datasets = [{
                data: data,
                backgroundColor: colors.slice(0, topN),
                borderColor: '#fff',
                borderWidth: 2
            }];
            labels.length = 0;
            labels.push(...pieLabels);
        }
    }

    // Determine actual chart type for Chart.js
    let actualChartType = chartType;
    let indexAxis = 'x';
    if (chartType === 'horizontalBar') {
        actualChartType = 'bar';
        indexAxis = 'y';
    }

    // Create chart
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: indexAxis,
        plugins: {
            legend: {
                display: true,
                position: chartType === 'pie' || chartType === 'doughnut' ? 'right' : 'top',
                labels: {
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary'),
                    boxWidth: 15,
                    padding: 10
                }
            },
            title: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || context.label || '';
                        if (label) {
                            label += ': ';
                        }
                        const value = chartType === 'pie' || chartType === 'doughnut'
                            ? context.parsed
                            : (indexAxis === 'y' ? context.parsed.x : context.parsed.y);
                        label += formatNumber(value);
                        return label;
                    }
                }
            }
        }
    };

    // Add scales only for bar/line charts (not pie/doughnut)
    if (chartType !== 'pie' && chartType !== 'doughnut') {
        chartOptions.scales = {
            x: {
                stacked: false,
                ticks: {
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                    maxRotation: 45,
                    minRotation: 0
                },
                grid: {
                    color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
                }
            },
            y: {
                stacked: false,
                beginAtZero: true,
                ticks: {
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary'),
                    callback: function(value) {
                        return formatNumber(value);
                    }
                },
                grid: {
                    color: getComputedStyle(document.documentElement).getPropertyValue('--border-color')
                }
            }
        };
    }

    pivotChartInstance = new Chart(ctx, {
        type: actualChartType,
        data: {
            labels: labels,
            datasets: datasets
        },
        options: chartOptions
    });
}

// Save pivot preset to localStorage
function savePivotPreset() {
    const presetName = document.getElementById('pivotPresetName').value.trim();

    if (!presetName) {
        alert('Please enter a preset name');
        return;
    }

    const config = {
        row1: document.getElementById('pivotRow1').value,
        row2: document.getElementById('pivotRow2').value,
        row3: document.getElementById('pivotRow3').value,
        column: document.getElementById('pivotColumn').value,
        measureField: document.getElementById('pivotMeasureField').value,
        aggregation: document.getElementById('pivotAggregation').value,
        // Save sort state
        sortColumn: pivotBuilderSortState.column,
        sortDirection: pivotBuilderSortState.direction,
        // Save color highlight setting
        colorHighlight: document.getElementById('pivotColorHighlight').checked,
        // Save chart type
        chartType: document.getElementById('pivotChartType')?.value || 'bar',
        // Save chart swap state
        chartSwapped: document.getElementById('pivotChartSwapAxes')?.dataset.swapped === 'true',
        // Save max items
        chartMaxItems: parseInt(document.getElementById('pivotChartMaxItems')?.value) || 20
    };

    try {
        const presets = JSON.parse(localStorage.getItem('pivotPresets') || '{}');
        presets[presetName] = config;
        localStorage.setItem('pivotPresets', JSON.stringify(presets));

        alert(`✓ Preset "${presetName}" saved successfully`);
        loadPivotPresetsIntoDropdown();
    } catch (error) {
        console.error('Error saving pivot preset:', error);
        alert('Error saving preset: ' + error.message);
    }
}

// Load pivot presets into dropdown
function loadPivotPresetsIntoDropdown() {
    const selector = document.getElementById('pivotPresetSelector');

    try {
        const presets = JSON.parse(localStorage.getItem('pivotPresets') || '{}');
        const presetNames = Object.keys(presets).sort();

        // Clear existing options except first
        selector.innerHTML = '<option value="">-- Select Preset --</option>';

        presetNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            selector.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading pivot presets:', error);
    }
}

// Load selected pivot preset
function loadPivotPreset() {
    const selector = document.getElementById('pivotPresetSelector');
    const presetName = selector.value;

    if (!presetName) return;

    try {
        const presets = JSON.parse(localStorage.getItem('pivotPresets') || '{}');
        const config = presets[presetName];

        if (config) {
            document.getElementById('pivotRow1').value = config.row1 || '';
            document.getElementById('pivotRow2').value = config.row2 || '';
            document.getElementById('pivotRow3').value = config.row3 || '';
            document.getElementById('pivotColumn').value = config.column || '';
            document.getElementById('pivotMeasureField').value = config.measureField || 'durDec';
            document.getElementById('pivotAggregation').value = config.aggregation || 'sum';
            document.getElementById('pivotPresetName').value = presetName;

            // Restore sort state
            if (config.sortColumn !== undefined) {
                pivotBuilderSortState.column = config.sortColumn;
                pivotBuilderSortState.direction = config.sortDirection || 'desc';
            } else {
                // Reset sort state if not saved in preset
                pivotBuilderSortState.column = null;
                pivotBuilderSortState.direction = 'desc';
            }

            // Restore color highlight setting
            if (config.colorHighlight !== undefined) {
                document.getElementById('pivotColorHighlight').checked = config.colorHighlight;
            } else {
                // Default to enabled if not saved in preset
                document.getElementById('pivotColorHighlight').checked = true;
            }

            // Restore chart type
            const chartTypeSelect = document.getElementById('pivotChartType');
            if (chartTypeSelect) {
                if (config.chartType) {
                    chartTypeSelect.value = config.chartType;
                } else {
                    chartTypeSelect.value = 'bar';
                }
            }

            // Restore chart swap state
            const swapButton = document.getElementById('pivotChartSwapAxes');
            if (swapButton) {
                const shouldSwap = config.chartSwapped === true;
                swapButton.dataset.swapped = shouldSwap ? 'true' : 'false';
                swapButton.innerHTML = shouldSwap ? '🔄 Swap Axes (Active)' : '🔄 Swap Axes';
            }

            // Restore max items
            const maxItemsInput = document.getElementById('pivotChartMaxItems');
            if (maxItemsInput) {
                if (config.chartMaxItems) {
                    maxItemsInput.value = config.chartMaxItems;
                } else {
                    maxItemsInput.value = '20';
                }
            }

            // Auto-build pivot table after loading preset
            setTimeout(() => buildPivotTable(), 100);
        }
    } catch (error) {
        console.error('Error loading pivot preset:', error);
        alert('Error loading preset: ' + error.message);
    }
}

// Delete selected pivot preset
function deletePivotPreset() {
    const selector = document.getElementById('pivotPresetSelector');
    const presetName = selector.value;

    if (!presetName) {
        alert('Please select a preset to delete');
        return;
    }

    if (!confirm(`Delete preset "${presetName}"?`)) {
        return;
    }

    try {
        const presets = JSON.parse(localStorage.getItem('pivotPresets') || '{}');
        delete presets[presetName];
        localStorage.setItem('pivotPresets', JSON.stringify(presets));

        alert(`✓ Preset "${presetName}" deleted`);
        loadPivotPresetsIntoDropdown();

        // Clear form
        document.getElementById('pivotPresetName').value = '';
        selector.value = '';
    } catch (error) {
        console.error('Error deleting pivot preset:', error);
        alert('Error deleting preset: ' + error.message);
    }
}

// Setup pivot builder sorting event listeners
function setupPivotBuilderSorting() {
    document.querySelectorAll('#pivotBuilderResults .pivot-table th.sortable').forEach(th => {
        th.addEventListener('click', function() {
            const column = this.dataset.column;
            const type = this.dataset.type || 'text';

            // Toggle sort direction
            if (pivotBuilderSortState.column === column) {
                pivotBuilderSortState.direction = pivotBuilderSortState.direction === 'asc' ? 'desc' : 'asc';
            } else {
                pivotBuilderSortState.column = column;
                pivotBuilderSortState.direction = type === 'number' ? 'desc' : 'asc';
            }

            // Re-render pivot table with sorting
            const config = window.lastPivotConfig;
            const aggregatedData = window.lastPivotData;
            if (config && aggregatedData) {
                renderPivotTable(aggregatedData, config);
            }
        });
    });
}

// Load quick pivot configurations
function loadQuickPivot(type) {
    const configs = {
        'monthlyByProduct': {
            row1: 'mainProduct',
            row2: 'customerProject',
            row3: '',
            column: 'month',
            measureField: 'durDec',
            aggregation: 'sum'
        },
        'billingByProject': {
            row1: 'mainProduct',
            row2: 'customerProject',
            row3: '',
            column: 'mtype2',
            measureField: 'durDec',
            aggregation: 'sum'
        },
        'employeeByMonth': {
            row1: 'name',
            row2: 'customerProject',
            row3: '',
            column: 'month',
            measureField: 'durDec',
            aggregation: 'sum'
        }
    };

    const config = configs[type];
    if (config) {
        document.getElementById('pivotRow1').value = config.row1 || '';
        document.getElementById('pivotRow2').value = config.row2 || '';
        document.getElementById('pivotRow3').value = config.row3 || '';
        document.getElementById('pivotColumn').value = config.column || '';
        document.getElementById('pivotMeasureField').value = config.measureField || 'durDec';
        document.getElementById('pivotAggregation').value = config.aggregation || 'sum';

        // Reset sort state for quick presets
        pivotBuilderSortState.column = null;
        pivotBuilderSortState.direction = 'desc';
    }
}

// Export pivot table to CSV
function exportPivotTableToCSV() {
    const config = window.lastPivotConfig;
    const aggregatedData = window.lastPivotData;

    if (!config || !aggregatedData || aggregatedData.length === 0) {
        alert('Please build a pivot table first before exporting');
        return;
    }

    try {
        // Group data by rows and columns (same logic as renderPivotTable)
        const rowsMap = new Map();
        const columnsSet = new Set();

        aggregatedData.forEach(item => {
            const rowKey = item.rowValues.join('|');
            if (!rowsMap.has(rowKey)) {
                rowsMap.set(rowKey, {
                    rowValues: item.rowValues,
                    columns: {}
                });
            }

            const rowEntry = rowsMap.get(rowKey);
            const columnKey = item.columnValue || '_total';

            if (item.columnValue) {
                columnsSet.add(item.columnValue);
            }

            // Calculate aggregated value based on aggregation type
            let aggregatedValue = 0;
            switch (config.aggregation) {
                case 'sum':
                    aggregatedValue = item.sum;
                    break;
                case 'avg':
                    aggregatedValue = item.count > 0 ? item.sum / item.count : 0;
                    break;
                case 'count':
                    aggregatedValue = item.count;
                    break;
                case 'min':
                    aggregatedValue = item.min !== Infinity ? item.min : 0;
                    break;
                case 'max':
                    aggregatedValue = item.max !== -Infinity ? item.max : 0;
                    break;
            }

            rowEntry.columns[columnKey] = aggregatedValue;
        });

        // Sort columns - chronologically for months, alphabetically for others
        const sortedColumns = config.column ? sortColumns(Array.from(columnsSet), config.column) : [];

        // Generate CSV content with European format (semicolon delimiter, comma decimals)
        let csvContent = '';

        // Row field labels
        const rowFieldLabels = {
            'mainProduct': 'Main Product',
            'customerProject': 'Customer:Project',
            'name': 'Name (Employee)',
            'mtype2': 'Type (MTYPE2)',
            'task': 'Task',
            'department': 'Department',
            'projectType': 'Project Type',
            'month': 'Month'
        };

        // Add header row
        const headers = [];
        config.rows.forEach(field => {
            headers.push(rowFieldLabels[field] || field);
        });

        if (config.column && sortedColumns.length > 0) {
            sortedColumns.forEach(col => headers.push(col));
        }
        headers.push('Total');

        csvContent += headers.join(';') + '\n';

        // Add data rows
        rowsMap.forEach((rowEntry) => {
            const row = [];

            // Row values
            rowEntry.rowValues.forEach(value => {
                row.push(escapeCSVField(value));
            });

            // Column values
            let rowTotal = 0;
            if (config.column && sortedColumns.length > 0) {
                sortedColumns.forEach(col => {
                    const value = rowEntry.columns[col] || 0;
                    rowTotal += value;
                    const formattedValue = formatNumberWithSeparator(value.toFixed(2));
                    row.push(formattedValue);
                });
            } else {
                // No column pivot, just use total
                rowTotal = rowEntry.columns['_total'] || 0;
            }

            // Row total
            row.push(formatNumberWithSeparator(rowTotal.toFixed(2)));

            csvContent += row.join(';') + '\n';
        });

        // Add GRAND TOTAL row
        const grandTotalRow = [];
        config.rows.forEach(() => grandTotalRow.push('')); // Empty cells for row fields
        grandTotalRow[config.rows.length - 1] = 'GRAND TOTAL';

        const columnTotals = {};
        sortedColumns.forEach(col => columnTotals[col] = 0);
        let grandTotal = 0;

        rowsMap.forEach((rowEntry) => {
            if (config.column && sortedColumns.length > 0) {
                sortedColumns.forEach(col => {
                    const value = rowEntry.columns[col] || 0;
                    columnTotals[col] += value;
                    grandTotal += value;
                });
            } else {
                grandTotal += rowEntry.columns['_total'] || 0;
            }
        });

        if (config.column && sortedColumns.length > 0) {
            sortedColumns.forEach(col => {
                grandTotalRow.push(formatNumberWithSeparator(columnTotals[col].toFixed(2)));
            });
        }
        grandTotalRow.push(formatNumberWithSeparator(grandTotal.toFixed(2)));

        csvContent += grandTotalRow.join(';') + '\n';

        // Create blob with UTF-8 BOM for Excel compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

        // Generate filename with timestamp
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `pivot_table_${timestamp}.csv`;

        // Trigger download
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            alert(`✓ Exported pivot table (${rowsMap.size.toLocaleString()} rows) to ${filename}`);
        } else {
            alert('Your browser does not support file downloads');
        }
    } catch (error) {
        alert('Error exporting pivot table: ' + error.message);
        console.error('Export error:', error);
    }
}

// Show drill-down modal with detail records
function showDrilldownModal(detailRecords, cellInfo) {
    const modal = document.getElementById('drilldownModal');
    const content = document.getElementById('drilldownContent');

    if (detailRecords.length === 0) {
        content.innerHTML = '<p style="color: #6c757d; text-align: center;">No detail records found.</p>';
        modal.style.display = 'block';
        return;
    }

    // Store records globally for sorting and export
    drilldownRecords = [...detailRecords];
    drilldownSortState = { column: null, direction: 'asc' };

    renderDrilldownTable(cellInfo);
    modal.style.display = 'block';
}

// Render drill-down table with current sort state
function renderDrilldownTable(cellInfo) {
    const content = document.getElementById('drilldownContent');

    // Apply sorting if a column is selected
    if (drilldownSortState.column !== null) {
        const column = drilldownSortState.column;
        const direction = drilldownSortState.direction;

        drilldownRecords.sort((a, b) => {
            let aValue, bValue;

            switch (column) {
                case 'date':
                    aValue = parseDate(a[COLUMNS.DATE]) || new Date(0);
                    bValue = parseDate(b[COLUMNS.DATE]) || new Date(0);
                    break;
                case 'mainProduct':
                    aValue = (a[COLUMNS.MAIN_PRODUCT] || '').toLowerCase();
                    bValue = (b[COLUMNS.MAIN_PRODUCT] || '').toLowerCase();
                    break;
                case 'customerProject':
                    aValue = (a[COLUMNS.CUSTOMER_PROJECT] || '').toLowerCase();
                    bValue = (b[COLUMNS.CUSTOMER_PROJECT] || '').toLowerCase();
                    break;
                case 'employee':
                    aValue = (a[COLUMNS.NAME] || '').toLowerCase();
                    bValue = (b[COLUMNS.NAME] || '').toLowerCase();
                    break;
                case 'type':
                    aValue = (a[COLUMNS.MTYPE2] || '').toLowerCase();
                    bValue = (b[COLUMNS.MTYPE2] || '').toLowerCase();
                    break;
                case 'task':
                    aValue = (a[COLUMNS.TASK] || '').toLowerCase();
                    bValue = (b[COLUMNS.TASK] || '').toLowerCase();
                    break;
                case 'duration':
                    aValue = parseDecimal(a[COLUMNS.DUR_DEC]);
                    bValue = parseDecimal(b[COLUMNS.DUR_DEC]);
                    break;
            }

            if (aValue instanceof Date && bValue instanceof Date) {
                return direction === 'asc' ? aValue - bValue : bValue - aValue;
            } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                return direction === 'asc' ? aValue - bValue : bValue - aValue;
            } else {
                const comparison = String(aValue).localeCompare(String(bValue));
                return direction === 'asc' ? comparison : -comparison;
            }
        });
    }

    // Build summary with export button
    let summary = `<div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin-bottom: 20px;">`;
    summary += `<div style="display: flex; justify-content: space-between; align-items: center;">`;
    summary += `<div>`;
    summary += `<h3 style="margin: 0 0 10px 0;">Cell Information</h3>`;
    summary += `<p style="margin: 5px 0;"><strong>Rows:</strong> ${cellInfo.rows}</p>`;
    if (cellInfo.column) {
        summary += `<p style="margin: 5px 0;"><strong>Column:</strong> ${cellInfo.column}</p>`;
    }
    summary += `<p style="margin: 5px 0;"><strong>Record Count:</strong> ${drilldownRecords.length.toLocaleString()}</p>`;
    summary += `</div>`;
    summary += `<button onclick="exportDrilldownToCSV()" class="btn-secondary" style="padding: 10px 20px; white-space: nowrap;">📥 Export to CSV</button>`;
    summary += `</div>`;
    summary += `</div>`;

    // Build detail table with sortable headers
    let tableHTML = `<div style="max-height: 600px; overflow-y: auto; border: 1px solid #dee2e6; border-radius: 8px;">`;
    tableHTML += `<table class="data-table" style="margin: 0;">`;
    tableHTML += `<thead><tr>`;

    const columns = [
        { name: 'date', label: 'Date', type: 'date' },
        { name: 'mainProduct', label: 'Main Product', type: 'text' },
        { name: 'customerProject', label: 'Customer:Project', type: 'text' },
        { name: 'employee', label: 'Employee', type: 'text' },
        { name: 'type', label: 'Type', type: 'text' },
        { name: 'task', label: 'Task', type: 'text' },
        { name: 'duration', label: 'Duration (Hours)', type: 'number' }
    ];

    columns.forEach(col => {
        const sortIndicator = drilldownSortState.column === col.name
            ? (drilldownSortState.direction === 'asc' ? ' ▲' : ' ▼')
            : '';
        tableHTML += `<th class="sortable" style="cursor: pointer;" onclick="sortDrilldownTable('${col.name}')">${col.label}${sortIndicator}</th>`;
    });

    tableHTML += `</tr></thead>`;
    tableHTML += `<tbody>`;

    drilldownRecords.forEach(row => {
        tableHTML += `<tr>`;
        tableHTML += `<td>${escapeHtml(row[COLUMNS.DATE] || '')}</td>`;
        tableHTML += `<td>${escapeHtml(row[COLUMNS.MAIN_PRODUCT] || '(Empty)')}</td>`;
        tableHTML += `<td>${escapeHtml(row[COLUMNS.CUSTOMER_PROJECT] || '(Empty)')}</td>`;
        tableHTML += `<td>${escapeHtml(row[COLUMNS.NAME] || '(Empty)')}</td>`;
        tableHTML += `<td>${escapeHtml(row[COLUMNS.MTYPE2] || '(Empty)')}</td>`;
        tableHTML += `<td>${escapeHtml(row[COLUMNS.TASK] || '(Empty)')}</td>`;
        tableHTML += `<td>${formatNumber(parseDecimal(row[COLUMNS.DUR_DEC]))}</td>`;
        tableHTML += `</tr>`;
    });

    tableHTML += `</tbody></table></div>`;

    content.innerHTML = summary + tableHTML;
}

// Sort drill-down table
function sortDrilldownTable(column) {
    // Toggle sort direction
    if (drilldownSortState.column === column) {
        drilldownSortState.direction = drilldownSortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        drilldownSortState.column = column;
        drilldownSortState.direction = 'asc';
    }

    // Get cellInfo from current display
    const content = document.getElementById('drilldownContent');
    const rowsText = content.querySelector('p strong').nextSibling.textContent.trim();
    const columnText = content.querySelectorAll('p')[1] ? content.querySelectorAll('p')[1].querySelector('strong') : null;

    const cellInfo = {
        rows: rowsText,
        column: columnText ? columnText.nextSibling.textContent.trim() : null
    };

    renderDrilldownTable(cellInfo);
}

// Export drill-down records to CSV
function exportDrilldownToCSV() {
    if (drilldownRecords.length === 0) {
        alert('No records to export');
        return;
    }

    try {
        // Generate CSV content with European format
        let csvContent = '';

        // Add header row
        csvContent += 'Date;Main Product;Customer:Project;Employee;Type;Task;Duration (Hours)\n';

        // Add data rows
        drilldownRecords.forEach(row => {
            const date = escapeCSVField(row[COLUMNS.DATE] || '');
            const mainProduct = escapeCSVField(row[COLUMNS.MAIN_PRODUCT] || '(Empty)');
            const customerProject = escapeCSVField(row[COLUMNS.CUSTOMER_PROJECT] || '(Empty)');
            const employee = escapeCSVField(row[COLUMNS.NAME] || '(Empty)');
            const type = escapeCSVField(row[COLUMNS.MTYPE2] || '(Empty)');
            const task = escapeCSVField(row[COLUMNS.TASK] || '(Empty)');
            const duration = formatNumberWithSeparator(parseDecimal(row[COLUMNS.DUR_DEC]).toFixed(2));

            csvContent += `${date};${mainProduct};${customerProject};${employee};${type};${task};${duration}\n`;
        });

        // Create blob with UTF-8 BOM for Excel compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

        // Generate filename with timestamp
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `pivot_drilldown_${timestamp}.csv`;

        // Trigger download
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            alert(`✓ Exported ${drilldownRecords.length.toLocaleString()} records to ${filename}`);
        } else {
            alert('Your browser does not support file downloads');
        }
    } catch (error) {
        alert('Error exporting data: ' + error.message);
        console.error('Export error:', error);
    }
}

// Close drill-down modal
function closeDrilldownModal() {
    const modal = document.getElementById('drilldownModal');
    modal.style.display = 'none';
}

// ========== CACHE FUNCTIONS ==========

// Save data to localStorage
// IndexedDB cache implementation (replaces localStorage to handle large datasets)
const DB_NAME = 'NetSuiteTimeTrackingDB';
const DB_VERSION = 1;
const STORE_NAME = 'dataCache';

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
}

// Save data to IndexedDB cache
async function saveToCache(data) {
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Store data with timestamp
        store.put({ data: data, timestamp: Date.now() }, 'netsuite_data');

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                console.log('✅ Data cached successfully in IndexedDB:', data.length, 'rows');
                resolve();
            };
            transaction.onerror = () => {
                console.error('❌ Failed to cache data:', transaction.error);
                reject(transaction.error);
            };
        });
    } catch (error) {
        console.error('❌ Cannot cache data:', error.message);
    }
}

// Load data from IndexedDB cache
async function loadFromCache() {
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get('netsuite_data');

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const result = request.result;
                if (!result) {
                    console.log('No cached data found');
                    resolve(null);
                    return;
                }

                // Check if cache is older than 7 days
                const cacheAge = Date.now() - result.timestamp;
                const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

                if (cacheAge > maxAge) {
                    console.log('Cache expired (>7 days), will reload data');
                    clearCache();
                    resolve(null);
                    return;
                }

                console.log('✅ Data loaded from IndexedDB cache:', result.data.length, 'rows');
                resolve(result.data);
            };
            request.onerror = () => {
                console.warn('Failed to load cached data:', request.error);
                resolve(null);
            };
        });
    } catch (error) {
        console.warn('Failed to access cache:', error.message);
        return null;
    }
}

// Clear IndexedDB cache
async function clearCache() {
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.delete('netsuite_data');

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                console.log('Cache cleared');
                resolve();
            };
            transaction.onerror = () => {
                console.warn('Failed to clear cache:', transaction.error);
                reject(transaction.error);
            };
        });
    } catch (error) {
        console.warn('Failed to clear cache:', error.message);
    }
}

// Export filtered data to CSV
function exportToCSV() {
    if (aggregatedData.length === 0) {
        showError('No data to export. Please load data first.');
        return;
    }

    try {
        // Generate CSV content with European format (semicolon delimiter, comma decimals)
        let csvContent = '';

        // Add header row
        csvContent += 'Main Product;Customer:Project;Name;Type;Task;Total Hours\n';

        // Add data rows
        aggregatedData.forEach(item => {
            // Escape fields that contain semicolons or quotes
            const mainProduct = escapeCSVField(item.mainProduct);
            const customerProject = escapeCSVField(item.customerProject);
            const name = escapeCSVField(item.name);
            const mtype2 = escapeCSVField(item.mtype2);
            const task = escapeCSVField(item.task);

            // Format hours with user's decimal separator preference
            const totalHours = formatNumberWithSeparator(item.totalHours.toFixed(2));

            csvContent += `${mainProduct};${customerProject};${name};${mtype2};${task};${totalHours}\n`;
        });

        // Create blob with UTF-8 BOM for Excel compatibility
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

        // Generate filename with timestamp
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const filename = `netsuite_time_tracking_${timestamp}.csv`;

        // Trigger download
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            showSuccess(`Exported ${aggregatedData.length.toLocaleString()} records to ${filename}`);
        } else {
            showError('Your browser does not support file downloads');
        }
    } catch (error) {
        showError('Error exporting data: ' + error.message);
        console.error('Export error:', error);
    }
}

// Escape CSV field (add quotes if contains semicolon, quote, or newline)
function escapeCSVField(field) {
    if (field === null || field === undefined) {
        return '';
    }

    const str = String(field);

    // If field contains semicolon, quote, or newline, wrap in quotes and escape internal quotes
    if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }

    return str;
}

// ============================================================================
// Settings Functions
// ============================================================================

// Initialize settings on page load
function initializeSettings() {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
        try {
            appSettings = JSON.parse(savedSettings);
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }

    // Apply dark mode based on settings
    applyDarkMode();

    // Set decimal separator dropdown
    const decimalSelect = document.getElementById('decimalSeparator');
    if (decimalSelect) {
        decimalSelect.value = appSettings.decimalSeparator || 'comma';
    }

    // Set norm hours inputs
    if (!appSettings.normHoursPerWeek) {
        appSettings.normHoursPerWeek = {
            'EGDK': 37,
            'EGXX': 37,
            'ZASE': 37,
            'EGPL': 40,
            'EGSU': 40,
            'Other': 37
        };
    }
    document.getElementById('normHoursEGDK').value = appSettings.normHoursPerWeek.EGDK || 37;
    document.getElementById('normHoursEGXX').value = appSettings.normHoursPerWeek.EGXX || 37;
    document.getElementById('normHoursZASE').value = appSettings.normHoursPerWeek.ZASE || 37;
    document.getElementById('normHoursEGPL').value = appSettings.normHoursPerWeek.EGPL || 40;
    document.getElementById('normHoursEGSU').value = appSettings.normHoursPerWeek.EGSU || 40;
    document.getElementById('normHoursOther').value = appSettings.normHoursPerWeek.Other || 37;

    // Setup dark mode toggle based on current state
    updateDarkModeToggle();

    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (appSettings.darkMode === null) {
                // Only auto-update if user hasn't manually set a preference
                applyDarkMode();
            }
        });
    }
}

// Open settings modal
function openSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'block';
        // Update toggle to reflect current state
        updateDarkModeToggle();
        // Load anomaly whitelist
        loadAnomalyWhitelist();
    }
}

// Close settings modal
function closeSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Close modal when clicking outside of it
window.addEventListener('click', function(event) {
    const modal = document.getElementById('settingsModal');
    if (event.target === modal) {
        closeSettings();
    }
});

// Toggle dark mode
function toggleDarkMode() {
    const toggle = document.getElementById('darkModeToggle');

    if (toggle.checked) {
        // User manually enabled dark mode
        appSettings.darkMode = true;
    } else {
        // User manually disabled dark mode
        appSettings.darkMode = false;
    }

    // Save settings
    localStorage.setItem('appSettings', JSON.stringify(appSettings));

    // Apply dark mode
    applyDarkMode();
}

// Apply dark mode based on settings and system preference
function applyDarkMode() {
    const body = document.body;
    let shouldBeDark = false;

    if (appSettings.darkMode === null) {
        // Follow system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            shouldBeDark = true;
        }
    } else {
        // Use manual setting
        shouldBeDark = appSettings.darkMode;
    }

    if (shouldBeDark) {
        body.classList.add('dark-mode');
    } else {
        body.classList.remove('dark-mode');
    }
}

// Update dark mode toggle to reflect current state
function updateDarkModeToggle() {
    const toggle = document.getElementById('darkModeToggle');
    if (!toggle) return;

    let shouldBeDark = false;

    if (appSettings.darkMode === null) {
        // Follow system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            shouldBeDark = true;
        }
    } else {
        // Use manual setting
        shouldBeDark = appSettings.darkMode;
    }

    toggle.checked = shouldBeDark;
}

// Save decimal separator setting
function saveDecimalSeparator() {
    const select = document.getElementById('decimalSeparator');
    if (select) {
        appSettings.decimalSeparator = select.value;
        localStorage.setItem('appSettings', JSON.stringify(appSettings));
        showSuccess('Decimal separator setting saved. Will apply to future exports.');
    }
}

// ============================================
// ANOMALY WHITELIST MANAGEMENT
// ============================================

// Save anomaly whitelist to localStorage
function saveAnomalyWhitelist() {
    const weekendWhitelist = document.getElementById('weekendWhitelist');
    const timeGapWhitelist = document.getElementById('timeGapWhitelist');
    const excessiveHoursWhitelist = document.getElementById('excessiveHoursWhitelist');

    if (!weekendWhitelist || !timeGapWhitelist || !excessiveHoursWhitelist) return;

    const whitelist = {
        weekendWork: weekendWhitelist.value.split('\n').map(name => name.trim()).filter(name => name),
        timeGap: timeGapWhitelist.value.split('\n').map(name => name.trim()).filter(name => name),
        excessiveHours: excessiveHoursWhitelist.value.split('\n').map(name => name.trim()).filter(name => name)
    };

    localStorage.setItem('anomalyWhitelist', JSON.stringify(whitelist));
    showSuccess('Anomaly whitelist saved. Re-run detection to apply changes.');
}

// Load anomaly whitelist from localStorage
function loadAnomalyWhitelist(showMessage = false) {
    const stored = localStorage.getItem('anomalyWhitelist');
    if (!stored) {
        if (showMessage) showInfo('No saved whitelist found.');
        return;
    }

    try {
        const whitelist = JSON.parse(stored);
        const weekendWhitelist = document.getElementById('weekendWhitelist');
        const timeGapWhitelist = document.getElementById('timeGapWhitelist');
        const excessiveHoursWhitelist = document.getElementById('excessiveHoursWhitelist');

        if (weekendWhitelist && whitelist.weekendWork) {
            weekendWhitelist.value = whitelist.weekendWork.join('\n');
        }
        if (timeGapWhitelist && whitelist.timeGap) {
            timeGapWhitelist.value = whitelist.timeGap.join('\n');
        }
        if (excessiveHoursWhitelist && whitelist.excessiveHours) {
            excessiveHoursWhitelist.value = whitelist.excessiveHours.join('\n');
        }

        if (showMessage) showSuccess('Whitelist loaded from storage.');
    } catch (error) {
        showError('Failed to load whitelist: ' + error.message);
    }
}

// Get current whitelist from localStorage
function getAnomalyWhitelist() {
    const stored = localStorage.getItem('anomalyWhitelist');
    if (!stored) {
        return {
            weekendWork: [],
            timeGap: [],
            excessiveHours: []
        };
    }

    try {
        return JSON.parse(stored);
    } catch (error) {
        console.error('Failed to parse anomaly whitelist:', error);
        return {
            weekendWork: [],
            timeGap: [],
            excessiveHours: []
        };
    }
}

// Clear anomaly whitelist
function clearAnomalyWhitelist() {
    const weekendWhitelist = document.getElementById('weekendWhitelist');
    const timeGapWhitelist = document.getElementById('timeGapWhitelist');
    const excessiveHoursWhitelist = document.getElementById('excessiveHoursWhitelist');

    if (weekendWhitelist) weekendWhitelist.value = '';
    if (timeGapWhitelist) timeGapWhitelist.value = '';
    if (excessiveHoursWhitelist) excessiveHoursWhitelist.value = '';

    localStorage.removeItem('anomalyWhitelist');
    showSuccess('Anomaly whitelist cleared. Re-run detection to apply changes.');
}

// Save norm hours settings
function saveNormHours() {
    const egdkInput = document.getElementById('normHoursEGDK');
    const egxxInput = document.getElementById('normHoursEGXX');
    const zaseInput = document.getElementById('normHoursZASE');
    const egplInput = document.getElementById('normHoursEGPL');
    const egsuInput = document.getElementById('normHoursEGSU');
    const otherInput = document.getElementById('normHoursOther');

    if (egdkInput && egxxInput && zaseInput && egplInput && egsuInput && otherInput) {
        appSettings.normHoursPerWeek = {
            'EGDK': parseFloat(egdkInput.value) || 37,
            'EGXX': parseFloat(egxxInput.value) || 37,
            'ZASE': parseFloat(zaseInput.value) || 37,
            'EGPL': parseFloat(egplInput.value) || 40,
            'EGSU': parseFloat(egsuInput.value) || 40,
            'Other': parseFloat(otherInput.value) || 37
        };
        localStorage.setItem('appSettings', JSON.stringify(appSettings));
        showSuccess('Norm hours settings saved. Switch to Employee View to see updated calculations.');
    }
}

// Format number based on decimal separator setting
function formatNumberWithSeparator(number) {
    if (appSettings.decimalSeparator === 'comma') {
        return String(number).replace('.', ',');
    }
    return String(number);
}

// ============================================
// SMART RECOMMENDATIONS ENGINE
// ============================================

let allRecommendations = [];
let allAnomalies = [];
let currentFilter = 'all';

// Generate all recommendations from current filtered data
async function generateRecommendations() {
    if (!filteredData || filteredData.length === 0) {
        return [];
    }

    const recommendations = [];

    // Resource Management Recommendations
    recommendations.push(...analyzeResourceManagement());

    // Billing Optimization Recommendations
    recommendations.push(...analyzeBillingOptimization());

    // Data Quality Recommendations
    recommendations.push(...analyzeDataQuality());

    // Project Health Recommendations
    recommendations.push(...analyzeProjectHealth());

    return recommendations;
}

// Analyze Resource Management
function analyzeResourceManagement() {
    const recommendations = [];

    // Group hours by employee and week
    const employeeWeeklyHours = new Map();
    const employeeMonthlyHours = new Map();
    const departmentHours = new Map();

    filteredData.forEach(row => {
        const employee = row[COLUMNS.FULL_NAME] || row[COLUMNS.EMPLOYEE] || '(Unknown)';
        const department = row[COLUMNS.DEPARTMENT] || '(No Department)';
        const duration = parseFloat(row[COLUMNS.DURATION]) || 0;
        const date = new Date(row[COLUMNS.DATE]);

        if (isNaN(date.getTime())) return;

        // Get week key (year-week)
        const weekKey = `${employee}|${date.getFullYear()}-W${getWeekNumber(date)}`;
        employeeWeeklyHours.set(weekKey, (employeeWeeklyHours.get(weekKey) || 0) + duration);

        // Get month key
        const monthKey = `${employee}|${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        employeeMonthlyHours.set(monthKey, (employeeMonthlyHours.get(monthKey) || 0) + duration);

        // Department hours
        departmentHours.set(department, (departmentHours.get(department) || 0) + duration);
    });

    // Detect overworked employees (>50 hours/week)
    const overworked = [];
    employeeWeeklyHours.forEach((hours, key) => {
        if (hours > 50) {
            const [employee, week] = key.split('|');
            overworked.push({ employee, week, hours });
        }
    });

    if (overworked.length > 0) {
        // Group by employee to find repeated overwork
        const overworkByEmployee = new Map();
        overworked.forEach(item => {
            if (!overworkByEmployee.has(item.employee)) {
                overworkByEmployee.set(item.employee, []);
            }
            overworkByEmployee.get(item.employee).push(item);
        });

        overworkByEmployee.forEach((weeks, employee) => {
            const severity = weeks.length > 2 ? 'critical' : 'warning';
            const maxHours = Math.max(...weeks.map(w => w.hours));

            recommendations.push({
                id: `overwork-${employee.replace(/\s/g, '-')}`,
                severity: severity,
                category: 'resource',
                icon: '⚠️',
                title: `Potential Overwork: ${employee}`,
                message: `${employee} logged more than 50 hours in ${weeks.length} week(s). Peak: ${formatNumber(maxHours)} hours in one week.`,
                action: 'Review workload distribution and consider reallocation',
                details: {
                    'Affected Employee': employee,
                    'Weeks Over 50h': weeks.length,
                    'Peak Hours': `${formatNumber(maxHours)}h`,
                    'Risk': severity === 'critical' ? 'Burnout Risk' : 'Monitor Closely'
                }
            });
        });
    }

    // Detect underutilized employees (<20 hours/week consistently)
    const underutilized = [];
    const employeeWeekCounts = new Map();

    employeeWeeklyHours.forEach((hours, key) => {
        const [employee] = key.split('|');
        if (hours < 20) {
            underutilized.push({ employee, hours });
        }
        employeeWeekCounts.set(employee, (employeeWeekCounts.get(employee) || 0) + 1);
    });

    if (underutilized.length > 0) {
        const underutilByEmployee = new Map();
        underutilized.forEach(item => {
            if (!underutilByEmployee.has(item.employee)) {
                underutilByEmployee.set(item.employee, []);
            }
            underutilByEmployee.get(item.employee).push(item);
        });

        underutilByEmployee.forEach((weeks, employee) => {
            const totalWeeks = employeeWeekCounts.get(employee) || weeks.length;
            const utilizationRate = (weeks.length / totalWeeks) * 100;

            if (utilizationRate > 50) { // More than half the weeks are underutilized
                const avgHours = weeks.reduce((sum, w) => sum + w.hours, 0) / weeks.length;

                recommendations.push({
                    id: `underutil-${employee.replace(/\s/g, '-')}`,
                    severity: 'info',
                    category: 'resource',
                    icon: '📊',
                    title: `Low Utilization: ${employee}`,
                    message: `${employee} logged less than 20 hours/week in ${weeks.length} of ${totalWeeks} weeks (${formatNumber(utilizationRate)}% of time). Average: ${formatNumber(avgHours)} hours/week in those periods.`,
                    action: 'Review capacity and consider allocating additional projects',
                    details: {
                        'Employee': employee,
                        'Low Weeks': `${weeks.length} of ${totalWeeks}`,
                        'Avg Hours (Low Weeks)': `${formatNumber(avgHours)}h/week`,
                        'Opportunity': 'Available Capacity'
                    }
                });
            }
        });
    }

    // Analyze department utilization
    if (employeeAggregatedData && employeeAggregatedData.length > 0) {
        const deptUtilization = new Map();

        employeeAggregatedData.forEach(emp => {
            const dept = emp.department || '(No Department)';
            if (!deptUtilization.has(dept)) {
                deptUtilization.set(dept, { total: 0, count: 0, norm: 0 });
            }
            const data = deptUtilization.get(dept);
            data.total += emp.totalHours;
            data.norm += parseFloat(emp.normHours) || 0;
            data.count++;
        });

        deptUtilization.forEach((data, dept) => {
            if (dept === '(No Department)' || data.count === 0) return;

            const avgUtilization = (data.total / data.norm) * 100;

            if (avgUtilization < 60) {
                recommendations.push({
                    id: `dept-util-${dept.replace(/\s/g, '-')}`,
                    severity: 'warning',
                    category: 'resource',
                    icon: '📉',
                    title: `Low Department Utilization: ${dept}`,
                    message: `${dept} has an average utilization of ${formatNumber(avgUtilization)}% across ${data.count} employees. Total: ${formatNumber(data.total)}h of ${formatNumber(data.norm)}h capacity.`,
                    action: 'Consider reallocation or investigate causes of low utilization',
                    details: {
                        'Department': dept,
                        'Employees': data.count,
                        'Utilization': `${formatNumber(avgUtilization)}%`,
                        'Total Hours': `${formatNumber(data.total)}h`,
                        'Capacity': `${formatNumber(data.norm)}h`
                    }
                });
            }
        });
    }

    return recommendations;
}

// Analyze Billing Optimization
function analyzeBillingOptimization() {
    const recommendations = [];

    // Group by customer/project
    const projectBilling = new Map();
    const customerBilling = new Map();

    filteredData.forEach(row => {
        const project = row[COLUMNS.CUSTOMER_PROJECT] || '(Unknown Project)';
        const customer = row[COLUMNS.NAME] || row[COLUMNS.CUSTOMER_PROJECT] || '(Unknown)';
        const duration = parseFloat(row[COLUMNS.DURATION]) || 0;
        const billable = row[COLUMNS.BILLABLE]?.toLowerCase() === 'true' || row[COLUMNS.BILLABLE] === 'true';

        // Project billing
        if (!projectBilling.has(project)) {
            projectBilling.set(project, { total: 0, billable: 0, nonBillable: 0 });
        }
        const projData = projectBilling.get(project);
        projData.total += duration;
        if (billable) {
            projData.billable += duration;
        } else {
            projData.nonBillable += duration;
        }

        // Customer billing
        if (!customerBilling.has(customer)) {
            customerBilling.set(customer, { total: 0, billable: 0, nonBillable: 0 });
        }
        const custData = customerBilling.get(customer);
        custData.total += duration;
        if (billable) {
            custData.billable += duration;
        } else {
            custData.nonBillable += duration;
        }
    });

    // Detect projects with high non-billable %
    projectBilling.forEach((data, project) => {
        if (data.total < 10) return; // Skip small projects

        const nonBillablePercent = (data.nonBillable / data.total) * 100;

        if (nonBillablePercent > 60) {
            recommendations.push({
                id: `billing-project-${project.replace(/\s/g, '-').substring(0, 30)}`,
                severity: nonBillablePercent > 80 ? 'critical' : 'warning',
                category: 'billing',
                icon: '💰',
                title: `High Non-Billable Hours: ${project}`,
                message: `Project "${project}" has ${formatNumber(nonBillablePercent)}% non-billable hours (${formatNumber(data.nonBillable)}h of ${formatNumber(data.total)}h total).`,
                action: 'Review project scope and billing codes. Consider renegotiating terms or verifying time categorization.',
                details: {
                    'Project': project,
                    'Total Hours': `${formatNumber(data.total)}h`,
                    'Non-Billable': `${formatNumber(data.nonBillable)}h (${formatNumber(nonBillablePercent)}%)`,
                    'Billable': `${formatNumber(data.billable)}h (${formatNumber(100 - nonBillablePercent)}%)`,
                    'Revenue Impact': 'Potential Loss'
                }
            });
        }
    });

    // Detect customers with high non-billable %
    customerBilling.forEach((data, customer) => {
        if (data.total < 20 || customer === '(Unknown)') return;

        const nonBillablePercent = (data.nonBillable / data.total) * 100;

        if (nonBillablePercent > 50) {
            recommendations.push({
                id: `billing-customer-${customer.replace(/\s/g, '-').substring(0, 30)}`,
                severity: 'warning',
                category: 'billing',
                icon: '🏢',
                title: `High Non-Billable %: ${customer}`,
                message: `Customer "${customer}" has ${formatNumber(nonBillablePercent)}% non-billable hours across all projects (${formatNumber(data.nonBillable)}h of ${formatNumber(data.total)}h).`,
                action: 'Review customer relationship and project scopes. Verify billing practices.',
                details: {
                    'Customer': customer,
                    'Total Hours': `${formatNumber(data.total)}h`,
                    'Non-Billable %': `${formatNumber(nonBillablePercent)}%`,
                    'Potential Revenue Leak': `${formatNumber(data.nonBillable)}h`
                }
            });
        }
    });

    // Calculate total unbilled hours
    const totalHours = filteredData.reduce((sum, row) => sum + (parseFloat(row[COLUMNS.DURATION]) || 0), 0);
    const billableHours = filteredData.reduce((sum, row) => {
        const billable = row[COLUMNS.BILLABLE]?.toLowerCase() === 'true' || row[COLUMNS.BILLABLE] === 'true';
        return sum + (billable ? (parseFloat(row[COLUMNS.DURATION]) || 0) : 0);
    }, 0);
    const unbilledHours = totalHours - billableHours;
    const unbilledPercent = (unbilledHours / totalHours) * 100;

    if (unbilledPercent > 40) {
        recommendations.push({
            id: 'total-unbilled',
            severity: unbilledPercent > 60 ? 'critical' : 'warning',
            category: 'billing',
            icon: '⚡',
            title: `High Overall Non-Billable Rate: ${formatNumber(unbilledPercent)}%`,
            message: `Across all tracked time, ${formatNumber(unbilledPercent)}% (${formatNumber(unbilledHours)} hours) is non-billable. This represents significant potential revenue.`,
            action: 'Conduct comprehensive billing review. Investigate root causes: internal projects, training, or miscategorization.',
            details: {
                'Total Hours': `${formatNumber(totalHours)}h`,
                'Billable': `${formatNumber(billableHours)}h (${formatNumber(100 - unbilledPercent)}%)`,
                'Non-Billable': `${formatNumber(unbilledHours)}h (${formatNumber(unbilledPercent)}%)`,
                'Impact': 'Revenue Optimization Opportunity'
            }
        });
    }

    return recommendations;
}

// Analyze Data Quality
function analyzeDataQuality() {
    const recommendations = [];

    // Find entries with very short task descriptions
    const shortDescriptions = filteredData.filter(row => {
        const task = row[COLUMNS.TASK] || '';
        return task.length > 0 && task.length < 10;
    });

    if (shortDescriptions.length > 20) {
        const percent = (shortDescriptions.length / filteredData.length) * 100;
        const totalHours = shortDescriptions.reduce((sum, row) => sum + (parseFloat(row[COLUMNS.DURATION]) || 0), 0);

        recommendations.push({
            id: 'short-descriptions',
            severity: percent > 10 ? 'warning' : 'info',
            category: 'quality',
            icon: '📝',
            title: `Generic Task Descriptions: ${shortDescriptions.length} entries`,
            message: `${shortDescriptions.length} time entries (${formatNumber(percent)}%) have very short task descriptions (<10 characters), representing ${formatNumber(totalHours)} hours.`,
            action: 'Encourage detailed task descriptions for better tracking and billing justification.',
            details: {
                'Entries': shortDescriptions.length,
                'Percentage': `${formatNumber(percent)}%`,
                'Hours Affected': `${formatNumber(totalHours)}h`,
                'Issue': 'Lack of Detail'
            }
        });
    }

    // Find entries with no task description
    const noDescriptions = filteredData.filter(row => {
        const task = row[COLUMNS.TASK] || '';
        return task.trim().length === 0;
    });

    if (noDescriptions.length > 0) {
        const totalHours = noDescriptions.reduce((sum, row) => sum + (parseFloat(row[COLUMNS.DURATION]) || 0), 0);

        recommendations.push({
            id: 'missing-descriptions',
            severity: 'warning',
            category: 'quality',
            icon: '⚠️',
            title: `Missing Task Descriptions: ${noDescriptions.length} entries`,
            message: `${noDescriptions.length} time entries have no task description, totaling ${formatNumber(totalHours)} hours.`,
            action: 'Require task descriptions for all time entries. Update data entry policies.',
            details: {
                'Entries': noDescriptions.length,
                'Hours Affected': `${formatNumber(totalHours)}h`,
                'Impact': 'Reduced Auditability'
            }
        });
    }

    // Check for employees not logging time recently
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const recentEntries = new Map();
    filteredData.forEach(row => {
        const employee = row[COLUMNS.FULL_NAME] || row[COLUMNS.EMPLOYEE] || '(Unknown)';
        const date = new Date(row[COLUMNS.DATE]);

        if (!isNaN(date.getTime())) {
            if (!recentEntries.has(employee) || date > recentEntries.get(employee)) {
                recentEntries.set(employee, date);
            }
        }
    });

    const inactiveEmployees = [];
    recentEntries.forEach((lastDate, employee) => {
        if (lastDate < twoWeeksAgo && employee !== '(Unknown)') {
            inactiveEmployees.push({ employee, lastDate });
        }
    });

    if (inactiveEmployees.length > 0) {
        const employeeList = inactiveEmployees.slice(0, 5).map(e => e.employee).join(', ');
        const moreText = inactiveEmployees.length > 5 ? ` and ${inactiveEmployees.length - 5} more` : '';

        recommendations.push({
            id: 'inactive-employees',
            severity: 'info',
            category: 'quality',
            icon: '⏰',
            title: `Employees with No Recent Time Entries: ${inactiveEmployees.length}`,
            message: `${inactiveEmployees.length} employees haven't logged time in the last 14 days: ${employeeList}${moreText}.`,
            action: 'Follow up with inactive employees. Ensure time tracking compliance.',
            details: {
                'Inactive Count': inactiveEmployees.length,
                'Threshold': '14 days',
                'Action Required': 'Time Tracking Reminder'
            }
        });
    }

    // Detect potential duplicate entries (same employee, project, date, duration)
    const entryKeys = new Map();
    const duplicates = [];

    filteredData.forEach((row, index) => {
        const employee = row[COLUMNS.FULL_NAME] || row[COLUMNS.EMPLOYEE] || '(Unknown)';
        const project = row[COLUMNS.CUSTOMER_PROJECT] || '(Unknown)';
        const date = row[COLUMNS.DATE];
        const duration = row[COLUMNS.DURATION];

        const key = `${employee}|${project}|${date}|${duration}`;

        if (entryKeys.has(key)) {
            duplicates.push({ key, original: entryKeys.get(key), duplicate: index });
        } else {
            entryKeys.set(key, index);
        }
    });

    if (duplicates.length > 5) {
        const affectedHours = duplicates.reduce((sum, dup) => {
            return sum + (parseFloat(filteredData[dup.duplicate][COLUMNS.DURATION]) || 0);
        }, 0);

        recommendations.push({
            id: 'duplicate-entries',
            severity: 'warning',
            category: 'quality',
            icon: '🔁',
            title: `Potential Duplicate Entries: ${duplicates.length} found`,
            message: `Found ${duplicates.length} potential duplicate time entries (same employee, project, date, and duration), representing ${formatNumber(affectedHours)} hours.`,
            action: 'Review and remove duplicate entries. Verify data import process.',
            details: {
                'Duplicates': duplicates.length,
                'Hours Affected': `${formatNumber(affectedHours)}h`,
                'Issue': 'Data Integrity'
            }
        });
    }

    return recommendations;
}

// Analyze Project Health
function analyzeProjectHealth() {
    const recommendations = [];

    // Group entries by project and month
    const projectMonthly = new Map();

    filteredData.forEach(row => {
        const project = row[COLUMNS.CUSTOMER_PROJECT] || '(Unknown Project)';
        const date = new Date(row[COLUMNS.DATE]);
        const duration = parseFloat(row[COLUMNS.DURATION]) || 0;

        if (isNaN(date.getTime())) return;

        const monthKey = `${project}|${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!projectMonthly.has(project)) {
            projectMonthly.set(project, new Map());
        }

        const projectData = projectMonthly.get(project);
        projectData.set(monthKey, (projectData.get(monthKey) || 0) + duration);
    });

    // Detect projects with declining activity
    projectMonthly.forEach((months, project) => {
        if (project === '(Unknown Project)' || months.size < 3) return;

        const sortedMonths = Array.from(months.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        if (sortedMonths.length >= 3) {
            const recent3 = sortedMonths.slice(-3);
            const [, hours1] = recent3[0];
            const [, hours2] = recent3[1];
            const [, hours3] = recent3[2];

            // Check if consistently declining
            if (hours3 < hours2 && hours2 < hours1) {
                const decline = ((hours1 - hours3) / hours1) * 100;

                if (decline > 30) {
                    recommendations.push({
                        id: `project-decline-${project.replace(/\s/g, '-').substring(0, 30)}`,
                        severity: decline > 60 ? 'warning' : 'info',
                        category: 'project',
                        icon: '📉',
                        title: `Declining Project Activity: ${project}`,
                        message: `Project "${project}" shows ${formatNumber(decline)}% decline in activity over last 3 months (${formatNumber(hours1)}h → ${formatNumber(hours2)}h → ${formatNumber(hours3)}h).`,
                        action: 'Review project status. May be completing naturally or require attention.',
                        details: {
                            'Project': project,
                            'Trend': `${formatNumber(hours1)}h → ${formatNumber(hours2)}h → ${formatNumber(hours3)}h`,
                            'Decline': `${formatNumber(decline)}%`,
                            'Status': 'Declining Activity'
                        }
                    });
                }
            }

            // Check for sudden spikes
            const avgHours = sortedMonths.reduce((sum, [, h]) => sum + h, 0) / sortedMonths.length;
            const lastHours = hours3;

            if (lastHours > avgHours * 2) {
                const spike = ((lastHours - avgHours) / avgHours) * 100;

                recommendations.push({
                    id: `project-spike-${project.replace(/\s/g, '-').substring(0, 30)}`,
                    severity: 'info',
                    category: 'project',
                    icon: '📈',
                    title: `Activity Spike: ${project}`,
                    message: `Project "${project}" shows unusual activity spike in latest month: ${formatNumber(lastHours)}h vs ${formatNumber(avgHours)}h average (+${formatNumber(spike)}%).`,
                    action: 'Verify if spike is expected (deadline, issue resolution) or indicates scope creep.',
                    details: {
                        'Project': project,
                        'Current Month': `${formatNumber(lastHours)}h`,
                        'Average': `${formatNumber(avgHours)}h`,
                        'Spike': `+${formatNumber(spike)}%`
                    }
                });
            }
        }
    });

    // Projects with no activity in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const projectLastActivity = new Map();
    filteredData.forEach(row => {
        const project = row[COLUMNS.CUSTOMER_PROJECT] || '(Unknown Project)';
        const date = new Date(row[COLUMNS.DATE]);

        if (!isNaN(date.getTime())) {
            if (!projectLastActivity.has(project) || date > projectLastActivity.get(project)) {
                projectLastActivity.set(project, date);
            }
        }
    });

    const inactiveProjects = [];
    projectLastActivity.forEach((lastDate, project) => {
        if (lastDate < thirtyDaysAgo && project !== '(Unknown Project)') {
            inactiveProjects.push({ project, lastDate });
        }
    });

    if (inactiveProjects.length > 3) {
        const projectList = inactiveProjects.slice(0, 3).map(p => p.project).join(', ');
        const moreText = inactiveProjects.length > 3 ? ` and ${inactiveProjects.length - 3} more` : '';

        recommendations.push({
            id: 'inactive-projects',
            severity: 'info',
            category: 'project',
            icon: '🗃️',
            title: `Inactive Projects: ${inactiveProjects.length}`,
            message: `${inactiveProjects.length} projects have no activity in the last 30 days: ${projectList}${moreText}.`,
            action: 'Review project status. Consider archiving completed projects or investigating stalled work.',
            details: {
                'Inactive Projects': inactiveProjects.length,
                'Threshold': '30 days',
                'Action': 'Status Review'
            }
        });
    }

    return recommendations;
}

// Get week number for date
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ============================================
// ANOMALY DETECTION ENGINE
// ============================================

// Detect all anomalies in filtered data
async function detectAnomalies() {
    if (!filteredData || filteredData.length === 0) {
        return [];
    }

    const anomalies = [];
    const MAX_ANOMALIES_PER_TYPE = 100; // Limit to prevent UI overload and improve performance
    const anomalyCountsByType = {};

    // Get whitelist for filtering false positives
    const whitelist = getAnomalyWhitelist();

    // Detect zero or negative hours (limit to MAX)
    let zeroHoursCount = 0;
    for (let index = 0; index < filteredData.length && zeroHoursCount < MAX_ANOMALIES_PER_TYPE; index++) {
        const row = filteredData[index];
        const duration = parseFloat(row[COLUMNS.DURATION]) || 0;
        const employee = row[COLUMNS.FULL_NAME] || row[COLUMNS.EMPLOYEE] || '(Unknown)';
        const project = row[COLUMNS.CUSTOMER_PROJECT] || '(Unknown)';
        const date = row[COLUMNS.DATE];

        if (duration <= 0) {
            anomalies.push({
                id: `zero-hours-${index}`,
                type: 'zero_hours',
                severity: 'critical',
                icon: '🚫',
                title: 'Zero or Negative Hours',
                message: `Entry has ${duration} hours recorded`,
                details: {
                    'Employee': employee,
                    'Project': project,
                    'Date': date,
                    'Hours': `${duration}h`,
                    'Row': index + 1
                },
                rowIndex: index
            });
            zeroHoursCount++;
        }
    }

    // Detect excessive hours (>12 hours in a day)
    const dailyHours = new Map();
    filteredData.forEach((row, index) => {
        const employee = row[COLUMNS.FULL_NAME] || row[COLUMNS.EMPLOYEE] || '(Unknown)';
        const date = row[COLUMNS.DATE];
        const duration = parseFloat(row[COLUMNS.DURATION]) || 0;
        const key = `${employee}|${date}`;

        if (!dailyHours.has(key)) {
            dailyHours.set(key, { hours: 0, entries: [] });
        }
        const data = dailyHours.get(key);
        data.hours += duration;
        data.entries.push(index);
    });

    let excessiveHoursCount = 0;
    dailyHours.forEach((data, key) => {
        if (excessiveHoursCount >= MAX_ANOMALIES_PER_TYPE) return; // Limit reached

        const [employee, date] = key.split('|');

        // Skip if employee is whitelisted for excessive hours
        if (whitelist.excessiveHours.includes(employee)) return;

        if (data.hours > 12) {
            anomalies.push({
                id: `excessive-hours-${key.replace(/\s/g, '-')}`,
                type: 'excessive_hours',
                severity: data.hours > 16 ? 'critical' : 'warning',
                icon: '⏰',
                title: 'Excessive Daily Hours',
                message: `${employee} logged ${formatNumber(data.hours)} hours on ${date}`,
                details: {
                    'Employee': employee,
                    'Date': date,
                    'Total Hours': `${formatNumber(data.hours)}h`,
                    'Entries': data.entries.length,
                    'Issue': data.hours > 16 ? 'Extreme Overwork' : 'Possible Error'
                },
                rowIndices: data.entries
            });
            excessiveHoursCount++;
        }
    });

    // Detect weekend entries (limit to MAX per type)
    let weekendCount = 0;
    for (let index = 0; index < filteredData.length && weekendCount < MAX_ANOMALIES_PER_TYPE; index++) {
        const row = filteredData[index];
        const date = new Date(row[COLUMNS.DATE]);
        if (!isNaN(date.getTime())) {
            const dayOfWeek = date.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
                const employee = row[COLUMNS.FULL_NAME] || row[COLUMNS.EMPLOYEE] || '(Unknown)';

                // Skip if employee is whitelisted for weekend work
                if (whitelist.weekendWork.includes(employee)) continue;

                const duration = parseFloat(row[COLUMNS.DURATION]) || 0;
                const project = row[COLUMNS.CUSTOMER_PROJECT] || '(Unknown)';

                anomalies.push({
                    id: `weekend-${index}`,
                    type: 'weekend_entry',
                    severity: 'info',
                    icon: '📅',
                    title: 'Weekend Time Entry',
                    message: `${employee} logged ${formatNumber(duration)}h on ${dayOfWeek === 0 ? 'Sunday' : 'Saturday'}`,
                    details: {
                        'Employee': employee,
                        'Date': row[COLUMNS.DATE],
                        'Day': dayOfWeek === 0 ? 'Sunday' : 'Saturday',
                        'Hours': `${formatNumber(duration)}h`,
                        'Project': project
                    },
                    rowIndex: index
                });
                weekendCount++;
            }
        }
    }

    // Detect time gaps (missing consecutive weekdays)
    const employeeDates = new Map();
    filteredData.forEach((row, index) => {
        const employee = row[COLUMNS.FULL_NAME] || row[COLUMNS.EMPLOYEE] || '(Unknown)';
        const date = new Date(row[COLUMNS.DATE]);

        if (!isNaN(date.getTime())) {
            if (!employeeDates.has(employee)) {
                employeeDates.set(employee, []);
            }
            employeeDates.get(employee).push(date);
        }
    });

    employeeDates.forEach((dates, employee) => {
        if (dates.length < 5) return; // Need at least 5 entries to detect gaps
        if ((anomalyCountsByType['time_gap'] || 0) >= MAX_ANOMALIES_PER_TYPE) return; // Limit reached

        // Skip if employee is whitelisted for time gaps
        if (whitelist.timeGap.includes(employee)) return;

        // Sort dates
        dates.sort((a, b) => a - b);

        // Find gaps of 5+ consecutive weekdays (limit to first 10 gaps per employee)
        let gapsFound = 0;
        for (let i = 0; i < dates.length - 1 && gapsFound < 10; i++) {
            const current = dates[i];
            const next = dates[i + 1];
            const daysDiff = Math.floor((next - current) / (1000 * 60 * 60 * 24));

            // Quick check: if gap is less than 5 days, skip detailed calculation
            if (daysDiff < 5) continue;

            // Calculate weekdays efficiently without loop
            // Approximate: total days minus weekends
            const totalDays = daysDiff;
            const weekends = Math.floor(totalDays / 7) * 2;
            let weekdaysGap = totalDays - weekends;

            // Adjust for partial weeks
            const startDay = current.getDay();
            const endDay = next.getDay();
            if (startDay === 0) weekdaysGap--; // Sunday
            if (startDay === 6) weekdaysGap--; // Saturday
            if (endDay === 0) weekdaysGap--; // Sunday
            if (endDay === 6) weekdaysGap--; // Saturday

            if (weekdaysGap >= 5 && (anomalyCountsByType['time_gap'] || 0) < MAX_ANOMALIES_PER_TYPE) {
                anomalies.push({
                    id: `gap-${employee.replace(/\s/g, '-')}-${current.getTime()}`,
                    type: 'time_gap',
                    severity: weekdaysGap >= 10 ? 'warning' : 'info',
                    icon: '📉',
                    title: 'Time Tracking Gap',
                    message: `${employee} has a ${weekdaysGap}-day gap in time tracking`,
                    details: {
                        'Employee': employee,
                        'Gap Start': current.toISOString().split('T')[0],
                        'Gap End': next.toISOString().split('T')[0],
                        'Weekdays Missing': weekdaysGap,
                        'Issue': weekdaysGap >= 10 ? 'Extended Gap' : 'Short Gap'
                    }
                });
                anomalyCountsByType['time_gap'] = (anomalyCountsByType['time_gap'] || 0) + 1;
                gapsFound++;
            }
        }
    });

    // Detect unusual task descriptions (too short or too long) - limit both types
    let shortDescCount = 0;
    let longDescCount = 0;
    for (let index = 0; index < filteredData.length && (shortDescCount < MAX_ANOMALIES_PER_TYPE || longDescCount < MAX_ANOMALIES_PER_TYPE); index++) {
        const row = filteredData[index];
        const task = row[COLUMNS.TASK] || '';
        const employee = row[COLUMNS.FULL_NAME] || row[COLUMNS.EMPLOYEE] || '(Unknown)';
        const duration = parseFloat(row[COLUMNS.DURATION]) || 0;

        if (task.length > 0 && task.length < 5 && shortDescCount < MAX_ANOMALIES_PER_TYPE) {
            anomalies.push({
                id: `short-task-${index}`,
                type: 'short_description',
                severity: 'info',
                icon: '📝',
                title: 'Very Short Task Description',
                message: `Task description is only ${task.length} characters: "${task}"`,
                details: {
                    'Employee': employee,
                    'Task': task.length === 0 ? '(empty)' : task,
                    'Length': `${task.length} chars`,
                    'Hours': `${formatNumber(duration)}h`,
                    'Issue': 'Insufficient Detail'
                },
                rowIndex: index
            });
            shortDescCount++;
        }

        if (task.length > 500 && longDescCount < MAX_ANOMALIES_PER_TYPE) {
            anomalies.push({
                id: `long-task-${index}`,
                type: 'long_description',
                severity: 'info',
                icon: '📄',
                title: 'Extremely Long Task Description',
                message: `Task description is ${task.length} characters (>500)`,
                details: {
                    'Employee': employee,
                    'Length': `${task.length} chars`,
                    'Hours': `${formatNumber(duration)}h`,
                    'Preview': task.substring(0, 100) + '...',
                    'Issue': 'Possible Data Entry Error'
                },
                rowIndex: index
            });
            longDescCount++;
        }
    }

    // Detect sudden hour spikes (>200% increase week-over-week)
    const weeklyHours = new Map();
    filteredData.forEach((row, index) => {
        const employee = row[COLUMNS.FULL_NAME] || row[COLUMNS.EMPLOYEE] || '(Unknown)';
        const date = new Date(row[COLUMNS.DATE]);
        const duration = parseFloat(row[COLUMNS.DURATION]) || 0;

        if (!isNaN(date.getTime())) {
            const weekKey = `${employee}|${date.getFullYear()}-W${getWeekNumber(date)}`;
            weeklyHours.set(weekKey, (weeklyHours.get(weekKey) || 0) + duration);
        }
    });

    const employeeWeeks = new Map();
    weeklyHours.forEach((hours, key) => {
        const [employee, week] = key.split('|');
        if (!employeeWeeks.has(employee)) {
            employeeWeeks.set(employee, []);
        }
        employeeWeeks.get(employee).push({ week, hours });
    });

    let spikeCount = 0;
    employeeWeeks.forEach((weeks, employee) => {
        if (spikeCount >= MAX_ANOMALIES_PER_TYPE) return; // Limit reached

        weeks.sort((a, b) => a.week.localeCompare(b.week));

        for (let i = 1; i < weeks.length && spikeCount < MAX_ANOMALIES_PER_TYPE; i++) {
            const prev = weeks[i - 1];
            const curr = weeks[i];

            if (prev.hours > 0 && curr.hours > prev.hours * 3) { // 200%+ increase
                const increase = ((curr.hours - prev.hours) / prev.hours) * 100;

                anomalies.push({
                    id: `spike-${employee.replace(/\s/g, '-')}-${curr.week}`,
                    type: 'hour_spike',
                    severity: increase > 400 ? 'warning' : 'info',
                    icon: '📈',
                    title: 'Sudden Hour Spike',
                    message: `${employee} hours jumped ${formatNumber(increase)}% in ${curr.week}`,
                    details: {
                        'Employee': employee,
                        'Previous Week': `${prev.week}: ${formatNumber(prev.hours)}h`,
                        'Current Week': `${curr.week}: ${formatNumber(curr.hours)}h`,
                        'Increase': `+${formatNumber(increase)}%`,
                        'Issue': increase > 400 ? 'Extreme Spike' : 'Unusual Spike'
                    }
                });
                spikeCount++;
            }
        }
    });

    // Detect entries with suspicious patterns (same time every day)
    const employeeDailyHours = new Map();
    filteredData.forEach((row, index) => {
        const employee = row[COLUMNS.FULL_NAME] || row[COLUMNS.EMPLOYEE] || '(Unknown)';
        const date = row[COLUMNS.DATE];
        const duration = parseFloat(row[COLUMNS.DURATION]) || 0;
        const key = `${employee}|${date}`;

        employeeDailyHours.set(key, duration);
    });

    const employeeHourPatterns = new Map();
    employeeDailyHours.forEach((hours, key) => {
        const [employee] = key.split('|');
        if (!employeeHourPatterns.has(employee)) {
            employeeHourPatterns.set(employee, []);
        }
        employeeHourPatterns.get(employee).push(hours);
    });

    let patternCount = 0;
    employeeHourPatterns.forEach((hoursList, employee) => {
        if (patternCount >= MAX_ANOMALIES_PER_TYPE) return; // Limit reached
        if (hoursList.length < 10) return; // Need sufficient data

        // Check if too many identical values
        const hourCounts = new Map();
        hoursList.forEach(h => {
            hourCounts.set(h, (hourCounts.get(h) || 0) + 1);
        });

        hourCounts.forEach((count, hours) => {
            if (patternCount >= MAX_ANOMALIES_PER_TYPE) return; // Limit reached
            const percentage = (count / hoursList.length) * 100;
            if (percentage > 80 && count > 10) { // >80% of days are identical
                anomalies.push({
                    id: `pattern-${employee.replace(/\s/g, '-')}-${hours}`,
                    type: 'suspicious_pattern',
                    severity: 'warning',
                    icon: '🔍',
                    title: 'Suspicious Time Pattern',
                    message: `${employee} logs exactly ${formatNumber(hours)}h on ${formatNumber(percentage)}% of days (${count} times)`,
                    details: {
                        'Employee': employee,
                        'Repeated Value': `${formatNumber(hours)}h`,
                        'Occurrences': count,
                        'Percentage': `${formatNumber(percentage)}%`,
                        'Total Days': hoursList.length,
                        'Issue': 'Possible Copy-Paste or Automatic Entry'
                    }
                });
                patternCount++;
            }
        });
    });

    console.log(`✅ Anomaly detection completed: ${anomalies.length} anomalies found`);
    return anomalies;
}

// Display recommendations
async function displayRecommendations() {
    const listContainer = document.getElementById('recommendationsList');
    const anomaliesContainer = document.getElementById('anomaliesContainer');

    if (!listContainer) return;

    // Show loading
    listContainer.innerHTML = '<div class="loading"><div class="spinner"></div><p>Analyzing your data...</p></div>';
    if (anomaliesContainer) {
        anomaliesContainer.innerHTML = '<div class="loading"><div class="spinner"></div><p>Detecting anomalies...</p></div>';
    }

    // Generate recommendations and detect anomalies in parallel
    const [recommendations, anomalies] = await Promise.all([
        generateRecommendations(),
        detectAnomalies()
    ]);

    allRecommendations = recommendations;
    allAnomalies = anomalies;

    // Update summary counts
    updateRecommendationSummary();

    // Display anomalies
    displayAnomalies();

    // Apply current filter
    filterRecommendations(currentFilter);

    // Update tab badge
    updateAnomalyBadge();
}

// Update summary counts
function updateRecommendationSummary() {
    const criticalCount = allRecommendations.filter(r => r.severity === 'critical').length;
    const warningCount = allRecommendations.filter(r => r.severity === 'warning').length;
    const infoCount = allRecommendations.filter(r => r.severity === 'info').length;
    const successCount = allRecommendations.filter(r => r.severity === 'success').length;

    // Safely update DOM elements (may not exist if view not loaded)
    const criticalEl = document.getElementById('criticalCount');
    const warningEl = document.getElementById('warningCount');
    const infoEl = document.getElementById('infoCount');
    const successEl = document.getElementById('successCount');

    if (criticalEl) criticalEl.textContent = criticalCount;
    if (warningEl) warningEl.textContent = warningCount;
    if (infoEl) infoEl.textContent = infoCount;
    if (successEl) successEl.textContent = successCount;
}

// Filter recommendations
function filterRecommendations(filter) {
    currentFilter = filter;

    // Update active filter chip
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('active');
        if (chip.dataset.filter === filter) {
            chip.classList.add('active');
        }
    });

    // Filter recommendations
    let filtered = allRecommendations;

    if (filter !== 'all') {
        if (filter === 'critical' || filter === 'warning' || filter === 'info' || filter === 'success') {
            filtered = allRecommendations.filter(r => r.severity === filter);
        } else {
            filtered = allRecommendations.filter(r => r.category === filter);
        }
    }

    // Display filtered recommendations
    const listContainer = document.getElementById('recommendationsList');

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="no-recommendations">
                <div class="no-recommendations-icon">✨</div>
                <div class="no-recommendations-title">No Recommendations Found</div>
                <div class="no-recommendations-message">
                    ${filter === 'all' ? 'Your data looks great! No issues detected.' : `No ${filter} recommendations found.`}
                </div>
            </div>
        `;
        return;
    }

    // Build HTML for recommendations
    let html = '';
    filtered.forEach(rec => {
        const detailsHtml = Object.entries(rec.details).map(([label, value]) => `
            <div class="rec-detail-item">
                <span class="rec-detail-label">${label}:</span>
                <span class="rec-detail-value">${value}</span>
            </div>
        `).join('');

        html += `
            <div class="recommendation-card ${rec.severity}" data-id="${rec.id}">
                <div class="rec-header">
                    <div class="rec-title-row">
                        <div class="rec-icon">${rec.icon}</div>
                        <h3 class="rec-title">${rec.title}</h3>
                    </div>
                    <span class="rec-category ${rec.category}">${rec.category}</span>
                </div>
                <div class="rec-message">${rec.message}</div>
                <div class="rec-action">💡 ${rec.action}</div>
                <div class="rec-details">
                    ${detailsHtml}
                </div>
            </div>
        `;
    });

    listContainer.innerHTML = html;
}

// Refresh recommendations
async function refreshRecommendations() {
    await displayRecommendations();
}

// Display anomalies
function displayAnomalies() {
    const anomaliesContainer = document.getElementById('anomaliesContainer');

    if (!anomaliesContainer) return;

    if (allAnomalies.length === 0) {
        anomaliesContainer.innerHTML = `
            <div class="no-recommendations">
                <div class="no-recommendations-icon">✅</div>
                <div class="no-recommendations-title">No Anomalies Detected</div>
                <div class="no-recommendations-message">
                    Your data looks clean! No quality issues found.
                </div>
            </div>
        `;
        return;
    }

    // Group anomalies by type
    const groupedAnomalies = new Map();
    allAnomalies.forEach(anomaly => {
        if (!groupedAnomalies.has(anomaly.type)) {
            groupedAnomalies.set(anomaly.type, []);
        }
        groupedAnomalies.get(anomaly.type).push(anomaly);
    });

    // Build HTML
    let html = `
        <div style="background: var(--bg-secondary); border-left: 4px solid #dc3545; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h3 style="margin: 0; color: var(--text-primary); display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.5em;">⚠️</span>
                    Data Quality Anomalies Detected
                </h3>
                <span style="background: #dc3545; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold;">
                    ${allAnomalies.length} Total
                </span>
            </div>
            <p style="color: var(--text-secondary); margin: 0;">
                The following data quality issues were detected in your filtered dataset. Review these anomalies to ensure data integrity.
            </p>
        </div>
    `;

    // Display anomalies by type
    const typeLabels = {
        'zero_hours': 'Zero or Negative Hours',
        'excessive_hours': 'Excessive Daily Hours (>12h)',
        'weekend_entry': 'Weekend Time Entries',
        'time_gap': 'Time Tracking Gaps',
        'short_description': 'Very Short Task Descriptions',
        'long_description': 'Extremely Long Task Descriptions',
        'hour_spike': 'Sudden Hour Spikes',
        'suspicious_pattern': 'Suspicious Time Patterns'
    };

    groupedAnomalies.forEach((anomalies, type) => {
        const label = typeLabels[type] || type;
        const count = anomalies.length;

        html += `
            <div style="margin-bottom: 20px;">
                <div style="background: var(--bg-primary); border: 2px solid var(--border-color); border-radius: 8px; padding: 15px; margin-bottom: 10px; cursor: pointer;"
                     onclick="toggleAnomalyGroup('${type}')">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 1.2em;">${anomalies[0].icon}</span>
                            <h4 style="margin: 0; color: var(--text-primary);">${label}</h4>
                        </div>
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <span style="background: var(--border-color); padding: 4px 12px; border-radius: 12px; font-weight: 600;">
                                ${count} ${count === 1 ? 'issue' : 'issues'}
                            </span>
                            <span id="toggle-icon-${type}">▼</span>
                        </div>
                    </div>
                </div>
                <div id="anomaly-group-${type}" style="display: none;">
        `;

        // Aggregate anomalies by employee
        const byEmployee = new Map();
        anomalies.forEach(anomaly => {
            const employee = anomaly.details['Employee'] || '(Unknown)';
            if (!byEmployee.has(employee)) {
                byEmployee.set(employee, []);
            }
            byEmployee.get(employee).push(anomaly);
        });

        // Display aggregated anomalies (limit to 20 employees shown)
        const employeeEntries = Array.from(byEmployee.entries()).slice(0, 20);
        employeeEntries.forEach(([employee, empAnomalies]) => {
            const empCount = empAnomalies.length;
            const highestSeverity = empAnomalies.some(a => a.severity === 'critical') ? 'critical' :
                                  empAnomalies.some(a => a.severity === 'warning') ? 'warning' : 'info';

            // Build summary based on type
            let summary = '';
            if (type === 'weekend_entry') {
                const dates = empAnomalies.slice(0, 5).map(a => a.details['Date']).join(', ');
                const more = empAnomalies.length > 5 ? ` and ${empAnomalies.length - 5} more` : '';
                summary = `Worked on weekends: ${dates}${more}`;
            } else if (type === 'excessive_hours') {
                const dates = empAnomalies.slice(0, 3).map(a => `${a.details['Date']} (${a.details['Hours']})`).join(', ');
                const more = empAnomalies.length > 3 ? ` and ${empAnomalies.length - 3} more days` : '';
                summary = `Excessive hours on: ${dates}${more}`;
            } else if (type === 'zero_hours') {
                const dates = empAnomalies.slice(0, 3).map(a => a.details['Date']).join(', ');
                const more = empAnomalies.length > 3 ? ` and ${empAnomalies.length - 3} more` : '';
                summary = `Zero hours entries on: ${dates}${more}`;
            } else if (type === 'time_gap') {
                const gaps = empAnomalies.slice(0, 3).map(a => `${a.details['Gap']}`).join(', ');
                const more = empAnomalies.length > 3 ? ` and ${empAnomalies.length - 3} more gaps` : '';
                summary = `Time gaps detected: ${gaps}${more}`;
            } else if (type === 'short_description' || type === 'long_description') {
                const projects = [...new Set(empAnomalies.slice(0, 3).map(a => a.details['Project']))].join(', ');
                const more = empAnomalies.length > 3 ? ` and ${empAnomalies.length - 3} more` : '';
                summary = `Issues on projects: ${projects}${more}`;
            } else if (type === 'hour_spike') {
                const weeks = empAnomalies.slice(0, 3).map(a => `Week ${a.details['Week']} (${a.details['Change']})`).join(', ');
                const more = empAnomalies.length > 3 ? ` and ${empAnomalies.length - 3} more spikes` : '';
                summary = `Hour spikes: ${weeks}${more}`;
            } else if (type === 'suspicious_pattern') {
                summary = `${empAnomalies.length} suspicious ${empAnomalies.length === 1 ? 'pattern' : 'patterns'} detected`;
            }

            const aggregateId = `aggregate-${type}-${employee.replace(/\s/g, '-')}`;

            html += `
                <div class="recommendation-card ${highestSeverity}" style="margin-bottom: 10px;">
                    <div class="rec-header">
                        <div class="rec-title-row">
                            <div class="rec-icon">${empAnomalies[0].icon}</div>
                            <h3 class="rec-title">${employee}</h3>
                        </div>
                    </div>
                    <div class="rec-message">${summary}</div>
                    <div class="rec-details">
                        <div class="rec-detail-item">
                            <span class="rec-detail-label">Total Occurrences:</span>
                            <span class="rec-detail-value" style="font-weight: bold; color: ${highestSeverity === 'critical' ? '#dc3545' : highestSeverity === 'warning' ? '#ffc107' : '#17a2b8'};">${empCount}</span>
                        </div>
                    </div>
                    <div style="margin-top: 10px; text-align: center;">
                        <button onclick="toggleAnomalyDetails('${aggregateId}')"
                                style="background: var(--border-color); border: 1px solid var(--text-tertiary); color: var(--text-primary); padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 0.9em;">
                            <span id="toggle-btn-${aggregateId}">Show Details ▼</span>
                        </button>
                    </div>
                    <div id="${aggregateId}" style="display: none; margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color);">
            `;

            // Show individual anomaly details when expanded
            empAnomalies.forEach(anomaly => {
                const detailsHtml = Object.entries(anomaly.details)
                    .filter(([key]) => key !== 'Employee') // Don't repeat employee name
                    .map(([label, value]) => `
                        <div class="rec-detail-item">
                            <span class="rec-detail-label">${label}:</span>
                            <span class="rec-detail-value">${value}</span>
                        </div>
                    `).join('');

                html += `
                    <div style="background: var(--bg-secondary); border-left: 3px solid ${highestSeverity === 'critical' ? '#dc3545' : highestSeverity === 'warning' ? '#ffc107' : '#17a2b8'}; padding: 10px; margin-bottom: 8px; border-radius: 4px;">
                        <div style="font-size: 0.9em; color: var(--text-secondary); margin-bottom: 5px;">${anomaly.message}</div>
                        <div style="font-size: 0.85em;">
                            ${detailsHtml}
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        });

        if (byEmployee.size > 20) {
            html += `
                <div style="text-align: center; padding: 15px; color: var(--text-tertiary); font-style: italic;">
                    ... and ${byEmployee.size - 20} more employees with ${label}
                </div>
            `;
        }

        html += `
                </div>
            </div>
        `;
    });

    anomaliesContainer.innerHTML = html;
}

// Toggle anomaly group visibility
function toggleAnomalyGroup(type) {
    const group = document.getElementById(`anomaly-group-${type}`);
    const icon = document.getElementById(`toggle-icon-${type}`);

    if (group && icon) {
        if (group.style.display === 'none') {
            group.style.display = 'block';
            icon.textContent = '▲';
        } else {
            group.style.display = 'none';
            icon.textContent = '▼';
        }
    }
}

// Toggle individual anomaly details within aggregate view
function toggleAnomalyDetails(aggregateId) {
    const details = document.getElementById(aggregateId);
    const btn = document.getElementById(`toggle-btn-${aggregateId}`);

    if (details && btn) {
        if (details.style.display === 'none') {
            details.style.display = 'block';
            btn.textContent = 'Hide Details ▲';
        } else {
            details.style.display = 'none';
            btn.textContent = 'Show Details ▼';
        }
    }
}

// Update anomaly badge on tab
function updateAnomalyBadge() {
    const tab = document.querySelector('.tab[onclick*="recommendations"]');
    if (!tab) return;

    // Remove existing badge
    const existingBadge = tab.querySelector('.anomaly-badge');
    if (existingBadge) {
        existingBadge.remove();
    }

    // Add new badge if anomalies exist
    if (allAnomalies.length > 0) {
        const badge = document.createElement('span');
        badge.className = 'anomaly-badge';
        badge.textContent = allAnomalies.length;
        badge.style.cssText = 'background: #dc3545; color: white; padding: 2px 8px; border-radius: 12px; margin-left: 8px; font-size: 0.85em; font-weight: bold;';
        tab.appendChild(badge);
    }
}

// Open import statistics modal
function openImportStats() {
    const modal = document.getElementById('importStatsModal');
    if (!modal) return;

    // Display the import statistics
    displayImportStatistics();

    // Show modal
    modal.style.display = 'block';
}

// Close import statistics modal
function closeImportStats() {
    const modal = document.getElementById('importStatsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Display import statistics in modal
function displayImportStatistics() {
    const container = document.getElementById('importStatsContent');
    if (!container) return;

    // Check if import stats exist
    if (!importStats || importStats.totalLines === 0) {
        container.innerHTML = `
            <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
                <div style="font-size: 3em; margin-bottom: 16px;">📂</div>
                <div style="font-size: 1.2em; font-weight: 600; margin-bottom: 8px;">No Import Data</div>
                <div>Import a CSV file to view statistics</div>
            </div>
        `;
        return;
    }

    const successRate = ((importStats.imported / (importStats.totalLines - importStats.headerSkipped)) * 100).toFixed(2);
    const timestamp = importStats.timestamp ? new Date(importStats.timestamp).toLocaleString() : 'Unknown';

    // Build HTML
    let html = `
        <div style="padding: 24px;">
            <!-- File Info -->
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #667eea;">
                <div style="font-size: 1.1em; font-weight: 600; margin-bottom: 8px;">📄 ${importStats.fileName}</div>
                <div style="color: var(--text-secondary); font-size: 0.9em;">Imported: ${timestamp}</div>
            </div>

            <!-- Summary Stats -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px;">
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 2em; font-weight: 700; color: #667eea;">${importStats.totalLines.toLocaleString()}</div>
                    <div style="color: var(--text-secondary); font-size: 0.9em; margin-top: 4px;">Total Lines</div>
                </div>
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 2em; font-weight: 700; color: #28a745;">${importStats.imported.toLocaleString()}</div>
                    <div style="color: var(--text-secondary); font-size: 0.9em; margin-top: 4px;">✅ Imported</div>
                </div>
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 2em; font-weight: 700; color: #dc3545;">${importStats.rejected.toLocaleString()}</div>
                    <div style="color: var(--text-secondary); font-size: 0.9em; margin-top: 4px;">❌ Rejected</div>
                </div>
                <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 2em; font-weight: 700; color: ${successRate >= 95 ? '#28a745' : successRate >= 80 ? '#ffc107' : '#dc3545'};">${successRate}%</div>
                    <div style="color: var(--text-secondary); font-size: 0.9em; margin-top: 4px;">Success Rate</div>
                </div>
            </div>

            <!-- Rejection Breakdown -->
            ${importStats.rejected > 0 ? `
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #ffc107;">
                <h3 style="margin-top: 0; font-size: 1.1em;">⚠️ Rejection Breakdown</h3>
                <div style="display: grid; gap: 12px;">
                    ${importStats.headerSkipped > 0 ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                        <span>Header row</span>
                        <span style="font-weight: 600;">${importStats.headerSkipped.toLocaleString()}</span>
                    </div>
                    ` : ''}
                    ${importStats.emptyLines > 0 ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-color);">
                        <span>Empty lines</span>
                        <span style="font-weight: 600;">${importStats.emptyLines.toLocaleString()}</span>
                    </div>
                    ` : ''}
                    ${importStats.invalidLines > 0 ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
                        <span>Invalid rows (< 50 columns)</span>
                        <span style="font-weight: 600; color: #dc3545;">${importStats.invalidLines.toLocaleString()}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            ` : ''}

            <!-- Error Log -->
            ${importStats.errorLog && importStats.errorLog.length > 0 ? `
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; border-left: 4px solid #dc3545;">
                <h3 style="margin-top: 0; font-size: 1.1em;">🔴 Error Log (Showing ${Math.min(importStats.errorLog.length, 100)} of ${importStats.errorLog.length} errors)</h3>
                <div style="max-height: 400px; overflow-y: auto; background: var(--bg-primary); padding: 12px; border-radius: 4px; font-family: monospace; font-size: 0.85em;">
                    ${importStats.errorLog.slice(0, 100).map((error, index) => `
                        <div style="padding: 8px; margin-bottom: 8px; background: var(--bg-secondary); border-radius: 4px; border-left: 3px solid #dc3545;">
                            <div style="font-weight: 600; color: #dc3545; margin-bottom: 4px;">Line ${error.line}</div>
                            <div style="color: var(--text-primary);">${error.message}</div>
                            ${error.columnCount ? `<div style="color: var(--text-secondary); font-size: 0.9em; margin-top: 4px;">Columns found: ${error.columnCount}</div>` : ''}
                        </div>
                    `).join('')}
                    ${importStats.errorLog.length > 100 ? `
                        <div style="padding: 12px; text-align: center; color: var(--text-secondary);">
                            ... and ${importStats.errorLog.length - 100} more errors
                        </div>
                    ` : ''}
                </div>
            </div>
            ` : `
            <div style="background: var(--bg-secondary); padding: 16px; border-radius: 8px; border-left: 4px solid #28a745; text-align: center;">
                <div style="font-size: 2em; margin-bottom: 8px;">✅</div>
                <div style="font-weight: 600; font-size: 1.1em;">No Errors Detected</div>
                <div style="color: var(--text-secondary); margin-top: 4px;">All rows imported successfully</div>
            </div>
            `}
        </div>
    `;

    container.innerHTML = html;
}

// Close modals when clicking outside
window.onclick = function(event) {
    const importStatsModal = document.getElementById('importStatsModal');
    if (event.target === importStatsModal) {
        closeImportStats();
    }
}
