import assert from 'node:assert/strict';
import {initializeCoreDispatch} from './core-dispatch.mjs';
const memory=new WebAssembly.Memory({initial:2,maximum:4,shared:true});
const g={mem:memory,alloc:n=>{assert.ok(n>=128);return 4096;},attachedThread:true,threadAllocations:[]};
const ex=Object.fromEntries(['base','shift','mask'].map(n=>['core_dispatch_'+n,new WebAssembly.Global({value:'i32',mutable:true},0)]));
const map=[0xffffffff,17,0x12345678,2,0x12345679,3,0,999];
assert.equal(initializeCoreDispatch(g,ex,map),4096);assert.deepEqual(g.threadAllocations,[4096]);
function lookup(a){if(!a)return -1;const words=new Uint32Array(memory.buffer,ex.core_dispatch_base.value);let h=Math.imul(a,0x9e3779b1)>>>ex.core_dispatch_shift.value;while(words[h*2]){if(words[h*2]===(a>>>0))return words[h*2+1];h=(h+1)&ex.core_dispatch_mask.value;}return -1;}
for(let i=0;i<map.length-2;i+=2)assert.equal(lookup(map[i]),map[i+1]);
assert.equal(lookup(0),-1);assert.equal(lookup(13),-1);memory.grow(1);assert.equal(lookup(0xffffffff),17);
assert.equal(initializeCoreDispatch(g,{},map),0);
console.log('PASS core dispatch hash initialization, unsigned keys, misses, memory growth and worker cleanup');
