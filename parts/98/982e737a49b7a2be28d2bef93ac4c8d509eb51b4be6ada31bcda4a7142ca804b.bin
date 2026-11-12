class GameAudio extends AudioWorkletProcessor {
  constructor(options){super();this.ctl=new Int32Array(options.processorOptions.ring,0,16);this.pcm=new Float32Array(options.processorOptions.ring,64,262144*2);this.capacity=this.pcm.length/2;this.fraction=0;this.completions=new Uint32Array(options.processorOptions.ring,64+262144*8,1024);this.port.onmessage=e=>{if(e.data.memory)this.memory=e.data.memory;};}
  process(_inputs,outputs){
    const out=outputs[0],ctl=this.ctl;if(!out?.length||Atomics.load(ctl,4))return true;
    Atomics.store(ctl,11,1);
    if(Atomics.load(ctl,4)){Atomics.store(ctl,11,0);Atomics.notify(ctl,11);return true;}
    let r=Atomics.load(ctl,0)>>>0;const w=Atomics.load(ctl,1)>>>0,rate=Atomics.load(ctl,2)||44100,step=rate/sampleRate,volume=Atomics.load(ctl,5)>>>0;
    let nonzero=0,underrun=0;
    for(let i=0;i<out[0].length;i++){
      const available=(w-r)>>>0;
      if(!available){underrun++;continue;}
      const current=r&(this.capacity-1),next=available>1?(r+1)&(this.capacity-1):current;
      for(let c=0;c<out.length;c++){
        const gain=(c===0?volume&65535:volume>>>16)/65535;
        const v=(this.pcm[current*2+c]*(1-this.fraction)+this.pcm[next*2+c]*this.fraction)*gain;
        out[c][i]=v;if(v!==0)nonzero++;
      }
      this.fraction+=step;const advance=Math.min(available,Math.floor(this.fraction));this.fraction-=advance;r=(r+advance)>>>0;
      if(advance===available)this.fraction=0;
    }
    Atomics.store(ctl,0,r);
    if(this.memory){
      if(this.words?.buffer!==this.memory.buffer)this.words=new Int32Array(this.memory.buffer);
      let read=Atomics.load(ctl,8)>>>0,write=Atomics.load(ctl,9)>>>0;
      while(read!==write){const at=(read&511)*2,end=this.completions[at+1];if(((r-end)|0)<0)break;const header=this.completions[at];Atomics.and(this.words,(header+16)>>>2,~16);Atomics.or(this.words,(header+16)>>>2,1);read=(read+1)>>>0;}
      Atomics.store(ctl,8,read);
    }
    Atomics.add(ctl,6,underrun);Atomics.add(ctl,7,nonzero);Atomics.store(ctl,11,0);Atomics.notify(ctl,11);return true;
  }
}
registerProcessor('gmod-audio',GameAudio);
