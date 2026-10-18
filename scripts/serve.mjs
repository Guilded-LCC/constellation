import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

// Serve the interface only. Auth, messages, and all application data go
// directly from the browser to Supabase. This process never writes a file.
const port = 8766;
const root = new URL('../static/', import.meta.url);
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/config.js', ['config.js', 'text/javascript; charset=utf-8']],
  ['/guilded.js', ['guilded.js', 'text/javascript; charset=utf-8']],
  ['/settings-ui.js', ['settings-ui.js', 'text/javascript; charset=utf-8']],
  ['/staff-panel.js', ['staff-panel.js', 'text/javascript; charset=utf-8']],
  ['/staff-panel.css', ['staff-panel.css', 'text/css; charset=utf-8']],
  ['/staff-mobile.css', ['staff-mobile.css', 'text/css; charset=utf-8']],
  ['/guilded-reference.css', ['guilded-reference.css', 'text/css; charset=utf-8']],
  ['/settings.css', ['settings.css', 'text/css; charset=utf-8']],
  ['/tokens.css', ['tokens.css', 'text/css; charset=utf-8']],
  ['/guilded.css', ['guilded.css', 'text/css; charset=utf-8']]
]);
const server = createServer(async (request, response) => {
  const headers = {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self' https://hyongvpfhikiibgdlkgw.supabase.co wss://hyongvpfhikiibgdlkgw.supabase.co; img-src 'self' data: blob: https://hyongvpfhikiibgdlkgw.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  };
  if (!['localhost:8766', '127.0.0.1:8766'].includes(request.headers.host)) {
    response.writeHead(403, headers).end('Invalid host'); return;
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { ...headers, Allow: 'GET, HEAD' }).end(); return;
  }
  const pathname = new URL(request.url, 'http://localhost:8766').pathname;
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
