# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a data repository containing NetSuite time tracking data from an ERP system. The repository contains a single large CSV dataset with time tracking entries for project management, billing, and resource allocation.

## Data Structure

**Primary Dataset**: `MIT Time Tracking Dataset (NewOrg).csv`
- **Size**: ~213 MB, 326,231 rows
- **Format**: Semicolon-delimited CSV with UTF-8 BOM encoding
- **Line endings**: Mixed CRLF and LF

### Key Data Fields

The dataset contains 56 columns tracking various aspects of time entries:

**Project Information**:
- Customer/Project identification (MKundenavn, Name, Customer:Project)
- Project types: Internal Product Project, Customer Standard Project, Internal Administration Project, Internal Business Project
- Project names and references (PROJ codes)

**Time Tracking**:
- Date, Duration (HH:MM format and decimal)
- Employee identification and supervisor
- Task descriptions and memos

**Billing & Finance**:
- Billable status (true/false)
- Billing classes (CAPEX, Bill, NonBill)
- Price levels and amounts
- Approval status
- IFRS adjustment flags
- Capitalization eligibility

**Organizational**:
- Department (e.g., "00316 EG Utility - DevOps")
- Team assignments
- Subsidiary and location
- Manager tracking

**Technical/Integration**:
- JIRA integration (MisJira, EG - External Issue Number)
- Main/Sub product tracking (Xellent D365, Xellent AX2009, SonWin, EG Zynergy)
- Task delivery types
- Service items

### Data Characteristics

- **Mixed billing types**: Contains billable (CFD, PS), non-billable, and CAPEX entries
- **Multi-tenant**: Multiple customers and subsidiaries (primarily EGDK - Eg Danmark A/S)
- **Product lines**: Xellent (D365 and AX2009), SonWin, EG Zynergy, Unite
- **Activity codes**: Technical debt, Administration, Professional services, New features, Account Management, Internal projects
- **Date range**: Includes historical data from multiple months/years

## Working with the Data

When analyzing this dataset:

1. **Delimiter**: Use semicolon (;) as field separator, not comma
2. **Encoding**: Handle UTF-8 BOM properly when reading
3. **Decimal separator**: Decimal values use comma (,) not period (.) - e.g., "1,50" for 1.5 hours
4. **Empty fields**: Many optional fields are empty
5. **Very long lines**: Some records exceed 962 characters

## Common Analysis Tasks

- Time tracking by employee, project, or customer
- Billable vs non-billable hour analysis
- CAPEX tracking and capitalization reporting
- Project budget tracking and utilization
- Department/team resource allocation
- JIRA issue time correlation
- Product line workload distribution

## Development Guidelines

### Version Management
**IMPORTANT: Always bump the version number when completing a task or feature.**

When completing work:
1. Update version in `index.html` (in the subtitle span)
2. Update version in `package.json` (version field)
3. Update version in `TODO.md` (Project Information section)
4. Add changelog entry in `TODO.md` (🔄 Change Log section)
5. Commit with descriptive message

Version numbering: `MAJOR.MINOR.PATCH`
- MAJOR: Breaking changes or major feature releases
- MINOR: New features, enhancements (e.g., 1.4.3 → 1.4.4)
- PATCH: Bug fixes, minor tweaks

### File Locations
- Version display: `index.html` line ~530 in subtitle
- Package version: `package.json` line 3
- Project info: `TODO.md` lines 3-6
- Changelog: `TODO.md` starting around line 273
