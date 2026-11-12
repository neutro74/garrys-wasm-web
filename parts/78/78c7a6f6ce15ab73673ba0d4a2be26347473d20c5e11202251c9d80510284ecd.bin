// Fast, explicitly opted-in host callbacks. Wasm reads the CPU globals and performs
// stdcall cleanup; JS receives plain integers. Unregistered callbacks retain the
// complete generic path. Callback implementations must return i32 and must not
// change CPU globals or re-enter the guest. D3D9's host methods satisfy this contract.
const u=n=>{const out=[];do{const b=n&127;n>>>=7;out.push(b|(n?128:0));}while(n);return out;};
const str=s=>{const b=new TextEncoder().encode(s);return [...u(b.length),...b];};
const vec=a=>[...u(a.length),...a.flat()];
const sec=(id,a)=>[id,...u(a.length),...a];
const compiled=new Map();
function bytes(shared){
 // globals esp=0,eax=1,ecx=2,ret=3,base=4,tls=5,thread=6,capacity=7
 // functions slow=0,invoke=1,now=2,call=3; locals id=0,esp=1,descriptor=2,index=3
 const local=n=>[0x20,n], global=n=>[0x23,n], constant=n=>[0x41,...u(n)];
 const slowReturn=[...local(0),0x10,0,0x0f];
 const cleanup=pop=>[...local(1),0x28,2,0,0x24,3,...local(1),...constant(pop+4),0x6a,0x24,0,0x0f];
 const slotAddress=[...global(5),...constant(16),0x6a,...local(3),...constant(2),0x74,0x6a];
 const tlsIndex=[...local(1),0x28,2,4,0x21,3,...local(3),...global(7),0x4f,0x04,0x40,...slowReturn,0x0b];
 const kind=n=>[...local(2),...constant(16),0x76,...constant(n),0x46,0x04,0x40];
 const body=[1,3,0x7f,
  ...global(8),0x04,0x40,...global(8),...(shared?[0xfe,0x10,2,0]:[0x28,2,0]),
    0x04,0x40,...slowReturn,0x0b,0x0b,
  ...global(4),...local(0),...constant(2),0x74,0x6a,0x28,2,0,0x22,2,0x45,
  0x04,0x40,...slowReturn,0x0b,
  ...global(0),0x21,1,
  ...kind(1),...tlsIndex,...slotAddress,0x28,2,0,0x24,1,...cleanup(4),0x0b,
  ...kind(2),...tlsIndex,
    ...slotAddress,...local(1),0x28,2,8,0x36,2,0,
    ...local(3),...global(5),0x28,2,0,0x4f,0x04,0x40,
      ...global(5),...local(3),...constant(1),0x6a,0x36,2,0,0x0b,
    ...constant(1),0x24,1,...cleanup(8),0x0b,
  ...kind(3),...global(6),0x24,1,...cleanup(0),0x0b,
  ...kind(4),...local(1),0x28,2,4,0x42,...u(1000000000),0x37,3,0,
    ...constant(1),0x24,1,...cleanup(4),0x0b,
  ...kind(5),...local(1),0x28,2,4,0x10,2,0x44,...new Uint8Array(new Float64Array([1000000]).buffer),0xa2,0xb1,0x37,3,0,
    ...constant(1),0x24,1,...cleanup(4),0x0b,
  ...kind(6),...global(5),0x28,2,4,0x24,1,...cleanup(0),0x0b,
  ...kind(7),...global(5),...local(1),0x28,2,4,0x36,2,4,...cleanup(4),0x0b,
  ...local(0),...local(1),...global(2),0x10,1,0x24,1,
  ...local(1),0x28,2,0,0x24,3,
  ...local(1),...local(2),...constant(65535),0x71,0x6a,...constant(3),0x6a,0x24,0,
  0x0b];
 return new Uint8Array([0,97,115,109,1,0,0,0,
  ...sec(1,vec([[0x60,1,0x7f,0],[0x60,3,0x7f,0x7f,0x7f,1,0x7f],[0x60,0,1,0x7c]])),
  ...sec(2,vec([
   [...str('r'),...str('mem'),2,shared?3:1,0,...u(65536)],
   ...['esp','eax','ecx','ret'].map(k=>[...str('r'),...str(k),3,0x7f,1]),
   ...['base','tlsBase','threadId','tlsCapacity','suspendCell'].map(k=>[...str('r'),...str(k),3,0x7f,0]),
   [...str('r'),...str('slow'),0,0],
   [...str('r'),...str('invoke'),0,1],
   [...str('r'),...str('now'),0,2],
  ])),
  ...sec(3,vec([[0]])),...sec(7,vec([[...str('call'),0,3]])),
  ...sec(10,vec([[...u(body.length),...body]])),
 ]);
}
export class HostcallBridge {
 constructor({memory,cpu,base,slots,slow,invoke,tlsBase=0,threadId=1,tlsCapacity=0,suspendCell=0,now=()=>performance.now()}){
  const shared=memory.buffer instanceof SharedArrayBuffer;
  if(!compiled.has(shared))compiled.set(shared,new WebAssembly.Module(bytes(shared)));
  this.memory=memory;this.base=base;this.slots=slots;
  this.call=new WebAssembly.Instance(compiled.get(shared),{r:{mem:memory,...cpu,base,slow,invoke,tlsBase,threadId,tlsCapacity,suspendCell,now}}).exports.call;
 }
 enable(id,pop){
  if(!Number.isInteger(id)||id<0||id>=this.slots)throw Error('hostcall bridge slot out of range');
  if(!Number.isInteger(pop)||pop<0||pop>0xffff)throw Error('invalid hostcall stack cleanup');
  new DataView(this.memory.buffer).setUint32(this.base+id*4,pop+1,true);
 }
 enableNative(id,name){
  const native={TlsGetValue:[1,4],FlsGetValue:[1,4],TlsSetValue:[2,8],FlsSetValue:[2,8],GetCurrentThreadId:[3,0],QueryPerformanceFrequency:[4,4],QueryPerformanceCounter:[5,4],GetLastError:[6,0],SetLastError:[7,4]}[name];
  if(!native)return false;
  this.enable(id,native[1]);
  new DataView(this.memory.buffer).setUint32(this.base+id*4,(native[0]<<16)|(native[1]+1),true);
  return true;
 }
 disable(id){new DataView(this.memory.buffer).setUint32(this.base+id*4,0,true);}
}

// The first DLL defines the CPU globals, so its imports need a relay until those
// globals exist. After instantiation the table points at the bridge's Wasm export.
let relayModule;
export class HostcallRelay {
 constructor(slow){
  relayModule??=new WebAssembly.Module(new Uint8Array([0,97,115,109,1,0,0,0,
   ...sec(1,vec([[0x60,1,0x7f,0]])),
   ...sec(2,vec([[...str('r'),...str('tbl'),1,0x70,0,1],[...str('r'),...str('slow'),0,0]])),
   ...sec(3,vec([[0],[0]])),
   ...sec(7,vec([[...str('call'),0,1],[...str('fallback'),0,2]])),
   ...sec(10,vec([[9,0,0x20,0,0x41,0,0x13,0,0,0x0b],[6,0,0x20,0,0x10,0,0x0b]])),
  ]));
  this.table=new WebAssembly.Table({initial:1,element:'anyfunc'});
  const ex=new WebAssembly.Instance(relayModule,{r:{tbl:this.table,slow}}).exports;
  this.call=ex.call;this.table.set(0,ex.fallback);
 }
 set(fn){this.table.set(0,fn);}
}
