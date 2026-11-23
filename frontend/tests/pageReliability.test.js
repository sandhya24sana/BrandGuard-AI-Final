import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { createServer } from 'vite';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function deferredFetch() {
  const requests = [];
  globalThis.fetch = (url) => new Promise((resolve) => {
    requests.push({ url: String(url), resolve });
  });
  return requests;
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function createComponentHarness(context, componentPath) {
  const names = [
    'window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event',
    'MouseEvent', 'MutationObserver', 'IS_REACT_ACT_ENVIRONMENT', 'fetch',
  ];
  const originalDescriptors = new Map(
    names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
  );
  const window = new Window({ url: 'http://localhost/' });
  for (const [name, value] of Object.entries({
    window,
    document: window.document,
    navigator: window.navigator,
    HTMLElement: window.HTMLElement,
    Node: window.Node,
    Event: window.Event,
    MouseEvent: window.MouseEvent,
    MutationObserver: window.MutationObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }

  const React = await import('react');
  const { act } = React;
  const { createRoot } = await import('react-dom/client');
  const vite = await createServer({
    configFile: fileURLToPath(new URL('../vite.config.js', import.meta.url)),
    root: projectRoot,
    logLevel: 'silent',
    server: { middlewareMode: true },
  });
  const { default: Component } = await vite.ssrLoadModule(componentPath);
  const container = window.document.createElement('div');
  window.document.body.appendChild(container);
  const root = createRoot(container);

  context.after(async () => {
    await act(async () => root.unmount());
    await vite.close();
    window.happyDOM.abort();
    for (const [name, descriptor] of originalDescriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });

  return { React, act, Component, container, root, window };
}

function brandDetails(id, name) {
  return {
    success: true,
    brand: {
      id,
      name,
      tagline: `${name} tagline`,
      primary_tone: 'Clear',
      voice_traits: [],
    },
    facts: [],
    terminology: [],
    visual_rules: {
      primary_colors: [],
      secondary_colors: [],
      forbidden_colors: [],
    },
    claim_rules: [],
  };
}

function contentItem(id, title) {
  return {
    id,
    title,
    content_type: 'Ad Copy',
    channel: 'Digital',
    risk_score: 80,
    status: 'pending_review',
    current_version: 1,
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function setControlValue(window, control, value) {
  const prototype = control instanceof window.HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : control instanceof window.HTMLSelectElement
    ? window.HTMLSelectElement.prototype
    : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(control, value);
  control.dispatchEvent(new window.Event(
    control instanceof window.HTMLSelectElement ? 'change' : 'input',
    { bubbles: true },
  ));
}

test('GuidelinesManager ignores late responses from a previously selected brand', async (context) => {
  const { React, act, Component, container, root } = await createComponentHarness(
    context,
    '/src/pages/GuidelinesManager.jsx',
  );
  const requests = deferredFetch();

  await act(async () => {
    root.render(React.createElement(Component, { brandId: 1 }));
    await flush();
  });
  await act(async () => {
    root.render(React.createElement(Component, { brandId: 2 }));
    await flush();
  });
  assert.equal(requests.length, 2);

  await act(async () => {
    requests[1].resolve(response(brandDetails(2, 'Brand Two')));
    await flush();
  });
  assert.match(container.textContent, /Brand Two Guidelines/);

  await act(async () => {
    requests[0].resolve(response(brandDetails(1, 'Brand One')));
    await flush();
  });
  assert.match(container.textContent, /Brand Two Guidelines/);
  assert.doesNotMatch(container.textContent, /Brand One/);
});

test('GuidelinesManager exposes load failures and allows retry', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/pages/GuidelinesManager.jsx',
  );
  const requests = deferredFetch();

  await act(async () => {
    root.render(React.createElement(Component, { brandId: 1 }));
    await flush();
  });
  await act(async () => {
    requests[0].resolve(response({ success: false, error: 'Guidelines unavailable' }, 503));
    await flush();
  });
  assert.match(container.textContent, /Guidelines unavailable/);

  await act(async () => {
    container.querySelector('button').dispatchEvent(
      new window.MouseEvent('click', { bubbles: true }),
    );
    await flush();
  });
  await act(async () => {
    requests[1].resolve(response(brandDetails(1, 'Recovered Brand')));
    await flush();
  });
  assert.match(container.textContent, /Recovered Brand Guidelines/);
});

test('GuidelinesManager opens brand editing and verifies the saved profile by re-fetching it', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/pages/GuidelinesManager.jsx',
  );
  const requests = [];
  let fetchCount = 0;
  globalThis.fetch = async (url, options = {}) => {
    const requestUrl = String(url);
    requests.push({ url: requestUrl, method: options.method || 'GET' });
    if (options.method === 'PUT') {
      return response({ success: true });
    }
    fetchCount += 1;
    return response(brandDetails(
      7,
      fetchCount > 1 ? 'Updated Brand' : 'Original Brand',
    ));
  };

  await act(async () => {
    root.render(React.createElement(Component, {
      brandId: 7,
      onBrandUpdated: async () => {},
    }));
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Edit Brand'))
      .click();
    await flush();
  });
  const nameInput = container.querySelector('input');
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  ).set;
  await act(async () => {
    valueSetter.call(nameInput, 'Updated Brand');
    nameInput.dispatchEvent(new window.Event('input', { bubbles: true }));
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Save Profile'))
      .click();
    await flush();
    await flush();
  });

  assert.ok(requests.some((request) => request.method === 'PUT'));
  assert.equal(fetchCount, 2);
  assert.match(container.textContent, /Updated Brand Guidelines/);
  assert.match(container.textContent, /Brand profile updated and verified/);
});

test('GuidelinesManager edits existing facts, terminology, and claim rules in place', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/pages/GuidelinesManager.jsx',
  );
  const saved = brandDetails(7, 'Editable Brand');
  saved.facts = [{
    id: 21,
    category: 'Product Specs',
    statement: 'Original approved fact.',
    key_metric: '10%',
    keywords: 'original',
  }];
  saved.terminology = [{
    id: 22,
    term: 'miracle',
    replacement: 'quality',
    replacement_text: 'quality',
    reason: 'Original reason.',
    category: 'Terminology',
    severity: 'warning',
  }];
  saved.claim_rules = [{
    id: 23,
    rule_name: 'Original claim rule',
    pattern_or_trigger: '\\bguaranteed\\b',
    severity: 'warning',
    required_disclaimer: 'Original disclaimer.',
    replacement_text: 'results vary',
    explanation: 'Original explanation.',
  }];
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    const requestUrl = new URL(String(url), 'http://localhost');
    const method = options.method || 'GET';
    requests.push({ path: requestUrl.pathname, method });
    if (method === 'PUT') {
      const payload = JSON.parse(options.body);
      if (requestUrl.pathname.endsWith('/facts/21')) {
        saved.facts[0] = { ...saved.facts[0], ...payload };
      } else if (requestUrl.pathname.endsWith('/terminology/22')) {
        saved.terminology[0] = { ...saved.terminology[0], ...payload };
      } else if (requestUrl.pathname.endsWith('/claims/23')) {
        saved.claim_rules[0] = { ...saved.claim_rules[0], ...payload };
      }
      return response({ success: true });
    }
    return response(saved);
  };

  await act(async () => {
    root.render(React.createElement(Component, { brandId: 7 }));
    await flush();
  });

  await act(async () => {
    container.querySelector('[aria-label="Edit fact 21"]').click();
    await flush();
  });
  assert.equal(container.querySelector('textarea').value, 'Original approved fact.');
  await act(async () => {
    setControlValue(window, container.querySelector('textarea'), 'Updated approved fact.');
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Save Changes'))
      .click();
    await flush();
    await flush();
  });
  assert.match(container.textContent, /Updated approved fact\./);

  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Vocabulary & Terms'))
      .click();
    await flush();
  });
  await act(async () => {
    container.querySelector('[aria-label="Edit terminology rule 22"]').click();
    await flush();
  });
  assert.equal(container.querySelector('input[placeholder="e.g. cheap"]').value, 'miracle');
  await act(async () => {
    setControlValue(
      window,
      container.querySelector('input[placeholder="e.g. cost-effective"]'),
      'carefully formulated',
    );
    setControlValue(
      window,
      container.querySelector('textarea'),
      'Updated reason.',
    );
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Save Changes'))
      .click();
    await flush();
    await flush();
  });
  assert.match(container.textContent, /carefully formulated/);
  assert.match(container.textContent, /Updated reason\./);

  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Claims & Legal'))
      .click();
    await flush();
  });
  await act(async () => {
    container.querySelector('[aria-label="Edit claim rule 23"]').click();
    await flush();
  });
  assert.equal(
    container.querySelector('input[placeholder="e.g. Absolute Guarantee Prohibition"]').value,
    'Original claim rule',
  );
  await act(async () => {
    setControlValue(
      window,
      container.querySelector('input[placeholder="e.g. Absolute Guarantee Prohibition"]'),
      'Updated claim rule',
    );
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Save Changes'))
      .click();
    await flush();
    await flush();
  });

  assert.match(container.textContent, /Updated claim rule/);
  assert.deepEqual(
    requests.filter((request) => request.method === 'PUT').map((request) => request.path),
    [
      '/api/brands/facts/21',
      '/api/brands/terminology/22',
      '/api/brands/claims/23',
    ],
  );
  assert.equal(requests.some((request) => request.method === 'POST'), false);
  assert.deepEqual(
    [saved.facts[0].id, saved.terminology[0].id, saved.claim_rules[0].id],
    [21, 22, 23],
  );
});

test('GuidelinesManager edits and re-fetches the existing visual rules record', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/pages/GuidelinesManager.jsx',
  );
  const saved = brandDetails(7, 'Visual Brand');
  saved.visual_rules = {
    id: 31,
    primary_colors: [{ name: 'Ocean', hex: '#123456' }],
    secondary_colors: [],
    forbidden_colors: [],
    logo_rules: 'Original logo rule.',
    font_family: 'Brand Sans',
    contrast_minimum: '4.5:1',
  };
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    const requestUrl = new URL(String(url), 'http://localhost');
    const method = options.method || 'GET';
    requests.push({ path: requestUrl.pathname, method });
    if (method === 'PUT') {
      saved.visual_rules = { ...saved.visual_rules, ...JSON.parse(options.body) };
      return response({ success: true });
    }
    return response(saved);
  };

  await act(async () => {
    root.render(React.createElement(Component, { brandId: 7 }));
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Color & Logo Rules'))
      .click();
    await flush();
  });
  assert.equal(container.querySelector('[aria-label="Primary brand colors"]').disabled, true);

  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Edit Rules'))
      .click();
    await flush();
  });
  const primaryColors = container.querySelector('[aria-label="Primary brand colors"]');
  assert.equal(primaryColors.value, 'Ocean: #123456');
  assert.equal(primaryColors.disabled, false);
  await act(async () => {
    setControlValue(window, primaryColors, 'Ocean: #abcdef');
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Save Rules'))
      .click();
    await flush();
    await flush();
  });

  assert.equal(saved.visual_rules.id, 31);
  assert.equal(saved.visual_rules.primary_colors[0].hex, '#abcdef');
  assert.equal(requests.filter((request) => request.method === 'PUT').length, 1);
  assert.equal(requests.filter((request) => request.method === 'GET').length, 2);
  assert.equal(container.querySelector('[aria-label="Primary brand colors"]').disabled, true);
});

test('ReviewHistory clears prior-brand content and ignores late list responses', async (context) => {
  const { React, act, Component, container, root } = await createComponentHarness(
    context,
    '/src/pages/ReviewHistory.jsx',
  );
  const requests = deferredFetch();

  await act(async () => {
    root.render(React.createElement(Component, { brandId: 1 }));
    await flush();
  });
  await act(async () => {
    root.render(React.createElement(Component, { brandId: 2 }));
    await flush();
  });
  assert.equal(requests.length, 2);

  await act(async () => {
    requests[1].resolve(response({ success: true, items: [contentItem(2, 'Brand Two Content')] }));
    await flush();
  });
  assert.match(container.textContent, /Brand Two Content/);

  await act(async () => {
    requests[0].resolve(response({ success: true, items: [contentItem(1, 'Brand One Content')] }));
    await flush();
  });
  assert.match(container.textContent, /Brand Two Content/);
  assert.doesNotMatch(container.textContent, /Brand One Content/);
});

test('ReviewHistory shows API failures instead of stale or empty results', async (context) => {
  const { React, act, Component, container, root } = await createComponentHarness(
    context,
    '/src/pages/ReviewHistory.jsx',
  );
  const requests = deferredFetch();

  await act(async () => {
    root.render(React.createElement(Component, { brandId: 1 }));
    await flush();
  });
  await act(async () => {
    requests[0].resolve(response({ success: false, error: 'History unavailable' }, 503));
    await flush();
  });
  assert.match(container.textContent, /History unavailable/);
  assert.equal(container.querySelector('[role="alert"]')?.textContent, 'History unavailable');
});

test('ReviewHistory reopens saved content with its persisted audit result', async (context) => {
  const { React, act, Component, container, root } = await createComponentHarness(
    context,
    '/src/pages/ReviewHistory.jsx',
  );
  const content = {
    ...contentItem(55, 'Saved audit content'),
    brand_id: 7,
    original_text: 'Persisted source text.',
  };
  const analysis = {
    version_number: 1,
    issues: [{ id: 'persisted-issue', rule: 'Persisted finding' }],
  };
  const versions = [
    { id: 501, content_id: 55, version_number: 1, text: 'Previous source text.' },
  ];
  const editedContent = [];
  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    if (requestUrl.includes('/api/content?')) {
      return response({ success: true, items: [content] });
    }
    if (requestUrl.includes('/api/content/55?')) {
      return response({
        success: true,
        content,
        latest_analysis: analysis,
        versions,
        reviews: [],
      });
    }
    return response({ success: false, error: 'Unexpected request' }, 404);
  };

  await act(async () => {
    root.render(React.createElement(Component, {
      brandId: 7,
      onEditContent: (value) => editedContent.push(value),
    }));
    await flush();
  });
  await act(async () => {
    container.querySelector('[title="Edit and resubmit as a new version"]').click();
    await flush();
  });

  assert.equal(editedContent.length, 1);
  assert.equal(editedContent[0].id, 55);
  assert.deepEqual(editedContent[0].latest_analysis, analysis);
  assert.deepEqual(editedContent[0].versions, versions);
});

test('DiffViewer marks added, removed, and modified text in split and unified views', async (context) => {
  const { React, act, Component, container, root } = await createComponentHarness(
    context,
    '/src/components/DiffViewer.jsx',
  );

  await act(async () => {
    root.render(React.createElement(Component, {
      originalText: 'Alpha old, keep. Remove. Tail.',
      correctedText: 'Alpha new, keep. Tail. Add.',
    }));
    await flush();
  });

  assert.ok(container.querySelector('[data-diff-kind="modified"][data-diff-side="before"]'));
  assert.ok(container.querySelector('[data-diff-kind="modified"][data-diff-side="after"]'));
  assert.ok(container.querySelector('[data-diff-kind="removed"][data-diff-side="before"]'));
  assert.ok(container.querySelector('[data-diff-kind="added"][data-diff-side="after"]'));

  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Unified'))
      .click();
    await flush();
  });
  const unifiedDiff = container.querySelector('[data-diff-mode="unified"]');
  assert.ok(unifiedDiff);
  assert.ok(unifiedDiff.querySelector('[data-diff-kind="modified"][data-diff-side="before"]'));
  assert.ok(unifiedDiff.querySelector('[data-diff-kind="modified"][data-diff-side="after"]'));
  assert.ok(unifiedDiff.querySelector('[data-diff-highlight="removed"]'));
  assert.ok(unifiedDiff.querySelector('[data-diff-highlight="added"]'));
  assert.ok(unifiedDiff.querySelector('[data-diff-kind="removed"]'));
  assert.ok(unifiedDiff.querySelector('[data-diff-kind="added"]'));
  assert.match(container.textContent, /−/);
  assert.match(container.textContent, /\+/);

  const manyWords = Array.from({ length: 710 }, (_, index) => `word${index}`);
  const revisedWords = [...manyWords];
  revisedWords[355] = 'updated';
  await act(async () => {
    root.render(React.createElement(Component, {
      originalText: manyWords.join(' '),
      correctedText: revisedWords.join(' '),
    }));
    await flush();
  });
  assert.ok(container.querySelector('[data-diff-kind="modified"][data-diff-side="before"]'));
  assert.ok(container.querySelector('[data-diff-kind="modified"][data-diff-side="after"]'));
});

test('DiffViewer handles punctuation, whitespace, repeated text, paragraphs, large text, and empty saved versions', async (context) => {
  const { React, act, Component, container, root } = await createComponentHarness(
    context,
    '/src/components/DiffViewer.jsx',
  );
  const cases = [
    {
      label: 'multiple paragraphs',
      before: 'First paragraph.\n\nSecond old line.\nThird paragraph.',
      after: 'First paragraph.\n\nSecond new line.\nFourth paragraph.',
      expected: ['modified'],
    },
    {
      label: 'punctuation',
      before: 'Hello, world!',
      after: 'Hello; world?',
      expected: ['modified'],
    },
    {
      label: 'whitespace',
      before: 'Keep  these spaces.',
      after: 'Keep these spaces.',
      expected: ['modified'],
    },
    {
      label: 'repeated words',
      before: 'go go stay go',
      after: 'go stay go go',
      expected: ['modified', 'removed', 'added'],
    },
  ];

  for (const diffCase of cases) {
    await act(async () => {
      root.render(React.createElement(Component, {
        originalText: diffCase.before,
        correctedText: diffCase.after,
        allowEmptyText: true,
      }));
      await flush();
    });
    const kinds = new Set(Array.from(
      container.querySelectorAll('[data-diff-kind]'),
      (element) => element.getAttribute('data-diff-kind'),
    ));
    assert.ok(
      diffCase.expected.some((kind) => kinds.has(kind)),
      `${diffCase.label} should render a highlighted change`,
    );
    assert.ok(container.textContent.includes(diffCase.before));
    assert.ok(container.textContent.includes(diffCase.after));
  }

  const largeOriginal = Array.from({ length: 1400 }, (_, index) => `word${index}`).join(' ');
  const largeRevised = largeOriginal.replace('word700', 'updated700');
  await act(async () => {
    root.render(React.createElement(Component, {
      originalText: largeOriginal,
      correctedText: largeRevised,
      allowEmptyText: true,
    }));
    await flush();
  });
  assert.ok(container.querySelector('[data-diff-kind="modified"]'));

  const anchoredOriginal = [
    ...Array.from({ length: 400 }, (_, index) => `before${index}`),
    'shared-anchor',
    ...Array.from({ length: 400 }, (_, index) => `after${index}`),
  ].join(' ');
  const anchoredRevised = [
    ...Array.from({ length: 400 }, (_, index) => `revised-before${index}`),
    'shared-anchor',
    ...Array.from({ length: 400 }, (_, index) => `revised-after${index}`),
  ].join(' ');
  await act(async () => {
    root.render(React.createElement(Component, {
      originalText: anchoredOriginal,
      correctedText: anchoredRevised,
      allowEmptyText: true,
    }));
    await flush();
  });
  assert.equal(
    Array.from(container.querySelectorAll('span'))
      .filter((element) => element.textContent === 'shared-anchor').length,
    2,
  );
  assert.equal(
    Array.from(container.querySelectorAll('mark'))
      .some((element) => element.textContent.includes('shared-anchor')),
    false,
  );

  const highEditDistanceOriginal = Array.from(
    { length: 1100 },
    (_, index) => `old${index}`,
  ).join(' ');
  const highEditDistanceReplacement = Array.from(
    { length: 1100 },
    (_, index) => `new${index}`,
  ).join(' ');
  await act(async () => {
    root.render(React.createElement(Component, {
      originalText: highEditDistanceOriginal,
      correctedText: highEditDistanceReplacement,
      allowEmptyText: true,
    }));
    await flush();
  });
  assert.ok(container.querySelector('[data-diff-kind="removed"]'));
  assert.ok(container.querySelector('[data-diff-kind="added"]'));

  await act(async () => {
    root.render(React.createElement(Component, {
      originalText: 'Removed version text.',
      correctedText: '',
      allowEmptyText: true,
    }));
    await flush();
  });
  assert.ok(container.querySelector('[data-diff-kind="removed"]'));
  assert.match(container.textContent, /Removed version text/);

  await act(async () => {
    root.render(React.createElement(Component, {
      originalText: '',
      correctedText: 'Added version text.',
      allowEmptyText: true,
    }));
    await flush();
  });
  assert.ok(container.querySelector('[data-diff-kind="added"]'));
  assert.match(container.textContent, /Added version text/);

  await act(async () => {
    root.render(React.createElement(Component, {
      originalText: '',
      correctedText: '',
      allowEmptyText: true,
    }));
    await flush();
  });
  assert.match(container.textContent, /These versions contain identical text/);

  await act(async () => {
    root.render(React.createElement(Component, {
      originalText: null,
      correctedText: 'Version text.',
      allowEmptyText: true,
    }));
    await flush();
  });
  assert.match(container.textContent, /Comparison data is unavailable/);
});

test('IssueCard distinguishes high-risk claims from unsupported evidence', async (context) => {
  const { React, act, Component, container, root } = await createComponentHarness(
    context,
    '/src/components/IssueCard.jsx',
  );
  const sourceText = 'This product cures all diseases.';

  await act(async () => {
    root.render(React.createElement(Component, {
      sourceText,
      issue: {
        id: 'health-claim',
        category: 'Compliance & Claims',
        severity: 'CRITICAL',
        rule: 'Health claim review',
        matched_text: 'cures all diseases',
        explanation: 'A health claim requires manual review.',
        assessment: 'high_risk_health_claim',
        evidence_status: 'unsupported_by_configured_evidence',
        manual_review_required: true,
        auto_fixable: false,
        suggestion: 'Have a qualified reviewer assess the claim.',
        location: { start: 13, end: 31 },
      },
    }));
    await flush();
  });

  assert.match(container.textContent, /High-risk health claim - manual review required/);
  assert.match(container.textContent, /No matching configured evidence/);
});

test('IssueCard presents guaranteed outcomes as critical claims requiring human review', async (context) => {
  const { React, act, Component, container, root } = await createComponentHarness(
    context,
    '/src/components/IssueCard.jsx',
  );
  const sourceText = 'Every customer will experience guaranteed results within 24 hours.';
  const matchedText = sourceText.slice(0, -1);

  await act(async () => {
    root.render(React.createElement(Component, {
      sourceText,
      issue: {
        id: 'guaranteed-outcome',
        category: 'Compliance & Claims',
        severity: 'CRITICAL',
        rule: 'Guaranteed outcome review',
        matched_text: matchedText,
        explanation: 'A guaranteed outcome with a timeframe needs supporting evidence and human review.',
        assessment: 'high_risk_absolute_claim',
        evidence_status: 'unsupported_by_configured_evidence',
        manual_review_required: true,
        auto_fixable: false,
        location: { start: 0, end: matchedText.length },
      },
    }));
    await flush();
  });

  assert.match(container.textContent, /CRITICAL/);
  assert.match(container.textContent, /High-risk absolute claim - manual review required/);
  assert.match(container.textContent, /guaranteed results within 24 hours/);
  assert.match(container.textContent, /supporting evidence and human review/);
});

test('ReviewHistory deletes only the selected content after explicit cascade confirmation', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/pages/ReviewHistory.jsx',
  );
  const content = {
    ...contentItem(55, 'Delete this audit'),
    brand_id: 7,
    original_text: 'Selected source text.',
    corrected_text: 'Selected revised text.',
  };
  const requests = [];
  let confirmation = '';
  window.confirm = (message) => {
    confirmation = message;
    return true;
  };
  globalThis.fetch = async (url, options = {}) => {
    const request = {
      url: String(url),
      method: options.method || 'GET',
    };
    requests.push(request);
    if (request.url.includes('/api/content?')) {
      return response({ success: true, items: [content] });
    }
    if (request.url.includes('/api/content/55?')) {
      return response({
        success: true,
        content,
        latest_analysis: null,
        versions: [],
        reviews: [],
      });
    }
    if (request.method === 'DELETE') {
      return response({
        success: true,
        content_id: 55,
        message: 'Content and associated history deleted.',
      });
    }
    return response({ success: false, error: 'Unexpected request' }, 404);
  };

  await act(async () => {
    root.render(React.createElement(Component, { brandId: 7 }));
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Audit Log'))
      .click();
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Delete Content'))
      .click();
    await flush();
  });

  assert.match(confirmation, /versions, analyses, reviews, and correction drafts/);
  assert.match(confirmation, /brand and other content will be kept/);
  assert.ok(requests.some((request) => (
    request.method === 'DELETE'
    && request.url === '/api/content/55?brand_id=7'
  )));
  assert.match(container.textContent, /Content and associated history deleted/);
  assert.doesNotMatch(container.textContent, /Delete this audit/);
});

test('ContentAnalyzer explains when a saved audit has no readability metrics', async (context) => {
  const { React, act, Component, container, root } = await createComponentHarness(
    context,
    '/src/pages/ContentAnalyzer.jsx',
  );
  const content = {
    ...contentItem(77, 'Saved content without readability'),
    brand_id: 7,
    original_text: 'Previously audited copy.',
    latest_analysis: {
      version_number: 1,
      issues: [],
      readability: null,
    },
  };
  globalThis.fetch = async (url) => {
    if (String(url).includes('/api/analysis/manual-corrections/77?')) {
      return response({
        success: true,
        preview_state: { correction_count: 0 },
      });
    }
    return response({ success: false, error: 'Unexpected request' }, 404);
  };

  await act(async () => {
    root.render(React.createElement(Component, {
      brandId: 7,
      brandName: 'Readability Test Brand',
      contentToEdit: content,
    }));
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Readability'))
      .click();
    await flush();
  });

  assert.match(
    container.textContent,
    /Readability metrics are unavailable for this saved audit\. Run a new audit to calculate them\./,
  );
});

test('ReviewHistory preserves JSON export and downloads its brand-scoped PDF', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/pages/ReviewHistory.jsx',
  );
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalAnchorClick = window.HTMLAnchorElement.prototype.click;
  let downloadedFilename = '';
  const requests = [];
  URL.createObjectURL = () => 'blob:history-report';
  URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function click() {
    downloadedFilename = this.download;
  };
  context.after(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    window.HTMLAnchorElement.prototype.click = originalAnchorClick;
  });
  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    requests.push(requestUrl);
    if (requestUrl.includes('/api/content?')) {
      return response({ success: true, items: [contentItem(55, 'Saved PDF Content')] });
    }
    if (requestUrl.includes('/api/content/55?')) {
      return response({
        success: true,
        content: {
          ...contentItem(55, 'Saved PDF Content'),
          brand_id: 7,
          brand_name: 'Northstar Co',
          original_text: 'Saved PDF source.',
        },
        latest_analysis: { version_number: 1, issues: [] },
        versions: [],
        reviews: [],
      });
    }
    return new Response(new Blob(['%PDF-1.4 history report'], {
      type: 'application/pdf',
    }), {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    });
  };

  await act(async () => {
    root.render(React.createElement(Component, { brandId: 7 }));
    await flush();
  });
  await act(async () => {
    container.querySelector('[title="View Revisions & Decision Trail"]').click();
    await flush();
  });
  assert.ok(Array.from(container.querySelectorAll('button'))
    .some((button) => button.textContent.includes('Export JSON Record')));
  const pdfButton = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent.includes('Download PDF'));
  assert.ok(pdfButton);
  assert.match(pdfButton.textContent, /Download PDF/);

  await act(async () => {
    pdfButton.click();
    await flush();
  });

  assert.ok(requests.some((url) =>
    url.endsWith('/api/history/export/55/pdf?brand_id=7')));
  assert.equal(downloadedFilename, 'BrandGuard_Audit_Report_Northstar_Co.pdf');
});

test('ReviewHistory compares any two saved versions with their numbers and timestamps', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/pages/ReviewHistory.jsx',
  );
  const firstVersionText = (
    'Choose natural skincare for all skin types. We prioritize thoughtful care.'
  );
  const thirdVersionText = (
    'Choose organic skincare for sensitive skin types. We prioritize safety, sustainability.'
  );
  const versions = [
    { id: '33', content_id: '44', version_number: 3, created_at: '2026-03-03 12:00:00', text: thirdVersionText },
    { id: '32', content_id: '44', version_number: 2, created_at: '2026-03-02 12:00:00', text: 'Second version copy' },
    { id: '31', content_id: '44', version_number: 1, created_at: '2026-03-01 12:00:00', text: firstVersionText },
  ];
  const requests = [];
  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    requests.push(requestUrl);
    if (requestUrl.includes('/api/content?')) {
      return response({ success: true, items: [contentItem(44, 'Versioned content')] });
    }
    if (requestUrl.includes('/api/content/44?')) {
      return response({
        success: true,
        content: {
          id: 44,
          brand_id: 7,
          title: 'Versioned content',
          current_version: 3,
          status: 'pending_review',
          risk_score: 80,
          original_text: thirdVersionText,
          corrected_text: thirdVersionText,
        },
        versions,
        reviews: [],
      });
    }
    return response({ success: false, error: 'Unexpected request' }, 404);
  };

  await act(async () => {
    root.render(React.createElement(Component, { brandId: 7 }));
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Audit Log'))
      .click();
    await flush();
  });
  assert.ok(requests.some((url) => url.includes('/api/content/44?brand_id=7')));
  assert.ok(Array.from(container.querySelectorAll('button'))
    .some((button) => button.textContent.includes('Current vs Proposed Correction')));
  assert.ok(Array.from(container.querySelectorAll('button'))
    .some((button) => button.textContent.includes('Compare Saved Versions')));

  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Compare Saved Versions'))
      .click();
    await flush();
  });

  const leftSelect = container.querySelector('select[aria-label="First saved version"]');
  const setSelectValue = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    'value',
  ).set;
  await act(async () => {
    setSelectValue.call(leftSelect, '3');
    leftSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    await flush();
  });
  assert.equal(
    container.querySelector('[role="alert"]')?.textContent,
    'Select two different saved versions to compare.',
  );

  await act(async () => {
    setSelectValue.call(leftSelect, '1');
    leftSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    await flush();
  });
  assert.match(container.textContent, /Version 1 -/);
  assert.match(container.textContent, /Version 3 -/);
  assert.ok(container.textContent.includes('03-03-2026 12:00 UTC'));
  assert.equal(
    container.querySelector('[data-diff-text-side="before"]')?.textContent,
    firstVersionText,
  );
  assert.equal(
    container.querySelector('[data-diff-text-side="after"]')?.textContent,
    thirdVersionText,
  );
  assert.match(container.textContent, /natural skincare/);
  assert.match(container.textContent, /organic skincare/);
  assert.doesNotMatch(container.textContent, /Select two different saved versions/);
  const removedText = Array.from(
    container.querySelectorAll('[data-diff-highlight="removed"]'),
    (element) => element.textContent,
  ).join(' ');
  const addedText = Array.from(
    container.querySelectorAll('[data-diff-highlight="added"]'),
    (element) => element.textContent,
  ).join(' ');
  assert.match(removedText, /natural/);
  assert.match(removedText, /all/);
  assert.match(addedText, /organic/);
  assert.match(addedText, /sensitive/);
  assert.match(addedText, /safety, sustainability/);
});

test('ReviewHistory restores an older saved version as a new version and surfaces conflicts', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/pages/ReviewHistory.jsx',
  );
  const originalText = 'Original version text.';
  let content = {
    ...contentItem(44, 'Restorable content'),
    brand_id: 7,
    current_version: 2,
    status: 'approved',
    original_text: 'Current version text.',
    corrected_text: null,
  };
  let versions = [
    { id: 32, content_id: 44, version_number: 2, created_at: '2026-03-02 12:00:00', text: 'Current version text.' },
    { id: 31, content_id: 44, version_number: 1, created_at: '2026-03-01 12:00:00', text: originalText },
  ];
  const reviews = [{
    id: 9,
    content_id: 44,
    content_version: 2,
    reviewer_name: 'Existing Reviewer',
    reviewer_role: 'Editor',
    decision: 'approved',
    comments: 'Keep this decision in history.',
    created_at: '2026-03-02 12:30:00',
  }];
  const requests = [];
  const confirmations = [];
  window.confirm = (message) => {
    confirmations.push(message);
    return true;
  };
  globalThis.fetch = async (url, options = {}) => {
    const requestUrl = String(url);
    const method = options.method || 'GET';
    requests.push({ url: requestUrl, method, body: options.body });
    if (requestUrl.includes('/api/content?')) {
      return response({ success: true, items: [content] });
    }
    if (requestUrl.endsWith('/api/content/44/restore')) {
      if (content.current_version !== 2) {
        return response({
          success: false,
          error: 'Content changed before the restore completed. Reload the latest version.',
          current_version: content.current_version,
        }, 409);
      }
      content = {
        ...content,
        current_version: 3,
        status: 'draft',
        risk_score: null,
        risk_level: null,
        original_text: originalText,
      };
      versions = [
        { id: 33, content_id: 44, version_number: 3, created_at: '2026-03-03 12:00:00', text: originalText },
        ...versions,
      ];
      return response({
        success: true,
        content_id: 44,
        brand_id: 7,
        restored_from_version_id: 31,
        version_id: 33,
        version: 3,
        status: 'draft',
        message: 'Version 1 was restored as new version 3. Existing versions and reviews were preserved.',
      });
    }
    if (requestUrl.includes('/api/content/44?')) {
      return response({
        success: true,
        content,
        latest_analysis: { version_number: 2 },
        versions,
        reviews,
      });
    }
    return response({ success: false, error: 'Unexpected request' }, 404);
  };

  await act(async () => {
    root.render(React.createElement(Component, { brandId: 7 }));
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Audit Log'))
      .click();
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Restore as New Version'))
      .click();
    await flush();
  });

  const restoreRequest = requests.find((request) => (
    request.url.endsWith('/api/content/44/restore')
  ));
  assert.equal(restoreRequest.method, 'POST');
  assert.deepEqual(JSON.parse(restoreRequest.body), {
    brand_id: 7,
    version_id: 31,
    expected_current_version: 2,
  });
  assert.match(confirmations[0], /Existing versions and review decisions will be preserved/);
  assert.match(container.textContent, /Current: v3/);
  assert.match(container.textContent, /Version Timeline \(3\)/);
  assert.match(container.textContent, /Version 1 was restored as new version 3/);
  assert.match(container.textContent, /Not audited/);
  assert.equal(versions[0].text, originalText);
  assert.equal(reviews.length, 1);
  assert.equal(reviews[0].content_version, 2);

  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Restore as New Version'))
      .click();
    await flush();
  });
  assert.equal(
    container.querySelector('[role="alert"]')?.textContent,
    'Content changed before the restore completed. Reload the latest version.',
  );
  assert.equal(
    requests.filter((request) => request.url.endsWith('/api/content/44/restore')).length,
    2,
  );
});

test('ReviewHistory handles missing and identical saved versions', async (context) => {
  const { React, act, Component, container, root } = await createComponentHarness(
    context,
    '/src/pages/ReviewHistory.jsx',
  );
  const versionSets = {
    45: [{ id: 1, content_id: 45, version_number: 1, created_at: '2026-03-01T12:00:00Z', text: 'Only saved version' }],
    46: [
      { id: 2, content_id: 46, version_number: 2, created_at: '2026-03-02T12:00:00Z', text: 'Same saved text' },
      { id: 3, content_id: 46, version_number: 1, created_at: '2026-03-01T12:00:00Z', text: 'Same saved text' },
    ],
  };
  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    if (requestUrl.includes('/api/content?')) {
      return response({
        success: true,
        items: [
          contentItem(45, 'One-version content'),
          contentItem(46, 'Identical-version content'),
        ],
      });
    }
    const contentId = Number(new URL(requestUrl, 'http://localhost').pathname.split('/').pop());
    return response({
      success: true,
      content: {
        id: contentId,
        brand_id: 7,
        title: 'Versioned content',
        current_version: 2,
        status: 'pending_review',
        risk_score: 80,
        original_text: '',
        corrected_text: '',
      },
      versions: versionSets[contentId],
      reviews: [],
    });
  };

  await act(async () => {
    root.render(React.createElement(Component, { brandId: 7 }));
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Audit Log'))
      .click();
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Compare Saved Versions'))
      .click();
    await flush();
  });
  assert.match(container.textContent, /At least two saved versions are required for comparison/);

  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Close'))
      .click();
    await flush();
  });
  const identicalItemRow = Array.from(container.querySelectorAll('tbody tr'))
    .find((row) => row.textContent.includes('Identical-version content'));
  await act(async () => {
    Array.from(identicalItemRow.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Audit Log'))
      .click();
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Compare Saved Versions'))
      .click();
    await flush();
  });
  assert.match(container.textContent, /These versions contain identical text/);
  assert.equal(container.querySelector('[data-diff-kind]'), null);
});

test('ContentAnalyzer requires a current audit before recording a review', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/pages/ContentAnalyzer.jsx',
  );
  const calls = [];
  let auditCount = 0;
  globalThis.fetch = async (url, options = {}) => {
    const request = {
      url: String(url),
      body: options.body ? JSON.parse(options.body) : null,
    };
    calls.push(request);
    if (request.url.endsWith('/api/analysis/audit')) {
      auditCount += 1;
      return response({
        success: true,
        content_id: 31,
        version: 3 + auditCount,
        status: 'pending_review',
        result: {
          score: 100,
          risk_level: 'LOW',
          sub_scores: {
            terminology: 100,
            facts: 100,
            tone: 100,
            claims: 100,
            accessibility: 100,
          },
          issues: [],
          summary: 'No configured issues.',
          corrected_text: request.body.text,
          engine_used: 'RULE_BASED_FALLBACK',
          visual_validation: { supported: false, message: 'Not validated.' },
          readability: {
            reading_ease: 80,
            grade_level: 5,
            sentence_count: 1,
            reading_time_sec: 1,
          },
        },
      });
    }
    if (request.url.endsWith('/api/reviews')) {
      return response({
        success: true,
        new_status: 'approved',
        message: 'Review recorded.',
      });
    }
    return response({ success: false, error: 'Unexpected request' }, 404);
  };

  await act(async () => {
    root.render(React.createElement(Component, {
      brandId: 7,
      brandName: 'Review Test Brand',
    }));
    await flush();
  });
  const editor = container.querySelector('textarea');
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  ).set;
  await act(async () => {
    valueSetter.call(editor, ' Draft content ');
    editor.dispatchEvent(new window.Event('input', { bubbles: true }));
    await flush();
  });
  assert.match(
    container.textContent,
    /Upload a text document for content analysis, or a PNG\/JPEG\/WebP image for Visual Review\./,
  );
  assert.match(
    container.textContent,
    /Run Audit before approving or rejecting this content\./,
  );
  const approveButton = container.querySelector('[title="Sign-off & Approve Content"]');
  const rejectButton = container.querySelector('[title="Reject with audit feedback"]');
  assert.equal(approveButton.disabled, true);
  assert.equal(rejectButton.disabled, true);
  await act(async () => {
    approveButton.click();
    rejectButton.click();
    await flush();
  });
  assert.equal(calls.filter((call) => call.url.endsWith('/api/analysis/audit')).length, 0);
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Audit Content'))
      .click();
    await flush();
  });
  assert.equal(approveButton.disabled, false);
  assert.equal(rejectButton.disabled, false);

  await act(async () => {
    valueSetter.call(editor, ' Updated draft content ');
    editor.dispatchEvent(new window.Event('input', { bubbles: true }));
    await flush();
  });
  assert.equal(approveButton.disabled, true);
  assert.equal(rejectButton.disabled, true);
  assert.match(
    container.textContent,
    /Run Audit before approving or rejecting this content\./,
  );
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Audit Content'))
      .click();
    await flush();
  });
  assert.equal(approveButton.disabled, false);
  assert.equal(rejectButton.disabled, false);

  await act(async () => {
    approveButton.click();
    await flush();
  });
  const reviewerName = container.querySelector('input[placeholder="Reviewer Name"]');
  const nameSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  ).set;
  await act(async () => {
    nameSetter.call(reviewerName, 'Reviewer');
    reviewerName.dispatchEvent(new window.Event('input', { bubbles: true }));
    await flush();
  });
  await act(async () => {
    container.querySelector('button[type="submit"]').click();
    await flush();
  });

  const auditCall = calls.find((call) => call.url.endsWith('/api/analysis/audit'));
  const reviewCall = calls.find((call) => call.url.endsWith('/api/reviews'));
  assert.equal(auditCount, 2);
  assert.equal(auditCall.body.text, ' Draft content ');
  assert.equal(calls.filter((call) => call.url.endsWith('/api/analysis/audit'))[1].body.text, ' Updated draft content ');
  assert.equal(reviewCall.body.content_id, 31);
  assert.equal(reviewCall.body.content_version, 5);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3600));
  });
});

test('App restores the saved brand, content, and audit after a page reload', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/App.jsx',
  );
  window.localStorage.setItem('brandguard.ui-state.v1', JSON.stringify({
    currentTab: 'analyzer',
    selectedBrandId: 7,
    activeContentId: 55,
    auditIdToInspect: null,
  }));
  const previousSavedText = (
    'Choose natural skincare for all skin types. We prioritize thoughtful care.'
  );
  const savedContent = {
    id: 55,
    brand_id: 7,
    title: 'Saved GreenLeaf Copy',
    content_type: 'Ad Copy',
    channel: 'Digital',
    original_text: 'Choose organic skincare for sensitive skin types. We prioritize safety, sustainability.',
    corrected_text: 'Choose organic skincare for sensitive skin types. We prioritize safety, sustainability.',
    current_version: 2,
    status: 'pending_review',
  };
  const savedIssue = {
    id: 'saved-issue',
    category: 'Terminology',
    severity: 'WARNING',
    rule: 'Saved audit issue',
    matched_text: 'source',
    suggestion: 'Review this terminology.',
    auto_fixable: false,
    manual_review_required: true,
    location: { start: 18, end: 24 },
  };
  const requests = [];
  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    requests.push(requestUrl);
    if (requestUrl.endsWith('/api/brands')) {
      return response({ success: true, brands: [{ id: 7, name: 'GreenLeaf' }] });
    }
    if (requestUrl.endsWith('/api/analysis/system-status')) {
      return response({ success: true, ai_configured: false, mode: 'Rule-Based Fallback' });
    }
    if (requestUrl.startsWith('/api/content/55')) {
      return response({
        success: true,
        content: savedContent,
        latest_analysis: {
          version_number: 2,
          score: 82,
          risk_level: 'WARNING',
          sub_scores: {},
          issues: [savedIssue],
          summary: 'Saved audit result.',
          corrected_text: savedContent.original_text,
        },
        versions: [
          {
            id: '1',
            content_id: '55',
            version_number: 1,
            text: previousSavedText,
          },
          { id: '2', content_id: '55', version_number: 2, text: savedContent.original_text },
        ],
        reviews: [],
      });
    }
    if (requestUrl.includes('/api/analysis/manual-corrections/55?')) {
      return response({
        success: true,
        preview_state: { correction_count: 0 },
      });
    }
    return response({ success: false, error: 'Unexpected request' }, 404);
  };

  await act(async () => {
    root.render(React.createElement(Component));
    await flush();
    await flush();
  });

  assert.ok(requests.some((url) => url.startsWith('/api/content/55')));
  assert.equal(container.querySelector('textarea')?.value, savedContent.original_text);
  assert.match(container.textContent, /Saved audit issue/);
  assert.match(container.textContent, /\(v2\)/);
  assert.deepEqual(
    JSON.parse(window.localStorage.getItem('brandguard.ui-state.v1')),
    {
      currentTab: 'analyzer',
      selectedBrandId: 7,
      activeContentId: 55,
      auditIdToInspect: null,
    },
  );
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Diff & Changes'))
      .click();
    await flush();
    await flush();
  });
  const savedVersionComparison = container.querySelector(
    '[aria-label="Saved version comparison"]',
  );
  assert.equal(savedVersionComparison?.getAttribute('data-content-id'), '55');
  assert.equal(savedVersionComparison?.getAttribute('data-previous-version-id'), '1');
  assert.equal(savedVersionComparison?.getAttribute('data-current-version-id'), '2');
  assert.equal(
    savedVersionComparison?.querySelector('[data-diff-text-side="before"]')?.textContent,
    previousSavedText,
  );
  assert.equal(
    savedVersionComparison?.querySelector('[data-diff-text-side="after"]')?.textContent,
    savedContent.original_text,
  );
  assert.match(savedVersionComparison?.textContent || '', /natural skincare/);
  assert.match(savedVersionComparison?.textContent || '', /organic skincare/);
  const savedRemovedText = Array.from(
    savedVersionComparison?.querySelectorAll('[data-diff-highlight="removed"]') || [],
    (element) => element.textContent,
  ).join(' ');
  const savedAddedText = Array.from(
    savedVersionComparison?.querySelectorAll('[data-diff-highlight="added"]') || [],
    (element) => element.textContent,
  ).join(' ');
  assert.match(savedRemovedText, /natural/);
  assert.match(savedRemovedText, /all/);
  assert.match(savedAddedText, /organic/);
  assert.match(savedAddedText, /sensitive/);
  assert.match(savedAddedText, /safety, sustainability/);
  assert.match(container.textContent, /Proposed Correction Preview \(not a saved version\)/);
  const proposedPreview = container.querySelector('[aria-label="Proposed correction preview"]');
  assert.match(proposedPreview?.textContent || '', /These versions contain identical text/);
  assert.ok(savedVersionComparison?.querySelector('[data-diff-highlight="removed"]'));
  assert.ok(savedVersionComparison?.querySelector('[data-diff-highlight="added"]'));
});

test('App preserves saved content after restore failures and clears the error only after retry succeeds', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/App.jsx',
  );
  window.localStorage.setItem('brandguard.ui-state.v1', JSON.stringify({
    currentTab: 'analyzer',
    selectedBrandId: 7,
    activeContentId: 55,
    auditIdToInspect: null,
  }));
  const savedContent = {
    id: 55,
    brand_id: 7,
    title: 'Retryable saved content',
    content_type: 'Ad Copy',
    channel: 'Digital',
    original_text: 'Previously saved source copy.',
    corrected_text: null,
    current_version: 1,
    status: 'draft',
  };
  let restoreAttempts = 0;
  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    if (requestUrl.endsWith('/api/brands')) {
      return response({ success: true, brands: [{ id: 7, name: 'Retry Brand' }] });
    }
    if (requestUrl.endsWith('/api/analysis/system-status')) {
      return response({ success: true, ai_configured: false, mode: 'Rule-Based Fallback' });
    }
    if (requestUrl.startsWith('/api/content/55')) {
      restoreAttempts += 1;
      if (restoreAttempts < 3) {
        return response({
          success: false,
          error: `Temporary restore failure ${restoreAttempts}.`,
        }, 503);
      }
      return response({
        success: true,
        content: savedContent,
        latest_analysis: null,
        versions: [
          { id: 1, content_id: 55, version_number: 1, text: savedContent.original_text },
        ],
        reviews: [],
      });
    }
    if (requestUrl.includes('/api/analysis/manual-corrections/55?')) {
      return response({
        success: true,
        preview_state: { correction_count: 0 },
      });
    }
    return response({ success: false, error: 'Unexpected request' }, 404);
  };

  await act(async () => {
    root.render(React.createElement(Component));
    await flush();
    await flush();
  });

  const persistedState = () => JSON.parse(
    window.localStorage.getItem('brandguard.ui-state.v1'),
  );
  assert.match(container.querySelector('[role="alert"]')?.textContent || '', /Temporary restore failure 1/);
  assert.ok(Array.from(container.querySelectorAll('button'))
    .some((button) => button.textContent.includes('Retry content restore')));
  assert.equal(persistedState().activeContentId, 55);

  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Retry content restore'))
      .click();
    await flush();
    await flush();
  });
  assert.match(container.querySelector('[role="alert"]')?.textContent || '', /Temporary restore failure 2/);
  assert.equal(persistedState().activeContentId, 55);

  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Retry content restore'))
      .click();
    await flush();
    await flush();
    await flush();
  });
  assert.equal(restoreAttempts, 3);
  assert.equal(container.querySelector('[role="alert"]'), null);
  assert.equal(container.querySelector('textarea')?.value, savedContent.original_text);
  assert.equal(persistedState().activeContentId, 55);
  assert.equal(persistedState().selectedBrandId, 7);
});

test('ContentAnalyzer downloads one brand-scoped PDF and shows its loading state', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/pages/ContentAnalyzer.jsx',
  );
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const originalAnchorClick = window.HTMLAnchorElement.prototype.click;
  const downloads = [];
  const requests = [];
  let resolvePdfResponse;
  URL.createObjectURL = () => 'blob:brandguard-audit-report';
  URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function click() {
    downloads.push({
      filename: this.download,
      href: this.href,
    });
  };
  context.after(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
    window.HTMLAnchorElement.prototype.click = originalAnchorClick;
  });
  globalThis.fetch = async (url) => {
    const requestUrl = String(url);
    requests.push(requestUrl);
    if (requestUrl.includes('/api/analysis/manual-corrections/55?')) {
      return response({ success: true, preview_state: { correction_count: 0 } });
    }
    return new Promise((resolve) => {
      resolvePdfResponse = resolve;
    });
  };

  await act(async () => {
    root.render(React.createElement(Component, {
      brandId: 7,
      brandName: 'Northstar Co',
      contentToEdit: {
        id: 55,
        brand_id: 7,
        title: 'Saved report content',
        content_type: 'Ad Copy',
        channel: 'Digital',
        original_text: 'Saved source text.',
        current_version: 3,
        latest_analysis: {
          version_number: 3,
          score: 88,
          risk_level: 'MODERATE',
          sub_scores: {
            facts: 90,
            claims: 88,
            terminology: 90,
            tone: 85,
            accessibility: 88,
          },
          issues: [],
          summary: 'Stored audit assessment.',
          corrected_text: 'Saved source text.',
        },
      },
    }));
    await flush();
    await flush();
  });

  const downloadButton = Array.from(container.querySelectorAll('button'))
    .find((button) => button.textContent.includes('Download PDF Report'));
  assert.ok(downloadButton);
  assert.equal(downloadButton.disabled, false);

  await act(async () => {
    downloadButton.click();
    await flush();
  });
  assert.match(downloadButton.textContent, /Generating PDF/);
  await act(async () => {
    downloadButton.click();
    await flush();
  });
  assert.equal(
    requests.filter((url) => url.includes('/history/export/55/pdf?')).length,
    1,
  );

  await act(async () => {
    resolvePdfResponse(new Response(new Blob(['%PDF-1.4 real report bytes'], {
      type: 'application/pdf',
    }), {
      status: 200,
      headers: { 'content-type': 'application/pdf' },
    }));
    await flush();
    await flush();
  });

  assert.equal(downloads.length, 1);
  assert.equal(downloads[0].filename, 'BrandGuard_Audit_Report_Northstar_Co.pdf');
  assert.equal(downloads[0].href, 'blob:brandguard-audit-report');
  assert.match(downloadButton.textContent, /Download PDF Report/);
});

test('ContentAnalyzer displays PDF generation failures', async (context) => {
  const { React, act, Component, container, root } = await createComponentHarness(
    context,
    '/src/pages/ContentAnalyzer.jsx',
  );
  globalThis.fetch = async (url) => {
    if (String(url).includes('/api/analysis/manual-corrections/55?')) {
      return response({ success: true, preview_state: { correction_count: 0 } });
    }
    return response({
      success: false,
      error: 'The current audit is unavailable.',
    }, 404);
  };

  await act(async () => {
    root.render(React.createElement(Component, {
      brandId: 7,
      brandName: 'Northstar Co',
      contentToEdit: {
        id: 55,
        brand_id: 7,
        original_text: 'Saved source text.',
        current_version: 1,
        latest_analysis: {
          version_number: 1,
          score: 100,
          risk_level: 'LOW',
          sub_scores: {
            facts: 100,
            claims: 100,
            terminology: 100,
            tone: 100,
            accessibility: 100,
          },
          issues: [],
          summary: 'No configured issues.',
          corrected_text: 'Saved source text.',
        },
      },
    }));
    await flush();
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Download PDF Report'))
      .click();
    await flush();
  });

  assert.equal(
    container.querySelector('[role="alert"]')?.textContent,
    'The current audit is unavailable.',
  );
});

test('ContentAnalyzer preserves original copy and shows only the saved revision status', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/pages/ContentAnalyzer.jsx',
  );
  const sourceText = 'Original restricted copy';
  const appliedText = 'Corrected once';
  const requests = [];
  globalThis.fetch = async (url, options = {}) => {
    const request = {
      url: String(url),
      body: options.body ? JSON.parse(options.body) : null,
    };
    requests.push(request);
    if (request.url.includes('/api/content/33?')) {
      return response({
        success: true,
        content: { id: 33, brand_id: 7, current_version: 1 },
      });
    }
    if (request.url.endsWith('/api/analysis/audit')) {
      return response({
        success: true,
        content_id: 33,
        version: 1,
        status: 'pending_review',
        result: {
          score: 40,
          risk_level: 'CRITICAL',
          sub_scores: {
            terminology: 40,
            facts: 100,
            tone: 100,
            claims: 100,
            accessibility: 100,
          },
          issues: [{
            id: 'term_1_0_8',
            category: 'Terminology',
            severity: 'CRITICAL',
            rule: 'Prohibited Term',
            matched_text: 'restricted',
            replacement_text: 'Corrected once',
            auto_fixable: true,
            location: { start: 8, end: 18 },
          }],
          summary: 'A configured violation remains under review.',
          corrected_text: appliedText,
          revision_compliance: {
            approved: false,
            remaining_issue_count: 1,
          },
          engine_used: 'RULE_BASED_FALLBACK',
          visual_validation: { supported: false, message: 'Not validated.' },
          readability: {
            reading_ease: 80,
            grade_level: 5,
            sentence_count: 1,
            reading_time_sec: 1,
          },
        },
      });
    }
    if (request.url.endsWith('/api/analysis/apply-corrections/33')) {
      return response({
        success: true,
        new_version: 2,
        applied_text: appliedText,
        correction_review: {
          remaining_issue_count: 0,
          remaining_critical_issue_count: 1,
          compliant: false,
        },
        result: {
          score: 40,
          risk_level: 'CRITICAL',
          issues: [{
            id: 'remaining',
            category: 'Terminology',
            severity: 'CRITICAL',
            matched_text: 'Corrected',
          }],
          corrected_text: 'Corrected twice',
        },
      });
    }
    return response({ success: false, error: 'Unexpected request' }, 404);
  };

  await act(async () => {
    root.render(React.createElement(Component, {
      brandId: 7,
      brandName: 'Revision Test Brand',
    }));
    await flush();
  });
  const editor = container.querySelector('textarea');
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  ).set;
  await act(async () => {
    valueSetter.call(editor, sourceText);
    editor.dispatchEvent(new window.Event('input', { bubbles: true }));
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Audit Content'))
      .click();
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Diff & Changes'))
      .click();
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Adopt All Corrections'))
      .click();
    await flush();
  });

  const textBlocks = Array.from(container.querySelectorAll('.whitespace-pre-wrap'))
    .map((element) => element.textContent);
  assert.ok(textBlocks.includes(sourceText));
  assert.ok(textBlocks.includes(appliedText));
  assert.doesNotMatch(container.textContent, /Corrected twice/);
  assert.match(container.textContent, /Needs Review/);
  assert.doesNotMatch(container.textContent, /Compliance Approved/);
  assert.equal(requests.filter((request) =>
    request.url.endsWith('/api/analysis/audit')).length, 1);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3600));
  });
});

test('ContentAnalyzer shows per-issue actions and hides them after a stale-version check', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/pages/ContentAnalyzer.jsx',
  );
  const sourceText = 'alpha beta omega tail';
  const calls = [];
  let contentDetailReads = 0;
  const issues = [
    {
      id: 'first',
      category: 'Terminology',
      severity: 'WARNING',
      rule: 'First actionable finding',
      matched_text: 'alpha',
      suggestion: 'first',
      replacement_text: 'first',
      auto_fixable: true,
      location: { start: 0, end: 5 },
    },
    {
      id: 'manual',
      category: 'Fact Accuracy',
      severity: 'WARNING',
      rule: 'Manual-review finding',
      matched_text: 'beta',
      suggestion: 'Verify the supporting evidence.',
      replacement_text: null,
      auto_fixable: false,
      manual_review_required: true,
      location: { start: 6, end: 10 },
    },
    {
      id: 'middle',
      category: 'Voice & Tone',
      severity: 'WARNING',
      rule: 'Middle actionable finding',
      matched_text: 'omega',
      suggestion: 'middle',
      replacement_text: 'middle',
      auto_fixable: true,
      location: { start: 11, end: 16 },
    },
  ];
  const conflictOptions = [
    {
      issue_id: 'conflict-1',
      rule: 'Alternative one',
      replacement_text: 'affordable',
    },
    {
      issue_id: 'conflict-2',
      rule: 'Alternative two',
      replacement_text: 'budget-friendly',
    },
  ];
  issues.push(
    ...conflictOptions.map((option) => ({
      id: option.issue_id,
      category: 'Terminology',
      severity: 'WARNING',
      rule: option.rule,
      matched_text: 'beta',
      suggestion: option.replacement_text,
      replacement_text: option.replacement_text,
      auto_fixable: false,
      replacement_choice_required: true,
      manual_review_required: true,
      replacement_options: conflictOptions,
      location: { start: 6, end: 10 },
    })),
    {
      id: 'last',
      category: 'Compliance & Claims',
      severity: 'WARNING',
      rule: 'Last actionable finding',
      matched_text: 'tail',
      suggestion: 'final',
      replacement_text: 'final',
      auto_fixable: true,
      location: { start: 17, end: 21 },
    },
  );

  globalThis.fetch = async (url, options = {}) => {
    const request = {
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : null,
    };
    calls.push(request);
    if (request.url.includes('/api/content/71?')) {
      contentDetailReads += 1;
      return response({
        success: true,
        content: {
          id: 71,
          brand_id: 7,
          current_version: contentDetailReads === 1 ? 4 : 6,
        },
      });
    }
    if (request.url.endsWith('/api/analysis/audit')) {
      return response({
        success: true,
        content_id: 71,
        version: 5,
        status: 'pending_review',
        result: {
          score: 60,
          risk_level: 'MODERATE',
          sub_scores: {
            terminology: 60,
            facts: 60,
            tone: 60,
            claims: 60,
            accessibility: 60,
          },
          issues,
          summary: 'Several findings require review.',
          corrected_text: sourceText,
          engine_used: 'AI_GEMINI',
          readability: {
            reading_ease: 70,
            grade_level: 6,
            sentence_count: 1,
            reading_time_sec: 1,
          },
        },
      });
    }
    return response({ success: false, error: 'Unexpected request' }, 404);
  };

  await act(async () => {
    root.render(React.createElement(Component, {
      brandId: 7,
      brandName: 'Apply Test Brand',
      contentToEdit: {
        id: 71,
        title: 'Apply test content',
        content_type: 'Ad Copy',
        channel: 'Website',
        original_text: sourceText,
        current_version: 4,
        status: 'pending_review',
      },
    }));
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Audit Content'))
      .click();
    await flush();
  });

  const applyButtons = () => Array.from(container.querySelectorAll('button'))
    .filter((button) => button.textContent.trim() === 'Apply');
  let visibleApplyButtons = applyButtons();
  assert.equal(visibleApplyButtons.length, 5);
  assert.equal(
    visibleApplyButtons.filter((button) => !button.disabled).length,
    3,
  );

  await act(async () => {
    visibleApplyButtons.find((button) => !button.disabled).click();
    await flush();
  });
  assert.equal(
    calls.some((call) => call.url.includes('/api/analysis/apply-corrections/')),
    false,
  );
  assert.equal(applyButtons().length, 0);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3600));
  });
});

test('ContentAnalyzer sends one selected issue and its audited version for individual Apply', async (context) => {
  const { React, act, Component, container, root } = await createComponentHarness(
    context,
    '/src/pages/ContentAnalyzer.jsx',
  );
  const sourceText = 'alpha beta';
  const calls = [];
  let contentDetailReads = 0;
  const issues = [
    {
      id: 'first',
      category: 'Terminology',
      severity: 'WARNING',
      rule: 'First correction',
      matched_text: 'alpha',
      suggestion: 'one',
      replacement_text: 'one',
      auto_fixable: true,
      location: { start: 0, end: 5 },
    },
    {
      id: 'second',
      category: 'Voice & Tone',
      severity: 'WARNING',
      rule: 'Second correction',
      matched_text: 'beta',
      suggestion: 'two',
      replacement_text: 'two',
      auto_fixable: true,
      location: { start: 6, end: 10 },
    },
  ];

  globalThis.fetch = async (url, options = {}) => {
    const request = {
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : null,
    };
    calls.push(request);
    if (request.url.includes('/api/content/71?')) {
      contentDetailReads += 1;
      return response({
        success: true,
        content: {
          id: 71,
          brand_id: 7,
          current_version: contentDetailReads === 1 ? 4 : 5,
        },
      });
    }
    if (request.url.endsWith('/api/analysis/audit')) {
      return response({
        success: true,
        content_id: 71,
        version: 5,
        status: 'pending_review',
        result: {
          score: 70,
          risk_level: 'LOW',
          sub_scores: {},
          issues,
          summary: 'Two findings require correction.',
          corrected_text: sourceText,
          engine_used: 'RULE_BASED_FALLBACK',
          readability: {
            reading_ease: 70,
            grade_level: 6,
            sentence_count: 1,
            reading_time_sec: 1,
          },
        },
      });
    }
    if (request.url.endsWith('/api/analysis/apply-corrections/71')) {
      return response({
        success: true,
        new_version: 6,
        applied_text: 'alpha two',
        applied_issue_ids: ['second'],
        correction_review: { compliant: false },
        result: {
          score: 80,
          risk_level: 'LOW',
          sub_scores: {},
          issues: [issues[0]],
          summary: 'One finding remains.',
          corrected_text: 'alpha two',
          engine_used: 'RULE_BASED_FALLBACK',
          readability: {
            reading_ease: 70,
            grade_level: 6,
            sentence_count: 1,
            reading_time_sec: 1,
          },
        },
      });
    }
    return response({ success: false, error: 'Unexpected request' }, 404);
  };

  await act(async () => {
    root.render(React.createElement(Component, {
      brandId: 7,
      brandName: 'Apply Test Brand',
      contentToEdit: {
        id: 71,
        title: 'Version-bound Apply',
        content_type: 'Ad Copy',
        channel: 'Website',
        original_text: sourceText,
        current_version: 4,
        status: 'pending_review',
      },
    }));
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Audit Content'))
      .click();
    await flush();
  });

  const auditRequest = calls.find((call) => call.url.endsWith('/api/analysis/audit'));
  assert.equal(auditRequest.body.current_version, 4);
  const applyButtons = Array.from(container.querySelectorAll('button'))
    .filter((button) => button.textContent.trim() === 'Apply');
  assert.equal(applyButtons.length, 2);

  await act(async () => {
    applyButtons[1].click();
    await flush();
  });

  const applyRequest = calls.find((call) =>
    call.url.endsWith('/api/analysis/apply-corrections/71'));
  assert.deepEqual(applyRequest.body, {
    brand_id: 7,
    issue_ids: ['second'],
    content_version: 5,
    source_text: sourceText,
  });
  assert.equal(contentDetailReads, 2);
  assert.equal(container.textContent.includes('alpha two'), true);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3600));
  });
});

test('ContentAnalyzer previews an AI rewrite and saves it only after confirmation', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/pages/ContentAnalyzer.jsx',
  );
  const originalText = 'Existing version copy';
  const rewrittenText = 'Gemini rewrite preview';
  const calls = [];
  let allowSave = false;
  let confirmationCount = 0;
  window.confirm = () => {
    confirmationCount += 1;
    return allowSave;
  };
  globalThis.fetch = async (url, options = {}) => {
    const request = {
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : null,
    };
    calls.push(request);
    if (request.url.endsWith('/api/analysis/rewrite')) {
      return response({
        success: true,
        rewritten_text: rewrittenText,
        engine_used: 'AI_GEMINI',
        saved: false,
      });
    }
    if (request.url.includes('/api/content/71?')) {
      return response({
        success: true,
        content: { id: 71, brand_id: 7, current_version: 3 },
      });
    }
    if (request.url.endsWith('/api/analysis/audit')) {
      return response({
        success: true,
        content_id: 71,
        version: 4,
        status: 'pending_review',
        result: {
          score: 100,
          risk_level: 'LOW',
          sub_scores: {
            terminology: 100,
            facts: 100,
            tone: 100,
            claims: 100,
            accessibility: 100,
          },
          issues: [],
          summary: 'No configured issues.',
          corrected_text: rewrittenText,
          engine_used: 'RULE_BASED_FALLBACK',
          visual_validation: { supported: false, message: 'Not validated.' },
          readability: {
            reading_ease: 80,
            grade_level: 5,
            sentence_count: 1,
            reading_time_sec: 1,
          },
        },
      });
    }
    return response({ success: false, error: 'Unexpected request' }, 404);
  };

  await act(async () => {
    root.render(React.createElement(Component, {
      brandId: 7,
      brandName: 'Rewrite Test Brand',
      contentToEdit: {
        id: 71,
        title: 'Existing content',
        content_type: 'Ad Copy',
        channel: 'Website',
        original_text: originalText,
        current_version: 3,
        status: 'pending_review',
      },
    }));
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('AI Rewrite'))
      .click();
    await flush();
  });

  const rewriteCall = calls.find((call) => call.url.endsWith('/api/analysis/rewrite'));
  assert.deepEqual(rewriteCall.body, {
    brand_id: 7,
    text: originalText,
    content_type: 'Ad Copy',
    channel: 'Website',
  });
  assert.equal(container.querySelector('textarea').value, originalText);
  assert.match(container.textContent, /Gemini rewrite preview/);
  assert.match(container.textContent, /original content remains unchanged until you save/i);
  assert.equal(calls.some((call) => call.url.endsWith('/api/analysis/audit')), false);

  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Save as New Version'))
      .click();
    await flush();
  });
  assert.equal(confirmationCount, 1);
  assert.equal(calls.some((call) => call.url.endsWith('/api/analysis/audit')), false);
  assert.equal(container.querySelector('textarea').value, originalText);

  allowSave = true;
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Save as New Version'))
      .click();
    await flush();
  });

  const auditCall = calls.find((call) => call.url.endsWith('/api/analysis/audit'));
  assert.equal(confirmationCount, 2);
  assert.equal(auditCall.body.content_id, 71);
  assert.equal(auditCall.body.current_version, 3);
  assert.equal(auditCall.body.brand_id, 7);
  assert.equal(auditCall.body.text, rewrittenText);
  assert.equal(container.querySelector('textarea').value, rewrittenText);
  assert.match(container.textContent, /\(v4\)/);
  assert.doesNotMatch(container.textContent, /AI Rewrite Preview/);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3600));
  });
});

test('ContentAnalyzer shows AI rewrite loading and error states', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/pages/ContentAnalyzer.jsx',
  );
  const requests = deferredFetch();

  await act(async () => {
    root.render(React.createElement(Component, {
      brandId: 7,
      brandName: 'Rewrite Test Brand',
    }));
    await flush();
  });
  const editor = container.querySelector('textarea');
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  ).set;
  await act(async () => {
    valueSetter.call(editor, 'Content to rewrite');
    editor.dispatchEvent(new window.Event('input', { bubbles: true }));
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('AI Rewrite'))
      .click();
    await flush();
  });

  assert.match(container.textContent, /Generating AI rewrite\.\.\./);
  await act(async () => {
    requests[0].resolve(response({
      success: false,
      error: 'Gemini rewrite is unavailable.',
    }, 503));
    await flush();
  });
  assert.equal(container.querySelector('[role="alert"]')?.textContent, 'Gemini rewrite is unavailable.');
  assert.match(container.textContent, /AI Rewrite/);
});

test('ContentAnalyzer approves manual edits into the preview and saves only as a new version', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/pages/ContentAnalyzer.jsx',
  );
  const sourceText = 'Our product cures diseases.';
  const correctedText = 'Our product supports healthy habits.';
  const issue = {
    id: 'manual-medical-claim',
    category: 'Compliance & Claims',
    severity: 'CRITICAL',
    rule: 'Unsupported Medical Claims',
    matched_text: 'cures diseases',
    suggestion: 'supports wellness',
    replacement_text: null,
    explanation: 'Medical claims require human review.',
    auto_fixable: false,
    manual_review_required: true,
    location: { start: 12, end: 26 },
  };
  const calls = [];
  let auditCount = 0;
  let persistedText = sourceText;
  let persistedVersion = 0;
  window.confirm = () => true;
  globalThis.fetch = async (url, options = {}) => {
    const request = {
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : null,
    };
    calls.push(request);
    if (request.url.endsWith('/api/analysis/audit')) {
      auditCount += 1;
      persistedText = request.body.text;
      persistedVersion = auditCount;
      return response({
        success: true,
        content_id: 71,
        version: persistedVersion,
        status: 'pending_review',
        result: {
          score: 60,
          risk_level: 'CRITICAL',
          sub_scores: {},
          issues: auditCount === 1 ? [issue] : [],
          summary: 'Manual review is required.',
          corrected_text: request.body.text,
          engine_used: 'RULE_BASED_FALLBACK',
          readability: {
            reading_ease: 70,
            grade_level: 6,
            sentence_count: 1,
            reading_time_sec: 1,
          },
        },
      });
    }
    if (request.url.includes('/api/content/71?')) {
      return response({
        success: true,
        content: {
          id: 71,
          brand_id: 7,
          current_version: persistedVersion,
          original_text: persistedText,
        },
        versions: [{ id: 501, version_number: persistedVersion }],
      });
    }
    if (request.url.endsWith('/api/analysis/manual-corrections')) {
      return response({
        success: true,
        content_id: 71,
        current_version_id: 501,
        preview_state: {
          corrected_text: correctedText,
          correction_count: 1,
          manual_review_required: true,
          compliance_approved: false,
        },
      });
    }
    if (request.url.includes('/api/analysis/manual-corrections/71')) {
      return response({ success: true });
    }
    return response({ success: false, error: 'Unexpected request' }, 404);
  };

  await act(async () => {
    root.render(React.createElement(Component, {
      brandId: 7,
      brandName: 'Manual Review Test Brand',
    }));
    await flush();
  });
  const contentEditor = container.querySelector('textarea');
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  ).set;
  await act(async () => {
    valueSetter.call(contentEditor, sourceText);
    contentEditor.dispatchEvent(new window.Event('input', { bubbles: true }));
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Audit Content'))
      .click();
    await flush();
  });

  assert.ok(Array.from(container.querySelectorAll('button'))
    .some((button) => button.textContent.includes('Review & Edit')));
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Review & Edit'))
      .click();
    await flush();
  });
  const emptyCorrectionEditor = container.querySelector(
    'textarea[aria-label="Your correction"]',
  );
  await act(async () => {
    valueSetter.call(emptyCorrectionEditor, '');
    emptyCorrectionEditor.dispatchEvent(new window.Event('input', { bubbles: true }));
    await flush();
  });
  assert.equal(
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Approve Correction')).disabled,
    true,
  );
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.trim() === 'Cancel')
      .click();
    await flush();
  });
  assert.equal(
    calls.some((call) => call.url.endsWith('/api/analysis/manual-corrections')),
    false,
  );

  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Review & Edit'))
      .click();
    await flush();
  });
  const correctionEditor = container.querySelector(
    'textarea[aria-label="Your correction"]',
  );
  await act(async () => {
    valueSetter.call(correctionEditor, 'supports healthy habits');
    correctionEditor.dispatchEvent(new window.Event('input', { bubbles: true }));
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Approve Correction'))
      .click();
    await flush();
  });

  const correctionCall = calls.find((call) =>
    call.url.endsWith('/api/analysis/manual-corrections'));
  assert.deepEqual(correctionCall.body, {
    content_id: 71,
    brand_id: 7,
    current_version_id: 501,
    issue_id: issue.id,
    original_text: issue.matched_text,
    replacement_text: 'supports healthy habits',
    source_text: sourceText,
    source_start: 12,
    source_end: 26,
  });
  assert.equal(persistedText, sourceText);
  assert.equal(persistedVersion, 1);
  assert.equal(container.querySelector('textarea').value, sourceText);
  assert.match(container.textContent, /Our product supports healthy habits\./);
  assert.match(container.textContent, /not compliance-approved or saved yet/i);
  assert.equal(auditCount, 1);

  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Save as New Version'))
      .click();
    await flush();
  });
  const saveCall = calls.filter((call) =>
    call.url.endsWith('/api/analysis/audit'))[1];
  assert.equal(saveCall.body.content_id, 71);
  assert.equal(saveCall.body.current_version, 1);
  assert.equal(saveCall.body.text, correctedText);
  assert.equal(persistedText, correctedText);
  assert.equal(persistedVersion, 2);
  assert.equal(container.querySelector('textarea').value, correctedText);
  assert.equal(auditCount, 2);
  assert.ok(calls.some((call) => (
    call.url.includes('/api/analysis/manual-corrections/71')
    && call.method === 'DELETE'
  )));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3600));
  });
});

test('ContentAnalyzer rejects manual approval when the audited version is stale', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/pages/ContentAnalyzer.jsx',
  );
  const sourceText = 'Our product cures diseases.';
  const issue = {
    id: 'manual-medical-claim',
    category: 'Compliance & Claims',
    severity: 'CRITICAL',
    rule: 'Unsupported Medical Claims',
    matched_text: 'cures diseases',
    suggestion: 'supports wellness',
    auto_fixable: false,
    manual_review_required: true,
    location: { start: 12, end: 26 },
  };
  const calls = [];
  let contentDetailReads = 0;
  globalThis.fetch = async (url, options = {}) => {
    const request = {
      url: String(url),
      method: options.method || 'GET',
      body: options.body ? JSON.parse(options.body) : null,
    };
    calls.push(request);
    if (request.url.includes('/api/analysis/manual-corrections/71')) {
      return response({
        success: true,
        current_version_id: 501,
        preview_state: {
          corrected_text: sourceText,
          correction_count: 0,
          corrections: [],
        },
      });
    }
    if (request.url.includes('/api/content/71?')) {
      contentDetailReads += 1;
      return response({
        success: true,
        content: {
          id: 71,
          brand_id: 7,
          current_version: contentDetailReads === 1 ? 1 : 3,
        },
      });
    }
    if (request.url.endsWith('/api/analysis/audit')) {
      return response({
        success: true,
        content_id: 71,
        version: 2,
        status: 'pending_review',
        result: {
          score: 60,
          risk_level: 'CRITICAL',
          sub_scores: {},
          issues: [issue],
          summary: 'Manual review is required.',
          corrected_text: sourceText,
          engine_used: 'RULE_BASED_FALLBACK',
          readability: {
            reading_ease: 70,
            grade_level: 6,
            sentence_count: 1,
            reading_time_sec: 1,
          },
        },
      });
    }
    return response({ success: false, error: 'Unexpected request' }, 404);
  };

  await act(async () => {
    root.render(React.createElement(Component, {
      brandId: 7,
      brandName: 'Manual Review Test Brand',
      contentToEdit: {
        id: 71,
        title: 'Stale manual correction',
        content_type: 'Ad Copy',
        channel: 'Website',
        original_text: sourceText,
        current_version: 1,
      },
    }));
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Audit Content'))
      .click();
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Review & Edit'))
      .click();
    await flush();
  });
  const correctionEditor = container.querySelector(
    'textarea[aria-label="Your correction"]',
  );
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  ).set;
  await act(async () => {
    valueSetter.call(correctionEditor, 'supports wellness');
    correctionEditor.dispatchEvent(new window.Event('input', { bubbles: true }));
    await flush();
  });
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Approve Correction'))
      .click();
    await flush();
  });

  assert.equal(
    calls.some((call) => call.url.endsWith('/api/analysis/manual-corrections')),
    false,
  );
  assert.match(container.textContent, /audited content version is stale/i);
  assert.equal(
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Approve Correction')).disabled,
    true,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3600));
  });
});

test('App reports brand-load failures instead of showing an empty-brand state', async (context) => {
  const { React, act, Component, container, root } = await createComponentHarness(
    context,
    '/src/App.jsx',
  );
  let brandRequestCount = 0;
  let completeRetry;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/api/brands')) {
      brandRequestCount += 1;
      if (brandRequestCount > 1) {
        return new Promise((resolve) => {
          completeRetry = () => resolve(response({
            success: false,
            error: 'Brand service unavailable',
          }, 503));
        });
      }
      return response({ success: false, error: 'Brand service unavailable' }, 503);
    }
    return response({
      success: true,
      ai_configured: false,
      active_engine: 'Rule-Based Fallback',
      mode: 'Rule-Based Fallback',
    });
  };

  await act(async () => {
    root.render(React.createElement(Component));
    await flush();
    await flush();
  });
  assert.match(container.textContent, /Brand service unavailable/);
  assert.doesNotMatch(container.textContent, /Create your first brand/);
  assert.ok(
    Array.from(container.querySelectorAll('button')).some((button) => button.textContent.includes('Retry')),
  );
  await act(async () => {
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('Retry'))
      .click();
    await Promise.resolve();
  });
  assert.match(container.textContent, /Loading BrandGuard AI/);
  assert.doesNotMatch(container.textContent, /Create your first brand/);
  await act(async () => {
    completeRetry();
    await flush();
  });
  assert.match(container.textContent, /Brand service unavailable/);
});

test('App explains how brands support content audits when no brands exist', async (context) => {
  const { React, act, Component, container, root } = await createComponentHarness(
    context,
    '/src/App.jsx',
  );
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/api/brands')) {
      return response({ success: true, brands: [] });
    }
    return response({
      success: true,
      ai_configured: false,
      active_engine: 'Rule-Based Fallback',
      mode: 'Rule-Based Fallback',
    });
  };

  await act(async () => {
    root.render(React.createElement(Component));
    await flush();
    await flush();
  });
  assert.match(
    container.textContent,
    /A brand defines the facts, tone and rules used to audit your content\./,
  );
});

test('Header exposes the existing New Scan action in its compact mobile control', async (context) => {
  const { React, act, Component, container, root } = await createComponentHarness(
    context,
    '/src/components/Header.jsx',
  );
  let newScanCount = 0;
  await act(async () => {
    root.render(React.createElement(Component, {
      brands: [{ id: 7, name: 'Test Brand' }],
      selectedBrandId: 7,
      onNewScan: () => { newScanCount += 1; },
    }));
    await flush();
  });

  const newScanButton = container.querySelector('button[aria-label="New Scan"]');
  assert.ok(newScanButton);
  assert.ok(Array.from(newScanButton.querySelectorAll('span')).some(
    (span) => span.className.includes('sm:hidden') && span.textContent === 'Scan',
  ));
  await act(async () => {
    newScanButton.click();
    await flush();
  });
  assert.equal(newScanCount, 1);
});

test('ReviewHistory surfaces report-export API failures', async (context) => {
  const { React, act, Component, container, root } = await createComponentHarness(
    context,
    '/src/pages/ReviewHistory.jsx',
  );
  globalThis.fetch = async (url) => {
    if (String(url).includes('/api/content?')) {
      return response({ success: true, items: [contentItem(2, 'Export failure report')] });
    }
    return response({ success: false, error: 'Report service unavailable' }, 503);
  };

  await act(async () => {
    root.render(React.createElement(Component, { brandId: 2 }));
    await flush();
  });
  await act(async () => {
    container.querySelector('[title="Download JSON Report"]').click();
    await flush();
  });
  assert.match(container.textContent, /Report service unavailable/);
  assert.equal(container.querySelector('[role="alert"]')?.textContent, 'Report service unavailable');
});

test('ContentAnalyzer reviews image uploads separately from saved text content', async (context) => {
  const { React, act, Component, container, root, window } = await createComponentHarness(
    context,
    '/src/pages/ContentAnalyzer.jsx',
  );
  const originalFormData = globalThis.FormData;
  const formValues = new Map();
  globalThis.FormData = class TestFormData {
    append(name, value) {
      formValues.set(name, value);
    }

    get(name) {
      return formValues.get(name);
    }
  };
  context.after(() => {
    globalThis.FormData = originalFormData;
  });

  let request;
  globalThis.fetch = async (url, options = {}) => {
    request = { url: String(url), options };
    return response({
      success: true,
      filename: 'creative.png',
      saved: false,
      visual_validation: {
        supported: true,
        message: 'Preliminary review; manual verification required.',
        checks: [{
          id: 'forbidden_colors',
          rule: 'Obvious use of configured forbidden colors',
          status: 'concern',
          severity: 'high',
          explanation: 'A prominent red background is visible.',
          evidence: 'A prominent red background is visible.',
          recommendation: 'Replace the background with an approved brand color.',
          confidence: 'medium',
          manual_review_required: true,
        }],
        not_evaluated: [{
          rule: 'Exact brand color values',
          reason: 'Pixel-level color matching is not verified.',
        }],
      },
    });
  };

  await act(async () => {
    root.render(React.createElement(Component, {
      brandId: 7,
      brandName: 'Visual Test Brand',
    }));
    await flush();
  });
  const input = container.querySelector('input[type="file"]');
  const image = new window.File(
    [new Uint8Array([137, 80, 78, 71])],
    'creative.png',
    { type: 'image/png' },
  );
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [image],
  });

  await act(async () => {
    input.dispatchEvent(new window.Event('change', { bubbles: true }));
    await flush();
  });

  assert.equal(request.url.endsWith('/api/analysis/visual-check'), true);
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.body.get('brand_id'), '7');
  assert.equal(request.options.body.get('file').name, 'creative.png');
  assert.equal(container.querySelector('textarea').value, '');
  assert.match(container.textContent, /Visual Brand Review/);
  assert.match(container.textContent, /A prominent red background is visible/);
  assert.match(container.textContent, /high severity/);
  assert.match(container.textContent, /Replace the background with an approved brand color/);
  assert.match(container.textContent, /Exact brand color values/);
  assert.match(container.textContent, /manual review required/i);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 3600));
  });
});
