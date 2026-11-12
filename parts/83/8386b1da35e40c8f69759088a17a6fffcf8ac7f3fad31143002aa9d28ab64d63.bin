// Load and initialize a dependency-ordered list of lifted DLLs. Fail at the
// first unsupported boundary instead of continuing with a partially initialized DLL.
import { Guest } from './guest.mjs';
import fs from 'node:fs';

const prefixes = process.argv.slice(2);
if (!prefixes.length) throw new Error('usage: node host/multi-probe.mjs PREFIX...');
const first = JSON.parse(fs.readFileSync(prefixes[0] + '.json', 'utf8'));
const g = new Guest({ sharedMemory: !!first.shared_memory, log: s => console.log(s) });
const dlls = [];
for (const prefix of prefixes) {
  const d = await g.load(prefix);
  console.log(`loaded ${d.name} at 0x${d.meta.base.toString(16)}`);
  dlls.push(d);
}
for (const d of dlls) {
  console.log(`initializing ${d.name}`);
  const result = g.initialize(d);
  console.log(`${d.name} DllMain returned ${result}`);
}
