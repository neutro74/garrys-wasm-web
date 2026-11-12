// Verify the retail filesystem mounts the real VPK and serves VPK-only files.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Guest, SHIMS } from './guest.mjs';
import { Vpk } from '../../lib/vpk.mjs';

const root = process.argv[2];
if (!root) throw new Error('usage: node host/filesystem-vpk-test.mjs GMOD_ROOT');
const g = new Guest({ sharedMemory: true, filesRoot: root, log: s => console.log(`[guest] ${s.trimEnd()}`) });
try {
  for (const n of ['tier0', 'vstdlib', 'steam', 'lua', 'filesystem'])
    await g.load(`out/${n}-thread`);
  for (const d of g.dlls.values()) g.initialize(d);
  const fsystem = g.dlls.get('filesystem_stdio.dll');
  const status = g.alloc(4);
  const object = g.call(fsystem, fsystem.meta.exports.CreateInterface, [g.cstr('VFileSystem022'), status]);
  assert.ok(object && !g.u32(status), 'VFileSystem022');
  const shim = SHIMS['host!CreateInterfaceFn'];
  const factory = g.extraThunk(fsystem, 'host!CreateInterfaceFn', shim.fn, shim.pop, shim.cdecl, shim.arity);
  const vt = g.u32(object);
  assert.equal(g.call(fsystem, g.u32(vt), [factory], { thiscall: object }) & 0xff, 1, 'Connect');
  assert.equal(g.call(fsystem, g.u32(vt + 12), [], { thiscall: object }), 1, 'Init');
  // VFileSystem022::AddSearchPath is slot 7 (IAppSystem 0..4, IsSteam 5, MountSteamContent 6).
  const add = g.u32(vt + 28);
  for (const [path, id] of [['garrysmod', 'GAME'], ['garrysmod', 'MOD']]) {
    g.call(fsystem, add, [g.cstr(path), g.cstr(id), 0], { thiscall: object });
  }
  console.log('PASS AddSearchPath returned for GAME and MOD');

  const base = g.u32(object + 4);
  const read = g.u32(base), open = g.u32(base + 8), close = g.u32(base + 12);
  const seek = g.u32(base + 16), tell = g.u32(base + 20);
  const sizeHandle = g.u32(base + 28), sizeName = g.u32(base + 24);
  const exists = g.u32(base + 40);
  const vpk = new Vpk(`${root}/garrysmod/garrysmod_dir.vpk`);
  for (const name of ['scripts/game_sounds_manifest.txt', 'materials/console/background01.vtf', 'scripts/kb_act.lst']) {
    assert.ok(vpk.has(name), `${name} should be in the VPK`);
    const want = vpk.read(name);
    assert.equal(fs.existsSync(`${root}/garrysmod/${name}`), false, `${name} must be VPK-only`);
    const fexists = g.call(fsystem, exists, [g.cstr(name), 0], { thiscall: object + 4 });
    const byName = g.call(fsystem, sizeName, [g.cstr(name), 0], { thiscall: object + 4 });
    const handle = g.call(fsystem, open, [g.cstr(name), g.cstr('rb'), 0], { thiscall: object + 4 });
    assert.ok(handle && handle !== 0xffffffff, `${name} Open`);
    const size = g.call(fsystem, sizeHandle, [handle], { thiscall: object + 4 });
    const buf = g.alloc(want.length + 8);
    g.call(fsystem, seek, [handle, 0, 0], { thiscall: object + 4 });
    const n = g.call(fsystem, read, [buf, want.length, handle], { thiscall: object + 4 });
    const got = Buffer.from(g.u8.subarray(buf, buf + n));
    assert.equal(n, want.length, `${name} byte count`);
    assert.ok(got.equals(want), `${name} content must match the VPK archive`);
    assert.equal(size, want.length, `${name} Size(handle)`);
    assert.equal(byName, want.length, `${name} Size(name)`);
    assert.ok(fexists, `${name} FileExists`);
    assert.equal(g.call(fsystem, tell, [handle], { thiscall: object + 4 }), want.length, `${name} Tell`);
    g.call(fsystem, close, [handle], { thiscall: object + 4 });
    console.log(`PASS VPK-only ${name}: ${size} bytes, content matches archive`);
  }
} finally {
  const workers = new Set([...g.handles.values()].filter(x => x.type === 'thread').map(x => x.worker));
  await Promise.all([...workers].map(w => w.terminate()));
}
process.exit(0);
