// Probe the vguimatsurface interface registry directly.
import { Guest } from './guest.mjs';

const root = process.env.HOME + '/.steam/steam/steamapps/common/GarrysMod';
const g = new Guest({ sharedMemory: true, filesRoot: root, log: s => console.log(`[guest] ${s.trimEnd()}`) });
for (const n of ['tier0', 'vstdlib', 'steam', 'lua', 'input', 'matsys', 'shaderdx9', 'stdshader',
  'studiorender', 'datacache', 'vphysics', 'filesystem', 'vgui2', 'vgui-surface', 'gameui']) {
  await g.load(`out/${n}-thread`);
}
for (const d of g.dlls.values()) g.initialize(d);

const surf = g.dlls.get('vguimatsurface.dll');
const base = surf.meta.base;
console.log(`vguimatsurface base=0x${base.toString(16)} exports=`, Object.entries(surf.meta.exports));
const listPtr = base + (0x16e950 - 0x0);
// The retail image was rebased to 0xf000000; 0xf16e950 is base+0x16e950.
console.log(`interface list @0x${(base + 0x16e950).toString(16)} = 0x${g.u32(base + 0x16e950).toString(16)}`);
for (let node = g.u32(base + 0x16e950), i = 0; node && i < 8; node = g.u32(node + 8), i++) {
  const namePtr = g.u32(node + 4);
  console.log(`  node 0x${node.toString(16)} factory=0x${g.u32(node).toString(16)} name=${JSON.stringify(namePtr ? g.readStr(namePtr) : null)}`);
}
for (const name of ['MatSystemSurface008', 'VGUI_Surface030', 'VGUI_MatSystemSurface001']) {
  const st = g.alloc(4);
  const p = g.call(surf, surf.meta.exports.CreateInterface, [g.cstr(name), st]);
  console.log(`CreateInterface(${name}) -> 0x${p.toString(16)} status=${g.u32(st)}`);
}
const workers = new Set([...g.handles.values()].filter(x => x.type === 'thread').map(x => x.worker));
await Promise.all([...workers].map(w => w.terminate()));
