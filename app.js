// Global variables
let rawData = [];
let filteredData = [];
let aggregatedData = [];
let monthlyAggregatedData = [];
let monthlyDisplayedRows = 500; // Initial number of rows to display
let kenPBI1AggregatedData = [];
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
    rejected: 0
};

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
    decimalSeparator: 'comma' // 'period' or 'comma'
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
    FULL_NAME: 50               // Full Name - Field #51
};

// Auto-load CSV file on page load
window.addEventListener('DOMContentLoaded', function() {
    // Initialize settings first
    initializeSettings();

    // Check if cached data exists
    const cachedData = loadFromCache();
    if (cachedData) {
        rawData = cachedData;
        document.getElementById('fileName').textContent = 'Loaded from cache';
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

        showSuccess('Data loaded from cache (213 MB, ' + rawData.length.toLocaleString() + ' rows)');
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

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const text = e.target.result;
            showProgress('Parsing CSV data...');
            await parseCSV(text, true); // Enable progress tracking
            hideProgress();
            logImportStats(); // Log detailed import statistics
            saveToCache(rawData); // Cache the parsed data
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
                saveToCache(rawData); // Cache the parsed data
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

            const lines = text.split(/\r?\n/);
            rawData = [];

            // Reset import statistics
            importStats = {
                totalLines: lines.length,
                headerSkipped: 1,
                emptyLines: 0,
                invalidLines: 0,
                imported: 0,
                rejected: 0
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

// Parse a single CSV line with quoted fields
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ';' && !inQuotes) {
            // Field separator
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    // Add last field
    result.push(current.trim());

    return result;
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

    const sortedColumns = config.column ? Array.from(columnsSet).sort() : [];

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
        colorHighlight: document.getElementById('pivotColorHighlight').checked
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

        const sortedColumns = config.column ? Array.from(columnsSet).sort() : [];

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
function saveToCache(data) {
    try {
        const cacheKey = 'netsuite_time_tracking_data';
        const cacheTimestampKey = 'netsuite_time_tracking_timestamp';

        // Store data and timestamp
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(cacheTimestampKey, Date.now().toString());

        console.log('Data cached successfully:', data.length, 'rows');
    } catch (error) {
        // localStorage quota exceeded or not available
        console.warn('Failed to cache data:', error.message);

        // Try to clear old cache and retry once
        try {
            localStorage.removeItem('netsuite_time_tracking_data');
            localStorage.setItem('netsuite_time_tracking_data', JSON.stringify(data));
            localStorage.setItem('netsuite_time_tracking_timestamp', Date.now().toString());
            console.log('Data cached successfully after clearing old cache');
        } catch (retryError) {
            console.error('Cannot cache data - localStorage not available or quota exceeded');
        }
    }
}

// Load data from localStorage
function loadFromCache() {
    try {
        const cacheKey = 'netsuite_time_tracking_data';
        const cacheTimestampKey = 'netsuite_time_tracking_timestamp';

        const cachedData = localStorage.getItem(cacheKey);
        const cacheTimestamp = localStorage.getItem(cacheTimestampKey);

        if (!cachedData || !cacheTimestamp) {
            return null;
        }

        // Check if cache is older than 7 days (optional - can adjust or remove)
        const cacheAge = Date.now() - parseInt(cacheTimestamp);
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

        if (cacheAge > maxAge) {
            console.log('Cache expired, will reload data');
            clearCache();
            return null;
        }

        const data = JSON.parse(cachedData);
        console.log('Data loaded from cache:', data.length, 'rows');
        return data;
    } catch (error) {
        console.warn('Failed to load cached data:', error.message);
        clearCache();
        return null;
    }
}

// Clear cached data
function clearCache() {
    try {
        localStorage.removeItem('netsuite_time_tracking_data');
        localStorage.removeItem('netsuite_time_tracking_timestamp');
        console.log('Cache cleared');
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

// Format number based on decimal separator setting
function formatNumberWithSeparator(number) {
    if (appSettings.decimalSeparator === 'comma') {
        return String(number).replace('.', ',');
    }
    return String(number);
}
