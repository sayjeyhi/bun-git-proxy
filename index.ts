// proxy.ts
// Bun server that proxies requests like: http://localhost:3000/{domain}/{path?}{?query}
// Example: http://localhost:3000/raw.githubusercontent.com/user/repo/main/README.md

const ALLOW_HEADERS = [
  'accept-encoding',
  'accept-language',
  'accept',
  'access-control-allow-origin',
  'authorization',
  'cache-control',
  'connection',
  'content-length',
  'content-type',
  'dnt',
  'pragma',
  'range',
  'referer',
  'user-agent',
  'x-authorization',
  'x-http-method-override',
  'x-requested-with',
] as const;

const EXPOSE_HEADERS = [
  'accept-ranges',
  'age',
  'cache-control',
  'content-length',
  'content-language',
  'content-type',
  'date',
  'etag',
  'expires',
  'last-modified',
  'pragma',
  'server',
  'transfer-encoding',
  'vary',
  'x-github-request-id',
  'x-redirected-url',
] as const;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': ALLOW_HEADERS.join(', '),
    'Access-Control-Expose-Headers': EXPOSE_HEADERS.join(', '),
    'Access-Control-Max-Age': '86400',
  } as Record<string, string>;
}

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  });
}

async function handleProxyRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\//, ''); // drop leading "/"

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders() });
  }

  if (!path) {
    return json({ error: 'Invalid proxy URL format' }, { status: 400 });
  }

  // Extract: first segment is domain; rest is path
  const parts = path.match(/([^\/]+)\/?(.*)/);
  if (!parts) {
    return json({ error: 'Invalid path format' }, { status: 400 });
  }

  const domain = parts[1];
  const remainingPath = parts[2] || '';
  const targetURL = `https://${domain}/${remainingPath}${url.search}`;

  console.log('[proxy] →', request.method, targetURL);

  // Prepare headers: only forward allowed ones
  const fwdHeaders = new Headers();
  for (const h of ALLOW_HEADERS) {
    const v = request.headers.get(h);
    if (v != null) fwdHeaders.set(h, v);
  }

  // NOTE: Fetch forbids setting "Host" (a forbidden header). Some runtimes strip it.
  // We'll add X-Forwarded-* instead (many backends rely on these).
  fwdHeaders.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
  fwdHeaders.set('X-Forwarded-For', request.headers.get('x-forwarded-for') ?? '0.0.0.0');
  fwdHeaders.set('X-Forwarded-Host', url.host);

  // Ensure a useful UA if none or not a git UA
  const ua = fwdHeaders.get('user-agent');
  if (!ua || !/^git\//i.test(ua)) {
    fwdHeaders.set('User-Agent', 'git/@isomorphic-git/cors-proxy (bun)');
  }

  const init: RequestInit = {
    method: request.method,
    headers: fwdHeaders,
    redirect: 'follow',
  };

  // Forward body for non-GET/HEAD
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    // Bun supports streaming bodies; pass-through is fine
    init.body = request.body;
    // `duplex` is not required in Bun
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetURL, init);
  } catch (err) {
    console.error('[proxy] fetch error:', err);
    return json(
      {
        error: 'Proxy error',
        message: err instanceof Error ? err.message : 'Unknown error',
        url: targetURL,
      },
      { status: 500 },
    );
  }

  console.log('[proxy] ←', upstream.status, upstream.statusText);

  // Build response headers with CORS + selected upstream headers
  const outHeaders = new Headers(corsHeaders());

  for (const h of EXPOSE_HEADERS) {
    if (h === 'content-length') continue; // let Response determine it for streamed bodies
    const v = upstream.headers.get(h);
    if (v != null) outHeaders.set(h, v);
  }

  if (upstream.redirected) {
    outHeaders.set('x-redirected-url', upstream.url);
  }

  // Stream the upstream body back to the client
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}

// ---- Start Bun server ----
const PORT = Number(process.env.PORT ?? 3000);

Bun.serve({
  port: PORT,
  fetch: async (request) => {
    try {
      return await handleProxyRequest(request);
    } catch (err) {
      console.error('[proxy] fatal:', err);
      return json(
        {
          error: 'Proxy error',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
        { status: 500 },
      );
    }
  },
});

console.log(`🦊 Bun proxy listening on http://localhost:${PORT}`);

