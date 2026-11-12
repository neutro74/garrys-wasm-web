// Draws a colored triangle and a textured quad through RemoteBackend -> Chromium -> WebGL2, then checks pixels.
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { startRemote } from './d3d9-remote.mjs';
import { readPng } from '../../lib/png.mjs';
import { R, dst, src, dcl, dclSampler, inst, ver, asm } from '../../../runtime/d3d9/asm.js';

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd3d9-render-'));
const remote = await startRemote({ outDir });
const be = remote.backend;
const g = { u8: new Uint8Array(1 << 16) };
be.attach(g);

const W = 64, H = 64;
let nextId = 1;
const obj = (extra) => ({ object: nextId++, refs: 1, ...extra });

const bb = obj({ kind: 'surface', kindOf: 'backbuffer', w: W, h: H, format: 22, usage: 1 });
be.createResource(bb);

const vs = obj({ kind: 'vs', stage: 'vs', bytecode: asm(ver('vs', 2, 0),
  dcl(0, 0, R.INPUT, 0), dcl(10, 0, R.INPUT, 1), dcl(5, 0, R.INPUT, 2),
  inst(1, dst(R.RASTOUT, 0), src(R.INPUT, 0)),
  inst(1, dst(R.ATTROUT, 0), src(R.INPUT, 1)),
  inst(1, dst(R.TEXCRDOUT, 0), src(R.INPUT, 2))) });
const psColor = obj({ kind: 'ps', stage: 'ps', bytecode: asm(ver('ps', 2, 0), dcl(0, 0, R.INPUT, 0), inst(1, dst(R.COLOROUT, 0), src(R.INPUT, 0))) });
const psTex = obj({ kind: 'ps', stage: 'ps', bytecode: asm(ver('ps', 2, 0), dcl(0, 0, R.ADDR, 0), dclSampler(0, 2),
  inst(66, dst(R.TEMP, 0), src(R.ADDR, 0), src(R.SAMPLER, 0)), inst(1, dst(R.COLOROUT, 0), src(R.TEMP, 0))) });
for (const s of [vs, psColor, psTex]) be.createResource(s);

// vertex: float3 position, D3DCOLOR (BGRA), float2 uv  -> 24 bytes
const verts = new ArrayBuffer(24 * 6), dv = new DataView(verts);
const put = (i, x, y, color, u, v) => { dv.setFloat32(i * 24, x, true); dv.setFloat32(i * 24 + 4, y, true); dv.setFloat32(i * 24 + 8, 0.5, true); dv.setUint32(i * 24 + 12, color, true); dv.setFloat32(i * 24 + 16, u, true); dv.setFloat32(i * 24 + 20, v, true); };
put(0, -1, -1, 0xffff0000, 0, 1); put(1, 1, -1, 0xffff0000, 1, 1); put(2, -1, 1, 0xffff0000, 0, 0);   // red triangle (lower left half)
put(3, 0.2, 0.2, 0xffffffff, 0, 0); put(4, 0.9, 0.2, 0xffffffff, 1, 0); put(5, 0.2, 0.9, 0xffffffff, 0, 1);   // textured, upper right
g.u8.set(new Uint8Array(verts), 0);
const vb = obj({ kind: 'vb', size: verts.byteLength, usage: 0, pool: 0, format: 0, data: 0 });
be.createResource(vb); be.uploadBuffer(vb, 0, verts.byteLength);

// 2x2 texture: A8R8G8B8 bytes B,G,R,A: green, blue / yellow, white
const tex = obj({ kind: 'texture', texKind: '2d', w: 2, h: 2, d: 1, levels: 1, format: 21, usage: 0, pool: 1, layouts: [{ w: 2, h: 2, pitch: 8, rows: 2, size: 16 }] });
be.createResource(tex);
g.u8.set([0, 255, 0, 255, 255, 0, 0, 255, 0, 255, 255, 255, 255, 255, 255, 255], 4096);
be.uploadTexture(tex, 0, 0, null, 4096, 8);

const rs = new Uint32Array(256); rs[22] = 1; rs[168] = 15; rs[23] = 8; rs[7] = 0; rs[14] = 0;
const dev = {
  rs, samplers: Array.from({ length: 21 }, () => Uint32Array.from([0, 3, 3, 3, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0])), tex: new Array(21).fill(null),
  streams: Array.from({ length: 16 }, () => ({ vb: null, offset: 0, stride: 0, freq: 1 })), ib: null,
  decl: { elements: [{ stream: 0, offset: 0, type: 2, usage: 0, usageIndex: 0 }, { stream: 0, offset: 12, type: 4, usage: 10, usageIndex: 0 }, { stream: 0, offset: 16, type: 1, usage: 5, usageIndex: 0 }] },
  vs, ps: psColor, rts: [bb, null, null, null], ds: null, viewport: { x: 0, y: 0, w: W, h: H, minZ: 0, maxZ: 1 }, scissor: { l: 0, t: 0, r: W, b: H },
  clipPlanes: new Float32Array(24), vsF: new Float32Array(1024), psF: new Float32Array(1024), vsI: new Int32Array(64), psI: new Int32Array(64),
  vsB: new Uint32Array(16), psB: new Uint32Array(16), backBuffer: bb,
};
dev.streams[0] = { vb, offset: 0, stride: 24, freq: 1 };

be.clear(dev, 1, 0xff000000, 1, 0, null);
be.draw(dev, { indexed: false, prim: 4, startVertex: 0, primCount: 1, numVerts: 3 });
dev.ps = psTex; dev.tex[0] = tex;
be.draw(dev, { indexed: false, prim: 4, startVertex: 3, primCount: 1, numVerts: 3 });
be.present(dev);
be.shot('synthetic.png');
for (const minor of [1, 4]) {
  const legacy = obj({ kind: 'ps', stage: 'ps', bytecode: Uint32Array.from([
    ver('ps', 1, minor), 66, dst(minor === 4 ? R.TEMP : R.ADDR, 0),
    ...(minor === 4 ? [src(R.ADDR, 0)] : [1, dst(R.TEMP, 0), src(R.ADDR, 0)]), 0xffff]) });
  be.createResource(legacy); dev.ps = legacy;
  be.draw(dev, { indexed: false, prim: 4, startVertex: 3, primCount: 1, numVerts: 3 });
  be.present(dev); be.shot(`sm1-${minor}.png`);
}
await remote.close();

const png = readPng(path.join(outDir, 'synthetic.png'));
const at = (x, y) => png.px(x, y).slice(0, 3);
assert.equal(png.w, W);
// D3D row 0 is the top: the red triangle covers the lower-left half, the textured one the upper right.
assert.deepEqual(at(8, 56), [255, 0, 0], 'red triangle, lower left');
assert.deepEqual(at(56, 8), [0, 0, 0], 'untouched corner is the clear color');
const tl = at(40, 12), tr = at(52, 12);
console.log('textured samples near upper right:', tl, tr);
assert.notDeepEqual(at(40, 20), [0, 0, 0], 'textured triangle drew something');
for (const minor of [1, 4]) {
  const legacy = readPng(path.join(outDir, `sm1-${minor}.png`));
  for (const [x, y] of [[40, 20], [40, 12], [52, 12]])
    assert.deepEqual(legacy.px(x, y), png.px(x, y), `SM1.${minor} texture sample at ${x},${y}`);
}
console.log('d3d9 render path + SM1.1/1.4 pixel parity: PASS', outDir);
process.exit(0);
