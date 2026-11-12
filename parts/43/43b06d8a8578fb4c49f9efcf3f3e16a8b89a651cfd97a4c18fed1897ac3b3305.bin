// Drive the retail engine app-system lifecycle step by step.
import fs from 'node:fs';
import { Guest, SHIMS } from './guest.mjs';

const root = process.env.HOME + '/.steam/steam/steamapps/common/GarrysMod';
if (!fs.existsSync(`${root}/garrysmod/maps/gm_construct.bsp`)) throw new Error('retail install not found');
const g = new Guest({ sharedMemory: true, filesRoot: root, log: s => console.log(`[guest] ${s.trimEnd()}`) });
// The retail launcher passes the process command line through; allow the map
// to be selected the same way a real launch does (e.g. +map gm_construct).
if (process.env.GMOD_CMDLINE) g.cmdline = g.cstr(process.env.GMOD_CMDLINE);
const dlls = ['tier0', 'vstdlib', 'steam', 'lua', 'input', 'unicode', 'engine', 'matsys', 'shaderdx9', 'stdshader',
  'studiorender', 'datacache', 'vphysics', 'filesystem', 'vgui2', 'vgui-surface', 'gameui'];
for (const n of dlls) await g.load(`out/${n}-${process.env['LIFT_' + n] ?? 'thread'}`);   // LIFT_matsys=trace selects the traced build
for (const d of g.dlls.values()) {
  g.initialize(d);
  console.log(`PASS ${d.name} DllMain`);
}
const engine = g.dlls.get('engine.dll');
const factoryFn = engine.meta.exports['?F@@YAXPAPAVIEngineAPI@@@Z'];
if (!factoryFn) throw new Error('engine API factory export not found');
const out = g.alloc(4);
g.u32(out, 0);
g.call(engine, factoryFn, [out]);
const api = g.u32(out);
console.log(`IEngineAPI = 0x${api.toString(16)}`);
if (!api) throw new Error('engine API factory returned null');
const vt = g.u32(api);
console.log('vtable', Array.from({ length: 8 }, (_, i) => '0x' + g.u32(vt + 4 * i).toString(16)).join(' '));

const shim = SHIMS['host!CreateInterfaceFn'];
const factory = g.extraThunk(engine, 'host!CreateInterfaceFn', shim.fn, shim.pop, shim.cdecl, shim.arity);

// The retail launcher's app framework adds vstdlib's cvar module
// (VStdLib_GetICVarFactory -> CVAR_INTERFACE_VERSION) before anything else and
// then ConnectTier1Libraries calls its Connect. Driving IEngineAPI directly
// skips launcher.exe, so perform the same step here: the engine's tier1 code
// dereferences vstdlib's internal g_pCVar and it must be connected first.
{
  const vs = g.dlls.get('vstdlib.dll');
  const st = g.alloc(4);
  const cvar = g.call(vs, vs.meta.exports.CreateInterface, [g.cstr('VEngineCvar004'), st]);
  if (!cvar || g.u32(st)) throw new Error('VEngineCvar004 not created');
  const cvt = g.u32(cvar);
  const ok = g.call(vs, g.u32(cvt), [factory], { thiscall: cvar }) & 0xff;
  console.log(`VEngineCvar004 Connect -> ${ok} g_pCVar=0x${g.u32(0x743c7e8).toString(16)}`);
  if (!ok) throw new Error('VEngineCvar004 Connect failed');
}

// The engine normally calls IMaterialSystem::SetShaderAPI("shaderapidx9.dll")
// before connecting the material system; that call loads the shader module and
// stores its CreateInterface as the factory used for ShaderDeviceMgr001,
// ShaderApi030, ShaderDevice001 and ShaderShadow010.
{
  const mat = g.dlls.get('materialsystem.dll');
  const st = g.alloc(4);
  const ms = g.call(mat, mat.meta.exports.CreateInterface, [g.cstr('VMaterialSystem080'), st]);
  if (!ms || g.u32(st)) throw new Error('VMaterialSystem080 not created');
  const mvt = g.u32(ms);
  const slot6 = g.u32(mvt + 24);
  console.log(`SetShaderAPI slot=0x${slot6.toString(16)}`);
  const r = g.call(mat, slot6, [g.cstr('shaderapidx9.dll')], { thiscall: ms });
  console.log(`SetShaderAPI -> 0x${(r >>> 0).toString(16)} shaderFactory=0x${g.u32(ms + 0x20029a0).toString(16)}`);
  console.log('GetRenderContext slot98 = materialsystem+0x' + (g.u32(mvt + 0x188) - mat.meta.base).toString(16));
  for (let i = 0; i < 200; i++) { const t = g.u32(mvt + 4 * i) - mat.meta.base; if ([0x46c10, 0x4b2a0].includes(t)) console.log('vtable idx', i, t.toString(16)); }
  const mconnect = g.u32(mvt);
  const mc = g.call(mat, mconnect, [factory], { thiscall: ms });
  console.log(`materialsystem Connect -> 0x${(mc >>> 0).toString(16)} shaderAPI=0x${g.u32(0xe130fa4).toString(16)} ` +
    `hwconfig=0x${g.u32(0xe126144).toString(16)} devmgr=0x${g.u32(0xe130fa8).toString(16)}`);
}
const connect = g.u32(vt);
try {
  console.log('Connect ->', g.call(engine, connect, [factory], { thiscall: api }) & 0xff);
} catch (e) {
  console.log('Connect FAILED:', e.message.split('\n')[0]);
  console.log(`  g_pShaderAPI=0x${g.u32(0xe130fa4).toString(16)} g_pHWConfig=0x${g.u32(0xe126144).toString(16)} ` +
    `g_pShaderDeviceMgr=0x${g.u32(0xe130fa8).toString(16)}`);
  const workers = new Set([...g.handles.values()].filter(x => x.type === 'thread').map(x => x.worker));
  await Promise.all([...workers].map(w => w.terminate()));
  process.exit(2);
}

// StartupInfo_t: instance, base dir, initial mod, initial game, parent group, text mode
const info = g.alloc(24);
g.u32(info + 0, 0);
g.u32(info + 4, g.cstr('c:\\gamebox'));
g.u32(info + 8, g.cstr('garrysmod'));
g.u32(info + 12, g.cstr('garrysmod'));
g.u32(info + 16, 0);
g.u32(info + 20, 0);
const setStartup = g.u32(vt + 20);
g.call(engine, setStartup, [info], { thiscall: api });
console.log('SetStartupInfo done');
const init = g.u32(vt + 12);
console.log('Init ->', g.call(engine, init, [], { thiscall: api }));
if (process.argv.includes('--run')) {
  // IEngineAPI::Run is index 6 (IAppSystem Connect/Disconnect/QueryInterface/
  // Init/Shutdown, then SetStartupInfo, Run).
  const run = g.u32(vt + 24);
  console.log(`Run (0x${run.toString(16)}) ...`);
  let rc;
  try { rc = g.call(engine, run, [], { thiscall: api }); }
  catch (err) {
    console.log(err.message.split('\n').slice(0, 3).join('\n'));
    if (g.cover && process.env.GUEST_COVER_QUERY) {
      const mat = g.dlls.get('materialsystem.dll');
      for (const q of process.env.GUEST_COVER_QUERY.split(',')) {
        const rva = parseInt(q, 16);
        console.log(`block materialsystem+0x${rva.toString(16)} executed: ${g.cover.has(mat.meta.base + rva)}`);
      }
      console.log('recent blocks:', g.lastBlocks(40).map((b) => g.symbolize(parseInt(b, 16)) ?? b).join(' '));
    }
    if (process.env.GMOD_DUMP) for (const a of process.env.GMOD_DUMP.split(',')) { const b=parseInt(a,16); console.log('dump 0x'+a, Array.from({length:12},(_,i)=>'0x'+g.u32(b+4*i).toString(16)).join(' ')); }
    process.exit(2);
  }
  console.log('Run ->', rc);
}
const workers = new Set([...g.handles.values()].filter(x => x.type === 'thread').map(x => x.worker));
await Promise.all([...workers].map(w => w.terminate()));
process.exit(0);
