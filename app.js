// Global variables
let rawData = [];
let filteredData = [];
let aggregatedData = [];
let monthlyAggregatedData = [];
let currentView = 'detail';
let currentSort = {
    column: 'totalHours',
    direction: 'desc'
};
let monthlySortState = {
    column: 'year',
    direction: 'desc'
};
let currentPage = 1;
let rowsPerPage = 500;

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
function switchView(viewName) {
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
        aggregateMonthlyData();
        displayMonthlyData();
        updateMonthlyStats();
    }
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

// Setup auto-apply filter on field leave
function setupAutoFilterOnLeave() {
    // Apply filters when date inputs lose focus
    document.getElementById('dateFrom').addEventListener('blur', function() {
        if (rawData.length > 0) {
            applyFilters();
        }
    });

    document.getElementById('dateTo').addEventListener('blur', function() {
        if (rawData.length > 0) {
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
            saveToCache(rawData); // Cache the parsed data
            showSuccess(`Successfully loaded ${rawData.length.toLocaleString()} records!`);
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
                saveToCache(rawData); // Cache the parsed data
                document.getElementById('fileName').textContent = 'MIT Time Tracking Dataset (NewOrg).csv (auto-loaded)';
                showSuccess(`Successfully loaded ${rawData.length.toLocaleString()} records!`);
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

            const totalLines = lines.length;
            const chunkSize = 1000; // Process 1000 rows at a time
            let currentLine = 1; // Skip header row
            const startTime = Date.now();

            function processChunk() {
                const endLine = Math.min(currentLine + chunkSize, totalLines);

                for (let i = currentLine; i < endLine; i++) {
                    if (lines[i].trim() === '') continue;

                    const row = parseCSVLine(lines[i]);
                    if (row.length > 0) {
                        rawData.push(row);
                    }
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

    // Reset to first page when filters change
    currentPage = 1;

    // Display results
    displayData();
    updateStats();

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

// Sort and display data (called when clicking column headers)
function sortAndDisplayData() {
    sortData();
    currentPage = 1; // Reset to first page when sorting
    displayData();
}

// Display aggregated data in table
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

    // Calculate pagination
    const totalRows = aggregatedData.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
    const pageData = aggregatedData.slice(startIndex, endIndex);

    // Clear existing rows
    tableBody.innerHTML = '';

    // Calculate total hours for ALL data (not just current page)
    let totalHours = aggregatedData.reduce((sum, item) => sum + item.totalHours, 0);

    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();

    // Add rows for current page only
    pageData.forEach(item => {
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

    // Append all rows at once
    tableBody.appendChild(fragment);

    // Update footer total
    document.getElementById('totalHoursFooter').textContent = formatNumber(totalHours);

    // Update pagination info
    updatePaginationInfo(startIndex + 1, endIndex, totalRows, currentPage, totalPages);
}

// Pagination functions
function updatePaginationInfo(startRow, endRow, totalRows, page, totalPages) {
    const paginationDiv = document.getElementById('paginationInfo');
    if (!paginationDiv) return;

    paginationDiv.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; background: #f8f9fa; border-top: 1px solid #e9ecef;">
            <div style="color: #6c757d; font-size: 0.9em;">
                Showing <strong>${startRow.toLocaleString()}</strong> to <strong>${endRow.toLocaleString()}</strong> of <strong>${totalRows.toLocaleString()}</strong> rows
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button class="btn-secondary" onclick="goToPage(1)" ${page === 1 ? 'disabled' : ''} style="padding: 5px 10px; font-size: 0.85em;">⏮ First</button>
                <button class="btn-secondary" onclick="goToPage(${page - 1})" ${page === 1 ? 'disabled' : ''} style="padding: 5px 10px; font-size: 0.85em;">◀ Prev</button>
                <span style="color: #6c757d; font-size: 0.9em;">Page <strong>${page}</strong> of <strong>${totalPages}</strong></span>
                <button class="btn-secondary" onclick="goToPage(${page + 1})" ${page === totalPages ? 'disabled' : ''} style="padding: 5px 10px; font-size: 0.85em;">Next ▶</button>
                <button class="btn-secondary" onclick="goToPage(${totalPages})" ${page === totalPages ? 'disabled' : ''} style="padding: 5px 10px; font-size: 0.85em;">Last ⏭</button>
                <select onchange="changeRowsPerPage(this.value)" style="padding: 5px; border-radius: 4px; border: 2px solid #dee2e6; font-size: 0.85em;">
                    <option value="100" ${rowsPerPage === 100 ? 'selected' : ''}>100 rows</option>
                    <option value="250" ${rowsPerPage === 250 ? 'selected' : ''}>250 rows</option>
                    <option value="500" ${rowsPerPage === 500 ? 'selected' : ''}>500 rows</option>
                    <option value="1000" ${rowsPerPage === 1000 ? 'selected' : ''}>1000 rows</option>
                </select>
            </div>
        </div>
    `;
}

function goToPage(page) {
    const totalPages = Math.ceil(aggregatedData.length / rowsPerPage);
    if (page < 1 || page > totalPages) return;

    currentPage = page;
    displayData();

    // Scroll to top of table
    document.getElementById('dataTable').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function changeRowsPerPage(newRowsPerPage) {
    rowsPerPage = parseInt(newRowsPerPage);
    currentPage = 1; // Reset to first page
    displayData();
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

    // Update time distribution insights
    updateTimeDistribution();

    // Update additional analytics
    updateAdditionalAnalytics();

    // Update suggested improvements
    updateSuggestedImprovements();
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
        const hours = parseFloat(row[COLUMNS.DUR_DEC]) || 0;
        projectHours[project] = (projectHours[project] || 0) + hours;
    });
    const topProjects = Object.entries(projectHours)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

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
    topProjects.forEach(([project, hours], index) => {
        const percent = totalHours > 0 ? (hours / totalHours * 100).toFixed(1) : 0;
        analyticsHTML += `
            <div class="analytics-item">
                <div class="analytics-rank">#${index + 1}</div>
                <div class="analytics-name">${escapeHtml(project)}</div>
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
    const projectHours = {};
    filteredData.forEach(row => {
        const project = row[COLUMNS.CUSTOMER_PROJECT] || 'Unknown';
        const hours = parseFloat(row[COLUMNS.DUR_DEC]) || 0;
        projectHours[project] = (projectHours[project] || 0) + hours;
    });

    const avgHoursPerProject = Object.values(projectHours).reduce((sum, h) => sum + h, 0) / Object.keys(projectHours).length;
    const overallocatedThreshold = avgHoursPerProject * 2.5; // 250% of average

    const overallocatedProjects = Object.entries(projectHours)
        .filter(([proj, hours]) => hours > overallocatedThreshold)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    if (overallocatedProjects.length > 0) {
        improvements.push({
            type: 'alert',
            icon: '🔥',
            title: 'Over-allocated Projects',
            content: `${overallocatedProjects.length} project(s) have significantly more hours than average (${formatNumber(avgHoursPerProject)} hrs/project).`,
            list: overallocatedProjects.map(([proj, hours]) =>
                `${proj}: <span class="improvement-metric">${formatNumber(hours)} hrs</span> (${((hours / avgHoursPerProject) * 100).toFixed(0)}% of avg)`)
        });
    }

    // 3. Analyze Billing Inconsistencies
    const projectBillingTypes = {};
    filteredData.forEach(row => {
        const project = row[COLUMNS.CUSTOMER_PROJECT] || 'Unknown';
        const billingType = row[COLUMNS.MTYPE2] || 'Unknown';
        if (!projectBillingTypes[project]) {
            projectBillingTypes[project] = new Set();
        }
        projectBillingTypes[project].add(billingType);
    });

    const mixedBillingProjects = Object.entries(projectBillingTypes)
        .filter(([proj, types]) => types.size > 2) // More than 2 different billing types
        .map(([proj, types]) => ({ proj, count: types.size, types: Array.from(types) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    if (mixedBillingProjects.length > 0) {
        improvements.push({
            type: 'warning',
            icon: '💰',
            title: 'Mixed Billing Types',
            content: `${mixedBillingProjects.length} project(s) have multiple billing types, which may indicate billing inconsistencies.`,
            list: mixedBillingProjects.map(item =>
                `${item.proj}: <span class="improvement-metric">${item.count} types</span> (${item.types.join(', ')})`)
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
    document.getElementById('dateFrom').value = '';
    document.getElementById('dateTo').value = '';

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
    document.getElementById('dateFrom').value = '';
    if (rawData.length > 0) {
        applyFilters();
    }
}

function clearDateTo() {
    document.getElementById('dateTo').value = '';
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
    return num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
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
function aggregateMonthlyData() {
    const aggregationMap = new Map();

    filteredData.forEach(row => {
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

    // Convert map to array
    monthlyAggregatedData = Array.from(aggregationMap.values());
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

    // Body rows
    const tbody = document.createElement('tbody');
    const monthTotals = {};
    sortedMonths.forEach(m => monthTotals[m] = 0);
    let grandTotal = 0;

    rowsArray.forEach((rowData) => {
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

    // Setup sorting event listeners for the newly created table
    setupMonthlySortingEventListeners();
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
