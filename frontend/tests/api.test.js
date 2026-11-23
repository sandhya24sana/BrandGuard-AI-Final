import assert from 'node:assert/strict';
import test from 'node:test';
import { api } from '../src/api.js';

test('API helper reports network failures as explicit failed responses', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => {
    throw new Error('offline');
  };

  const response = await api.getHealth();
  assert.equal(response.success, false);
  assert.equal(response.error, 'offline');
});

test('API helper reports non-JSON upstream failures without parsing HTML as JSON', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => new Response('<html>proxy unavailable</html>', {
    status: 502,
    statusText: 'Bad Gateway',
    headers: { 'content-type': 'text/html' },
  });

  const response = await api.getHealth();
  assert.equal(response.success, false);
  assert.match(response.error, /HTTP 502/);
  assert.match(response.error, /proxy unavailable/);
});

test('API helper preserves stale-version metadata from correction conflicts', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: false,
    error: 'The selected correction belongs to an older content version.',
    current_version: 6,
  }), {
    status: 409,
    headers: { 'content-type': 'application/json' },
  });

  const result = await api.applyCorrections(55, {
    brand_id: 7,
    issue_ids: ['issue-1'],
    content_version: 5,
  });

  assert.equal(result.status, 409);
  assert.equal(result.current_version, 6);
});

test('fact update uses the ID-scoped brand route and PUT method', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({
      success: true,
      fact_id: 12,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const payload = {
    category: 'Product Specs',
    statement: 'Updated existing fact.',
    key_metric: '20%',
    keywords: 'updated',
  };
  const result = await api.updateFact(12, 28, payload);

  assert.ok(request.url.endsWith('/api/brands/facts/12?brand_id=28'));
  assert.equal(request.options.method, 'PUT');
  assert.equal(request.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(request.options.body), payload);
  assert.equal(result.fact_id, 12);
});

test('rewrite API posts the brand, text, content type, and channel', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({
      success: true,
      rewritten_text: 'Rewritten preview',
      engine_used: 'AI_GEMINI',
      saved: false,
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const payload = {
    brand_id: 7,
    text: 'Original copy',
    content_type: 'Ad Copy',
    channel: 'Website',
  };
  const result = await api.rewriteContent(payload);

  assert.equal(request.url.endsWith('/api/analysis/rewrite'), true);
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(request.options.body), payload);
  assert.equal(result.rewritten_text, 'Rewritten preview');
  assert.equal(result.engine_used, 'AI_GEMINI');
  assert.equal(result.saved, false);
});

test('visual review API sends the image and brand without exposing configuration', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({
      success: true,
      saved: false,
      visual_validation: {
        supported: true,
        checks: [],
        not_evaluated: [],
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const image = new Blob(['mock image'], { type: 'image/png' });
  const result = await api.analyzeVisualFile(image, 23);

  assert.equal(request.url.endsWith('/api/analysis/visual-check'), true);
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers, undefined);
  assert.equal(request.options.body.get('brand_id'), '23');
  assert.equal(request.options.body.get('file').type, 'image/png');
  assert.equal(result.saved, false);
  assert.equal(result.visual_validation.supported, true);
});

test('version restore API posts scoped IDs and the expected current version', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({
      success: true,
      content_id: 44,
      brand_id: 7,
      restored_from_version_id: 31,
      version_id: 33,
      version: 3,
      status: 'draft',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await api.restoreContentVersion(44, 7, 31, 2);

  assert.ok(request.url.endsWith('/api/content/44/restore'));
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(request.options.body), {
    brand_id: 7,
    version_id: 31,
    expected_current_version: 2,
  });
  assert.equal(result.version, 3);
});

test('version restore API rejects invalid IDs without making a request', async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  try {
    const result = await api.restoreContentVersion(44, 7, '31', 2);
    assert.equal(result.success, false);
    assert.match(result.error, /valid content, brand, version/i);
    assert.equal(requestCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('content deletion requires a valid brand scope', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const missingBrand = await api.deleteContent(44, null);
  const invalidBrand = await api.deleteContent(44, 0);

  assert.equal(missingBrand.success, false);
  assert.match(missingBrand.error, /valid brand ID/i);
  assert.equal(invalidBrand.success, false);
  assert.equal(requestCount, 0);
});

test('content deletion sends a brand-scoped DELETE request', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify({
      success: true,
      content_id: 44,
      message: 'Content and associated history deleted.',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  const result = await api.deleteContent(44, 7);

  assert.ok(request.url.endsWith('/api/content/44?brand_id=7'));
  assert.equal(request.options.method, 'DELETE');
  assert.equal(result.success, true);
  assert.equal(result.content_id, 44);
});

test('PDF report API requests a brand-scoped PDF and returns its binary blob', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  let requestUrl;
  globalThis.fetch = async (url) => {
    requestUrl = String(url);
    return new Response(new Blob(['%PDF-1.4 test bytes'], {
      type: 'application/pdf',
    }), {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    });
  };

  const result = await api.downloadAuditReportPdf(55, 7);

  assert.ok(requestUrl.endsWith('/api/history/export/55/pdf?brand_id=7'));
  assert.equal(result.success, true);
  assert.equal(result.blob.type, 'application/pdf');
  assert.ok(result.blob.size > 0);
});

test('PDF report API surfaces server errors and rejects invalid identifiers', async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => {
    globalThis.fetch = originalFetch;
  });
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return new Response(JSON.stringify({
      success: false,
      error: 'No audit result is available.',
    }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  };

  const missingAudit = await api.downloadAuditReportPdf(55, 7);
  const invalidBrand = await api.downloadAuditReportPdf(55, 0);

  assert.equal(missingAudit.success, false);
  assert.equal(missingAudit.error, 'No audit result is available.');
  assert.equal(invalidBrand.success, false);
  assert.equal(requestCount, 1);
});
