import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

// Serve the interface only. Auth, messages, and all application data go
// directly from the browser to Supabase. This process never writes a file.
const port = 8766;
const root = new URL('../static/', import.meta.url);
const LIMIT = 12 * 1024 * 1024;
const allowedOrigins = new Set(['http://localhost:8766', 'http://127.0.0.1:8766']);

async function loadEnv() {
  try {
    const raw = await readFile(new URL('../.env', import.meta.url), 'utf8');
    const values = {};
    for (const line of raw.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
        value = value.slice(1, -1);
      values[match[1]] = value;
    }
    return values;
  } catch {
    return {};
  }
}

const env = await loadEnv();
const removeBgKey = process.env.REMOVE_BG_API_KEY || env.REMOVE_BG_API_KEY || '';

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/config.js', ['config.js', 'text/javascript; charset=utf-8']],
  ['/constellation.js', ['constellation.js', 'text/javascript; charset=utf-8']],
  ['/settings-ui.js', ['settings-ui.js', 'text/javascript; charset=utf-8']],
  ['/staff-panel.js', ['staff-panel.js', 'text/javascript; charset=utf-8']],
  ['/staff-panel.css', ['staff-panel.css', 'text/css; charset=utf-8']],
  ['/staff-mobile.css', ['staff-mobile.css', 'text/css; charset=utf-8']],
  ['/constellation-reference.css', ['constellation-reference.css', 'text/css; charset=utf-8']],
  ['/message-relations.css', ['message-relations.css', 'text/css; charset=utf-8']],
  ['/settings.css', ['settings.css', 'text/css; charset=utf-8']],
  ['/tokens.css', ['tokens.css', 'text/css; charset=utf-8']],
  ['/constellation.css', ['constellation.css', 'text/css; charset=utf-8']],
  ['/fonts/inter-latin.woff2', ['fonts/inter-latin.woff2', 'font/woff2']]
]);

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function readBody(request, limit = LIMIT) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw httpError(413, 'That image is too large. Use one under 12MB.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function blockedHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (['localhost', '0.0.0.0'].includes(host) || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal'))
    return true;
  if (host.includes(':')) return true;
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  return (
    a === 10 || a === 127 || a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

async function fetchRemoteImage(rawUrl) {
  let target;
  try {
    target = new URL(String(rawUrl));
  } catch {
    throw httpError(400, 'Enter a valid image URL.');
  }
  for (let hop = 0; hop < 4; hop += 1) {
    if (!['http:', 'https:'].includes(target.protocol)) throw httpError(400, 'Only http and https image URLs are supported.');
    if (blockedHost(target.hostname)) throw httpError(400, 'That image host is not allowed.');
    const response = await fetch(target, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'Constellation icon importer' }
    }).catch(() => {
      throw httpError(502, 'Could not reach that image URL.');
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw httpError(502, 'That image URL redirected without a destination.');
      target = new URL(location, target);
      continue;
    }
    if (!response.ok) throw httpError(502, `The image host returned ${response.status}.`);
    const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/')) throw httpError(415, 'That URL does not point to an image.');
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > LIMIT) throw httpError(413, 'That image is too large. Use one under 12MB.');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > LIMIT) throw httpError(413, 'That image is too large. Use one under 12MB.');
    if (!buffer.length) throw httpError(502, 'That image URL returned an empty file.');
    return { buffer, contentType };
  }
  throw httpError(502, 'That image URL redirected too many times.');
}

async function removeBackground(buffer, contentType) {
  if (!removeBgKey) throw httpError(503, 'Background removal is not configured on this server.');
  const form = new FormData();
  form.append('image_file', new Blob([buffer], { type: contentType || 'image/png' }), 'image.png');
  form.append('size', 'auto');
  form.append('format', 'png');
  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': removeBgKey },
    body: form,
    signal: AbortSignal.timeout(60000)
  }).catch(() => {
    throw httpError(502, 'Could not reach the background removal service.');
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    let message = 'The background removal service could not process that image.';
    try {
      const parsed = JSON.parse(bytes.toString('utf8'));
      message = parsed?.errors?.[0]?.title || message;
    } catch {}
    throw httpError(response.status === 402 ? 402 : 502, message);
  }
  return { buffer: bytes, contentType: 'image/png' };
}

const server = createServer(async (request, response) => {
  const headers = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data: blob: https://*.supabase.co https://imglink.cc https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  };
  if (!['localhost:8766', '127.0.0.1:8766'].includes(request.headers.host)) {
    response.writeHead(403, headers).end('Invalid host'); return;
  }
  const url = new URL(request.url, 'http://localhost:8766');
  const pathname = url.pathname;

  if (request.method === 'POST' && pathname === '/api/image-tools') {
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      response.writeHead(403, { ...headers, 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Origin not allowed.' }));
      return;
    }
    try {
      const action = url.searchParams.get('action');
      if (action === 'remove-bg') {
        const contentType = String(request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        if (!contentType.startsWith('image/')) throw httpError(415, 'Send an image file to remove its background.');
        const buffer = await readBody(request);
        if (!buffer.length) throw httpError(400, 'The image is empty.');
        const result = await removeBackground(buffer, contentType);
        response.writeHead(200, { ...headers, 'Content-Type': result.contentType, 'Content-Length': result.buffer.length });
        response.end(result.buffer);
        return;
      }
      if (action === 'import') {
        const raw = (await readBody(request, 8192)).toString('utf8');
        let body;
        try { body = JSON.parse(raw || '{}'); } catch { throw httpError(400, 'Send a JSON body with an image URL.'); }
        if (typeof body.url !== 'string' || !body.url.trim()) throw httpError(400, 'Enter an image URL.');
        const result = await fetchRemoteImage(body.url.trim());
        response.writeHead(200, { ...headers, 'Content-Type': result.contentType, 'Content-Length': result.buffer.length });
        response.end(result.buffer);
        return;
      }
      throw httpError(404, 'Unknown image action.');
    } catch (error) {
      if (!error.status) console.error('[Constellation image tools]', error);
      const status = error.status || 500;
      const message = error.status ? error.message : 'The image service failed. Please try again.';
      response.writeHead(status, { ...headers, 'Content-Type': 'application/json' }).end(JSON.stringify({ error: message }));
      return;
    }
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { ...headers, Allow: 'GET, HEAD' }).end(); return;
  }
  // Static artwork lives in /assets. Only flat, known extensions are served.
  const assetFile = pathname.match(/^\/assets\/([A-Za-z0-9._-]+)$/);
  if (assetFile) {
    const types = { png: 'image/png', svg: 'image/svg+xml', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif' };
    const type = types[assetFile[1].split('.').pop().toLowerCase()];
    if (!type) { response.writeHead(404, headers).end('Not found'); return; }
    try {
      const body = await readFile(new URL(`assets/${assetFile[1]}`, root));
      response.writeHead(200, { ...headers, 'Content-Type': type, 'Content-Length': body.length, 'Cache-Control': 'public, max-age=3600' });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(404, headers).end('Not found');
    }
    return;
  }
  const asset = files.get(pathname) || (pathname === '/admin' ? files.get('/') : null);
  if (!asset) { response.writeHead(404, headers).end('Not found'); return; }
  try {
    const body = await readFile(new URL(asset[0], root));
    response.writeHead(200, { ...headers, 'Content-Type': asset[1], 'Content-Length': body.length });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(500, headers).end('Unable to load the interface');
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? 'Port 8766 is already in use.' : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log('Constellation: http://localhost:8766 — data stored in Supabase'));
