import {RPC_BYTES} from '../tools/lift/host/overlay-rpc.mjs';
export async function openStorage(){
 const worker=new Worker(new URL('./storage-worker.js', import.meta.url),{type:'module'}),buffer=new SharedArrayBuffer(RPC_BYTES),pending=new Map();let next=1;
 const ready=new Promise((resolve,reject)=>{worker.onmessage=({data:m})=>{if(m.type==='ready')resolve();else if(m.type==='fatal'){reject(Error(m.error));console.error('Storage:',m.error);}else {const p=pending.get(m.id);pending.delete(m.id);if(p)m.error?p.reject(Error(m.error)):p.resolve(m.result);}};worker.onerror=e=>reject(Error(e.message));});
 worker.postMessage({type:'init',buffer});await ready;
 return {buffer,worker,request(type,options={}){return new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});worker.postMessage({type,id,...options});});}};
}
// A binary backup avoids base64's large memory expansion for saves and cached addons.
export function encodeBackup(entries){const enc=new TextEncoder(),parts=[enc.encode('GWB1')];for(const [p,bytes] of entries){const name=enc.encode(p),head=new Uint32Array([name.length,bytes===null?0xffffffff:bytes.length]);parts.push(head,name);if(bytes)parts.push(bytes);}return new Blob(parts,{type:'application/octet-stream'});}
export function decodeBackup(buffer){const b=new Uint8Array(buffer),dv=new DataView(buffer),dec=new TextDecoder('utf-8',{fatal:true});if(dec.decode(b.subarray(0,4))!=='GWB1')throw Error('Invalid backup');let p=4;const entries=[];while(p<b.length){if(p+8>b.length)throw Error('Truncated backup');const n=dv.getUint32(p,true),len=dv.getUint32(p+4,true);p+=8;if(!n||p+n>b.length)throw Error('Invalid backup path');const name=dec.decode(b.subarray(p,p+n));p+=n;if(len===0xffffffff)entries.push([name,null]);else{if(p+len>b.length)throw Error('Truncated backup');entries.push([name,b.slice(p,p+len)]);p+=len;}if(entries.length>100000)throw Error('Backup has too many files');}return entries;}

// Requests from GMod's own menu pages (web/menu-extras.js, injected by html-panels.js): addon install/removal and
// save import/export, so these live in the game's UI rather than over it.
export function menuHost(storage,p2p){
 const download=(blob,name)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);};
 return async(op,args)=>{
  switch(op){
   case 'addons':return storage.request('list-addons');
   case 'install-addon':{if(!(args.bytes instanceof ArrayBuffer))throw Error('No file');if(args.bytes.byteLength>256*1024*1024)throw Error('Addon exceeds 256 MB');
    // GMod migrates addons/<name>_<id>.gma to cache/workshop/<id>.gma as an old Workshop download: no underscores.
    const name=String(args.name).toLowerCase().replace(/[^a-z0-9.-]+/g,'-');if(!name.endsWith('.gma'))throw Error('Choose a .gma addon file');
    return storage.request('import-addon',{name,bytes:args.bytes});}
   case 'remove-addon':return storage.request('remove-addon',{name:String(args.name)});
   case 'export-saves':{const entries=await storage.request('saves-export'),count=entries.filter(([p,b])=>b&&p.endsWith('.gms')).length;
    if(!count)throw Error('There are no saves to export');download(encodeBackup(entries),'gmod-saves.gwb');return count;}
   case 'import-saves':{if(!(args.bytes instanceof ArrayBuffer))throw Error('No file');if(args.bytes.byteLength>512*1024*1024)throw Error('Archive exceeds 512 MB');
    return storage.request('saves-import',{entries:decodeBackup(args.bytes)});}
   case 'p2p-status':return p2p?p2p.status():{disabled:true};
   case 'p2p-invite':if(!p2p)throw Error('Peer-to-peer play is not enabled');return p2p.createInvite();
   case 'p2p-finish':if(!p2p)throw Error('Peer-to-peer play is not enabled');await p2p.finishInvite(args.code);return p2p.status();
   case 'p2p-accept':if(!p2p)throw Error('Peer-to-peer play is not enabled');return p2p.acceptInvite(args.code);
   case 'p2p-leave':if(!p2p)throw Error('Peer-to-peer play is not enabled');p2p.leave();return p2p.status();
   default:throw Error(`Unknown request ${op}`);
  }
 };
}
