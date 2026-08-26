import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const PORT = 3333;
const root = process.cwd();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  let reqPath = new URL(req.url, `http://localhost:${PORT}`).pathname;
  if (reqPath === '/' || reqPath === '/sandbox' || reqPath === '/dev') reqPath = '/sandbox/index.html';

  const filePath = join(root, reqPath);
  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`404 Not Found: ${reqPath}`);
    return;
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const data = readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    res.end(data);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`500 Internal Server Error: ${err.message}`);
  }
});

server.listen(PORT, () => {
  console.log('------------------------------------------------------------');
  console.log(`🚀 Schema DevTools Local Sandbox running at:`);
  console.log(`   👉 http://localhost:${PORT}`);
  console.log('------------------------------------------------------------');
  console.log('Press Ctrl+C to stop.');
});
