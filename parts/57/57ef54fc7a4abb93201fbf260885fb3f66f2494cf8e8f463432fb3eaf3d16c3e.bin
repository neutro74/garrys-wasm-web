// Verify the lifted shaderapidx9 creates a D3D9 device through the host surface.
import { Guest, SHIMS } from './guest.mjs';
import { d3d9Stats } from './d3d9.mjs';

const root = process.env.HOME + '/.steam/steam/steamapps/common/GarrysMod';
const g = new Guest({ sharedMemory: true, filesRoot: root, log: s => console.log(`[guest] ${s.trimEnd()}`) });
for (const n of ['tier0', 'vstdlib', 'steam', 'lua', 'input', 'matsys', 'shaderdx9', 'stdshader', 'studiorender', 'datacache', 'vphysics', 'filesystem']) {
  const prefix = n === 'matsys' ? (process.env.MATSYS_PREFIX ?? 'out/matsys-thread') : `out/${n}-thread`;
  await g.load(prefix);
}
for (const d of g.dlls.values()) g.initialize(d);

const mat = g.dlls.get('materialsystem.dll');
const st = g.alloc(4);
const ms = g.call(mat, mat.meta.exports.CreateInterface, [g.cstr('VMaterialSystem080'), st]);
if (!ms || g.u32(st)) throw new Error('VMaterialSystem080 was not created');
const mvt = g.u32(ms);
const shim = SHIMS['host!CreateInterfaceFn'];
const factory = g.extraThunk(mat, 'host!CreateInterfaceFn', shim.fn, shim.pop, shim.cdecl, shim.arity);

// vstdlib's CVarQuery connect must run before materialsystem Init; otherwise
// its global at 0x743c7e8 stays null and Init calls a null vtable slot.
{
  const vs = g.dlls.get('vstdlib.dll');
  const q = g.alloc(4);
  const cvar = g.call(vs, vs.meta.exports.CreateInterface, [g.cstr('VEngineCvar004'), q]);
  if (!cvar || g.u32(q)) throw new Error('VEngineCvar004 not created');
  const vt = g.u32(cvar);
  console.log('VEngineCvar004 Connect ->', g.call(vs, g.u32(vt), [factory], { thiscall: cvar }) & 0xff,
    `[0x743c7e8]=0x${g.u32(0x743c7e8).toString(16)}`);
}
console.log('SetShaderAPI ->', g.call(mat, g.u32(mvt + 24), [g.cstr('shaderapidx9.dll')], { thiscall: ms }) & 0xff);
const connected = g.call(mat, g.u32(mvt), [factory], { thiscall: ms });
console.log('Connect ->', connected & 0xff);
console.log(`  g_pShaderAPI=0x${g.u32(0xe130fa4).toString(16)} g_pHWConfig=0x${g.u32(0xe126144).toString(16)} ` +
  `g_pShaderDeviceMgr=0x${g.u32(0xe130fa8).toString(16)}`);
const initRet = g.call(mat, g.u32(mvt + 12), [], { thiscall: ms });
console.log(`Init -> 0x${(initRet >>> 0).toString(16)} (low byte ${initRet & 0xff})`);
console.log(`Direct3DCreate9 calls: ${g.d3d9Created || 0}`);
if (process.env.MATSYS_PREFIX) console.log('materialsystem blocks:', g.lastBlocks(40).join(' '));
if (process.argv.includes('--set-mode') || process.argv.includes('--init-device')) {
  // Explicitly exercise the device-manager mode transition. Init only probes
  // adapters; it does not create a device until a video mode is requested.
  const shader = g.dlls.get('shaderapidx9.dll');
  const manager = g.u32(0xe130fa8);
  const managerVtable = g.u32(manager);
  console.log('ShaderDeviceMgr vtable:', Array.from({ length: 16 }, (_, i) => `${i}=0x${g.u32(managerVtable + i * 4).toString(16)}`).join(' '));
  console.log(`Shader globals before SetMode: device=0x${g.u32(0xe2f646c).toString(16)} api=0x${g.u32(0xe2f6474).toString(16)} d3dDevice=0x${g.u32(0xe2f6488).toString(16)}`);
  const mode = g.alloc(56);
  g.u32(mode, 1); g.u32(mode + 4, 1); // structure versions
  g.u32(mode + 8, 800); g.u32(mode + 12, 600);
  g.u32(mode + 20, 60); g.u32(mode + 24, 1);
  g.u32(mode + 28, 1); g.u32(mode + 40, 90);
  g.u8[mode + 52] = 1; // windowed
  try {
    if (process.argv.includes('--init-device')) {
      // Diagnostic only: call the real retail InitDevice reached by SetMode,
      // without SetMode's initial ReleaseResources on a nonexistent device.
      const device = g.u32(0xe2ee8b4);
      const method = g.u32(g.u32(device) + 0x84);
      console.log(`ShaderDevice InitDevice object=0x${device.toString(16)} method=0x${method.toString(16)}`);
      const result = g.call(shader, method, [0x7ff10500, 0, mode], { thiscall: device });
      console.log(`ShaderDevice InitDevice -> 0x${result.toString(16)}`);
    } else {
      const factory = g.call(shader, g.u32(managerVtable + 12 * 4), [0x7ff10500, 0, mode], { thiscall: manager });
      console.log(`ShaderDeviceMgr SetMode -> 0x${factory.toString(16)}`);
    }
  } catch (e) {
    console.error(`ShaderDeviceMgr SetMode failed: ${e.message}`);
    process.exitCode = 1;
  }
}
const stats = d3d9Stats(g);
console.log('D3D9 devices:', JSON.stringify(stats));
const workers = new Set([...g.handles.values()].filter(x => x.type === 'thread').map(x => x.worker));
await Promise.all([...workers].map(w => w.terminate()));
if ((initRet & 0xff) !== 1 || ((process.argv.includes('--set-mode') || process.argv.includes('--init-device')) && !stats.length)) process.exitCode = 1;
