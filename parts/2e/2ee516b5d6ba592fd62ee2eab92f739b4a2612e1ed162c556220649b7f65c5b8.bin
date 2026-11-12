// Serves the renderer page and relays ring frames to it over a WebSocket (RFC 6455, binary frames only).
// Messages from the page are either JSON text (console output, ready) or binary PNG screenshots.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';
import { RingReader } from './ring.mjs';

const { ring, staticRoot, outDir, overlayRoot } = workerData;
const addonsDir = path.join(overlayRoot, 'garrysmod', 'addons');
const reader = new RingReader(ring);
fs.mkdirSync(outDir, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' };
let socket = null, pageReady = false;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const file = path.join(staticRoot, url.pathname === '/' ? 'page.html' : url.pathname);
  if (!file.startsWith(staticRoot) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket = sock;
  let buf = Buffer.alloc(0), message = [];
  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = buf[0] & 0x80, op = buf[0] & 0x0f, masked = buf[1] & 0x80;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const total = off + (masked ? 4 : 0) + len;
      if (buf.length < total) return;
      const payload = Buffer.from(buf.subarray(off + (masked ? 4 : 0), total));
      if (masked) { const mask = buf.subarray(off, off + 4); for (let i = 0; i < len; i++) payload[i] ^= mask[i & 3]; }
      buf = buf.subarray(total);
      if (op === 8) { sock.end(); return; }
      if (op === 9) { frame(10, payload); continue; }
      message.push(payload);
      if (fin) { handle(op === 1 ? 'text' : 'binary', Buffer.concat(message)); message = []; }
    }
  });
  sock.on('close', () => { socket = null; });
});


function safeRelative(name) {
  const parts = name.replaceAll('\\', '/').split('/').filter((x) => x && x !== '.');
  if (!parts.length || parts.some((x) => x === '..' || x.includes(':'))) return null;
  return parts.join('/');
}
function sendJson(o) { if (socket) frame(1, Buffer.from(JSON.stringify(o))); }
// Top-level entries of the addons directory: .gma archives and legacy addon folders.
function listAddons() {
  if (!fs.existsSync(addonsDir)) return [];
  return fs.readdirSync(addonsDir).filter((n) => !n.startsWith('.')).map((n) => {
    const p = path.join(addonsDir, n), st = fs.statSync(p);
    let size = st.size;
    if (st.isDirectory()) { size = 0; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : (size += fs.statSync(path.join(d, e.name)).size); }; walk(p); }
    return { name: n, kind: st.isDirectory() ? 'folder' : 'gma', size };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
function removeAddon(name) {
  const rel = safeRelative(name);
  if (rel && !rel.includes('/')) fs.rmSync(path.join(addonsDir, rel), { recursive: true, force: true });
}

function frame(op, payload) {
  const n = payload.length;
  const head = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : (() => { const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); return h; })();
  return socket.write(Buffer.concat([head, payload]));
}

function handle(mtype, data) {
  if (mtype === 'text') {
    const m = JSON.parse(data.toString());
    if (m.type === 'ready') { pageReady = true; parentPort.postMessage({ type: 'ready' }); drain(); }
    else if (m.type === 'log') process.stdout.write(`[page] ${m.text}\n`);
    else if (m.type === 'addons-list') sendJson({ type: 'addons', items: listAddons() });
    else if (m.type === 'addons-delete') { removeAddon(m.name); sendJson({ type: 'addons', items: listAddons() }); }
    return;
  }
  // Binary messages: [kind u8][name length u16][name][bytes]. kind 1 = screenshot, 2 = addon file.
  const kind = data[0], nameLen = data.readUInt16LE(1);
  const name = data.subarray(3, 3 + nameLen).toString();
  const body = data.subarray(3 + nameLen);
  if (kind === 1) { fs.writeFileSync(path.join(outDir, name), body); parentPort.postMessage({ type: 'shot', name }); return; }
  if (kind === 2) {
    const rel = safeRelative(name);
    if (!rel) { sendJson({ type: 'addon-error', name, error: 'invalid path' }); return; }
    const dest = path.join(addonsDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, body);
    process.stdout.write(`[addons] ${rel} (${body.length} bytes)\n`);
    sendJson({ type: 'addon-saved', name: rel, size: body.length });
  }
}

let draining = false;
async function drain() {
  if (!pageReady || draining) return;
  draining = true;
  for (;;) {
    if (!socket) break;
    if (socket.writableLength >= 32 * 1024 * 1024) { await new Promise((r) => socket.once('drain', r)); continue; }
    const f = reader.read();
    if (f) { frame(2, Buffer.from(f.buffer, f.byteOffset, f.byteLength)); continue; }
    if (reader.closed) break;
    await reader.wait();
  }
  draining = false;
  parentPort.postMessage({ type: 'drained' });
}

server.listen(0, '127.0.0.1', () => parentPort.postMessage({ type: 'listening', port: server.address().port }));
parentPort.on('message', (m) => { if (m.type === 'quit') { server.close(); process.exit(0); } });
