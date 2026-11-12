import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

async function run(bytes, mem, fsbase, fpbase, stack) {
  const env = { mem, sin: Math.sin, cos: Math.cos, tan: Math.tan, log2: Math.log2,
    exp2: x => 2 ** x, exp2m1: x => 2 ** x - 1, atan2: Math.atan2, fmod: (a, b) => a % b, rdtsc: () => 0n, unwind: () => {},
    hostcall: () => { throw new Error('unexpected hostcall'); },
    bad_icall: () => { throw new Error('bad instruction'); }, trace: () => {} };
  const ex = (await WebAssembly.instantiate(bytes, { env })).instance.exports;
  const dv = new DataView(mem.buffer);
  dv.setUint32(stack, 0xdead0000, true);
  ex.esp.value = stack; ex.fsbase.value = fsbase; ex.fpbase.value = fpbase;
  ex.f_00001000();
  return { eax: ex.eax.value >>> 0, top: ex.ftop.value, value: dv.getFloat64(fpbase + 56, true) };
}

if (!isMainThread) {
  parentPort.postMessage(await run(workerData.bytes, workerData.mem, 0x500, 0x700, 0x21000));
} else {
  const bytes = fs.readFileSync(process.argv[2]);
  const mem = new WebAssembly.Memory({ initial: 8, maximum: 8, shared: true });
  const dv = new DataView(mem.buffer);
  dv.setUint32(0x418, 0x20000, true); dv.setUint32(0x518, 0x20004, true);
  dv.setFloat32(0x20000, 1.5, true); dv.setFloat32(0x20004, 2.5, true);
  const main = await run(bytes, mem, 0x400, 0x300, 0x20800);
  const worker = new Worker(new URL(import.meta.url), { workerData: { bytes, mem } });
  const other = await new Promise((resolve, reject) => {
    worker.once('message', resolve); worker.once('error', reject);
  });
  assert.deepEqual(main, { eax: 0x20000, top: 7, value: 1.5 });
  assert.deepEqual(other, { eax: 0x20004, top: 7, value: 2.5 });
  assert.equal(dv.getFloat64(0x300 + 56, true), 1.5);
  console.log('thread-local FS base and x87 backing store: PASS');
}
