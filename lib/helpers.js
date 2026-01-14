'use strict';

/**
 * Register Hexo helpers for semantic search
 */
function registerHelpers(hexo, config) {
  const readerKey = config.reader_key || config.readerKey;
  const endpoint = config.endpoint?.replace(/\/$/, '');

  /**
   * Output search config as JSON for frontend
   */
  hexo.extend.helper.register('semantic_search_config', function() {
    return JSON.stringify({
      endpoint,
      readerKey,
      placeholder: config.search?.placeholder || 'Search...'
    });
  });

  /**
   * Render search box HTML
   */
  hexo.extend.helper.register('semantic_search_box', function(options = {}) {
    const id = options.id || 'semantic-search';
    const placeholder = options.placeholder || config.search?.placeholder || 'Search...';
    const className = options.class || 'semantic-search-box';
    const resultClass = options.resultClass || 'semantic-search-results';

    return `
<div class="${className}" id="${id}">
  <input type="text" class="semantic-search-input" placeholder="${placeholder}" />
  <div class="${resultClass}"></div>
</div>
<script>
  window.SEMANTIC_SEARCH_CONFIG = ${JSON.stringify({ endpoint, readerKey })};
</script>
    `.trim();
  });

  /**
   * Render related posts for current post
   */
  hexo.extend.helper.register('semantic_related_posts', function(options = {}) {
    const post = this.post || this.page;
    if (!post || !post.semantic_related || post.semantic_related.length === 0) {
      return '';
    }

    const limit = options.limit || post.semantic_related.length;
    const className = options.class || 'semantic-related-posts';
    const title = options.title !== undefined ? options.title : 'Related Posts';
    const showExcerpt = options.excerpt !== false;

    const items = post.semantic_related.slice(0, limit);

    let html = `<div class="${className}">`;

    if (title) {
      html += `<h3 class="semantic-related-title">${title}</h3>`;
    }

    html += '<ul class="semantic-related-list">';
    for (const item of items) {
      html += `<li class="semantic-related-item">`;
      html += `<a href="${item.url}" class="semantic-related-link">${item.title}</a>`;
      if (showExcerpt && item.excerpt) {
        const excerpt = item.excerpt.substring(0, 100) + (item.excerpt.length > 100 ? '...' : '');
        html += `<p class="semantic-related-excerpt">${excerpt}</p>`;
      }
      html += `</li>`;
    }
    html += '</ul></div>';

    return html;
  });

  /**
   * Check if related posts exist for current post
   */
  hexo.extend.helper.register('has_semantic_related', function() {
    const post = this.post || this.page;
    return post?.semantic_related?.length > 0;
  });

  /**
   * Get raw related posts data
   */
  hexo.extend.helper.register('get_semantic_related', function() {
    const post = this.post || this.page;
    return post?.semantic_related || [];
  });
}

module.exports = { registerHelpers };
