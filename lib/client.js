'use strict';

/**
 * SemanticSearch API Client
 */
class SemanticSearchClient {
  constructor(options) {
    this.endpoint = options.endpoint?.replace(/\/$/, '');
    this.writerKey = options.writerKey;
    this.readerKey = options.readerKey;
    this.timeout = options.timeout || 30000;
  }

  async _request(method, path, body, useWriterKey = true) {
    const url = `${this.endpoint}${path}`;
    const key = useWriterKey ? this.writerKey : this.readerKey;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SemanticSearch API error: ${response.status} - ${error}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`SemanticSearch API timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Create or update a document
   * SemanticSearch API format: POST /v1/documents with { id, text, metadata }
   */
  async upsertDocument(id, document) {
    // Transform to SemanticSearch format
    const payload = {
      id,
      text: document.content || document.text || '',
      metadata: {
        title: document.title,
        url: document.url,
        date: document.date,
        updated: document.updated,
        excerpt: document.excerpt,
        tags: document.tags,
        categories: document.categories
      }
    };
    return this._request('POST', '/v1/documents', payload);
  }

  /**
   * Delete a document
   */
  async deleteDocument(id) {
    return this._request('DELETE', `/v1/documents/${encodeURIComponent(id)}`);
  }

  /**
   * Get a document by ID
   */
  async getDocument(id) {
    return this._request('GET', `/v1/documents/${encodeURIComponent(id)}`, null, false);
  }

  /**
   * Search documents
   */
  async search(query, options = {}) {
    return this._request('POST', '/v1/search', {
      query,
      limit: options.limit || 10,
      ...options
    }, false);
  }

  /**
   * Batch upsert documents
   */
  async batchUpsert(documents) {
    // If the API supports batch, use it; otherwise do sequentially
    const results = [];
    for (const doc of documents) {
      try {
        const result = await this.upsertDocument(doc.id, doc.data);
        results.push({ id: doc.id, success: true, result });
      } catch (error) {
        results.push({ id: doc.id, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * Batch delete documents
   */
  async batchDelete(ids) {
    const results = [];
    for (const id of ids) {
      try {
        await this.deleteDocument(id);
        results.push({ id, success: true });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }
    return results;
  }
}

module.exports = SemanticSearchClient;
