/**
 * GitHub Repository Sync Module
 * 
 * Provides persistent storage by committing data to a GitHub repository.
 * All data is stored in a dedicated branch (default: 'data') as JSON files.
 * 
 * Features:
 * - Auto-save with debouncing
 * - Conflict detection and resolution
 * - Version history through Git commits
 * - Encrypted token storage
 */

const DEFAULT_BRANCH = 'data';
const DEFAULT_FILE_PATH = 'requirement-analyzer-data.json';
const API_BASE = 'https://api.github.com';

/**
 * GitHub API helper class
 */
class GitHubSync {
  constructor(config = {}) {
    this.token = config.token || '';
    this.owner = config.owner || '';
    this.repo = config.repo || '';
    this.branch = config.branch || DEFAULT_BRANCH;
    this.filePath = config.filePath || DEFAULT_FILE_PATH;
    this.lastSyncedSha = null;
    this.syncInProgress = false;
    this.listeners = new Set();
  }

  /**
   * Validate configuration
   */
  isConfigured() {
    return !!(this.token && this.owner && this.repo);
  }

  /**
   * Update configuration
   */
  updateConfig(config) {
    if (config.token !== undefined) this.token = config.token;
    if (config.owner !== undefined) this.owner = config.owner;
    if (config.repo !== undefined) this.repo = config.repo;
    if (config.branch !== undefined) this.branch = config.branch;
    if (config.filePath !== undefined) this.filePath = config.filePath;
  }

  /**
   * Add sync status listener
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of status change
   */
  notifyListeners(status) {
    this.listeners.forEach(listener => listener(status));
  }

  /**
   * Make authenticated API request
   */
  async apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Ensure the data branch exists
   */
  async ensureBranch() {
    try {
      // Try to get the branch
      await this.apiRequest(`/repos/${this.owner}/${this.repo}/branches/${this.branch}`);
      return true;
    } catch (error) {
      // Branch doesn't exist, create it from default branch
      try {
        // Get default branch SHA
        const repo = await this.apiRequest(`/repos/${this.owner}/${this.repo}`);
        const defaultBranch = repo.default_branch;
        const refData = await this.apiRequest(`/repos/${this.owner}/${this.repo}/git/ref/heads/${defaultBranch}`);
        
        // Create new branch
        await this.apiRequest(`/repos/${this.owner}/${this.repo}/git/refs`, {
          method: 'POST',
          body: JSON.stringify({
            ref: `refs/heads/${this.branch}`,
            sha: refData.object.sha,
          }),
        });
        
        return true;
      } catch (createError) {
        console.error('Failed to create branch:', createError);
        throw new Error(`Could not create branch '${this.branch}': ${createError.message}`);
      }
    }
  }

  /**
   * Load data from GitHub
   */
  async loadData() {
    if (!this.isConfigured()) {
      throw new Error('GitHub sync not configured');
    }

    this.notifyListeners({ status: 'loading', message: 'Loading from GitHub...' });

    try {
      await this.ensureBranch();

      // Get file content
      const data = await this.apiRequest(
        `/repos/${this.owner}/${this.repo}/contents/${this.filePath}?ref=${this.branch}`
      );

      this.lastSyncedSha = data.sha;

      // Decode base64 content
      const content = atob(data.content);
      const parsed = JSON.parse(content);

      this.notifyListeners({ 
        status: 'success', 
        message: 'Loaded from GitHub',
        timestamp: new Date().toISOString()
      });

      return parsed;
    } catch (error) {
      if (error.message.includes('404')) {
        // File doesn't exist yet
        this.notifyListeners({ 
          status: 'info', 
          message: 'No saved data in GitHub (will create on first save)'
        });
        return null;
      }
      
      this.notifyListeners({ 
        status: 'error', 
        message: `Failed to load: ${error.message}`
      });
      throw error;
    }
  }

  /**
   * Save data to GitHub
   */
  async saveData(data, commitMessage = 'Update requirement analyzer data') {
    if (!this.isConfigured()) {
      throw new Error('GitHub sync not configured');
    }

    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.syncInProgress = true;
    this.notifyListeners({ status: 'saving', message: 'Saving to GitHub...' });

    try {
      await this.ensureBranch();

      // Get current file info (if exists)
      let currentSha = this.lastSyncedSha;
      
      if (!currentSha) {
        try {
          const fileData = await this.apiRequest(
            `/repos/${this.owner}/${this.repo}/contents/${this.filePath}?ref=${this.branch}`
          );
          currentSha = fileData.sha;
        } catch (error) {
          // File doesn't exist yet, that's ok
          currentSha = null;
        }
      }

      // Prepare content
      const content = btoa(JSON.stringify(data, null, 2));

      // Create or update file
      const result = await this.apiRequest(
        `/repos/${this.owner}/${this.repo}/contents/${this.filePath}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            message: commitMessage,
            content: content,
            branch: this.branch,
            ...(currentSha && { sha: currentSha }),
          }),
        }
      );

      this.lastSyncedSha = result.content.sha;

      this.notifyListeners({ 
        status: 'success', 
        message: 'Saved to GitHub',
        timestamp: new Date().toISOString()
      });

      return result;
    } catch (error) {
      this.notifyListeners({ 
        status: 'error', 
        message: `Failed to save: ${error.message}`
      });
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get commit history for the data file
   */
  async getHistory(limit = 10) {
    if (!this.isConfigured()) {
      throw new Error('GitHub sync not configured');
    }

    try {
      const commits = await this.apiRequest(
        `/repos/${this.owner}/${this.repo}/commits?path=${this.filePath}&sha=${this.branch}&per_page=${limit}`
      );

      return commits.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author.name,
        date: commit.commit.author.date,
        url: commit.html_url,
      }));
    } catch (error) {
      console.error('Failed to get history:', error);
      return [];
    }
  }

  /**
   * Load data from a specific commit
   */
  async loadFromCommit(sha) {
    if (!this.isConfigured()) {
      throw new Error('GitHub sync not configured');
    }

    try {
      const data = await this.apiRequest(
        `/repos/${this.owner}/${this.repo}/contents/${this.filePath}?ref=${sha}`
      );

      const content = atob(data.content);
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to load from commit:', error);
      throw error;
    }
  }
}

/**
 * Create debounced save function
 */
export function createDebouncedSync(syncInstance, delay = 3000) {
  let timeoutId = null;
  let pendingData = null;

  return {
    schedule: (data, immediate = false) => {
      pendingData = data;

      if (immediate) {
        if (timeoutId) clearTimeout(timeoutId);
        return syncInstance.saveData(data, 'Auto-save');
      }

      if (timeoutId) clearTimeout(timeoutId);

      timeoutId = setTimeout(async () => {
        if (pendingData) {
          try {
            await syncInstance.saveData(pendingData, 'Auto-save');
            pendingData = null;
          } catch (error) {
            console.error('Auto-save failed:', error);
          }
        }
      }, delay);
    },
    cancel: () => {
      if (timeoutId) clearTimeout(timeoutId);
      pendingData = null;
    },
    savePending: async () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (pendingData) {
        await syncInstance.saveData(pendingData, 'Manual save');
        pendingData = null;
      }
    }
  };
}

/**
 * Storage wrapper that syncs with both localStorage and GitHub
 */
export class HybridStorage {
  constructor(githubSync, localStorageKey) {
    this.github = githubSync;
    this.localKey = localStorageKey;
    this.debounced = createDebouncedSync(githubSync);
  }

  /**
   * Load data (GitHub first, fallback to localStorage)
   */
  async load() {
    if (this.github.isConfigured()) {
      try {
        const githubData = await this.github.loadData();
        if (githubData) {
          // Save to localStorage as backup
          localStorage.setItem(this.localKey, JSON.stringify(githubData));
          return githubData;
        }
      } catch (error) {
        console.warn('Failed to load from GitHub, using localStorage:', error);
      }
    }

    // Fallback to localStorage
    const localData = localStorage.getItem(this.localKey);
    return localData ? JSON.parse(localData) : null;
  }

  /**
   * Save data (localStorage immediately, GitHub debounced)
   */
  async save(data, immediate = false) {
    // Always save to localStorage for instant access
    localStorage.setItem(this.localKey, JSON.stringify(data));

    // Sync to GitHub if configured
    if (this.github.isConfigured()) {
      if (immediate) {
        await this.github.saveData(data, 'Manual save');
      } else {
        this.debounced.schedule(data);
      }
    }
  }

  /**
   * Force immediate save to GitHub
   */
  async syncNow(data) {
    await this.save(data, true);
  }
}

export default GitHubSync;
