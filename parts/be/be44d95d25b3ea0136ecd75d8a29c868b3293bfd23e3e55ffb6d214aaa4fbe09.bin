import assert from 'node:assert/strict';
import {Guest,SHIMS} from './guest.mjs';
const g=new Guest({pages:512}),dll={meta:{spare_thunks:1024,thunk_base:0x13000000,imports:[]},extras:[]};
const out=g.alloc(4);assert.equal(SHIMS['d3dx9_40.dll!D3DXCreateMatrixStack'].fn.call({g,dll},0,out),0);const obj=g.u32(out);
const call=(name,...args)=>dll.extras.find(x=>x?.name==='d3dx#MatrixStack:'+name).fn.call({g,dll},obj,...args);
const parent=call('GetTop');g.dv.setFloat32(parent,2,true);
assert.equal(call('GetTop'),parent);assert.equal(g.dv.getFloat32(parent,true),2,'GetTop must expose mutable matrix storage without recopying');
call('Push');const child=call('GetTop');assert.notEqual(child,parent);assert.equal(g.dv.getFloat32(child,true),2);
g.dv.setFloat32(child,3,true);call('Pop');assert.equal(call('GetTop'),parent);assert.equal(g.dv.getFloat32(parent,true),2);
const allocations=g.allocations.size;
for(let n=0;n<1000;n++){call('Push');call('GetTop');call('Pop');}
assert.equal(g.allocations.size,allocations,'stack capacity must be reused after warmup');
call('LoadIdentity');assert.equal(g.dv.getFloat32(parent,true),1);
assert.equal(dll.extras.find(x=>x?.name==='d3dx#MatrixStack:QueryInterface').arity,3);
assert.equal(call('Release'),0);
console.log('PASS mutable matrix stack, GetTop alias, push/pop reuse and COM arity');
