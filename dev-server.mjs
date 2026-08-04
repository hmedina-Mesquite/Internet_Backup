/**
 * Servidor de desarrollo local: sirve el sitio estatico con fallback de SPA
 * y monta el mismo handler de api/contacto.js que se usara en produccion.
 *
 *   node --env-file=.env.local dev-server.mjs      →  http://localhost:5500
 *
 * En produccion (Vercel) este archivo no se usa: la plataforma expone
 * api/contacto.js automaticamente en /api/contacto.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const handler = require('./api/contacto.js');

const ROOT = new URL('.', import.meta.url).pathname;
const PORT = Number(process.env.PORT || 5500);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Adapta el res de node al mini-API que espera el handler de Vercel. */
function decorate(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

async function serveFile(path, res) {
  const body = await readFile(path);
  res.setHeader('Content-Type', TYPES[extname(path).toLowerCase()] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/api/contacto') {
    try {
      return await handler(req, decorate(res));
    } catch (err) {
      console.error('[dev-server] handler:', err);
      res.statusCode = 500;
      return res.end('{"ok":false}');
    }
  }

  // impide salir del directorio del proyecto
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  const path = join(ROOT, rel);

  try {
    const info = await stat(path);
    if (info.isFile()) return await serveFile(path, res);
  } catch {
    /* no existe: cae al fallback de SPA */
  }

  // fallback de SPA para rutas como /contacto
  try {
    return await serveFile(join(ROOT, 'index.html'), res);
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
}).listen(PORT, () => {
  console.log(`  Sitio:    http://localhost:${PORT}/`);
  console.log(`  Contacto: http://localhost:${PORT}/contacto`);
  console.log(`  Endpoint: POST http://localhost:${PORT}/api/contacto`);
});
