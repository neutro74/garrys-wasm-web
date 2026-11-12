// Drive the retail IFileSystem app-system lifecycle with a real interface factory.
import fs from 'node:fs';
import { Guest } from './guest.mjs';

const root = process.argv[2];
if (!root) throw new Error('usage: node host/filesystem-init.mjs GMOD_ROOT');
const g = new Guest({ sharedMemory: true, filesRoot: root, log: s => console.log(`[guest] ${s.trimEnd()}`) });
try {
  for (const n of ['tier0', 'vstdlib', 'steam', 'lua', 'input', 'filesystem'])
    if (fs.existsSync(`out/${n}-thread.json`)) await g.load(`out/${n}-thread`);
  for (const d of g.dlls.values()) {
    g.initialize(d);
    console.log(`PASS ${d.name} DllMain`);
  }
  const fsystem = g.dlls.get('filesystem_stdio.dll');
  const status = g.alloc(4);
  const object = g.call(fsystem, fsystem.meta.exports.CreateInterface, [g.cstr('VFileSystem022'), status]);
  if (!object || g.u32(status)) throw new Error('VFileSystem022 was not created');
  console.log(`VFileSystem022 object=0x${object.toString(16)}`);

  const { SHIMS } = await import('./guest.mjs');
  const shim = SHIMS['host!CreateInterfaceFn'];
  const factory = g.extraThunk(fsystem, 'host!CreateInterfaceFn', shim.fn, shim.pop, shim.cdecl, shim.arity);

  const vt = g.u32(object);
  const connect = g.u32(vt), init = g.u32(vt + 12);
  console.log(`Connect=0x${connect.toString(16)} Init=0x${init.toString(16)} factory=0x${factory.toString(16)}`);
  const connected = g.call(fsystem, connect, [factory], { thiscall: object });
  console.log(`Connect -> ${connected}`);
  if (!connected) throw new Error('IFileSystem::Connect failed');
  const result = g.call(fsystem, init, [], { thiscall: object });
  console.log(`Init -> ${result}${result === 1 ? ' (INIT_OK)' : ''}`);
  for (const t of new Set([...g.handles.values()].filter(x => x.type === 'thread'))) {
    const st = new Int32Array(g.mem.buffer, t.control + 4, 1);
    if (!Atomics.load(st, 0)) Atomics.wait(st, 0, 0, 1000);
    console.log(`  guest thread ${g.u32(t.control + 8)} state=${Atomics.load(st, 0)} exit=${g.u32(t.control + 12)} ` +
      `error=${JSON.stringify(g.readStr(t.control + 16, 200))}`);
  }
  const query = g.u32(vt + 8);
  for (const name of ['VBaseFileSystem011']) {
    const p = g.call(fsystem, query, [g.cstr(name)], { thiscall: object });
    console.log(`QueryInterface(${name}) -> 0x${p.toString(16)}`);
  }
  const base = g.u32(object + 4);
  const read = g.u32(base), open = g.u32(base + 8), size = g.u32(base + 24);
  const tell = g.u32(base + 20), seek = g.u32(base + 16);
  const file = g.cstr('garrysmod/maps/gm_construct.bsp'), options = g.cstr('rb');
  const handle = g.call(fsystem, open, [file, options, 0], { thiscall: object + 4 });
  console.log(`Open(gm_construct.bsp) -> 0x${handle.toString(16)}`);
  // MSVC emits virtual overloads in reverse declaration order, so the
  // Size(FileHandle_t) overload sits after Size(const char*, const char*).
  const sizeHandle = g.u32(base + 28), sizeByName = g.u32(base + 24);
  const fileSize = g.call(fsystem, sizeHandle, [handle], { thiscall: object + 4 });
  console.log(`Size(handle) -> ${fileSize} (slot6 gives ${g.call(fsystem, sizeByName, [handle], { thiscall: object + 4 })})`);
  g.call(fsystem, seek, [handle, 0, 0], { thiscall: object + 4 });
  const buf = g.alloc(64);
  const n = g.call(fsystem, read, [buf, 16, handle], { thiscall: object + 4 });
  const bytes = Buffer.from(g.u8.subarray(buf, buf + n));
  console.log(`Read -> ${n} bytes: ${bytes.toString('hex')} "${bytes.subarray(0, 4).toString('latin1')}"`);
  const native = fs.openSync(`${root}/garrysmod/maps/gm_construct.bsp`, 'r');
  const want = Buffer.alloc(16); fs.readSync(native, want, 0, 16, 0); fs.closeSync(native);
  console.log(`Expected: ${want.toString('hex')} "${want.subarray(0, 4).toString('latin1')}"`);
  if (n !== 16 || !bytes.equals(want)) throw new Error('filesystem did not read the real BSP header');
  console.log(`Tell after read -> ${g.call(fsystem, tell, [handle], { thiscall: object + 4 })}`);
  console.log('PASS retail IFileSystem served gm_construct.bsp bytes');
} finally {
  const workers = new Set([...g.handles.values()].filter(x => x.type === 'thread').map(x => x.worker));
  await Promise.all([...workers].map(w => w.terminate()));
}

// Guest workers keep the Node event loop alive; the probe is complete here.
process.exit(0);
