// Immutable upload snapshots until the render worker acknowledges the frame.
// Three bounded arenas avoid allocating/transferring a fresh backing store for
// every dynamic vertex/index-buffer upload. Oversized batches use normal copies.
export class RenderBlobArena {
  constructor(sync,{capacity=4<<20,slots=3}={}) {
    if(!Number.isSafeInteger(capacity)||capacity<=0||slots<3)throw Error('invalid render arena layout');
    this.sync=sync;this.capacity=capacity;this.slots=Array.from({length:slots},()=>({bytes:null,sequence:0}));
    this.current=0;this.offset=0;
  }
  reserve(length) {
    const off=Math.ceil(this.offset/4)*4;
    if(off+length>this.capacity)return new Uint8Array(length);
    const slot=this.slots[this.current];
    if(!this.offset)for(;;){
      const done=Atomics.load(this.sync,1);
      if(done>=slot.sequence)break;
      Atomics.wait(this.sync,1,done,50);
    }
    slot.bytes??=new Uint8Array(new SharedArrayBuffer(this.capacity));
    const bytes=slot.bytes.subarray(off,off+length);
    this.offset=off+length;return bytes;
  }
  snapshot(blob) {const bytes=this.reserve(blob.byteLength);bytes.set(blob);return bytes;}
  owns(blob) {for(const slot of this.slots)if(slot.bytes?.buffer===blob.buffer)return true;return false;}
  concatenate(arrays) {
    const bytes=this.reserve(arrays.reduce((n,a)=>n+a.byteLength,0));let offset=0;
    for(const a of arrays){bytes.set(new Uint8Array(a.buffer,a.byteOffset,a.byteLength),offset);offset+=a.byteLength;}
    return bytes;
  }
  presented(sequence) {
    this.slots[this.current].sequence=sequence;
    this.current=(this.current+1)%this.slots.length;this.offset=0;
  }
}
