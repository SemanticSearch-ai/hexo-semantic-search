'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATE_FILE = '.semantic-search-state.json';

/**
 * State manager for tracking synced posts
 */
class StateManager {
  constructor(baseDir) {
    this.stateFile = path.join(baseDir, STATE_FILE);
    this.state = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.stateFile)) {
        const content = fs.readFileSync(this.stateFile, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      // Ignore parse errors, start fresh
    }
    return { posts: {}, version: 1 };
  }

  save() {
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
  }

  /**
   * Compute content hash for a post
   */
  static computeHash(post, fields) {
    const content = fields
      .map(field => {
        const value = post[field];
        if (Array.isArray(value)) {
          return value.map(v => v.name || v).join(',');
        }
        return value || '';
      })
      .join('|');

    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Get stored hash for a post
   */
  getPostHash(slug) {
    return this.state.posts[slug]?.hash;
  }

  /**
   * Update post state after successful sync
   */
  updatePost(slug, hash, docId) {
    this.state.posts[slug] = {
      hash,
      docId,
      syncedAt: new Date().toISOString()
    };
  }

  /**
   * Remove post from state
   */
  removePost(slug) {
    delete this.state.posts[slug];
  }

  /**
   * Get all tracked post slugs
   */
  getTrackedSlugs() {
    return Object.keys(this.state.posts);
  }

  /**
   * Get doc ID for a post
   */
  getDocId(slug) {
    return this.state.posts[slug]?.docId;
  }
}

module.exports = StateManager;
