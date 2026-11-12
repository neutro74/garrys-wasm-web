// Direct3D 9 host implementation for the lifted shaderapidx9.dll.
//
// Everything the engine can observe is modelled for real: COM object layout and
// reference counting, resource descriptors, mip-chain pitches, lockable memory
// in guest address space, render state / sampler / constant tracking, shader
// bytecode retention, vertex declarations, queries and swap chains.
//
// Pixel output is delegated to a `backend` (see NullBackend for the contract).
// The default NullBackend draws nothing and counts calls; a WebGL2/WebGPU
// backend plugs in through `guest.d3d9Backend`. Methods the model does not
// support throw instead of reporting success.
import { env as ENV } from './platform.mjs';

export const D3D_OK = 0;
const E_NOINTERFACE = 0x80004002 | 0;
const D3DERR = {
  INVALIDCALL: 0x8876086c | 0, NOTAVAILABLE: 0x8876086a | 0, OUTOFVIDEOMEMORY: 0x8876017c | 0,
  WASSTILLDRAWING: 0x8876021c | 0, DEVICELOST: 0x88760868 | 0,
};

// ---------------------------------------------------------------------------
// Formats
// ---------------------------------------------------------------------------
const fcc = (s) => s.charCodeAt(0) | (s.charCodeAt(1) << 8) | (s.charCodeAt(2) << 16) | (s.charCodeAt(3) << 24);
export const FMT = {
  R8G8B8: 20, A8R8G8B8: 21, X8R8G8B8: 22, R5G6B5: 23, X1R5G5B5: 24, A1R5G5B5: 25, A4R4G4B4: 26, R3G3B2: 27, A8: 28,
  A8R3G3B2: 29, X4R4G4B4: 30, A2B10G10R10: 31, A8B8G8R8: 32, X8B8G8R8: 33, G16R16: 34, A2R10G10B10: 35, A16B16G16R16: 36,
  A8P8: 40, P8: 41, L8: 50, A8L8: 51, A4L4: 52, V8U8: 60, L6V5U5: 61, X8L8V8U8: 62, Q8W8V8U8: 63, V16U16: 64,
  A2W10V10U10: 67, D16_LOCKABLE: 70, D32: 71, D15S1: 73, D24S8: 75, D24X8: 77, D24X4S4: 79, D16: 80, D32F_LOCKABLE: 82,
  D24FS8: 83, D32_LOCKABLE: 84, S8_LOCKABLE: 85, L16: 81, INDEX16: 101, INDEX32: 102, Q16W16V16U16: 110, R16F: 111,
  G16R16F: 112, A16B16G16R16F: 113, R32F: 114, G32R32F: 115, A32B32G32R32F: 116,
  DXT1: fcc('DXT1'), DXT2: fcc('DXT2'), DXT3: fcc('DXT3'), DXT4: fcc('DXT4'), DXT5: fcc('DXT5'),
  UYVY: fcc('UYVY'), YUY2: fcc('YUY2'), NULL: fcc('NULL'), INTZ: fcc('INTZ'), RAWZ: fcc('RAWZ'), DF16: fcc('DF16'), DF24: fcc('DF24'),
  ATI1: fcc('ATI1'), ATI2: fcc('ATI2'),
};
export const BLOCK_FORMATS = new Map([[FMT.DXT1, 8], [FMT.DXT2, 16], [FMT.DXT3, 16], [FMT.DXT4, 16], [FMT.DXT5, 16], [FMT.ATI1, 8], [FMT.ATI2, 16]]);
export const BPP = new Map([
  [FMT.R8G8B8, 3], [FMT.A8R8G8B8, 4], [FMT.X8R8G8B8, 4], [FMT.R5G6B5, 2], [FMT.X1R5G5B5, 2], [FMT.A1R5G5B5, 2], [FMT.A4R4G4B4, 2],
  [FMT.R3G3B2, 1], [FMT.A8, 1], [FMT.A8R3G3B2, 2], [FMT.X4R4G4B4, 2], [FMT.A2B10G10R10, 4], [FMT.A8B8G8R8, 4], [FMT.X8B8G8R8, 4],
  [FMT.G16R16, 4], [FMT.A2R10G10B10, 4], [FMT.A16B16G16R16, 8], [FMT.L8, 1], [FMT.A8L8, 2], [FMT.A4L4, 1], [FMT.V8U8, 2],
  [FMT.L6V5U5, 2], [FMT.X8L8V8U8, 4], [FMT.Q8W8V8U8, 4], [FMT.V16U16, 4], [FMT.A2W10V10U10, 4], [FMT.L16, 2],
  [FMT.D16_LOCKABLE, 2], [FMT.D32, 4], [FMT.D15S1, 2], [FMT.D24S8, 4], [FMT.D24X8, 4], [FMT.D24X4S4, 4], [FMT.D16, 2],
  [FMT.D32F_LOCKABLE, 4], [FMT.D24FS8, 4], [FMT.D32_LOCKABLE, 4], [FMT.S8_LOCKABLE, 1], [FMT.INDEX16, 2], [FMT.INDEX32, 4],
  [FMT.Q16W16V16U16, 8], [FMT.R16F, 2], [FMT.G16R16F, 4], [FMT.A16B16G16R16F, 8], [FMT.R32F, 4], [FMT.G32R32F, 8],
  [FMT.A32B32G32R32F, 16], [FMT.INTZ, 4], [FMT.RAWZ, 4], [FMT.DF16, 2], [FMT.DF24, 4], [FMT.NULL, 4],
]);
export const isDepthFormat = (f) => [70, 71, 73, 75, 77, 79, 80, 82, 83, 84, 85, FMT.INTZ, FMT.RAWZ, FMT.DF16, FMT.DF24].includes(f);
export function levelLayout(format, w, h) {
  const block = BLOCK_FORMATS.get(format);
  if (block) { const bw = Math.max(1, (w + 3) >> 2), bh = Math.max(1, (h + 3) >> 2); return { pitch: bw * block, rows: bh, size: bw * bh * block }; }
  const bpp = BPP.get(format);
  if (!bpp) throw new Error(`unsupported D3DFORMAT 0x${(format >>> 0).toString(16)}`);
  return { pitch: w * bpp, rows: h, size: w * bpp * h };
}
const maxLevels = (w, h = 1, d = 1) => 1 + Math.floor(Math.log2(Math.max(w, h, d)));

// Resource pools / usage / lock flags
const POOL = { DEFAULT: 0, MANAGED: 1, SYSTEMMEM: 2, SCRATCH: 3 };
const USAGE = { RENDERTARGET: 1, DEPTHSTENCIL: 2, DYNAMIC: 0x200, AUTOGENMIPMAP: 0x400 };
const LOCK = { READONLY: 0x10, DISCARD: 0x2000, NOOVERWRITE: 0x1000 };
const RTYPE = { SURFACE: 1, VOLUME: 2, TEXTURE: 3, VOLUMETEXTURE: 4, CUBETEXTURE: 5, VERTEXBUFFER: 6, INDEXBUFFER: 7 };

// ---------------------------------------------------------------------------
// Backend contract
// ---------------------------------------------------------------------------
// A backend receives resource lifecycle, uploads and draw calls. `res` objects are
// the model's resource records (res.id is stable). All pixel/vertex data is read
// from guest memory (`g.u8`) at the pointers handed over.
export class NullBackend {
  constructor() { this.stats = { draws: 0, clears: 0, presents: 0, uploads: 0, stretch: 0, copies: 0 }; }
  attach(_g) {}
  resize(_w, _h) {}
  createResource(_res) {}
  destroyResource(_res) {}
  uploadTexture(_tex, _face, _level, _rect, _ptr, _pitch) { this.stats.uploads++; }
  uploadBuffer(_buf, _offset, _size) { this.stats.uploads++; }
  generateMips(_tex) {}
  clear(_dev, _flags, _color, _z, _stencil, _rects) { this.stats.clears++; }
  draw(_dev, _call) { this.stats.draws++; }
  stretchRect(_src, _srcRect, _dst, _dstRect, _filter) { this.stats.stretch++; }
  colorFill(_surf, _rect, _color) {}
  copySurface(_src, _srcRect, _dst, _dstPoint) { this.stats.copies++; }
  readbackSurface(_surf, _ptr, _pitch) { /* leaves destination untouched */ }
  present(_dev) { this.stats.presents++; }
  // Occlusion result: conservatively report visible when nothing was measured.
  queryResult(_q) { return 0xffff; }
}

// ---------------------------------------------------------------------------
// Vtable layouts: arities exclude `this`, in d3d9.h declaration order.
// ---------------------------------------------------------------------------
const RES = [1, 4, 3, 1, 1, 0, 0, 0];    // GetDevice SetPrivateData GetPrivateData FreePrivateData SetPriority GetPriority PreLoad GetType
const UNK = [2, 0, 0];
const BASETEX = [1, 0, 0, 1, 0, 0];      // SetLOD GetLOD GetLevelCount SetAutoGenFilterType GetAutoGenFilterType GenerateMipSubLevels
const VT = {
  d3d9: [...UNK, 2, 0, 3, 2, 4, 2, 5, 6, 6, 5, 4, 3, 1, 6],
  device: null,   // assigned below (119 slots)
  surface: [...UNK, ...RES, 2, 1, 3, 0, 1, 1],
  texture: [...UNK, ...RES, ...BASETEX, 2, 2, 4, 1, 1],
  cube: [...UNK, ...RES, ...BASETEX, 2, 3, 5, 2, 2],
  voltex: [...UNK, ...RES, ...BASETEX, 2, 2, 4, 1, 1],
  volume: [...UNK, 1, 4, 3, 1, 2, 1, 4, 1],
  vb: [...UNK, ...RES, 4, 0, 1],
  ib: [...UNK, ...RES, 4, 0, 1],
  decl: [...UNK, 1, 2],
  vs: [...UNK, 1, 2],
  ps: [...UNK, 1, 2],
  query: [...UNK, 1, 0, 0, 1, 3],
  swap: [...UNK, 5, 1, 3, 1, 1, 1, 1],
  stateblock: [...UNK, 1, 0, 0],
};
// d3d9.h order: QueryInterface, AddRef, Release, then TestCooperativeLevel (3) .. CreateQuery (118).
VT.device = [...UNK, ...[
  0, 0, 0, 1, 1, 2, 1, 3, 3, 1, 2, 2, 0, 1, 4, 4, 2,
  1, 3, 2, 8, 9, 7, 6, 6, 8, 8, 4, 2, 2, 2, 5, 3, 6, 2, 2, 1,
  1, 0, 0, 6, 2, 2, 2, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2,
  0, 1, 1, 1, 2, 2, 3, 3, 3, 3, 1, 2, 2, 1, 1, 1, 1, 1, 0, 1,
  0, 3, 6, 4, 8, 6, 2, 1, 1, 1, 1, 2, 1, 1, 3, 3, 3, 3, 3, 3,
  4, 4, 2, 2, 1, 1, 2, 1, 1, 3, 3, 3, 3, 3, 3, 3, 3, 1, 2,
]];
if (VT.device.length !== 119) {
  throw new Error(`IDirect3DDevice9 vtable table has ${VT.device.length} entries, expected 119`);
}

// ---------------------------------------------------------------------------
// Default render state values (D3D9 documentation)
// ---------------------------------------------------------------------------
const RS_DEFAULTS = {
  7: 1, 8: 3, 9: 0, 14: 1, 15: 0, 16: 8, 19: 2, 20: 1, 22: 1, 23: 4, 24: 0, 25: 8, 26: 1, 27: 0, 28: 0, 34: 0, 35: 0, 36: 0, 37: 0,
  38: 0, 40: 0xffffffff, 48: 0, 52: 0, 53: 8, 54: 0, 55: 0, 56: 0xff, 57: 0xffffffff, 128: 1, 129: 0, 130: 0, 131: 0, 132: 0, 133: 0, 134: 1, 135: 1,
  136: 1, 137: 1, 138: 0, 139: 0, 140: 0, 141: 0, 142: 0, 143: 0, 144: 0, 145: 0, 146: 0, 147: 0, 148: 0, 149: 0, 150: 0, 151: 0, 152: 0, 153: 0,
  154: 0, 155: 0, 156: 0, 157: 0, 158: 0, 159: 0, 160: 0, 161: 0, 162: 0, 163: 0, 164: 0, 165: 0, 166: 0, 167: 0, 168: 0xf, 169: 0, 170: 0, 171: 0,
  172: 0, 173: 0, 174: 0, 175: 0, 176: 0, 177: 0, 178: 0, 179: 0, 180: 0, 181: 0, 182: 0, 183: 0, 184: 0, 185: 0, 186: 0, 187: 0, 188: 0, 189: 0,
  190: 0, 191: 0, 192: 0, 193: 0, 194: 0, 195: 0, 196: 0, 197: 0, 198: 0, 199: 0, 200: 0, 201: 0, 202: 0, 203: 0, 204: 0, 205: 0, 206: 0, 207: 0,
  208: 0, 209: 0, 210: 0, 211: 0, 212: 0, 213: 0, 214: 0, 215: 0, 216: 0, 217: 0, 218: 0, 219: 0, 220: 0, 221: 0, 222: 0, 223: 0, 224: 0, 225: 0,
  226: 0, 227: 0, 228: 0, 229: 0, 230: 0, 231: 0, 232: 0, 233: 0, 234: 0, 235: 0, 236: 0, 237: 0, 238: 0, 239: 0, 240: 0, 241: 0, 242: 0, 243: 0,
  244: 0, 245: 0, 246: 0, 247: 0, 248: 0, 249: 0, 250: 0, 251: 0, 252: 0, 253: 0, 254: 0, 255: 0,
};
const SAMPLER_DEFAULTS = { 1: 1, 2: 1, 3: 1, 4: 0, 5: 1, 6: 1, 7: 0, 8: 0, 9: 0, 10: 1, 11: 0, 12: 0, 13: 0 };   // U V W border magfilter minfilter mip lod maxmip aniso srgb elem dmap
const SAMPLER_SLOTS = 21;      // 16 pixel + 5 vertex-texture samplers
const samplerSlot = (s) => (s >= 256 ? 16 + (s - 256) : s);

// ---------------------------------------------------------------------------
// Public install
// ---------------------------------------------------------------------------
export function installD3D9(SHIMS) {
  SHIMS['d3d9.dll!Direct3DCreate9'] = { arity: 1, pop: 4, fn: function (sdk) {
    const rt = runtime(this);
    const obj = createDirect3D(rt, sdk);
    this.g.d3d9Created = (this.g.d3d9Created || 0) + 1;
    return obj;
  } };
  SHIMS['d3d9.dll!D3DPERF_SetOptions'] = { arity: 1, pop: 4, fn: () => 0 };
  SHIMS['d3d9.dll!D3DPERF_BeginEvent'] = { arity: 2, pop: 8, fn: () => -1 };
  SHIMS['d3d9.dll!D3DPERF_EndEvent'] = { arity: 0, pop: 0, fn: () => -1 };
  SHIMS['d3d9.dll!D3DPERF_SetMarker'] = { arity: 2, pop: 8, fn: () => 0 };
  SHIMS['d3d9.dll!D3DPERF_SetRegion'] = { arity: 2, pop: 8, fn: () => 0 };
  SHIMS['d3d9.dll!D3DPERF_QueryRepeatFrame'] = { arity: 0, pop: 0, fn: () => 0 };
  SHIMS['d3d9.dll!D3DPERF_GetStatus'] = { arity: 0, pop: 0, fn: () => 0 };
}

export function d3d9Stats(g) {
  const out = [];
  for (const st of g.d3dRuntime?.devices ?? []) out.push({ object: st.object, frames: st.frames, draws: st.draws, clears: st.clears, unknown: st.unknown, backend: st.backend.stats });
  return out;
}

// One runtime per Guest: object registry, shared vtables, id allocator.
function runtime(ctx) {
  const g = ctx.g;
  if (g.d3dRuntime) return g.d3dRuntime;
  const rt = { g, dll: ctx.dll, objects: new Map(), vtables: new Map(), nextId: 1, devices: [], methods: {} };
  g.d3d = rt.objects;        // legacy name used by tests
  g.d3dRuntime = rt;
  return rt;
}

// Shared vtable per interface kind. Handlers live in rt.methods[kind][slot] and
// receive (state, ...args); `this` is the host shim context.
function vtable(rt, kind) {
  let vt = rt.vtables.get(kind);
  if (vt) return vt;
  const g = rt.g, arities = VT[kind];
  vt = g.alloc(4 * arities.length);
  arities.forEach((nargs, i) => {
    // Hot path (every D3D9 call): fixed parameters and a handler resolved once; the debug path keeps the generic form.
    let h = null;
    const fast = function (self, a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11) {
      const st = rt.objects.get(self);
      if (!st || !(h ??= rt.methods[kind]?.[i] ?? COMMON[i < 3 ? i : -1] ?? null)) return slow.call(this, self, a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11);
      return h.call(this, st, a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11);
    };
    const slow = function (self, ...args) {
      const st = rt.objects.get(self);
      if (!st) throw new Error(`D3D9 ${kind} method ${i} called with unknown this 0x${(self >>> 0).toString(16)}`);
      if (ENV.D3D9_DEBUG) console.log(`[d3d9] ${kind}#${i}(${args.map((a) => '0x' + (a >>> 0).toString(16)).join(',')})`);
      const h = rt.methods[kind]?.[i] ?? COMMON[i < 3 ? i : -1];
      if (!h) {
        const dev = st.device ?? st;
        if (dev) dev.unknown = (dev.unknown || 0) + 1;
        throw new Error(`unimplemented D3D9 ${kind} method ${i} (${METHOD_NAMES[kind]?.[i] ?? '?'})`);
      }
      return h.call(this, st, ...args);
    };
    g.u32(vt + 4 * i, g.extraThunk(rt.dll, `d3d9#${kind}:${i}`, ENV.D3D9_DEBUG || nargs > 12 ? slow : fast, (nargs + 1) * 4, false, nargs + 1, !ENV.D3D9_DEBUG && nargs <= 12));
  });
  rt.vtables.set(kind, vt);
  return vt;
}

function newObject(rt, kind, st) {
  const g = rt.g;
  const obj = g.alloc(8);
  g.u32(obj, vtable(rt, kind));
  st.kind = kind; st.object = obj; st.refs = 1; st.id = rt.nextId++;
  rt.objects.set(obj, st);
  return obj;
}

// Parent/child reference rule: AddRef/Release on a child resource also holds its container.
function addRef(st) { st.refs++; if (st.parent) addRef(st.parent); return st.refs; }
function release(rt, st) {
  if (st.refs <= 0) throw new Error(`D3D9 ${st.kind} released below zero`);
  st.refs--;
  const r = st.refs;
  if (st.parent) release(rt, st.parent);
  else if (r === 0) destroy(rt, st);
  return r;
}
function destroy(rt, st) {
  const dev = st.device;
  if (st.kind === 'device') {
    dev?.backend.destroyResource?.(st);
    return;
  }
  st.destroyed = true;
  dev?.backend.destroyResource(st);
  for (const ref of st.held ?? []) if (ref) release(rt, rt.objects.get(ref));
  for (const sh of st.shadows ?? []) if (sh) rt.g.free(sh);
  for (const child of st.children ?? []) { dev?.backend.destroyResource(child); rt.objects.delete(child.object); rt.g.free(child.object); if (child.shadow) rt.g.free(child.shadow); }
  if (st.shadow) rt.g.free(st.shadow);
  if (st.data) rt.g.free(st.data);
  rt.objects.delete(st.object);
  rt.g.free(st.object);
}

const COMMON = {
  0: function (st, iid, out) {            // QueryInterface: IUnknown or the object's own interface
    const g = this.g;
    if (!out) return D3DERR.INVALIDCALL;
    const same = (a) => a.every((b, i) => g.u8[iid + i] === b);
    const IUNKNOWN = [0, 0, 0, 0, 0, 0, 0, 0, 0xc0, 0, 0, 0, 0, 0, 0, 0x46];
    if (!iid || same(IUNKNOWN) || (IID[st.kind] && same(IID[st.kind]))) {
      g.u32(out, st.object); addRef(st); return D3D_OK;
    }
    g.u32(out, 0); return E_NOINTERFACE;
  },
  1: (st) => addRef(st),
  2: function (st) { return release(this.g.d3dRuntime, st); },
};
const guid = (s) => { const h = s.replace(/-/g, ''); const b = (i) => parseInt(h.substr(2 * i, 2), 16); return [b(3), b(2), b(1), b(0), b(5), b(4), b(7), b(6), b(8), b(9), b(10), b(11), b(12), b(13), b(14), b(15)]; };
const IID = {
  d3d9: guid('81BDCBCA-64D4-426d-AE8D-AD0147F4275C'), device: guid('D0223B96-BF7A-43fd-92BD-A43B0D82B9EB'),
  surface: guid('0CFBAF3A-9FF6-429a-99B3-A2796AF8B89B'), texture: guid('85C31227-3DE5-4f00-9B3A-F11AC38C18B5'),
  cube: guid('FFF32F81-D953-473a-9223-93D652ABA93F'), voltex: guid('2518526C-E789-4111-A7B9-47EF328D13E6'),
  vb: guid('B64BB1B5-FD70-4df6-BF91-19D0A12455E3'), ib: guid('7C9DD65E-D3F7-4529-ACEE-785830ACDE35'),
  decl: guid('DD13C59C-36FA-4098-A8FB-C7ED39DC8546'), vs: guid('EFC5557E-6265-4613-8A94-43857889EB36'),
  ps: guid('6D3BDBDC-5B02-4415-B852-CE5E8BCCB289'), query: guid('d9771460-a695-4f26-bbd3-27b840b541cc'),
  swap: guid('794950F2-ADFC-458a-905E-10A10B0B503B'),
};
const METHOD_NAMES = {
  device: ['QueryInterface', 'AddRef', 'Release', 'TestCooperativeLevel', 'GetAvailableTextureMem', 'EvictManagedResources', 'GetDirect3D', 'GetDeviceCaps', 'GetDisplayMode', 'GetCreationParameters', 'SetCursorProperties', 'SetCursorPosition', 'ShowCursor', 'CreateAdditionalSwapChain', 'GetSwapChain', 'GetNumberOfSwapChains', 'Reset', 'Present', 'GetBackBuffer', 'GetRasterStatus', 'SetDialogBoxMode', 'SetGammaRamp', 'GetGammaRamp', 'CreateTexture', 'CreateVolumeTexture', 'CreateCubeTexture', 'CreateVertexBuffer', 'CreateIndexBuffer', 'CreateRenderTarget', 'CreateDepthStencilSurface', 'UpdateSurface', 'UpdateTexture', 'GetRenderTargetData', 'GetFrontBufferData', 'StretchRect', 'ColorFill', 'CreateOffscreenPlainSurface', 'SetRenderTarget', 'GetRenderTarget', 'SetDepthStencilSurface', 'GetDepthStencilSurface', 'BeginScene', 'EndScene', 'Clear', 'SetTransform', 'GetTransform', 'MultiplyTransform', 'SetViewport', 'GetViewport', 'SetMaterial', 'GetMaterial', 'SetLight', 'GetLight', 'LightEnable', 'GetLightEnable', 'SetClipPlane', 'GetClipPlane', 'SetRenderState', 'GetRenderState', 'CreateStateBlock', 'BeginStateBlock', 'EndStateBlock', 'SetClipStatus', 'GetClipStatus', 'GetTexture', 'SetTexture', 'GetTextureStageState', 'SetTextureStageState', 'GetSamplerState', 'SetSamplerState', 'ValidateDevice', 'SetPaletteEntries', 'GetPaletteEntries', 'SetCurrentTexturePalette', 'GetCurrentTexturePalette', 'SetScissorRect', 'GetScissorRect', 'SetSoftwareVertexProcessing', 'GetSoftwareVertexProcessing', 'SetNPatchMode', 'GetNPatchMode', 'DrawPrimitive', 'DrawIndexedPrimitive', 'DrawPrimitiveUP', 'DrawIndexedPrimitiveUP', 'ProcessVertices', 'CreateVertexDeclaration', 'SetVertexDeclaration', 'GetVertexDeclaration', 'SetFVF', 'GetFVF', 'CreateVertexShader', 'SetVertexShader', 'GetVertexShader', 'SetVertexShaderConstantF', 'GetVertexShaderConstantF', 'SetVertexShaderConstantI', 'GetVertexShaderConstantI', 'SetVertexShaderConstantB', 'GetVertexShaderConstantB', 'SetStreamSource', 'GetStreamSource', 'SetStreamSourceFreq', 'GetStreamSourceFreq', 'SetIndices', 'GetIndices', 'CreatePixelShader', 'SetPixelShader', 'GetPixelShader', 'SetPixelShaderConstantF', 'GetPixelShaderConstantF', 'SetPixelShaderConstantI', 'GetPixelShaderConstantI', 'SetPixelShaderConstantB', 'GetPixelShaderConstantB', 'DrawRectPatch', 'DrawTriPatch', 'DeletePatch', 'CreateQuery'],
};

// ---------------------------------------------------------------------------
// IDirect3D9
// ---------------------------------------------------------------------------
const SUPPORTED_DISPLAY = [FMT.X8R8G8B8, FMT.A8R8G8B8];
const DISPLAY = { w: 1280, h: 720, hz: 60, fmt: FMT.X8R8G8B8 };
function createDirect3D(rt, sdk) {
  const g = rt.g;
  const d3d = { sdk, adapters: 1 };
  const obj = newObject(rt, 'd3d9', d3d);
  const M = rt.methods.d3d9 = {};
  M[3] = () => D3D_OK;                                   // RegisterSoftwareDevice
  M[4] = () => 1;                                        // GetAdapterCount
  M[5] = (st, adapter, _flags, id) => {                  // GetAdapterIdentifier (D3DADAPTER_IDENTIFIER9, 1104 bytes)
    if (adapter !== 0) return D3DERR.INVALIDCALL;
    g.u8.fill(0, id, id + 1104);
    const put = (off, s) => { for (let i = 0; i < s.length; i++) g.u8[id + off + i] = s.charCodeAt(i); };
    put(0, 'gamebox_d3d9'); put(512, 'GameBox virtual adapter (host GPU via WebGL2)'); put(1024, '\\\\.\\DISPLAY1');
    g.u32(id + 1056, 0x000e0000 | 0); g.u32(id + 1060, 0x000a0000 | 0x1234);     // DriverVersion
    g.u32(id + 1064, 0x10de);                            // VendorId  (reported so the engine takes its modern-GPU path)
    g.u32(id + 1068, 0x1b80);                            // DeviceId
    g.u32(id + 1076, 0xa1);                              // Revision
    g.u32(id + 1080, 0x47616d65); g.u32(id + 1084, 0x426f7801);   // DeviceIdentifier GUID
    g.u32(id + 1096, 1);                                 // WHQLLevel
    return D3D_OK;
  };
  M[6] = (st, adapter) => (adapter === 0 ? SUPPORTED_DISPLAY.length * 4 : 0);   // GetAdapterModeCount
  M[7] = (st, adapter, fmt, idx, mode) => {              // EnumAdapterModes
    if (adapter !== 0 || !mode) return D3DERR.INVALIDCALL;
    const modes = [[1920, 1080], [1600, 900], [1366, 768], [1280, 720], [1024, 768], [800, 600]];
    const n = idx % modes.length;
    if (idx >= modes.length * 4 || !SUPPORTED_DISPLAY.includes(fmt)) return D3DERR.INVALIDCALL;
    g.u32(mode, modes[n][0]); g.u32(mode + 4, modes[n][1]); g.u32(mode + 8, 60); g.u32(mode + 12, fmt);
    return D3D_OK;
  };
  M[8] = (st, adapter, mode) => {                        // GetAdapterDisplayMode
    if (adapter !== 0 || !mode) return D3DERR.INVALIDCALL;
    g.u32(mode, DISPLAY.w); g.u32(mode + 4, DISPLAY.h); g.u32(mode + 8, DISPLAY.hz); g.u32(mode + 12, DISPLAY.fmt);
    return D3D_OK;
  };
  M[9] = (st, adapter, type) => (adapter === 0 && type === 1 ? D3D_OK : D3DERR.INVALIDCALL);   // CheckDeviceType
  M[10] = (st, adapter, type, adapterFmt, usage, rtype, fmt) => checkDeviceFormat(adapter, type, usage, rtype, fmt);
  M[11] = (st, adapter, type, fmt, windowed, msType, quality) => {   // CheckDeviceMultiSampleType
    if (adapter !== 0) return D3DERR.INVALIDCALL;
    if (msType > 4 && msType !== 8) return D3DERR.NOTAVAILABLE;
    if (quality) g.u32(quality, msType <= 1 ? 1 : 1);
    return msType === 0 || msType === 1 || msType === 2 || msType === 4 ? D3D_OK : D3DERR.NOTAVAILABLE;
  };
  M[12] = (st, adapter, type, adapterFmt, rtFmt, dsFmt) => (isDepthFormat(dsFmt) ? D3D_OK : D3DERR.NOTAVAILABLE);   // CheckDepthStencilMatch
  M[13] = () => D3D_OK;                                  // CheckDeviceFormatConversion
  M[14] = (st, adapter, type, caps) => { if (adapter !== 0 || !caps) return D3DERR.INVALIDCALL; fillCaps(g, caps, adapter); return D3D_OK; };
  M[15] = (st, adapter) => (adapter === 0 ? 0x7ff10600 : 0);   // GetAdapterMonitor (matches user32 MonitorFromWindow)
  M[16] = (st, adapter, type, hwnd, flags, pp, out) => createDevice(rt, d3d, adapter, type, hwnd, flags, pp, out);
  return obj;
}

// Formats a WebGL2/WebGPU class GPU can sample/render. Unsupported: palettized,
// bumpmap-with-luminance, packed YUV, 24-bit RGB, 16-bit lockable depth variants.
const TEXTURE_FORMATS = new Set([FMT.A8R8G8B8, FMT.X8R8G8B8, FMT.R5G6B5, FMT.X1R5G5B5, FMT.A1R5G5B5, FMT.A4R4G4B4, FMT.A8, FMT.A2B10G10R10, FMT.A8B8G8R8,
  FMT.X8B8G8R8, FMT.G16R16, FMT.A16B16G16R16, FMT.L8, FMT.A8L8, FMT.V8U8, FMT.Q8W8V8U8, FMT.V16U16, FMT.L16, FMT.Q16W16V16U16, FMT.R16F, FMT.G16R16F,
  FMT.A16B16G16R16F, FMT.R32F, FMT.G32R32F, FMT.A32B32G32R32F, FMT.DXT1, FMT.DXT3, FMT.DXT5, FMT.ATI1, FMT.ATI2, FMT.NULL, FMT.INTZ, FMT.D16, FMT.D24S8,
  FMT.D24X8, FMT.D32F_LOCKABLE, FMT.D24FS8, FMT.D32, FMT.DF16, FMT.DF24]);
function checkDeviceFormat(adapter, type, usage, rtype, fmt) {
  if (adapter !== 0) return D3DERR.INVALIDCALL;
  if (rtype === RTYPE.SURFACE && (usage & USAGE.DEPTHSTENCIL)) return isDepthFormat(fmt) ? D3D_OK : D3DERR.NOTAVAILABLE;
  if (rtype === RTYPE.VERTEXBUFFER) return D3D_OK;
  if (rtype === RTYPE.INDEXBUFFER) return fmt === FMT.INDEX16 || fmt === FMT.INDEX32 ? D3D_OK : D3DERR.NOTAVAILABLE;
  if (!TEXTURE_FORMATS.has(fmt)) return D3DERR.NOTAVAILABLE;
  if ((usage & USAGE.DEPTHSTENCIL) && !isDepthFormat(fmt)) return D3DERR.NOTAVAILABLE;
  if ((usage & USAGE.RENDERTARGET) && (isDepthFormat(fmt) || BLOCK_FORMATS.has(fmt) || fmt === FMT.V8U8 || fmt === FMT.Q8W8V8U8)) return D3DERR.NOTAVAILABLE;
  return D3D_OK;
}

// D3DCAPS9 (304 bytes) describing a SM3.0 HAL device.
function fillCaps(g, p, adapter) {
  g.u8.fill(0, p, p + 304);
  const W = (off, v) => g.u32(p + off, v >>> 0), F = (off, v) => g.dv.setFloat32(p + off, v, true);
  W(0, 1); W(4, adapter);                                            // DeviceType HAL, AdapterOrdinal
  W(8, 0x20000);                                                     // Caps: READ_SCANLINE
  W(12, 0x20000 | 0x10000000 | 0x20000000 | 0x40000000);            // Caps2: FULLSCREENGAMMA CANMANAGERESOURCE DYNAMICTEXTURES CANAUTOGENMIPMAP
  W(16, 0x20 | 0x80 | 0x100 | 0x200);                               // Caps3
  W(20, 0x80000000 | 1 | 2 | 4 | 8);                                // PresentationIntervals
  W(24, 3);                                                          // CursorCaps
  W(28, 0x001beaf0);                                                 // DevCaps
  W(32, 0x2 | 0x10 | 0x20 | 0x40 | 0x80 | 0x100 | 0x200 | 0x400 | 0x800 | 0x4000 | 0x8000 | 0x10000 | 0x20000 | 0x40000 | 0x80000 | 0x100000);   // PrimitiveMiscCaps
  W(36, 0x1 | 0x20 | 0x40 | 0x80 | 0x100 | 0x400 | 0x800 | 0x1000 | 0x2000 | 0x4000 | 0x8000 | 0x10000 | 0x20000 | 0x40000 | 0x100000 | 0x200000 | 0x400000);   // RasterCaps
  W(40, 0xff); W(44, 0x3fff); W(48, 0x3fff); W(52, 0xff);            // Z cmp, src/dest blend, alpha cmp
  W(56, 0x1 | 0x2 | 0x4 | 0x8 | 0x10 | 0x20 | 0x40 | 0x80 | 0x100); // ShadeCaps (subset)
  W(60, 0x1 | 0x4 | 0x8 | 0x20 | 0x40 | 0x80 | 0x400 | 0x800 | 0x1000 | 0x2000 | 0x4000 | 0x10000);  // TextureCaps: PERSPECTIVE ALPHA CUBEMAP PROJECTED(no) ...
  const filt = 0x100 | 0x200 | 0x1000000 | 0x2000000 | 0x10000 | 0x20000 | 0x4000000 | 0x8000000 | 0x2000 | 0x4000 | 0x1 | 0x2 | 0x10 | 0x20 | 0x100000 | 0x200000;
  W(64, filt); W(68, filt); W(72, filt);                             // texture / cube / volume filter caps
  W(76, 0x1 | 0x2 | 0x4 | 0x8 | 0x10 | 0x20); W(80, 0x1 | 0x2 | 0x4 | 0x8 | 0x10 | 0x20);   // address caps
  W(84, 0xff);                                                       // LineCaps
  W(88, 16384); W(92, 16384); W(96, 2048); W(100, 16384); W(104, 16384); W(108, 16);   // MaxTexW/H/Volume/Repeat/Aspect/Aniso
  F(112, 1e10); F(116, -1e8); F(120, -1e8); F(124, 1e8); F(128, 1e8);  // MaxVertexW + guard band
  W(136, 0x1ff);                                                     // StencilCaps
  W(140, 0x8 | 0x00100000 | 0x2 | 0x4000 | 0x8000);                  // FVFCaps: 8 tex coords, per-stage tex coord count
  W(144, 0x03ffffff);                                                // TextureOpCaps
  W(148, 8); W(152, 8);                                              // MaxTextureBlendStages / MaxSimultaneousTextures
  W(156, 0x1 | 0x2 | 0x4 | 0x8 | 0x10 | 0x20 | 0x40 | 0x80 | 0x100); // VertexProcessingCaps
  W(160, 8); W(164, 6); W(168, 4); W(172, 0);                        // lights, clip planes, blend matrices
  F(176, 8192); W(180, 0x00ffffff); W(184, 0x00ffffff);              // MaxPointSize, MaxPrimitiveCount, MaxVertexIndex
  W(188, 16); W(192, 508);                                           // MaxStreams / MaxStreamStride
  W(196, 0xfffe0300); W(200, 256);                                   // VS 3.0, MaxVertexShaderConst
  W(204, 0xffff0300); F(208, 1e10); W(212, 0x1 | 0x2 | 0x4 | 0x8 | 0x10);   // PS 3.0, PS1xMaxValue, DevCaps2
  F(216, 0);
  W(236, 0x1ff | 0xffff);                                            // DeclTypes: all types incl. UBYTE4 and FLOAT16
  W(240, 4);                                                         // NumSimultaneousRTs
  W(244, 0x1 | 0x2 | 0x100 | 0x200 | 0x1000000 | 0x2000000 | 0x10000);   // StretchRectFilterCaps
  W(248, 0x3); W(252, 24); W(256, 32); W(260, 4);                    // VS20Caps
  W(264, 0x3f); W(268, 24); W(272, 32); W(276, 4); W(280, 512);      // PS20Caps
  W(284, 0x1 | 0x2 | 0x4 | 0x100 | 0x200);                           // VertexTextureFilterCaps
  W(288, 0xffff); W(292, 0xffff); W(296, 32768); W(300, 32768);      // instruction limits
}

// ---------------------------------------------------------------------------
// IDirect3DDevice9
// ---------------------------------------------------------------------------
function createDevice(rt, d3d, adapter, type, hwnd, flags, pp, out) {
  const g = rt.g;
  if (adapter !== 0 || type !== 1) return D3DERR.INVALIDCALL;
  const backend = g.d3d9Backend ?? new NullBackend();
  backend.attach?.(g);
  const w = (pp && g.u32(pp)) || 1280, h = (pp && g.u32(pp + 4)) || 720;
  const dev = {
    d3d, adapter, type, hwnd, flags, backend, width: w, height: h,
    pp: pp ? readPP(g, pp) : null,
    rs: new Uint32Array(256), samplers: Array.from({ length: SAMPLER_SLOTS }, () => new Uint32Array(14)),
    tex: new Array(SAMPLER_SLOTS).fill(null), stageStates: new Map(), transforms: new Map(),
    streams: Array.from({ length: 16 }, () => ({ vb: null, offset: 0, stride: 0, freq: 1 })),
    ib: null, decl: null, fvf: 0, vs: null, ps: null,
    vsF: new Float32Array(256 * 4), psF: new Float32Array(256 * 4), vsI: new Int32Array(16 * 4), psI: new Int32Array(16 * 4),
    vsB: new Uint32Array(16), psB: new Uint32Array(16),
    constantDirty: {vsF:true,psF:true,vsI:true,psI:true,vsB:true,psB:true,rs:true,samplers:true},
    textureDirty:(1<<SAMPLER_SLOTS)-1, streamDirty:0xffff,
    constRange: {},                               // vsF/psF rows written since the last delta; absent = all
    rts: [null, null, null, null], ds: null, viewport: { x: 0, y: 0, w, h, minZ: 0, maxZ: 1 }, scissor: { l: 0, t: 0, r: w, b: h },
    clipPlanes: new Float32Array(6 * 4), inScene: false, frames: 0, draws: 0, clears: 0, unknown: 0,
    gamma: null, lights: new Map(), lightEnabled: new Map(), material: new Uint8Array(68), npatch: 0,
    swapChains: [],
  };
  for (const [k, v] of Object.entries(RS_DEFAULTS)) dev.rs[k] = v;
  for (const s of dev.samplers) for (const [k, v] of Object.entries(SAMPLER_DEFAULTS)) s[k] = v;
  for (let i = 0; i < SAMPLER_SLOTS; i++) dev.samplers[i][4] = 0;
  dev.rs[26] = 3;                                 // CULLMODE default D3DCULL_CCW
  dev.rs[152] = 0;
  rt.devices.push(dev);
  const obj = newObject(rt, 'device', dev);
  dev.device = dev;
  buildBackBuffer(rt, dev);
  installDeviceMethods(rt);
  if (out) g.u32(out, obj);
  return D3D_OK;
}

function readPP(g, p) {
  return {
    w: g.u32(p), h: g.u32(p + 4), fmt: g.u32(p + 8), backBuffers: g.u32(p + 12), ms: g.u32(p + 16), msq: g.u32(p + 20),
    swap: g.u32(p + 24), hwnd: g.u32(p + 28), windowed: g.u32(p + 32), autoDS: g.u32(p + 36), dsFmt: g.u32(p + 40),
    flags: g.u32(p + 44), hz: g.u32(p + 48), interval: g.u32(p + 52),
  };
}
function writePP(g, p, d) {
  g.u32(p, d.width); g.u32(p + 4, d.height); g.u32(p + 8, d.pp.fmt || FMT.X8R8G8B8); g.u32(p + 12, Math.max(1, d.pp.backBuffers));
}

function buildBackBuffer(rt, dev) {
  const g = rt.g, pp = dev.pp;
  const fmt = pp && pp.fmt ? pp.fmt : FMT.X8R8G8B8;
  dev.backBuffer = makeSurface(rt, dev, { w: dev.width, h: dev.height, format: fmt, usage: USAGE.RENDERTARGET, pool: POOL.DEFAULT, kindOf: 'backbuffer' });
  dev.rts[0] = dev.backBuffer;
  dev.backBuffer.refs++;                         // device's bound-RT reference
  if (pp?.autoDS) {
    dev.autoDS = makeSurface(rt, dev, { w: dev.width, h: dev.height, format: pp.dsFmt || FMT.D24S8, usage: USAGE.DEPTHSTENCIL, pool: POOL.DEFAULT, kindOf: 'autods' });
    dev.ds = dev.autoDS; dev.autoDS.refs++;
  }
  dev.swapChains = [makeSwapChain(rt, dev)];
  dev.backend.resize(dev.width, dev.height);
}

function makeSwapChain(rt, dev) {
  const st = { device: dev, hwnd: dev.hwnd };
  newObject(rt, 'swap', st);
  return st;
}

// ---- surfaces and textures ------------------------------------------------
function makeSurface(rt, dev, desc, parent = null, extra = {}) {
  const st = { device: dev, w: desc.w, h: desc.h, format: desc.format, usage: desc.usage, pool: desc.pool, ms: desc.ms || 0, msq: desc.msq || 0,
    lockable: !!desc.lockable, kindOf: desc.kindOf || 'surface', parent, face: extra.face || 0, level: extra.level || 0, shadow: 0, locked: null, texture: extra.texture || null };
  const lay = desc.format === FMT.NULL ? { pitch: 0, rows: 0, size: 0 } : levelLayout(desc.format, desc.w, desc.h);
  st.pitch = lay.pitch; st.size = lay.size;
  newObject(rt, 'surface', st);
  if (!parent) dev.backend.createResource(st);
  return st;
}

function ensureShadow(rt, st) {
  if (!st.shadow && st.size) st.shadow = rt.g.alloc(st.size);
  return st.shadow;
}

function createTextureLike(rt, dev, kind, desc, out) {
  const g = rt.g;
  if (!BPP.has(desc.format) && !BLOCK_FORMATS.has(desc.format)) return D3DERR.INVALIDCALL;
  const st = { device: dev, texKind: kind, w: desc.w, h: desc.h, d: desc.d || 1, format: desc.format, usage: desc.usage, pool: desc.pool, children: [], lod: 0, autoGenFilter: 2, shadows: [] };
  const full = maxLevels(desc.w, desc.h, desc.d || 1);
  st.levels = desc.levels === 0 || desc.levels > full ? full : desc.levels;
  if (desc.usage & USAGE.AUTOGENMIPMAP) st.levels = 1;      // only the top level is addressable
  st.faces = kind === 'cube' ? 6 : 1;
  st.layouts = [];
  for (let l = 0; l < st.levels; l++) {
    const lw = Math.max(1, desc.w >> l), lh = Math.max(1, desc.h >> l), ld = Math.max(1, st.d >> l);
    const lay = levelLayout(desc.format, lw, lh);
    st.layouts.push({ w: lw, h: lh, d: ld, pitch: lay.pitch, rows: lay.rows, slice: lay.size, size: lay.size * ld });
  }
  st.shadowed = desc.pool !== POOL.DEFAULT || !!(desc.usage & USAGE.DYNAMIC);
  newObject(rt, kind === 'cube' ? 'cube' : kind === '3d' ? 'voltex' : 'texture', st);
  dev.backend.createResource(st);
  g.u32(out, st.object);
  return D3D_OK;
}
const shadowFor = (rt, tex, face, level) => {
  const idx = face * tex.levels + level;
  if (!tex.shadows[idx]) tex.shadows[idx] = rt.g.alloc(Math.max(16, tex.layouts[level].size));
  return tex.shadows[idx];
};
const surfaceOf = (rt, tex, face, level) => {
  tex.surfaceCache ||= new Map();
  const key = face * tex.levels + level;
  let s = tex.surfaceCache.get(key);
  if (!s) {
    const lay = tex.layouts[level];
    s = makeSurface(rt, tex.device, { w: lay.w, h: lay.h, format: tex.format, usage: tex.usage, pool: tex.pool, kindOf: 'level' }, tex, { face, level, texture: tex });
    s.refs = 0;
    tex.children.push(s);
    tex.surfaceCache.set(key, s);
  }
  return s;
};

function lockLevel(rt, tex, face, level, out, rect, flags, pitchOut) {
  const g = rt.g, lay = tex.layouts[level];
  if (!lay) return D3DERR.INVALIDCALL;
  if (tex.locks?.has(face * tex.levels + level)) return D3DERR.INVALIDCALL;
  const base = shadowFor(rt, tex, face, level);
  let off = 0;
  const lr = rect ? { l: g.i32(rect), t: g.i32(rect + 4), r: g.i32(rect + 8), b: g.i32(rect + 12) } : null;
  if (lr) {
    if (lr.l < 0 || lr.t < 0 || lr.r > lay.w || lr.b > lay.h || lr.l >= lr.r || lr.t >= lr.b) return D3DERR.INVALIDCALL;
    const block = BLOCK_FORMATS.get(tex.format);
    off = block ? (lr.t >> 2) * lay.pitch + (lr.l >> 2) * block : lr.t * lay.pitch + lr.l * BPP.get(tex.format);
  }
  (tex.locks ||= new Map()).set(face * tex.levels + level, { rect: lr, flags });
  g.u32(out, lay.pitch);               // D3DLOCKED_RECT { INT Pitch; void* pBits }
  g.u32(out + 4, base + off);
  return D3D_OK;
}
function unlockLevel(rt, tex, face, level) {
  const key = face * tex.levels + level;
  const lk = tex.locks?.get(key);
  if (!lk) return D3DERR.INVALIDCALL;
  tex.locks.delete(key);
  if (!(lk.flags & LOCK.READONLY)) tex.device.backend.uploadTexture(tex, face, level, lk.rect, tex.shadows[key], tex.layouts[level].pitch);
  return D3D_OK;
}

// ---- buffers --------------------------------------------------------------
function createBuffer(rt, dev, kind, len, usage, format, pool, out) {
  const g = rt.g;
  if (!len) return D3DERR.INVALIDCALL;
  const st = { device: dev, size: len, usage, pool, format, fvf: format, data: g.alloc(Math.max(16, len)), lock: null };
  newObject(rt, kind, st);
  dev.backend.createResource(st);
  g.u32(out, st.object);
  return D3D_OK;
}

// ---- state --------------------------------------------------------------
function bind(rt, slot, arr, i, objPtr) {
  const next = objPtr ? rt.objects.get(objPtr) : null;
  if (objPtr && !next) throw new Error(`D3D9 bind of unknown object 0x${objPtr.toString(16)}`);
  const prev = arr[i];
  if(prev===next)return false;
  if (next) addRef(next);
  arr[i] = next;
  if (prev) release(rt, prev);
  return true;
}
const setHeld = (rt, dev, key, ptr) => {
  const next = ptr ? rt.objects.get(ptr) : null;
  if (ptr && !next) throw new Error(`D3D9 bind of unknown ${key} 0x${ptr.toString(16)}`);
  const prev = dev[key];
  if (next) addRef(next);
  dev[key] = next;
  if (prev) release(rt, prev);
};
const outObj = (g, out, st) => { if (!out) return D3DERR.INVALIDCALL; if (st) { addRef(st); g.u32(out, st.object); } else g.u32(out, 0); return D3D_OK; };

const PRIM_VERTS = (type, count) => {
  switch (type) {
    case 1: return count;            // POINTLIST
    case 2: return count * 2;        // LINELIST
    case 3: return count + 1;        // LINESTRIP
    case 4: return count * 3;        // TRIANGLELIST
    case 5: case 6: return count + 2;
    default: throw new Error(`bad primitive type ${type}`);
  }
};

function installDeviceMethods(rt) {
  if (rt.methods.device) return;
  const g = rt.g;
  const M = rt.methods.device = {};
  const f32 = (a) => g.dv.getFloat32(a, true);
  const F = new DataView(new ArrayBuffer(4));
  const fromBits = (u) => { F.setUint32(0, u >>> 0, true); return F.getFloat32(0, true); };

  M[3] = () => D3D_OK;                                           // TestCooperativeLevel
  M[4] = () => 512 * 1024 * 1024;                                // GetAvailableTextureMem (virtual 512 MiB budget)
  M[5] = () => D3D_OK;                                           // EvictManagedResources
  M[6] = (dev, out) => outObj(g, out, dev.d3d.object && rt.objects.get(dev.d3d.object));
  M[7] = (dev, caps) => { if (!caps) return D3DERR.INVALIDCALL; fillCaps(g, caps, dev.adapter); return D3D_OK; };
  M[8] = (dev, chain, mode) => { if (chain !== 0 || !mode) return D3DERR.INVALIDCALL; g.u32(mode, DISPLAY.w); g.u32(mode + 4, DISPLAY.h); g.u32(mode + 8, DISPLAY.hz); g.u32(mode + 12, DISPLAY.fmt); return D3D_OK; };
  M[9] = (dev, p) => { if (!p) return D3DERR.INVALIDCALL; g.u32(p, dev.adapter); g.u32(p + 4, dev.type); g.u32(p + 8, dev.hwnd); g.u32(p + 12, dev.flags); return D3D_OK; };
  M[10] = () => D3D_OK;                                          // SetCursorProperties (cursor is the DOM's)
  M[11] = () => 0;                                               // SetCursorPosition (void)
  M[12] = () => 0;                                               // ShowCursor -> previous visibility
  M[13] = () => D3DERR.NOTAVAILABLE;                             // CreateAdditionalSwapChain
  M[14] = (dev, i, out) => (i === 0 ? outObj(g, out, dev.swapChains[0]) : D3DERR.INVALIDCALL);
  M[15] = () => 1;
  M[16] = (dev, pp) => {                                         // Reset
    if (!pp) return D3DERR.INVALIDCALL;
    const req = readPP(g, pp);
    const w = req.w || dev.width, h = req.h || dev.height;
    dev.pp = req; dev.width = w; dev.height = h;
    for (let i = 0; i < 4; i++) if (dev.rts[i]) { release(rt, dev.rts[i]); dev.rts[i] = null; }
    if (dev.ds) { release(rt, dev.ds); dev.ds = null; }
    release(rt, dev.backBuffer); if (dev.autoDS) release(rt, dev.autoDS);
    dev.swapChains = [];
    buildBackBuffer(rt, dev);
    dev.viewport = { x: 0, y: 0, w, h, minZ: 0, maxZ: 1 }; dev.scissor = { l: 0, t: 0, r: w, b: h };
    return D3D_OK;
  };
  M[17] = (dev) => {                                              // Present
    dev.frames++; dev.backend.present(dev);
    if (ENV.D3D9_MAX_FRAMES && dev.frames >= +ENV.D3D9_MAX_FRAMES) throw new Error(`D3D9_MAX_FRAMES reached after ${dev.frames} frames`);
    return D3D_OK;
  };
  M[18] = (dev, chain, idx, type, out) => (chain === 0 && idx === 0 ? outObj(g, out, dev.backBuffer) : D3DERR.INVALIDCALL);
  M[19] = (dev, chain, st) => { if (st) { g.u32(st, 0); g.u32(st + 4, dev.frames % dev.height); } return D3D_OK; };
  M[20] = () => D3D_OK;
  M[21] = (dev, chain, flags, ramp) => { dev.gamma = g.u8.slice(ramp, ramp + 1536); return 0; };
  M[22] = (dev, chain, ramp) => { for (let i = 0; i < 256; i++) for (let c = 0; c < 3; c++) g.dv.setUint16(ramp + c * 512 + i * 2, i * 257, true); return 0; };

  M[23] = (dev, w, h, levels, usage, format, pool, out) => createTextureLike(rt, dev, '2d', { w, h, levels, usage, format, pool }, out);
  M[24] = (dev, w, h, d, levels, usage, format, pool, out) => createTextureLike(rt, dev, '3d', { w, h, d, levels, usage, format, pool }, out);
  M[25] = (dev, edge, levels, usage, format, pool, out) => createTextureLike(rt, dev, 'cube', { w: edge, h: edge, levels, usage, format, pool }, out);
  M[26] = (dev, len, usage, fvf, pool, out) => createBuffer(rt, dev, 'vb', len, usage, fvf, pool, out);
  M[27] = (dev, len, usage, fmt, pool, out) => (fmt === FMT.INDEX16 || fmt === FMT.INDEX32 ? createBuffer(rt, dev, 'ib', len, usage, fmt, pool, out) : D3DERR.INVALIDCALL);
  M[28] = (dev, w, h, fmt, ms, msq, lockable, out) => {
    if (!out) return D3DERR.INVALIDCALL;
    const s = makeSurface(rt, dev, { w, h, format: fmt, usage: USAGE.RENDERTARGET, pool: POOL.DEFAULT, ms, msq, lockable: !!lockable });
    g.u32(out, s.object); return D3D_OK;
  };
  M[29] = (dev, w, h, fmt, ms, msq, discard, out) => {
    if (!out || !isDepthFormat(fmt)) return D3DERR.INVALIDCALL;
    const s = makeSurface(rt, dev, { w, h, format: fmt, usage: USAGE.DEPTHSTENCIL, pool: POOL.DEFAULT, ms, msq });
    g.u32(out, s.object); return D3D_OK;
  };
  M[30] = (dev, srcP, srcRect, dstP, dstPt) => {                // UpdateSurface (sysmem -> default)
    const src = rt.objects.get(srcP), dst = rt.objects.get(dstP);
    if (!src || !dst) return D3DERR.INVALIDCALL;
    dev.backend.copySurface(src, srcRect ? readRect(g, srcRect) : null, dst, dstPt ? { x: g.i32(dstPt), y: g.i32(dstPt + 4) } : null);
    return D3D_OK;
  };
  M[31] = (dev, srcP, dstP) => {                                 // UpdateTexture
    const src = rt.objects.get(srcP), dst = rt.objects.get(dstP);
    if (!src || !dst) return D3DERR.INVALIDCALL;
    for (let f = 0; f < dst.faces; f++) for (let l = 0; l < dst.levels; l++) {
      const sl = l + (src.levels - dst.levels);
      if (sl < 0 || !src.shadows[f * src.levels + sl]) continue;
      dev.backend.uploadTexture(dst, f, l, null, src.shadows[f * src.levels + sl], src.layouts[sl].pitch);
    }
    return D3D_OK;
  };
  M[32] = (dev, srcP, dstP) => {                                 // GetRenderTargetData (RT -> sysmem surface)
    const src = rt.objects.get(srcP), dst = rt.objects.get(dstP);
    if (!src || !dst || dst.pool !== POOL.SYSTEMMEM || src.w!==dst.w || src.h!==dst.h || src.format!==dst.format) return D3DERR.INVALIDCALL;
    return dev.backend.readbackSurface(src, ensureShadow(rt, dst), dst.pitch) ? D3D_OK : D3DERR.INVALIDCALL;
  };
  M[33] = (dev, chain, dstP) => {
    const dst = rt.objects.get(dstP);
    if (!dst) return D3DERR.INVALIDCALL;
    return dev.backend.readbackSurface(dev.backBuffer, ensureShadow(rt, dst), dst.pitch) ? D3D_OK : D3DERR.INVALIDCALL;
  };
  M[34] = (dev, srcP, srcRect, dstP, dstRect, filter) => {
    const src = rt.objects.get(srcP), dst = rt.objects.get(dstP);
    if (!src || !dst) return D3DERR.INVALIDCALL;
    dev.backend.stretchRect(src, srcRect ? readRect(g, srcRect) : null, dst, dstRect ? readRect(g, dstRect) : null, filter);
    return D3D_OK;
  };
  M[35] = (dev, surfP, rect, color) => {
    const s = rt.objects.get(surfP);
    if (!s) return D3DERR.INVALIDCALL;
    dev.backend.colorFill(s, rect ? readRect(g, rect) : null, color >>> 0); return D3D_OK;
  };
  M[36] = (dev, w, h, fmt, pool, out) => {
    if (!out || (pool !== POOL.SYSTEMMEM && pool !== POOL.SCRATCH && pool !== POOL.DEFAULT)) return D3DERR.INVALIDCALL;
    const s = makeSurface(rt, dev, { w, h, format: fmt, usage: 0, pool, lockable: true });
    g.u32(out, s.object); return D3D_OK;
  };
  M[37] = (dev, idx, surfP) => {                                 // SetRenderTarget
    if (idx >= 4 || (idx === 0 && !surfP)) return D3DERR.INVALIDCALL;
    const s = surfP ? rt.objects.get(surfP) : null;
    if (surfP && (!s || !(s.usage & USAGE.RENDERTARGET) && s.kindOf !== 'backbuffer')) return D3DERR.INVALIDCALL;
    const prev = dev.rts[idx];
    if (s) addRef(s);
    dev.rts[idx] = s;
    if (prev) release(rt, prev);
    if (idx === 0 && s) {
      dev.viewport = { x: 0, y: 0, w: s.w, h: s.h, minZ: 0, maxZ: 1 };
      dev.scissor = { l: 0, t: 0, r: s.w, b: s.h };
    }
    return D3D_OK;
  };
  M[38] = (dev, idx, out) => (idx < 4 && dev.rts[idx] ? outObj(g, out, dev.rts[idx]) : (g.u32(out, 0), D3DERR.NOTAVAILABLE));
  M[39] = (dev, surfP) => { setHeld(rt, dev, 'ds', surfP); return D3D_OK; };
  M[40] = (dev, out) => (dev.ds ? outObj(g, out, dev.ds) : (g.u32(out, 0), D3DERR.NOTAVAILABLE));
  M[41] = (dev) => { if (dev.inScene) return D3DERR.INVALIDCALL; dev.inScene = true; return D3D_OK; };
  M[42] = (dev) => { if (!dev.inScene) return D3DERR.INVALIDCALL; dev.inScene = false; return D3D_OK; };
  M[43] = (dev, count, rects, flags, color, zBits, stencil) => {
    const rs = [];
    for (let i = 0; i < count; i++) rs.push({ l: g.i32(rects + 16 * i), t: g.i32(rects + 16 * i + 4), r: g.i32(rects + 16 * i + 8), b: g.i32(rects + 16 * i + 12) });
    dev.clears++;
    dev.backend.clear(dev, flags, color >>> 0, fromBits(zBits), stencil >>> 0, rs);
    return D3D_OK;
  };
  M[44] = (dev, state, m) => { if (!m) return D3DERR.INVALIDCALL; dev.transforms.set(state, new Float32Array(g.u8.slice(m, m + 64).buffer)); return D3D_OK; };
  M[45] = (dev, state, m) => { const t = dev.transforms.get(state); for (let i = 0; i < 16; i++) g.dv.setFloat32(m + 4 * i, t ? t[i] : (i % 5 === 0 ? 1 : 0), true); return D3D_OK; };
  M[46] = (dev, state, m) => {
    const cur = dev.transforms.get(state) ?? Float32Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const b = Array.from({ length: 16 }, (_, i) => f32(m + 4 * i)), r = new Float32Array(16);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) r[4 * i + j] = cur[4 * i] * b[j] + cur[4 * i + 1] * b[4 + j] + cur[4 * i + 2] * b[8 + j] + cur[4 * i + 3] * b[12 + j];
    dev.transforms.set(state, r); return D3D_OK;
  };
  M[47] = (dev, vp) => {
    if (!vp) return D3DERR.INVALIDCALL;
    dev.viewport = { x: g.u32(vp), y: g.u32(vp + 4), w: g.u32(vp + 8), h: g.u32(vp + 12), minZ: f32(vp + 16), maxZ: f32(vp + 20) };
    return D3D_OK;
  };
  M[48] = (dev, vp) => {
    const v = dev.viewport; g.u32(vp, v.x); g.u32(vp + 4, v.y); g.u32(vp + 8, v.w); g.u32(vp + 12, v.h); g.dv.setFloat32(vp + 16, v.minZ, true); g.dv.setFloat32(vp + 20, v.maxZ, true); return D3D_OK;
  };
  M[49] = (dev, m) => { dev.material.set(g.u8.subarray(m, m + 68)); return D3D_OK; };
  M[50] = (dev, m) => { g.u8.set(dev.material, m); return D3D_OK; };
  M[51] = (dev, i, l) => { dev.lights.set(i, g.u8.slice(l, l + 104)); return D3D_OK; };
  M[52] = (dev, i, l) => { const v = dev.lights.get(i); if (!v) return D3DERR.INVALIDCALL; g.u8.set(v, l); return D3D_OK; };
  M[53] = (dev, i, on) => { dev.lightEnabled.set(i, !!on); return D3D_OK; };
  M[54] = (dev, i, out) => { g.u32(out, dev.lightEnabled.get(i) ? 1 : 0); return D3D_OK; };
  M[55] = (dev, i, p) => { if (i >= 6 || !p) return D3DERR.INVALIDCALL; for (let k = 0; k < 4; k++) dev.clipPlanes[i * 4 + k] = f32(p + 4 * k); return D3D_OK; };
  M[56] = (dev, i, p) => { if (i >= 6 || !p) return D3DERR.INVALIDCALL; for (let k = 0; k < 4; k++) g.dv.setFloat32(p + 4 * k, dev.clipPlanes[i * 4 + k], true); return D3D_OK; };
  M[57] = (dev, state, value) => { if (state >= 256) return D3DERR.INVALIDCALL; if (dev.rs[state] !== value >>> 0) { dev.rs[state] = value; dev.constantDirty.rs = true; } return D3D_OK; };
  M[58] = (dev, state, out) => { if (state >= 256 || !out) return D3DERR.INVALIDCALL; g.u32(out, dev.rs[state]); return D3D_OK; };
  M[59] = (dev, type, out) => {                                  // CreateStateBlock: full snapshot
    const snap = { device: dev, snap: snapshot(dev) };
    newObject(rt, 'stateblock', snap);
    g.u32(out, snap.object); return D3D_OK;
  };
  M[60] = () => { throw new Error('BeginStateBlock recording is not implemented'); };
  M[61] = () => { throw new Error('EndStateBlock recording is not implemented'); };
  M[62] = () => D3D_OK; M[63] = (dev, p) => { if (p) g.u32(p, 0); if (p) g.u32(p + 4, 0); return D3D_OK; };
  M[64] = (dev, stage, out) => { const t = dev.tex[samplerSlot(stage)]; if (!t) { g.u32(out, 0); return D3D_OK; } return outObj(g, out, t); };
  M[65] = (dev, stage, texP) => {
    const slot = samplerSlot(stage); if (slot >= SAMPLER_SLOTS) return D3DERR.INVALIDCALL;
    if(bind(rt, 'tex', dev.tex, slot, texP))dev.textureDirty|=1<<slot; return D3D_OK;
  };
  M[66] = (dev, stage, type, out) => { g.u32(out, dev.stageStates.get(stage * 64 + type) ?? 0); return D3D_OK; };
  M[67] = (dev, stage, type, v) => { dev.stageStates.set(stage * 64 + type, v); return D3D_OK; };
  M[68] = (dev, s, type, out) => { const slot = samplerSlot(s); if (slot >= SAMPLER_SLOTS || type >= 14) return D3DERR.INVALIDCALL; g.u32(out, dev.samplers[slot][type]); return D3D_OK; };
  M[69] = (dev, s, type, v) => { const slot = samplerSlot(s); if (slot >= SAMPLER_SLOTS || type >= 14) return D3DERR.INVALIDCALL; if (dev.samplers[slot][type] !== v >>> 0) { dev.samplers[slot][type] = v; dev.constantDirty.samplers = true; } return D3D_OK; };
  M[70] = (dev, passes) => { if (passes) g.u32(passes, 1); return D3D_OK; };
  M[71] = () => D3DERR.INVALIDCALL; M[72] = () => D3DERR.INVALIDCALL; M[73] = () => D3DERR.INVALIDCALL; M[74] = () => D3DERR.INVALIDCALL;
  M[75] = (dev, r) => { dev.scissor = readRect(g, r); return D3D_OK; };
  M[76] = (dev, r) => { const s = dev.scissor; g.u32(r, s.l); g.u32(r + 4, s.t); g.u32(r + 8, s.r); g.u32(r + 12, s.b); return D3D_OK; };
  M[77] = () => D3D_OK; M[78] = () => 0;
  M[79] = (dev, bits32) => { dev.npatch = fromBits(bits32); return D3D_OK; }; M[80] = (dev) => dev.npatch;
  const draw = (dev, call) => {
    if (!dev.inScene) return D3DERR.INVALIDCALL;
    dev.draws++;
    dev.backend.draw(dev, call);
    return D3D_OK;
  };
  M[81] = (dev, prim, start, count) => draw(dev, { indexed: false, prim, startVertex: start, primCount: count, numVerts: PRIM_VERTS(prim, count) });
  M[82] = (dev, prim, baseVertex, minIndex, numVerts, startIndex, primCount) => {
    if (!dev.ib) return D3DERR.INVALIDCALL;
    return draw(dev, { indexed: true, prim, baseVertex: baseVertex | 0, minIndex, numVerts, startIndex, primCount });
  };
  M[83] = (dev, prim, count, data, stride) => {
    const nv = PRIM_VERTS(prim, count);
    return draw(dev, { indexed: false, up: true, prim, primCount: count, numVerts: nv, vertexData: data, vertexBytes: nv * stride, stride });
  };
  M[84] = (dev, prim, minIndex, numVerts, count, idx, idxFmt, vdata, stride) => {
    const isz = idxFmt === FMT.INDEX32 ? 4 : 2;
    return draw(dev, { indexed: true, up: true, prim, minIndex, numVerts, primCount: count, indexData: idx, indexFormat: idxFmt, indexBytes: PRIM_VERTS(prim, count) * isz, vertexData: vdata, vertexBytes: (minIndex + numVerts) * stride, stride });
  };
  M[85] = () => { throw new Error('ProcessVertices is not implemented'); };
  M[86] = (dev, elems, out) => {                                 // CreateVertexDeclaration
    const list = [];
    for (let p = elems; ; p += 8) {
      const stream = g.dv.getUint16(p, true);
      if (stream === 0xff) break;
      list.push({ stream, offset: g.dv.getUint16(p + 2, true), type: g.u8[p + 4], method: g.u8[p + 5], usage: g.u8[p + 6], usageIndex: g.u8[p + 7] });
      if (list.length > 64) return D3DERR.INVALIDCALL;
    }
    const st = { device: dev, elements: list, raw: g.u8.slice(elems, elems + 8 * (list.length + 1)) };
    newObject(rt, 'decl', st);
    g.u32(out, st.object); return D3D_OK;
  };
  M[87] = (dev, declP) => { setHeld(rt, dev, 'decl', declP); dev.fvf = 0; return D3D_OK; };
  M[88] = (dev, out) => (dev.decl ? outObj(g, out, dev.decl) : (g.u32(out, 0), D3D_OK));
  M[89] = (dev, fvf) => { dev.fvf = fvf; if (fvf) setHeld(rt, dev, 'decl', 0); return D3D_OK; };
  M[90] = (dev, out) => { g.u32(out, dev.fvf); return D3D_OK; };
  const createShader = (stage) => (dev, fn, out) => {
    if (!fn || !out) return D3DERR.INVALIDCALL;
    // Token stream: version, instructions..., END (0x0000ffff).
    let p = fn; const version = g.u32(p);
    const major = (version >>> 8) & 0xff;
    if ((version >>> 16) !== (stage === 'vs' ? 0xfffe : 0xffff) || major < 1 || major > 3) return D3DERR.INVALIDCALL;
    for (let guard = 0; ; guard++) {
      p += 4; const tok = g.u32(p);
      if ((tok & 0xffff) === 0xffff && (tok >>> 16) === 0) break;
      if ((tok & 0xffff) === 0xfffe) { p += 4 * ((tok >>> 16) & 0x7fff); continue; }         // comment block
      if (guard > 1 << 20) return D3DERR.INVALIDCALL;
    }
    const bytes = g.u8.slice(fn, p + 4);
    const st = { device: dev, stage, bytecode: bytes, version };
    newObject(rt, stage, st);
    dev.backend.createResource(st);
    g.u32(out, st.object); return D3D_OK;
  };
  M[91] = createShader('vs');
  M[92] = (dev, p) => { setHeld(rt, dev, 'vs', p); return D3D_OK; };
  M[93] = (dev, out) => (dev.vs ? outObj(g, out, dev.vs) : (g.u32(out, 0), D3D_OK));
  M[106] = createShader('ps');
  M[107] = (dev, p) => { setHeld(rt, dev, 'ps', p); return D3D_OK; };
  M[108] = (dev, out) => (dev.ps ? outObj(g, out, dev.ps) : (g.u32(out, 0), D3D_OK));
  const constF = (key) => ({
    set: (dev, start, data, n) => { if (start + n > 256 || !data) return D3DERR.INVALIDCALL; if(!(data&3))dev[key].set(new Float32Array(g.u8.buffer,data,n*4),start*4);else for (let i = 0; i < n * 4; i++) dev[key][start * 4 + i] = f32(data + 4 * i); dev.constantDirty[key] = true;
      const r = dev.constRange[key]; if (r) { if (start < r[0]) r[0] = start; if (start + n > r[1]) r[1] = start + n; } return D3D_OK; },
    get: (dev, start, data, n) => { if (start + n > 256 || !data) return D3DERR.INVALIDCALL; for (let i = 0; i < n * 4; i++) g.dv.setFloat32(data + 4 * i, dev[key][start * 4 + i], true); return D3D_OK; },
  });
  const constI = (key) => ({
    set: (dev, start, data, n) => { if (start + n > 16 || !data) return D3DERR.INVALIDCALL; if(!(data&3))dev[key].set(new Int32Array(g.u8.buffer,data,n*4),start*4);else for (let i = 0; i < n * 4; i++) dev[key][start * 4 + i] = g.dv.getInt32(data + 4 * i, true); dev.constantDirty[key] = true; return D3D_OK; },
    get: (dev, start, data, n) => { if (start + n > 16 || !data) return D3DERR.INVALIDCALL; for (let i = 0; i < n * 4; i++) g.dv.setInt32(data + 4 * i, dev[key][start * 4 + i], true); return D3D_OK; },
  });
  const constB = (key) => ({
    set: (dev, start, data, n) => { if (start + n > 16 || !data) return D3DERR.INVALIDCALL; for (let i = 0; i < n; i++) dev[key][start + i] = g.u32(data + 4 * i) ? 1 : 0; dev.constantDirty[key] = true; return D3D_OK; },
    get: (dev, start, data, n) => { if (start + n > 16 || !data) return D3DERR.INVALIDCALL; for (let i = 0; i < n; i++) g.u32(data + 4 * i, dev[key][start + i]); return D3D_OK; },
  });
  [[94, constF('vsF')], [109, constF('psF')]].forEach(([i, c]) => { M[i] = c.set; M[i + 1] = c.get; });
  [[96, constI('vsI')], [111, constI('psI')]].forEach(([i, c]) => { M[i] = c.set; M[i + 1] = c.get; });
  [[98, constB('vsB')], [113, constB('psB')]].forEach(([i, c]) => { M[i] = c.set; M[i + 1] = c.get; });
  M[100] = (dev, n, vbP, offset, stride) => {
    if (n >= 16) return D3DERR.INVALIDCALL;
    const s = dev.streams[n], prev = s.vb, next = vbP ? rt.objects.get(vbP) : null;
    if (vbP && (!next || next.kind !== 'vb')) return D3DERR.INVALIDCALL;
    if (next) addRef(next);
    s.vb = next; s.offset = offset; s.stride = stride; dev.streamDirty|=1<<n;
    if (prev) release(rt, prev);
    return D3D_OK;
  };
  M[101] = (dev, n, outP, offP, strideP) => {
    if (n >= 16) return D3DERR.INVALIDCALL;
    const s = dev.streams[n];
    if (s.vb) { addRef(s.vb); g.u32(outP, s.vb.object); } else g.u32(outP, 0);
    g.u32(offP, s.offset); g.u32(strideP, s.stride); return D3D_OK;
  };
  M[102] = (dev, n, div) => { if (n >= 16) return D3DERR.INVALIDCALL; if(dev.streams[n].freq!==div){dev.streams[n].freq = div;dev.streamDirty|=1<<n;} return D3D_OK; };
  M[103] = (dev, n, out) => { if (n >= 16) return D3DERR.INVALIDCALL; g.u32(out, dev.streams[n].freq); return D3D_OK; };
  M[104] = (dev, ibP) => { setHeld(rt, dev, 'ib', ibP); return D3D_OK; };
  M[105] = (dev, out) => (dev.ib ? outObj(g, out, dev.ib) : (g.u32(out, 0), D3D_OK));
  M[115] = () => D3DERR.NOTAVAILABLE; M[116] = () => D3DERR.NOTAVAILABLE; M[117] = () => D3D_OK;
  M[118] = (dev, type, out) => {                                 // CreateQuery
    // The backend has no real sample-count query path. Advertising one made
    // Source render proxy geometry and poll results that were always 0xffff.
    const supported = type===8 || (type===9 && dev.backend.supportsOcclusion===true);
    if (!supported) {if(out)g.u32(out,0);return D3DERR.NOTAVAILABLE;}
    if (!out) return D3D_OK;                                     // capability probe
    const st = { device: dev, queryType: type, issued: false };
    newObject(rt, 'query', st);
    g.u32(out, st.object); return D3D_OK;
  };

  // ---- child interfaces -----------------------------------------------------
  const resCommon = {
    3: (st, out) => outObj(g, out, st.device),          // GetDevice -> device object
    4: () => D3D_OK, 5: () => D3DERR.INVALIDCALL, 6: () => D3D_OK, 7: () => 0, 8: () => 0, 9: () => 0,
  };
  const S = rt.methods.surface = { ...resCommon };
  S[10] = (st) => RTYPE.SURFACE;
  S[11] = (st, riid, out) => (st.texture ? outObj(g, out, st.texture) : D3DERR.INVALIDCALL);
  S[12] = (st, desc) => {                                         // GetDesc: format type usage pool ms msq w h
    g.u32(desc, st.format); g.u32(desc + 4, RTYPE.SURFACE); g.u32(desc + 8, st.usage); g.u32(desc + 12, st.pool);
    g.u32(desc + 16, st.ms); g.u32(desc + 20, st.msq); g.u32(desc + 24, st.w); g.u32(desc + 28, st.h); return D3D_OK;
  };
  S[13] = (st, out, rect, flags) => {                              // LockRect
    if (st.texture) return lockLevel(rt, st.texture, st.face, st.level, out, rect, flags);
    if (!(st.lockable || st.pool !== POOL.DEFAULT)) return D3DERR.INVALIDCALL;
    if (st.locked) return D3DERR.INVALIDCALL;
    const base = ensureShadow(rt, st);
    let off = 0;
    if (rect) { const l = g.i32(rect), t = g.i32(rect + 4); off = BLOCK_FORMATS.has(st.format) ? (t >> 2) * st.pitch + (l >> 2) * BLOCK_FORMATS.get(st.format) : t * st.pitch + l * BPP.get(st.format); }
    st.locked = { flags };
    g.u32(out, st.pitch); g.u32(out + 4, base + off); return D3D_OK;
  };
  S[14] = (st) => {
    if (st.texture) return unlockLevel(rt, st.texture, st.face, st.level);
    if (!st.locked) return D3DERR.INVALIDCALL;
    st.locked = null; return D3D_OK;
  };
  S[15] = () => D3DERR.INVALIDCALL; S[16] = () => D3DERR.INVALIDCALL;     // GetDC/ReleaseDC

  const texCommon = (cubeLike) => {
    const T = { ...resCommon };
    T[10] = (st) => (st.texKind === 'cube' ? RTYPE.CUBETEXTURE : st.texKind === '3d' ? RTYPE.VOLUMETEXTURE : RTYPE.TEXTURE);
    T[11] = (st, lod) => { const p = st.lod; st.lod = Math.min(lod, st.levels - 1); return p; };
    T[12] = (st) => st.lod; T[13] = (st) => st.levels;
    T[14] = (st, f) => { st.autoGenFilter = f; return D3D_OK; }; T[15] = (st) => st.autoGenFilter;
    T[16] = (st) => { st.device.backend.generateMips(st); return 0; };
    return T;
  };
  const descOf = (st, l, desc) => {
    const lay = st.layouts[l]; if (!lay) return D3DERR.INVALIDCALL;
    g.u32(desc, st.format); g.u32(desc + 4, st.texKind === 'cube' ? RTYPE.SURFACE : st.texKind === '3d' ? RTYPE.VOLUME : RTYPE.SURFACE);
    g.u32(desc + 8, st.usage); g.u32(desc + 12, st.pool); g.u32(desc + 16, 0); g.u32(desc + 20, 0); g.u32(desc + 24, lay.w); g.u32(desc + 28, lay.h);
    return D3D_OK;
  };
  const T2 = rt.methods.texture = texCommon();
  T2[17] = (st, l, desc) => descOf(st, l, desc);
  T2[18] = (st, l, out) => (l < st.levels ? outObj(g, out, surfaceOf(rt, st, 0, l)) : D3DERR.INVALIDCALL);
  T2[19] = (st, l, out, rect, flags) => lockLevel(rt, st, 0, l, out, rect, flags);
  T2[20] = (st, l) => unlockLevel(rt, st, 0, l);
  T2[21] = () => D3D_OK;
  const TC = rt.methods.cube = texCommon();
  TC[17] = (st, l, desc) => descOf(st, l, desc);
  TC[18] = (st, face, l, out) => (face < 6 && l < st.levels ? outObj(g, out, surfaceOf(rt, st, face, l)) : D3DERR.INVALIDCALL);
  TC[19] = (st, face, l, out, rect, flags) => lockLevel(rt, st, face, l, out, rect, flags);
  TC[20] = (st, face, l) => unlockLevel(rt, st, face, l);
  TC[21] = () => D3D_OK;
  const TV = rt.methods.voltex = texCommon();
  TV[17] = (st, l, desc) => {                                      // D3DVOLUME_DESC: fmt type usage pool w h d
    const lay = st.layouts[l]; if (!lay) return D3DERR.INVALIDCALL;
    g.u32(desc, st.format); g.u32(desc + 4, RTYPE.VOLUME); g.u32(desc + 8, st.usage); g.u32(desc + 12, st.pool); g.u32(desc + 16, lay.w); g.u32(desc + 20, lay.h); g.u32(desc + 24, lay.d); return D3D_OK;
  };
  TV[18] = (st, l, out) => {
    if (l >= st.levels) return D3DERR.INVALIDCALL;
    st.volumes ||= new Map();
    let v = st.volumes.get(l);
    if (!v) { v = { device: st.device, parent: st, level: l }; newObject(rt, 'volume', v); v.refs = 0; st.children.push(v); st.volumes.set(l, v); }
    return outObj(g, out, v);
  };
  TV[19] = (st, l, out, box, flags) => lockBox(st, l, out, box, flags);
  TV[20] = (st, l) => unlockLevel(rt, st, 0, l);
  TV[21] = () => D3D_OK;
  function lockBox(st, l, out, box, flags) {                       // D3DLOCKED_BOX { RowPitch; SlicePitch; pBits }
    const lay = st.layouts[l]; if (!lay) return D3DERR.INVALIDCALL;
    if (st.locks?.has(l)) return D3DERR.INVALIDCALL;
    const base = shadowFor(rt, st, 0, l);
    let off = 0, lb = null;
    if (box) { lb = { l: g.i32(box), t: g.i32(box + 4), r: g.i32(box + 8), b: g.i32(box + 12), f: g.i32(box + 16), k: g.i32(box + 20) }; off = lb.f * lay.slice + lb.t * lay.pitch + lb.l * (BPP.get(st.format) || 0); }
    (st.locks ||= new Map()).set(l, { rect: lb, flags });
    g.u32(out, lay.pitch); g.u32(out + 4, lay.slice); g.u32(out + 8, base + off); return D3D_OK;
  }
  const VOL = rt.methods.volume = { 3: (st, out) => outObj(g, out, st.device), 4: () => D3D_OK, 5: () => D3DERR.INVALIDCALL, 6: () => D3D_OK };
  VOL[7] = (st, riid, out) => outObj(g, out, st.parent);
  VOL[8] = (st, desc) => TV[17](st.parent, st.level, desc);
  VOL[9] = (st, out, box, flags) => lockBox(st.parent, st.level, out, box, flags);
  VOL[10] = (st) => unlockLevel(rt, st.parent, 0, st.level);

  for (const kind of ['vb', 'ib']) {
    const B = rt.methods[kind] = { ...resCommon };
    B[10] = () => (kind === 'vb' ? RTYPE.VERTEXBUFFER : RTYPE.INDEXBUFFER);
    B[11] = (st, off, size, out, flags) => {                         // Lock(offset,size,ppData,flags)
      if (!out || st.lock) return D3DERR.INVALIDCALL;
      if (off > st.size || (size && off + size > st.size)) return D3DERR.INVALIDCALL;
      st.lock = { off, size: size || st.size - off, flags };
      g.u32(out, st.data + off); return D3D_OK;
    };
    B[12] = (st) => {
      if (!st.lock) return D3DERR.INVALIDCALL;
      const l = st.lock; st.lock = null;
      if (!(l.flags & LOCK.READONLY)) st.device.backend.uploadBuffer(st, l.off, l.size);
      return D3D_OK;
    };
    B[13] = (st, desc) => {                                           // D3DVERTEXBUFFER_DESC / INDEXBUFFER_DESC
      g.u32(desc, kind === 'vb' ? 100 : st.format); g.u32(desc + 4, kind === 'vb' ? RTYPE.VERTEXBUFFER : RTYPE.INDEXBUFFER);
      g.u32(desc + 8, st.usage); g.u32(desc + 12, st.pool); g.u32(desc + 16, st.size); if (kind === 'vb') g.u32(desc + 20, st.fvf); return D3D_OK;
    };
  }
  rt.methods.decl = {
    3: (st, out) => outObj(g, out, st.device),
    4: (st, out, countP) => {
      if (countP) g.u32(countP, st.elements.length + 1);
      if (out) g.u8.set(st.raw, out);
      return D3D_OK;
    },
  };
  for (const stage of ['vs', 'ps']) {
    rt.methods[stage] = {
      3: (st, out) => outObj(g, out, st.device),
      4: (st, out, sizeP) => { if (sizeP) g.u32(sizeP, st.bytecode.length); if (out) g.u8.set(st.bytecode, out); return D3D_OK; },
    };
  }
  rt.methods.query = {
    3: (st, out) => outObj(g, out, st.device),
    4: (st) => st.queryType,
    5: (st) => (st.queryType === 9 ? 4 : 4),
    6: (st, flags) => { st.issued = true; st.pending = flags; return D3D_OK; },
    7: (st, data, size, flags) => {
      if (!st.issued) return D3DERR.INVALIDCALL;
      if (data && size >= 4) g.u32(data, st.queryType === 8 ? 1 : st.device.backend.queryResult(st) >>> 0);
      return D3D_OK;                                                 // S_OK: result ready
    },
  };
  rt.methods.swap = {
    3: (st, ...a) => { st.device.frames++; st.device.backend.present(st.device); return D3D_OK; },
    4: (st, dst) => M[33](st.device, 0, dst),
    5: (st, idx, type, out) => (idx === 0 ? outObj(g, out, st.device.backBuffer) : D3DERR.INVALIDCALL),
    6: (st, p) => { if (p) { g.u32(p, 0); g.u32(p + 4, st.device.frames % st.device.height); } return D3D_OK; },
    7: (st, m) => M[8](st.device, 0, m),
    8: (st, out) => outObj(g, out, st.device),
    9: (st, p) => { writePP(g, p, st.device); return D3D_OK; },
  };
  rt.methods.stateblock = {
    3: (st, out) => outObj(g, out, st.device),
    4: (st) => { st.snap = snapshot(st.device); return D3D_OK; },
    5: (st) => { restore(rt, st.device, st.snap); return D3D_OK; },
  };
}

const readRect = (g, p) => ({ l: g.i32(p), t: g.i32(p + 4), r: g.i32(p + 8), b: g.i32(p + 12) });

function snapshot(dev) {
  return {
    rs: dev.rs.slice(), samplers: dev.samplers.map((s) => s.slice()), vsF: dev.vsF.slice(), psF: dev.psF.slice(),
    vsI: dev.vsI.slice(), psI: dev.psI.slice(), vsB: dev.vsB.slice(), psB: dev.psB.slice(),
    viewport: { ...dev.viewport }, scissor: { ...dev.scissor }, clipPlanes: dev.clipPlanes.slice(),
    tex: dev.tex.slice(), streams: dev.streams.map((s) => ({ ...s })), ib: dev.ib, decl: dev.decl, vs: dev.vs, ps: dev.ps, fvf: dev.fvf,
  };
}
function restore(rt, dev, s) {
  dev.textureDirty=(1<<SAMPLER_SLOTS)-1;dev.streamDirty=0xffff;
  if(dev.constantDirty)for(const key of Object.keys(dev.constantDirty))dev.constantDirty[key]=true;
  dev.constRange = {};
  dev.rs.set(s.rs); s.samplers.forEach((x, i) => dev.samplers[i].set(x));
  dev.vsF.set(s.vsF); dev.psF.set(s.psF); dev.vsI.set(s.vsI); dev.psI.set(s.psI); dev.vsB.set(s.vsB); dev.psB.set(s.psB);
  dev.viewport = { ...s.viewport }; dev.scissor = { ...s.scissor }; dev.clipPlanes.set(s.clipPlanes); dev.fvf = s.fvf;
  const rebind = (key, next) => { const prev = dev[key]; if (next) addRef(next); dev[key] = next; if (prev) release(rt, prev); };
  rebind('ib', s.ib); rebind('decl', s.decl); rebind('vs', s.vs); rebind('ps', s.ps);
  s.tex.forEach((t, i) => { const prev = dev.tex[i]; if (t) addRef(t); dev.tex[i] = t; if (prev) release(rt, prev); });
  s.streams.forEach((x, i) => { const cur = dev.streams[i], prev = cur.vb; if (x.vb) addRef(x.vb); dev.streams[i] = { ...x }; if (prev) release(rt, prev); });
}
