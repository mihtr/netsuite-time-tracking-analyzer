# GitHub Setup Guide

## Quick Start: Push to GitHub

Follow these steps to push your repository to GitHub and enable the CI/CD pipeline.

---

## Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the **+** button in the top-right corner
3. Select **New repository**
4. Fill in the details:
   - **Repository name**: `netsuite-time-tracking-analyzer`
   - **Description**: `Web-based application for analyzing NetSuite time tracking data`
   - **Visibility**: Public or Private (your choice)
   - **⚠️ IMPORTANT**: Do NOT initialize with README, .gitignore, or license
5. Click **Create repository**

---

## Step 2: Connect Local Repository to GitHub

GitHub will show you commands. Use these:

```bash
cd C:\Users\mihtr\claude\NetSuiteMIT

# Add remote (replace YOUR-USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR-USERNAME/netsuite-time-tracking-analyzer.git

# Rename branch to main (GitHub's default)
git branch -M main

# Push to GitHub
git push -u origin main
```

**Alternative using SSH** (if you have SSH keys set up):
```bash
git remote add origin git@github.com:YOUR-USERNAME/netsuite-time-tracking-analyzer.git
git branch -M main
git push -u origin main
```

---

## Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Click **Pages** in the left sidebar
4. Under **Source**, select:
   - Source: **GitHub Actions**
5. Click **Save**

---

## Step 4: Verify CI/CD Pipeline

1. Go to the **Actions** tab in your repository
2. You should see the "CI Pipeline" workflow running
3. Wait for it to complete (about 3-4 minutes)
4. All jobs should show green checkmarks ✅

### Pipeline Jobs:
- ✅ **Validate** - HTML and code validation
- ✅ **Test** - Unit and integration tests
- ✅ **Build** - File verification
- ✅ **Security** - Security audit
- ✅ **Deploy Pages** - Deploy to GitHub Pages

---

## Step 5: Access Your Deployed Application

After the pipeline completes successfully:

1. Go to **Settings** → **Pages**
2. You'll see: "Your site is live at https://YOUR-USERNAME.github.io/netsuite-time-tracking-analyzer/"
3. Click the URL to view your deployed application

**Note**: The CSV data file is not included in the deployment (too large for Git). Users will need to:
- Use the file upload feature, OR
- The app will use cached data from previous sessions

---

## Step 6: Setup Branch Protection (Optional but Recommended)

1. Go to **Settings** → **Branches**
2. Click **Add rule** under "Branch protection rules"
3. Branch name pattern: `main`
4. Enable:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - Select status checks: `validate`, `test`, `build`
5. Click **Create**

This ensures all changes go through the CI/CD pipeline before merging to main.

---

## Common Commands

### View remote configuration
```bash
git remote -v
```

### Push changes
```bash
git add .
git commit -m "feat: Your feature description"
git push origin main
```

### Create feature branch
```bash
git checkout -b feature/your-feature
git push -u origin feature/your-feature
```

### Update from remote
```bash
git pull origin main
```

---

## Troubleshooting

### Issue: "fatal: remote origin already exists"

**Solution:**
```bash
git remote remove origin
git remote add origin https://github.com/YOUR-USERNAME/netsuite-time-tracking-analyzer.git
```

### Issue: Authentication failed

**Solution 1 - Use Personal Access Token:**
1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token with `repo` scope
3. Use token as password when pushing

**Solution 2 - Use GitHub CLI:**
```bash
# Install GitHub CLI: https://cli.github.com/
gh auth login
git push origin main
```

### Issue: Push rejected (non-fast-forward)

**Solution:**
```bash
git pull origin main --rebase
git push origin main
```

### Issue: Large file error (CSV file)

**Solution:**
The .gitignore should prevent this, but if it happens:
```bash
git rm --cached "MIT Time Tracking Dataset (NewOrg).csv"
git commit -m "Remove large CSV file"
git push origin main
```

---

## What Happens Next?

### Every push to `main` branch:
1. ✅ CI pipeline runs automatically
2. ✅ Tests validate your code
3. ✅ If all pass, deploys to GitHub Pages
4. ✅ Your live site updates within 1-2 minutes

### Every pull request:
1. ✅ CI pipeline runs
2. ✅ Shows pass/fail status
3. ❌ Blocks merge if tests fail
4. ✅ Allows merge if tests pass

---

## Repository Structure

```
netsuite-time-tracking-analyzer/
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions workflow
├── tests/
│   ├── run-tests.js            # Test runner
│   ├── validate-html.js        # HTML validation
│   ├── unit-tests.js           # Unit tests
│   └── integration-tests.js    # Integration tests
├── index.html                  # Main application
├── app.js                      # Application logic
├── package.json                # Node.js dependencies
├── .gitignore                  # Git ignore rules
├── LICENSE                     # MIT License
├── README.md                   # User documentation
├── CI-CD.md                    # CI/CD documentation
├── TODO.md                     # Project tracking
├── FIELD_CATALOG.md            # Data structure reference
├── CLAUDE.md                   # AI assistant guidance
└── GITHUB_SETUP.md             # This file
```

---

## Next Steps

1. ✅ Push to GitHub (you're doing this now!)
2. ⏭️ Enable GitHub Pages
3. ⏭️ Verify CI/CD pipeline runs
4. ⏭️ Access your deployed application
5. ⏭️ (Optional) Set up branch protection
6. ⏭️ Share your application URL!

---

## Support

- **CI/CD Issues**: See [CI-CD.md](CI-CD.md)
- **Application Issues**: See [README.md](README.md)
- **Feature Requests**: See [TODO.md](TODO.md)

---

**Ready to push? Run these commands:**

```bash
# Replace YOUR-USERNAME with your GitHub username
git remote add origin https://github.com/YOUR-USERNAME/netsuite-time-tracking-analyzer.git
git branch -M main
git push -u origin main
```

🚀 **Good luck!**
