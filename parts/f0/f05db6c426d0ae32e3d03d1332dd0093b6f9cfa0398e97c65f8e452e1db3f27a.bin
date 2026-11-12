import assert from 'node:assert/strict';
import { Guest, SHIMS } from './guest.mjs';

const g = new Guest({});
const call = (dll, name, ...a) => SHIMS[`${dll}.dll!${name}`].fn.call({ g }, ...a);
const gdi = (name, ...a) => call('gdi32', name, ...a);
const wide = (s) => { const p = g.alloc(2 * (s.length + 1)); for (let i = 0; i < s.length; i++) g.dv.setUint16(p + 2 * i, s.charCodeAt(i), true); return p; };

const font = gdi('CreateFontA', -20, 0, 0, 0, 700, 0, 0, 0, 1, 0, 0, 4, 0, g.cstr('Tahoma'));
const dc = gdi('CreateCompatibleDC', 0);
const bmi = g.alloc(44); g.u8.fill(0, bmi, bmi + 44);
g.u32(bmi, 40); g.u32(bmi + 4, 32); g.u32(bmi + 8, (-32) >>> 0); g.dv.setUint16(bmi + 12, 1, true); g.dv.setUint16(bmi + 14, 32, true);
const outBits = g.alloc(4);
const dib = gdi('CreateDIBSection', dc, bmi, 0, outBits, 0, 0);
assert.ok(dib && g.u32(outBits));
gdi('SelectObject', dc, dib); gdi('SelectObject', dc, font);

const tm = g.alloc(64);
assert.equal(gdi('GetTextMetricsA', dc, tm), 1);
const height = g.u32(tm), ascent = g.u32(tm + 4), descent = g.u32(tm + 8);
console.log('metrics', { height, ascent, descent, avg: g.u32(tm + 20), weight: g.u32(tm + 28) });
assert.ok(height >= 20 && height <= 30 && ascent + descent === height);

const abc = g.alloc(12);
assert.equal(gdi('GetCharABCWidthsW', dc, 0x57, 0x57, abc), 1);
const a = g.i32(abc), b = g.u32(abc + 4), c = g.i32(abc + 8);
console.log('ABC(W)', a, b, c);
assert.ok(b > 10 && a + b + c > 15);

// vguimatsurface's path: white on black, opaque fill, one character
gdi('SetBkColor', dc, 0); gdi('SetTextColor', dc, 0xffffff); gdi('SetBkMode', dc, 2);
const rc = g.alloc(16); g.u32(rc, 0); g.u32(rc + 4, 0); g.u32(rc + 8, 32); g.u32(rc + 12, 32);
assert.equal(gdi('ExtTextOutW', dc, -a, 0, 2, rc, wide('W'), 1, 0), 1);
const bits = g.u32(outBits);
let lit = 0, max = 0;
for (let i = 0; i < 32 * 32; i++) { const v = g.u8[bits + i * 4 + 1]; if (v) lit++; max = Math.max(max, v); }
console.log('lit pixels', lit, 'max', max);
assert.ok(lit > 40 && max === 255, 'glyph drawn white-on-black');
assert.equal(g.u8[bits + 31 * 4 + 31 * 128 + 1], 0, 'untouched corner stays black');

const size = g.alloc(8);
gdi('GetTextExtentPoint32A', dc, g.cstr('Hello'), 5, size);
assert.ok(g.u32(size) > 30 && g.u32(size + 4) === height);

// Console underscores must survive the cell-height crop used by VGUI.
for (const px of [9, 10, 11, 12, 13, 14, 16, 20]) {
  const small = gdi('CreateFontA', -px, 0, 0, 0, 400, 0, 0, 0, 1, 0, 0, 4, 0, g.cstr('Lucida Console'));
  gdi('SelectObject', dc, small);
  gdi('GetTextMetricsA', dc, tm);
  g.u8.fill(0, bits, bits + 32 * 128);
  gdi('ExtTextOutW', dc, 0, 0, 2, rc, wide('_'), 1, 0);
  assert.ok(g.u8.subarray(bits, bits + g.u32(tm) * 128).some(v => v), `underscore missing at ${px}px`);
  gdi('DeleteObject', small);
}
assert.equal(gdi('DeleteObject', font), 1);
console.log('gdi: PASS');
process.exit(0);
