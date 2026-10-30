const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const root = __dirname;
const dataDirectory = path.join(root, 'data');
const dataPath = path.join(dataDirectory, 'factoryflow.json');
const seedPath = path.join(dataDirectory, 'seed.json');
const port = Number(process.env.PORT || 4173);
const staticTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

function ensureDataStore() {
  fs.mkdirSync(dataDirectory, { recursive: true });
  if (!fs.existsSync(dataPath)) fs.copyFileSync(seedPath, dataPath);
}

function readStore() {
  ensureDataStore();
  const stored = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  return {
    workspace: stored.workspace || { name: 'Northstar Works', cluster: 'Packaging', locale: 'en-IN' },
    quotes: list(stored.quotes),
    jobs: list(stored.jobs),
    purchases: list(stored.purchases),
    materials: list(stored.materials),
    deliveries: list(stored.deliveries),
    receipts: list(stored.receipts),
    movements: list(stored.movements),
    requirements: list(stored.requirements)
  };
}

function writeStore(payload) {
  const tempPath = dataPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, dataPath);
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) request.destroy(new Error('Request body is too large.'));
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function customerDirectory(store) {
  const names = new Set([
    ...list(store.quotes).map((quote) => quote.customer),
    ...list(store.jobs).map((job) => job.customer)
  ].filter(Boolean));
  return [...names].sort((a, b) => a.localeCompare(b));
}

async function handleApi(request, response, pathname) {
  if (request.method === 'GET' && pathname === '/api/health') {
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === 'GET' && pathname === '/api/bootstrap') {
    const store = readStore();
    return sendJson(response, 200, { workspace: store.workspace, state: store, customers: customerDirectory(store) });
  }

  if (request.method === 'POST' && pathname === '/api/sync') {
    try {
      const body = await readJson(request);
      const current = readStore();
      const next = {
        workspace: current.workspace || { name: 'Northstar Works', cluster: 'Packaging', locale: 'en-IN' },
        quotes: list(body.quotes),
        jobs: list(body.jobs),
        purchases: list(body.purchases),
        materials: list(body.materials),
        deliveries: list(body.deliveries),
        receipts: list(body.receipts),
        movements: list(body.movements),
        requirements: list(body.requirements)
      };
      writeStore(next);
      return sendJson(response, 200, { ok: true, updatedAt: new Date().toISOString(), customers: customerDirectory(next) });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  return sendJson(response, 404, { error: 'Unknown API route.' });
}

function serveStatic(response, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.resolve(root, '.' + requested);
  if (!fullPath.startsWith(root + path.sep)) {
    response.writeHead(403);
    return response.end('Forbidden');
  }
  fs.readFile(fullPath, (error, contents) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500);
      return response.end(error.code === 'ENOENT' ? 'Not found' : 'Could not read this file');
    }
    response.writeHead(200, {
      'Content-Type': staticTypes[path.extname(fullPath)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(contents);
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://' + request.headers.host);
  if (url.pathname.startsWith('/api/')) {
    handleApi(request, response, url.pathname).catch((error) => sendJson(response, 500, { error: error.message }));
    return;
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }
  serveStatic(response, url.pathname);
});

server.listen(port, () => {
  console.log('FactoryFlow is running at http://localhost:' + port);
});
