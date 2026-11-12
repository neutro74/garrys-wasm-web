import assert from 'node:assert/strict';
import {WorkerBackend} from './d3d9-backend.mjs';
const messages=[],backend=new WorkerBackend({postMessage:(message,transfer=[])=>{messages.push(structuredClone(message,{transfer}));}},{blobArenaBytes:128});
const bytes=new Uint8Array(new SharedArrayBuffer(256));backend.attach({u8:bytes});
const st={data:16,object:19};bytes.fill(7);backend.uploadBuffer(st,4,16);
assert.ok(backend.blobs[0].buffer instanceof SharedArrayBuffer,'uploads should use bounded immutable arena snapshots');
bytes.fill(99);assert.deepEqual([...backend.blobs[0]],new Array(16).fill(7));
backend.flush();assert.equal(messages.at(-1).blobs[0][0],7);
backend.uploadBuffer(st,4,16);backend.flush();assert.equal(messages.at(-2).blobs[0][0],7,'non-present flush must not recycle previous bytes');
backend.emit({o:'present',html:[]});backend.flush();Atomics.store(backend.sync,1,1);
const buffers=new Set();
for(let frame=0;frame<1000;frame++){
 backend.uploadBuffer(st,4,16);buffers.add(backend.blobs[0].buffer);
 backend.emit({o:'present',html:[]});backend.flush();Atomics.store(backend.sync,1,Atomics.load(backend.sync,0));
}
assert.equal(buffers.size,3,'backing-store count stays bounded over 1000 frames');
const fallback=new WorkerBackend({postMessage(){}},{blobArenaBytes:0});fallback.attach({u8:bytes});fallback.uploadBuffer(st,0,16);
assert.ok(fallback.blobs[0].buffer instanceof ArrayBuffer,'zero capacity retains transfer path');
console.log('PASS real backend arena upload snapshots, non-present batches, transfer filtering and 1000-frame reuse');

const floats=new Float32Array([1,-2,3.5,4]),indices=new Uint8Array([9,8,7]);
const packed=backend.combineBlobs([floats,indices]);backend.emit({o:'packed'},packed);
assert.equal(backend.blobs.at(-1),packed,'already protected payloads retain their snapshot');
floats.fill(33);indices.fill(66);assert.equal(new Float32Array(packed.buffer,packed.byteOffset,4)[2],3.5);
assert.deepEqual([...packed.subarray(16)],[9,8,7]);
console.log('PASS combined constants and UP payloads preserve typed byte layout and immutable snapshots');
