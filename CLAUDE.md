# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working with this repository.

## Repository Overview

Web-based application for analyzing NetSuite time tracking data from an ERP system. The application provides data visualization, filtering, aggregation, and insights for project management, billing, and resource allocation.

**Live Demo**: https://mihtr.github.io/netsuite-time-tracking-analyzer/

## Dataset Information

**Primary Dataset**: `MIT Time Tracking Dataset (NewOrg) (10-12-2025).csv`
- **Format**: Semicolon-delimited CSV, UTF-8 BOM encoding
- **Size**: 213 MB, 326,000+ rows, 59 columns
- **Updated**: December 10, 2025

### Critical Data Characteristics

1. **Delimiter**: Semicolon (;) - NOT comma
2. **Decimal separator**: Comma (,) - NOT period (e.g., "1,50" = 1.5 hours)
3. **Date format**: DD.MM.YYYY (European)
4. **Time format**: HH:MM with leading zeros

**For complete field reference**: See `FIELD_CATALOG.md` (59 fields documented with data types, examples, and descriptions)

## Key Application Features

- **Data Views**: Detail view and Monthly pivot table
- **Filtering**: Date range, product, project type with auto-apply
- **Analytics**: Statistics dashboard, time distribution, anomaly detection
- **Caching**: localStorage with 7-day expiration
- **Performance**: Pagination, progress bars, efficient rendering
- **CI/CD**: Automated testing and GitHub Pages deployment

## Development Guidelines

### Version Management (CRITICAL)

**ALWAYS bump version when completing ANY task or feature.**

Update these 4 locations in order:
1. `index.html` line ~530 - subtitle span: `v1.X.X`
2. `package.json` line 3 - version field: `"1.X.X"`
3. `TODO.md` lines 3-6 - version and date
4. `TODO.md` ~line 273 - add changelog entry at TOP

**Version numbering**: `MAJOR.MINOR.PATCH`
- MAJOR: Breaking changes
- MINOR: New features (e.g., 1.4.3 → 1.4.4)
- PATCH: Bug fixes

### Documentation Maintenance

**See `MAINTENANCE_RULES.md` for comprehensive guidelines**, including:
- Complete version management workflow
- TODO.md and SUGGESTED_IMPROVEMENTS.md update procedures
- Pre-commit checklists and commit message standards
- Practical examples and quarterly review guidelines

### Repository Structure

```
├── index.html                   # Main application
├── app.js                       # Application logic
├── .github/workflows/           # CI/CD pipeline
├── tests/                       # Automated tests (105+ tests)
├── DOCUMENTATION.md             # Documentation navigation guide
├── MAINTENANCE_RULES.md         # Documentation maintenance guide
├── FIELD_CATALOG.md             # Complete field reference (59 fields)
├── TODO.md                      # Project tracking and changelog
├── SUGGESTED_IMPROVEMENTS.md    # Feature ideas and enhancements
├── README.md                    # User documentation
├── CI-CD.md                     # Pipeline and deployment documentation
├── CLAUDE.md                    # This file
└── ARCHIVED-*.md                # Historical documentation (outdated)
```

**For complete documentation index**: See `DOCUMENTATION.md`
