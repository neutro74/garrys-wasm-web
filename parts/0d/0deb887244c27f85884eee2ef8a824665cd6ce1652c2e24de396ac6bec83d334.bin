import assert from 'node:assert/strict';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { SharedHeap } from './shared-heap.mjs';

const layout = { control: 0x2000, start: 0x10000, end: 0x200000 };
if (!isMainThread) {
  const heap = new SharedHeap(workerData.mem, layout);
  const data = new DataView(workerData.mem.buffer);
  const blocks = [];
  for (let i = 0; i < 1000; i++) {
    const p = heap.allocate(32 + i % 4);
    data.setUint32(p, workerData.id, true); data.setUint32(p + 4, i, true);
    blocks.push(p);
  }
  parentPort.postMessage({ type: 'allocated', blocks });
  const barrier = new Int32Array(workerData.mem.buffer, 0x3000, 1);
  Atomics.wait(barrier, 0, 0);
  for (let i = 0; i < blocks.length; i++) {
    assert.equal(data.getUint32(blocks[i], true), workerData.id);
    assert.equal(data.getUint32(blocks[i] + 4, true), i);
    heap.free(blocks[i]);
  }
  parentPort.postMessage({ type: 'freed' });
} else {
  const mem = new WebAssembly.Memory({ initial: 64, maximum: 64, shared: true });
  const heap = new SharedHeap(mem, { ...layout, initialize: true });
  const workers = Array.from({ length: 4 }, (_, id) => new Worker(new URL(import.meta.url), { workerData: { mem, id: id + 1 } }));
  const allocated = workers.map(w => new Promise((resolve, reject) => { w.once('message', resolve); w.once('error', reject); }));
  const lists = await Promise.all(allocated);
  const pointers = lists.flatMap(x => x.blocks);
  assert.equal(new Set(pointers).size, 4000);
  const freed = workers.map(w => new Promise((resolve, reject) => { w.once('message', resolve); w.once('error', reject); }));
  const barrier = new Int32Array(mem.buffer, 0x3000, 1);
  Atomics.store(barrier, 0, 1); Atomics.notify(barrier, 0);
  await Promise.all(freed);
  const p = heap.allocate(32);
  assert.ok(pointers.includes(p));
  assert.ok([32,48].includes(heap.size(p))); // recycled capacity sufficient for the request
  new DataView(mem.buffer).setUint32(p, 0xabcdef12, true);
  const q = heap.realloc(p, 128);
  assert.equal(new DataView(mem.buffer).getUint32(q, true), 0xabcdef12);
  heap.free(q);
  assert.throws(() => heap.free(q), /invalid shared heap pointer/);
  console.log('shared heap: 4 workers / 4,000 live blocks / reuse / realloc PASS');
}
