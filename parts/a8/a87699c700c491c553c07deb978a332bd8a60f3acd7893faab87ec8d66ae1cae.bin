import assert from 'node:assert/strict';
import {Guest} from './guest.mjs';
const g=new Guest({pages:512});
const primary=await g.load(process.argv[2]+'/primary');
const secondary=await g.load(process.argv[2]+'/secondary');
assert.ok(secondary.hostBridge);
assert.equal(g.call(primary,primary.meta.exports.entry),1);
assert.equal(primary.ex.esp.value>>>0,0x1ff000);
assert.equal(g.d3dRuntime.dll,secondary);
assert.ok(secondary.extras.some(x=>x?.name==='d3d9#d3d9:4'));
for(const n of [0,1,4,5,8,13]){
 const fn=function(...args){assert.equal(this.ecx,77);return args.reduce((a,b)=>a+b,0);};
 const addr=g.extraThunk(secondary,'test-sum'+n,fn,n*4,false,n,true);
 assert.equal(g.call(secondary,addr,Array.from({length:n},(_,i)=>i+1),{thiscall:77}),n*(n+1)/2);
 assert.equal(secondary.ex.esp.value>>>0,0x1ff000);
}
console.log('PASS real lifted COM bridge, cross-DLL calls and 0..13 argument ABI');
