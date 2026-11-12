import { parentPort, workerData } from 'node:worker_threads';
import { Guest, SHIMS } from './guest.mjs';

const g = new Guest({ memory: workerData.mem, threadId: 2,
  processData: { stackSize: 0x20000, cmdline: 0, envw: 0, filesRoot: workerData.root } });
const buf = g.alloc(8), written = g.alloc(4);
const ok = SHIMS['kernel32.dll!ReadFile'].fn.call({ g }, workerData.handle, buf, 3, written, 0);
parentPort.postMessage({ ok, count: g.u32(written), text: Buffer.from(g.u8.subarray(buf, buf + g.u32(written))).toString() });
