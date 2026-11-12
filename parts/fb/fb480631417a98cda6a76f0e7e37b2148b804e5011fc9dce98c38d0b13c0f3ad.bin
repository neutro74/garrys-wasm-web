import assert from 'node:assert/strict';
import {RenderBlobArena} from './render-blob-arena.mjs';
const sync=new Int32Array(new SharedArrayBuffer(16)),arena=new RenderBlobArena(sync,{capacity:64});
const guest=new Uint8Array(new SharedArrayBuffer(128));guest.fill(17);
const first=arena.snapshot(guest.subarray(0,3));
guest.fill(31);const second=arena.snapshot(guest.subarray(0,4));
assert.equal(second.byteOffset,4);assert.deepEqual([...first],[17,17,17]);
const overflow=arena.snapshot(guest);assert.ok(overflow.buffer instanceof ArrayBuffer);
guest.fill(99);assert.equal(overflow[0],31);assert.equal(second[0],31);
arena.presented(1);arena.snapshot(guest.subarray(0,8));arena.presented(2);arena.snapshot(guest.subarray(0,8));arena.presented(3);
const wait=Atomics.wait;let waits=0;
try {
 Atomics.wait=(cell,index,expected)=>{
  waits++;assert.equal(cell,sync);assert.equal(index,1);assert.equal(expected,0);
  assert.deepEqual([...first],[17,17,17],'must wait before recycling any in-flight data');
  Atomics.store(sync,1,1);return 'ok';
 };
 const recycled=arena.snapshot(guest.subarray(0,3));assert.equal(waits,1);
 assert.equal(recycled.buffer,first.buffer);assert.deepEqual([...recycled],[99,99,99]);
}finally{Atomics.wait=wait;}
const batch=structuredClone({blobs:[second,overflow]},{transfer:[overflow.buffer]});
assert.ok(batch.blobs[0].buffer instanceof SharedArrayBuffer);assert.equal(batch.blobs[0][0],31);
assert.equal(overflow.byteLength,0);
console.log('PASS bounded render arenas, immutable snapshots, alignment, overflow, acknowledgement and recycling');
const compact=new RenderBlobArena(new Int32Array(new SharedArrayBuffer(16)),{capacity:64});
const a=new Uint8Array([1,2,3]),b=new Uint8Array([5,6]);
const packed=compact.concatenate([a,b]);a.fill(9);b.fill(9);
assert.deepEqual([...packed],[1,2,3,5,6]);assert.ok(compact.owns(packed));
assert.equal(compact.owns(new Uint8Array(new SharedArrayBuffer(64))),false);
console.log('PASS packed upload snapshots use arena backing stores and remain immutable');
