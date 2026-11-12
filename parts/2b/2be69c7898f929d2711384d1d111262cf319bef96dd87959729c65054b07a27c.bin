import assert from 'node:assert/strict';
import {Worker,MessageChannel,isMainThread,workerData,parentPort} from 'node:worker_threads';
import {WorkerBackend} from './d3d9-backend.mjs';
import {applyOp} from '../../../runtime/d3d9/ops.js';
const frames=1000;
if(!isMainThread){
 const port=workerData.port;let sync,frame=-1,presents=0,uploads=0,constants=0;
 const pause=new Int32Array(new SharedArrayBuffer(4));
 const renderer={
  uploadBuffer(_id,_offset,bytes){assert.ok(bytes.every(v=>v===(frame&255)),`corrupt snapshot in frame ${frame}`);uploads++;},
  applyState(delta){assert.equal(delta.vsF[0][1][0],frame);constants++;},
  present(){},
 };
 port.on('message',data=>{
  if(data.type==='sync'){sync=new Int32Array(data.sync);return;}
  // Force the producer to lap its three slots while the consumer has pending work.
  if(presents<30)Atomics.wait(pause,0,0,1);
  for(const op of data.ops){if(op.o==='begin'){frame=op.frame;continue;}applyOp(renderer,op,op.b===undefined?null:data.blobs[op.b]);}
  if(data.present){Atomics.add(sync,1,1);Atomics.notify(sync,1);presents++;}
  if(presents===frames){assert.equal(uploads,frames);assert.equal(constants,frames);parentPort.postMessage({presents,uploads,constants});port.close();}
 });
}else{
 const {port1,port2}=new MessageChannel();
 const worker=new Worker(new URL(import.meta.url),{workerData:{port:port1},transferList:[port1]});
 const done=new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.once('exit',code=>{if(code)reject(Error(`consumer exit ${code}`));});});
 const backend=new WorkerBackend(port2,{blobArenaBytes:128}),bytes=new Uint8Array(new SharedArrayBuffer(256));backend.attach({u8:bytes});
 for(let frame=0;frame<frames;frame++){
  backend.emit({o:'begin',frame});bytes.fill(frame&255);backend.uploadBuffer({data:0,object:1},0,64);bytes.fill(255-(frame&255));
  const packed=backend.combineBlobs([new Float32Array([frame,1,2,3])]);backend.emit({o:'st',d:{cf:[[0,0,1]]}},packed);
  if(frame%7===0)backend.flush();
  backend.emit({o:'present',bb:1,html:[]});backend.flush();
 }
 assert.deepEqual(await done,{presents:frames,uploads:frames,constants:frames});port2.close();
 console.log('PASS real-worker arena snapshots, acknowledgement/recycling and non-present batches across 1000 frames');
}
