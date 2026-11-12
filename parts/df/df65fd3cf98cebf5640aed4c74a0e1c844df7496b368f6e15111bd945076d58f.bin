import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

if (!isMainThread) {
  const env = { mem: workerData.mem, sin: Math.sin, cos: Math.cos, tan: Math.tan, log2: Math.log2,
    exp2: x => 2 ** x, exp2m1: x => 2 ** x - 1, atan2: Math.atan2, fmod: (a, b) => a % b, rdtsc: () => 0n, unwind: () => {},
    hostcall: () => { throw new Error('unexpected hostcall'); },
    bad_icall: () => { throw new Error('bad instruction'); }, trace: () => {} };
  const ex = (await WebAssembly.instantiate(workerData.bytes, { env })).instance.exports;
  const dv = new DataView(workerData.mem.buffer);
  dv.setUint32(workerData.stack, 0xdead0000, true);
  const control = new Int32Array(workerData.mem.buffer, 0x11000, 1);
  parentPort.postMessage('ready');
  Atomics.wait(control, 0, 0);
  for (let i = 0; i < workerData.iterations; i++) {
    ex.esp.value = workerData.stack; ex.ebx.value = 0x10000; ex.f_00001000();
  }
  parentPort.postMessage('done');
} else {
  const bytes = fs.readFileSync(process.argv[2]);
  const mem = new WebAssembly.Memory({ initial: 8, maximum: 8, shared: true });
  const iterations = 20000;
  const workers = [0x20800, 0x21800].map(stack => new Worker(new URL(import.meta.url), {
    workerData: { bytes, mem, iterations, stack },
  }));
  const ready = workers.map(worker => new Promise((resolve, reject) => {
    worker.once('message', resolve); worker.once('error', reject);
  }));
  await Promise.all(ready);
  const done = workers.map(worker => new Promise((resolve, reject) => {
    worker.once('message', resolve); worker.once('error', reject);
  }));
  const control = new Int32Array(mem.buffer, 0x11000, 1);
  Atomics.store(control, 0, 1); Atomics.notify(control, 0);
  await Promise.all(done);
  assert.equal(Atomics.load(new Int32Array(mem.buffer, 0x10000, 1), 0), 2 * iterations);
  console.log('40,000 contended atomic increments: PASS');
}
