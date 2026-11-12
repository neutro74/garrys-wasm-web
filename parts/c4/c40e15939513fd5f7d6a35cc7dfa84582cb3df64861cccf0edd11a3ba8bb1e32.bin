// D3D9 backend that renders in Chromium. Device calls become ops in a batch that is flushed once per frame
// to the renderer page (runtime/d3d9) through a shared-memory ring and a WebSocket relay worker.
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { createRing, RingWriter } from './ring.mjs';
import { launch } from '../../lib/browser.mjs';
import { OpBackend } from './d3d9-backend.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE_ROOT = path.resolve(HERE, '../../../runtime/d3d9');
const SLOTS = 21;

class Batch {
  constructor() { this.parts = []; this.size = 0; }
  op(json, blob = null) {
    const j = Buffer.from(JSON.stringify(json));
    const head = Buffer.alloc(8); head.writeUInt32LE(j.length, 0); head.writeUInt32LE(blob ? blob.byteLength : 0, 4);
    this.parts.push(head, j);
    if (blob) this.parts.push(Buffer.from(blob.buffer, blob.byteOffset, blob.byteLength));
    this.size += 8 + j.length + (blob ? blob.byteLength : 0);
  }
  take() { const b = Buffer.concat(this.parts); this.parts = []; this.size = 0; return b; }
}


export class RemoteBackend extends OpBackend {
  constructor(bridge, options) { super(options); this.bridge = bridge; this.batch = new Batch(); }
  emit(json, blob) {
    this.batch.op(json, blob);
    if (this.batch.size > 8 * 1024 * 1024) this.flush();
  }
  flush() {
    if (!this.batch.size) return;
    const b = this.batch.take();
    this.stats.bytes += b.length;
    this.bridge.write(new Uint8Array(b.buffer, b.byteOffset, b.byteLength));
  }
}

// Starts the relay worker and a Chromium page that renders what the backend sends.
export async function startRemote({ outDir, gpu = process.env.D3D9_GPU === '1', headed = process.env.D3D9_HEADED === '1', shotEvery = +process.env.D3D9_SHOT_EVERY || 0 } = {}) {
  const ring = createRing(64 * 1024 * 1024);
  const worker = new Worker(path.join(HERE, 'ws-bridge-worker.mjs'), { workerData: { ring, staticRoot: PAGE_ROOT, outDir, overlayRoot: process.env.GMOD_OVERLAY || path.resolve(HERE, '../../../run/overlay') } });
  const events = new Map();
  const once = (type) => new Promise((resolve) => events.set(type, resolve));
  worker.on('message', (m) => { events.get(m.type)?.(m); if (m.type === 'shot') console.log(`[d3d9-remote] saved ${m.name}`); });
  worker.on('error', (e) => { console.error('[d3d9-remote] bridge worker failed:', e); });
  const listening = await once('listening');
  const ready = once('ready');
  const profile = path.resolve(process.env.D3D9_PROFILE || path.resolve(HERE, '../../../run/chrome-profile-bridge'));
  (await import('node:fs')).mkdirSync(profile, { recursive: true });
  const browser = await launch({ width: 1280, height: 720, gpu, headed, profile });
  browser.on('Runtime.consoleAPICalled', (p) => console.log(`[chromium] ${p.args.map((a) => a.value ?? a.description).join(' ')}`));
  browser.on('Runtime.exceptionThrown', (p) => console.log(`[chromium] exception: ${p.exceptionDetails.exception?.description ?? p.exceptionDetails.text}`));
  await browser.send('Log.enable');
  browser.on('Log.entryAdded', (p) => console.log(`[chromium:${p.entry.level}] ${p.entry.text}`));
  await browser.goto(`http://127.0.0.1:${listening.port}/`);
  await ready;
  const writer = new RingWriter(ring);
  const backend = new RemoteBackend({ write: (b) => writer.write(b) }, { shotEvery });
  return {
    backend, browser, outDir,
    async close() {
      backend.flush();
      const drained = once('drained');
      writer.close();
      await drained;
      await new Promise((r) => setTimeout(r, 500));
      await browser.close?.();
      worker.postMessage({ type: 'quit' });
    },
  };
}
