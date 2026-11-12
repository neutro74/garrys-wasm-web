// Receives op batches from the Node host and drives the renderer.
import { D3D9Renderer } from './renderer.js';
import { applyOp } from './ops.js';

const ws = new WebSocket(`ws://${location.host}/ws`);
ws.binaryType = 'arraybuffer';
const sendJson = (o) => ws.send(JSON.stringify(o));
const canvas = document.getElementById('c');
let renderer;

const dec = new TextDecoder();
const enc = new TextEncoder();

// Binary uplink: [kind u8][name length u16][name][bytes]; kind 1 = screenshot, 2 = addon file.
function sendBinary(kind, name, bytes) {
  const nameBytes = enc.encode(name);
  const msg = new Uint8Array(3 + nameBytes.length + bytes.length);
  msg[0] = kind; new DataView(msg.buffer).setUint16(1, nameBytes.length, true);
  msg.set(nameBytes, 3); msg.set(bytes, 3 + nameBytes.length);
  ws.send(msg);
}

async function shot(name) {
  console.log(`stats ${JSON.stringify(renderer.stats)}`);
  const f = renderer.readFrame();
  if (!f) return;
  const c = new OffscreenCanvas(f.w, f.h);
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(f.px.buffer), f.w, f.h), 0, 0);
  const png = new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer());
  sendBinary(1, name, png);
}

function run(buf) {
  const dv = new DataView(buf);
  let p = 0;
  while (p < buf.byteLength) {
    const jl = dv.getUint32(p, true), bl = dv.getUint32(p + 4, true);
    const op = JSON.parse(dec.decode(new Uint8Array(buf, p + 8, jl)));
    const blob = bl ? new Uint8Array(buf, p + 8 + jl, bl) : null;
    p += 8 + jl + bl;
    try { applyOp(renderer, op, blob, { shot }); }
    catch (e) { console.log(`op ${op.o} failed: ${e.stack || e}`); }
  }
}

ws.onopen = () => {
  try {
    renderer = new D3D9Renderer(canvas, { log: (t) => console.log(t) });
    renderer.debug = true;
    const gl = renderer.gl;
    console.log(`WebGL2 ${gl.getParameter(gl.VERSION)} | ${gl.getParameter(gl.RENDERER)} | uniform blocks ${gl.getParameter(gl.MAX_UNIFORM_BLOCK_SIZE)}B`);
    console.log(`s3tc=${!!renderer.ext.s3tc} rgtc=${!!renderer.ext.rgtc} floatBuf=${!!renderer.ext.floatBuf}`);
  } catch (e) { console.log(`renderer init failed: ${e.stack || e}`); }
  sendJson({ type: 'ready' });
};
ws.onmessage = (e) => {
  if (typeof e.data === 'string') { addonMessage(JSON.parse(e.data)); return; }
  if (renderer) run(e.data);
};

// Add Addons panel: GMA archives or addon folders are uploaded into the game's addons directory.
import { setupAddonPanel } from './addons-ui.js';
let addonMessage = () => {};
setupAddonPanel({ sendBinary, sendJson, onMessage: (fn) => { addonMessage = fn; } });
