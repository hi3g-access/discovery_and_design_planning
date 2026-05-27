# GitHub Repository Sync Setup Guide

## Overview

**Option 2: GitHub Repository Sync** provides persistent, automatic storage for your requirement analyzer data. All your analyses are automatically saved to a GitHub repository with full version history.

### Benefits
- ✅ **Automatic backup**: Data auto-saves every 3 seconds after changes
- ✅ **Version history**: Full Git commit history of all changes
- ✅ **Team collaboration**: Share access by adding team members to the repository
- ✅ **Reliable**: Survives browser cache clears and device changes
- ✅ **Professional**: Uses your company's GitHub infrastructure

---

## Setup Instructions

### Step 1: Create a GitHub Repository

1. Go to [GitHub](https://github.com) and sign in to your **company account**
2. Click the **"+"** icon in the top right → **"New repository"**
3. Configure your repository:
   - **Repository name**: `requirement-analyzer-data` (or any name you prefer)
   - **Visibility**: Choose **Private** (recommended for sensitive data)
   - **Initialize**: ✅ Check "Add a README file" (recommended)
4. Click **"Create repository"**

### Step 2: Create a GitHub Personal Access Token

1. Go to [GitHub Settings → Personal Access Tokens → Tokens (classic)](https://github.com/settings/tokens)
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Configure the token:
   - **Note**: `Requirement Analyzer - Repository Sync`
   - **Expiration**: Choose an appropriate duration (30 days, 90 days, or No expiration)
   - **Scopes**: ✅ Check **`repo`** (Full control of private repositories)
     - This includes: `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`, `security_events`
4. Click **"Generate token"** at the bottom
5. **⚠️ IMPORTANT**: Copy the token immediately (starts with `ghp_...`)
   - Save it somewhere secure - you won't be able to see it again!

### Step 3: Configure the Application

1. Open the **Requirement Analyzer** application
2. In the left sidebar, click **"Export options ⌃"** to expand
3. Click **"GitHub Repository Sync ⌃"** to expand the settings
4. Fill in the configuration:
   - **GitHub Token**: Paste your token (`ghp_...`)
   - **Repository Owner**: Your GitHub username or organization name
     - Example: `your-username` or `your-company`
   - **Repository Name**: The name of the repository you created
     - Example: `requirement-analyzer-data`
   - **Branch Name**: Leave as `data` (or customize if needed)
     - This keeps your data separate from code/documentation

### Step 4: Initial Sync

1. Click **"Save Now"** to do an initial save to GitHub
2. You should see a green success message
3. Visit your repository on GitHub to verify:
   - Go to `https://github.com/YOUR-USERNAME/YOUR-REPO-NAME`
   - Switch to the `data` branch using the branch dropdown
   - You should see a file called `requirement-analyzer-data.json`

---

## How It Works

### Automatic Saving
- **Changes are auto-saved** 3 seconds after you stop typing
- A status indicator shows sync progress:
  - 🔵 Blue: "Saving to GitHub..."
  - ✅ Green: "Saved to GitHub"
  - ❌ Red: "Failed to save" (with error details)

### Manual Controls
- **Save Now**: Force an immediate save (useful before closing the app)
- **Load**: Load data from GitHub (useful when switching devices or recovering data)

### Version History
Every save creates a Git commit, giving you:
- **Full history** of all changes
- **Rollback capability** using Git
- **Audit trail** of when changes were made

To view history:
```bash
# Clone the repository
git clone https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
cd YOUR-REPO-NAME

# Switch to data branch
git checkout data

# View commit history
git log --oneline requirement-analyzer-data.json

# Restore a previous version
git show COMMIT-SHA:requirement-analyzer-data.json > restored-data.json
```

---

## Troubleshooting

### Error: "GitHub sync not configured"
- Make sure all four fields are filled in: Token, Owner, Repository Name, Branch
- Check that there are no extra spaces in any field

### Error: "Could not create branch 'data'"
- The repository might not exist or you don't have write access
- Verify the owner/repo names are correct
- Check that your token has `repo` scope

### Error: "Failed to save: 404"
- Repository doesn't exist or isn't accessible
- Double-check the owner and repository name
- Verify the token hasn't expired

### Error: "Failed to save: 403"
- Token doesn't have sufficient permissions
- Regenerate the token with `repo` scope selected

### Data Not Syncing
- Check the sync status indicator at the bottom of the settings
- Try clicking "Save Now" manually
- Open browser console (F12) and look for errors
- Verify your internet connection

### Loading Old Data
- Click "Load" to fetch the latest version from GitHub
- If you have local changes, they will be overwritten!
- Consider backing up by clicking "Export as Markdown" first

---

## Security Best Practices

### Token Security
- ✅ **DO**: Use a token with only `repo` scope (principle of least privilege)
- ✅ **DO**: Set an expiration date on tokens
- ✅ **DO**: Store tokens securely (they're saved in browser localStorage)
- ❌ **DON'T**: Share your token with others
- ❌ **DON'T**: Commit tokens to Git
- ❌ **DON'T**: Use tokens for production services

### Repository Security
- ✅ **DO**: Use a **private** repository for sensitive data
- ✅ **DO**: Enable two-factor authentication on your GitHub account
- ✅ **DO**: Review repository access regularly
- ✅ **DO**: Use your company's GitHub organization for company data

### Secure Mode
- If any analysis has "Secure Mode" enabled, GitHub sync is automatically disabled
- Secure mode data uses encrypted localStorage only (never sent to cloud)

---

## Team Collaboration

### Sharing Access
To let team members access the same data:

1. Go to your repository on GitHub
2. Click **Settings** → **Collaborators**
3. Add team members by their GitHub usernames
4. They should configure their app with:
   - Same repository owner/name
   - Their own GitHub token

### Collaboration Notes
- ⚠️ **No conflict resolution**: Last save wins
- 💡 **Best practice**: Coordinate who's editing when
- 💡 **Alternative**: Use different branches for different team members
- 💡 **Consider**: Setting up a team GitHub organization

---

## Comparison: Gist vs Repository Sync

| Feature | GitHub Gist | GitHub Repository |
|---------|-------------|-------------------|
| **Auto-save** | ❌ Manual only | ✅ Automatic (3s debounce) |
| **Version History** | ✅ Yes | ✅ Yes (better visibility) |
| **Team Sharing** | Share ID manually | ✅ GitHub permissions |
| **Scope** | Single analysis | ✅ All analyses |
| **Conflict Resolution** | ❌ None | ❌ None (last write wins) |
| **Token Scope** | `gist` | `repo` |
| **Best For** | Quick snapshots | Primary storage |

---

## Advanced Configuration

### Custom Branch Names
You can use different branch names for:
- Multiple environments: `data-dev`, `data-prod`
- Different users: `data-alice`, `data-bob`
- Different projects: `data-project-a`, `data-project-b`

### Multiple Repositories
To use different repositories:
1. Change the repository settings in the UI
2. Click "Load" to fetch data from the new repository
3. Your local data won't be lost unless you click "Load"

### Backup Strategy
For maximum safety:
1. **Primary**: GitHub Repository Sync (automatic)
2. **Backup**: Export as Markdown monthly
3. **Snapshot**: Save to Gist before major changes

---

## Need Help?

### Common Questions

**Q: Will my data be lost if the token expires?**
A: No! Data is always saved to localStorage first. GitHub sync is an additional backup. Renew your token to resume syncing.

**Q: Can I use this with GitHub Enterprise?**
A: The current implementation uses `https://api.github.com`. For GitHub Enterprise, you'd need to modify the `API_BASE` constant in `githubSync.js`.

**Q: How much data can I store?**
A: GitHub has file size limits (100MB per file, 1GB per repository recommended). Your analyses should be well within these limits.

**Q: Can I self-host this?**
A: Yes! The app is static and can be deployed anywhere. The GitHub API is called directly from the browser.

---

## Summary

You now have automatic, persistent storage for your requirement analyzer data using your company's GitHub infrastructure! 

✅ Data auto-saves every 3 seconds  
✅ Full version history via Git commits  
✅ Survives browser cache clears  
✅ Team collaboration via GitHub permissions  
✅ Professional and secure  

Your data is safe! 🎉
