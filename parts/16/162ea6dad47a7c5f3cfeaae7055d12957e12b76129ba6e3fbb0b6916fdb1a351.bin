import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';

async function instantiate(bytes, mem) {
  const env = {
    mem, sin: Math.sin, cos: Math.cos, tan: Math.tan, log2: Math.log2,
    exp2: x => 2 ** x, exp2m1: x => 2 ** x - 1, atan2: Math.atan2,
    fmod: (a, b) => a % b, rdtsc: () => 0n, unwind: () => {},
    hostcall: () => { throw new Error('unexpected hostcall'); },
    bad_icall: () => { throw new Error('unexpected bad call'); }, trace: () => {},
  };
  return (await WebAssembly.instantiate(bytes, { env })).instance.exports;
}

if (!isMainThread) {
  const ex = await instantiate(workerData.bytes, workerData.mem);
  const memory = new DataView(workerData.mem.buffer);
  memory.setUint32(0x31000, 0xdead0000, true);
  ex.esp.value = 0x31000; ex.ecx.value = 7; ex.fcw.value = 0x123;
  ex.f_00001000();
  parentPort.postMessage({ eax: ex.eax.value, fcw: ex.fcw.value });
} else {
  const bytes = fs.readFileSync(process.argv[2]);
  const mem = new WebAssembly.Memory({ initial: 8, maximum: 8, shared: true });
  const ex = await instantiate(bytes, mem);
  const memory = new DataView(mem.buffer);
  memory.setUint32(0x30000, 0xdead0000, true);
  ex.esp.value = 0x30000; ex.ecx.value = 3;
  ex.f_00001000();
  const worker = new Worker(new URL(import.meta.url), { workerData: { bytes, mem } });
  const result = await new Promise((resolve, reject) => {
    worker.once('message', resolve); worker.once('error', reject);
    worker.once('exit', code => { if (code) reject(new Error(`worker exited ${code}`)); });
  });
  assert.equal(result.eax, 10);
  assert.equal(result.fcw, 0x123);
  assert.equal(memory.getUint32(0x10000, true), 10);
  assert.equal(ex.eax.value, 3);
  assert.equal(ex.fcw.value, 0x37f); // CPU globals remain thread-local
  console.log('shared WASM memory / per-worker CPU globals: PASS');
}
