/**
 * SemanticSearch Frontend Client
 * Lightweight browser-side search client
 */
(function(window) {
  'use strict';

  var config = window.SEMANTIC_SEARCH_CONFIG || {};

  var SemanticSearch = {
    endpoint: config.endpoint,
    readerKey: config.readerKey,

    /**
     * Configure the client
     */
    configure: function(options) {
      this.endpoint = options.endpoint || this.endpoint;
      this.readerKey = options.readerKey || this.readerKey;
    },

    /**
     * Search documents
     */
    search: function(query, options) {
      var self = this;
      options = options || {};

      return new Promise(function(resolve, reject) {
        if (!self.endpoint) {
          reject(new Error('SemanticSearch endpoint not configured'));
          return;
        }

        var xhr = new XMLHttpRequest();
        xhr.open('POST', self.endpoint + '/v1/search', true);
        xhr.setRequestHeader('Content-Type', 'application/json');

        if (self.readerKey) {
          xhr.setRequestHeader('Authorization', 'Bearer ' + self.readerKey);
        }

        xhr.onreadystatechange = function() {
          if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                var response = JSON.parse(xhr.responseText);
                resolve(response.results || response || []);
              } catch (e) {
                reject(new Error('Failed to parse response'));
              }
            } else {
              reject(new Error('Search failed: ' + xhr.status));
            }
          }
        };

        xhr.onerror = function() {
          reject(new Error('Network error'));
        };

        xhr.send(JSON.stringify({
          query: query,
          limit: options.limit || 10
        }));
      });
    },

    /**
     * Bind search box with auto-complete
     */
    bindSearchBox: function(inputSelector, resultSelector, options) {
      var self = this;
      options = options || {};

      var input = typeof inputSelector === 'string'
        ? document.querySelector(inputSelector)
        : inputSelector;
      var resultContainer = typeof resultSelector === 'string'
        ? document.querySelector(resultSelector)
        : resultSelector;

      if (!input || !resultContainer) {
        console.warn('SemanticSearch: Input or result container not found');
        return;
      }

      var debounceTimer;
      var minLength = options.minLength || 2;
      var debounceMs = options.debounce || 300;

      input.addEventListener('input', function() {
        var query = input.value.trim();

        clearTimeout(debounceTimer);

        if (query.length < minLength) {
          resultContainer.innerHTML = '';
          resultContainer.style.display = 'none';
          return;
        }

        debounceTimer = setTimeout(function() {
          self.search(query, { limit: options.limit || 10 })
            .then(function(results) {
              self._renderResults(resultContainer, results, options);
            })
            .catch(function(error) {
              console.error('SemanticSearch error:', error);
              resultContainer.innerHTML = '<div class="semantic-search-error">Search failed</div>';
              resultContainer.style.display = 'block';
            });
        }, debounceMs);
      });

      // Hide results on click outside
      document.addEventListener('click', function(e) {
        if (!input.contains(e.target) && !resultContainer.contains(e.target)) {
          resultContainer.style.display = 'none';
        }
      });
    },

    /**
     * Render search results
     */
    _renderResults: function(container, results, options) {
      if (!results || results.length === 0) {
        container.innerHTML = '<div class="semantic-search-no-results">' +
          (options.noResultsText || 'No results found') + '</div>';
        container.style.display = 'block';
        return;
      }

      var html = '<ul class="semantic-search-result-list">';
      for (var i = 0; i < results.length; i++) {
        var item = results[i];
        // API returns: { document: { id, text, metadata }, score }
        var meta = (item.document && item.document.metadata) || item.metadata || {};
        var title = meta.title || (item.document && item.document.id) || item.title || 'Untitled';
        var url = meta.url || item.url || '#';
        var excerpt = meta.excerpt || item.excerpt || '';

        html += '<li class="semantic-search-result-item">';
        html += '<a href="' + url + '" class="semantic-search-result-link">' + title + '</a>';
        if (excerpt && options.showExcerpt !== false) {
          var shortExcerpt = excerpt.substring(0, 100) + (excerpt.length > 100 ? '...' : '');
          html += '<p class="semantic-search-result-excerpt">' + shortExcerpt + '</p>';
        }
        html += '</li>';
      }
      html += '</ul>';

      container.innerHTML = html;
      container.style.display = 'block';
    }
  };

  // Auto-init if config exists
  if (config.endpoint) {
    document.addEventListener('DOMContentLoaded', function() {
      var searchBox = document.querySelector('.semantic-search-box');
      if (searchBox) {
        var input = searchBox.querySelector('.semantic-search-input');
        var results = searchBox.querySelector('.semantic-search-results');
        if (input && results) {
          SemanticSearch.bindSearchBox(input, results);
        }
      }
    });
  }

  window.SemanticSearch = SemanticSearch;

})(window);
