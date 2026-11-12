// Retail filesystem DLL/worker smoke test. Does not claim VPK mounting or maps.
import assert from 'node:assert/strict';
import { Guest } from './guest.mjs';

const g = new Guest({ sharedMemory: true });
const prefixes = process.argv.slice(2);
for (const p of prefixes.length ? prefixes : ['out/tier0-thread', 'out/vstdlib-thread', 'out/steam-thread', 'out/lua-thread', 'out/filesystem-thread'])
  await g.load(p);
try {
  for (const d of g.dlls.values()) { g.initialize(d); console.log(`PASS ${d.name} DllMain`); }
  const fs = g.dlls.get('filesystem_stdio.dll');
  assert.ok(fs?.meta.exports.CreateInterface);
  const status = g.alloc(4);
  const object = g.call(fs, fs.meta.exports.CreateInterface, [g.cstr('VFileSystem022'), status]);
  assert.equal(g.u32(status), 0);
  assert.ok(object);
  const vtable = g.u32(object);
  assert.ok(vtable >= fs.meta.base && vtable < fs.meta.base + fs.meta.size);
  console.log(`PASS VFileSystem022 object=0x${object.toString(16)} vtable=0x${vtable.toString(16)}`);
  const threads = [...g.handles.values()].filter(x => x.type === 'thread');
  assert.ok(threads.length);
  for (const t of threads) {
    const state = new Int32Array(g.mem.buffer, t.control + 4, 1);
    if (!Atomics.load(state, 0)) Atomics.wait(state, 0, 0, 2000);
    const value = Atomics.load(state, 0);
    if (value === 2) throw new Error(`filesystem worker failed: ${g.readStr(t.control + 16, 495)}`);
    assert.equal(value, 0, 'filesystem worker should still be running');
  }
  console.log('PASS filesystem guest worker remained alive for 2 seconds');
} finally {
  const workers = new Set([...g.handles.values()].filter(x => x.type === 'thread').map(x => x.worker));
  await Promise.all([...workers].map(w => w.terminate()));
}
