import assert from 'node:assert/strict';
import {Worker,isMainThread,workerData,parentPort} from 'node:worker_threads';
import {createOverlayRpc,serveOverlayRpc,RPC_BYTES} from './overlay-rpc.mjs';
import {createFs} from './webfs.mjs';
if(!isMainThread){const {fs}=createFs({index:{},reader:()=>0});setInterval(()=>{},1000);serveOverlayRpc(workerData,fs);parentPort.postMessage('ready');}
else {
 const sab=new SharedArrayBuffer(RPC_BYTES),w=new Worker(new URL(import.meta.url),{workerData:sab});await new Promise(r=>w.once('message',r));
 try {
 const fs=createFs({index:{},reader:()=>0,overlayRpc:createOverlayRpc(sab)}).fs;
 fs.mkdirSync('/overlay/save',{recursive:true});const bytes=Uint8Array.from({length:2500000},(_,i)=>i%251);
 fs.writeFileSync('/overlay/save/test.sav',bytes);assert.deepEqual(fs.readFileSync('/overlay/save/test.sav'),bytes);
 const second=createFs({index:{},reader:()=>0,overlayRpc:createOverlayRpc(sab)}).fs;
 assert.equal(second.statSync('/overlay/save/test.sav').size,2500000);second.unlinkSync('/overlay/save/test.sav');assert.equal(fs.existsSync('/overlay/save/test.sav'),false);
 assert.throws(()=>fs.statSync('/overlay/missing'),{code:'ENOENT'});
 console.log('PASS real storage worker mailbox, multi-chunk bytes, shared files and errors');
 }finally {await w.terminate();}
}
