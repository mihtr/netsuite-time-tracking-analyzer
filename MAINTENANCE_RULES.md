# MAINTENANCE_RULES.md

## Documentation Maintenance Guidelines

This document establishes rules and processes for keeping project documentation synchronized with code changes.

## Rule 1: Version Management

### When Completing ANY Task or Feature

**ALWAYS** update these four locations in order:

1. **index.html** (line ~530)
   - Update version number in subtitle span: `<span style="color: var(--text-tertiary); font-size: 0.9em;">v1.X.X</span>`

2. **package.json** (line 3)
   - Update version field: `"version": "1.X.X"`

3. **TODO.md** (lines 3-6 in Project Information section)
   - Update version number: `- **Current Version**: v1.X.X`
   - Update last updated date: `- **Last Updated**: YYYY-MM-DD`

4. **TODO.md** (Change Log section, ~line 273)
   - Add new entry at the TOP of the change log with format:
     ```markdown
     ### v1.X.X - Brief Feature Name (YYYY-MM-DD)
     - Detailed description of changes
     - Additional bullet points as needed
     - Technical details or implementation notes
     ```

### Version Numbering

Use semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR** (X.0.0): Breaking changes or major feature releases
  - Example: Complete UI redesign, data format changes

- **MINOR** (1.X.0): New features, enhancements
  - Example: New tab, new data view, significant feature additions

- **PATCH** (1.0.X): Bug fixes, minor tweaks, small improvements
  - Example: Layout fixes, color adjustments, tooltip additions

## Rule 2: TODO.md Management

### Adding New Tasks

When a new feature request or bug is identified:

1. Add to appropriate section in TODO.md:
   - **🔥 High Priority / Active Work**
   - **📋 Planned Features / Improvements**
   - **🐛 Known Issues**
   - **💡 Ideas / Future Considerations**

2. Use this format:
   ```markdown
   - [ ] **Feature/Task Name**
     - Description of what needs to be done
     - Technical requirements or considerations
     - Expected outcome
   ```

### Completing Tasks

When a task is completed:

1. **Move** the item from its current section to the **🔄 Change Log** section
2. **Remove** the checkbox `- [ ]`
3. **Add** the version number and date as a subheading
4. **Keep** the description intact for historical tracking

Example transformation:
```markdown
# Before (in Planned Features)
- [ ] **Employee Hover Popup**
  - Show detailed stats when hovering over employee name
  - Include hours, billable %, activity codes, projects

# After (moved to Change Log)
### v1.19.0 - Employee Hover Popup (2025-12-10)
- Show detailed stats when hovering over employee name
- Include hours, billable %, activity codes, projects
```

## Rule 3: SUGGESTED_IMPROVEMENTS.md Management

### Reviewing After Each Release

After completing a version release:

1. **Review** the SUGGESTED_IMPROVEMENTS.md file
2. **Identify** any items that were completed in the release
3. **Mark** completed items with `✅ COMPLETED` and version number
4. **Move** completed items to the "Completed" section in Priority Matrix
5. **Update** document metadata at bottom

### Marking Items as Complete

Use this format:

```markdown
### ✅ COMPLETED: Feature Name (vX.X.X)

**Original Description**: [Keep original text]

**Status**: Implemented in version X.X.X (Date)

**What was delivered**:
- Specific feature 1
- Specific feature 2
- Additional enhancements

**Remaining work** (if applicable):
- Future enhancements not yet implemented
```

### Partial Completions

When a feature is partially implemented:

```markdown
### 🔶 PARTIALLY COMPLETED: Feature Name (vX.X.X)

**Status**: Core functionality implemented in vX.X.X, advanced features pending

**Completed**:
- ✅ Basic feature X
- ✅ Core functionality Y

**Remaining**:
- ⏳ Advanced feature A
- ⏳ Enhancement B
```

### Document Metadata Updates

Always update the bottom section:

```markdown
---

**Last Updated**: YYYY-MM-DD
**Current Version**: vX.X.X
**Items Completed**: XX major features (vX.X.X → vX.X.X)
**Next Review**: [Quarter] [Year]
```

## Rule 4: CLAUDE.md Management

### When Dataset Changes

If the CSV dataset is updated:

1. Update **Primary Dataset** section with new filename
2. Update **Size** if significantly different
3. Add new columns to **Key Data Fields** section
4. Update **Date range** if applicable
5. Note any format or structure changes

### When Analysis Patterns Change

If new common analysis tasks emerge:

1. Add to **Common Analysis Tasks** section
2. Document any new data characteristics discovered
3. Update working guidelines if delimiter/encoding changes

## Checklist: Completing a Feature

Use this checklist every time you complete work:

```markdown
## Pre-Commit Checklist

- [ ] 1. Test the feature thoroughly
- [ ] 2. Update version in index.html (subtitle span)
- [ ] 3. Update version in package.json
- [ ] 4. Update version in TODO.md (Project Information section)
- [ ] 5. Update last updated date in TODO.md
- [ ] 6. Add changelog entry in TODO.md (at TOP of Change Log)
- [ ] 7. Move completed tasks from other sections to Change Log
- [ ] 8. Review SUGGESTED_IMPROVEMENTS.md for completed items
- [ ] 9. Mark completed items as ✅ COMPLETED with version number
- [ ] 10. Update SUGGESTED_IMPROVEMENTS.md metadata
- [ ] 11. Update CLAUDE.md if dataset or structure changed
- [ ] 12. Create git commit with descriptive message
```

## Commit Message Format

Use clear, descriptive commit messages:

```
feat: Brief description of new feature vX.X.X

- Detailed change 1
- Detailed change 2
- Technical note if relevant
```

Types:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `refactor:` Code refactoring
- `style:` Formatting changes
- `perf:` Performance improvements

## Examples

### Example 1: Adding a New Feature

**Scenario**: User requests "Add export to Excel functionality"

**Steps**:
1. Implement the feature in code (app.js, index.html)
2. Test thoroughly
3. Update index.html version: v1.21.0 → v1.22.0
4. Update package.json version: "1.21.0" → "1.22.0"
5. Update TODO.md Project Information: v1.21.0 → v1.22.0 and date
6. Add to TODO.md Change Log:
   ```markdown
   ### v1.22.0 - Excel Export (2025-12-10)
   - Added Excel export functionality to all data views
   - Supports .xlsx format with formatting preserved
   - Includes filtered data only
   ```
7. Check SUGGESTED_IMPROVEMENTS.md - if "Excel Export" was listed, mark as completed
8. Commit: `feat: Add Excel export functionality v1.22.0`

### Example 2: Fixing a Bug

**Scenario**: Fix date sorting issue in pivot table

**Steps**:
1. Fix the bug in app.js
2. Test thoroughly
3. Update versions: v1.22.0 → v1.22.1 (PATCH for bug fix)
4. Update TODO.md changelog:
   ```markdown
   ### v1.22.1 - Fix Date Sorting (2025-12-10)
   - Fixed incorrect month ordering in pivot table
   - Dates now sort chronologically in all views
   ```
5. If bug was listed in "Known Issues", move to Change Log
6. Commit: `fix: Correct date sorting in pivot table v1.22.1`

### Example 3: Major Release

**Scenario**: Complete overhaul of filtering system (breaking changes)

**Steps**:
1. Implement changes
2. Update versions: v1.22.1 → v2.0.0 (MAJOR version bump)
3. Update all documentation
4. Add comprehensive changelog entry
5. Review ALL open items in TODO.md and SUGGESTED_IMPROVEMENTS.md
6. Update CLAUDE.md if data processing changed
7. Commit: `feat!: Complete filtering system overhaul v2.0.0`

## Quarterly Review

Every quarter (Q1, Q2, Q3, Q4):

1. Review all documentation files for accuracy
2. Archive completed items over 6 months old
3. Re-prioritize SUGGESTED_IMPROVEMENTS.md items
4. Update "Next Review" date in all documentation
5. Clean up outdated TODOs
6. Update CLAUDE.md if analysis patterns have changed

---

**Document Version**: 1.0.0
**Created**: 2025-12-10
**Last Updated**: 2025-12-10
