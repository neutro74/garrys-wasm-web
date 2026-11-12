import assert from 'node:assert/strict';
import {installD3DX9} from './d3dx9.mjs';
const shims={};installD3DX9(shims);const transpose=shims['d3dx9_40.dll!D3DXMatrixTranspose'].fn;
const g={dv:new DataView(new ArrayBuffer(512))};
const bits=[0,0x80000000,0x7fa12345,0xff800000,0x3f800000,0x40000000,0x40400000,0x40800000,1,2,3,4,0xffffffff,0x7fc12345,0x00ffffff,0x12345678];
for(const [src,out] of [[1,129],[1,1],[1,5]]){
 bits.forEach((v,i)=>g.dv.setUint32(src+4*i,v,true));assert.equal(transpose.call({g},out,src),out);
 for(let r=0;r<4;r++)for(let c=0;c<4;c++)assert.equal(g.dv.getUint32(out+16*r+4*c,true),bits[4*c+r]>>>0,'transpose preserves every bit, including NaNs and signed zero, under aliasing');
}
console.log('PASS bit-exact transpose, NaNs, signed zero, unaligned and overlapping matrix storage');
