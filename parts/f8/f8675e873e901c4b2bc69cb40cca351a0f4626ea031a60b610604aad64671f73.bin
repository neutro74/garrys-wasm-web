// Launch the retail game the way gmod.exe does: load every lifted module, run DllMain,
// then call launcher.dll!LauncherMain(hInstance, hPrevInstance, lpCmdLine, nCmdShow).
// The launcher's CSourceAppSystemGroup then performs Create/Connect/PreInit/Init/Run itself.
//
//   node host/gmod-launch.mjs [--cmd "<extra command line>"]
//
// Environment: GMOD_ROOT (install dir), GMOD_CMDLINE (replaces the default command line),
// D3D9_MAX_FRAMES (stop after N Present calls), D3D9_DEBUG, GUEST_DEBUG_PROC.
import fs from 'node:fs';
import { Guest } from './guest.mjs';
import { d3d9Stats } from './d3d9.mjs';
import { startRemote } from './d3d9-remote.mjs';

const root = process.env.GMOD_ROOT ?? process.env.HOME + '/.steam/steam/steamapps/common/GarrysMod';
if (!fs.existsSync(`${root}/garrysmod/maps/gm_construct.bsp`)) throw new Error(`retail install not found at ${root}`);

// Load order follows static import dependencies (tier0 owns the CPU globals and goes first).
const MODULES = ['tier0', 'vstdlib', 'steam', 'lua', 'input', 'unicode', 'filesystem', 'engine', 'matsys', 'shaderdx9', 'stdshader',
  'studiorender', 'datacache', 'vphysics', 'vgui2', 'vgui-surface', 'gameui', 'video', 'soundemitter', 'soundsystem', 'scenefilecache',
  'vaudio', 'client', 'server', 'menusystem', 'htmlstub', 'resources', 'gameshader', 'mdllib', 'gmodaudio', 'serverbrowser', 'adminserver', 'holly', 'launcher'];
const extra = process.argv.includes('--cmd') ? process.argv[process.argv.indexOf('--cmd') + 1] : '';
const cmdline = process.env.GMOD_CMDLINE ??
  `"c:\\gamebox\\gmod.exe" -game garrysmod -windowed -w 1280 -h 720 -nojoy -novid -console +mat_queue_mode 0 ${extra}`.trim();

const g = new Guest({ sharedMemory: true, filesRoot: root, log: (s) => console.log(`[guest] ${s.trimEnd()}`) });
g.cmdline = g.cstr(cmdline);
// D3D9_BACKEND=chromium renders in a Chromium page (D3D9_SHOT_EVERY=N saves a PNG every N presents to run/shots).
const remote = process.env.D3D9_BACKEND === 'chromium'
  ? await startRemote({ outDir: process.env.D3D9_SHOTS ?? new URL('../../../run/shots', import.meta.url).pathname })
  : null;
if (remote) g.d3d9Backend = remote.backend;
let loaded = 0;
for (const n of MODULES) {
  const prefix = `out/${n}-${process.env['LIFT_' + n] ?? 'thread'}`;
  if (!fs.existsSync(prefix + '.json')) { console.log(`SKIP ${n} (not lifted: ${prefix}.json)`); continue; }
  await g.load(prefix); loaded++;
}
for (const d of g.dlls.values()) { g.initialize(d); console.log(`PASS ${d.name} DllMain`); }

const launcher = g.dlls.get('launcher.dll');
if (!launcher) throw new Error('launcher.dll is not lifted/loaded (run run_more.sh)');
const entry = launcher.meta.exports.LauncherMain;
if (!entry) throw new Error('LauncherMain export not found');
console.log(`LauncherMain @0x${entry.toString(16)}  cmdline: ${cmdline}`);

const finish = async (code) => {
  if (remote) { remote.backend.shot('last.png'); await remote.close(); }
  for (const s of d3d9Stats(g)) console.log(`[d3d9] frames=${s.frames} draws=${s.draws} clears=${s.clears} backend=${JSON.stringify(s.backend)}`);
  const workers = new Set([...g.handles.values()].filter((x) => x.type === 'thread').map((x) => x.worker));
  await Promise.all([...workers].map((w) => w.terminate()));
  process.exit(code);
};
try {
  const rc = g.call(launcher, entry, [0x400000, 0, g.cmdline, 1]);
  console.log('LauncherMain ->', rc);
  await finish(0);
} catch (err) {
  for (const a of (process.env.GMOD_OBJ || '').split(',').filter(Boolean)) {
    const obj = parseInt(a, 16);
    try {
      const vt = g.u32(obj), f1 = g.u32(vt + 4);
      console.log(`obj 0x${a} <${g.rtti(obj)}> vtable 0x${vt.toString(16)} slot1 0x${f1.toString(16)} (${g.symbolize(f1)}) bytes ${Array.from(g.u8.subarray(f1, f1 + 12)).map((b) => b.toString(16).padStart(2, '0')).join(' ')}`);
    } catch (e) { console.log(`obj 0x${a}: ${e.message}`); }
  }
  for (const a of (process.env.GMOD_RTTI || '').split(',').filter(Boolean)) {
    const b = parseInt(a, 16);
    try { const obj = g.u32(b); console.log(`rtti 0x${a} -> object 0x${obj.toString(16)} <${g.rtti(obj)}> vtable 0x${g.u32(obj).toString(16)} slot34=0x${g.u32(g.u32(obj) + 0x88).toString(16)} (${g.symbolize(g.u32(g.u32(obj) + 0x88))})`); } catch (e) { console.log(`rtti 0x${a}: ${e.message}`); }
  }
  for (const a of (process.env.GMOD_DUMP || '').split(',').filter(Boolean)) {
    const b = parseInt(a, 16);
    console.log('dump 0x' + a, Array.from({ length: 12 }, (_, i) => { try { return '0x' + g.u32(b + 4 * i).toString(16); } catch { return '??'; } }).join(' '));
  }
  console.log((process.env.GMOD_STACK ? err.stack : err.message).split("\n").slice(0, process.env.GMOD_STACK ? 14 : 4).join('\n'));
  await finish(/D3D9_MAX_FRAMES/.test(err.message) ? 0 : 2);
}
