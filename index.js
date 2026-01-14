/* global hexo */
'use strict';

const path = require('path');
const fs = require('fs');
const SemanticSearchClient = require('./lib/client');
const SyncManager = require('./lib/sync');
const RelatedPostsManager = require('./lib/related');
const { registerHelpers } = require('./lib/helpers');

/**
 * hexo-semantic-search
 *
 * A Hexo plugin that integrates SemanticSearch for:
 * - Automatic post indexing with incremental sync
 * - Related posts generation at build time
 * - Frontend search component
 */

const PLUGIN_NAME = 'semantic_search';

// Get config
const config = hexo.config[PLUGIN_NAME] || {};

// Skip if not enabled
if (config.enable === false) {
  hexo.log.debug('[SemanticSearch] Plugin disabled by config');
} else {
  // Validate required config
  const endpoint = config.endpoint;
  const writerKey = resolveEnvVar(config.writer_key || config.writerKey);
  const readerKey = resolveEnvVar(config.reader_key || config.readerKey);

  if (!endpoint) {
    hexo.log.warn('[SemanticSearch] No endpoint configured, plugin disabled');
  } else {
    hexo.log.debug('[SemanticSearch] Plugin initializing...');

    // Create client
    const client = new SemanticSearchClient({
      endpoint,
      writerKey,
      readerKey,
      timeout: config.timeout || 30000
    });

    // Create managers
    const syncManager = new SyncManager(hexo, client, {
      fields: config.sync?.fields || ['title', 'content', 'excerpt', 'tags', 'categories']
    });

    const relatedConfig = config.related_posts || config.relatedPosts || {};
    const relatedManager = new RelatedPostsManager(hexo, client, {
      limit: relatedConfig.limit || 5,
      minScore: relatedConfig.min_score || relatedConfig.minScore || 0.3,
      queryFields: relatedConfig.query_fields || relatedConfig.queryFields || ['title', 'excerpt']
    });

    // Register helpers
    registerHelpers(hexo, config);

    // Copy assets to public folder
    hexo.extend.generator.register('semantic_search_assets', function() {
      const assetPath = path.join(__dirname, 'assets', 'semantic-search.js');
      const content = fs.readFileSync(assetPath, 'utf-8');

      return {
        path: 'js/semantic-search.js',
        data: content
      };
    });

    // Hook: After generate - sync posts
    const autoSync = config.sync?.auto !== false;
    if (autoSync && writerKey) {
      hexo.extend.filter.register('after_generate', async function() {
        try {
          await syncManager.sync();
        } catch (error) {
          hexo.log.error(`[SemanticSearch] Sync failed: ${error.message}`);
        }
      });
    }

    // Hook: Before post render - inject related posts
    const relatedEnabled = relatedConfig.enable !== false;
    if (relatedEnabled && readerKey) {
      hexo.extend.filter.register('before_generate', async function() {
        // Clear cache for fresh related posts
        relatedManager.clearCache();
      });

      // Inject related posts after posts are processed
      hexo.extend.filter.register('after_post_render', async function(data) {
        if (data.layout === 'post' || data.layout === 'page') {
          try {
            const related = await relatedManager.getRelatedPosts(data);
            data.semantic_related = related;
          } catch (error) {
            hexo.log.debug(`[SemanticSearch] Related posts error: ${error.message}`);
          }
        }
        return data;
      });
    }

    // Command: hexo semantic-search sync
    hexo.extend.console.register('semantic-search', 'SemanticSearch commands', {
      usage: '<command>',
      desc: 'SemanticSearch plugin commands',
      arguments: [
        { name: 'command', desc: 'sync | full-sync | status' }
      ],
      options: [
        { name: '--force', desc: 'Force full sync (ignore state)' }
      ]
    }, async function(args) {
      const command = args._[0] || 'sync';

      // Load source files first
      await hexo.load();

      switch (command) {
        case 'sync':
          if (args.force) {
            hexo.log.info('[SemanticSearch] Running full sync (--force)...');
            await syncManager.fullSync();
          } else {
            hexo.log.info('[SemanticSearch] Running incremental sync...');
            await syncManager.sync();
          }
          break;

        case 'full-sync':
          hexo.log.info('[SemanticSearch] Running full sync...');
          await syncManager.fullSync();
          break;

        case 'status':
          const state = syncManager.state;
          const tracked = state.getTrackedSlugs();
          hexo.log.info(`[SemanticSearch] Tracked posts: ${tracked.length}`);
          tracked.forEach(slug => {
            const data = state.state.posts[slug];
            hexo.log.info(`  - ${slug} (synced: ${data.syncedAt})`);
          });
          break;

        default:
          hexo.log.error(`[SemanticSearch] Unknown command: ${command}`);
          hexo.log.info('Available commands: sync, full-sync, status');
      }
    });

    hexo.log.debug('[SemanticSearch] Plugin initialized');
  }
}

/**
 * Resolve environment variable reference
 * Supports: ${VAR_NAME} or $VAR_NAME
 */
function resolveEnvVar(value) {
  if (!value || typeof value !== 'string') {
    return value;
  }

  // Match ${VAR_NAME} or $VAR_NAME
  const envMatch = value.match(/^\$\{?([A-Z_][A-Z0-9_]*)\}?$/);
  if (envMatch) {
    return process.env[envMatch[1]] || value;
  }

  return value;
}
