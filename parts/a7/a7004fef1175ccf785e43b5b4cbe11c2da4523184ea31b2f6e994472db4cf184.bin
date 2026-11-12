// Mount the real garrysmod search path/VPKs through the retail filesystem DLL.
import fs from 'node:fs';
import { Guest } from './guest.mjs';
import { Vpk } from '../../lib/vpk.mjs';

const root = process.argv[2];
if (!root) throw new Error('usage: node host/filesystem-mount.mjs GMOD_ROOT');
const g = new Guest({ sharedMemory: true, filesRoot: root, log: s => console.log(`[guest] ${s.trimEnd()}`) });
try {
  for (const n of ['tier0', 'vstdlib', 'steam', 'lua', 'input', 'engine', 'filesystem'])
    if (fs.existsSync(`out/${n}-thread.json`)) await g.load(`out/${n}-thread`);
  for (const d of g.dlls.values()) g.initialize(d);
  const fsystem = g.dlls.get('filesystem_stdio.dll');
  const status = g.alloc(4);
  const object = g.call(fsystem, fsystem.meta.exports.CreateInterface, [g.cstr('VFileSystem022'), status]);
  if (!object || g.u32(status)) throw new Error('VFileSystem022 not created');
  const { SHIMS } = await import('./guest.mjs');
  const shim = SHIMS['host!CreateInterfaceFn'];
  const factory = g.extraThunk(fsystem, 'host!CreateInterfaceFn', shim.fn, shim.pop, shim.cdecl, shim.arity);

  const vt = g.u32(object);
  const connect = g.u32(vt), init = g.u32(vt + 12), addSearchPath = g.u32(vt + 28);
  console.log(`Connect -> ${g.call(fsystem, connect, [factory], { thiscall: object }) & 0xff}`);
  console.log(`Init -> ${g.call(fsystem, init, [], { thiscall: object })}`);
  g.call(fsystem, addSearchPath, [g.cstr('garrysmod'), g.cstr('GAME'), 1], { thiscall: object });
  console.log('AddSearchPath("garrysmod") done');

  const base = g.u32(object + 4);
  const open = g.u32(base + 8), read = g.u32(base), close = g.u32(base + 12);
  const sizeName = g.u32(base + 24), sizeHandle = g.u32(base + 28);
  const exists = g.u32(base + 40);
  const check = ['scripts/game_sounds_manifest.txt', 'materials/console/background01.vtf', 'cfg/mount.cfg'];
  const vpk = new Vpk(`${root}/garrysmod/garrysmod_dir.vpk`);
  for (const name of check) {
    const sz = g.call(fsystem, sizeName, [g.cstr(name), 0], { thiscall: object + 4 });
    const ex = g.call(fsystem, exists, [g.cstr(name), 0], { thiscall: object + 4 });
    const h = g.call(fsystem, open, [g.cstr(name), g.cstr('rb'), 0], { thiscall: object + 4 });
    let bytes = null;
    if (h && h !== 0xffffffff) {
      const want = vpk.has(name) ? vpk.read(name, 32) : fs.existsSync(`${root}/garrysmod/${name}`) ? fs.readFileSync(`${root}/garrysmod/${name}`).subarray(0, 32) : null;
      const hs = g.call(fsystem, sizeHandle, [h], { thiscall: object + 4 });
      const buf = g.alloc(32);
      const n = g.call(fsystem, read, [buf, 32, h], { thiscall: object + 4 });
      bytes = Buffer.from(g.u8.subarray(buf, buf + n));
      console.log(`${name}: exists=${ex} sizeName=${sz} open=0x${h.toString(16)} sizeHandle=${hs} read=${n}`);
      if (want) console.log(`  first bytes ${bytes.toString('hex')} | vpk ${Buffer.from(want).toString('hex')} match=${bytes.equals(Buffer.from(want))}`);
      g.call(fsystem, close, [h], { thiscall: object + 4 });
    } else {
      console.log(`${name}: exists=${ex} sizeName=${sz} open FAILED 0x${h.toString(16)}`);
    }
  }
} finally {
  const workers = new Set([...g.handles.values()].filter(x => x.type === 'thread').map(x => x.worker));
  await Promise.all([...workers].map(w => w.terminate()));
}
