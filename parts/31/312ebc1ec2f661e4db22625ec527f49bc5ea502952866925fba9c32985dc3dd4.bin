import assert from 'node:assert/strict';
import { Guest, SHIMS } from './guest.mjs';

const g = new Guest({});
const call = (dll, name, ...a) => SHIMS[`${dll}.dll!${name}`].fn.call({ g }, ...a);
const wide = (s) => { const p = g.alloc(2 * (s.length + 1)); for (let i = 0; i < s.length; i++) g.dv.setUint16(p + 2 * i, s.charCodeAt(i), true); return p; };
const readWide = (p) => { let s = ''; for (let i = 0; g.dv.getUint16(p + 2 * i, true); i++) s += String.fromCharCode(g.dv.getUint16(p + 2 * i, true)); return s; };

// string compare / case mapping / character types
assert.equal(call('kernel32', 'CompareStringW', 0, 0, wide('abc'), -1, wide('abd'), -1), 1);
assert.equal(call('kernel32', 'CompareStringW', 0, 0, wide('abc'), -1, wide('ABC'), -1), 1);   // case-sensitive: 'abc' sorts before 'ABC' under NLS
assert.equal(call('kernel32', 'CompareStringW', 0, 1, wide('abc'), -1, wide('ABC'), -1), 2);
const out = g.alloc(64);
assert.equal(call('kernel32', 'LCMapStringW', 0, 0x100, wide('HeLLo'), -1, out, 16), 6);
assert.equal(readWide(out), 'hello');
const types = g.alloc(16);
assert.equal(call('kernel32', 'GetStringTypeW', 1, wide('aZ5 '), 4, types), 1);
assert.deepEqual([0, 1, 2, 3].map(i => g.dv.getUint16(types + 2 * i, true)), [2 | 0x100 | 0x80, 1 | 0x100, 4 | 0x80, 8 | 0x40]);

// FormatMessage
const buf = g.alloc(256);
assert.equal(call('kernel32', 'FormatMessageA', 0x1000, 0, 2, 0, buf, 256, 0), 44);
assert.equal(g.readStr(buf), 'The system cannot find the file specified.\r\n');
assert.equal(call('kernel32', 'FormatMessageA', 0x1000, 0, 0xdead, 0, buf, 256, 0), 0);
assert.equal(g.lastError, 317);

// version checks: host is Windows 10.0.19045
const info = g.alloc(284); g.u8.fill(0, info, info + 284); g.u32(info, 284);
let mask = 0n;
const setMask = (type, cond) => { mask = call('kernel32', 'VerSetConditionMask', Number(mask & 0xffffffffn), Number(mask >> 32n), type, cond); };
const check = (type) => call('kernel32', 'VerifyVersionInfoW', info, type, Number(mask & 0xffffffffn), Number(mask >> 32n));
g.u32(info + 4, 6); g.u32(info + 8, 1); setMask(2, 3); setMask(1, 3);
assert.equal(check(3), 1);                                 // >= 6.1
g.u32(info + 4, 10); g.u32(info + 8, 1); mask = 0n; setMask(2, 3); setMask(1, 3);
assert.equal(check(3), 0);                                 // >= 10.1: minor 0 < 1
g.u32(info + 4, 10); g.u32(info + 8, 0); mask = 0n; setMask(2, 3); setMask(1, 3);
assert.equal(check(3), 1);                                 // >= 10.0
g.u32(info + 4, 11); mask = 0n; setMask(2, 3); setMask(1, 3);
assert.equal(check(3), 0);

// CryptoAPI hashing
const prov = g.alloc(4), hash = g.alloc(4), len = g.alloc(4), digest = g.alloc(32), data = g.alloc(8);
assert.equal(call('advapi32', 'CryptAcquireContextA', prov, 0, 0, 1, 0xf0000000), 1);
assert.equal(call('advapi32', 'CryptCreateHash', g.u32(prov), 0x8003, 0, 0, hash), 1);
g.u8.set(Buffer.from('abc'), data);
assert.equal(call('advapi32', 'CryptHashData', g.u32(hash), data, 3, 0), 1);
g.u32(len, 32);
assert.equal(call('advapi32', 'CryptGetHashParam', g.u32(hash), 2, digest, len, 0), 1);
assert.equal(Buffer.from(g.u8.subarray(digest, digest + g.u32(len))).toString('hex'), '900150983cd24fb0d6963f7d28e17f72');
assert.equal(call('advapi32', 'CryptGenRandom', g.u32(prov), 16, digest), 1);
console.log('win32-extra: PASS');
process.exit(0);
