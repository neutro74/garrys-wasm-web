// A single synchronous mailbox serializes filesystem operations across guest workers.
// The owner waits asynchronously, so OPFS commits and UI management can still run.
const HEADER=64, META=256*1024;
export const RPC_BYTES=HEADER+META+1024*1024;
export function createOverlayRpc(buffer) {
  const ctl=new Int32Array(buffer,0,16),meta=new Uint8Array(buffer,HEADER,META),data=new Uint8Array(buffer,HEADER+META);
  const enc=new TextEncoder(),dec=new TextDecoder();
  function call(method,args,bytes,destination) {
    while(Atomics.compareExchange(ctl,0,0,1)!==0)Atomics.wait(ctl,0,1,1000);
    try {
      const request=enc.encode(JSON.stringify({method,args}));if(request.length>META)throw Error('Filesystem request too large');
      meta.set(request);ctl[2]=request.length;if(bytes)data.set(bytes);
      Atomics.store(ctl,1,1);Atomics.notify(ctl,1);
      const deadline=Date.now()+60000;
      while(Atomics.load(ctl,1)===1){Atomics.wait(ctl,1,1,1000);if(Date.now()>deadline)throw Error('Storage worker did not respond');}
      const result=JSON.parse(dec.decode(meta.slice(0,ctl[2])));
      if(result.error)throw Object.assign(Error(result.error),{code:result.code});
      if(destination)destination.set(data.subarray(0,result.value));
      return result.value;
    } finally {Atomics.store(ctl,0,0);Atomics.notify(ctl,0);}
  }
  const rpc=(method,args)=>{
    if(method==='readSync'||method==='writeSync') {
      const [fd,buffer,offset,length,position]=args;let done=0;
      // Hold a separate JS copy of response data before yielding the mailbox lock.
      // readSync copies its bytes inside call's critical section below via destination.
      while(done<length){const count=Math.min(length-done,data.length);
        if(method==='writeSync')done+=call(method,[fd,count,position+done],buffer.subarray(offset+done,offset+done+count));
        else {const n=call(method,[fd,count,position+done],null,buffer.subarray(offset+done,offset+done+count));done+=n;if(n<count)break;}
      }
      return done;
    }
    return call(method,args);
  };
  // Bumped by the storage worker for every operation that can change metadata, so workers can cache lookups.
  rpc.generation=()=>Atomics.load(ctl,3);
  return rpc;
}
const MUTATING=new Set(['mkdirSync','writeSync','ftruncateSync','closeSync','fsyncSync','unlinkSync','rmSync']);

export async function serveOverlayRpc(buffer,fs,commit=async()=>{}) {
  const ctl=new Int32Array(buffer,0,16),meta=new Uint8Array(buffer,HEADER,META),data=new Uint8Array(buffer,HEADER+META);
  const enc=new TextEncoder(),dec=new TextDecoder();
  while(true) {
    const state=Atomics.load(ctl,1);
    if(state!==1){await Atomics.waitAsync(ctl,1,state).value;continue;}
    let result;
    try {
      const {method,args}=JSON.parse(dec.decode(meta.slice(0,ctl[2])));let value;
      if(method==='readSync') {const [fd,len,pos]=args;value=fs.readSync(fd,data,0,len,pos);}
      else if(method==='writeSync'){const [fd,len,pos]=args;value=fs.writeSync(fd,data,0,len,pos);}
      else {if(!['existsSync','statSync','realpathSync','readdirSync','mkdirSync','openSync','closeSync','fstatSync','ftruncateSync','fsyncSync','unlinkSync','rmSync'].includes(method))throw Error('Unknown filesystem operation');value=fs[method](...args);}
      if(['closeSync','fsyncSync','unlinkSync','rmSync','mkdirSync'].includes(method))await commit();
      result={value};
    }catch(e){result={error:e.message,code:e.code};}
    {const {method,args}=JSON.parse(dec.decode(meta.slice(0,ctl[2])));
      if(MUTATING.has(method)||method==='openSync'&&args[1]!=='r'&&args[1]!==undefined&&args[1]!==0)Atomics.add(ctl,3,1);}
    const bytes=enc.encode(JSON.stringify(result));
    if(bytes.length>META){const e=enc.encode(JSON.stringify({error:'Filesystem response too large',code:'EOVERFLOW'}));meta.set(e);ctl[2]=e.length;}else {meta.set(bytes);ctl[2]=bytes.length;}
    Atomics.store(ctl,1,2);Atomics.notify(ctl,1);

  }
}
