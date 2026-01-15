'use strict';

const fs = require('fs');
const path = require('path');
const StateManager = require('./state');

/**
 * Related posts functionality with persistent caching
 */
class RelatedPostsManager {
  constructor(hexo, client, options = {}) {
    this.hexo = hexo;
    this.client = client;
    this.options = {
      limit: 5,
      minScore: 0.3,
      queryFields: ['title', 'excerpt'],
      concurrency: 3,  // Max concurrent requests
      delay: 200,      // Delay between batches in ms
      ...options
    };
    this.log = hexo.log;
    this.cache = new Map();

    // Persistent cache for related posts
    this.cacheFile = path.join(hexo.base_dir, '.semantic-search-related.json');
    this.persistentCache = this._loadCache();
  }

  /**
   * Load persistent cache from disk
   */
  _loadCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = fs.readFileSync(this.cacheFile, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      this.log.debug(`[SemanticSearch] Could not load related cache: ${error.message}`);
    }
    return { posts: {} };
  }

  /**
   * Save persistent cache to disk
   */
  _saveCache() {
    try {
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.persistentCache, null, 2));
    } catch (error) {
      this.log.warn(`[SemanticSearch] Could not save related cache: ${error.message}`);
    }
  }

  /**
   * Sleep helper
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Build search query from post
   */
  _buildQuery(post) {
    const parts = [];

    if (this.options.queryFields.includes('title') && post.title) {
      parts.push(post.title);
    }
    if (this.options.queryFields.includes('excerpt') && post.excerpt) {
      // Strip HTML from excerpt
      const text = post.excerpt.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      // Take first 200 chars to avoid too long query
      parts.push(text.substring(0, 200));
    }
    if (this.options.queryFields.includes('tags') && post.tags) {
      parts.push(post.tags.map(t => t.name).join(' '));
    }

    return parts.join(' ').trim();
  }

  /**
   * Get related posts for a single post (with retry)
   */
  async getRelatedPosts(post, retries = 2) {
    const postId = post.slug || post.path;

    // Check memory cache
    if (this.cache.has(postId)) {
      return this.cache.get(postId);
    }

    const query = this._buildQuery(post);
    if (!query) {
      return [];
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const results = await this.client.search(query, {
          limit: this.options.limit + 1 // +1 to exclude self
        });

        // Filter out self and low-score results
        // API returns: { results: [{ document: { id, text, metadata }, score }] }
        const related = (results.results || results || [])
          .filter(r => {
            const id = r.document?.id || r.id;
            const score = r.score ?? 1;
            return id !== postId && score >= this.options.minScore;
          })
          .slice(0, this.options.limit)
          .map(r => {
            const meta = r.document?.metadata || r.metadata || {};
            return {
              title: meta.title || r.document?.id,
              url: meta.url,
              excerpt: meta.excerpt,
              score: r.score
            };
          });

        this.cache.set(postId, related);
        return related;
      } catch (error) {
        if (attempt < retries && (error.message.includes('9003') || error.message.includes('timeout'))) {
          // Retry on Cloudflare AI errors
          await this._sleep(1000 * (attempt + 1)); // Exponential backoff
          continue;
        }
        this.log.warn(`[SemanticSearch] Failed to get related posts for "${post.title}": ${error.message}`);
        return [];
      }
    }
    return [];
  }

  /**
   * Inject related posts into all posts (batch with rate limiting and caching)
   */
  async injectRelatedPosts() {
    const posts = this.hexo.locals.get('posts');
    if (!posts || posts.length === 0) {
      return;
    }

    const postArray = posts.toArray();
    const toFetch = [];
    const fromCache = [];

    // Check which posts need fresh fetch vs cached
    for (const post of postArray) {
      const postId = post.slug || post.path;
      const hash = StateManager.computeHash(post, this.options.queryFields);
      const cached = this.persistentCache.posts[postId];

      if (cached && cached.hash === hash && cached.related) {
        // Use cached result
        post.semantic_related = cached.related;
        this.cache.set(postId, cached.related);
        fromCache.push(postId);
      } else {
        // Need to fetch
        toFetch.push({ post, postId, hash });
      }
    }

    this.log.info(`[SemanticSearch] Related posts: ${fromCache.length} cached, ${toFetch.length} to fetch`);

    if (toFetch.length === 0) {
      return;
    }

    let count = 0;
    let processed = 0;
    const concurrency = this.options.concurrency;
    const delay = this.options.delay;

    // Process in batches
    for (let i = 0; i < toFetch.length; i += concurrency) {
      const batch = toFetch.slice(i, i + concurrency);

      // Process batch concurrently
      const results = await Promise.all(
        batch.map(async ({ post, postId, hash }) => {
          const related = await this.getRelatedPosts(post);
          post.semantic_related = related;

          // Update persistent cache
          this.persistentCache.posts[postId] = {
            hash,
            related,
            fetchedAt: new Date().toISOString()
          };

          return related.length > 0 ? 1 : 0;
        })
      );

      count += results.reduce((a, b) => a + b, 0);
      processed += batch.length;

      // Log progress every 20 posts
      if (processed % 20 === 0 || processed === toFetch.length) {
        this.log.debug(`[SemanticSearch] Progress: ${processed}/${toFetch.length}`);
      }

      // Add delay between batches to avoid rate limiting
      if (i + concurrency < toFetch.length) {
        await this._sleep(delay);
      }
    }

    // Save cache
    this._saveCache();

    this.log.info(`[SemanticSearch] Fetched related posts for ${count}/${toFetch.length} posts`);
  }

  /**
   * Get related posts with persistent cache check
   */
  async getRelatedPostsWithCache(post, retries = 2) {
    const postId = post.slug || post.path;
    const StateManager = require('./state');
    const hash = StateManager.computeHash(post, this.options.queryFields);

    // Check persistent cache
    const cached = this.persistentCache.posts[postId];
    if (cached && cached.hash === hash && cached.related) {
      this.cache.set(postId, cached.related);
      return cached.related;
    }

    // Fetch fresh
    const related = await this.getRelatedPosts(post, retries);

    // Update persistent cache
    this.persistentCache.posts[postId] = {
      hash,
      related,
      fetchedAt: new Date().toISOString()
    };

    return related;
  }

  /**
   * Save persistent cache to disk
   */
  saveCache() {
    this._saveCache();
    const count = Object.keys(this.persistentCache.posts).length;
    this.log.debug(`[SemanticSearch] Saved related posts cache for ${count} posts`);
  }

  /**
   * Clear memory cache (not persistent cache)
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Clear all caches including persistent
   */
  clearAllCaches() {
    this.cache.clear();
    this.persistentCache = { posts: {} };
    try {
      if (fs.existsSync(this.cacheFile)) {
        fs.unlinkSync(this.cacheFile);
      }
    } catch (error) {
      // Ignore
    }
  }
}

module.exports = RelatedPostsManager;
