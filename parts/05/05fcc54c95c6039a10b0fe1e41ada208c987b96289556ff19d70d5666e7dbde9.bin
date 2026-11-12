// Compact binary encoding of the two hot renderer ops (draws and state deltas), so the guest does not build
// thousands of small objects per frame and postMessage does not structured-clone them. One transferable word buffer
// per frame holds, in order: 0 = "next object op" (rare ops stay as objects in the batch's `ops` array), 1 = draw,
// 2 = state delta. The decoder rebuilds exactly the delta/call shapes D3D9Renderer.applyState/draw already take.

export const TAG_OBJ = 0, TAG_DRAW = 1, TAG_STATE = 2;
// State sections, one bit each in the record's mask.
export const S_RS = 0, S_SAMPLERS = 1, S_TEX = 2, S_STREAMS = 3, S_IB = 4, S_DECL = 5, S_VS = 6, S_PS = 7, S_RTS = 8,
  S_DS = 9, S_VIEWPORT = 10, S_SCISSOR = 11, S_CLIP = 12, S_VSF = 13, S_PSF = 14, S_VSI = 15, S_PSI = 16, S_VSB = 17, S_PSB = 18;

export class OpWriter {
  constructor(words = 1 << 14) { this.allocate(words); }
  allocate(words) {
    this.buffer = new ArrayBuffer(words * 4); this.i32 = new Int32Array(this.buffer); this.f32 = new Float32Array(this.buffer); this.pos = 0;
  }
  // Guarantees room for `n` more words (the views are replaced when the buffer grows).
  need(n) {
    if (this.pos + n <= this.i32.length) return;
    const bigger = new ArrayBuffer(Math.max(this.i32.length * 2, this.pos + n) * 4);
    new Int32Array(bigger).set(this.i32.subarray(0, this.pos));
    this.buffer = bigger; this.i32 = new Int32Array(bigger); this.f32 = new Float32Array(bigger);
  }
  // The finished words, ready to transfer; a fresh buffer sized for the next frame replaces it.
  take() {
    const out = { buffer: this.buffer, length: this.pos };
    this.allocate(Math.max(1 << 14, this.pos + (this.pos >> 2)));
    return out;
  }
  obj() { this.need(1); this.i32[this.pos++] = TAG_OBJ; }
  draw(call) {
    this.need(8);
    const w = this.i32; let p = this.pos;
    w[p++] = TAG_DRAW; w[p++] = call.indexed ? 1 : 0; w[p++] = call.prim; w[p++] = call.primCount;
    w[p++] = call.startVertex | 0; w[p++] = call.baseVertex | 0; w[p++] = call.startIndex | 0;
    this.pos = p;
  }
}

// Replays one frame's words. `handlers`: object(), draw(call), state(delta). `decls` maps interned declaration ids.
export function decodeWords(buffer, length, handlers, decls) {
  const w = new Int32Array(buffer, 0, length), f = new Float32Array(buffer, 0, length);
  let p = 0;
  while (p < length) {
    const tag = w[p++];
    if (tag === TAG_OBJ) handlers.object();
    else if (tag === TAG_DRAW) {
      handlers.draw({ indexed: !!w[p], prim: w[p + 1], primCount: w[p + 2], startVertex: w[p + 3], baseVertex: w[p + 4], startIndex: w[p + 5] });
      p += 6;
    } else if (tag === TAG_STATE) {
      const mask = w[p++], d = {};
      if (mask & (1 << S_RS)) { const n = w[p++], a = d.rs = new Array(n); for (let i = 0; i < n; i++, p += 2) a[i] = [w[p], w[p + 1] >>> 0]; }
      if (mask & (1 << S_SAMPLERS)) { const n = w[p++], a = d.samplers = new Array(n); for (let i = 0; i < n; i++, p += 3) a[i] = [w[p], w[p + 1], w[p + 2] >>> 0]; }
      if (mask & (1 << S_TEX)) { const n = w[p++], a = d.tex = new Array(n); for (let i = 0; i < n; i++, p += 2) a[i] = [w[p], w[p + 1]]; }
      if (mask & (1 << S_STREAMS)) {
        const n = w[p++], a = d.streams = new Array(n);
        for (let i = 0; i < n; i++, p += 5) a[i] = [w[p], { vb: w[p + 1], offset: w[p + 2], stride: w[p + 3], freq: w[p + 4] >>> 0 }];
      }
      if (mask & (1 << S_IB)) d.ib = w[p++];
      if (mask & (1 << S_DECL)) { const id = w[p++]; d.decl = id ? decls.get(id) : null; }
      if (mask & (1 << S_VS)) d.vs = w[p++];
      if (mask & (1 << S_PS)) d.ps = w[p++];
      if (mask & (1 << S_RTS)) { d.rts = [w[p], w[p + 1], w[p + 2], w[p + 3]]; p += 4; }
      if (mask & (1 << S_DS)) d.ds = w[p++];
      if (mask & (1 << S_VIEWPORT)) { d.viewport = { x: w[p], y: w[p + 1], w: w[p + 2], h: w[p + 3], minZ: f[p + 4], maxZ: f[p + 5] }; p += 6; }
      if (mask & (1 << S_SCISSOR)) { d.scissor = { l: w[p], t: w[p + 1], r: w[p + 2], b: w[p + 3] }; p += 4; }
      if (mask & (1 << S_CLIP)) { d.clip = f.subarray(p, p + 24); p += 24; }
      for (const [bit, key] of ROWS) if (mask & (1 << bit)) {
        const n = w[p++], a = d[key] = new Array(n);
        for (let i = 0; i < n; i++) { const start = w[p], count = w[p + 1]; a[i] = [start, f.subarray(p + 2, p + 2 + count * 4)]; p += 2 + count * 4; }
      }
      for (const [bit, key] of INTS) if (mask & (1 << bit)) {
        const n = w[p++], a = d[key] = new Array(n);
        for (let i = 0; i < n; i++, p += 5) a[i] = [w[p], Array.from(w.subarray(p + 1, p + 5))];
      }
      for (const [bit, key] of BOOLS) if (mask & (1 << bit)) {
        const n = w[p++], a = d[key] = new Array(n);
        for (let i = 0; i < n; i++, p += 2) a[i] = [w[p], w[p + 1] >>> 0];
      }
      handlers.state(d);
    } else throw new Error(`corrupt op stream: tag ${tag} at word ${p - 1}`);
  }
}
const ROWS = [[S_VSF, 'vsF'], [S_PSF, 'psF']], INTS = [[S_VSI, 'vsI'], [S_PSI, 'psI']], BOOLS = [[S_VSB, 'vsB'], [S_PSB, 'psB']];
