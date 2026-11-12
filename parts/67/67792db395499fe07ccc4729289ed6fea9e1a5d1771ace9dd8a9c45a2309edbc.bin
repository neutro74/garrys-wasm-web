// GDI for the retail DLLs: device contexts, fonts, DIB sections and text output.
//
// vguimatsurface rasterises every glyph through GDI: it selects a font into a memory DC that holds a DIB
// section, draws one character with ExtTextOut (white on black) and reads the DIB bits back. Objects live
// in a per-thread table; DIB bits live in guest memory so the guest reads them directly. Glyphs are drawn
// by a rasteriser (Skia canvas in Node, OffscreenCanvas in the browser build) behind the small interface
// at the top of this file.

import { fs, path, isNode, env as ENV } from './platform.mjs';

const OBJ = { DC: 1, FONT: 2, BITMAP: 3, BRUSH: 4, PEN: 5, REGION: 6 };
const TA_RIGHT = 2, TA_CENTER = 6, TA_BOTTOM = 8, TA_BASELINE = 24;
const ETO_OPAQUE = 2;
const OPAQUE = 2;

// Windows family -> installed substitute. Metrics differ slightly from the real fonts.
const FAMILY_MAP = new Map(Object.entries({
  arial: 'Liberation Sans', helvetica: 'Liberation Sans', tahoma: 'Liberation Sans', verdana: 'Liberation Sans', 'trebuchet ms': 'Liberation Sans',
  'segoe ui': 'Liberation Sans', 'microsoft sans serif': 'Liberation Sans', 'lucida sans': 'Liberation Sans', 'lucida grande': 'Liberation Sans',
  'ms shell dlg': 'Liberation Sans', 'ms shell dlg 2': 'Liberation Sans', roboto: 'Liberation Sans', 'open sans': 'Liberation Sans', system: 'Liberation Sans',
  'times new roman': 'Liberation Serif', georgia: 'Liberation Serif', times: 'Liberation Serif', 'courier new': 'Liberation Mono', 'lucida console': 'Liberation Mono',
  consolas: 'Liberation Mono', courier: 'Liberation Mono', 'terminal': 'Liberation Mono', symbol: 'Symbola', webdings: 'Symbola', wingdings: 'Symbola', marlett: 'Symbola',
}));
const FALLBACK = 'Liberation Sans';

let canvasModule = null;
async function loadCanvas() {
  if (!canvasModule) canvasModule = isNode ? await import('@napi-rs/canvas') : webCanvas();
  return canvasModule;
}
// Resolved once at install time so synchronous shims can use it.
let C = null;
export async function initGdi() { C = await loadCanvas(); }

// Family name from a TrueType/OpenType name table (id 16 preferred, else id 1).
function fontFamilyName(bytes) {
  try {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const tables = dv.getUint16(4);
    for (let i = 0; i < tables; i++) {
      const o = 12 + 16 * i;
      if (String.fromCharCode(...bytes.subarray(o, o + 4)) !== 'name') continue;
      const off = dv.getUint32(o + 8), count = dv.getUint16(off + 2), strings = off + dv.getUint16(off + 4);
      let best = null;
      for (let k = 0; k < count; k++) {
        const r = off + 6 + 12 * k, platform = dv.getUint16(r), id = dv.getUint16(r + 6), len = dv.getUint16(r + 8), at = strings + dv.getUint16(r + 10);
        if (id !== 1 && id !== 16) continue;
        let name = '';
        if (platform === 3 || platform === 0) for (let j = 0; j < len; j += 2) name += String.fromCharCode(dv.getUint16(at + j));
        else for (let j = 0; j < len; j++) name += String.fromCharCode(bytes[at + j]);
        if (!best || id === 16) best = name;
      }
      return best;
    }
  } catch { /* fall through */ }
  return null;
}

// Canvas, fonts and ImageData over OffscreenCanvas. FontFace loading is asynchronous and the guest never yields,
// so bundled fonts are loaded by preloadFonts() before the guest starts; later AddFontResource calls only map names.
function webCanvas() {
  const registered = new Map(), families = [];
  const register = (bytes, real) => {
    const family = fontFamilyName(bytes) ?? path.basename(real, path.extname(real));
    if (!registered.has(family.toLowerCase())) {
      const face = new FontFace(family, bytes.slice().buffer);
      self.fonts.add(face);
      registered.set(family.toLowerCase(), { face, family });
      families.push({ family, styles: [{ path: real }] });
    }
    return family;
  };
  return {
    createCanvas: (w, h) => { const c = new OffscreenCanvas(w, h), get = c.getContext.bind(c); c.getContext = (t) => get(t, { willReadFrequently: true }); return c; },
    ImageData: globalThis.ImageData,
    GlobalFonts: {
      get families() { return families; },
      has: (name) => registered.has(name.toLowerCase()),
      registerFromPath: (real) => register(fs.readFileSync(real), real),
      async preload(real) { const bytes = fs.readFileSync(real), family = register(bytes, real); await registered.get(family.toLowerCase()).face.load(); return family; },
    },
  };
}

// Loads game fonts (resource/fonts/*.ttf and friends) so they are usable by name before the guest runs.
export async function preloadFonts(files) {
  await initGdi();
  for (const f of files) { try { await C.GlobalFonts.preload(f); } catch { /* unreadable font: leave it unmapped */ } }
}

// Windows families map to installed substitutes; in the browser, to generic stacks (system fonts cannot be probed).
const WEB_STACKS = { 'Liberation Sans': '"Liberation Sans", Arial, Helvetica, "Noto Sans", Roboto, sans-serif', 'Liberation Serif': '"Liberation Serif", "Times New Roman", "Noto Serif", serif', 'Liberation Mono': '"Liberation Mono", "Courier New", "Noto Sans Mono", monospace', Symbola: 'Symbola, "Noto Sans Symbols", sans-serif' };
const cssFamily = (family) => (isNode ? `"${family}"` : (WEB_STACKS[family] ?? `"${family}"`));

const parseLogFont = (g, p, wide) => {
  const lf = {
    height: g.i32(p), width: g.i32(p + 4), weight: g.i32(p + 16), italic: g.u8[p + 20], underline: g.u8[p + 21], strike: g.u8[p + 22], charset: g.u8[p + 23],
  };
  lf.face = wide ? readWide(g, p + 28, 32) : g.readStr(p + 28).slice(0, 31);
  return lf;
};
function readWide(g, p, max) { let s = ''; for (let i = 0; i < max; i++) { const c = g.dv.getUint16(p + 2 * i, true); if (!c) break; s += String.fromCharCode(c); } return s; }
const writeAnsi = (g, p, s, max) => { const n = Math.min(s.length, max - 1); for (let i = 0; i < n; i++) g.u8[p + i] = s.charCodeAt(i) & 255; g.u8[p + n] = 0; };

export function installGdi(SHIMS, { wstr }) {
  if (!C) throw new Error('call initGdi() before installing GDI');
  const { createCanvas, GlobalFonts } = C;
  const state = { next: 0x30001000, objs: new Map(), custom: new Map(), measureCtx: createCanvas(8, 8).getContext('2d') };
  const newObj = (o) => { const h = state.next; state.next += 4; state.objs.set(h, o); return h; };
  const get = (h, type) => { const o = state.objs.get(h >>> 0); return o && (!type || o.type === type) ? o : null; };
  const def = (name, arity, fn) => { SHIMS[`gdi32.dll!${name}`] = { arity, pop: 4 * arity, fn }; };
  const defUser = (name, arity, fn) => { SHIMS[`user32.dll!${name}`] = { arity, pop: 4 * arity, fn }; };

  // Stock objects and the screen DC exist from the start.
  const screenDc = newObj({ type: OBJ.DC, font: null, bitmap: null, fg: 0, bg: 0xffffff, bkMode: OPAQUE, align: 0, screen: true });
  const stock = new Map();
  const stockObject = (n) => {
    if (!stock.has(n)) {
      let o;
      if (n === 13 || n === 16 || n === 17 || n === 14 || n === 10 || n === 11) o = { type: OBJ.FONT, lf: { height: -11, width: 0, weight: n === 13 ? 700 : 400, italic: 0, underline: 0, strike: 0, charset: 1, face: 'Tahoma' } };
      else if (n >= 0 && n <= 5) o = { type: OBJ.BRUSH, color: [0xffffff, 0xc0c0c0, 0x808080, 0x404040, 0x000000, null][n] };
      else if (n >= 6 && n <= 8) o = { type: OBJ.PEN, color: [0xffffff, 0, null][n - 6], width: 1 };
      else o = { type: OBJ.BRUSH, color: 0 };
      stock.set(n, newObj(o));
    }
    return stock.get(n);
  };

  // Rasteriser

  const fontKey = (lf) => `${lf.face}|${lf.height}|${lf.weight}|${lf.italic}`;
  const resolveFamily = (face) => {
    const lower = face.toLowerCase();
    if (state.custom.has(lower)) return state.custom.get(lower);
    if (GlobalFonts.has(face)) return face;
    return FAMILY_MAP.get(lower) ?? null;
  };
  const fontInfo = (font) => {
    if (font.info) return font.info;
    const lf = font.lf, family = resolveFamily(lf.face) ?? FALLBACK;
    const style = `${lf.italic ? 'italic ' : ''}${lf.weight >= 600 ? 'bold ' : ''}`;
    const probe = (em) => { state.measureCtx.font = `${style}${em}px ${cssFamily(family)}`; return state.measureCtx.measureText('Hg'); };
    const p100 = probe(100);
    const cellRatio = (p100.fontBoundingBoxAscent + p100.fontBoundingBoxDescent) / 100;
    const em = lf.height < 0 ? -lf.height : lf.height > 0 ? lf.height / cellRatio : 12;
    const m = probe(em);
    const ink = state.measureCtx.measureText(Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)).join(''));
    const ascent = Math.max(1, Math.ceil(m.fontBoundingBoxAscent), Math.ceil(ink.actualBoundingBoxAscent));
    const descent = Math.max(0, Math.ceil(m.fontBoundingBoxDescent), Math.ceil(ink.actualBoundingBoxDescent));
    const info = { family, style, em, ascent, descent, css: `${style}${em}px ${cssFamily(family)}`, cell: ascent + descent };
    state.measureCtx.font = info.css;
    info.avgWidth = Math.max(1, Math.round(state.measureCtx.measureText('x').width));
    info.maxWidth = Math.max(info.avgWidth, Math.round(state.measureCtx.measureText('W').width * 1.25));
    font.info = info;
    return info;
  };
  const measure = (font, text) => {
    const info = fontInfo(font);
    state.measureCtx.font = info.css;
    return state.measureCtx.measureText(text);
  };
  const advance = (font, text) => Math.round(measure(font, text).width);

  // DIB access

  const bitsOf = (b) => (b.bits ? { u8: b.g.u8, base: b.bits } : null);
  const rowAddr = (b, y) => b.bits + (b.bottomUp ? b.h - 1 - y : y) * b.stride;
  const readRegion = (b, x, y, w, h) => {      // RGBA bytes of the DIB region
    const out = new Uint8ClampedArray(w * h * 4);
    for (let r = 0; r < h; r++) {
      const src = rowAddr(b, y + r) + x * (b.bpp >> 3);
      for (let c = 0; c < w; c++) {
        const s = src + c * (b.bpp >> 3), d = (r * w + c) * 4;
        if (b.bpp === 32 || b.bpp === 24) { out[d] = b.g.u8[s + 2]; out[d + 1] = b.g.u8[s + 1]; out[d + 2] = b.g.u8[s]; out[d + 3] = 255; }
        else if (b.bpp === 8) { out[d] = out[d + 1] = out[d + 2] = b.g.u8[s]; out[d + 3] = 255; }
      }
    }
    return out;
  };
  const writeRegion = (b, x, y, w, h, rgba) => {
    for (let r = 0; r < h; r++) {
      const dst = rowAddr(b, y + r) + x * (b.bpp >> 3);
      for (let c = 0; c < w; c++) {
        const d = dst + c * (b.bpp >> 3), s = (r * w + c) * 4;
        if (b.bpp === 32 || b.bpp === 24) { b.g.u8[d] = rgba[s + 2]; b.g.u8[d + 1] = rgba[s + 1]; b.g.u8[d + 2] = rgba[s]; if (b.bpp === 32) b.g.u8[d + 3] = 0; }
        else if (b.bpp === 8) b.g.u8[d] = rgba[s + 1];
      }
    }
  };
  const colorRef = (c) => [c & 255, (c >> 8) & 255, (c >> 16) & 255];

  const fillRect = (b, l, t, r, bt, color) => {
    l = Math.max(0, l); t = Math.max(0, t); r = Math.min(b.w, r); bt = Math.min(b.h, bt);
    if (r <= l || bt <= t) return;
    const [cr, cg, cb] = colorRef(color), px = b.bpp >> 3;
    for (let y = t; y < bt; y++) {
      let p = rowAddr(b, y) + l * px;
      for (let x = l; x < r; x++, p += px) { b.g.u8[p] = cb; if (px > 1) { b.g.u8[p + 1] = cg; b.g.u8[p + 2] = cr; } }
    }
  };

  // Draws `text` with the DC's font at (x, y), honouring the text alignment, background mode and fill rectangle.
  const drawText = (g, dc, x, y, text, options, rect) => {
    const bmp = dc.bitmap;
    if (!bmp || !dc.font) return 1;
    const font = dc.font, info = fontInfo(font);
    if (ENV.GUEST_DEBUG_FONT && text === '_' && !font.tracedUnderscore) {
      font.tracedUnderscore = true;
      console.log('[gdi-underscore]', JSON.stringify({ lf: font.lf, info, x, y, align: dc.align, bitmap: [bmp.w, bmp.h] }));
    }
    const wText = Math.max(1, Math.ceil(measure(font, text).width) + 2);
    let ox = x, oy = y;
    const h = info.cell;
    if ((dc.align & TA_CENTER) === TA_CENTER) ox -= Math.round(wText / 2); else if (dc.align & TA_RIGHT) ox -= wText;
    if ((dc.align & TA_BASELINE) === TA_BASELINE) oy -= info.ascent; else if (dc.align & TA_BOTTOM) oy -= h;
    if ((options & ETO_OPAQUE) && rect) fillRect(bmp, rect.l, rect.t, rect.r, rect.b, dc.bg);
    else if (dc.bkMode === OPAQUE && !(options & ETO_OPAQUE)) fillRect(bmp, ox, oy, ox + wText, oy + h, dc.bg);
    const x0 = Math.max(0, ox), y0 = Math.max(0, oy), x1 = Math.min(bmp.w, ox + wText), y1 = Math.min(bmp.h, oy + h);
    if (x1 <= x0 || y1 <= y0) return 1;
    const w = x1 - x0, hh = y1 - y0;
    const cv = createCanvas(w, hh), cx = cv.getContext('2d');
    const bg = readRegion(bmp, x0, y0, w, hh);
    cx.putImageData(new C.ImageData(bg, w, hh), 0, 0);
    cx.font = info.css;
    cx.textBaseline = 'alphabetic';
    const [r, gc, b] = colorRef(dc.fg);
    cx.fillStyle = `rgb(${r},${gc},${b})`;
    cx.fillText(text, ox - x0, oy - y0 + info.ascent);
    writeRegion(bmp, x0, y0, w, hh, cv.getContext('2d').getImageData(0, 0, w, hh).data);
    if (font.lf.underline) fillRect(bmp, ox, oy + info.ascent + 1, ox + wText, oy + info.ascent + 2, dc.fg);
    return 1;
  };

  const readText = (g, p, n, wide) => {
    if (!p || n <= 0) return '';
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(wide ? g.dv.getUint16(p + 2 * i, true) : g.u8[p + i]);
    return s;
  };

  // Fonts

  const makeFont = (lf) => newObj({ type: OBJ.FONT, lf });
  def('CreateFontA', 14, function (h, w, esc, orient, weight, italic, underline, strike, charset, outp, clip, quality, pitch, face) {
    return makeFont({ height: h | 0, width: w | 0, weight: weight || 400, italic: italic & 255, underline: underline & 255, strike: strike & 255, charset: charset & 255, face: face ? this.g.readStr(face) : '' });
  });
  def('CreateFontW', 14, function (h, w, esc, orient, weight, italic, underline, strike, charset, outp, clip, quality, pitch, face) {
    return makeFont({ height: h | 0, width: w | 0, weight: weight || 400, italic: italic & 255, underline: underline & 255, strike: strike & 255, charset: charset & 255, face: face ? wstr(this.g, face) : '' });
  });
  def('CreateFontIndirectA', 1, function (p) { return makeFont(parseLogFont(this.g, p, false)); });
  def('CreateFontIndirectW', 1, function (p) { return makeFont(parseLogFont(this.g, p, true)); });

  const addFont = function (file) {
    const real = this.g.files?.resolve(file) ?? (fs.existsSync(file) ? file : null);
    if (!real) { this.g.lastError = 2; return 0; }
    try {
      const family = path.basename(real, path.extname(real));
      const key = GlobalFonts.registerFromPath(real);
      const reg = (GlobalFonts.families.find((f) => f.styles?.some((s) => s.path === real))?.family) ?? family;
      void key;
      state.custom.set(reg.toLowerCase(), reg);
      state.custom.set(family.toLowerCase(), reg);
      return 1;
    } catch (e) { this.g.lastError = 87; return 0; }
  };
  def('AddFontResourceA', 1, function (p) { return addFont.call(this, this.g.readStr(p)); });
  def('AddFontResourceW', 1, function (p) { return addFont.call(this, wstr(this.g, p)); });
  def('AddFontResourceExA', 3, function (p) { return addFont.call(this, this.g.readStr(p)); });
  def('AddFontResourceExW', 3, function (p) { return addFont.call(this, wstr(this.g, p)); });
  def('RemoveFontResourceA', 1, () => 1);
  def('RemoveFontResourceW', 1, () => 1);
  def('RemoveFontResourceExA', 3, () => 1);
  def('RemoveFontResourceExW', 3, () => 1);

  // Families GDI would list for a request: the substitutes this host can draw with.
  def('EnumFontFamiliesExA', 5, function (dcH, lfp, cb, lparam) {
    const g = this.g, wanted = lfp ? g.readStr(lfp + 28) : '';
    const names = wanted ? (resolveFamily(wanted) ? [wanted] : []) : GlobalFonts.families.map((f) => f.family);
    let last = 1;
    for (const name of names) {
      const elf = g.alloc(60 + 64 + 32 + 32 + 64), ntm = g.alloc(256);
      try {
        g.u8.fill(0, elf, elf + 188); g.u8.fill(0, ntm, ntm + 256);
        g.u32(elf, 0xfffffff4); g.u32(elf + 16, 400); g.u8[elf + 23] = lfp ? g.u8[lfp + 23] : 1;
        writeAnsi(g, elf + 28, name, 32); writeAnsi(g, elf + 60, name, 64); writeAnsi(g, elf + 124, 'Regular', 32);
        last = g.call(this.dll, cb, [elf, ntm, 4 /* TRUETYPE_FONTTYPE */, lparam], { cdecl: false });
      } finally { g.free(elf); g.free(ntm); }
      if (!last) break;
    }
    return last;
  });
  def('EnumFontFamiliesExW', 5, function () { return 1; });
  def('GetFontUnicodeRanges', 2, function (dcH, p) {
    const size = 16 + 4;   // GLYPHSET header + one WCRANGE
    if (!p) return size;
    const g = this.g; g.u32(p, size); g.u32(p + 4, 0); g.u32(p + 8, 0xffe0); g.u32(p + 12, 1);
    g.dv.setUint16(p + 16, 0x20, true); g.dv.setUint16(p + 18, 0xffe0, true);
    return size;
  });

  // Device contexts

  def('CreateCompatibleDC', 1, function () { return newObj({ type: OBJ.DC, font: null, bitmap: null, fg: 0, bg: 0xffffff, bkMode: OPAQUE, align: 0 }); });
  def('DeleteDC', 1, (h) => (state.objs.delete(h >>> 0) ? 1 : 0));
  def('SaveDC', 1, () => 1);
  def('RestoreDC', 2, () => 1);
  defUser('GetDC', 1, () => screenDc);
  defUser('GetWindowDC', 1, () => screenDc);
  defUser('ReleaseDC', 2, () => 1);
  def('SelectObject', 2, (dcH, objH) => {
    const dc = get(dcH, OBJ.DC), o = get(objH);
    if (!dc || !o) return 0;
    const slot = o.type === OBJ.FONT ? 'font' : o.type === OBJ.BITMAP ? 'bitmap' : o.type === OBJ.BRUSH ? 'brush' : o.type === OBJ.PEN ? 'pen' : null;
    if (!slot) return 1;
    const prev = dc[slot]; dc[slot] = o;
    for (const [h, v] of state.objs) if (v === prev) return h;
    return 0;
  });
  def('DeleteObject', 1, (h) => { const o = get(h); if (!o || (stock.size && [...stock.values()].includes(h >>> 0))) return o ? 1 : 0; state.objs.delete(h >>> 0); return 1; });
  def('GetStockObject', 1, (n) => stockObject(n));
  def('SetBkMode', 2, (h, m) => { const dc = get(h, OBJ.DC); if (!dc) return 0; const p = dc.bkMode; dc.bkMode = m; return p; });
  def('SetBkColor', 2, (h, c) => { const dc = get(h, OBJ.DC); if (!dc) return 0xffffffff; const p = dc.bg; dc.bg = c & 0xffffff; return p; });
  def('SetTextColor', 2, (h, c) => { const dc = get(h, OBJ.DC); if (!dc) return 0xffffffff; const p = dc.fg; dc.fg = c & 0xffffff; return p; });
  def('GetBkColor', 1, (h) => get(h, OBJ.DC)?.bg ?? 0xffffffff);
  def('GetTextColor', 1, (h) => get(h, OBJ.DC)?.fg ?? 0xffffffff);
  def('SetTextAlign', 2, (h, a) => { const dc = get(h, OBJ.DC); if (!dc) return 0xffffffff; const p = dc.align; dc.align = a; return p; });
  def('SetROP2', 2, () => 13);
  def('SetMapMode', 2, () => 1);
  def('SetViewportOrgEx', 4, () => 1);
  def('GetDeviceCaps', 2, (h, i) => ({ 8: 1280, 10: 720, 12: 32, 14: 1, 24: 0xffffffff, 88: 96, 90: 96, 108: 32 }[i] ?? 0));

  // Text metrics and measurement

  const textMetrics = function (wide) {
    return function (dcH, p) {
      const dc = get(dcH, OBJ.DC), g = this.g;
      if (!dc?.font || !p) return 0;
      const f = dc.font, info = fontInfo(f);
      const size = wide ? 60 : 56;
      g.u8.fill(0, p, p + size);
      g.u32(p, info.cell); g.u32(p + 4, info.ascent); g.u32(p + 8, info.descent); g.u32(p + 12, Math.max(0, info.cell - Math.round(info.em)));
      g.u32(p + 16, 0); g.u32(p + 20, info.avgWidth); g.u32(p + 24, info.maxWidth); g.u32(p + 28, f.lf.weight); g.u32(p + 32, 0);
      g.u32(p + 36, 96); g.u32(p + 40, 96);
      const tail = p + 44;
      if (wide) { g.dv.setUint16(tail, 0x20, true); g.dv.setUint16(tail + 2, 0xffff, true); g.dv.setUint16(tail + 4, 0x3f, true); g.dv.setUint16(tail + 6, 0x20, true); }
      else { g.u8[tail] = 0x20; g.u8[tail + 1] = 0xff; g.u8[tail + 2] = 0x3f; g.u8[tail + 3] = 0x20; }
      const flags = tail + (wide ? 8 : 4);
      g.u8[flags] = f.lf.italic ? 1 : 0; g.u8[flags + 1] = f.lf.underline ? 1 : 0; g.u8[flags + 2] = f.lf.strike ? 1 : 0;
      g.u8[flags + 3] = 0x36;   // TMPF_VECTOR | TMPF_TRUETYPE | TMPF_DEVICE
      g.u8[flags + 4] = f.lf.charset;
      return 1;
    };
  };
  def('GetTextMetricsA', 2, textMetrics(false));
  def('GetTextMetricsW', 2, textMetrics(true));
  const extent = (wide) => function (dcH, s, n, out) {
    const dc = get(dcH, OBJ.DC);
    if (!dc?.font || !out) return 0;
    this.g.u32(out, advance(dc.font, readText(this.g, s, n, wide))); this.g.u32(out + 4, fontInfo(dc.font).cell);
    return 1;
  };
  def('GetTextExtentPoint32A', 4, extent(false));
  def('GetTextExtentPoint32W', 4, extent(true));

  // ABC widths: A = left bearing, B = ink width, C = right bearing, all rounded like hinted GDI output.
  const abcOf = (font, ch) => {
    const m = measure(font, ch), adv = Math.round(m.width);
    if (ch === ' ' || m.actualBoundingBoxRight === 0 && m.actualBoundingBoxLeft === 0) return { a: 0, b: adv, c: 0 };
    const a = Math.floor(-m.actualBoundingBoxLeft), b = Math.max(1, Math.ceil(m.actualBoundingBoxRight) - a);
    return { a, b, c: adv - a - b };
  };
  const abc = (wide) => function (dcH, first, last, out) {
    const dc = get(dcH, OBJ.DC), g = this.g;
    if (!dc?.font || !out) return 0;
    for (let c = first; c <= last; c++) {
      const r = abcOf(dc.font, String.fromCharCode(c)), o = out + (c - first) * 12;
      g.u32(o, r.a); g.u32(o + 4, r.b); g.u32(o + 8, r.c);
    }
    void wide;
    return 1;
  };
  def('GetCharABCWidthsA', 4, abc(false));
  def('GetCharABCWidthsW', 4, abc(true));
  def('GetCharWidth32A', 4, function (dcH, first, last, out) {
    const dc = get(dcH, OBJ.DC); if (!dc?.font || !out) return 0;
    for (let c = first; c <= last; c++) this.g.u32(out + (c - first) * 4, advance(dc.font, String.fromCharCode(c)));
    return 1;
  });
  def('GetCharWidth32W', 4, SHIMS['gdi32.dll!GetCharWidth32A'].fn);

  // GetGlyphOutline: metrics and 8-bit coverage bitmaps (GGO_GRAY8_BITMAP uses 65 levels, as GDI does).
  const glyphOutline = () => function (dcH, ch, format, gm, size, buf) {
    const dc = get(dcH, OBJ.DC), g = this.g;
    if (!dc?.font) return -1;
    const font = dc.font, info = fontInfo(font), text = String.fromCharCode(ch);
    const m = measure(font, text), adv = Math.round(m.width);
    const l = Math.floor(-m.actualBoundingBoxLeft), r = Math.ceil(m.actualBoundingBoxRight);
    const top = Math.ceil(m.actualBoundingBoxAscent), bottom = Math.ceil(m.actualBoundingBoxDescent);
    const w = Math.max(0, r - l), h = Math.max(0, top + bottom);
    if (ENV.GUEST_DEBUG_FONT && ch === 95 && !font.tracedOutline) {
      font.tracedOutline = true;
      console.log('[gdi-outline-underscore]', JSON.stringify({ lf: font.lf, info, l, r, top, bottom, w, h }));
    }
    if (gm) { g.u32(gm, w); g.u32(gm + 4, h); g.u32(gm + 8, l); g.u32(gm + 12, top); g.dv.setInt16(gm + 16, adv, true); g.dv.setInt16(gm + 18, 0, true); }
    const kind = format & 0xff;
    if (kind === 0) return 1;
    if (kind !== 6 && kind !== 1) return -1;
    const stride = kind === 6 ? (w + 3) & ~3 : ((w + 31) >> 5) << 2, need = stride * h;
    if (!size) return need;
    if (!buf || size < need) return -1;
    const cv = createCanvas(Math.max(1, w), Math.max(1, h)), cx = cv.getContext('2d');
    cx.font = info.css; cx.fillStyle = '#fff'; cx.textBaseline = 'alphabetic';
    cx.fillText(text, -l, top);
    const px = cx.getImageData(0, 0, Math.max(1, w), Math.max(1, h)).data;
    g.u8.fill(0, buf, buf + need);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = px[(y * w + x) * 4 + 3];
      if (kind === 6) g.u8[buf + y * stride + x] = Math.round(a * 64 / 255);
      else if (a > 127) g.u8[buf + y * stride + (x >> 3)] |= 0x80 >> (x & 7);
    }
    return need;
  };
  def('GetGlyphOutlineA', 7, glyphOutline());
  def('GetGlyphOutlineW', 7, glyphOutline());

  // Text output

  const rectAt = (g, p) => (p ? { l: g.i32(p), t: g.i32(p + 4), r: g.i32(p + 8), b: g.i32(p + 12) } : null);
  def('TextOutA', 5, function (dcH, x, y, s, n) { const dc = get(dcH, OBJ.DC); return dc ? drawText(this.g, dc, x | 0, y | 0, readText(this.g, s, n, false), 0, null) : 0; });
  def('TextOutW', 5, function (dcH, x, y, s, n) { const dc = get(dcH, OBJ.DC); return dc ? drawText(this.g, dc, x | 0, y | 0, readText(this.g, s, n, true), 0, null) : 0; });
  def('ExtTextOutA', 8, function (dcH, x, y, opt, rc, s, n) { const dc = get(dcH, OBJ.DC); return dc ? drawText(this.g, dc, x | 0, y | 0, readText(this.g, s, n, false), opt, rectAt(this.g, rc)) : 0; });
  def('ExtTextOutW', 8, function (dcH, x, y, opt, rc, s, n) { const dc = get(dcH, OBJ.DC); return dc ? drawText(this.g, dc, x | 0, y | 0, readText(this.g, s, n, true), opt, rectAt(this.g, rc)) : 0; });

  // Bitmaps

  const makeBitmap = (g, w, h, bpp, bottomUp, bitsPtr) => {
    const stride = ((w * bpp + 31) >> 5) << 2;
    const bits = bitsPtr ?? g.alloc(Math.max(16, stride * h));
    return { type: OBJ.BITMAP, g, w, h, bpp, bottomUp, stride, bits };
  };
  def('CreateDIBSection', 6, function (dcH, bmi, usage, outBits) {
    const g = this.g;
    const size = g.u32(bmi), w = g.i32(bmi + 4), hRaw = g.i32(bmi + 8), bpp = g.dv.getUint16(bmi + 14, true);
    if (size < 40 || !w || !hRaw || ![8, 16, 24, 32].includes(bpp)) { g.lastError = 87; return 0; }
    const b = makeBitmap(g, w, Math.abs(hRaw), bpp, hRaw > 0);
    if (outBits) g.u32(outBits, b.bits);
    return newObj(b);
  });
  def('CreateCompatibleBitmap', 3, function (dcH, w, h) { return newObj(makeBitmap(this.g, w, h, 32, true)); });
  def('CreateBitmap', 5, function (w, h, planes, bpp, bits) {
    const b = makeBitmap(this.g, w, h, bpp === 1 ? 8 : bpp || 32, true);
    if (bits && b.bpp === bpp) this.g.u8.copyWithin(b.bits, bits, bits + b.stride * h);
    return newObj(b);
  });
  def('GetObjectA', 3, function (h, n, p) {
    const o = get(h), g = this.g;
    if (!o || !p) return 0;
    if (o.type === OBJ.BITMAP) {
      if (n < 24) return 0;
      g.u32(p, 0); g.u32(p + 4, o.w); g.u32(p + 8, o.h); g.u32(p + 12, o.stride);
      g.dv.setUint16(p + 16, 1, true); g.dv.setUint16(p + 18, o.bpp, true); g.u32(p + 20, o.bits);
      return 24;
    }
    if (o.type === OBJ.FONT) {
      if (n < 60) return 0;
      g.u8.fill(0, p, p + 60);
      g.u32(p, o.lf.height >>> 0); g.u32(p + 16, o.lf.weight); g.u8[p + 20] = o.lf.italic; g.u8[p + 21] = o.lf.underline; g.u8[p + 22] = o.lf.strike; g.u8[p + 23] = o.lf.charset;
      writeAnsi(g, p + 28, o.lf.face, 32);
      return 60;
    }
    return 0;
  });
  def('GetObjectW', 3, SHIMS['gdi32.dll!GetObjectA'].fn);
  def('GetDIBits', 7, function (dcH, bmpH, start, lines, buf, bmi, usage) {
    const g = this.g, b = get(bmpH, OBJ.BITMAP);
    if (!b || !bmi) return 0;
    if (!buf) {   // fill the header only
      g.u32(bmi, 40); g.u32(bmi + 4, b.w); g.u32(bmi + 8, b.bottomUp ? b.h : -b.h >>> 0); g.dv.setUint16(bmi + 12, 1, true); g.dv.setUint16(bmi + 14, b.bpp, true);
      g.u32(bmi + 16, 0); g.u32(bmi + 20, b.stride * b.h);
      return 1;
    }
    const wantBpp = g.dv.getUint16(bmi + 14, true) || b.bpp, hdr = g.i32(bmi + 8), bottomUp = hdr > 0;
    if (wantBpp !== b.bpp) { g.lastError = 87; return 0; }
    for (let r = 0; r < lines; r++) {
      const y = start + r;
      if (y >= b.h) break;
      const srcRow = rowAddr(b, y), dstRow = bottomUp ? b.h - 1 - r : r;
      g.u8.copyWithin(buf + dstRow * b.stride, srcRow, srcRow + b.stride);
    }
    return lines;
  });
  def('BitBlt', 9, function (dstH, dx, dy, w, h, srcH, sx, sy, rop) {
    const dst = get(dstH, OBJ.DC)?.bitmap, src = get(srcH, OBJ.DC)?.bitmap;
    if (!dst) return 0;
    if (rop === 0x00000042 || rop === 0x00ff0062) { fillRect(dst, dx, dy, dx + w, dy + h, rop === 0x42 ? 0 : 0xffffff); return 1; }   // BLACKNESS / WHITENESS
    if (!src || (rop !== 0x00cc0020 && rop !== 0x00330008)) return rop === 0x00f00021 ? 1 : 0;
    const invert = rop === 0x00330008;
    for (let y = 0; y < h; y++) {
      if (dy + y < 0 || dy + y >= dst.h || sy + y < 0 || sy + y >= src.h) continue;
      for (let x = 0; x < w; x++) {
        if (dx + x < 0 || dx + x >= dst.w || sx + x < 0 || sx + x >= src.w) continue;
        const s = rowAddr(src, sy + y) + (sx + x) * (src.bpp >> 3), d = rowAddr(dst, dy + y) + (dx + x) * (dst.bpp >> 3);
        for (let k = 0; k < Math.min(dst.bpp, src.bpp) >> 3; k++) dst.g.u8[d + k] = invert ? 255 - src.g.u8[s + k] : src.g.u8[s + k];
      }
    }
    return 1;
  });
  def('StretchBlt', 11, function (dstH, dx, dy, dw, dh, srcH, sx, sy, sw, sh, rop) {
    const dst = get(dstH, OBJ.DC)?.bitmap, src = get(srcH, OBJ.DC)?.bitmap;
    if (!dst || !src || rop !== 0x00cc0020 || !dw || !dh) return 0;
    for (let y = 0; y < Math.abs(dh); y++) for (let x = 0; x < Math.abs(dw); x++) {
      const px = dx + x, py = dy + y, qx = sx + Math.floor(x * sw / Math.abs(dw)), qy = sy + Math.floor(y * sh / Math.abs(dh));
      if (px < 0 || py < 0 || px >= dst.w || py >= dst.h || qx < 0 || qy < 0 || qx >= src.w || qy >= src.h) continue;
      const s = rowAddr(src, qy) + qx * (src.bpp >> 3), d = rowAddr(dst, py) + px * (dst.bpp >> 3);
      for (let k = 0; k < Math.min(dst.bpp, src.bpp) >> 3; k++) dst.g.u8[d + k] = src.g.u8[s + k];
    }
    return 1;
  });
  def('PatBlt', 6, function (dcH, x, y, w, h, rop) {
    const dc = get(dcH, OBJ.DC); if (!dc?.bitmap) return 0;
    const color = rop === 0x42 ? 0 : rop === 0xff0062 ? 0xffffff : (dc.brush?.color ?? 0);
    if (rop !== 0x00f00021 && rop !== 0x42 && rop !== 0xff0062) return 0;
    fillRect(dc.bitmap, x, y, x + w, y + h, color); return 1;
  });
  def('FillRect', 3, function (dcH, rc, brushH) {
    const dc = get(dcH, OBJ.DC), br = get(brushH, OBJ.BRUSH), r = rectAt(this.g, rc);
    if (!dc?.bitmap || !r || !br || br.color === null) return br ? 1 : 0;
    fillRect(dc.bitmap, r.l, r.t, r.r, r.b, br.color); return 1;
  });
  SHIMS['user32.dll!FillRect'] = SHIMS['gdi32.dll!FillRect'];
  def('Rectangle', 5, function (dcH, l, t, r, b) {
    const dc = get(dcH, OBJ.DC); if (!dc?.bitmap) return 0;
    if (dc.brush && dc.brush.color !== null) fillRect(dc.bitmap, l, t, r, b, dc.brush.color);
    if (dc.pen && dc.pen.color !== null) { const c = dc.pen.color; fillRect(dc.bitmap, l, t, r, t + 1, c); fillRect(dc.bitmap, l, b - 1, r, b, c); fillRect(dc.bitmap, l, t, l + 1, b, c); fillRect(dc.bitmap, r - 1, t, r, b, c); }
    return 1;
  });
  def('CreateSolidBrush', 1, (c) => newObj({ type: OBJ.BRUSH, color: c & 0xffffff }));
  def('CreatePen', 3, (style, w, c) => newObj({ type: OBJ.PEN, color: style === 5 ? null : c & 0xffffff, width: w }));
  def('CreateRectRgn', 4, () => newObj({ type: OBJ.REGION }));
  def('SetRectRgn', 5, () => 1);
  def('SelectClipRgn', 2, () => 2);
  def('GetClipBox', 2, function (dcH, rc) { const b = get(dcH, OBJ.DC)?.bitmap; if (!b || !rc) return 0; this.g.u32(rc, 0); this.g.u32(rc + 4, 0); this.g.u32(rc + 8, b.w); this.g.u32(rc + 12, b.h); return 2; });
  // Line drawing is only used by the software vgui surface, which the D3D path never selects.
  for (const [n, a] of [['MoveToEx', 4], ['Polyline', 3], ['Polygon', 3]]) def(n, a, () => 1);
}

export const GDI_LIMITS = [
  'gdi32.dll!MoveToEx/Polyline/Polygon: accepted without drawing (software vgui surface only)',
  'gdi32.dll!EnumFontFamiliesExW: reports success without enumerating',
  'GDI object handles are per guest thread',
];
