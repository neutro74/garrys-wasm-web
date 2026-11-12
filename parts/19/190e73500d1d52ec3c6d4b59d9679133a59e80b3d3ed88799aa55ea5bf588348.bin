import assert from 'node:assert/strict';
import {createFs} from './webfs.mjs';
// One storage owner must service both workers; worker-local fds/data lose saves and config.
const owner=createFs({index:{},reader:()=>0}).fs;
const rpc=(method,args)=>owner[method](...args);
const a=createFs({index:{},reader:()=>0,overlayRpc:rpc}).fs;
const b=createFs({index:{},reader:()=>0,overlayRpc:rpc}).fs;
a.mkdirSync('/overlay/garrysmod/save',{recursive:true});
a.writeFileSync('/overlay/garrysmod/save/one.sav',new Uint8Array([1,2,3]));
assert.equal(b.existsSync('/overlay/garrysmod/save/one.sav'),true,'other workers must see created saves');
const fd=a.openSync('/overlay/garrysmod/save/one.sav',a.constants.O_RDWR);
b.writeSync(fd,new Uint8Array([9]),0,1,1);
assert.deepEqual([...a.readFileSync('/overlay/garrysmod/save/one.sav')],[1,9,3]);
b.ftruncateSync(fd,5);a.fsyncSync(fd);b.closeSync(fd);
assert.deepEqual([...a.readFileSync('/overlay/garrysmod/save/one.sav')],[1,9,3,0,0]);
b.unlinkSync('/overlay/garrysmod/save/one.sav');assert.equal(a.existsSync('/overlay/garrysmod/save/one.sav'),false);
console.log('PASS shared writable overlay, cross-worker fds, truncate, deletion');
