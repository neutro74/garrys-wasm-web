import assert from 'node:assert/strict';
import {D3D9Renderer} from './renderer.js';
import {semName} from './shader.js';

// Model GL's captured ARRAY_BUFFER binding and per-VAO attribute state, then
// inspect the actual production draw/flush methods rather than a duplicate cache.
function fixture() {
  const calls=[], bindings=new Map(), attributes=new Map();
  let next=1,vao;
  const gl=new Proxy({
    getExtension(){return null;},
    bindBuffer(target,buffer){calls.push(['bindBuffer',target,buffer]);bindings.set(target,buffer);},
    bindVertexArray(v){vao=v;if(!attributes.has(v))attributes.set(v,new Map());},
    vertexAttribPointer(reg,size,type,normalized,stride,offset){
      const value={buffer:bindings.get(gl.ARRAY_BUFFER),size,type,normalized,stride,offset};
      attributes.get(vao).set(reg,value);calls.push(['pointer',reg,value]);
    },
    vertexAttribDivisor(reg,value){calls.push(['divisor',reg,value]);},
    bufferSubData(...args){calls.push(['upload',...args]);},
    drawArrays(...args){calls.push(['draw',...args]);},
    drawArraysInstanced(...args){calls.push(['instanced',...args]);},
  },{get(target,key){
    if(key in target)return target[key];
    if(key.startsWith('create'))return target[key]=()=>({kind:key,serial:next++});
    if(key.toUpperCase()===key)return target[key]=next++;
    return target[key]=(...args)=>calls.push([key,...args]);
  }});
  const renderer=new D3D9Renderer({getContext:()=>gl});
  const prog={prog:{},bad:false,inputs:[{name:semName(0,0),reg:0}],samplers:[],vsSamplers:[]};
  renderer.program=()=>prog;
  renderer.targetSize=()=>({w:640,h:480});
  renderer.bindTargets=()=>{};
  renderer.applyRenderState=()=>{};
  renderer.res.set(1,{t:{}});renderer.res.set(2,{t:{}});
  renderer.S.vs=1;renderer.S.ps=2;
  renderer.S.decl=[{usage:0,usageIndex:0,stream:0,offset:4,type:2}];
  renderer.createBuffer(3,{kind:'vb',size:1024});
  renderer.S.streams[0]={vb:3,offset:8,stride:24,freq:1};
  calls.length=0;
  const call={indexed:false,prim:4,primCount:1,startVertex:0,baseVertex:2};
  const draw=(overrides={},up=false)=>renderer.draw({...call,...overrides},up);
  const count=name=>calls.filter(c=>c[0]===name).length;
  const pointer=()=>attributes.get(renderer.vao).get(0);
  return {renderer,gl,calls,draw,count,pointer,prog};
}

const f=fixture(),{renderer:r,gl,draw,count,pointer}=f;
draw();
assert.equal(pointer().offset,60,'base vertex, stream offset and declaration offset compose');
assert.equal(pointer().buffer,r.res.get(3).buf);
const firstPointers=count('pointer');
draw();
assert.equal(count('draw'),2,'both draws still execute');
assert.equal(count('pointer'),firstPointers,'unchanged input must retain its VAO pointer');
assert.equal(count('upload'),4,'only first draw uploads initial float and misc blocks');
assert.equal(count('bindBuffer'),3,'one vertex binding and two initial UBO bindings');

draw({baseVertex:3});assert.equal(pointer().offset,84);
r.S.streams[0].stride=32;draw();assert.equal(pointer().stride,32);assert.equal(pointer().offset,76);
r.S.decl=[{usage:0,usageIndex:0,stream:0,offset:4,type:4}];draw();
assert.equal(pointer().type,gl.UNSIGNED_BYTE);assert.equal(pointer().normalized,true);
r.S.streams[0].offset=16;draw();assert.equal(pointer().offset,84);

// An upload may change ARRAY_BUFFER, but existing pointers retain their buffer.
r.createBuffer(4,{kind:'vb',size:1024});r.uploadBuffer(4,0,new Uint8Array(16));
const before=count('pointer');draw();assert.equal(count('pointer'),before);assert.equal(pointer().buffer,r.res.get(3).buf);
r.S.streams[0].vb=4;draw();assert.equal(pointer().buffer,r.res.get(4).buf);
const deleted=r.res.get(4).buf;r.destroy(4);r.createBuffer(4,{kind:'vb',size:1024});draw();
assert.notEqual(pointer().buffer,deleted,'reused guest IDs capture the new WebGLBuffer');

// Shader input locations and enable state may change without invalidating the
// pointers already captured at other locations in the same VAO.
f.prog.inputs=[{name:semName(0,0),reg:3}];draw();
assert.ok(f.calls.some(c=>c[0]==='disableVertexAttribArray'&&c[1]===0));
const afterRegChange=count('pointer');
f.prog.inputs=[{name:semName(0,0),reg:0}];draw();
assert.equal(count('pointer'),afterRegChange,'returning to an unchanged register reuses its pointer');
assert.ok(f.calls.some(c=>c[0]==='enableVertexAttribArray'&&c[1]===0));
f.prog.inputs=[{name:semName(1,0),reg:0}];draw();
assert.equal(r.attrOn,0,'missing declaration inputs disable the previous array');
f.prog.inputs=[{name:semName(0,0),reg:0}];draw();
assert.equal(count('pointer'),afterRegChange,'restoring an input re-enables its captured pointer');

// Stream zero controls instance count; an instanced stream ignores baseVertex.
r.S.decl=[{usage:0,usageIndex:0,stream:1,offset:4,type:2}];
r.S.streams[0].freq=(1<<30)|3;
r.S.streams[1]={vb:3,offset:16,stride:12,freq:(2<<30)|1};
draw({baseVertex:7});assert.equal(pointer().offset,20);
assert.equal(f.calls.at(-1)[0],'instanced');assert.equal(f.calls.at(-1).at(-1),3);
assert.deepEqual(f.calls.filter(c=>c[0]==='divisor').at(-1),['divisor',0,1]);
r.S.streams[0].freq=1;r.S.streams[1].freq=1;draw({baseVertex:7});
assert.equal(pointer().offset,104);assert.deepEqual(f.calls.filter(c=>c[0]==='divisor').at(-1),['divisor',0,0]);
r.S.streams[1].stride=0;draw();assert.deepEqual(f.calls.filter(c=>c[0]==='divisor').at(-1),['divisor',0,1]);
r.S.streams[1].stride=12;draw();assert.deepEqual(f.calls.filter(c=>c[0]==='divisor').at(-1),['divisor',0,0]);

draw({stride:20,baseVertex:0},true);assert.equal(pointer().buffer,r.scratchVB);assert.equal(pointer().offset,4);
draw();assert.equal(pointer().buffer,r.res.get(3).buf,'ordinary draws restore input after UP');
const beforeResize=count('pointer');r.resize(800,600);draw();
assert.equal(count('pointer'),beforeResize,'canvas resize preserves WebGL vertex state');

// Clean UBO stages bind nothing; later writes upload only their changed stage.
f.calls.length=0;r.flushUniforms({});assert.equal(count('bindBuffer'),0);
r.applyState({vsF:[[7,new Float32Array([1,2,3,4])]]});r.flushUniforms({});
assert.equal(count('bindBuffer'),1);assert.equal(count('upload'),1);
const upload=f.calls.find(c=>c[0]==='upload');assert.equal(upload[2],7*16);
assert.deepEqual([...new Float32Array(upload[3].buffer,upload[3].byteOffset,4)],[1,2,3,4]);
r.applyState({psI:[[0,[5,6,7,8]]]});r.flushUniforms({});
assert.equal(count('bindBuffer'),2);assert.equal(count('upload'),2);
assert.equal(f.calls.filter(c=>c[0]==='upload').at(-1)[2],4096);

const fresh=fixture();fresh.draw();assert.equal(fresh.count('pointer'),1,'a new context/renderer initializes its own cache');
assert.ok(r.stats.attributePointerSkips>0);assert.ok(r.stats.uniformBindSkips>0);
console.log('PASS production renderer input cache, buffer identity, UP/instancing/divisor/resize and UBO changes');
