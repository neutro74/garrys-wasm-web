import { Guest } from './guest.mjs';

const root = process.argv[2];
if (!root) throw new Error('usage: node host/filesystem-inspect.mjs GMOD_ROOT');
const g = new Guest({ sharedMemory: true, filesRoot: root });
try {
  for (const n of ['tier0', 'vstdlib', 'steam', 'lua', 'filesystem']) await g.load(`out/${n}-thread`);
  for (const d of g.dlls.values()) g.initialize(d);
  const d = g.dlls.get('filesystem_stdio.dll');
  for (const name of ['VFileSystem022', 'VBaseFileSystem011']) {
    const status = g.alloc(4);
    const object = g.call(d, d.meta.exports.CreateInterface, [g.cstr(name), status]);
    console.log(name, `object=0x${object.toString(16)}`, `status=${g.u32(status)}`);
    if (!object) continue;
    for (const offset of [0, 4]) {
      const vt = g.u32(object + offset);
      if (vt < d.meta.base || vt >= d.meta.base + d.meta.size) continue;
      console.log(`  subobject+${offset} vtable=0x${vt.toString(16)}`,
        Array.from({ length: 16 }, (_, i) => (g.u32(vt + i * 4) >>> 0).toString(16)).join(' '));
    }
  }
} finally {
  const workers = new Set([...g.handles.values()].filter(x => x.type === 'thread').map(x => x.worker));
  await Promise.all([...workers].map(w => w.terminate()));
}
