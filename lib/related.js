'use strict';

/**
 * Related posts functionality
 */
class RelatedPostsManager {
  constructor(hexo, client, options = {}) {
    this.hexo = hexo;
    this.client = client;
    this.options = {
      limit: 5,
      minScore: 0.3,
      queryFields: ['title', 'excerpt'],
      ...options
    };
    this.log = hexo.log;
    this.cache = new Map();
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
   * Get related posts for a single post
   */
  async getRelatedPosts(post) {
    const postId = post.slug || post.path;

    // Check cache
    if (this.cache.has(postId)) {
      return this.cache.get(postId);
    }

    const query = this._buildQuery(post);
    if (!query) {
      return [];
    }

    try {
      const results = await this.client.search(query, {
        limit: this.options.limit + 1 // +1 to exclude self
      });

      // Filter out self and low-score results
      const related = (results.results || results || [])
        .filter(r => {
          const id = r.id || r.metadata?.id;
          const score = r.score ?? 1;
          return id !== postId && score >= this.options.minScore;
        })
        .slice(0, this.options.limit)
        .map(r => ({
          title: r.metadata?.title || r.title,
          url: r.metadata?.url || r.url,
          excerpt: r.metadata?.excerpt || r.excerpt,
          score: r.score
        }));

      this.cache.set(postId, related);
      return related;
    } catch (error) {
      this.log.warn(`[SemanticSearch] Failed to get related posts for "${post.title}": ${error.message}`);
      return [];
    }
  }

  /**
   * Inject related posts into all posts
   */
  async injectRelatedPosts() {
    const posts = this.hexo.locals.get('posts');
    if (!posts || posts.length === 0) {
      return;
    }

    this.log.info('[SemanticSearch] Fetching related posts...');

    let count = 0;
    for (const post of posts.toArray()) {
      const related = await this.getRelatedPosts(post);
      post.semantic_related = related;
      if (related.length > 0) {
        count++;
      }
    }

    this.log.info(`[SemanticSearch] Injected related posts for ${count} posts`);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = RelatedPostsManager;
