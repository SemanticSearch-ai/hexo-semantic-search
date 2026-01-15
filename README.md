# hexo-semantic-search-ai [中文](README.zh-CN.md)

A Hexo plugin that integrates [SemanticSearch](https://github.com/SemanticSearch-ai/semanticsearch) for AI-powered semantic search and related posts.

## Demos

- Related Posts Demo: https://www.oldcai.com/hexo/hexo-semantic-search-ai/
- Search Demo: https://www.oldcai.com/search/?q=rust%20tutorial
- Template Example (hexo-theme-cactus): https://github.com/oldcai/hexo-theme-cactus

## Features

- **Automatic Indexing**: Syncs posts to SemanticSearch after `hexo generate`
- **Incremental Sync**: Only syncs changed posts (tracks content hash)
- **Related Posts**: Generates related posts at build time using semantic similarity
- **Search Component**: Provides helpers for frontend search UI
- **Customizable**: Full control over styling and rendering

## Installation

```bash
npm install hexo-semantic-search-ai --save
```

## Prerequisites

You need a SemanticSearch instance. Deploy one for free on Cloudflare Workers:

1. Go to [SemanticSearch](https://github.com/SemanticSearch-ai/semanticsearch)
2. Click "Deploy to Cloudflare"
3. Get your API endpoint and keys

## Configuration

Add to your Hexo `_config.yml`:

```yaml
semantic_search:
  enable: true
  endpoint: https://your-search.your-subdomain.workers.dev
  writer_key: ${SEMANTIC_SEARCH_WRITER_KEY}  # Use env var for security
  reader_key: your-reader-key                 # Public, safe to expose

  # Sync settings
  sync:
    auto: true                    # Auto-sync after hexo generate
    fields:                       # Fields to index
      - title
      - content
      - excerpt
      - tags
      - categories

  # Related posts settings
  related_posts:
    enable: true
    limit: 5                      # Max related posts per article
    min_score: 0.3                # Minimum similarity score (0-1)
    query_fields:                 # Fields used to find related posts
      - title
      - excerpt

  # Search UI settings
  search:
    placeholder: "Search..."
```

### Environment Variables

For security, use environment variables for your writer key:

```bash
export SEMANTIC_SEARCH_WRITER_KEY=your-writer-key
```

## Usage

### Search Box

Add a search box to your theme:

```ejs
<%- semantic_search_box() %>
```

With options:

```ejs
<%- semantic_search_box({
  placeholder: 'Search articles...',
  class: 'my-search-box',
  id: 'custom-search'
}) %>
```

Don't forget to include the JS file:

```ejs
<script src="<%- url_for('/js/semantic-search.js') %>"></script>
```

### Related Posts

Display related posts in your post template:

```ejs
<%- semantic_related_posts() %>
```

With options:

```ejs
<%- semantic_related_posts({
  limit: 3,
  title: 'You might also like',
  class: 'related-articles',
  excerpt: false
}) %>
```

### Custom Rendering

For full control, access the raw data:

```ejs
<% if (has_semantic_related()) { %>
  <div class="my-related-posts">
    <h3>Related</h3>
    <% get_semantic_related().forEach(function(post) { %>
      <article>
        <a href="<%= post.url %>"><%= post.title %></a>
        <p><%= post.excerpt %></p>
      </article>
    <% }); %>
  </div>
<% } %>
```

### Frontend JavaScript API

For advanced use cases, use the JavaScript API directly:

```html
<script src="/js/semantic-search.js"></script>
<script>
  // Configure (if not using helper)
  SemanticSearch.configure({
    endpoint: 'https://your-search.workers.dev',
    readerKey: 'your-reader-key'
  });

  // Search
  SemanticSearch.search('how to deploy').then(results => {
    console.log(results);
  });

  // Or bind to an input
  SemanticSearch.bindSearchBox('#search-input', '#search-results', {
    limit: 10,
    debounce: 300,
    minLength: 2
  });
</script>
```

## Commands

### Sync manually

```bash
# Incremental sync (only changed posts)
hexo semantic-search sync

# Force full sync
hexo semantic-search sync --force
# or
hexo semantic-search full-sync

# Check sync status
hexo semantic-search status
```

## State File

The plugin creates `.semantic-search-state.json` in your Hexo root to track synced posts. Add it to `.gitignore` if you don't want to commit it:

```
.semantic-search-state.json
```

## Helpers Reference

| Helper | Description |
|--------|-------------|
| `semantic_search_box(options)` | Render search input with results container |
| `semantic_search_config()` | Output config JSON for custom frontend |
| `semantic_related_posts(options)` | Render related posts list |
| `has_semantic_related()` | Check if current post has related posts |
| `get_semantic_related()` | Get raw related posts array |

## License

MIT

## Friendly Request

Friendly request (not required): If you use this plugin, please consider adding a link to https://semanticsearch.ai/ on your website.
