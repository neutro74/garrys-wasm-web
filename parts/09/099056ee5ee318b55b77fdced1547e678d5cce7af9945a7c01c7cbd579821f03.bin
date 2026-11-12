export const AUDIO_FRAMES=262144;
export const createAudioRing=()=>new SharedArrayBuffer(64+AUDIO_FRAMES*8+4096);
export function installWaveOut(S){
  const traced=new Map();
  const def=(name,arity,fn)=>S['winmm.dll!'+name]={arity,pop:arity*4,fn:function(...args){const result=fn.apply(this,args),count=traced.get(name)??0;if(count<3){traced.set(name,count+1);this.g.log?.(`[audio-call] ${name}(${args.map(a=>(a>>>0).toString(16)).join(',')}) => ${result}`);}return result;}};
  const device=g=>g.waveDevice;
  const notify=(g,d,msg,header=0)=>{
    const type=d.flags&0x70000;
    if(type===0x30000&&d.callback){const dll=[...g.dlls.values()].find(x=>d.callback>=x.meta.base&&d.callback<x.meta.base+x.meta.size);if(!dll)throw Error('waveOut callback outside guest DLLs');g.call(dll,d.callback,[d.handle,msg,d.instance,header,0]);}
    if(type===0x50000&&d.callback)g.sharedEvents?.signal(d.callback,1);
    if(type===0x10000&&d.callback)S['user32.dll!PostMessageW']?.fn.call({g},d.callback,msg,d.handle,header);
  };
  const finish=(g,d,h)=>{for(const part of h.parts??[h]){g.u32(part.p+16,(g.u32(part.p+16)&~16)|1);notify(g,d,0x3bd,part.p);}};
  const pump=g=>{
    const d=device(g);if(!d||d.pumping)return;d.pumping=true;
    try{
      const read=Atomics.load(d.ctl,0)>>>0;
      while(d.pending.length&&d.pending[0].end!==undefined&&((read-d.pending[0].end)|0)>=0)finish(g,d,d.pending.shift());
      for(const h of d.pending){
        do {
        if(h.end!==undefined)continue;
        let w=Atomics.load(d.ctl,1)>>>0,r=Atomics.load(d.ctl,0)>>>0;
        const count=Math.min(h.frames-h.sent,Math.max(0,4096-((w-r)>>>0)));
        for(let i=0;i<count;i++)for(let c=0;c<2;c++){
          let frame=h.sent+i,part=h;
          if(h.parts)for(const candidate of h.parts){if(frame<candidate.frames){part=candidate;break;}frame-=candidate.frames;}
          const at=part.data+frame*d.align+Math.min(c,d.channels-1)*(d.bits/8);
          let sample;
          if(d.format===3)sample=g.dv.getFloat32(at,true);
          else if(d.bits===8)sample=(g.u8[at]-128)/128;
          else if(d.bits===16)sample=g.dv.getInt16(at,true)/32768;
          else if(d.bits===24)sample=((g.u8[at]|g.u8[at+1]<<8|g.u8[at+2]<<16)<<8>>8)/8388608;
          else sample=g.dv.getInt32(at,true)/2147483648;
          d.pcm[((w+i)&(AUDIO_FRAMES-1))*2+c]=Number.isFinite(sample)?Math.max(-1,Math.min(1,sample)):0;
        }
        h.sent+=count;w=(w+count)>>>0;Atomics.store(d.ctl,1,w);
        if(h.sent===h.frames){
          if(h.remaining>1){h.remaining--;h.sent=0;if(count)continue;else break;}
          h.end=w;
          for(const part of h.parts??[h]){
          const write=Atomics.load(d.ctl,9)>>>0,read=Atomics.load(d.ctl,8)>>>0;
          if(((write-read)>>>0)>=512)throw Error('audio completion queue overflow');
          const completions=new Uint32Array(g.audioRing,64+AUDIO_FRAMES*8,1024),at=(write&511)*2;
          completions[at]=part.p;completions[at+1]=w;Atomics.store(d.ctl,9,(write+1)>>>0);
          }
        }else break;
        } while(h.end===undefined);
        if(h.end===undefined)break;
      }
    }finally{d.pumping=false;}
  };
  def('waveOutGetNumDevs',0,function(){return this.g.audioRing?1:0;});
  def('waveOutOpen',6,function(out,id,format,callback,instance,flags){
    const g=this.g;if(!g.audioRing)return 2;
    const tag=g.dv.getUint16(format,true),channels=g.dv.getUint16(format+2,true),rate=g.u32(format+4),align=g.dv.getUint16(format+12,true),bits=g.dv.getUint16(format+14,true);
    if(![1,3].includes(tag)||![1,2].includes(channels)||rate<8000||rate>192000||![8,16,24,32].includes(bits)||align!==channels*bits/8||tag===3&&bits!==32)return 32;
    if(flags&1)return 0;if(g.waveDevice)return 4;
    const ctl=new Int32Array(g.audioRing,0,16);ctl.fill(0);Atomics.store(ctl,5,-1);Atomics.store(ctl,2,rate);Atomics.store(ctl,3,channels);
    const d=g.waveDevice={handle:0x7ff19000,format:tag,channels,rate,align,bits,callback,instance,flags,ctl,pcm:new Float32Array(g.audioRing,64,AUDIO_FRAMES*2),pending:[],base:0};
    g.u32(out,d.handle);g.audioPump=()=>pump(g);g.log?.(`[audio] waveOut ${rate}Hz ${channels}ch ${bits}bit flags=0x${flags.toString(16)}`);notify(g,d,0x3bb);return 0;
  });
  def('waveOutPrepareHeader',3,function(h,p,size){if(device(this.g)?.handle!==h)return 5;if(size<32)return 11;this.g.u32(p+16,(this.g.u32(p+16)|2)&~1);return 0;});
  def('waveOutUnprepareHeader',3,function(h,p){if(device(this.g)?.handle!==h)return 5;if(this.g.u32(p+16)&16)return 33;this.g.u32(p+16,this.g.u32(p+16)&~2);return 0;});
  def('waveOutWrite',3,function(h,p,size){const g=this.g,d=device(g);if(d?.handle!==h)return 5;if(size<32||!(g.u32(p+16)&2))return 34;if(g.u32(p+16)&16)return 33;
    if((d.tracedWrites??0)<3){d.tracedWrites=(d.tracedWrites??0)+1;g.log?.(`[audio] write flags=${g.u32(p+16)} bytes=${g.u32(p+4)}`);}
    const length=g.u32(p+4),data=g.u32(p);if(length%d.align||data+length>g.u8.length)return 11;
    g.u32(p+16,(g.u32(p+16)|16)&~1);const header={p,data,frames:length/d.align,sent:0,remaining:1};
    if(g.u32(p+16)&4){if(d.collect)return 11;d.collect=[];d.loopCount=Math.max(1,g.u32(p+20));}
    if(d.collect){d.collect.push(header);if(g.u32(p+16)&8){const parts=d.collect;d.collect=null;d.pending.push({...parts[0],parts,frames:parts.reduce((n,h)=>n+h.frames,0),remaining:d.loopCount});}}
    else d.pending.push(header);
    pump(g);return 0;});
  def('waveOutGetPosition',3,function(h,p,size){const g=this.g,d=device(g);if(d?.handle!==h)return 5;if(size<12)return 11;pump(g);const frames=((Atomics.load(d.ctl,0)>>>0)-d.base)>>>0,type=g.u32(p);if(type===1)g.u32(p+4,Math.floor(frames*1000/d.rate));else if(type===2)g.u32(p+4,frames);else{g.u32(p,4);g.u32(p+4,frames*d.align);}return 0;});
  def('waveOutReset',1,function(h){const g=this.g,d=device(g);if(d?.handle!==h)return 5;Atomics.store(d.ctl,4,1);while(Atomics.load(d.ctl,11))Atomics.wait(d.ctl,11,1,10);const w=Atomics.load(d.ctl,1);Atomics.store(d.ctl,0,w);d.base=w>>>0;Atomics.store(d.ctl,8,Atomics.load(d.ctl,9));for(const header of [...d.pending.splice(0),...(d.collect??[])])finish(g,d,header);d.collect=null;Atomics.store(d.ctl,4,0);return 0;});
  for(const [name,value] of [['waveOutPause',1],['waveOutRestart',0]])def(name,1,function(h){const d=device(this.g);if(d?.handle!==h)return 5;if((d.tracedTransitions??0)<4){d.tracedTransitions=(d.tracedTransitions??0)+1;g.log?.(`[audio] ${name}`);}Atomics.store(d.ctl,4,value);return 0;});
  def('waveOutClose',1,function(h){const g=this.g,d=device(g);if(d?.handle!==h)return 5;pump(g);if(d.pending.length)return 33;notify(g,d,0x3bc);g.waveDevice=null;return 0;});
  def('waveOutSetVolume',2,function(h,v){const d=device(this.g);if(d?.handle!==h)return 5;d.volume=v;Atomics.store(d.ctl,5,v);return 0;});
  def('waveOutGetVolume',2,function(h,p){const d=device(this.g);if(d?.handle!==h)return 5;this.g.u32(p,d.volume??0xffffffff);return 0;});
}
