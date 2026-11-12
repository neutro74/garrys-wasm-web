import fs from 'node:fs';
import { Guest, SHIMS } from './guest.mjs';

const g = new Guest({ sharedMemory: true, filesRoot: process.argv[2], log: s => console.log(`[guest] ${s.trimEnd()}`) });
for (const n of ['tier0', 'vstdlib', 'steam', 'lua', 'filesystem'])
  if (fs.existsSync(`out/${n}-thread.json`)) await g.load(`out/${n}-thread`);
for (const d of g.dlls.values()) g.initialize(d);
const f = g.dlls.get('filesystem_stdio.dll');
const object = g.call(f, f.meta.exports.CreateInterface, [g.cstr('VFileSystem022'), g.alloc(4)]);
const shim = SHIMS['host!CreateInterfaceFn'];
const factory = g.extraThunk(f, 'host!CreateInterfaceFn', shim.fn, shim.pop, shim.cdecl, shim.arity);
const vt = g.u32(object);
console.log('Connect', g.call(f, g.u32(vt), [factory], { thiscall: object }) & 0xff);
console.log('Init', g.call(f, g.u32(vt + 12), [], { thiscall: object }));
for (const [path, id, kind] of [['garrysmod', 'GAME', 0], ['garrysmod', 'GAME', 1], ['garrysmod', 'MOD', 0]]) {
  const add = g.u32(vt + 28);
  console.log(`AddSearchPath(${path},${id},${kind}) -> begin`);
  g.call(f, add, [g.cstr(path), g.cstr(id), kind], { thiscall: object });
  console.log('  done');
}
const workers = new Set([...g.handles.values()].filter(x => x.type === 'thread').map(x => x.worker));
await Promise.all([...workers].map(w => w.terminate()));
