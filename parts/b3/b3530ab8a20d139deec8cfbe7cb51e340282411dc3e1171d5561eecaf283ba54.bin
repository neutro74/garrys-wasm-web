import {FramePacer} from './frame-pacer.mjs';
import {RenderBlobArena} from './render-blob-arena.mjs';
import {OpWriter, S_RS, S_SAMPLERS, S_TEX, S_STREAMS, S_IB, S_DECL, S_VS, S_PS, S_RTS, S_DS, S_VIEWPORT, S_SCISSOR, S_CLIP, S_VSF, S_PSF, S_VSI, S_PSI, S_VSB, S_PSB, TAG_STATE} from './op-stream.mjs';
// Turns D3D9 device calls into renderer ops (see runtime/d3d9/ops.js). The device model hands the backend raw guest
// memory and live state; this keeps a mirror of what the renderer has and emits only the differences.
import { BPP, BLOCK_FORMATS } from './d3d9.mjs';
import { HTML_MARKER } from './html.mjs';

const SLOTS = 21;

const freshMirror = () => ({
  rs: new Uint32Array(256), samplers: Array.from({ length: SLOTS }, () => new Uint32Array(14)), tex: new Array(SLOTS).fill(0),
  streams: Array.from({ length: 16 }, () => ({ vb: 0, offset: 0, stride: 0, freq: 1 })), ib: 0, decl: null, vs: 0, ps: 0,
  rts: [0, 0, 0, 0], ds: 0, viewport: null, scissor: null, clip: new Float32Array(24),
  vsF: new Float32Array(1024), psF: new Float32Array(1024), vsI: new Int32Array(64), psI: new Int32Array(64), vsB: new Uint32Array(16), psB: new Uint32Array(16),
});

export class OpBackend {
  constructor({ shotEvery = 0, shotPrefix = 'frame', targetFps = 0 } = {}) {
    this.stats = { draws: 0, clears: 0, presents: 0, uploads: 0, stretch: 0, copies: 0, bytes: 0 };
    this.mirror = freshMirror(); this.known = new Set();this.fullBindings=true;
    this.pacer=targetFps>0?new FramePacer(targetFps):null;
    this.shotEvery = shotEvery; this.shotPrefix = shotPrefix; this.frame = 0;
  }
  attach(g) { this.g = g; }
  resize(w, h) { this.mirror = freshMirror();this.fullBindings=true; for(const dev of this.g?.d3dRuntime?.devices ?? []) if(dev.constantDirty){for(const key of Object.keys(dev.constantDirty))dev.constantDirty[key]=true;dev.constRange={};} this.send({ o: 'resize', w, h }); }

  // Subclasses decide where an op goes: straight into a renderer, or batched to another process.
  send(json, blob) { this.emit(json, blob); }
  flush() {}

  // Level surfaces of textures are never announced by the device model; describe them on first use.
  ensure(st) {
    if (!st || this.known.has(st.object)) return;
    this.known.add(st.object);
    if (st.parent) this.send({ o: 'surf', id: st.object, d: { textureId: st.parent.object, face: st.face, level: st.level, w: st.w, h: st.h, format: st.format } });
  }

  createResource(st) {
    this.known.add(st.object);
    switch (st.kind) {
      case 'texture': case 'cube': case 'voltex':
        this.send({ o: 'tex', id: st.object, d: { kind: st.texKind, w: st.w, h: st.h, d: st.d, levels: st.levels, format: st.format, usage: st.usage, pool: st.pool } }); break;
      case 'surface':
        this.send({ o: 'surf', id: st.object, d: { w: st.w, h: st.h, format: st.format, usage: st.usage, present: st.kindOf === 'backbuffer' } }); break;
      case 'vb': case 'ib':
        this.send({ o: 'buf', id: st.object, d: { kind: st.kind, size: st.size, format: st.format } }); break;
      case 'vs': case 'ps':
        this.send({ o: 'sh', id: st.object, stage: st.stage }, st.bytecode); break;
      default: throw new Error(`remote backend: unknown resource kind ${st.kind}`);
    }
  }
  destroyResource(st) { if (this.known.delete(st.object)) this.send({ o: 'del', id: st.object }); }

  // Rows of the locked region, tightly packed.
  region(format, ptr, pitch, w, h, rect) {
    const g = this.g, block = BLOCK_FORMATS.get(format);
    const rw = rect ? rect.r - rect.l : w, rh = rect ? rect.b - rect.t : h;
    const rowBytes = block ? Math.max(1, (rw + 3) >> 2) * block : rw * BPP.get(format);
    const rows = block ? Math.max(1, (rh + 3) >> 2) : rh;
    const off = rect ? (block ? (rect.t >> 2) * pitch + (rect.l >> 2) * block : rect.t * pitch + rect.l * BPP.get(format)) : 0;
    // A backend that consumes ops synchronously can read guest memory in place: no copy, no garbage. Uncompressed
    // rows keep the guest pitch as their stride (the renderer unpacks with UNPACK_ROW_LENGTH).
    if ((this.directBlobs && (pitch === rowBytes || rows === 1 || !block)) || (this.snapshotBlobs && (pitch === rowBytes || rows === 1)))
      return { bytes: g.u8.subarray(ptr + off, ptr + off + (rows - 1) * pitch + rowBytes), rowBytes: rows === 1 ? rowBytes : pitch, rows };
    const out = new Uint8Array(rowBytes * rows);
    for (let r = 0; r < rows; r++) out.set(g.u8.subarray(ptr + off + r * pitch, ptr + off + r * pitch + rowBytes), r * rowBytes);
    return { bytes: out, rowBytes, rows };
  }

  uploadTexture(tex, face, level, rect, ptr, pitch) {
    this.stats.uploads++;
    if (tex.texKind === '3d') return;
    const lay = tex.layouts[level];
    const r = this.region(tex.format, ptr, pitch, lay.w, lay.h, rect);
    // The marker is the first pixel, so a full upload or any sub-rectangle starting at the origin carries it.
    if (level === 0 && (!rect || (rect.l === 0 && rect.t === 0))) this.noteHtmlTexture(tex, r.bytes);
    this.send({ o: 'ut', id: tex.object, face, level, rect, rowBytes: r.rowBytes, rows: r.rows }, r.bytes);
  }

  // HTML panel textures carry a marker in their first pixel (see html.mjs); remember which panel each one shows.
  noteHtmlTexture(tex, b) {
    const bgr = b[0] === HTML_MARKER[0] && b[1] === HTML_MARKER[1] && b[2] === HTML_MARKER[2];
    const rgb = b[0] === HTML_MARKER[2] && b[1] === HTML_MARKER[1] && b[2] === HTML_MARKER[0];
    if ((bgr || rgb) && b[3] === 0 && b.length >= 8) {
      if (!this.htmlTextures?.has(tex.object)) this.g?.log(`[html] panel ${b[4] | (b[5] << 8)} is texture ${tex.object} (${tex.format}, ${tex.layouts[0].w}x${tex.layouts[0].h})`);
      (this.htmlTextures ||= new Map()).set(tex.object, b[4] | (b[5] << 8));
    }
    else this.htmlTextures?.delete(tex.object);
  }

  // Screen rectangle of a draw, from its POSITION0 vertices and the stdshader matrices (model c58-c60, view-projection
  // c8-c11, as UnlitGeneric uses). Only used for HTML panel quads.
  drawRect(dev, call) {
    const g = this.g, decl = dev.decl?.elements;
    const pos = decl?.find((e) => e.usage === 0 && e.usageIndex === 0);
    if (!pos || pos.type > 3) return null;
    const stream = call.up ? { base: call.vertexData, stride: call.stride } : { base: dev.streams[pos.stream].vb?.data + dev.streams[pos.stream].offset, stride: dev.streams[pos.stream].stride };
    if (!stream.base || !stream.stride) return null;
    const verts = [];
    if (call.indexed) {
      const isz = (call.up ? call.indexFormat : dev.ib?.format) === 102 ? 4 : 2;
      const ib = call.up ? call.indexData : dev.ib?.data + (call.startIndex | 0) * isz;
      const n = call.prim === 4 ? call.primCount * 3 : call.primCount + 2;
      for (let k = 0; k < n; k++) verts.push((isz === 4 ? g.u32(ib + 4 * k) : g.dv.getUint16(ib + 2 * k, true)) + (call.baseVertex | 0));
    } else for (let k = 0; k < call.numVerts; k++) verts.push((call.startVertex | 0) + k);
    const c = dev.vsF, row = (r, x, y, z, w) => c[r * 4] * x + c[r * 4 + 1] * y + c[r * 4 + 2] * z + c[r * 4 + 3] * w;
    const hasModel = [58, 59, 60].some((r) => c[r * 4] || c[r * 4 + 1] || c[r * 4 + 2] || c[r * 4 + 3]);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const v of verts) {
      const a = stream.base + v * stream.stride + pos.offset;
      let x = g.dv.getFloat32(a, true), y = g.dv.getFloat32(a + 4, true), z = pos.type >= 2 ? g.dv.getFloat32(a + 8, true) : 0;
      if (hasModel) [x, y, z] = [row(58, x, y, z, 1), row(59, x, y, z, 1), row(60, x, y, z, 1)];
      const cw = row(11, x, y, z, 1);
      if (!cw) continue;
      const nx = row(8, x, y, z, 1) / cw, ny = row(9, x, y, z, 1) / cw;
      const vp = dev.viewport;
      const px = vp.x + (nx + 1) / 2 * vp.w, py = vp.y + (1 - ny) / 2 * vp.h;
      x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
    }
    return Number.isFinite(x0) ? { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) } : null;
  }
  uploadBuffer(buf, offset, size) {
    this.stats.uploads++;
    const from = buf.data + offset;
    this.send({ o: 'ub', id: buf.object, offset }, (this.directBlobs || this.snapshotBlobs) ? this.g.u8.subarray(from, from + size) : this.g.u8.slice(from, from + size));
  }
  generateMips(tex) { this.send({ o: 'mips', id: tex.object }); }

  // System-memory surface -> default-pool level (IDirect3DDevice9::UpdateSurface).
  copySurface(src, srcRect, dst, dstPt) {
    this.stats.copies++;
    if (!src.shadow || !dst.parent) { this.warn('copySurface to a non-texture surface is not implemented'); return; }
    const w = srcRect ? srcRect.r - srcRect.l : src.w, h = srcRect ? srcRect.b - srcRect.t : src.h;
    const r = this.region(src.format, src.shadow, src.pitch, src.w, src.h, srcRect);
    const rect = { l: dstPt ? dstPt.x : 0, t: dstPt ? dstPt.y : 0, r: (dstPt ? dstPt.x : 0) + w, b: (dstPt ? dstPt.y : 0) + h };
    this.send({ o: 'ut', id: dst.parent.object, face: dst.face, level: dst.level, rect, rowBytes: r.rowBytes, rows: r.rows }, r.bytes);
  }
  readbackSurface() { this.warn('synchronous render-target readback is unavailable on the remote backend'); return false; }
  warn(text) { if (!this.warned) this.warned = new Set(); if (!this.warned.has(text)) { this.warned.add(text); console.log(`[d3d9-remote] ${text}`); } }

  stretchRect(src, srcRect, dst, dstRect, filter) {
    this.stats.stretch++;
    this.ensure(src); this.ensure(dst);
    this.send({ o: 'stretch', src: src.object, srcRect, dst: dst.object, dstRect, filter });
  }
  colorFill(surf, rect, color) { this.ensure(surf); this.send({ o: 'fill', id: surf.object, rect, color }); }
  queryResult() { return 0xffff; }

  // Everything the renderer mirrors, as a delta against what was last sent.
  stateDelta(dev) {
    const m = this.mirror, d = {}, floats = [];
    // Render and sampler states are only rescanned after a setter actually changed one.
    const dirty = dev.constantDirty;
    if (!dirty || dirty.rs !== false) {
      if (dirty) dirty.rs = false;
      const rs = []; for (let i = 0; i < 256; i++) if (dev.rs[i] !== m.rs[i]) { rs.push([i, dev.rs[i]]); m.rs[i] = dev.rs[i]; } if (rs.length) d.rs = rs;
    }
    if (!dirty || dirty.samplers !== false) {
      if (dirty) dirty.samplers = false;
      const sm = [];
      for (let s = 0; s < SLOTS; s++) for (let k = 0; k < 14; k++) if (dev.samplers[s][k] !== m.samplers[s][k]) { sm.push([s, k, dev.samplers[s][k]]); m.samplers[s][k] = dev.samplers[s][k]; }
      if (sm.length) d.samplers = sm;
    }
    let tex = null;
    for(let bits=this.fullBindings?(1<<SLOTS)-1:(dev.textureDirty??(1<<SLOTS)-1);bits;bits&=bits-1){
      const s=31-Math.clz32(bits&-bits),id=dev.tex[s]?.object??0;
      if(id!==m.tex[s]){(tex??=[]).push([s,id]);m.tex[s]=id;}
    }
    dev.textureDirty=0;
    if (tex) d.tex = tex;
    let streams = null;
    for(let bits=this.fullBindings?0xffff:(dev.streamDirty??0xffff);bits;bits&=bits-1){
      const n=31-Math.clz32(bits&-bits);
      const s = dev.streams[n], old = m.streams[n], vb = s.vb?.object ?? 0;
      if (vb !== old.vb || s.offset !== old.offset || s.stride !== old.stride || s.freq !== old.freq) {
        const cur = { vb, offset: s.offset, stride: s.stride, freq: s.freq }; (streams ??= []).push([n, cur]); m.streams[n] = cur;
      }
    }
    dev.streamDirty=0;this.fullBindings=false;
    if (streams) d.streams = streams;
    const ib = dev.ib?.object ?? 0; if (ib !== m.ib) { d.ib = ib; m.ib = ib; }
    if (dev.decl !== m.decl) { m.decl = dev.decl; d.decl = dev.decl ? dev.decl.elements : null; }
    const vs = dev.vs?.object ?? 0; if (vs !== m.vs) { d.vs = vs; m.vs = vs; }
    const ps = dev.ps?.object ?? 0; if (ps !== m.ps) { d.ps = ps; m.ps = ps; }
    let rtsChanged = false;
    for (let i = 0; i < 4; i++) { const r = dev.rts[i]; if (r) this.ensure(r); if ((r?.object ?? 0) !== m.rts[i]) rtsChanged = true; }
    if (rtsChanged) { const rts = dev.rts.map((r) => r?.object ?? 0); d.rts = rts; m.rts = rts; }
    const ds = dev.ds?.object ?? 0; if (ds !== m.ds) { this.ensure(dev.ds); d.ds = ds; m.ds = ds; }
    const v = dev.viewport, mv = m.viewport;
    if (!mv || v.x !== mv.x || v.y !== mv.y || v.w !== mv.w || v.h !== mv.h || v.minZ !== mv.minZ || v.maxZ !== mv.maxZ) { d.viewport = v; m.viewport = { ...v }; }
    const sc = dev.scissor, ms = m.scissor;
    if (!ms || sc.l !== ms.l || sc.t !== ms.t || sc.r !== ms.r || sc.b !== ms.b) { d.scissor = { l: sc.l, t: sc.t, r: sc.r, b: sc.b }; m.scissor = d.scissor; }
    for (let i = 0; i < 24; i++) if (dev.clipPlanes[i] !== m.clip[i]) { d.clip = Array.from(dev.clipPlanes); m.clip.set(dev.clipPlanes); break; }
    const rows = (key, mkey, flag) => {
      const out = [];
      if (dev.constantDirty?.[key] === false) return out;
      if (dev.constantDirty) dev.constantDirty[key] = false;
      // Only rows written since the last delta can differ (all of them after a reset or state-block restore).
      const range = dev.constRange?.[key], lo = range ? range[0] : 0, hi = range ? Math.min(range[1], 256) : 256;
      if(dev.constRange){if(range){range[0]=256;range[1]=0;}else dev.constRange[key]=[256,0];}
      for (let r = lo; r < hi;) {
        let same = true; for (let k = 0; k < 4; k++) if (dev[key][r * 4 + k] !== m[mkey][r * 4 + k]) same = false;
        if (same) { r++; continue; }
        let e = r + 1;
        while (e < hi) { let s2 = true; for (let k = 0; k < 4; k++) if (dev[key][e * 4 + k] !== m[mkey][e * 4 + k]) s2 = false; if (s2) break; e++; }
        // The in-thread renderer applies the op at once, so it can take views of the device's own arrays.
        if (this.directBlobs) (d[key] ??= []).push([r, dev[key].subarray(r * 4, e * 4)]);
        else { out.push([flag, r, e - r]); floats.push(dev[key].subarray(r * 4, e * 4)); }
        m[mkey].set(dev[key].subarray(r * 4, e * 4), r * 4);
        r = e;
      }
      return out;
    };
    const cf = [...rows('vsF', 'vsF', 0), ...rows('psF', 'psF', 1)];
    if (cf.length) d.cf = cf;
    for (const [key, name] of [['vsI', 'vsI'], ['psI', 'psI']]) {
      if (dev.constantDirty?.[key] === false) continue;
      if (dev.constantDirty) dev.constantDirty[key] = false;
      const out = [];
      for (let i = 0; i < 16; i++) {
        const a = dev[key].subarray(i * 4, i * 4 + 4), b = m[name].subarray(i * 4, i * 4 + 4);
        if (a.some((v, k) => v !== b[k])) { out.push([i, Array.from(a)]); b.set(a); }
      }
      if (out.length) d[name] = out;
    }
    for (const key of ['vsB', 'psB']) {
      if (dev.constantDirty?.[key] === false) continue;
      if (dev.constantDirty) dev.constantDirty[key] = false;
      const out = [];
      for (let i = 0; i < 16; i++) if (dev[key][i] !== m[key][i]) { out.push([i, dev[key][i]]); m[key][i] = dev[key][i]; }
      if (out.length) d[key] = out;
    }
    return { d, blob: floats.length ? this.combineBlobs(floats) : null };
  }


  // Same diff as stateDelta, written straight into the binary op stream (this.writer) with no intermediate objects.
  // Section order and dirty-flag handling must stay in step with stateDelta and decodeWords (op-stream.mjs).
  encodeState(dev) {
    const m = this.mirror, wr = this.writer;
    // Level surfaces are announced (as object ops) before the record that uses them, so do that first.
    for (let i = 0; i < 4; i++) { const r = dev.rts[i]; if (r) this.ensure(r); }
    if ((dev.ds?.object ?? 0) !== m.ds) this.ensure(dev.ds);
    const declId = dev.decl !== m.decl && dev.decl ? this.internDecl(dev.decl.elements) : 0;
    wr.need(1024); const start = wr.pos; let w = wr.i32, f = wr.f32, p = start + 2, mask = 0;
    const room = (n) => { wr.pos = p; wr.need(n); w = wr.i32; f = wr.f32; };
    const dirty = dev.constantDirty;
    if (!dirty || dirty.rs !== false) {
      if (dirty) dirty.rs = false;
      let n = 0; if (p + 8 > w.length) room(1024); const at = p++;
      for (let i = 0; i < 256; i++) { const v = dev.rs[i]; if (v !== m.rs[i]) { if (p + 2 > w.length) room(1024); w[p++] = i; w[p++] = v | 0; m.rs[i] = v; n++; } }
      if (n) { w[at] = n; mask |= 1 << S_RS; } else p = at;
    }
    if (!dirty || dirty.samplers !== false) {
      if (dirty) dirty.samplers = false;
      let n = 0; if (p + 8 > w.length) room(1024); const at = p++;
      for (let s = 0; s < SLOTS; s++) { const cur = dev.samplers[s], old = m.samplers[s]; for (let k = 0; k < 14; k++) if (cur[k] !== old[k]) { if (p + 3 > w.length) room(1024); w[p++] = s; w[p++] = k; w[p++] = cur[k] | 0; old[k] = cur[k]; n++; } }
      if (n) { w[at] = n; mask |= 1 << S_SAMPLERS; } else p = at;
    }
    {
      let n = 0; if (p + 8 > w.length) room(1024); const at = p++;
      for (let bits = this.fullBindings ? (1 << SLOTS) - 1 : (dev.textureDirty ?? (1 << SLOTS) - 1); bits; bits &= bits - 1) {
        const s = 31 - Math.clz32(bits & -bits), id = dev.tex[s]?.object ?? 0;
        if (id !== m.tex[s]) { if (p + 2 > w.length) room(1024); w[p++] = s; w[p++] = id; m.tex[s] = id; n++; }
      }
      dev.textureDirty = 0;
      if (n) { w[at] = n; mask |= 1 << S_TEX; } else p = at;
    }
    {
      let n = 0; if (p + 8 > w.length) room(1024); const at = p++;
      for (let bits = this.fullBindings ? 0xffff : (dev.streamDirty ?? 0xffff); bits; bits &= bits - 1) {
        const k = 31 - Math.clz32(bits & -bits), s = dev.streams[k], old = m.streams[k], vb = s.vb?.object ?? 0;
        if (vb !== old.vb || s.offset !== old.offset || s.stride !== old.stride || s.freq !== old.freq) {
          if (p + 5 > w.length) room(1024);
          w[p++] = k; w[p++] = vb; w[p++] = s.offset; w[p++] = s.stride; w[p++] = s.freq;
          m.streams[k] = { vb, offset: s.offset, stride: s.stride, freq: s.freq }; n++;
        }
      }
      dev.streamDirty = 0; this.fullBindings = false;
      if (n) { w[at] = n; mask |= 1 << S_STREAMS; } else p = at;
    }
    if (p + 64 > w.length) room(1024);
    const ib = dev.ib?.object ?? 0; if (ib !== m.ib) { w[p++] = ib; m.ib = ib; mask |= 1 << S_IB; }
    if (dev.decl !== m.decl) { m.decl = dev.decl; w[p++] = declId; mask |= 1 << S_DECL; }
    const vs = dev.vs?.object ?? 0; if (vs !== m.vs) { w[p++] = vs; m.vs = vs; mask |= 1 << S_VS; }
    const ps = dev.ps?.object ?? 0; if (ps !== m.ps) { w[p++] = ps; m.ps = ps; mask |= 1 << S_PS; }
    let rtsChanged = false;
    for (let i = 0; i < 4; i++) if ((dev.rts[i]?.object ?? 0) !== m.rts[i]) rtsChanged = true;
    if (rtsChanged) { for (let i = 0; i < 4; i++) { m.rts[i] = dev.rts[i]?.object ?? 0; w[p++] = m.rts[i]; } mask |= 1 << S_RTS; }
    const ds = dev.ds?.object ?? 0; if (ds !== m.ds) { w[p++] = ds; m.ds = ds; mask |= 1 << S_DS; }
    const v = dev.viewport, mv = m.viewport;
    if (!mv || v.x !== mv.x || v.y !== mv.y || v.w !== mv.w || v.h !== mv.h || v.minZ !== mv.minZ || v.maxZ !== mv.maxZ) {
      w[p++] = v.x; w[p++] = v.y; w[p++] = v.w; w[p++] = v.h; f[p++] = v.minZ; f[p++] = v.maxZ; m.viewport = { ...v }; mask |= 1 << S_VIEWPORT;
    }
    const sc = dev.scissor, ms = m.scissor;
    if (!ms || sc.l !== ms.l || sc.t !== ms.t || sc.r !== ms.r || sc.b !== ms.b) { w[p++] = sc.l; w[p++] = sc.t; w[p++] = sc.r; w[p++] = sc.b; m.scissor = { l: sc.l, t: sc.t, r: sc.r, b: sc.b }; mask |= 1 << S_SCISSOR; }
    for (let i = 0; i < 24; i++) if (dev.clipPlanes[i] !== m.clip[i]) { f.set(dev.clipPlanes, p); p += 24; m.clip.set(dev.clipPlanes); mask |= 1 << S_CLIP; break; }
    for (const [key, bit] of [['vsF', S_VSF], ['psF', S_PSF]]) {
      if (dev.constantDirty?.[key] === false) continue;
      if (dev.constantDirty) dev.constantDirty[key] = false;
      // Only rows written since the last delta can differ (all of them after a reset or state-block restore).
      const range = dev.constRange?.[key], lo = range ? range[0] : 0, hi = range ? Math.min(range[1], 256) : 256;
      if (dev.constRange) { if (range) { range[0] = 256; range[1] = 0; } else dev.constRange[key] = [256, 0]; }
      const cur = dev[key], old = m[key]; let n = 0; if (p + 8 > w.length) room(1024); const at = p++;
      for (let r = lo; r < hi;) {
        if (cur[r * 4] === old[r * 4] && cur[r * 4 + 1] === old[r * 4 + 1] && cur[r * 4 + 2] === old[r * 4 + 2] && cur[r * 4 + 3] === old[r * 4 + 3]) { r++; continue; }
        let e = r + 1;
        while (e < hi && !(cur[e * 4] === old[e * 4] && cur[e * 4 + 1] === old[e * 4 + 1] && cur[e * 4 + 2] === old[e * 4 + 2] && cur[e * 4 + 3] === old[e * 4 + 3])) e++;
        if (p + 2 + (e - r) * 4 > w.length) room(2 + (e - r) * 4 + 1024);
        w[p++] = r; w[p++] = e - r;
        f.set(cur.subarray(r * 4, e * 4), p); p += (e - r) * 4; old.set(cur.subarray(r * 4, e * 4), r * 4); n++;
        r = e;
      }
      if (n) { w[at] = n; mask |= 1 << bit; } else p = at;
    }
    for (const [key, bit] of [['vsI', S_VSI], ['psI', S_PSI]]) {
      if (dev.constantDirty?.[key] === false) continue;
      if (dev.constantDirty) dev.constantDirty[key] = false;
      let n = 0; if (p + 8 > w.length) room(1024); const at = p++; if (p + 16 * 5 > w.length) room(1024);
      for (let i = 0; i < 16; i++) {
        const a = dev[key], b = m[key], o = i * 4;
        if (a[o] !== b[o] || a[o + 1] !== b[o + 1] || a[o + 2] !== b[o + 2] || a[o + 3] !== b[o + 3]) {
          w[p++] = i; w[p++] = a[o]; w[p++] = a[o + 1]; w[p++] = a[o + 2]; w[p++] = a[o + 3]; b.set(a.subarray(o, o + 4), o); n++;
        }
      }
      if (n) { w[at] = n; mask |= 1 << bit; } else p = at;
    }
    for (const [key, bit] of [['vsB', S_VSB], ['psB', S_PSB]]) {
      if (dev.constantDirty?.[key] === false) continue;
      if (dev.constantDirty) dev.constantDirty[key] = false;
      let n = 0; if (p + 8 > w.length) room(1024); const at = p++; if (p + 32 > w.length) room(1024);
      for (let i = 0; i < 16; i++) if (dev[key][i] !== m[key][i]) { w[p++] = i; w[p++] = dev[key][i] | 0; m[key][i] = dev[key][i]; n++; }
      if (n) { w[at] = n; mask |= 1 << bit; } else p = at;
    }
    if (!mask) { wr.pos = start; return; }
    // `start` may predate a buffer growth: the words copied across with the buffer, so only the header is written now.
    w[start] = TAG_STATE; w[start + 1] = mask; wr.pos = p;
  }

  // Declarations are sent once, as an object op, and referenced by id afterwards (the renderer keeps its per-declaration
  // caches keyed by array identity, which a fresh structured clone per change would defeat).
  internDecl(elements) {
    const ids = this.declIds ??= new WeakMap();
    let id = ids.get(elements);
    if (!id) { id = ids.get(elements) ?? (this.nextDecl = (this.nextDecl ?? 0) + 1); ids.set(elements, id); this.send({ o: 'decl', id, elements }); }
    return id;
  }

  combineBlobs(arrays) {return concatBytes(arrays);}

  sendState(dev) {
    if (this.writer) { this.encodeState(dev); return; }
    const { d, blob } = this.stateDelta(dev);
    if (Object.keys(d).length) this.send({ o: 'st', d }, blob);
  }

  clear(dev, flags, color, z, stencil, rects) {
    this.stats.clears++;
    this.sendState(dev);
    this.send({ o: 'clear', flags, color, z, stencil, rects: rects && rects.length ? rects : null });
  }

  draw(dev, call) {
    this.stats.draws++;
    const panel = this.htmlTextures?.get(dev.tex[0]?.object);
    if (panel !== undefined) {
      const r = this.drawRect(dev, call);
      if (r && r.w > 0 && r.h > 0) (this.htmlRects ||= new Map()).set(panel, r);
    }
    this.sendState(dev);
    const g = this.g;
    if (call.up) {
      const v = g.u8.subarray(call.vertexData, call.vertexData + call.vertexBytes);
      const i = call.indexed ? g.u8.subarray(call.indexData, call.indexData + call.indexBytes) : new Uint8Array(0);
      const blob = this.combineBlobs([v,i]);
      const { vertexData, indexData, ...rest } = call; void vertexData; void indexData;
      this.send({ o: 'drawUp', call: rest, vlen: v.length }, blob);
    } else if (this.writer) this.writer.draw(call);
    else this.send({ o: 'draw', call });
  }

  present(dev) {
    this.pacer?.pace();
    this.stats.presents++;
    this.frame++;
    if(this.g?.hostCounts && this.frame%300===0){console.log('[host-counts]',JSON.stringify([...this.g.hostCounts].sort((a,b)=>b[1]-a[1]).slice(0,40)));this.g.hostCounts.clear();}
    this.send({ o: 'present', bb: dev.backBuffer.object, html: this.htmlRects ? [...this.htmlRects] : [] });
    this.htmlRects?.clear();
    if (this.shotEvery && this.frame % this.shotEvery === 0) this.send({ o: 'shot', name: `${this.shotPrefix}-${String(this.frame).padStart(5, '0')}.png` });
    this.flush();
  }

  shot(name) { this.send({ o: 'shot', name }); this.flush(); }
}


// Applies ops directly to a renderer in the same thread (the browser host).
export class DirectBackend extends OpBackend {
  constructor(renderer, applyOp, options) { super(options); this.renderer = renderer; this.applyOp = applyOp; this.directBlobs = true; }
  emit(json, blob) { this.applyOp(this.renderer, json, blob); }
  readbackSurface(src, destination, pitch) {
    if (![21,22,32,33].includes(src.format)) { this.warn(`readback format ${src.format} is unsupported`); return false; }
    const gl=this.renderer.gl,previous=gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),pack=gl.getParameter(gl.PACK_ALIGNMENT);
    const pixels=new Uint8Array(src.w*src.h*4);
    try {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,this.renderer.fboFor([src.object,0,0,0],0));
      gl.pixelStorei(gl.PACK_ALIGNMENT,1);
      gl.readPixels(0,0,src.w,src.h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      if(gl.getError()!==gl.NO_ERROR)return false;
      for(let y=0;y<src.h;y++)for(let x=0;x<src.w;x++){
        const at=(y*src.w+x)*4,to=destination+y*pitch+x*4,bgra=src.format===21||src.format===22;
        this.g.u8[to]=pixels[at+(bgra?2:0)];this.g.u8[to+1]=pixels[at+1];this.g.u8[to+2]=pixels[at+(bgra?0:2)];this.g.u8[to+3]=src.format===22||src.format===33?255:pixels[at+3];
      }
      return true;
    } finally {gl.pixelStorei(gl.PACK_ALIGNMENT,pack);gl.bindFramebuffer(gl.READ_FRAMEBUFFER,previous);}
  }
}

// Byte concatenation of typed arrays (no Node Buffer: this also runs in the browser).
function concatBytes(arrays) {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.byteLength, 0));
  let at = 0;
  for (const a of arrays) { out.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), at); at += a.byteLength; }
  return out;
}

// Applies ops in a renderer worker (web/render-worker.js) that owns the page's canvas, so the WebGL work runs on
// another core and frames present normally (that worker returns to its event loop; the guest worker never does).
// Ops are batched and posted once per present (and before a synchronous readback); blobs are copied out of guest
// memory. The guest waits at present only if the renderer falls more than one frame behind.
export class WorkerBackend extends OpBackend {
  constructor(port, options = {}) {
    super(options);
    this.port = port; this.ops = []; this.blobs = []; this.directBlobs = false; this.waitedMs = 0;
    this.writer = options.binaryOps === false ? null : new OpWriter();   // hot ops (draw, state) travel as words, not objects
    this.sync = new Int32Array(new SharedArrayBuffer(16));     // [0] frames sent, [1] frames done, [2] readback state
    this.blobArena = (options.blobArenaBytes ?? (4<<20)) > 0 ? new RenderBlobArena(this.sync,{capacity:options.blobArenaBytes ?? (4<<20)}) : null;
    this.snapshotBlobs=!!this.blobArena;
    this.onPresent = options.onPresent ?? null;
    port.postMessage({ type: 'sync', sync: this.sync.buffer });
  }
  // Time since the last call spent sleeping in the frame pacer (idle) and blocked on a renderer that fell behind
  // (GPU/renderer bound). Everything else is the guest's own CPU work. Used by the ?perf=1 readout.
  takePerf() { const r = { sleptMs: this.pacer?.sleptMs ?? 0, waitedMs: this.waitedMs }; if (this.pacer) this.pacer.sleptMs = 0; this.waitedMs = 0; return r; }
  combineBlobs(arrays) {return this.blobArena ? this.blobArena.concatenate(arrays) : concatBytes(arrays);}
  present(dev) { this.size = [dev.backBuffer.w, dev.backBuffer.h]; super.present(dev); }
  emit(json, blob) {
    if (blob) {
      // Guest bytes are snapshotted now: either into a protected arena or an owned transferable buffer.
      const b = this.blobArena?.owns(blob) ? blob :
        this.blobArena && blob.buffer instanceof SharedArrayBuffer ? this.blobArena.snapshot(blob) :
        blob.byteOffset || blob.byteLength !== blob.buffer.byteLength || !(blob.buffer instanceof ArrayBuffer) ? blob.slice() : blob;
      json.b = this.blobs.length; this.blobs.push(b);
    }
    this.ops.push(json); this.writer?.obj();
    if (json.o === 'present') this.presented = json.html;
  }
  flush() {
    if (!this.ops.length && !this.writer?.pos) return;
    const present = this.presented !== undefined, html = this.presented; this.presented = undefined;
    let sequence=0;
    if (present) {
      // Backpressure: at most one frame queued behind the one the renderer is drawing.
      const sent = sequence = Atomics.add(this.sync, 0, 1) + 1;
      for (;;) {
        const done = Atomics.load(this.sync, 1);
        if (sent - done <= 2) break;
        // Wait on the same value used by the capacity check. A second load here
        // can observe a drained queue and sleep for 50 ms with no work pending.
        const t0 = performance.now();
        Atomics.wait(this.sync, 1, done, 50);
        this.waitedMs += performance.now() - t0;
      }
    }
    const transfer = this.blobs.filter(b=>b.buffer instanceof ArrayBuffer).map(b=>b.buffer);
    const words = this.writer?.pos ? this.writer.take() : null;
    if (words) transfer.push(words.buffer);
    this.port.postMessage({ type: 'ops', ops: this.ops, blobs: this.blobs, present, words: words?.buffer, length: words?.length }, transfer);
    if(present)this.blobArena?.presented(sequence);
    this.ops = []; this.blobs = [];
    if (present) this.onPresent?.(html, this.size);
  }
  readbackSurface(src, destination, pitch) {
    if (![21, 22, 32, 33].includes(src.format)) { this.warn(`readback format ${src.format} is unsupported`); return false; }
    this.flush();
    const bytes = src.w * src.h * 4;
    if (!this.rbBuf || this.rbBuf.byteLength < bytes) this.rbBuf = new SharedArrayBuffer(bytes);
    Atomics.store(this.sync, 2, 0);
    this.port.postMessage({ type: 'readback', id: src.object, w: src.w, h: src.h, buf: this.rbBuf });
    const deadline = Date.now() + 10000;
    while (Atomics.load(this.sync, 2) === 0) { Atomics.wait(this.sync, 2, 0, 100); if (Date.now() > deadline) { this.warn('renderer readback timed out'); return false; } }
    if (Atomics.load(this.sync, 2) !== 1) return false;
    const px = new Uint8Array(this.rbBuf, 0, bytes), u8 = this.g.u8, bgra = src.format === 21 || src.format === 22, opaque = src.format === 22 || src.format === 33;
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const at = (y * src.w + x) * 4, to = destination + y * pitch + x * 4;
      u8[to] = px[at + (bgra ? 2 : 0)]; u8[to + 1] = px[at + 1]; u8[to + 2] = px[at + (bgra ? 0 : 2)]; u8[to + 3] = opaque ? 255 : px[at + 3];
    }
    return true;
  }
}
