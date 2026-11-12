// Ask a lifted DLL's CreateInterface for an interface and describe what comes back.
import { Guest } from './guest.mjs';
import fs from 'node:fs';
const [, , dllName, version = 'VClient017'] = process.argv;
const root = process.env.HOME + '/.steam/steam/steamapps/common/GarrysMod';
const MODULES = ['tier0', 'vstdlib', 'steam', 'lua', 'input', 'unicode', 'filesystem', 'engine', 'matsys', 'shaderdx9', 'stdshader',
  'studiorender', 'datacache', 'vphysics', 'vgui2', 'vgui-surface', 'gameui', 'video', 'soundemitter', 'soundsystem', 'scenefilecache',
  'vaudio', 'client', 'server', 'menusystem', 'htmlstub', 'resources', 'gameshader', 'mdllib', 'gmodaudio', 'serverbrowser', 'adminserver', 'holly', 'launcher'];
const g = new Guest({ sharedMemory: true, filesRoot: root, log: () => {} });
for (const n of MODULES) if (fs.existsSync(`out/${n}-thread.json`)) await g.load(`out/${n}-thread`);
for (const d of g.dlls.values()) g.initialize(d);
const dll = g.dlls.get(dllName);
const st = g.alloc(4);
const p = g.call(dll, dll.meta.exports.CreateInterface, [g.cstr(version), st]);
const hex = (v) => '0x' + (v >>> 0).toString(16);
console.log(`${dllName} CreateInterface(${version}) -> ${hex(p)} status=${g.u32(st)}`);
if (p) console.log('  object words:', Array.from({ length: 6 }, (_, i) => hex(g.u32(p + 4 * i))).join(' '), ' owner:', g.symbolize(g.u32(p)) ?? '?');
process.exit(0);
