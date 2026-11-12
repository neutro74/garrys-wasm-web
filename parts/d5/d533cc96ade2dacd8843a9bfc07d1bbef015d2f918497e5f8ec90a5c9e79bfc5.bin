import assert from 'node:assert/strict';
import { Guest, SHIMS } from './guest.mjs';

const dir = process.argv[2];
const g = new Guest({ pages: 512 });
const a = await g.load(`${dir}/primary`);
assert.equal(g.u32(a.meta.tls.index), 0);
const tls = g.u32(g.tlsArray);
assert.equal(g.u32(tls), 0x11223344);
assert.equal(g.u32(tls + 4), 0x87654321);
assert.equal(g.u32(tls + 8), 0);
// An unresolved import initially points at its import thunk.
assert.equal(g.u32(a.meta.base + 0x3000), a.meta.thunk_base);
const b = await g.load(`${dir}/secondary`);
assert.equal(g.initialize(a), 1); // TLS callback must run before DllMain
assert.equal(g.u32(tls), 0x11223345);
assert.throws(() => g.initialize(a), /already initialized/);
assert.equal(g.u32(a.meta.base + 0x3000), b.meta.exports.work);
assert.equal(g.u32(b.meta.base + 0x3000), a.meta.exports.back);
a.meta.forwarders = { redirect: 'secondary.work', cycle: 'secondary.cycle' };
b.meta.forwarders = { cycle: 'primary.cycle' };
assert.equal(g.resolveExport(a, 'redirect'), b.meta.exports.work);
assert.throws(() => g.resolveExport(a, 'cycle'), /cyclic DLL export/);
assert.equal(a.ex.eax, b.ex.eax);
assert.equal(a.ex.xmm0, b.ex.xmm0);
// A -> B -> A crosses the module boundary in both directions and shares
// registers, stack, and the real guest return addresses.
assert.equal(g.call(a, a.meta.exports.entry), 121);
assert.equal(a.ex.esp.value >>> 0, 0x00200000 - 0x1000);
assert.throws(() => g.foreignCall(a.meta, 0x77777777), /unknown guest address/);
const context = { g, dll: a };
const load = SHIMS['kernel32.dll!LoadLibraryA'].fn;
const getProc = SHIMS['kernel32.dll!GetProcAddress'].fn;
assert.equal(load.call(context, g.cstr('SECONDARY.DLL')), b.meta.base);
assert.equal(getProc.call(context, a.meta.base, g.cstr('redirect')), b.meta.exports.work);
const kernel = load.call(context, g.cstr('kernel32.dll'));
const proc = getProc.call(context, kernel, g.cstr('GetLastError'));
assert.equal(proc, getProc.call(context, kernel, g.cstr('GetLastError')));
g.lastError = 123;
a.ex.esp.value = 0x1ff000; g.u32(0x1ff000, 0xdead0000);
g.hostcall(a.meta, (proc - a.meta.thunk_base) / 4);
assert.equal(a.ex.eax.value, 123);
assert.equal(a.ex.esp.value >>> 0, 0x1ff004);
await assert.rejects(g.load(`${dir}/primary`), /already loaded/);
console.log('multi-DLL fixture: PASS');
