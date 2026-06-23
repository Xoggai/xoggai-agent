const DEFAULT_XOGGAI_API = 'https://xoggai-backend.onrender.com';

export async function routeIntent(intent, options = {}) {
  const baseUrl = options.baseUrl || DEFAULT_XOGGAI_API;
  const budget = options.budget ?? 0.005;
  const url = new URL('/intent', baseUrl);
  url.searchParams.set('q', intent);
  url.searchParams.set('budget', String(budget));
  url.searchParams.set('dry', 'true');

  const response = await fetch(url, {
    headers: { accept: 'application/json' },
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok || body.success === false) {
    throw new Error(
      `XoggAI route failed: ${response.status} ${body.error || response.statusText}`,
    );
  }

  return body;
}

export async function searchEndpoints(query, options = {}) {
  const baseUrl = options.baseUrl || DEFAULT_XOGGAI_API;
  const limit = options.limit ?? 5;
  const url = new URL('/search', baseUrl);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('dry', 'true');

  const response = await fetch(url, {
    headers: { accept: 'application/json' },
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok || body.success === false) {
    throw new Error(
      `XoggAI search failed: ${response.status} ${body.error || response.statusText}`,
    );
  }

  return body;
}

export async function executionStatus(options = {}) {
  const baseUrl = options.baseUrl || DEFAULT_XOGGAI_API;
  const response = await fetch(new URL('/api/execution-status', baseUrl), {
    headers: { accept: 'application/json' },
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok || body.success === false) {
    throw new Error(
      `XoggAI status failed: ${response.status} ${body.error || response.statusText}`,
    );
  }

  return body;
}
