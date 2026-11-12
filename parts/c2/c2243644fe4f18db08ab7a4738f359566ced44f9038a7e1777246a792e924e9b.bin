import assert from 'node:assert/strict';
import {SharedHeap} from './shared-heap.mjs';
const memory=new WebAssembly.Memory({initial:32,maximum:32,shared:true});
const heap=new SharedHeap(memory,{start:0x10000,end:0x1f0000,initialize:true});
const large=heap.allocate(4096),tiny=Array.from({length:8000},()=>heap.allocate(16));
heap.free(large);for(const p of tiny)heap.free(p);
let reads=0;const dv=heap.dv;
heap.dv=new Proxy(dv,{get(target,key){const v=Reflect.get(target,key,target);if(typeof v!=='function')return v;return (...args)=>{if(key==='getUint32')reads++;return v.apply(target,args);};}});
const p=heap.allocate(2048);
assert.equal(p,large);assert.ok(reads<64,`large request traversed ${reads} metadata words past unrelated tiny blocks`);
heap.dv=dv;
const attached=new SharedHeap(memory,{start:0x10000,end:0x1f0000});
const reused=attached.allocate(16);assert.ok(tiny.includes(reused),'size classes must be shared across workers');
assert.equal(heap.size(reused),16);assert.equal(heap.size(p),2048);
heap.free(p);attached.free(reused);
console.log('PASS bounded size-class search with 8000 tiny free blocks and cross-worker reuse');

for(const size of [16,17,31,32,33,63,64,65,1024,1025,2048,2049,4096]) {
  const q=heap.allocate(size);heap.bytes.fill(97,q,q+size);heap.free(q);
  const r=attached.allocate(size);assert.ok(attached.size(r)>=size);
  assert.ok(attached.bytes.subarray(r,r+size).every(v=>v===0),'reused block must be zeroed');attached.free(r);
}
console.log('PASS size-class boundaries, splitting and zeroing');
