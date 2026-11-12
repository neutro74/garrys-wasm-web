import assert from 'node:assert/strict';
import {applyOp} from './ops.js';
for(const offset of [0,1,16]){
 const buffer=new ArrayBuffer(64+offset),blob=new Uint8Array(buffer,offset,32);
 const values=new Float32Array([1,2,3,4,5,6,7,8]);blob.set(new Uint8Array(values.buffer));
 const shadow=new Float32Array(8);
 const renderer={applyState(d){
  assert.deepEqual([...d.vsF[0][1]],[1,2,3,4]);assert.deepEqual([...d.psF[0][1]],[5,6,7,8]);
  if(offset%4===0)assert.equal(d.vsF[0][1].buffer,buffer,'aligned constants must use a zero-copy view');
  shadow.set(d.vsF[0][1]);shadow.set(d.psF[0][1],4);
 }};
 applyOp(renderer,{o:'st',d:{cf:[[0,7,1],[1,8,1]]}},blob);
 blob.fill(0);assert.deepEqual([...shadow],[1,2,3,4,5,6,7,8]);
}
console.log('PASS constant views, offsets, unaligned fallback and renderer snapshots');
