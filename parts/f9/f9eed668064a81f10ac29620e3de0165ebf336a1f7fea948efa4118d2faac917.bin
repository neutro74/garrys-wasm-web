// Check whether threads started by DLL initialization actually stay alive or fail.
import { Guest } from './guest.mjs';

const g = new Guest({ sharedMemory: true, log: s => console.log(s) });
for (const p of process.argv.slice(2)) await g.load(p);
for (const d of g.dlls.values()) {
  g.initialize(d);
  console.log(`PASS ${d.name} DllMain`);
}
const seen = new Set();
const workers = [];
try {
  for (const t of g.handles.values()) {
    if (t.type !== 'thread' || seen.has(t.control)) continue;
    seen.add(t.control); workers.push(t.worker);
    const status = new Int32Array(g.mem.buffer, t.control + 4, 1);
    if (!Atomics.load(status, 0)) Atomics.wait(status, 0, 0, 5000);
    const state = Atomics.load(status, 0);
    const id = g.u32(t.control + 8);
    if (state === 2) throw new Error(`guest thread ${id} failed: ${g.readStr(t.control + 16, 495)}`);
    console.log(`guest thread ${id}: ${state === 0 ? 'running' : `exited (${g.u32(t.control + 12)})`}`);
  }
} finally {
  // This is only a bounded diagnostic, not the game's normal shutdown path.
  await Promise.all(workers.map(w => w.terminate()));
}
if (!seen.size) throw new Error('no guest threads were created');
