import assert from 'node:assert/strict';
import {DirectBackend} from './d3d9-backend.mjs';
const pixels=Uint8Array.from([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);
const gl={READ_FRAMEBUFFER:1,READ_FRAMEBUFFER_BINDING:2,PACK_ALIGNMENT:3,RGBA:4,UNSIGNED_BYTE:5,NO_ERROR:0,getParameter:()=>0,bindFramebuffer(){},pixelStorei(){},getError:()=>0,readPixels(x,y,w,h,f,t,out){out.set(pixels);}};
const be=new DirectBackend({gl,fboFor:()=>1},()=>{},{});be.attach({u8:new Uint8Array(128)});
assert.equal(be.readbackSurface({object:1,w:2,h:2,format:21},16,12),true);
assert.deepEqual([...be.g.u8.slice(16,24)],[3,2,1,4,7,6,5,8]);assert.deepEqual([...be.g.u8.slice(28,36)],[11,10,9,12,15,14,13,16]);
console.log('render-target readback BGRA and destination pitch: PASS');
