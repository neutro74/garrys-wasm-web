import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {applyOp} from '../runtime/d3d9/ops.js';
import {FrameMetrics} from '../runtime/d3d9/frame-metrics.js';

// Run the browser worker's actual handlers with an in-memory port and renderer.
// Only browser-root import resolution is replaced; batch decoding stays intact.
const seen=[];
class Renderer {
  uploadBuffer(id, offset, bytes) { seen.push({id,offset,bytes}); }
  applyState(delta) { seen.push({constants:Float32Array.from(delta.vsF[0][1])}); }
}
const self={postMessage() {}};
const source=readFileSync(new URL('./render-worker.js',import.meta.url),'utf8');
vm.runInNewContext(source.replace(/^import .*;\n/gm,''),{
  self,D3D9Renderer:Renderer,applyOp,FrameMetrics,Uint8Array,Int32Array,Atomics,performance,
});
const port={};
self.onmessage({data:{type:'init',canvas:{},port}});

const guest=new Uint8Array(new SharedArrayBuffer(32));
guest.set([10,20,30,40],4);
// The asynchronous backend snapshots shared guest bytes before transfer.
const snapshot=guest.slice(4,8);
const storage=new Uint8Array(12);storage.set([50,60,70,80],3);
const offsetView=storage.subarray(3,7);
const floats=new Float32Array([1,2,3,4]);
const message=structuredClone({type:'ops',present:false,ops:[
  {o:'ub',id:11,offset:9,b:0},
  {o:'ub',id:12,offset:5,b:1},
  {o:'st',d:{cf:[[0,7,1]]},b:2},
],blobs:[snapshot,offsetView,new Uint8Array(floats.buffer)]},
{transfer:[snapshot.buffer,storage.buffer,floats.buffer]});
guest.fill(255);
assert.equal(snapshot.byteLength,0,'sender relinquishes the snapshot');
assert.ok(message.blobs.every(b=>b.buffer instanceof ArrayBuffer),'no shared guest memory is exposed');
assert.notEqual(new Uint8Array(message.blobs[0]).buffer,message.blobs[0].buffer,
  'the previous receiver constructor would allocate a redundant copy');
port.onmessage({data:message});
assert.equal(seen[0].bytes,message.blobs[0],'renderer receives the transferred view without a copy');
assert.equal(seen[1].bytes,message.blobs[1],'offset views retain identity');
assert.equal(seen[1].bytes.byteOffset,3);
assert.equal(seen[1].bytes.byteLength,4);
assert.deepEqual([...seen[0].bytes],[10,20,30,40],'later guest writes cannot alter the snapshot');
assert.deepEqual([...seen[1].bytes],[50,60,70,80]);
assert.deepEqual([seen[0].id,seen[0].offset,seen[1].id,seen[1].offset],[11,9,12,5]);
assert.deepEqual([...seen[2].constants],[1,2,3,4],'shader constants decode from transferred bytes');
console.log('PASS render-worker transferred blob identity, offsets, snapshot isolation and constants');
