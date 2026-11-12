// Initialize the staged core's optional native dispatch lookup. Every worker owns
// its globals and allocation; the map contains immutable function-table slots.
export function initializeCoreDispatch(g, ex, map) {
  if(!ex.core_dispatch_base || !map?.length)return 0;
  let bits=4;while(2**bits<map.length)bits++;
  const bytes=2**bits*8,base=g.alloc(bytes),words=new Uint32Array(g.mem.buffer,base,bytes/4),mask=2**bits-1;
  for(let i=0;i<map.length;i+=2){
    const a=map[i]>>>0;if(!a)continue;
    let h=Math.imul(a,0x9e3779b1) >>> (32-bits);
    while(words[h*2]){if(words[h*2]===a)throw Error('duplicate dispatch address');h=(h+1)&mask;}
    words[h*2]=a;words[h*2+1]=map[i+1];
  }
  ex.core_dispatch_shift.value=32-bits;ex.core_dispatch_mask.value=mask;
  // Publish last; an uninitialized core always retains its original dispatcher.
  ex.core_dispatch_base.value=base;
  if(g.attachedThread)g.threadAllocations.push(base);
  return base;
}
