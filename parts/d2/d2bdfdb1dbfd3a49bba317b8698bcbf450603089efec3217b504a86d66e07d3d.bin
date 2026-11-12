// The few things the guest host needs from its environment, with one implementation for Node (the dev and test
// host) and one for a browser worker. Everything else in the host is plain JS over WebAssembly and shared memory.

export const isNode = typeof process !== 'undefined' && !!process.versions?.node && typeof WorkerGlobalScope === 'undefined';

// Debug and tuning flags: process.env in Node; in the browser the page copies its URL query into globalThis.__env.
export const env = isNode ? process.env : (globalThis.__env ??= {});

const nodeFs = isNode ? await import('node:fs') : null;
const nodePath = isNode ? (await import('node:path')).default : null;
const nodeWorkers = isNode ? await import('node:worker_threads') : null;

// Synchronous fs/path for the file volume. In the browser `fs` is installed by the worker bootstrap once it has the
// game index and overlay (see webfs.mjs); `path` is available immediately.
export let fs = isNode ? nodeFs : null;
export const path = isNode ? nodePath : (await import('./webfs.mjs')).path;
export function setFs(impl) { fs = impl; }
export const installRoot = () => env.GMOD_ROOT ?? (isNode ? `${process.env.HOME}/.steam/steam/steamapps/common/GarrysMod` : '/install');
export const overlayRoot = () => env.GMOD_OVERLAY ?? (isNode ? null : '/overlay');

export const utf8 = new TextEncoder();
export const utf8d = new TextDecoder();

// Browser transport paths belong to the package root, including CDN repository/ref prefixes.
const webUrl = (path) => new URL(path.replace(/^\/(?!\/)/, ''), new URL('../../../', import.meta.url)).href;

// Binary asset (DLL image, wasm chunk, json). Paths are relative to tools/lift ("out/engine-thread.json").
export async function readBytes(path) {
  if (isNode) return new Uint8Array(await nodeFs.promises.readFile(path));
  const res = await fetch(webUrl(path));
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
export async function readJson(path) { return JSON.parse(utf8d.decode(await readBytes(path))); }

// Compiled modules are cached so the main thread compiles once and thread workers reuse the result.
const modules = new Map();
export function seedModules(entries) { for (const [k, m] of entries) modules.set(k, m); }
export function compiledModules() { return [...modules]; }
export async function compileAsset(path) {
  let m = modules.get(path);
  if (m) return m;
  if (isNode) m = await WebAssembly.compile(await readBytes(path));
  else m = await WebAssembly.compileStreaming(fetch(webUrl(path)));
  modules.set(path, m);
  return m;
}

export function writeStderr(text) {
  if (isNode) nodeFs.writeSync(2, text); else console.error(text.replace(/\n$/, ''));
}

// A guest thread: a worker that runs thread-worker.mjs with `data` (shared memory, thread id, entry point...).
export function spawnThread(data, { onError, onExit } = {}) {
  if (isNode) {
    const w = new nodeWorkers.Worker(new URL('./thread-worker.mjs', import.meta.url), { workerData: data });
    if (onError) w.on('error', onError);
    if (onExit) w.on('exit', onExit);
    return { terminate: () => w.terminate(), raw: w };
  }
  // A browser worker cannot start a worker while it blocks, and guest threads are created from blocking code, so
  // the page (whose event loop never blocks) starts them: see the 'spawn-thread' handler in web/main.js.
  self.postMessage({ type: 'spawn-thread', data: { ...data, env: { ...env } } });
  return { terminate: () => { self.postMessage({ type: 'terminate-thread', threadId: data.threadId }); return Promise.resolve(); }, raw: null };
}

// Inside a thread worker: the init payload.
export function threadInit() {
  if (isNode) return Promise.resolve(nodeWorkers.workerData);
  return new Promise((resolve) => {
    self.onmessage = (e) => { self.onmessage = null; resolve(e.data); };
    self.postMessage({ type: 'thread-ready' });
  });
}
