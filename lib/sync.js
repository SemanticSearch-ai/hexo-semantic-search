'use strict';

const StateManager = require('./state');

/**
 * Sync posts to SemanticSearch
 */
class SyncManager {
  constructor(hexo, client, options = {}) {
    this.hexo = hexo;
    this.client = client;
    this.options = {
      fields: ['title', 'content', 'excerpt', 'tags', 'categories'],
      ...options
    };
    this.state = new StateManager(hexo.base_dir);
    this.log = hexo.log;
  }

  /**
   * Build document data from a post
   */
  _buildDocument(post) {
    const doc = {
      title: post.title,
      url: post.permalink,
      date: post.date?.toISOString(),
      updated: post.updated?.toISOString()
    };

    // Add configured fields
    if (this.options.fields.includes('content')) {
      // Strip HTML for indexing
      doc.content = post.content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    if (this.options.fields.includes('excerpt')) {
      doc.excerpt = post.excerpt?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    if (this.options.fields.includes('tags') && post.tags) {
      doc.tags = post.tags.map(t => t.name).filter(Boolean);
    }
    if (this.options.fields.includes('categories') && post.categories) {
      doc.categories = post.categories.map(c => c.name).filter(Boolean);
    }

    return doc;
  }

  /**
   * Get post identifier (slug or path)
   */
  _getPostId(post) {
    return post.slug || post.path;
  }

  /**
   * Sync all posts (incremental)
   */
  async sync() {
    const posts = this.hexo.locals.get('posts');
    if (!posts || posts.length === 0) {
      this.log.info('[SemanticSearch] No posts to sync');
      return { added: 0, updated: 0, deleted: 0, unchanged: 0 };
    }

    const currentSlugs = new Set();
    const toUpsert = [];
    let unchanged = 0;

    // Check each post
    posts.forEach(post => {
      const id = this._getPostId(post);
      currentSlugs.add(id);

      const hash = StateManager.computeHash(post, this.options.fields);
      const storedHash = this.state.getPostHash(id);

      if (hash !== storedHash) {
        toUpsert.push({
          id,
          hash,
          post,
          data: this._buildDocument(post)
        });
      } else {
        unchanged++;
      }
    });

    // Find deleted posts
    const trackedSlugs = this.state.getTrackedSlugs();
    const toDelete = trackedSlugs.filter(slug => !currentSlugs.has(slug));

    // Execute upserts
    let added = 0;
    let updated = 0;
    for (const item of toUpsert) {
      try {
        const isNew = !this.state.getPostHash(item.id);
        const result = await this.client.upsertDocument(item.id, item.data);
        this.state.updatePost(item.id, item.hash, result?.id || item.id);

        if (isNew) {
          added++;
          this.log.debug(`[SemanticSearch] Added: ${item.post.title}`);
        } else {
          updated++;
          this.log.debug(`[SemanticSearch] Updated: ${item.post.title}`);
        }
      } catch (error) {
        this.log.error(`[SemanticSearch] Failed to sync "${item.post.title}": ${error.message}`);
      }
    }

    // Execute deletes
    let deleted = 0;
    for (const slug of toDelete) {
      try {
        await this.client.deleteDocument(slug);
        this.state.removePost(slug);
        deleted++;
        this.log.debug(`[SemanticSearch] Deleted: ${slug}`);
      } catch (error) {
        this.log.warn(`[SemanticSearch] Failed to delete "${slug}": ${error.message}`);
      }
    }

    // Save state
    this.state.save();

    const stats = { added, updated, deleted, unchanged };
    this.log.info(
      `[SemanticSearch] Sync complete: ${added} added, ${updated} updated, ${deleted} deleted, ${unchanged} unchanged`
    );

    return stats;
  }

  /**
   * Force full re-sync (ignore state)
   */
  async fullSync() {
    // Clear state
    this.state.state.posts = {};

    // Then do normal sync
    return this.sync();
  }
}

module.exports = SyncManager;
