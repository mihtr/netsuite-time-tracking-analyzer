# NetSuite Time Tracking Analyzer

A web-based application for viewing and analyzing NetSuite time tracking data with advanced filtering and aggregation capabilities.

## 🚀 Live Demo

**View the application:** https://mihtr.github.io/netsuite-time-tracking-analyzer/

The application is automatically deployed to GitHub Pages via CI/CD pipeline on every push to main.

## Features

### 📊 Data Visualization
- **Aggregated View**: Groups time entries by Main Product, Customer:Project, Name, Type (MTYPE2), and Task
- **Total Hours**: Automatically calculates and displays total hours for each aggregated group
- **Sortable Columns**: Click any column header to sort data (all views support sorting)
- **Dual Views**: Switch between Detail View and Monthly Pivot Table View
- **Monthly Pivot Table**: See time distribution across months with row/column totals

### 🔍 Advanced Filtering
- **Date Range Filter**: Filter entries by start and end date with calendar picker
- **Main Product Filter**: Multi-select filter by product line
- **Project Type Filter**: Multi-select filter by project type
- **Auto-Apply**: Filters apply automatically when changed
- **Clear Individual Filters**: ✕ button on each filter to clear it separately
- **Filter Presets**: Save, load, and delete custom filter combinations
- **Reset**: Quick reset button to clear all filters at once

### 📈 Statistics Dashboard
- **Total Records**: Count of aggregated entries
- **Total Hours**: Sum of all hours in filtered data
- **Unique Projects**: Count of distinct projects
- **Unique Products**: Count of distinct products
- **Monthly Stats**: Average hours per month, date range coverage

### 💡 Time Distribution Analytics
- **Peak Day Analysis**: Shows which day of the week has the most hours
- **Top Billing Type**: Displays most common billing type with percentage
- **Average Hours/Month**: Calculates monthly average across data range
- **Weekday Distribution**: Shows percentage of hours on weekdays vs weekends
- **Auto-Updates**: Insights update automatically when filters change

### ⚠️ Anomaly Detection & Data Quality
- **Automated Data Quality Checks**: Detects 6 types of potential data issues automatically
- **Weekend Entries** 📅: Identifies time logged on Saturdays/Sundays for approval verification
- **Time Gaps** ⏸️: Detects employees with >10 consecutive days without entries
- **Duplicate Entries** 📋: Finds multiple entries for same employee/project/date/task (HIGH priority)
- **Unusual Descriptions** 📝: Flags descriptions <5 or >300 characters for review
- **Inactive Projects** 💤: Identifies projects with no activity for >30 days
- **Hour Spikes** 📈: Detects >200% hour increases week-over-week (HIGH priority)
- **Visual Dashboard**: Color-coded severity badges (RED/ORANGE/BLUE) for easy scanning
- **Anomaly Badge**: Red notification badge on navigation button shows issue count
- **Actionable Recommendations**: Context-specific guidance for addressing each issue type
- **Performance Optimized**: Displays top 100 anomalies for fast loading
- **Clean Data Confirmation**: Green success message when no issues detected

### ⚡ Performance Features
- **Data Caching**: First load parses CSV, subsequent loads instant from cache
- **Progress Bar**: Real-time loading progress with ETA and row counter
- **Pagination**: Displays 500 rows per page (configurable: 100/250/500/1000)
- **Cache Management**: Manual clear cache button to force reload
- **Auto-Expiration**: Cache expires after 7 days for freshness
- **Efficient Rendering**: DocumentFragment for batch DOM operations

## How to Use

### Getting Started

1. **Open the Application**
   - Ensure `index.html`, `app.js`, and `MIT Time Tracking Dataset (NewOrg).csv` are in the same directory
   - Open `index.html` in a modern web browser (Chrome, Firefox, Edge, Safari)
   - The CSV file will automatically load on page open
   - No installation or server setup required!

2. **Wait for Data to Load**
   - **First time**: The application will automatically load the CSV file (may take 10-30 seconds for large 213MB file)
   - **Subsequent times**: Data loads instantly from browser cache
   - A success message will appear when loading is complete
   - Use "Clear Cache" button if you need to reload fresh data

3. **Apply Filters** (Optional)
   - **Date From**: Select a start date using the calendar picker (DD/MM/YYYY format)
   - **Date To**: Select an end date using the calendar picker
   - **Main Product**: Multi-select products (Ctrl/Cmd+Click to select multiple)
   - **Project Type**: Multi-select project types (Ctrl/Cmd+Click to select multiple)
   - Filters apply **automatically** when you make selections
   - Click **✕** button next to any filter label to clear that specific filter
   - Click **💾 Save Preset** to save current filter combination
   - Select from **Saved Filter Presets** dropdown to quickly apply saved filters
   - Click **🗑️ Delete** to remove selected preset
   - Click "Reset All Filters" to clear all filters at once
   - Click "Clear Cache" to force reload data from file

4. **View and Sort Results**
   - **Detail View Tab** (📋): Shows aggregated time entries
     - Click any column header to sort
     - Columns: Main Product, Customer:Project, Name, Type, Task, Total Hours
   - **Monthly View Tab** (📅): Shows pivot table with months as columns
     - Click any column header to sort by that dimension
     - Click month columns to sort by that month's hours
     - Click Total column to sort by row totals
   - Sort indicators (▲/▼) show current sort direction
   - Statistics dashboard updates automatically with filters

### Important Note
⚠️ **For the application to work, you must open it through a local web server or open the HTML file directly.**

If you get a CORS error, you have two options:
1. **Simple**: Just open `index.html` by double-clicking it (works in most browsers)
2. **Alternative**: Use a local web server:
   - Python: `python -m http.server 8000` then open `http://localhost:8000`
   - Node.js: `npx http-server` then open the provided URL
   - Or use any other local web server

## Technical Details

### Data Format Requirements
- **File Format**: CSV with semicolon (;) delimiter
- **Encoding**: UTF-8 (with or without BOM)
- **Decimal Separator**: Comma (,) for decimal numbers
- **Date Format**: DD.MM.YYYY (European format)

### Aggregation Logic
The application groups time entries by:
1. EG - Main Product (Project Task Time Tracking)
2. Customer:Project
3. Name
4. MTYPE2
5. Task

Hours (dur_dec) are summed for each unique combination of these fields.

### Browser Compatibility
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Edge 90+
- ✅ Safari 14+

### File Size Handling
The application can handle large CSV files (200+ MB) but performance depends on your browser and system resources:
- **< 50 MB**: Instant loading
- **50-200 MB**: 5-15 seconds loading time
- **> 200 MB**: May experience delays, consider filtering your CSV before loading

## Troubleshooting

### "Error parsing CSV file"
- Ensure the CSV uses semicolon (;) as the delimiter
- Check that the file encoding is UTF-8
- Verify the file has the correct column structure (56 columns)

### "No data matches the current filters"
- Try resetting filters using the "Reset" button
- Check if your date range includes actual data entries
- Verify that the selected product/project type exists in the dataset

### Application runs slowly
- The initial load may take 10-30 seconds for large files (200+ MB) but shows progress bar
- Pagination (500 rows/page) ensures smooth scrolling even with large datasets
- Reduce rows per page (100 or 250) if experiencing performance issues
- Consider pre-filtering your CSV to reduce file size
- Use Chrome or Edge for best performance
- Close other browser tabs to free up memory

## Files Included

- **index.html**: Main application interface
- **app.js**: Application logic and data processing
- **FIELD_CATALOG.md**: Complete field reference with data types
- **CLAUDE.md**: Repository overview for AI assistants
- **README.md**: This file

## Privacy & Security

- ✅ **100% Client-Side**: All data processing happens in your browser
- ✅ **No Server Upload**: Your data never leaves your computer
- ✅ **No Internet Required**: Works completely offline after loading
- ✅ **No Data Storage**: Data is cleared when you close the browser

## Future Enhancements

Potential features for future versions:
- ✅ ~~Column sorting by clicking headers~~ (Completed)
- ✅ ~~Pagination for large result sets~~ (Completed)
- ✅ ~~Custom date range presets~~ (Completed - Filter Presets)
- ✅ ~~Time distribution analytics~~ (Completed)
- Export filtered/aggregated data to CSV
- Additional aggregation options (by employee, by department, by week)
- Charts and graphs for visual analysis
- Search functionality within results
- Date validation with error messages
- More advanced analytics (top performers, underutilized resources)
