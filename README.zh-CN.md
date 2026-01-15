# hexo-semantic-search-ai [English](README.md)

一个 Hexo 插件，集成 [SemanticSearch](https://github.com/SemanticSearch-ai/semanticsearch)，为静态博客提供 AI 语义搜索与相关文章推荐。

## 功能特性

- **自动索引**：在 `hexo generate` 后同步文章到 SemanticSearch
- **增量同步**：仅同步变更文章（跟踪内容哈希）
- **相关文章**：构建时基于语义相似度生成相关文章
- **搜索组件**：提供前端搜索 UI 的 helper
- **可定制**：完全可控的样式与渲染

## 安装

```bash
npm install hexo-semantic-search-ai --save
```

## 前置条件

你需要一个 SemanticSearch 实例。可以在 Cloudflare Workers 上免费部署：

1. 访问 [SemanticSearch](https://github.com/SemanticSearch-ai/semanticsearch)
2. 点击 “Deploy to Cloudflare”
3. 获取 API Endpoint 和密钥

## 配置

在 Hexo `_config.yml` 中添加：

```yaml
semantic_search:
  enable: true
  endpoint: https://your-search.your-subdomain.workers.dev
  writer_key: ${SEMANTIC_SEARCH_WRITER_KEY}  # 为了安全使用环境变量
  reader_key: your-reader-key                 # 公钥，可公开

  # 同步设置
  sync:
    auto: true                    # 在 hexo generate 后自动同步
    fields:                       # 需要索引的字段
      - title
      - content
      - excerpt
      - tags
      - categories

  # 相关文章设置
  related_posts:
    enable: true
    limit: 5                      # 每篇文章最多相关条目
    min_score: 0.3                # 相似度阈值 (0-1)
    query_fields:                 # 用于检索相关文章的字段
      - title
      - excerpt

  # 搜索 UI 设置
  search:
    placeholder: "搜索..."
```

### 环境变量

为了安全，建议使用环境变量保存 writer key：

```bash
export SEMANTIC_SEARCH_WRITER_KEY=your-writer-key
```

## 使用

### 搜索框

在主题中添加搜索框：

```ejs
<%- semantic_search_box() %>
```

可选参数：

```ejs
<%- semantic_search_box({
  placeholder: '搜索文章...',
  class: 'my-search-box',
  id: 'custom-search'
}) %>
```

别忘了引入 JS 文件：

```ejs
<script src="<%- url_for('/js/semantic-search.js') %>"></script>
```

### 相关文章

在文章模板中显示相关文章：

```ejs
<%- semantic_related_posts() %>
```

可选参数：

```ejs
<%- semantic_related_posts({
  limit: 3,
  title: '你可能也喜欢',
  class: 'related-articles',
  excerpt: false
}) %>
```

### 自定义渲染

如需完全控制，可直接获取原始数据：

```ejs
<% if (has_semantic_related()) { %>
  <div class="my-related-posts">
    <h3>相关内容</h3>
    <% get_semantic_related().forEach(function(post) { %>
      <article>
        <a href="<%= post.url %>"><%= post.title %></a>
        <p><%= post.excerpt %></p>
      </article>
    <% }); %>
  </div>
<% } %>
```

### 前端 JavaScript API

高级用法可直接使用 JavaScript API：

```html
<script src="/js/semantic-search.js"></script>
<script>
  // 配置（如果不使用 helper）
  SemanticSearch.configure({
    endpoint: 'https://your-search.workers.dev',
    readerKey: 'your-reader-key'
  });

  // 搜索
  SemanticSearch.search('how to deploy').then(results => {
    console.log(results);
  });

  // 或绑定到输入框
  SemanticSearch.bindSearchBox('#search-input', '#search-results', {
    limit: 10,
    debounce: 300,
    minLength: 2
  });
</script>
```

## 命令

### 手动同步

```bash
# 增量同步（仅同步变更文章）
hexo semantic-search sync

# 强制全量同步
hexo semantic-search sync --force
# 或
hexo semantic-search full-sync

# 查看同步状态
hexo semantic-search status
```

## 状态文件

插件会在 Hexo 根目录创建 `.semantic-search-state.json` 用于追踪已同步的文章。如果不想提交，请加入 `.gitignore`：

```
.semantic-search-state.json
```

## Helper 参考

| Helper | 说明 |
|--------|------|
| `semantic_search_box(options)` | 渲染搜索输入框与结果容器 |
| `semantic_search_config()` | 输出自定义前端所需的配置 JSON |
| `semantic_related_posts(options)` | 渲染相关文章列表 |
| `has_semantic_related()` | 判断当前文章是否有相关文章 |
| `get_semantic_related()` | 获取原始相关文章数组 |

## 许可

MIT

## 友好请求

友好请求（非强制）：如果你在网站中使用了本插件，欢迎在你的网站上添加指向 https://semanticsearch.ai/ 的链接。
