// The binary op stream must hand the renderer exactly what the object path (stateDelta + applyOp) does.
import assert from 'node:assert/strict';
import { OpBackend, WorkerBackend } from './d3d9-backend.mjs';
import { applyOp } from '../../../runtime/d3d9/ops.js';
import { decodeWords } from './op-stream.mjs';

const SLOTS = 21;
const makeDev = (dirty) => ({
  rs: new Uint32Array(256), samplers: Array.from({ length: SLOTS }, () => new Uint32Array(14)), tex: new Array(SLOTS).fill(null),
  streams: Array.from({ length: 16 }, () => ({ vb: null, offset: 0, stride: 0, freq: 1 })), ib: null, decl: null, vs: null, ps: null,
  rts: [null, null, null, null], ds: null, viewport: { x: 0, y: 0, w: 640, h: 480, minZ: 0, maxZ: 1 }, scissor: { l: 0, t: 0, r: 640, b: 480 },
  clipPlanes: new Float32Array(24), vsF: new Float32Array(1024), psF: new Float32Array(1024), vsI: new Int32Array(64), psI: new Int32Array(64),
  vsB: new Uint32Array(16), psB: new Uint32Array(16),
  ...(dirty ? { constantDirty: { rs: true, samplers: true, vsF: true, psF: true, vsI: true, psI: true, vsB: true, psB: true }, constRange: {}, textureDirty: 0, streamDirty: 0 } : {}),
});

let seed = 12345;
const rnd = (n) => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed >>> 8) % n; };
const decls = [null, ...Array.from({ length: 4 }, (_, i) => ({ elements: [{ usage: 0, usageIndex: 0, stream: 0, offset: i * 4, type: 2 }] }))];
const res = (id) => (id ? { object: id } : null);

// Applies one random burst of changes, honouring the setters' dirty-flag protocol on `dev`.
function mutate(dev, dirty, steps) {
  const mark = (key, row) => { if (!dirty) return; dev.constantDirty[key] = true; const r = dev.constRange[key] ??= [256, 0]; r[0] = Math.min(r[0], row); r[1] = Math.max(r[1], row + 1); };
  for (const [kind, a, b, c] of steps) {
    switch (kind) {
      case 0: dev.rs[a % 256] = b === 0 ? 0xffffffff : b; if (dirty) dev.constantDirty.rs = true; break;
      case 1: dev.samplers[a % SLOTS][b % 14] = c === 0 ? 0x80000001 : c; if (dirty) dev.constantDirty.samplers = true; break;
      case 2: dev.tex[a % SLOTS] = res(b % 5); if (dirty) dev.textureDirty |= 1 << (a % SLOTS); break;
      case 3: Object.assign(dev.streams[a % 16], { vb: res(b % 4), offset: c % 3 * 16, stride: 32, freq: c === 0 ? ((2 << 30) | 4) >>> 0 : 1 }); if (dirty) dev.streamDirty |= 1 << (a % 16); break;
      case 4: dev.ib = res(a % 3); break;
      case 5: dev.decl = decls[a % decls.length]; break;
      case 6: dev.vs = res(a % 4); dev.ps = res(b % 4); break;
      case 7: dev.rts[a % 4] = res(b % 3); dev.ds = res(c % 3); break;
      case 8: dev.viewport = { x: a % 8, y: b % 8, w: 100 + c, h: 200 + a, minZ: 0, maxZ: 0.5 }; dev.scissor = { l: a % 4, t: b % 4, r: 100 + c, b: 50 + a }; break;
      case 9: dev.clipPlanes[a % 24] = b / 4; break;
      case 10: { const row = a % 250, n = 1 + (b % 5); for (let i = 0; i < n * 4; i++) dev.vsF[row * 4 + i] = (c + i) / 8; mark('vsF', row); mark('vsF', row + n - 1); break; }
      case 11: { const row = a % 250; dev.psF[row * 4 + (b % 4)] = c / 8; mark('psF', row); break; }
      case 12: dev.vsI[a % 64] = b - 3; dev.psI[b % 64] = a; if (dirty) { dev.constantDirty.vsI = true; dev.constantDirty.psI = true; } break;
      case 13: dev.vsB[a % 16] = b % 2 ? 0xffffffff : 0; dev.psB[b % 16] = a % 2; if (dirty) { dev.constantDirty.vsB = true; dev.constantDirty.psB = true; } break;
    }
  }
}

const norm = (d) => JSON.parse(JSON.stringify(d, (k, v) => (ArrayBuffer.isView(v) ? Array.from(v) : v)));

for (const dirty of [false, true]) {
  seed = 12345;
  const oldDev = makeDev(dirty), newDev = makeDev(dirty);
  const oldB = new (class extends OpBackend { emit(json, blob) { this.out.push([json, blob]); } })(); oldB.out = [];
  const messages = [];
  const newB = new WorkerBackend({ postMessage: (m, t) => messages.push(structuredClone(m, { transfer: t })) }, { blobArenaBytes: 0 });
  const expected = [], got = [], gotDecl = new Map();
  const recorder = (into) => ({ applyState: (d) => into.push(norm(d)), draw: (c) => into.push({ draw: norm(c) }) });
  for (let round = 0; round < 3000; round++) {
    const steps = Array.from({ length: rnd(6) }, () => [rnd(14), rnd(300), rnd(300), rnd(300)]);
    mutate(oldDev, dirty, steps); mutate(newDev, dirty, steps);
    // Real streams stay bound, so exercise a couple of rounds with the full-binding reset as well.
    if (round % 400 === 399) { oldB.resize(640, 480); newB.resize(640, 480); oldB.out.length = 0; }
    oldB.sendState(oldDev); newB.sendState(newDev);
    if (round % 3 === 0) { const call = { indexed: round % 2 === 0, prim: 4, primCount: round % 50, startVertex: round % 7, baseVertex: round % 5, startIndex: round % 11, numVerts: 3, minIndex: 0 }; oldB.out.push([{ o: 'draw', call }]); newB.draw(newDev, call); }
    if (round % 50 === 49) newB.flush();
    for (const [json, blob] of oldB.out) {
      if (json.o === 'decl') continue;
      if (json.o === 'draw') { const c = json.call; expected.push({ draw: { indexed: c.indexed, prim: c.prim, primCount: c.primCount, startVertex: c.startVertex, baseVertex: c.baseVertex, startIndex: c.startIndex } }); }
      else applyOp({ applyState: (d) => expected.push(norm(d)), resize() {} }, json, blob);
    }
    oldB.out.length = 0;
  }
  newB.flush();
  let drained = 0;
  for (const m of messages) {
    const ops = m.ops; let next = 0;
    if (!m.words) continue;
    decodeWords(m.words, m.length, {
      object: () => { const op = ops[next++]; if (op.o === 'decl') gotDecl.set(op.id, op.elements); },
      draw: (c) => got.push({ draw: norm(c) }),
      state: (d) => got.push(norm(d)),
    }, gotDecl);
    drained++;
  }
  // The decoded decl is an interned array, the object path carries a copy: compare by contents.
  const resolve = (list) => list.map((d) => (d.decl !== undefined ? { ...d, decl: d.decl } : d));
  assert.equal(got.length, expected.length, `record count (dirty=${dirty})`);
  assert.deepEqual(resolve(got), resolve(expected));
  console.log(`PASS binary op stream matches stateDelta/applyOp: ${got.length} records over 3000 rounds, ${drained} batches (dirty tracking ${dirty})`);
}
// Ordering: object ops stay interleaved with binary records at their original positions.
{
  const messages = [];
  const b = new WorkerBackend({ postMessage: (m, t) => messages.push(structuredClone(m, { transfer: t })) }, { blobArenaBytes: 0 });
  b.emit({ o: 'a' }); b.draw(makeDev(false), { indexed: false, prim: 4, primCount: 1, startVertex: 0 }); b.emit({ o: 'b' }); b.flush();
  const order = [], m0 = messages.find((m) => m.type === 'ops');
  decodeWords(m0.words, m0.length, { object: () => order.push('obj'), draw: () => order.push('draw'), state: () => order.push('state') }, new Map());
  assert.deepEqual(order, ['obj', 'state', 'draw', 'obj']);
  assert.deepEqual(m0.ops.map((o) => o.o), ['a', 'b']);
  console.log('PASS object ops and binary records keep their issue order');
}
