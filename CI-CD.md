# CI/CD Pipeline Documentation

## Overview

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipeline for the NetSuite Time Tracking Analyzer application.

## Quick Start: Deploy to GitHub

**New to the project? Start here:**

1. **Create GitHub Repository**
   - Go to [GitHub](https://github.com) → New repository
   - Name: `netsuite-time-tracking-analyzer`
   - ⚠️ Do NOT initialize with README/license/.gitignore

2. **Push Your Code**
   ```bash
   cd C:\Users\mihtr\claude\NetSuiteMIT
   git remote add origin https://github.com/YOUR-USERNAME/netsuite-time-tracking-analyzer.git
   git branch -M main
   git push -u origin main
   ```

3. **Enable GitHub Pages**
   - Go to Settings → Pages
   - Source: **GitHub Actions**
   - Save

4. **Watch CI/CD Run**
   - Actions tab → Wait ~3-4 minutes
   - All jobs should show ✅

5. **Access Your App**
   - URL: `https://YOUR-USERNAME.github.io/netsuite-time-tracking-analyzer/`

**Done!** Your app is live. See sections below for details.

---

## Table of Contents

1. [Pipeline Architecture](#pipeline-architecture)
2. [GitHub Actions Workflow](#github-actions-workflow)
3. [Automated Tests](#automated-tests)
4. [Deployment Process](#deployment-process)
5. [Local Testing](#local-testing)
6. [Git Workflow](#git-workflow)
7. [Troubleshooting](#troubleshooting)

---

## Pipeline Architecture

The CI/CD pipeline consists of the following stages:

```
┌─────────────┐
│ Push to Git │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Validate   │  ← HTML validation, ESLint
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Test     │  ← Unit tests, Integration tests
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Build    │  ← File verification, Size check
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Security   │  ← npm audit, Security scan
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Deploy    │  ← GitHub Pages (main branch only)
└─────────────┘
```

---

## GitHub Actions Workflow

### Workflow File Location

`.github/workflows/ci.yml`

### Triggers

The pipeline runs on:
- **Push** to `main` or `develop` branches
- **Pull Requests** to `main` or `develop` branches
- **Manual trigger** via workflow_dispatch

### Jobs

#### 1. Validate Job
- **Purpose**: Validate code structure and syntax
- **Steps**:
  - Checkout code
  - Setup Node.js 18
  - Install dependencies
  - Run HTML validation
  - Run ESLint (non-blocking)

#### 2. Test Job
- **Purpose**: Run automated tests
- **Dependencies**: Requires `validate` job to pass
- **Steps**:
  - Checkout code
  - Setup Node.js 18
  - Install dependencies
  - Run unit tests
  - Run integration tests
  - Upload test results as artifacts

#### 3. Build Job
- **Purpose**: Verify build integrity
- **Dependencies**: Requires `test` job to pass
- **Steps**:
  - Checkout code
  - Verify all required files exist
  - Check file sizes

#### 4. Security Job
- **Purpose**: Scan for security vulnerabilities
- **Dependencies**: Requires `validate` job to pass
- **Steps**:
  - Checkout code
  - Setup Node.js 18
  - Install dependencies
  - Run npm audit (non-blocking)

#### 5. Deploy Pages Job
- **Purpose**: Deploy to GitHub Pages
- **Dependencies**: Requires all previous jobs to pass
- **Conditions**: Only runs on push to `main` branch
- **Steps**:
  - Checkout code
  - Setup GitHub Pages
  - Upload artifact
  - Deploy to GitHub Pages

---

## Automated Tests

### Test Structure

```
tests/
├── run-tests.js          # Main test runner (runs all tests)
├── validate-html.js      # HTML structure validation
├── unit-tests.js         # JavaScript unit tests
└── integration-tests.js  # Integration tests
```

### Running Tests Locally

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run validate
```

### Test Coverage

#### HTML Validation (validate-html.js)
Tests include:
- DOCTYPE declaration
- Required HTML structure (html, head, body)
- Meta tags (charset, viewport)
- Page title
- Script linking (app.js)
- Required UI elements (filters, buttons, tables)
- View containers (detail, monthly)
- Statistics sections
- Tab navigation
- Version number
- Flatpickr library inclusion
- Balanced HTML tags

#### Unit Tests (unit-tests.js)
Tests include:
- Core function existence (loadCSV, parseCSV, applyFilters, etc.)
- Monthly view functions
- Cache functions
- Sorting functions
- Filter functions
- Utility functions
- Global variables
- Column configuration
- Error handling
- Event listener setup
- Cache expiration logic

#### Integration Tests (integration-tests.js)
Tests include:
- HTML-JavaScript element matching
- Function call integrity
- View switching integration
- Cache integration
- Filter integration
- Sorting integration
- Documentation consistency
- Statistics integration
- Error handling integration
- Data flow integration

---

## Deployment Process

### GitHub Pages Deployment

The application automatically deploys to GitHub Pages when code is pushed to the `main` branch and all tests pass.

**Deployment URL Format:**
```
https://<username>.github.io/<repository-name>/
```

### Manual Deployment

If you need to deploy manually:

1. Go to your GitHub repository
2. Navigate to **Actions** tab
3. Select **CI Pipeline** workflow
4. Click **Run workflow**
5. Select `main` branch
6. Click **Run workflow** button

### Deployment Artifacts

The following files are deployed:
- `index.html` - Main application page
- `app.js` - Application logic
- `README.md` - Documentation
- `FIELD_CATALOG.md` - Field reference
- `TODO.md` - Project tracking
- `CLAUDE.md` - AI assistant guidance

**Note**: The CSV data file is excluded (via `.gitignore`) due to its large size (213 MB).

---

## Local Testing

### Prerequisites

- Node.js 14+ installed
- npm installed

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/netsuite-time-tracking-analyzer.git
cd netsuite-time-tracking-analyzer
```

2. Install dependencies:
```bash
npm install
```

3. Place the CSV file in the project root:
```
MIT Time Tracking Dataset (NewOrg).csv
```

### Running Locally

#### Option 1: Direct File Open
- Open `index.html` in a modern browser
- Works in most browsers without a server

#### Option 2: Local Server
```bash
npm run serve
```
Then open: `http://localhost:8080`

### Running Tests Locally

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run validate

# Run full CI suite
npm run ci
```

---

## Git Workflow

### Branch Strategy

We use a simplified Git Flow:

- **main** - Production-ready code, deploys to GitHub Pages
- **develop** - Integration branch for features
- **feature/** - Feature branches (e.g., `feature/data-export`)
- **bugfix/** - Bug fix branches (e.g., `bugfix/filter-error`)

### Workflow Steps

1. **Create Feature Branch**
```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
```

2. **Make Changes and Commit**
```bash
git add .
git commit -m "feat: Add your feature description"
```

3. **Push to Remote**
```bash
git push origin feature/your-feature-name
```

4. **Create Pull Request**
- Go to GitHub
- Create PR from `feature/your-feature-name` to `develop`
- Wait for CI checks to pass
- Request review
- Merge after approval

5. **Merge to Main**
```bash
git checkout main
git pull origin main
git merge develop
git push origin main
```
This triggers automatic deployment to GitHub Pages.

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

**Examples:**
```
feat: Add export to CSV functionality
fix: Resolve filter error when selecting all items
docs: Update README with caching instructions
test: Add unit tests for cache functions
```

---

## Troubleshooting

### Common Issues

#### Issue 1: Tests Failing Locally

**Symptoms**: Tests pass in CI but fail locally

**Solution**:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Run tests again
npm test
```

#### Issue 2: GitHub Actions Workflow Not Triggering

**Symptoms**: Push to branch doesn't trigger CI

**Possible Causes**:
- Branch name doesn't match trigger conditions
- Workflow file has syntax errors
- Actions are disabled for the repository

**Solution**:
1. Check workflow file syntax: `.github/workflows/ci.yml`
2. Verify Actions are enabled: Settings → Actions → Allow all actions
3. Manually trigger: Actions → CI Pipeline → Run workflow

#### Issue 3: Deployment to GitHub Pages Fails

**Symptoms**: CI passes but Pages doesn't update

**Solution**:
1. Go to Settings → Pages
2. Ensure Source is set to "GitHub Actions"
3. Check deployment logs in Actions tab
4. Verify Pages permissions: Settings → Actions → Workflow permissions

#### Issue 4: Large CSV File in Git

**Symptoms**: Git push fails due to file size

**Solution**:
```bash
# CSV file should be in .gitignore
# If accidentally committed, remove from Git history
git rm --cached "MIT Time Tracking Dataset (NewOrg).csv"
git commit -m "Remove large CSV file from Git"
git push
```

**Note**: Users should download the CSV file separately or use cached data.

#### Issue 5: ESLint Errors

**Symptoms**: Lint step fails in CI

**Solution**:
The lint step is currently set to `continue-on-error: true`, so it won't block the pipeline. To fix warnings:

```bash
# Install ESLint locally
npm install eslint --save-dev

# Run linting
npm run lint

# Fix auto-fixable issues
npx eslint app.js --fix
```

---

## Security Considerations

### Secrets Management

- No secrets or API keys should be committed
- Use GitHub Secrets for sensitive data
- `.env` files are gitignored

### Dependency Security

- `npm audit` runs on every CI build
- Update dependencies regularly:
```bash
npm update
npm audit fix
```

### CORS and CSP

- Application runs entirely client-side
- No backend API required
- All data processing in browser
- localStorage used for caching

---

## Performance Monitoring

### Build Times

Typical CI pipeline execution times:
- **Validate**: ~30 seconds
- **Test**: ~45 seconds
- **Build**: ~15 seconds
- **Security**: ~30 seconds
- **Deploy**: ~1 minute

**Total**: ~3-4 minutes

### Optimization Tips

1. **Cache Dependencies**: Uses `actions/setup-node@v3` with cache
2. **Parallel Jobs**: Validate and Security run in parallel
3. **Conditional Deploy**: Only runs on `main` branch pushes

---

## Maintenance

### Regular Tasks

#### Weekly
- Review failed builds
- Check for dependency updates
- Review security audit results

#### Monthly
- Update Node.js version in workflow if needed
- Review and update test coverage
- Clean up old branches

#### Quarterly
- Update GitHub Actions to latest versions
- Review and optimize pipeline performance
- Update documentation

---

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodebestpractices#section-4-testing-and-overall-quality-practices)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

## Support

For issues or questions:
1. Check this documentation
2. Review the [README.md](README.md)
3. Check [TODO.md](TODO.md) for known issues
4. Open an issue on GitHub

---

**Last Updated**: 2025-12-08
**Version**: 1.4.0
