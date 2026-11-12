import fs from 'node:fs';
import { Guest } from './guest.mjs';

const g = new Guest({ sharedMemory: true, filesRoot: process.argv[2] });
try {
  for (const n of ['tier0', 'vstdlib', 'steam', 'lua', 'input', 'filesystem'])
    if (fs.existsSync(`out/${n}-thread.json`)) await g.load(`out/${n}-thread`);
  for (const d of g.dlls.values()) g.initialize(d);
  const fsystem = g.dlls.get('filesystem_stdio.dll');
  const status = g.alloc(4);
  const object = g.call(fsystem, fsystem.meta.exports.CreateInterface, [g.cstr('VFileSystem022'), status]);
  const vt = g.u32(object);
  console.log('object', object.toString(16), 'vt', vt.toString(16), 'byte+8', g.u8[object + 8]);
  const factory = g.extraThunk(fsystem, 'CreateInterfaceFn', () => 0, 0, true, 2);
  for (let i = 0; i < 5; i++) {
    const fn = g.u32(vt + i * 4);
    try {
      const r = g.call(fsystem, fn, i === 0 ? [factory] : i === 2 ? [g.cstr('VBaseFileSystem011')] : [], { thiscall: object });
      console.log(`slot ${i} fn=0x${fn.toString(16)} -> ${r} (0x${r.toString(16)})`);
    } catch (e) {
      console.log(`slot ${i} fn=0x${fn.toString(16)} THREW ${e.message.split('\n')[0]}`);
    }
  }
} finally {
  const workers = new Set([...g.handles.values()].filter(x => x.type === 'thread').map(x => x.worker));
  await Promise.all([...workers].map(w => w.terminate()));
}
