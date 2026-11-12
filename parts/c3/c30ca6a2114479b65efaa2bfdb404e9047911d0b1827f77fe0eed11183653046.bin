// Owns all writable file identities and persists closed/flushed files in this origin's OPFS.
import {createFs,seedOverlay,path} from '../tools/lift/host/webfs.mjs';
import {serveOverlayRpc} from '../tools/lift/host/overlay-rpc.mjs';
import {readGma,addonPath} from '../ports/gmod/compat/addons.mjs';
let volume,store,root,ctl;const dirty=new Map();
// Writes made here (not through the RPC) must still invalidate the guests' cached metadata (overlay-rpc.mjs ctl[3]).
const changed=()=>{if(ctl)Atomics.add(ctl,3,1);};
const SAVES='/overlay/garrysmod/saves';
const persistent=p=>p==='/overlay'||p.startsWith('/overlay/')||p==='/overlay.whiteouts'||p.startsWith('/overlay.whiteouts/');
async function parent(p,create=false){const parts=p.split('/').filter(Boolean),name=parts.pop();let dir=root;for(const part of parts)dir=await dir.getDirectoryHandle(part,{create});return {dir,name};}
async function load(dir,p=''){
 const entries=[];
 for await(const [name,h] of dir.entries()){
  const key=p+'/'+name;
  if(h.kind==='directory'){entries.push([key,null]);entries.push(...await load(h,key));}
  else entries.push([key,new Uint8Array(await(await h.getFile()).arrayBuffer())]);
 }
 return entries;
}
// Commits run one at a time: a caller must not return while an earlier commit is still writing its files.
let committing=Promise.resolve();
function commit(){const run=committing.then(writeDirty);committing=run.catch(()=>{});return run;}
async function writeDirty(){
 while(dirty.size){const batch=[...dirty];dirty.clear();
  for(let i=0;i<batch.length;i++){
   const [p,n]=batch[i];try{
    if(!persistent(p))continue;
    if(n===null){try{const {dir,name}=await parent(p);await dir.removeEntry(name,{recursive:true});}catch(e){if(e.name!=='NotFoundError')throw e;}}
    else {const {dir,name}=await parent(p,true);if(n.dir)await dir.getDirectoryHandle(name,{create:true});else {const h=await dir.getFileHandle(name,{create:true}),w=await h.createWritable();try{await w.write(n.data.slice(0,n.size));await w.close();}catch(e){await w.abort().catch(()=>{});throw e;}}}
   }catch(e){for(const [key,node] of batch.slice(i))if(!dirty.has(key))dirty.set(key,node);throw e;}
  }
 }
}
function snapshot(n=store.root,p='',out=[]){for(const [name,c] of n.children??[]){const key=p+'/'+name;if(c.dir){if(persistent(key))out.push([key,null]);snapshot(c,key,out);}else if(persistent(key))out.push([key,c.data.slice(0,c.size)]);}return out;}
function safePath(p){if(typeof p!=='string'||!persistent(p)||p.split('/').some(c=>c==='..'||c==='.')||p.includes('\\')||p.includes('\0'))throw Error('Invalid backup path');return p;}
self.onmessage=async({data:m})=>{
 try {
  if(m.type==='init'){
   ctl=new Int32Array(m.buffer,0,16);root=await(await navigator.storage.getDirectory()).getDirectoryHandle('garrys-wasm',{create:true});
   const mounted=createFs({index:{},reader:()=>0,onChange:(p,n)=>{if(persistent(p))dirty.set(p,n);}});volume=mounted.fs;store=mounted.overlay;
   seedOverlay(store,await load(root));
   postMessage({type:'ready'});serveOverlayRpc(m.buffer,volume,commit).catch(e=>postMessage({type:'fatal',error:e.message}));return;
  }
  let result;
  if(m.type==='preferences')result={saved:volume.existsSync('/overlay/garrysmod/cfg/video.txt') || volume.existsSync('/overlay/garrysmod/cfg/config.cfg')};
  else if(m.type==='list')result=volume.existsSync('/overlay/garrysmod/addons')?volume.readdirSync('/overlay/garrysmod/addons'):[];
  else if(m.type==='list-addons'){
   // Installed .gma files with their titles (for the in-game Addons page).
   const dir='/overlay/garrysmod/addons';result=[];
   if(volume.existsSync(dir))for(const file of volume.readdirSync(dir)){if(!file.endsWith('.gma'))continue;const bytes=volume.readFileSync(dir+'/'+file);let title=file;try{title=readGma(bytes,{strictArchiveCrc:false}).name||file;}catch{}result.push({file,title,size:bytes.length});}
  }
  else if(m.type==='import-addon'){
   const name=addonPath(m.name);if(name.includes('/')||!name.endsWith('.gma'))throw Error('Choose a .gma addon');
   const bytes=new Uint8Array(m.bytes);readGma(bytes);volume.mkdirSync('/overlay/garrysmod/addons',{recursive:true});volume.writeFileSync('/overlay/garrysmod/addons/'+name,bytes);changed();await commit();result=name;
  }else if(m.type==='remove-addon'){
   const name=addonPath(m.name);if(name.includes('/'))throw Error('Invalid addon name');volume.rmSync('/overlay/garrysmod/addons/'+name,{recursive:true,force:true});changed();await commit();
  }else if(m.type==='export'){await commit();result=snapshot();}
  else if(m.type==='restore'){
   // Validate the entire archive before writing any part of it. Merge preserves unrelated saves.
   if(!Array.isArray(m.entries)||m.entries.length>100000)throw Error('Invalid backup');
   for(const [p,bytes] of m.entries){safePath(p);if(bytes!==null&&!(bytes instanceof Uint8Array))throw Error('Invalid backup data');}
   for(const [p,bytes] of m.entries){if(bytes===null)volume.mkdirSync(p,{recursive:true});else {volume.mkdirSync(path.dirname(p),{recursive:true});volume.writeFileSync(p,bytes);}}
   changed();await commit();result=m.entries.length;
  }else if(m.type==='saves-export'){await commit();result=snapshot().filter(([p])=>p===SAVES||p.startsWith(SAVES+'/'));}
  else if(m.type==='saves-import'){
   // Only files under garrysmod/saves; everything is validated before anything is written.
   if(!Array.isArray(m.entries)||m.entries.length>100000)throw Error('Invalid save archive');
   for(const [p,bytes] of m.entries){safePath(p);if(!(p===SAVES||p.startsWith(SAVES+'/')))throw Error('Archive contains files outside saves/');if(bytes!==null&&!(bytes instanceof Uint8Array))throw Error('Invalid save data');}
   for(const [p,bytes] of m.entries){if(bytes===null)volume.mkdirSync(p,{recursive:true});else {volume.mkdirSync(path.dirname(p),{recursive:true});volume.writeFileSync(p,bytes);}}
   changed();await commit();result=m.entries.filter(([p,b])=>b!==null&&p.endsWith('.gms')).length;
  }else throw Error('Unknown storage request');
  postMessage({id:m.id,result});
 }catch(e){postMessage({id:m.id,type:m.type==='init'?'fatal':undefined,error:e.message});}
};
