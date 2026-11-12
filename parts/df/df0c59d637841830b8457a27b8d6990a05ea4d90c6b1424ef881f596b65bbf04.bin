import assert from 'node:assert/strict';
import {HostcallBridge,HostcallRelay} from './hostcall-bridge.mjs';
for(const shared of [false,true]){
 const mem=new WebAssembly.Memory({initial:2,maximum:8,shared});
 const cpu=Object.fromEntries(['esp','eax','ecx','ret'].map(k=>[k,new WebAssembly.Global({value:'i32',mutable:true},0)]));
 const slow=[],calls=[];
 const bridge=new HostcallBridge({memory:mem,cpu,base:0x100,slots:10,slow:id=>slow.push(id),invoke:(id,esp,ecx)=>{calls.push([id,esp,ecx]);return 0x8876086c;}});
 cpu.esp.value=0x1000;cpu.ecx.value=-12;cpu.eax.value=123;
 bridge.call(3);assert.deepEqual(slow,[3]);assert.equal(cpu.esp.value,0x1000);
 new DataView(mem.buffer).setUint32(0x1000,0xabcdef12,true);
 bridge.enable(3,12);bridge.call(3);
 assert.deepEqual(calls,[[3,0x1000,-12]]);
 assert.equal(cpu.eax.value>>>0,0x8876086c);
 assert.equal(cpu.ret.value>>>0,0xabcdef12);
 assert.equal(cpu.esp.value,0x1010);
 assert.equal(cpu.ecx.value,-12);
 mem.grow(1);cpu.esp.value=0x1000;bridge.call(3);assert.equal(cpu.esp.value,0x1010);
 assert.throws(()=>bridge.enable(10,4),/slot/);
 bridge.disable(3);bridge.call(3);assert.deepEqual(slow,[3,3]);
}
console.log('PASS hostcall wasm bridge fallback, registers, stdcall cleanup, shared memory and growth');
// Native TLS paths never call JavaScript, and preserve the bridge's stdcall ABI.
{
 const memory=new WebAssembly.Memory({initial:2,maximum:8,shared:true});
 const cpu=Object.fromEntries(['esp','eax','ecx','ret'].map(k=>[k,new WebAssembly.Global({value:'i32',mutable:true},0)]));
 const slow=[];const b=new HostcallBridge({memory,cpu,base:0x100,slots:10,tlsBase:0x400,tlsCapacity:16,threadId:73,suspendCell:0x300,now:()=>1234.567,slow:id=>slow.push(id),invoke:()=>{throw Error('native call entered JS');}});
 const dv=new DataView(memory.buffer);
 const setup=(...args)=>{cpu.esp.value=0x1000;dv.setUint32(0x1000,0x98765432,true);args.forEach((v,i)=>dv.setUint32(0x1004+i*4,v,true));};
 b.enableNative(1,'TlsSetValue');b.enableNative(2,'TlsGetValue');b.enableNative(3,'GetCurrentThreadId');b.enableNative(4,'QueryPerformanceFrequency');
 setup(7,0xfedcba98);b.call(1);assert.equal(cpu.eax.value,1);assert.equal(cpu.esp.value,0x100c);
 assert.equal(dv.getUint32(0x400,true),8,'native set updates the next TLS allocation index');
 setup(7);b.call(2);assert.equal(cpu.eax.value>>>0,0xfedcba98);assert.equal(cpu.esp.value,0x1008);
 setup(8);b.call(2);assert.equal(cpu.eax.value,0);
 setup();b.call(3);assert.equal(cpu.eax.value,73);assert.equal(cpu.esp.value,0x1004);
 setup(0x2000);b.call(4);assert.equal(dv.getBigUint64(0x2000,true),1000000000n);assert.equal(cpu.eax.value,1);
 b.enableNative(5,'QueryPerformanceCounter');setup(0x2010);b.call(5);assert.equal(dv.getBigUint64(0x2010,true),1234567000n);
 b.enableNative(6,'SetLastError');b.enableNative(7,'GetLastError');
 setup(987);cpu.eax.value=42;b.call(6);assert.equal(cpu.eax.value,42,'void setter preserves eax');
 setup();b.call(7);assert.equal(cpu.eax.value,987);assert.equal(dv.getUint32(0x404,true),987);
 setup(16);b.call(2);assert.deepEqual(slow,[2],'out-of-range TLS retains the fallback');
 dv.setInt32(0x300,1,true);setup();b.call(3);assert.deepEqual(slow,[2,3],'suspended thread goes through the cooperative slow path');
 dv.setInt32(0x300,0,true);setup();b.call(3);assert.equal(cpu.eax.value,73);
}
console.log('PASS native TLS, thread identity and performance frequency without JS transitions');

{
 const hits=[];const r=new HostcallRelay(id=>hits.push(id));r.call(5);
 const memory=new WebAssembly.Memory({initial:2,maximum:8});
 const cpu=Object.fromEntries(['esp','eax','ecx','ret'].map(k=>[k,new WebAssembly.Global({value:'i32',mutable:true},0)]));
 const bridge=new HostcallBridge({memory,cpu,base:0x100,slots:10,threadId:61,slow:id=>hits.push(id),invoke:()=>0});
 bridge.enableNative(2,'GetCurrentThreadId');r.set(bridge.call);
 cpu.esp.value=0x1000;r.call(2);assert.equal(cpu.eax.value,61);assert.deepEqual(hits,[5]);
}
console.log('PASS relay bootstraps the CPU-owning module without JS transitions');
