/* Package-root worker: authenticated, content-addressed binary transport. */
'use strict';
const ROOT = new URL('./', self.location.href);
const MEMORY_LIMIT = 16 * 1024 * 1024;
const READ_AHEAD = 4;
const PREFETCH_WORKERS = 8;
const memory = new Map();
let memoryBytes = 0;
const pending = new Map();
let demand = 0;                 // chunk reads the engine is waiting on; background prefetch yields to them
let cacheHandle;
let manifestPromise;
const CACHE_NAME = 'garrys-wasm-sha256-v1';

function isolationHeaders(original) {
  const headers = new Headers(original);
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  return headers;
}
function binaryBase(manifest) {
  if (manifest.binaryBase && manifest.binaryBase !== 'auto') return new URL(manifest.binaryBase, ROOT);
  const match = ROOT.pathname.match(/^\/gh\/([^/]+)\/([^/]+)\/([^/]+)\/(.*)$/);
  if (ROOT.hostname === 'cdn.staticdelivr.com' && match) return new URL(`https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}/${match[4]}`);
  return ROOT;
}
async function manifest() {
  if (!manifestPromise) manifestPromise = (async () => {
    const response = await fetch(new URL('cdn-manifest.json', ROOT).href, { credentials: 'omit', cache: 'no-cache' });
    if (!response.ok || response.type === 'opaque') throw Error('CDN manifest unavailable');
    const value = await response.json();
    if (value.version !== 1 || value.chunkSize !== 1048576 || !value.files || typeof value.files !== 'object') throw Error('Unsupported CDN manifest');
    return value;
  })().catch(error => { manifestPromise = undefined; throw error; });
  return manifestPromise;
}
function remember(hash, bytes) {
  const old = memory.get(hash);
  if (old) memoryBytes -= old.byteLength;
  memory.delete(hash);
  memory.set(hash, bytes);
  memoryBytes += bytes.byteLength;
  while (memoryBytes > MEMORY_LIMIT) {
    const first = memory.keys().next().value;
    memoryBytes -= memory.get(first).byteLength;
    memory.delete(first);
  }
}
async function verified(response, hash) {
  if (!response.ok || response.type === 'opaque') throw Error(`CDN chunk unavailable: ${hash}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const actual = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  if (actual !== hash) throw Error(`CDN chunk integrity mismatch: ${hash}`);
  return bytes;
}
async function chunk(hash, base) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw Error('Invalid chunk hash');
  if (memory.has(hash)) { const bytes = memory.get(hash); remember(hash, bytes); return bytes; }
  if (pending.has(hash)) return pending.get(hash);
  const operation = (async () => {
    // A stable same-origin synthetic URL shares verified disk chunks across refs.
    const key = new URL(`/__garrys_wasm_chunks_v1__/${hash}`, ROOT).href;
    let cache;
    try {
      cache = await (cacheHandle ??= caches.open(CACHE_NAME).catch(error => { cacheHandle = undefined; throw error; }));
      const hit = await cache.match(key);
      if (hit) {
        try { const bytes = await verified(hit, hash); remember(hash, bytes); return bytes; }
        catch { await cache.delete(key); }
      }
    } catch { /* Storage may be disabled, unavailable, or full. */ }
    // A blocked sync read in the engine cannot recover from a failed chunk, so ride out transient network, CDN and
    // truncation errors (retries are only for fetch/integrity failures; a missing chunk fails after the last attempt).
    const url = new URL(`parts/${hash.slice(0, 2)}/${hash}.bin`, base).href;
    let bytes;
    for (let attempt = 0; ; attempt++) {
      try { bytes = await verified(await fetch(url, { mode: 'cors', credentials: 'omit' }), hash); break; }
      catch (error) { if (attempt >= 3) throw error; await new Promise(resolve => setTimeout(resolve, 300 * 2 ** attempt)); }
    }
    remember(hash, bytes);
    if (cache) {
      try { await cache.put(key, new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } })); } catch { /* Network data remains usable. */ }
    }
    return bytes;
  })();
  pending.set(hash, operation);
  try { return await operation; } finally { pending.delete(hash); }
}
function rangeFor(header, size) {
  if (header === null) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2]) || size === 0) return null;
  let start, end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return null;
    end = Math.min(end, size - 1);
  }
  return { start, end, partial: true };
}
function binaryResponse(request, file, index) {
  if (!Number.isSafeInteger(file.size) || file.size < 0 || !Array.isArray(file.chunks) || file.chunks.length !== Math.ceil(file.size / index.chunkSize)) throw Error('Invalid CDN file metadata');
  const range = rangeFor(request.headers.get('Range'), file.size);
  const headers = isolationHeaders({ 'Content-Type': file.mime || 'application/octet-stream', 'Accept-Ranges': 'bytes' });
  if (!range) {
    headers.set('Content-Range', `bytes */${file.size}`);
    headers.set('Content-Length', '0');
    return new Response(null, { status: 416, headers });
  }
  headers.set('Content-Length', String(Math.max(0, range.end - range.start + 1)));
  if (range.partial) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${file.size}`);
  let position = range.start;
  const body = request.method === 'HEAD' || file.size === 0 ? null : new ReadableStream({
    async pull(controller) {
      if (position > range.end) { controller.close(); return; }
      try {
        const part = Math.floor(position / index.chunkSize);
        // Read ahead only inside the requested range, so scattered small reads do not pull whole files.
        const last = Math.floor(range.end / index.chunkSize);
        for (let next = part + 1; next <= Math.min(last, part + READ_AHEAD); next++) chunk(file.chunks[next], binaryBase(index)).catch(() => {});
        demand++;
        let bytes;
        try { bytes = await chunk(file.chunks[part], binaryBase(index)); } finally { demand--; }
        const expected = Math.min(index.chunkSize, file.size - part * index.chunkSize);
        if (bytes.byteLength !== expected) throw Error('CDN chunk size mismatch');
        const offset = position % index.chunkSize;
        const count = Math.min(bytes.byteLength - offset, range.end - position + 1);
        controller.enqueue(bytes.subarray(offset, offset + count));
        position += count;
        if (position > range.end) controller.close();
      } catch (error) { controller.error(error); }
    },
  }, { highWaterMark: 0 });
  return new Response(body, { status: range.partial ? 206 : 200, headers });
}
async function handle(request, url) {
  try {
    const index = await manifest();
    const path = decodeURIComponent(url.pathname.slice(ROOT.pathname.length));
    if (Object.hasOwn(index.files, path)) return binaryResponse(request, index.files[path], index);
    const response = await fetch(request);
    if (response.type === 'opaque' || response.type === 'opaqueredirect') throw Error('Opaque CDN response cannot be isolated');
    return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, statusText: response.statusText, headers: isolationHeaders(response.headers) });
  } catch (error) {
    console.error('Garrys Wasm CDN:', error);
    return new Response(request.method === 'HEAD' ? null : 'CDN transport failed. Check the console and network connection.', { status: 502, headers: isolationHeaders({ 'Content-Type': 'text/plain' }) });
  }
}
// The page asks for the files it is about to need; downloads run in parallel and land in the persistent chunk cache.
async function prefetch(prefixes, warm, workers = PREFETCH_WORKERS) {
  const index = await manifest(), base = binaryBase(index), queue = [], seen = new Set();
  const add = hash => { if (!seen.has(hash)) { seen.add(hash); queue.push(hash); } };
  for (const prefix of prefixes) for (const [path, file] of Object.entries(index.files)) if (path.startsWith(prefix)) file.chunks.forEach(add);
  // Chunks a boot-to-map run read, in first-read order (tools/make-warm-list.mjs): fetched in parallel instead of
  // one blocking round trip each from the engine.
  if (warm && Array.isArray(index.warm)) index.warm.forEach(add);
  // While the engine is blocked on a read, only two background downloads continue so its own request gets bandwidth.
  await Promise.all(Array.from({ length: Math.max(1, Math.min(PREFETCH_WORKERS, workers | 0)) }, async (_, id) => {
    for (let hash; (hash = queue.shift());) {
      while (demand > 0 && id >= 2) await new Promise(resolve => setTimeout(resolve, 50));
      await chunk(hash, base).catch(() => {});
    }
  }));
}
self.addEventListener('message', event => {
  const data = event.data;
  if (data && data.type === 'prefetch' && Array.isArray(data.prefixes)) event.waitUntil(prefetch(data.prefixes.filter(p => typeof p === 'string'), data.warm === true, data.workers).catch(() => {}));
});
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname) || !['GET', 'HEAD'].includes(request.method)) return;
  event.respondWith(handle(request, url));
});
