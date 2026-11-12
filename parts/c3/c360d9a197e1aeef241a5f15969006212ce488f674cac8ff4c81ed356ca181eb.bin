// Probe: when does vstdlib populate its internal g_pCVar (0x743c7e8)?
import { Guest, SHIMS } from './guest.mjs';

const root = process.env.HOME + '/.steam/steam/steamapps/common/GarrysMod';
const g = new Guest({ sharedMemory: true, filesRoot: root, log: s => console.log(`[guest] ${s.trimEnd()}`) });
for (const n of ['tier0', 'vstdlib']) await g.load(`out/${n}-thread`);
for (const d of g.dlls.values()) g.initialize(d);
const vs = g.dlls.get('vstdlib.dll');
const factory = g.extraThunk(vs, 'host!CreateInterfaceFn', SHIMS['host!CreateInterfaceFn'].fn,
  SHIMS['host!CreateInterfaceFn'].pop, SHIMS['host!CreateInterfaceFn'].cdecl, SHIMS['host!CreateInterfaceFn'].arity);
console.log('before CreateInterface [0x743c7e8]=', g.u32(0x743c7e8).toString(16));
const st = g.alloc(4);
const cvar = g.call(vs, vs.meta.exports.CreateInterface, [g.cstr('VEngineCvar004'), st]);
console.log('VEngineCvar004 =', cvar.toString(16), 'status', g.u32(st), '[0x743c7e8]=', g.u32(0x743c7e8).toString(16));
if (cvar) {
  const vt = g.u32(cvar);
  console.log('vtable =', vt.toString(16), Array.from({ length: 8 }, (_, i) => g.u32(vt + 4 * i).toString(16)).join(' '));
  console.log('obj words:', Array.from({ length: 8 }, (_, i) => g.u32(cvar + 4 * i).toString(16)).join(' '));
  console.log('Connect ->', g.call(vs, g.u32(vt), [factory], { thiscall: cvar }) & 0xff,
    '[0x743c7e8]=', g.u32(0x743c7e8).toString(16));
}
const q = g.alloc(4);
const cq = g.call(vs, vs.meta.exports.CreateInterface, [g.cstr('VCvarQuery001'), q]);
console.log('VCvarQuery001 =', cq.toString(16), 'status', g.u32(q), '[0x743c7e8]=', g.u32(0x743c7e8).toString(16));
const workers = new Set([...g.handles.values()].filter(x => x.type === 'thread').map(x => x.worker));
await Promise.all([...workers].map(w => w.terminate()));
