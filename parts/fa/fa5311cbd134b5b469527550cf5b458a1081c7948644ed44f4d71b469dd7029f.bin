// Host runtime for lifted x86 DLLs: guest memory, PE image loading, Win32/tier0 shims, call helpers.
import { ForeignRouter } from './foreign-router.mjs';
import { HostcallBridge, HostcallRelay } from './hostcall-bridge.mjs';
import { fastDispatch } from './fast-dispatch.mjs';
import { initializeCoreDispatch } from './core-dispatch.mjs';
import { env as ENV, readBytes, readJson, compileAsset, compiledModules, isNode, writeStderr, spawnThread, utf8, utf8d } from './platform.mjs';
import { installD3D9 } from './d3d9.mjs';
import { installSteam } from './steam.mjs';
import { SharedHeap } from './shared-heap.mjs';
import { SharedEvents } from './shared-events.mjs';
import { NativeFiles } from './native-files.mjs';
import { installMore } from './win32-more.mjs';
import { installExtra } from './win32-extra.mjs';
import { initGdi, installGdi } from './gdi.mjs';
import { createHtmlHost } from './html.mjs';
import { installD3DX9 } from './d3dx9.mjs';

const TLS_CAPACITY = 4096;
const STACK_TOP = 0x00200000, TEB = 0x1000, HEAP0 = 0x20000000, VALLOC0 = 0x60000000;
// Growable layout (retail process in shared memory): the guest's 4 GiB is only reserved; memory is committed as
// the heap and VirtualAlloc break above the DLL images and thunks moves up. Browsers cap a renderer's committed
// memory (Chromium: 8 GiB of private writable mappings), so committing all 4 GiB up front leaves too little room.
const GROW_BASE = 0x14000000, HEAP_FIRST = 16 << 20, HEADROOM = 64 << 20;
const DEFAULT_PAGES = 65536; // 4 GiB guest address space (wasm32 maximum); retail DLLs occupy ~180 MiB plus ~1 GiB of MEM_RESERVE ranges
const hex8 = (n) => (n >>> 0).toString(16).padStart(8, '0');
const sharedMemoryMode = mem => mem.buffer instanceof SharedArrayBuffer;

export class Guest {
  constructor({ pages = DEFAULT_PAGES, log = () => {}, sharedMemory = false, memory = null, threadId = 1, processData = null, filesRoot = null } = {}) {
    this.attachedThread = !!memory;
    const growable = !memory && sharedMemory && pages * 0x10000 >= 0x30000000;
    this.mem = memory || new WebAssembly.Memory({ initial: growable ? (GROW_BASE + HEAP_FIRST + HEADROOM) / 0x10000 : pages, maximum: pages, shared: sharedMemory });
    sharedMemory = this.mem.buffer instanceof SharedArrayBuffer;
    if (this.attachedThread && !sharedMemory) throw new Error('guest worker requires shared memory');
    this.refreshViews();
    // Shared cells: the growable layout's base (0 = fixed layout) and a counter bumped on every memory.grow.
    const layoutCell = sharedMemory ? new Uint32Array(this.mem.buffer, 0x216c, 1) : null;
    this.epochCell = sharedMemory ? new Int32Array(this.mem.buffer, 0x2170, 1) : null;
    if (layoutCell && !this.attachedThread) layoutCell[0] = growable ? GROW_BASE : 0;
    this.growBase = layoutCell ? layoutCell[0] : 0;
    this.memEpoch = this.epochCell ? Atomics.load(this.epochCell, 0) : 0;
    // Fixed layouts: small test memories are compact; a full non-shared 4 GiB memory puts the heap and
    // VirtualAlloc ranges above every DLL image.
    const compact = this.mem.buffer.byteLength < 0x30000000;
    if (this.growBase) { this.heapBase = this.growBase; this.vallocBase = this.growBase + HEAP_FIRST; }
    else { this.heapBase = compact ? 0x01000000 : HEAP0; this.vallocBase = compact ? this.mem.buffer.byteLength : VALLOC0; }
    this.sharedHeap = sharedMemory ? new SharedHeap(this.mem, { start: this.heapBase, end: this.vallocBase, initialize: !this.attachedThread,
      more: this.growBase ? (n) => this.valloc(0, n) : null }) : null;
    this.sharedEvents = sharedMemory ? new SharedEvents(this.mem, this.sharedHeap) : null;
    this.processState = sharedMemory ? new Int32Array(this.mem.buffer, 0x2040, 70) : null;
    // Dynamic-thunk descriptors (64 bytes x 1024 per DLL slot) followed by one atomic counter per slot.
    this.extraTable = 0; this.extraCounts = null;
    if (sharedMemory) {
      if (!this.attachedThread) { this.extraTable = this.alloc(64 * 1024 * 64 + 256); this.u32(0x2160, this.extraTable); }
      else this.extraTable = this.u32(0x2160);
      this.extraCounts = new Int32Array(this.mem.buffer, this.extraTable + 64 * 1024 * 64, 64);
    }
    if (this.processState && !this.attachedThread) Atomics.store(this.processState, 1, 1);
    this.threadId = threadId;
    this.log = log;
    this.dlls = new Map();
    this.cpu = null; this.cpuOwner = null;
    this.heapTop = this.heapBase; this.heapFree = new Map(); this.allocations = new Map();
    // The virtual-allocation cursor is shared by every guest thread (unsigned 32-bit, so it can pass 2 GiB).
    this.vTopCell = sharedMemory ? new Uint32Array(this.mem.buffer, 0x2164, 1) : null;
    if (this.vTopCell && !this.attachedThread) Atomics.store(this.vTopCell, 0, this.vallocBase);
    else if (!this.vTopCell) this.localVTop = this.vallocBase;
    this.tls = []; this.lastError = 0; this.out = [];
    this.staticTls = [];
    this.regring = []; this.cur = null; this.ring = new Uint32Array(256); this.ringPos = 0;
    this.thunks = [];            // global thunk table: {dll, name, fn, pop}
    this.dataCells = new Map();  // data imports
    this.systemHandles = new Map(processData?.systemHandles || []);
    this.criticalSections = new Map();
    this.srwLocks = new Map();
    this.handles = new Map(); this.namedEvents = new Map(); this.nextHandle = 0x100;
    this.aliasHandles = new Set();
    this.filesRoot = processData?.filesRoot || filesRoot;
    this._files = undefined;     // mounted on first use (see `files`): most guest threads never open a file
    this.findStates = [];
    this.threadAllocations = [];
    if (this.attachedThread) {
      const reserve = n => { const p = this.alloc(n); this.threadAllocations.push(p); return p; };
      const stack = reserve(processData.stackSize || 0x100000);
      this.stackSize = processData.stackSize || 0x100000;
      this.stackTop = stack + this.stackSize;
      this.teb = reserve(0x100); this.tlsArray = reserve(64 * 4); this.fpBase = reserve(64);
      this.cmdline = processData.cmdline; this.envw = processData.envw;
    } else {
      this.stackTop = STACK_TOP; this.stackSize = 0x100000;
      this.teb = TEB; this.tlsArray = 0x1100; this.fpBase = 0x300;
      this.cmdline = this.cstr('gmod.exe -game garrysmod'); this.envw = this.alloc(16);
    }
    this.u32(this.teb + 0x18, this.teb); this.u32(this.teb + 4, this.stackTop);
    this.u32(this.teb + 8, this.stackTop - (processData?.stackSize || 0x100000));
    this.u32(this.teb + 0x2c, this.tlsArray);
    this.dynamicTlsState = this.alloc(16 + TLS_CAPACITY * 4);
    if(this.attachedThread)this.threadAllocations.push(this.dynamicTlsState);
  }
  get lastError(){return this.dynamicTlsState ? this.u32(this.dynamicTlsState+4) : this._earlyLastError||0;}
  set lastError(value){if(this.dynamicTlsState)this.u32(this.dynamicTlsState+4,value);else this._earlyLastError=value;}
  tlsAlloc() {
    const index=this.u32(this.dynamicTlsState);
    this.u32(this.dynamicTlsState,index+1);this.tlsSet(index,0);return index;
  }
  tlsGet(index) {
    return index<TLS_CAPACITY ? this.u32(this.dynamicTlsState+16+index*4) : this.tls[index]||0;
  }
  tlsSet(index,value) {
    if(index<0xffffffff && index>=this.u32(this.dynamicTlsState))this.u32(this.dynamicTlsState,index+1);
    if(index<TLS_CAPACITY)this.u32(this.dynamicTlsState+16+index*4,value);else this.tls[index]=value;
    return 1;
  }
  u32(a, v) { if (v === undefined) return this.dv.getUint32(a, true); this.dv.setUint32(a, v >>> 0, true); }
  i32(a) { return this.dv.getInt32(a, true); }
  f64(a, v) { if (v === undefined) return this.dv.getFloat64(a, true); this.dv.setFloat64(a, v, true); }
  readStr(a, max = 4096) { let s = ''; for (let i = 0; i < max && this.u8[a + i]; i++) s += String.fromCharCode(this.u8[a + i]); return s; }
  cstr(s) { const p = this.alloc(s.length + 1); for (let i = 0; i < s.length; i++) this.u8[p + i] = s.charCodeAt(i); this.u8[p + s.length] = 0; return p; }
  // --- heap (size-class free lists, 16 byte header) ---
  alloc(n) {
    if (this.sharedHeap) return this.sharedHeap.allocate(n);
    n = (Math.max(n, 16) + 15) & ~15;
    const bin = this.heapFree.get(n);
    if (bin && bin.length) { const p = bin.pop(); this.u8.fill(0, p, p + n); this.allocations.set(p, n); return p; }
    const p = this.heapTop + 16; this.heapTop += n + 16; this.u32(p - 8, n);
    if (this.heapTop >= this.vallocBase) throw new Error('guest heap exhausted');
    this.allocations.set(p, n);
    return p;
  }
  free(p) { if (this.sharedHeap) return this.sharedHeap.free(p); if (!p) return; const n = this.allocations.get(p); if (!n) throw new Error(`invalid heap free 0x${p.toString(16)}`); this.allocations.delete(p); (this.heapFree.get(n) || this.heapFree.set(n, []).get(n)).push(p); }
  realloc(p, n) { if (this.sharedHeap) return this.sharedHeap.realloc(p, n); if (!p) return this.alloc(n); const old = this.allocations.get(p); if (!old) throw new Error(`invalid heap realloc 0x${p.toString(16)}`); if (n <= old) return p; const q = this.alloc(n); this.u8.copyWithin(q, p, p + old); this.free(p); return q; }
  allocationSize(p) { if (this.sharedHeap) { try { return this.sharedHeap.size(p); } catch { return 0; } } return this.allocations.get(p) || 0; }
  valloc(addr, size) {
    size = (size + 0xfff) & ~0xfff;
    if (addr && addr >= this.vallocBase && addr + size <= this.vTop) return addr;   // commit inside a prior reservation
    size = (size + 0xffff) & ~0xffff;
    let p;
    if (this.vTopCell) p = Atomics.add(this.vTopCell, 0, size) >>> 0;
    else { p = this.localVTop; this.localVTop = p + size; }
    if (this.growBase && p + size <= 0x100000000) this.ensureMemory(p + size + HEADROOM);
    if (p + size > this.u8.length) throw new Error(`guest virtual memory exhausted (request 0x${size.toString(16)}, top 0x${(p + size).toString(16)}, memory 0x${this.u8.length.toString(16)}, base 0x${this.vallocBase.toString(16)})`);
    return p;
  }

  // Grows memory to cover `end` (plus headroom, so allocations smaller than the headroom always land inside the
  // views other code already holds). Other threads pick up the new size through the epoch cell.
  ensureMemory(end) {
    if (end <= this.u8.length) return;
    this.refreshViews();
    if (end <= this.u8.length) return;
    const want = Math.min(0x100000000, Math.ceil((end + HEADROOM) / 0x10000) * 0x10000);
    try { this.mem.grow((want - this.u8.length) / 0x10000); }
    catch (e) { if (this.mem.buffer.byteLength < Math.min(end, 0x100000000)) throw new Error(`guest memory cannot grow to 0x${end.toString(16)}: ${e.message}`); }
    Atomics.add(this.epochCell, 0, 1);
    this.refreshViews();
  }

  refreshViews() {
    this.u8 = new Uint8Array(this.mem.buffer);
    this.dv = new DataView(this.mem.buffer);
    this.sharedHeap?.refresh(); this.sharedEvents?.refresh();
    if (this.epochCell) this.memEpoch = Atomics.load(this.epochCell, 0);
  }

  get files() {
    if (this._files === undefined) this._files = this.filesRoot ? new NativeFiles(this, this.filesRoot) : null;
    return this._files;
  }

  get vTop() { return this.vTopCell ? Atomics.load(this.vTopCell, 0) >>> 0 : this.localVTop; }

  // --- DLL loading ---
  async load(prefix) {
    const meta = await readJson(prefix + '.json');
    if (!!meta.shared_memory !== (this.mem.buffer instanceof SharedArrayBuffer))
      throw new Error(`shared-memory mode mismatch for ${prefix}`);
    const name = (meta.module_name || prefix.split('/').pop() + '.dll').toLowerCase();
    if (this.dlls.has(name)) throw new Error(`DLL already loaded: ${name}`);
    if (meta.import_cpu && !this.cpu) throw new Error(`load a CPU-owning DLL before ${name}`);
    const end = meta.base + meta.size;
    for (const d of this.dlls.values()) {
      if (meta.base < d.meta.base + d.meta.size && d.meta.base < end)
        throw new Error(`overlapping DLL images: ${name} and ${d.name}`);
    }
    if (this.dlls.size >= 64) throw new Error('DLL slot capacity exhausted');
    if (!this.attachedThread) {
      const img = await readBytes(prefix + '.img');
      this.u8.set(img, meta.base);
    }
    if (meta.tls) {
      if (this.staticTls.length >= 64) throw new Error('static TLS slots exhausted');
      const t = meta.tls;
      const data = this.alloc(t.size + t.zero_fill);
      this.u8.copyWithin(data, t.start, t.start + t.size);
      const index = this.staticTls.length;
      if (this.attachedThread && this.u32(t.index) !== index) throw new Error(`static TLS index mismatch for ${name}`);
      this.staticTls.push(data); this.u32(this.tlsArray + index * 4, data);
      if (!this.attachedThread) this.u32(t.index, index);
    }
    const self = this;
    if (ENV.GUEST_COVER && !this.cover) this.cover = new Set();   // every block address ever executed (trace builds)
    const table = new WebAssembly.Table({ initial: meta.table_size, element: 'anyfunc' });
    // Cross-DLL calls between DLLs sharing the CPU globals stay in wasm (see foreign-router.mjs).
    const slot = this.dlls.size, routed = !ENV.GUEST_FOREIGN_JS && (!this.cpu || meta.import_cpu);
    if (routed) this.router ??= new ForeignRouter();
    const env = {
      mem: this.mem, tbl: table,
      hostcall: (id) => self.hostcall(meta, id),
      trace: (a) => {
        self.ring[self.ringPos & 255] = a;
        if (self.cur) self.regring[self.ringPos & 255] = ['eax','ecx','edx','ebx','esp','ebp','esi','edi'].map((r) => self.cur.ex[r].value >>> 0);
        self.ringPos++;
        if (self.cover) self.cover.add(a);
        if (ENV.GUEST_LOG_RANGE && self.cur) {
          const [lo, hi] = ENV.GUEST_LOG_RANGE.split('-').map((x) => parseInt(x, 16));
          if (a >= lo && a < hi) { const r = self.cur.ex; console.log(`[blk] ${a.toString(16)} eax=${(r.eax.value >>> 0).toString(16)} ecx=${(r.ecx.value >>> 0).toString(16)} ebx=${(r.ebx.value >>> 0).toString(16)} esi=${(r.esi.value >>> 0).toString(16)} edi=${(r.edi.value >>> 0).toString(16)} esp=${(r.esp.value >>> 0).toString(16)} stack=${Array.from({ length: 8 }, (_, k) => self.u32(((r.esp.value >>> 0) - 8 + 4 * k)).toString(16)).join(',')}`); }
        }
        if (ENV.GUEST_WATCH_ENTRY && self.cur && a === parseInt(ENV.GUEST_WATCH_ENTRY, 16)) {
          const esp = self.cur.ex.esp.value >>> 0;
          self.entered = true;
          console.log(`[entry] 0x${a.toString(16)} ret=0x${self.u32(esp).toString(16)} args=${Array.from({ length: 6 }, (_, i) => '0x' + self.u32(esp + 4 + 4 * i).toString(16)).join(' ')} ebx=0x${(self.cur.ex.ebx.value >>> 0).toString(16)}`);
        }
        if (ENV.GUEST_WATCH_VALUE && self.cur && !self.watchHit && (self.entered || !ENV.GUEST_WATCH_ENTRY)) {
          // Report the first block that begins with the watched register holding the watched value.
          const [reg, val] = ENV.GUEST_WATCH_VALUE.split('=');
          if ((self.cur.ex[reg].value >>> 0) === parseInt(val, 16)) {
            self.watchHit = true;
            console.log(`[watch] ${reg}=0x${val} at block 0x${a.toString(16)}; recent: ${self.lastBlocks(24).join(' ')}`);
          }
        }
        if (self.currentThreadControl) self.u32(self.currentThreadControl + 480, a);
        // Diagnostic: abort a runaway guest after a wall-clock deadline.
        if (ENV.GUEST_TRACE_DEADLINE) {
          self.traceStart ||= performance.now();
          if (performance.now() - self.traceStart > Number(ENV.GUEST_TRACE_DEADLINE)) {
            const r = self.cur ? self.cur.ex : null;
            throw new Error(`trace deadline at block 0x${a.toString(16)}; recent blocks: ${self.lastBlocks(16).join(' ')}` +
              (r ? `; esp=0x${(r.esp.value >>> 0).toString(16)} eip-ish target=0x${(r.target.value >>> 0).toString(16)}` : ''));
          }
        }
        // Diagnostic: dump where a long-running guest is spending its time.
        if (ENV.GUEST_TRACE_TOTAL) {
          self.traceAll = (self.traceAll || 0) + 1;
          if (self.traceAll > Number(ENV.GUEST_TRACE_TOTAL))
            throw new Error(`trace total ${self.traceAll}; recent blocks: ${self.lastBlocks(20).join(' ')}`);
        }
        // Diagnostic: find a guest block that repeats without making progress.
        if (ENV.GUEST_LOOP_LIMIT) {
          const limit = Number(ENV.GUEST_LOOP_LIMIT);
          if (self.currentThreadControl) self.u32(self.currentThreadControl + 480, a);
        self.traceTotal = (self.traceTotal || 0) + 1;
          self.tracePer ||= new Map();
          const count = (self.tracePer.get(a) || 0) + 1;
          if (count > limit) {
            const r = self.cur ? self.cur.ex : null;
            throw new Error(`guest block 0x${a.toString(16)} executed ${count} times` +
              (r ? ` (esp=0x${(r.esp.value >>> 0).toString(16)} eax=0x${(r.eax.value >>> 0).toString(16)} ` +
                `ecx=0x${(r.ecx.value >>> 0).toString(16)} edx=0x${(r.edx.value >>> 0).toString(16)} ` +
                `esi=0x${(r.esi.value >>> 0).toString(16)} edi=0x${(r.edi.value >>> 0).toString(16)})` : ''));
          }
          self.tracePer.set(a, count);
          if (self.traceTotal > limit * 40)
            throw new Error(`guest executed ${self.traceTotal} blocks; recent: ${self.lastBlocks(12).join(' ')}`);
        }
      },
      bad_icall: (a) => { const k = '0x' + a.toString(16); throw new Error(meta.unsupported_insns[k] ? `unsupported instruction '${meta.unsupported_insns[k]}' at ${k}` : `call to unlifted/unknown guest address ${k} (${meta.failed[k] || 'not a discovered function'})`); },
      foreign_call: routed ? this.router.route(slot, (a) => self.foreignCall(meta, a >>> 0)) : (a) => self.foreignCall(meta, a >>> 0),
      sin: Math.sin, cos: Math.cos, tan: Math.tan, log2: Math.log2, exp2: (x) => 2 ** x, exp2m1: (x) => 2 ** x - 1,
      // Virtual invariant 1 GHz TSC, on the same monotonic clock as QPC.
      rdtsc: () => BigInt(Math.floor(performance.now() * 1e6)),
      unwind: (expected, actual) => {
        if (ENV.UNWIND_DEBUG) console.log(`[unwind] expected=0x${(expected >>> 0).toString(16)} actual=0x${(actual >>> 0).toString(16)} in ${self.cur?.name}`);
      },
      atan2: Math.atan2, fmod: (a, b) => a % b,
    };
    let bridge = null, bridgeDll = null, relay = null;
    const bridgeEnabled = !ENV.GUEST_HOSTCALL_JS && !ENV.GUEST_DEBUG_REGS && !ENV.GUEST_DEBUG_CWD &&
      !ENV.GUEST_HOSTCALL_HEARTBEAT && !ENV.D3D9_DEBUG && !ENV.GUEST_PROFILE_HOSTCALLS;
    const makeBridge = cpu => {
      const slots = meta.imports.length + (meta.spare_thunks ?? 0);
      const base = this.alloc(Math.max(4, slots * 4));
      if(this.attachedThread)this.threadAllocations.push(base);
      const b = new HostcallBridge({ memory:this.mem, cpu, base, slots,
        tlsBase:this.dynamicTlsState, tlsCapacity:TLS_CAPACITY, threadId:this.threadId,
        suspendCell:this.currentThreadControl ? this.currentThreadControl+504 : 0,
        slow:id=>self.hostcall(meta,id), invoke:(id,esp,ecx)=>self.fastHostcall(bridgeDll,id,esp,ecx) });
      if(!ENV.GUEST_TLS_JS)meta.imports.forEach((imp,id)=>{
        if(imp.dll.toLowerCase()==='kernel32.dll')b.enableNative(id,imp.name);
      });
      return b;
    };
    if(bridgeEnabled){
      if(this.cpu && meta.import_cpu){bridge=makeBridge(this.cpu);env.hostcall=bridge.call;}
      else if(!this.cpu){relay=new HostcallRelay(id=>self.hostcall(meta,id));env.hostcall=relay.call;}
    }
    const dir = prefix.slice(0, prefix.lastIndexOf('/') + 1);
    const core = await WebAssembly.instantiate(await compileAsset(dir + meta.core), { env, cpu: this.cpu });
    if(meta.core_dispatch_hash && ENV.GUEST_CORE_DISPATCH !== '0') initializeCoreDispatch(this,core.exports,meta.dispatch);
    if(relay){bridge=makeBridge(core.exports);relay.set(bridge.call);env.hostcall=bridge.call;}
    // Chunks get the hash-table dispatcher (fast-dispatch.mjs) when the build recorded its address map.
    let fast = null;
    if (meta.dispatch && ENV.GUEST_FAST_DISPATCH) {   // opt-in: measured no faster in gm_construct (2026-11-10)
      try { fast = fastDispatch(meta.dispatch, table, core.exports); } catch (e) { console.warn(`[guest] ${name}: fast dispatch unavailable (${e.message})`); }
    }
    const cpu = fast ? { ...core.exports, icall: fast.icall, dispatch: fast.dispatch } : core.exports;
    for (const name of meta.chunks) await WebAssembly.instantiate(await compileAsset(dir + name), { env, cpu });
    const inst = core;
    const dll = { meta, ex: inst.exports, name, prefix, slot: this.dlls.size };
    dll.hostBridge = bridge; bridgeDll = dll;
    this.dlls.set(dll.name, dll); this.cur = dll;
    if (routed) this.router.add(slot, meta, fast?.icall ?? dll.ex.icall);
    if (!this.cpu) {
      this.cpu = dll.ex; this.cpuOwner = dll;
      if (sharedMemoryMode(this.mem)) { this.cpu.fsbase.value = this.teb; this.cpu.fpbase.value = this.fpBase; }
    }
    dll.extras = [];
    // A later DLL can satisfy imports of an earlier one (including cyclic graphs).
    if (!this.attachedThread) for (const d of this.dlls.values()) this.bindImports(d);
    return dll;
  }

  // MSVC RTTI class name of the C++ object at `obj` (null when it has no readable RTTI).
  rtti(obj) {
    try {
      if (!obj || obj < 0x10000) return null;
      const vt = this.u32(obj), col = this.u32(vt - 4), td = this.u32(col + 12);
      if (!this.symbolize(vt) || !this.symbolize(col) || !td) return null;
      const n = this.readStr(td + 8, 120);
      return /^\.\?A[UV]/.test(n) ? n : null;
    } catch { return null; }
  }
  // Name a code address as `dll+0xRVA` (null when outside every loaded image).
  symbolize(addr) {
    for (const d of this.dlls.values()) {
      const b = d.meta.base;
      if (addr >= b && addr < b + d.meta.size) return `${d.name}+0x${(addr - b).toString(16)}`;
    }
    return null;
  }
  // Heuristic stack walk: values inside a DLL image whose preceding bytes look like a call.
  backtrace(esp, words = 64) {
    const out = [];
    for (let k = 0; k < words * 8 && out.length < words / 2; k++) {
      let v; try { v = this.u32((esp + 4 * k) >>> 0); } catch { break; }
      const name = this.symbolize(v);
      if (!name) continue;
      const u8 = this.u8;
      const call = u8[v - 5] === 0xe8 || u8[v - 2] === 0xff || u8[v - 3] === 0xff || u8[v - 6] === 0xff || u8[v - 7] === 0xff;
      if (call) out.push(name);
    }
    return out;
  }

  foreignCall(from, addr) {
    const hit = this.foreignCache?.get(addr);
    if (hit && hit.from === from && this.foreignDlls === this.dlls.size) {
      const prev = this.cur; this.cur = hit.target;
      try { hit.target.ex.icall(addr); } finally { this.cur = prev; }
      return;
    }
    // Images first, then thunk ranges: thunk ranges now live in their own region, but builds from before that
    // layout could place one inside another DLL's image.
    const all = [...this.dlls.values()];
    const target = all.find((d) => addr >= d.meta.base && addr < d.meta.base + d.meta.size) ??
      all.find((d) => addr >= d.meta.thunk_base && addr < d.meta.thunk_base + 4 * (d.meta.imports.length + d.meta.spare_thunks));
    if (!target) {
      const e = this.cur?.ex, esp = e ? (e.esp.value >>> 0) : 0;
      const stack = e ? Array.from({ length: 48 }, (_, k) => this.u32((esp + 4 * k) >>> 0))
        .filter(v => v >= 0xa000000 && v < 0xabac000).slice(0, 8).map(v => '0x' + v.toString(16)).join(',') : '';
      let diag = '';
      try {
        const obj = e ? (e.ecx.value >>> 0) : 0, vt = obj ? this.u32(obj) : 0;
        diag = ` ecx=0x${obj.toString(16)} vt=0x${vt.toString(16)}`;
      } catch {}
      const objs = e ? ['esi', 'edi', 'ebx', 'edx'].map((r) => { const v = e[r].value >>> 0, n = this.rtti(v); return n ? `${r}=${n}` : null; }).filter(Boolean).join(' ') : '';
      if (objs) diag += ` [${objs}]`;
      const regs = e ? ` eax=0x${(e.eax.value >>> 0).toString(16)} edx=0x${(e.edx.value >>> 0).toString(16)}` +
        ` ebx=0x${(e.ebx.value >>> 0).toString(16)} esi=0x${(e.esi.value >>> 0).toString(16)}` +
        ` edi=0x${(e.edi.value >>> 0).toString(16)} ebp=0x${(e.ebp.value >>> 0).toString(16)}` : '';
      throw new Error(`call to unknown guest address 0x${addr.toString(16)}${diag}${regs}` +
        (e ? ` (esp=0x${esp.toString(16)} ret=0x${this.u32(esp).toString(16)} engine stack=${stack})` : '') +
        (e ? `\n  backtrace: ${this.backtrace(esp, 40).join(' <- ')}` : '') +
        `\n  recent host calls: ${this.recentHostCalls().join(' ')}` +
        `\n  recent blocks: ${this.lastBlocks(24).join(' ')}`);
    }
    if (target.meta === from) throw new Error(`call to unlifted guest address 0x${addr.toString(16)} in ${target.name}`);
    if ((from !== this.cpuOwner.meta && !from.import_cpu) ||
        (target !== this.cpuOwner && !target.meta.import_cpu))
      throw new Error('cross-DLL calls require shared CPU globals');
    if (this.foreignDlls !== this.dlls.size) { this.foreignCache = new Map(); this.foreignDlls = this.dlls.size; }
    this.foreignCache.set(addr, { from, target });
    const prev = this.cur;
    this.cur = target;
    try { target.ex.icall(addr); } finally { this.cur = prev; }
  }

  bindImports(dll) {
    const { meta } = dll;
    meta.imports.forEach((imp, id) => {
      const slot = meta.thunk_base + 4 * id;
      const key = imp.name;
      // Steam is emulated at the steam_api.dll import boundary: the retail
      // steam_api.dll cannot work without a real Steam client, so prefer the
      // host shims even though a lifted steam_api module is loaded.
      const steamKey = `steam_api.dll!${key}`;
      if (imp.dll.toLowerCase() === 'steam_api.dll' && SHIMS[steamKey]) {
        this.u32(imp.iat, slot);
        return;
      }
      const target = this.dlls.get(imp.dll.toLowerCase());
      const resolved = target && this.resolveExport(target, key);
      if (resolved) {
        this.u32(imp.iat, resolved);
        return;
      }
      if (/^(g_|\?g_)/.test(key) || /^(g_)/.test(key)) { this.u32(imp.iat, this.dataCell(key, dll)); return; }
      this.u32(imp.iat, slot);
    });
  }

  resolveExport(dll, name, seen = new Set()) {
    const key = `${dll.name}!${name}`;
    if (seen.has(key)) throw new Error(`cyclic DLL export forwarder: ${key}`);
    seen.add(key);
    if (Object.hasOwn(dll.meta.exports, name)) return dll.meta.exports[name];
    const forwarder = dll.meta.forwarders?.[name];
    if (!forwarder) return 0;
    const dot = forwarder.lastIndexOf('.');
    if (dot <= 0) throw new Error(`invalid DLL export forwarder: ${forwarder}`);
    let moduleName = forwarder.slice(0, dot).toLowerCase();
    if (!moduleName.endsWith('.dll')) moduleName += '.dll';
    const target = this.dlls.get(moduleName);
    return target ? this.resolveExport(target, forwarder.slice(dot + 1), seen) : 0;
  }

  // Shared-memory processes hand out thunk indices from an atomic per-DLL counter, so threads that
  // create thunks concurrently never publish different callbacks into the same slot.
  claimThunkIndex(dll) {
    if (!this.sharedHeap) return dll.extras.length < dll.meta.spare_thunks ? dll.extras.length : -1;
    const n = Atomics.add(this.extraCounts, dll.slot, 1);
    return n < dll.meta.spare_thunks ? n : -1;
  }

  extraThunk(dll, name, fn, pop, cdecl = false, arity = pop / 4, fast = false) {
    let index = this.claimThunkIndex(dll);
    if (index < 0) {
      // A thunk is callable from any module (calls route to the owner by address), so
      // overflow into whichever loaded DLL still has spare slots.
      for (const other of this.dlls.values()) {
        if (other === dll) continue;
        index = this.claimThunkIndex(other);
        if (index >= 0) { dll = other; break; }
      }
      if (index < 0) throw new Error(`extra thunk capacity exhausted in every loaded DLL (requested from ${dll.name})`);
    }
    dll.extras[index] = { name, fn, pop, cdecl, arity };
    if (fast && !cdecl && arity <= 13 && dll.hostBridge) dll.hostBridge.enable(dll.meta.imports.length + index, pop);
    // Publish the thunk descriptor in guest memory so guest threads can resolve the same host callback by name.
    if (this.sharedHeap) {
      const slot = this.extraTable + (dll.slot * 1024 + index) * 64;
      const bytes = utf8.encode(name).subarray(0, 40);
      this.u8.set(bytes, slot); this.u8[slot + bytes.length] = 0;
      this.u8[slot + 44] = pop & 0xff; this.u8[slot + 45] = cdecl ? 1 : 0; this.u8[slot + 46] = arity & 0xff;
    }
    return dll.meta.thunk_base + 4 * (dll.meta.imports.length + index);
  }

  dynamicExtra(dll, index) {
    if (dll.extras[index]?.fn) return dll.extras[index];
    if (!this.extraTable) return null;
    const slot = this.extraTable + (dll.slot * 1024 + index) * 64;
    const name = this.readStr(slot, 40);
    if (!name) return null;
    const shim = shimFor(name) || (/^host!unused\d+$/.test(name) ? { fn: () => 0, pop: 0, cdecl: false, arity: 0 } : null);
    if (!shim) throw new Error(`guest thread cannot resolve host callback ${name}`);
    const x = { name, fn: shim.fn, pop: this.u8[slot + 44], cdecl: !!this.u8[slot + 45], arity: this.u8[slot + 46] };
    dll.extras[index] = x;
    return x;
  }

  dataCell(name, dll) {
    if (this.dataCells.has(name)) return this.dataCells.get(name);
    let p = this.alloc(0x4000);
    if (name === 'g_ClockSpeedMillisecondsMultiplier') this.f64(p, 1e-3 / 1e9 * 1e6);
    if (name === 'g_ClockSpeedSecondsMultiplier') this.f64(p, 1e-9 * 1e6);
    if (name === 'g_pMemAlloc') p = this.makeMemAlloc(dll);
    this.dataCells.set(name, p);
    return p;
  }

  makeMemAlloc(dll) {
    // IMemAlloc, MSVC vtable order (overloads reversed): 0 Alloc(sz,file,line) 1 Alloc(sz) 2 Realloc(p,sz,file,line)
    // 3 Realloc(p,sz) 4 Free(p,file,line) 5 Free(p) 6/7 Expand 8 GetSize(p). All thiscall, callee pops.
    const cell = this.alloc(16), obj = this.alloc(16), vt = this.alloc(4 * 64);
    this.u32(cell, obj); this.u32(obj, vt);
    const t = (k, name, pop, fn) => this.u32(vt + 4 * k, this.extraThunk(dll, name, fn, pop));
    t(0, 'host!Alloc3', 12, function (n) { return this.g.alloc(n); });
    t(1, 'host!Alloc', 4, function (n) { return this.g.alloc(n); });
    t(2, 'host!Realloc4', 16, function (p, n) { return this.g.realloc(p, n); });
    t(3, 'host!Realloc', 8, function (p, n) { return this.g.realloc(p, n); });
    t(4, 'host!Free3', 12, function (p) { this.g.free(p); return 0; });
    t(5, 'host!Free', 4, function (p) { this.g.free(p); return 0; });
    t(6, 'host!Expand4', 16, () => 0); t(7, 'host!Expand', 8, () => 0);
    t(8, 'host!GetSize', 4, function (p) { return p ? this.g.allocationSize(p) : 0; });
    for (let k = 9; k < 64; k++) t(k, 'host!unused' + k, 0, () => 0);
    return cell;
  }

  // --- calling ---
  // Cooperative suspension: called by a guest thread when it enters a host
  // call. A suspended thread parks here until ResumeThread lowers its level.
  yieldToSuspension() {
    const control = this.currentThreadControl;
    if (!control) return;
    if (!(this.mem.buffer instanceof SharedArrayBuffer) || control + 512 > this.mem.buffer.byteLength || control % 4)
      throw new Error(`invalid thread control block control=0x${Number(control).toString(16)} ` +
        `shared=${this.mem.buffer instanceof SharedArrayBuffer} size=${this.mem.buffer.byteLength}`);
    const level = new Int32Array(this.mem.buffer, control + 504, 1);
    const ack = new Int32Array(this.mem.buffer, control + 500, 1);
    while (Atomics.load(level, 0) > 0) {
      const want = Atomics.load(level, 0);
      Atomics.store(ack, 0, want);
      Atomics.notify(ack, 0);
      while (Atomics.load(level, 0) > 0) Atomics.wait(level, 0, Atomics.load(level, 0), 50);
    }
    Atomics.store(ack, 0, 0);
  }

  withLoaderLock(fn) {
    if (!this.processState) return fn();
    while (Atomics.compareExchange(this.processState, 0, 0, 1) !== 0) Atomics.wait(this.processState, 0, 1);
    try { return fn(); } finally { Atomics.store(this.processState, 0, 0); Atomics.notify(this.processState, 0, 1); }
  }

  initialize(dll) {
    if (dll.initialized) throw new Error(`${dll.name} is already initialized`);
    return this.withLoaderLock(() => {
      for (const cb of dll.meta.tls?.callbacks || []) this.call(dll, cb, [dll.meta.base, 1, 0]);
      const ok = this.call(dll, dll.meta.entry, [dll.meta.base, 1, 0]);
      if (!ok) throw new Error(`${dll.name} DllMain returned FALSE`);
      dll.initialized = true;
      if (this.processState) Atomics.store(this.processState, 2 + dll.slot, 1);
      return ok;
    });
  }

  createThread(start, param, requestedStack = 0, suspended = false) {
    if (!this.sharedHeap || this.attachedThread) throw new Error('CreateThread requires a shared-memory process and main-thread host');
    const stackSize = Math.ceil(Math.max(requestedStack || 0x100000, 0x400000) / 4096) * 4096;
    const dlls = [...this.dlls.values()];
    // Indices come from a shared counter, so this thread's table can have holes (thunks other
    // threads made); those are resolved lazily from the shared descriptor table.
    const extras = dlls.map(d => Array.from({ length: d.extras.length }, (_, i) => {
      const x = d.extras[i];
      if (!x) return null;
      // Callbacks bound to main-thread host state (e.g. D3D9 objects) stay unresolved in the worker and fail loudly if called.
      return { name: x.name, pop: x.pop, cdecl: x.cdecl, arity: x.arity };
    }));
    const id = Atomics.add(this.processState, 1, 1) + 1;
    const control = this.alloc(512);
    this.u32(control, 0x54485244); this.u32(control + 8, id);
    // +500 suspend ack level, +504 suspend level, +508 started flag (0/1)
    this.u32(control + 500, 0); this.u32(control + 504, suspended ? 1 : 0); this.u32(control + 508, 0);
    const processData = { stackSize, cmdline: this.cmdline, envw: this.envw,
      systemHandles: [...this.systemHandles], prefixes: dlls.map(d => d.prefix), extras, filesRoot: this.filesRoot };
    Atomics.add(this.processState, 68, 1);
    try {
      if (ENV.GUEST_DEBUG_THREADS) writeStderr(`[thread] creating worker ${id}\n`);
      const worker = spawnThread({ memory: this.mem, threadId: id, processData, start: start >>> 0, param: param >>> 0, control, modules: isNode ? null : compiledModules(), fsInit: globalThis.__fsInit ?? null },
        { onError: (e) => writeStderr(`[thread] worker ${id} error: ${e?.stack || e}\n`), onExit: (code) => { if (ENV.GUEST_DEBUG_THREADS) writeStderr(`[thread] worker ${id} exit ${code}\n`); } });
      this.handles.set(control, { type: 'thread', worker, control, refs: 1 });
      return { handle: control, id };
    } catch (e) {
      Atomics.sub(this.processState, 68, 1); this.free(control); throw e;
    }
  }

  call(dll, addr, args = [], { thiscall = null, cdecl = true } = {}) {
    const e = dll.ex;
    // Host shims (notably CreateInterfaceFn callbacks) re-enter guest code while
    // a guest call is still active. Those nested calls must use their own stack
    // area and restore the caller's ESP, or the outer return address is lost.
    const depth = this.callDepth || 0;
    const outerEsp = e.esp.value >>> 0;
    // A host function is a callee: the interrupted guest code expects ebx/esi/edi/ebp back unchanged.
    const saved = depth ? { ebx: e.ebx.value, esi: e.esi.value, edi: e.edi.value, ebp: e.ebp.value } : null;
    let esp;
    if (depth) {
      esp = outerEsp - 0x10000;
      if (esp <= this.stackTop - this.stackSize + 0x1000 || esp < 0x1000)
        throw new Error(`nested guest call depth ${depth} exceeded the thread stack ` +
          `(esp=0x${(esp >>> 0).toString(16)} base=0x${(this.stackTop - this.stackSize).toString(16)})`);
    } else {
      esp = this.stackTop - 0x1000;
    }
    for (let i = args.length - 1; i >= 0; i--) { esp -= 4; this.u32(esp, args[i]); }
    esp -= 4; this.u32(esp, 0xdead0000);
    e.esp.value = esp;
    if (thiscall !== null) e.ecx.value = thiscall;
    const prev = this.cur; const prevDepth = this.callDepth || 0;
    this.cur = dll; this.callDepth = prevDepth + 1;
    try { e.icall(addr); } finally {
      this.cur = prev; this.callDepth = prevDepth;
      if (prevDepth) { e.esp.value = outerEsp; e.ebx.value = saved.ebx; e.esi.value = saved.esi; e.edi.value = saved.edi; e.ebp.value = saved.ebp; }
    }
    return e.eax.value >>> 0;
  }
  recentHostCalls() { const r = this.hostRing ?? [], p = this.hostRingPos ?? -1; return [...r.slice(p + 1), ...r.slice(0, p + 1)].filter(Boolean); }
  lastBlocks(n = 40) { const out = []; for (let i = Math.max(0, this.ringPos - n); i < this.ringPos; i++) out.push(this.ring[i & 255].toString(16)); return out; }
  lastRegs() { const i = (this.ringPos - 1) & 255; const r = this.regring[i] || []; return `block ${this.ring[i].toString(16)} eax=${(r[0]||0).toString(16)} ecx=${(r[1]||0).toString(16)} edx=${(r[2]||0).toString(16)} ebx=${(r[3]||0).toString(16)} esp=${(r[4]||0).toString(16)} ebp=${(r[5]||0).toString(16)} esi=${(r[6]||0).toString(16)} edi=${(r[7]||0).toString(16)}`; }
  dumpRegs(lo, hi, n = 200) { const out = []; for (let i = Math.max(0, this.ringPos - n); i < this.ringPos; i++) { const a = this.ring[i & 255]; if (a >= lo && a < hi) { const r = this.regring[i & 255] || []; out.push(a.toString(16) + ': ' + r.map((x) => x.toString(16)).join(' ')); } } return out; }
  st0(dll) { return this.f64((dll.ex.fpbase?.value ?? 0x300) + 8 * dll.ex.ftop.value); }

  fastHostcall(dll, id, esp, ecx) {
    if (this.epochCell && Atomics.load(this.epochCell, 0) !== this.memEpoch) this.refreshViews();
    if (this.currentThreadControl) this.yieldToSuspension();
    const x = dll.extras[id - dll.meta.imports.length];
    const ctx = x.context ??= {g:this, dll, e:dll.ex, esp:0, ecx:0};
    ctx.esp=esp>>>0; ctx.ecx=ecx>>>0;
    const dv=this.dv, a=(esp>>>0)+4;
    let r;
    switch(x.arity) {
      case 0: r=x.fn.call(ctx);break;
      case 1: r=x.fn.call(ctx, dv.getUint32(a + 0, true));break;
      case 2: r=x.fn.call(ctx, dv.getUint32(a + 0, true), dv.getUint32(a + 4, true));break;
      case 3: r=x.fn.call(ctx, dv.getUint32(a + 0, true), dv.getUint32(a + 4, true), dv.getUint32(a + 8, true));break;
      case 4: r=x.fn.call(ctx, dv.getUint32(a + 0, true), dv.getUint32(a + 4, true), dv.getUint32(a + 8, true), dv.getUint32(a + 12, true));break;
      case 5: r=x.fn.call(ctx, dv.getUint32(a + 0, true), dv.getUint32(a + 4, true), dv.getUint32(a + 8, true), dv.getUint32(a + 12, true), dv.getUint32(a + 16, true));break;
      case 6: r=x.fn.call(ctx, dv.getUint32(a + 0, true), dv.getUint32(a + 4, true), dv.getUint32(a + 8, true), dv.getUint32(a + 12, true), dv.getUint32(a + 16, true), dv.getUint32(a + 20, true));break;
      case 7: r=x.fn.call(ctx, dv.getUint32(a + 0, true), dv.getUint32(a + 4, true), dv.getUint32(a + 8, true), dv.getUint32(a + 12, true), dv.getUint32(a + 16, true), dv.getUint32(a + 20, true), dv.getUint32(a + 24, true));break;
      case 8: r=x.fn.call(ctx, dv.getUint32(a + 0, true), dv.getUint32(a + 4, true), dv.getUint32(a + 8, true), dv.getUint32(a + 12, true), dv.getUint32(a + 16, true), dv.getUint32(a + 20, true), dv.getUint32(a + 24, true), dv.getUint32(a + 28, true));break;
      case 9: r=x.fn.call(ctx, dv.getUint32(a + 0, true), dv.getUint32(a + 4, true), dv.getUint32(a + 8, true), dv.getUint32(a + 12, true), dv.getUint32(a + 16, true), dv.getUint32(a + 20, true), dv.getUint32(a + 24, true), dv.getUint32(a + 28, true), dv.getUint32(a + 32, true));break;
      case 10: r=x.fn.call(ctx, dv.getUint32(a + 0, true), dv.getUint32(a + 4, true), dv.getUint32(a + 8, true), dv.getUint32(a + 12, true), dv.getUint32(a + 16, true), dv.getUint32(a + 20, true), dv.getUint32(a + 24, true), dv.getUint32(a + 28, true), dv.getUint32(a + 32, true), dv.getUint32(a + 36, true));break;
      case 11: r=x.fn.call(ctx, dv.getUint32(a + 0, true), dv.getUint32(a + 4, true), dv.getUint32(a + 8, true), dv.getUint32(a + 12, true), dv.getUint32(a + 16, true), dv.getUint32(a + 20, true), dv.getUint32(a + 24, true), dv.getUint32(a + 28, true), dv.getUint32(a + 32, true), dv.getUint32(a + 36, true), dv.getUint32(a + 40, true));break;
      case 12: r=x.fn.call(ctx, dv.getUint32(a + 0, true), dv.getUint32(a + 4, true), dv.getUint32(a + 8, true), dv.getUint32(a + 12, true), dv.getUint32(a + 16, true), dv.getUint32(a + 20, true), dv.getUint32(a + 24, true), dv.getUint32(a + 28, true), dv.getUint32(a + 32, true), dv.getUint32(a + 36, true), dv.getUint32(a + 40, true), dv.getUint32(a + 44, true));break;
      case 13: r=x.fn.call(ctx, dv.getUint32(a + 0, true), dv.getUint32(a + 4, true), dv.getUint32(a + 8, true), dv.getUint32(a + 12, true), dv.getUint32(a + 16, true), dv.getUint32(a + 20, true), dv.getUint32(a + 24, true), dv.getUint32(a + 28, true), dv.getUint32(a + 32, true), dv.getUint32(a + 36, true), dv.getUint32(a + 40, true), dv.getUint32(a + 44, true), dv.getUint32(a + 48, true));break;
    }
    return r === undefined ? dll.ex.eax.value : r | 0;
  }

  hostcall(meta, id) {
    if (this.epochCell && Atomics.load(this.epochCell, 0) !== this.memEpoch) this.refreshViews();
    const dbg = this.hostDebug ??= { counts: !!ENV.GUEST_PROFILE_HOSTCALLS, heartbeat: !!ENV.GUEST_HOSTCALL_HEARTBEAT, cwd: !!ENV.GUEST_DEBUG_CWD, regs: !!ENV.GUEST_DEBUG_REGS };
    if (dbg.heartbeat) {
      this.hostcalls = (this.hostcalls || 0) + 1;
      if (this.hostcalls % 100000 === 0) {
        const imp = id < meta.imports.length ? `${meta.imports[id].dll}!${meta.imports[id].name}` : `extra#${id - meta.imports.length}`;
        console.log(`[hostcall] ${this.hostcalls} calls; current=${imp} thread=${this.threadId}`);
      }
    }
    if (this.currentThreadControl) this.yieldToSuspension();
    let dll = this.dllByMeta?.get(meta);
    if (!dll) { dll = [...this.dlls.values()].find((d) => d.meta === meta); (this.dllByMeta ??= new Map()).set(meta, dll); }
    const e = dll.ex;
    const esp = e.esp.value >>> 0;
    let sh, key;
    if (id >= meta.imports.length) {
      const x = this.dynamicExtra(dll, id - meta.imports.length);
      if (!x) throw new Error(`unknown host callback id ${id} in ${dll.name}`);
      key = x.key ??= 'extra!' + x.name; sh = x.sh ??= { fn: x.fn, pop: x.pop, cdecl: x.cdecl, arity: x.arity };
    }
    else {
      // The shim key per import is resolved once; the SHIMS lookup itself stays live so later installs apply.
      const keys = dll.shimKeys ??= [];
      key = keys[id];
      if (key === undefined) {
        const imp = meta.imports[id];
        key = `${imp.dll}!${imp.name}`;
        if (!SHIMS[key] && SHIMS[`${imp.dll.toLowerCase()}!${imp.name}`]) key = `${imp.dll.toLowerCase()}!${imp.name}`;
        keys[id] = key;
      }
      sh = SHIMS[key];
    }
    if (dbg.cwd && key.startsWith('kernel32.dll!'))
      console.log(`[cwd] call ${key}`);
    if (!sh) throw new Error(`unimplemented import ${key}`);
    const ring = this.hostRing ??= []; ring[this.hostRingPos = ((this.hostRingPos ?? -1) + 1) % 48] = key;
    if(dbg.counts){const counts=this.hostCounts??=new Map();counts.set(key,(counts.get(key)??0)+1);}
    const n = sh.arity ?? sh.fn.length;
    const ctx = { g: this, dll, e, esp, ecx: e.ecx.value >>> 0 };
    if (typeof sh.fn !== 'function') throw new Error(`import ${key} has no implementation (shim entry is not a function)`);
    const before = dbg.regs ? [e.ebx.value, e.esi.value, e.edi.value, e.ebp.value] : null;
    const dv = this.dv, a = esp + 4;
    let r;
    switch (n) {
      case 0: r = sh.fn.call(ctx); break;
      case 1: r = sh.fn.call(ctx, dv.getUint32(a, true)); break;
      case 2: r = sh.fn.call(ctx, dv.getUint32(a, true), dv.getUint32(a + 4, true)); break;
      case 3: r = sh.fn.call(ctx, dv.getUint32(a, true), dv.getUint32(a + 4, true), dv.getUint32(a + 8, true)); break;
      case 4: r = sh.fn.call(ctx, dv.getUint32(a, true), dv.getUint32(a + 4, true), dv.getUint32(a + 8, true), dv.getUint32(a + 12, true)); break;
      default: { const args = []; for (let i = 0; i < n; i++) args.push(dv.getUint32(a + 4 * i, true)); r = sh.fn.call(ctx, ...args); }
    }
    if (before) {
      const after = [e.ebx.value, e.esi.value, e.edi.value, e.ebp.value];
      if (after.some((v, i) => v !== before[i])) console.log(`[regs] ${key} changed callee-saved regs ebx/esi/edi/ebp: ${before.map(v => (v >>> 0).toString(16))} -> ${after.map(v => (v >>> 0).toString(16))}`);
    }
    if (dbg.cwd && key.startsWith('kernel32.dll!'))
      console.log(`[cwd] ret ${key} = ${typeof r === 'bigint' ? '0x' + r.toString(16) : (r | 0)}`);
    if (typeof r === 'bigint') { e.eax.value = Number(r & 0xffffffffn) | 0; e.edx.value = Number((r >> 32n) & 0xffffffffn) | 0; }
    else if (r !== undefined) e.eax.value = r | 0;
    const pop = sh.cdecl ? 0 : (sh.pop ?? 4 * n);
    e.ret.value = this.u32(esp) | 0;   // the host 'function' returns to its caller like any other callee
    e.esp.value = (esp + 4 + pop) | 0;
  }
}

// ---------------- shims ----------------
function wideStr(g, p) {
  let s = '';
  for (let i = 0; i < 4096; i++) {
    const c = g.dv.getUint16(p + 2 * i, true);
    if (!c) break;
    s += String.fromCharCode(c);
  }
  return s;
}

function writeAnsi(g, p, s) {
  for (let i = 0; i < s.length; i++) g.u8[p + i] = s.charCodeAt(i) & 0xff;
  g.u8[p + s.length] = 0;
  return s.length;
}

function writeWide(g, p, s) {
  for (let i = 0; i < s.length; i++) g.dv.setUint16(p + 2 * i, s.charCodeAt(i), true);
  g.dv.setUint16(p + 2 * s.length, 0, true);
  return s.length;
}

// printf-style formatter for the guest's varargs CRT/Win32 entry points.
// `wide` means the format string (and %s arguments) are UTF-16.
function cformatString(g, f, ap, wide) {
  let out = '';
  for (let i = 0; i < f.length; i++) {
    if (f[i] !== '%') { out += f[i]; continue; }
    let j = i + 1;
    let left = false, zero = false, plus = false, space = false;
    while ('-+ #0'.includes(f[j])) {
      if (f[j] === '-') left = true;
      if (f[j] === '0') zero = true;
      if (f[j] === '+') plus = true;
      if (f[j] === ' ') space = true;
      j++;
    }
    let width = 0;
    while (f[j] >= '0' && f[j] <= '9') width = width * 10 + (f[j++] - '0');
    let prec = -1;
    if (f[j] === '.') { j++; prec = 0; while (f[j] >= '0' && f[j] <= '9') prec = prec * 10 + (f[j++] - '0'); }
    let len = '';
    while ('lhLz'.includes(f[j])) len += f[j++];
    const c = f[j]; i = j;
    const asWide = (c === 's' || c === 'c') ? ((len.includes('l') || wide) ? true : false)
      : (c === 'S' || c === 'C') ? !wide : false;
    let text = '';
    if (c === '%') { out += '%'; continue; }
    else if (c === 's' || c === 'S') {
      const p = g.u32(ap); ap += 4;
      text = p ? (asWide ? wideStr(g, p) : g.readStr(p)) : '(null)';
    } else if (c === 'd' || c === 'i') {
      const v = g.i32(ap); ap += 4;
      text = (v < 0 ? '-' : plus ? '+' : space ? ' ' : '') + Math.abs(v);
    } else if (c === 'u') { text = String(g.u32(ap)); ap += 4; }
    else if (c === 'x' || c === 'X') {
      text = g.u32(ap).toString(16); ap += 4;
      if (c === 'X') text = text.toUpperCase();
    } else if (c === 'p') {
      text = g.u32(ap).toString(16).toUpperCase().padStart(8, '0'); ap += 4;
    } else if (c === 'c' || c === 'C') {
      text = String.fromCharCode(g.u32(ap) & 0xff); ap += 4;
    } else if (c === 'f' || c === 'F' || c === 'g' || c === 'G' || c === 'e' || c === 'E') {
      const v = g.f64(ap); ap += 8;
      text = (c === 'e' || c === 'E') ? v.toExponential(prec >= 0 ? prec : 6)
        : (c === 'g' || c === 'G') ? String(v) : v.toFixed(prec >= 0 ? prec : 6);
    } else if (c === 'I') {
      // %I64d / %I64u / %I64x (MSVC)
      text = '%' + c; // fall through; rare in engine strings
    } else { out += '%' + (len || '') + c; continue; }
    if (prec >= 0 && (c === 's' || c === 'S')) text = text.slice(0, prec);
    if (width > text.length) {
      const pad = (zero && !left && /^[0-9]/.test(text) ? '0' : ' ').repeat(width - text.length);
      text = left ? text + pad : (zero && /^[0-9]/.test(text) && (c !== 's' && c !== 'S') ? pad + text : pad + text);
    }
    out += text;
  }
  return out;
}

function cformat(g, fmtPtr, ap) { return cformatString(g, g.readStr(fmtPtr), ap, false); }

// ANSI/Wide sprintf into a caller-supplied buffer (user32).
function wsprintfShim(wide) {
  return { arity: 2, cdecl: true, pop: 0, fn: function (buf, fmt) {
    const g = this.g;
    const f = wide ? wideStr(g, fmt) : g.readStr(fmt);
    const s = cformatString(g, f, this.esp + 12, wide);
    return wide ? writeWide(g, buf, s) : writeAnsi(g, buf, s);
  } };
}
const cd = (fn) => ({ fn, cdecl: true });
const sc = (fn, pop) => ({ fn, pop });
const msg = (tag) => cd(function (fmt) { const s = cformat(this.g, fmt, this.esp + 8); this.g.out.push(s); this.g.log(`[${tag}] ${s.trimEnd()}`);
  if (/shader API|missing/i.test(s)) this.g.log(`[trace] caller=0x${this.g.u32(this.esp).toString(16)} esp=0x${this.g.esp.toString(16)}`);
  if (s.includes('_getcwd')) this.g.log('[trace] ' + this.g.lastBlocks(40).join(' ')); });

// Thunks whose names encode everything needed to rebuild them (e.g. Steam interface methods) are
// resolved by prefix, so any guest thread can reconstruct a callback another thread published.
export const DYNAMIC_SHIMS = [];
export function shimFor(name) {
  if (SHIMS[name]) return SHIMS[name];
  for (const resolve of DYNAMIC_SHIMS) { const sh = resolve(name); if (sh) return sh; }
  return null;
}

export const SHIMS = {
  'tier0.dll!Msg': msg('Msg'), 'tier0.dll!Warning': msg('Warning'), 'tier0.dll!DevMsg': msg('DevMsg'),
  'tier0.dll!?DevMsg@@YAXPBDZZ': msg('DevMsg'),
  'tier0.dll!Error': cd(function (fmt) {
    const msg = cformat(this.g, fmt, this.esp + 8);
    const caller = this.g.u32(this.esp);
    this.g.log(`[error] ${msg} (caller=0x${caller.toString(16)})`);
    throw new Error('Source Error(): ' + msg);
  }),
  'tier0.dll!ThreadInMainThread': cd(() => 1),
  'tier0.dll!?EnterScope@CVProfile@@QAEXPBDH0_NH@Z': { fn(a, b, c, d, e) { return 0; }, pop: 20 },
  'tier0.dll!?ExitScope@CVProfile@@QAEXXZ': { fn() { return 0; }, pop: 0 },
  'tier0.dll!?Lock@CThreadFastMutex@@ACEXII@Z': { fn(a, b) { return 0; }, pop: 8 },
  // The host clock already has millisecond (or better) resolution; these are
  // advisory and return TIMERR_NOERROR.
  'kernel32.dll!OutputDebugStringA': { fn: function (p) { if (p) this.g.log(`[debug] ${this.g.readStr(p)}`); }, pop: 4 },
  'winmm.dll!timeBeginPeriod': { fn: () => 0, pop: 4 },
  'winmm.dll!timeEndPeriod': { fn: () => 0, pop: 4 },
  'winmm.dll!timeGetDevCaps': { fn: function (caps, size) {
    if (!caps || size < 8) return 97; // TIMERR_STRUCT
    this.g.u32(caps, 1); this.g.u32(caps + 4, 1000); return 0;
  }, pop: 8 },
  'winmm.dll!timeGetTime': cd(function () { return Math.floor(performance.now()) >>> 0; }),
  'winmm.dll!waveOutGetNumDevs': cd(() => 0),
  'winmm.dll!waveInGetNumDevs': cd(() => 0),
  'vstdlib.dll!KeyValuesSystem': cd(() => 0),
  'host!Alloc3': { fn: function (n) { return this.g.alloc(n); }, pop: 12 },
  'host!Alloc': { fn: function (n) { return this.g.alloc(n); }, pop: 4 },
  'host!Realloc4': { fn: function (p, n) { return this.g.realloc(p, n); }, pop: 16 },
  'host!Realloc': { fn: function (p, n) { return this.g.realloc(p, n); }, pop: 8 },
  'host!Free3': { fn: function (p) { this.g.free(p); return 0; }, pop: 12 },
  'host!Free': { fn: function (p) { this.g.free(p); return 0; }, pop: 4 },
  'host!Expand4': { fn: () => 0, pop: 16 },
  'host!Expand': { fn: () => 0, pop: 8 },
  'host!GetSize': { fn: function (p) { return p ? this.g.allocationSize(p) : 0; }, pop: 4 },
};
// ---------------- user32 (headless windowing) ----------------
SHIMS['user32.dll!wsprintfA'] = wsprintfShim(false);
SHIMS['user32.dll!wsprintfW'] = wsprintfShim(true);
// Headless window icons/cursors: there is no GDI object table yet, but file
// loads must still reflect the real file volume (missing files fail with
// ERROR_FILE_NOT_FOUND). Successful loads return stable pseudo-handles.
const IMAGE_BASE = 0x7ff20000;
function loadImage(g, namePtr, type, flags, wide) {
  const LR_LOADFROMFILE = 0x10;
  const fromFile = (flags & LR_LOADFROMFILE) !== 0;
  if (fromFile) {
    const path = wide ? wstr(g, namePtr) : g.readStr(namePtr);
    const a = g.files ? g.files.attributes(path) : null;
    if (!a || a.dir) { g.lastError = 2; return 0; }
  }
  g.lastError = 0;
  const key = `${type}:${fromFile ? (wide ? wstr(g, namePtr) : g.readStr(namePtr)) : namePtr & 0xffff}`;
  g.imageHandles ||= new Map();
  if (!g.imageHandles.has(key)) g.imageHandles.set(key, IMAGE_BASE + 0x10 * g.imageHandles.size);
  return g.imageHandles.get(key);
}
SHIMS['user32.dll!LoadImageA'] = { arity: 6, pop: 24, fn: function (_inst, name, type, _cx, _cy, flags) {
  return loadImage(this.g, name, type, flags, false);
} };
SHIMS['user32.dll!LoadImageW'] = { arity: 6, pop: 24, fn: function (_inst, name, type, _cx, _cy, flags) {
  return loadImage(this.g, name, type, flags, true);
} };
// VGUI still creates/uses window objects; the browser backend will replace this
// with the DOM. Handles are stable pseudo-handles so guest comparisons work.
const CURSOR_BASE = 0x7ff10000;
SHIMS['user32.dll!LoadCursorA'] = { arity: 2, pop: 8, fn: function (_inst, name) {
  return CURSOR_BASE + ((name >>> 0) <= 0xffff ? (name & 0xffff) : 1);
} };
SHIMS['user32.dll!LoadCursorW'] = SHIMS['user32.dll!LoadCursorA'];
SHIMS['user32.dll!SetCursor'] = { arity: 1, pop: 4, fn: function () { return 1; } };
SHIMS['user32.dll!GetCursorPos'] = { arity: 1, pop: 4, fn: function (p) {
  if (p) { this.g.u32(p, 640); this.g.u32(p + 4, 360); } return 1;
} };
SHIMS['user32.dll!SetCursorPos'] = { arity: 2, pop: 8, fn: () => 1 };
const METRICS = { 0: 1280, 1: 720, 4: 1, 5: 3, 6: 1, 7: 1, 8: 1, 15: 0, 16: 0, 43: 1, 45: 2, 47: 3 };
SHIMS['user32.dll!GetSystemMetrics'] = { arity: 1, pop: 4, fn: function (n) {
  return METRICS[n] ?? 0;
} };
SHIMS['user32.dll!GetDesktopWindow'] = { cd: true, arity: 0, pop: 0, fn: () => 0x7ff10100n === 0n ? 0 : 0x7ff10100 };
SHIMS['user32.dll!GetDC'] = { arity: 1, pop: 4, fn: () => 0x7ff10200 };
SHIMS['user32.dll!ReleaseDC'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['user32.dll!GetFocus'] = { arity: 0, pop: 0, fn: () => 0x7ff10300 };
SHIMS['user32.dll!SetFocus'] = { arity: 1, pop: 4, fn: () => 0x7ff10300 };
SHIMS['user32.dll!SetCapture'] = { arity: 1, pop: 4, fn: () => 0x7ff10300 };
SHIMS['user32.dll!ReleaseCapture'] = { arity: 0, pop: 0, fn: () => 1 };
SHIMS['user32.dll!GetClientRect'] = { arity: 2, pop: 8, fn: function (_h, r) {
  if (r) { this.g.u32(r, 0); this.g.u32(r + 4, 0); this.g.u32(r + 8, 1280); this.g.u32(r + 12, 720); }
  return 1;
} };
SHIMS['user32.dll!ClientToScreen'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['user32.dll!ScreenToClient'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['user32.dll!GetWindowRect'] = { arity: 2, pop: 8, fn: function (_h, r) {
  if (r) { this.g.u32(r, 0); this.g.u32(r + 4, 0); this.g.u32(r + 8, 1280); this.g.u32(r + 12, 720); }
  return 1;
} };
SHIMS['user32.dll!ShowWindow'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['user32.dll!UpdateWindow'] = { arity: 1, pop: 4, fn: () => 1 };
SHIMS['user32.dll!DestroyWindow'] = { arity: 1, pop: 4, fn: () => 1 };
SHIMS['user32.dll!IsWindow'] = { arity: 1, pop: 4, fn: () => 1 };
SHIMS['user32.dll!IsIconic'] = { arity: 1, pop: 4, fn: () => 0 };
SHIMS['user32.dll!GetParent'] = { arity: 1, pop: 4, fn: function (h) {
  return this.g.userWindows?.get(h)?.parent ?? 0;
} };
SHIMS['user32.dll!GetAncestor'] = { arity: 2, pop: 8, fn: function (h) {
  return this.g.userWindows?.get(h)?.parent ?? 0;
} };
SHIMS['user32.dll!GetWindowThreadProcessId'] = { arity: 2, pop: 8, fn: function (_h, out) {
  if (out) this.g.u32(out, 1);
  return 1;
} };
SHIMS['user32.dll!SetWindowTextA'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['user32.dll!SetWindowTextW'] = SHIMS['user32.dll!SetWindowTextA'];
SHIMS['user32.dll!GetWindowTextA'] = { arity: 3, pop: 12, fn: function (_h, buf, max) {
  if (buf && max) this.g.u8[buf] = 0;
  return 0;
} };
SHIMS['user32.dll!GetWindowTextW'] = SHIMS['user32.dll!GetWindowTextA'];
SHIMS['user32.dll!GetClassNameA'] = { arity: 3, pop: 12, fn: function (_h, buf, max) {
  const s = 'ValveWindow';
  if (buf && max) { for (let i = 0; i < Math.min(s.length, max - 1); i++) this.g.u8[buf + i] = s.charCodeAt(i); this.g.u8[buf + Math.min(s.length, max - 1)] = 0; }
  return Math.min(s.length, Math.max(0, max - 1));
} };
SHIMS['user32.dll!GetClassNameW'] = SHIMS['user32.dll!GetClassNameA'];
SHIMS['user32.dll!SystemParametersInfoA'] = { arity: 4, pop: 16, fn: () => 1 };
SHIMS['user32.dll!SystemParametersInfoW'] = SHIMS['user32.dll!SystemParametersInfoA'];
SHIMS['user32.dll!IsZoomed'] = { arity: 1, pop: 4, fn: () => 0 };
SHIMS['user32.dll!MonitorFromWindow'] = { arity: 2, pop: 8, fn: () => 0x7ff10600 };
SHIMS['user32.dll!MonitorFromPoint'] = { arity: 3, pop: 12, fn: () => 0x7ff10600 };
SHIMS['user32.dll!GetMonitorInfoA'] = { arity: 2, pop: 8, fn: function (_m, info) {
  // MONITORINFO { cbSize, rcMonitor, rcWork, dwFlags }
  if (info) {
    const g = this.g;
    g.u32(info + 4, 0); g.u32(info + 8, 0);
    g.u32(info + 12, 1280); g.u32(info + 16, 720);
    g.u32(info + 20, 0); g.u32(info + 24, 0);
    g.u32(info + 28, 1280); g.u32(info + 32, 720);
    g.u32(info + 36, 1);
  }
  return 1;
} };
SHIMS['user32.dll!GetMonitorInfoW'] = SHIMS['user32.dll!GetMonitorInfoA'];
SHIMS['user32.dll!GetWindowPlacement'] = { arity: 2, pop: 8, fn: function (_h, placement) {
  // WINDOWPLACEMENT { length, flags, showCmd, ptMin, ptMax, rcNormal }
  if (placement) {
    const g = this.g;
    g.u32(placement, 44); g.u32(placement + 4, 0); g.u32(placement + 8, 1);
  }
  return 1;
} };
SHIMS['user32.dll!GetActiveWindow'] = { arity: 0, pop: 0, fn: () => 0x7ff10300 };
SHIMS['user32.dll!GetForegroundWindow'] = { arity: 0, pop: 0, fn: () => 0x7ff10300 };
SHIMS['user32.dll!GetKeyState'] = { arity: 1, pop: 4, fn: () => 0 };
SHIMS['user32.dll!GetAsyncKeyState'] = { arity: 1, pop: 4, fn: () => 0 };
SHIMS['user32.dll!LoadIconA'] = { arity: 2, pop: 8, fn: function (_i, name) { return 0x7ff10400 + ((name >>> 0) <= 0xffff ? (name & 0xffff) : 1); } };
SHIMS['user32.dll!LoadIconW'] = SHIMS['user32.dll!LoadIconA'];
SHIMS['user32.dll!RegisterClassA'] = { arity: 1, pop: 4, fn: () => 0xc001 };
SHIMS['user32.dll!RegisterClassW'] = SHIMS['user32.dll!RegisterClassA'];
SHIMS['user32.dll!RegisterClassExA'] = { arity: 1, pop: 4, fn: () => 0xc001 };
SHIMS['user32.dll!RegisterClassExW'] = SHIMS['user32.dll!RegisterClassExA'];
SHIMS['user32.dll!UnregisterClassA'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['user32.dll!UnregisterClassW'] = SHIMS['user32.dll!UnregisterClassA'];
SHIMS['user32.dll!CreateWindowExA'] = { arity: 12, pop: 48, fn: function (_style, _class, _title, _flags, x, y, w, h, parent) {
  this.g.userWindows ||= new Map();
  const handle = 0x7ff10500 + this.g.userWindows.size;
  this.g.userWindows.set(handle, { parent, x, y, w, h });
  return handle;
} };
SHIMS['user32.dll!CreateWindowExW'] = SHIMS['user32.dll!CreateWindowExA'];
SHIMS['user32.dll!DestroyWindow'] = { arity: 1, pop: 4, fn: function (h) {
  return this.g.userWindows?.delete(h) ? 1 : 0;
} };
function enumWindows(g, parent, callback, param) {
  if (!callback) { g.lastError = 87; return 0; }
  const dll = [...g.dlls.values()].find(d => callback >= d.meta.base && callback < d.meta.base + d.meta.size);
  if (!dll) throw new Error(`unknown window enumeration callback 0x${callback.toString(16)}`);
  for (const [hwnd, window] of g.userWindows || []) {
    if ((parent === null && !window.parent) || (parent !== null && window.parent === parent)) {
      if (!g.call(dll, callback, [hwnd, param])) return 0;
    }
  }
  return 1;
}
SHIMS['user32.dll!EnumWindows'] = { arity: 2, pop: 8, fn: function (callback, param) {
  return enumWindows(this.g, null, callback, param);
} };
SHIMS['user32.dll!EnumChildWindows'] = { arity: 3, pop: 12, fn: function (parent, callback, param) {
  return enumWindows(this.g, parent, callback, param);
} };
SHIMS['user32.dll!ShowWindow'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['user32.dll!UpdateWindow'] = { arity: 1, pop: 4, fn: () => 1 };
SHIMS['user32.dll!IsWindow'] = { arity: 1, pop: 4, fn: () => 1 };
SHIMS['user32.dll!IsWindowVisible'] = { arity: 1, pop: 4, fn: () => 1 };
SHIMS['user32.dll!SetWindowPos'] = { arity: 7, pop: 28, fn: () => 1 };
SHIMS['user32.dll!MoveWindow'] = { arity: 6, pop: 24, fn: () => 1 };
SHIMS['user32.dll!InvalidateRect'] = { arity: 3, pop: 12, fn: () => 1 };
SHIMS['user32.dll!ValidateRect'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['user32.dll!GetWindowLongA'] = { arity: 2, pop: 8, fn: () => 0 };
SHIMS['user32.dll!GetWindowLongW'] = SHIMS['user32.dll!GetWindowLongA'];
SHIMS['user32.dll!SetWindowLongA'] = { arity: 3, pop: 12, fn: () => 0 };
SHIMS['user32.dll!SetWindowLongW'] = SHIMS['user32.dll!SetWindowLongA'];
SHIMS['user32.dll!PeekMessageA'] = { arity: 5, pop: 20, fn: () => 0 };
SHIMS['user32.dll!PeekMessageW'] = SHIMS['user32.dll!PeekMessageA'];
SHIMS['user32.dll!GetMessageA'] = { arity: 4, pop: 16, fn: () => 0 };
SHIMS['user32.dll!GetMessageW'] = SHIMS['user32.dll!GetMessageA'];
SHIMS['user32.dll!TranslateMessage'] = { arity: 1, pop: 4, fn: () => 0 };
SHIMS['user32.dll!DispatchMessageA'] = { arity: 1, pop: 4, fn: () => 0 };
SHIMS['user32.dll!DispatchMessageW'] = SHIMS['user32.dll!DispatchMessageA'];
SHIMS['user32.dll!PostQuitMessage'] = { arity: 1, pop: 4, fn: () => 0 };
SHIMS['user32.dll!PostMessageA'] = { arity: 4, pop: 16, fn: () => 1 };
SHIMS['user32.dll!PostMessageW'] = SHIMS['user32.dll!PostMessageA'];
SHIMS['user32.dll!SendMessageA'] = { arity: 4, pop: 16, fn: () => 0 };
SHIMS['user32.dll!SendMessageW'] = SHIMS['user32.dll!SendMessageA'];
SHIMS['user32.dll!EnableWindow'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['user32.dll!SetTimer'] = { arity: 4, pop: 16, fn: (_h, id) => id || 1 };
SHIMS['user32.dll!KillTimer'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['user32.dll!MsgWaitForMultipleObjects'] = { arity: 5, pop: 20, fn: () => 258 };
SHIMS['user32.dll!TranslateAcceleratorA'] = { arity: 3, pop: 12, fn: () => 0 };
SHIMS['user32.dll!TranslateAcceleratorW'] = SHIMS['user32.dll!TranslateAcceleratorA'];
SHIMS['user32.dll!RegisterWindowMessageA'] = { arity: 1, pop: 4, fn: function (p) {
  const s = this.g.readStr(p); let h = 0xc000;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return 0xc000 | (h & 0x3fff);
} };
SHIMS['user32.dll!RegisterWindowMessageW'] = { arity: 1, pop: 4, fn: function (p) {
  return SHIMS['user32.dll!RegisterWindowMessageA'].fn.call(this, p);
} };
// ---------------- process ----------------
SHIMS['kernel32.dll!OpenProcess'] = { arity: 3, pop: 12, fn: function (_a, _i, pid) { return 0x7ff30000 + ((pid >>> 0) & 0xfff); } };
SHIMS['kernel32.dll!GetExitCodeProcess'] = { arity: 2, pop: 8, fn: function (_h, out) {
  if (out) this.g.u32(out, out === 0x7ff30000 ? 259 : 259); return 1;
} };
SHIMS['kernel32.dll!GetProcessId'] = { arity: 1, pop: 4, fn: () => 1 };
SHIMS['kernel32.dll!ReadProcessMemory'] = { arity: 5, pop: 20, fn: function () { this.g.lastError = 5; return 0; } };
SHIMS['kernel32.dll!WriteProcessMemory'] = { arity: 5, pop: 20, fn: function () { this.g.lastError = 5; return 0; } };
SHIMS['kernel32.dll!TerminateProcess'] = { arity: 2, pop: 8, fn: () => { throw new Error('TerminateProcess'); } };
// ---------------- advapi32 registry ----------------
// A real in-memory registry: keys/values persist for the process and the guest
// can create, enumerate, read and write them. Only a few values are pre-seeded.
function regInit(g) {
  if (g.registry) return g.registry;
  const keys = new Map(), handles = new Map();
  const H = 0x80000000;
  const seed = (name, values) => keys.set(name, { values: new Map(Object.entries(values)), subs: new Set() });
  for (const hive of [H + 1, H + 2]) {
    seed(`${hive}|software\\valve\\steam`, {
      installpath: { type: 1, data: 'c:\\gamebox' },
      steampath: { type: 1, data: 'c:\\gamebox' },
      language: { type: 1, data: 'english' },
      steamexe: { type: 1, data: 'c:\\gamebox\\gmod.exe' },
    });
    seed(`${hive}|software\\valve\\steam\\activeprocess`, { activeuser: { type: 4, data: 0 } });
  }
  seed(`${H + 2}|software\\valvesoftware\\studiocompiler`, {});
  g.registry = { keys, handles, next: 0x500 };
  return g.registry;
}
function regName(g, hive, sub) { return `${hive >>> 0}|${sub ? g.readStr(sub).replaceAll('/', '\\').toLowerCase() : ''}`; }
function regOpen(g, hive, sub, out) {
  const r = regInit(g);
  const name = regName(g, hive, sub);
  if (!r.keys.has(name)) r.keys.set(name, { values: new Map(), subs: new Set() });
  const h = r.next++; r.handles.set(h, name);
  if (out) g.u32(out, h);
  return 0; // ERROR_SUCCESS
}
for (const nm of ['RegOpenKeyExA', 'RegOpenKeyExW']) {
  SHIMS[`advapi32.dll!${nm}`] = { arity: 5, pop: 20, fn: function (hive, sub, opt, sam, out) { return regOpen(this.g, hive, sub, out); } };
}
for (const nm of ['RegCreateKeyExA', 'RegCreateKeyExW']) {
  SHIMS[`advapi32.dll!${nm}`] = { arity: 9, pop: 36, fn: function (hive, sub, res, cls, opt, sam, sec, out, disp) {
    if (disp) this.g.u32(disp, 1); return regOpen(this.g, hive, sub, out);
  } };
}
SHIMS['advapi32.dll!RegCloseKey'] = { arity: 1, pop: 4, fn: function (h) { regInit(this.g).handles.delete(h); return 0; } };
for (const nm of ['RegQueryValueExA', 'RegQueryValueExW']) {
  SHIMS[`advapi32.dll!${nm}`] = { arity: 6, pop: 24, fn: function (h, value, res, type, data, size) {
    const g = this.g, r = regInit(g);
    const key = r.keys.get(r.handles.get(h));
    const v = key?.values.get(value ? g.readStr(value).toLowerCase() : '');
    if (!v) { if (size && data) g.u32(size, 0); return 2; } // ERROR_FILE_NOT_FOUND
    const wide = nm.endsWith('W');
    if (type) g.u32(type, v.type);
    let bytes;
    if (v.type === 4) bytes = 4;
    else if (v.type === 3) bytes = v.data.length;
    else bytes = wide ? (v.data.length + 1) * 2 : v.data.length + 1;
    if (!data || g.u32(size) < bytes) { if (size) g.u32(size, bytes); return 234; } // MORE_DATA
    if (v.type === 4) g.u32(data, v.data);
    else if (v.type === 3) g.u8.set(v.data, data);
    else if (wide) setWstr(g, data, v.data, v.data.length + 1);
    else { for (let i = 0; i < v.data.length; i++) g.u8[data + i] = v.data.charCodeAt(i); g.u8[data + v.data.length] = 0; }
    if (size) g.u32(size, bytes);
    return 0;
  } };
}
for (const nm of ['RegSetValueExA', 'RegSetValueExW']) {
  SHIMS[`advapi32.dll!${nm}`] = { arity: 6, pop: 24, fn: function (h, value, res, type, data, size) {
    const g = this.g, r = regInit(g);
    const key = r.keys.get(r.handles.get(h));
    if (!key) return 6;
    const name = value ? g.readStr(value).toLowerCase() : '';
    if (type === 4) key.values.set(name, { type: 4, data: g.u32(data) });
    else if (type === 3) key.values.set(name, { type: 3, data: g.u8.slice(data, data + size) });
    else key.values.set(name, { type: 1, data: g.readStr(data) });
    return 0;
  } };
}
SHIMS['advapi32.dll!RegDeleteKeyA'] = { arity: 2, pop: 8, fn: () => 0 };
SHIMS['advapi32.dll!RegDeleteKeyW'] = SHIMS['advapi32.dll!RegDeleteKeyA'];
SHIMS['advapi32.dll!RegDeleteValueA'] = { arity: 2, pop: 8, fn: () => 0 };
SHIMS['advapi32.dll!RegDeleteValueW'] = SHIMS['advapi32.dll!RegDeleteValueA'];
for (const nm of ['RegEnumKeyExA', 'RegEnumKeyExW']) {
  SHIMS[`advapi32.dll!${nm}`] = { arity: 8, pop: 32, fn: () => 259 }; // ERROR_NO_MORE_ITEMS
}
for (const nm of ['RegEnumValueA', 'RegEnumValueW']) {
  SHIMS[`advapi32.dll!${nm}`] = { arity: 8, pop: 32, fn: () => 259 };
}
SHIMS['advapi32.dll!RegQueryInfoKeyA'] = { arity: 12, pop: 48, fn: function (h, cls, clen, res, subkeys, sklen, maxsk, values, maxv, maxvd, sec, last) {
  if (subkeys) this.g.u32(subkeys, 0);
  if (values) this.g.u32(values, 0);
  return 0;
} };
SHIMS['advapi32.dll!RegQueryInfoKeyW'] = SHIMS['advapi32.dll!RegQueryInfoKeyA'];
// ---------------- ole32 / COM ----------------
SHIMS['ole32.dll!CoInitialize'] = { arity: 1, pop: 4, fn: () => 0 };
SHIMS['ole32.dll!CoInitializeEx'] = { arity: 2, pop: 8, fn: () => 0 };
SHIMS['ole32.dll!CoUninitialize'] = { arity: 0, pop: 0, fn: () => 0 };
SHIMS['ole32.dll!OleInitialize'] = { arity: 1, pop: 4, fn: () => 0 };
SHIMS['ole32.dll!OleUninitialize'] = { arity: 0, pop: 0, fn: () => 0 };
SHIMS['ole32.dll!CoCreateInstance'] = { arity: 5, pop: 20, fn: () => 0x80004002 }; // E_NOINTERFACE
SHIMS['ole32.dll!CoTaskMemAlloc'] = { arity: 1, pop: 4, fn: function (n) { return this.g.alloc(n); } };
SHIMS['ole32.dll!CoTaskMemFree'] = { arity: 1, pop: 4, fn: function (p) { this.g.free(p); } };
SHIMS['ole32.dll!CoTaskMemRealloc'] = { arity: 2, pop: 8, fn: function (p, n) { return this.g.realloc(p, n); } };
// ---------------- locale ----------------
SHIMS['kernel32.dll!GetUserDefaultLCID'] = { arity: 0, pop: 0, fn: () => 0x0409 };
SHIMS['kernel32.dll!GetSystemDefaultLCID'] = { arity: 0, pop: 0, fn: () => 0x0409 };
SHIMS['kernel32.dll!GetUserDefaultUILanguage'] = { arity: 0, pop: 0, fn: () => 0x0409 };
SHIMS['kernel32.dll!GetSystemDefaultUILanguage'] = { arity: 0, pop: 0, fn: () => 0x0409 };
SHIMS['kernel32.dll!IsValidLocale'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['kernel32.dll!GetThreadLocale'] = { arity: 0, pop: 0, fn: () => 0x0409 };
SHIMS['kernel32.dll!GetLocaleInfoA'] = { arity: 4, pop: 16, fn: function (_lcid, _type, buf, n) {
  const v = 'en-US'; if (!buf || n < v.length + 1) return v.length + 1;
  for (let i = 0; i < v.length; i++) this.g.u8[buf + i] = v.charCodeAt(i); this.g.u8[buf + v.length] = 0; return v.length + 1;
} };
SHIMS['kernel32.dll!GetLocaleInfoW'] = { arity: 4, pop: 16, fn: function (_lcid, _type, buf, n) {
  const v = 'en-US'; if (!buf || n < v.length + 1) return v.length + 1;
  return setWstr(this.g, buf, v, n);
} };
// ---------------- gdi32 ----------------
// Headless GDI objects: handles are stable pseudo-handles. Real glyph
// rasterisation belongs to the browser/canvas backend (documented gap).
SHIMS['gdi32.dll!CreateFontA'] = { arity: 14, pop: 56, fn: (h) => 0x7ff20000 + ((h >>> 0) & 0xfff) };
SHIMS['gdi32.dll!CreateFontW'] = SHIMS['gdi32.dll!CreateFontA'];
SHIMS['gdi32.dll!CreateFontIndirectA'] = { arity: 1, pop: 4, fn: () => 0x7ff20100 };
SHIMS['gdi32.dll!CreateFontIndirectW'] = SHIMS['gdi32.dll!CreateFontIndirectA'];
SHIMS['gdi32.dll!CreateSolidBrush'] = { arity: 1, pop: 4, fn: () => 0x7ff20200 };
SHIMS['gdi32.dll!CreatePen'] = { arity: 3, pop: 12, fn: () => 0x7ff20300 };
SHIMS['gdi32.dll!CreateCompatibleDC'] = { arity: 1, pop: 4, fn: () => 0x7ff20400 };
SHIMS['gdi32.dll!CreateCompatibleBitmap'] = { arity: 3, pop: 12, fn: () => 0x7ff20500 };
SHIMS['gdi32.dll!CreateDIBSection'] = { arity: 6, pop: 24, fn: function (_dc, _bmi, _usage, bits, _sec, _off) {
  if (bits) this.g.u32(bits, 0); return 0x7ff20600;
} };
SHIMS['gdi32.dll!SelectObject'] = { arity: 2, pop: 8, fn: (_dc, obj) => obj };
SHIMS['gdi32.dll!DeleteObject'] = { arity: 1, pop: 4, fn: () => 1 };
SHIMS['gdi32.dll!DeleteDC'] = { arity: 1, pop: 4, fn: () => 1 };
SHIMS['gdi32.dll!GetStockObject'] = { arity: 1, pop: 4, fn: (n) => 0x7ff20700 + (n & 0xff) };
SHIMS['gdi32.dll!SetBkMode'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['gdi32.dll!SetBkColor'] = { arity: 2, pop: 8, fn: () => 0 };
SHIMS['gdi32.dll!SetTextColor'] = { arity: 2, pop: 8, fn: () => 0 };
SHIMS['gdi32.dll!SetROP2'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['gdi32.dll!SetMapMode'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['gdi32.dll!SaveDC'] = { arity: 1, pop: 4, fn: () => 1 };
SHIMS['gdi32.dll!RestoreDC'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['gdi32.dll!GetTextMetricsA'] = { arity: 2, pop: 8, fn: function (_dc, m) {
  if (m) { this.g.u8.fill(0, m, m + 56); this.g.u32(m, 13); this.g.u32(m + 4, 16); this.g.u32(m + 8, 3); this.g.u32(m + 12, 11); this.g.u32(m + 24, 16); }
  return 1;
} };
SHIMS['gdi32.dll!GetTextMetricsW'] = SHIMS['gdi32.dll!GetTextMetricsA'];
SHIMS['gdi32.dll!GetTextExtentPoint32A'] = { arity: 4, pop: 16, fn: function (_dc, s, n, size) {
  if (size) { this.g.u32(size, n * 8); this.g.u32(size + 4, 13); } return 1;
} };
SHIMS['gdi32.dll!GetTextExtentPoint32W'] = { arity: 4, pop: 16, fn: function (_dc, _s, n, size) {
  if (size) { this.g.u32(size, n * 8); this.g.u32(size + 4, 13); } return 1;
} };
SHIMS['gdi32.dll!TextOutA'] = { arity: 5, pop: 20, fn: () => 1 };
SHIMS['gdi32.dll!TextOutW'] = SHIMS['gdi32.dll!TextOutA'];
SHIMS['gdi32.dll!ExtTextOutA'] = { arity: 8, pop: 32, fn: () => 1 };
SHIMS['gdi32.dll!ExtTextOutW'] = SHIMS['gdi32.dll!ExtTextOutA'];
SHIMS['gdi32.dll!GetObjectA'] = { arity: 3, pop: 12, fn: function (_h, n, p) { if (p) this.g.u8.fill(0, p, p + n); return n; } };
SHIMS['gdi32.dll!GetObjectW'] = SHIMS['gdi32.dll!GetObjectA'];
SHIMS['gdi32.dll!GetDeviceCaps'] = { arity: 2, pop: 8, fn: (_dc, i) => (i === 88 || i === 90 ? 96 : i === 8 ? 1280 : i === 10 ? 720 : 32) };
SHIMS['gdi32.dll!BitBlt'] = { arity: 9, pop: 36, fn: () => 1 };
SHIMS['gdi32.dll!StretchBlt'] = { arity: 11, pop: 44, fn: () => 1 };
SHIMS['gdi32.dll!PatBlt'] = { arity: 6, pop: 24, fn: () => 1 };
SHIMS['gdi32.dll!FillRect'] = { arity: 3, pop: 12, fn: () => 1 };
SHIMS['gdi32.dll!CreateRectRgn'] = { arity: 4, pop: 16, fn: () => 0x7ff20800 };
SHIMS['gdi32.dll!SelectClipRgn'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['gdi32.dll!GetClipBox'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['gdi32.dll!SetRect'] = { arity: 5, pop: 20, fn: function (r, l, t, rr, b) {
  this.g.u32(r, l); this.g.u32(r + 4, t); this.g.u32(r + 8, rr); this.g.u32(r + 12, b); return 1;
} };
SHIMS['gdi32.dll!SetRectEmpty'] = { arity: 1, pop: 4, fn: function (r) { this.g.u8.fill(0, r, r + 16); return 1; } };
SHIMS['user32.dll!GetWindowDC'] = { arity: 1, pop: 4, fn: () => 0x7ff20400 };
SHIMS['user32.dll!MessageBoxA'] = { arity: 4, pop: 16, fn: function (_h, text, caption) {
  this.g.log(`[messagebox] ${this.g.readStr(caption)}: ${this.g.readStr(text)}`); return 1;
} };
installD3D9(SHIMS);
installSteam(SHIMS, DYNAMIC_SHIMS);
// A real Source CreateInterfaceFn implemented over every loaded module. Each
// guest thread has its own copy of the loaded DLLs, so this shim works there too.
SHIMS['host!CreateInterfaceFn'] = { arity: 2, pop: 0, cdecl: true, fn: function (namePtr, codePtr) {
  const g = this.g, name = g.readStr(namePtr);
  if (ENV.GUEST_DEBUG_PROC) console.log(`[factory] request ${name} caller=0x${g.u32(g.cur.ex.esp.value).toString(16)}`);
  g.interfaceCache ||= new Map();
  g.appSystems ||= [];
  const hit = g.interfaceCache.get(name);
  if (hit) { if (codePtr) g.u32(codePtr, 0); return hit; }
  // Mirrors the retail launcher's AddSystems() list: these are the app systems
  // a module is authoritative for. vguimatsurface must win VGUI_Surface030 so
  // its QueryInterface also provides MatSystemSurface008.
  g.appSystemDlls ||= new Map([
    ['VCvarQuery001', 'engine.dll'], ['InputSystemVersion001', 'inputsystem.dll'],
    ['VMaterialSystem080', 'materialsystem.dll'], ['VDataCache003', 'datacache.dll'],
    ['MDLCache004', 'datacache.dll'], ['VStudioDataCache005', 'datacache.dll'],
    ['VStudioRender025', 'studiorender.dll'], ['VPhysics031', 'vphysics.dll'],
    ['VGUI_Surface030', 'vguimatsurface.dll'], ['VGUI_ivgui008', 'vgui2.dll'],
    ['VENGINE_LAUNCHER_API_VERSION004', 'engine.dll'], ['QueuedLoaderVersion004', 'filesystem_stdio.dll'],
  ]);
  const order = ['engine.dll', 'server.dll', 'filesystem_stdio.dll', 'tier0.dll', 'vstdlib.dll',
    'steam_api.dll', 'lua_shared.dll', 'inputsystem.dll'];
  const preferred = g.appSystemDlls.get(name);
  const dlls = [...g.dlls.values()].sort((a, b) =>
    (a.name === preferred ? -1 : b.name === preferred ? 1 : 0) ||
    (order.indexOf(a.name) - order.indexOf(b.name)));
  for (const dll of dlls) {
    if (!dll.meta.exports.CreateInterface) continue;
    const st = g.alloc(4);
    const p = g.call(dll, dll.meta.exports.CreateInterface, [g.cstr(name), st]);
    if (ENV.GUEST_DEBUG_PROC) console.log(`[factory] ${name} -> ${dll.name} 0x${(p >>> 0).toString(16)} status=${g.u32(st)}`);
    if (p && !g.u32(st)) {
      g.interfaceCache.set(name, p);
      // Only the systems added by the retail launcher's AddSystems() call
      // participate in CAppSystemGroup::FindSystem's QueryInterface fallback.
      // Other factory exports are plain interfaces, not app systems.
      if (g.appSystemDlls.has(name) && !g.appSystems.includes(p)) g.appSystems.push(p);
      if (codePtr) g.u32(codePtr, 0);
      return p;
    }
  }
  // CAppSystemGroup::FindSystem falls back to QueryInterface on every
  // instantiated system when the name isn't a registered factory export.
  const owner = (a) => [...g.dlls.values()].find(d => a >= d.meta.base && a < d.meta.base + d.meta.size);
  for (const system of g.appSystems) {
    const vt = g.u32(system), vtDll = owner(vt);
    if (!vtDll) continue;
    const query = g.u32(vt + 8); // IAppSystem::QueryInterface(const char*)
    const queryDll = owner(query);
    if (!queryDll) continue;
    if (ENV.GUEST_DEBUG_PROC) console.log(`[factory] try QueryInterface ${name} system=0x${system.toString(16)} vt=0x${vt.toString(16)} ${queryDll.name} query=0x${query.toString(16)}`);
    const p = g.call(queryDll, query, [g.cstr(name)], { thiscall: system });
    if (ENV.GUEST_DEBUG_PROC && p) console.log(`[factory] ${name} -> QueryInterface(0x${system.toString(16)}) 0x${(p >>> 0).toString(16)}`);
    if (p) {
      g.interfaceCache.set(name, p);
      if (codePtr) g.u32(codePtr, 0);
      return p;
    }
  }
  if (ENV.GUEST_DEBUG_PROC) console.log(`[factory] ${name} -> NOT FOUND`);
  if (codePtr) g.u32(codePtr, 1);
  return 0;
} };
const ARITY = Object.fromEntries('CloseHandle1 CompareStringW6 CreateEventW4 CreateFileW7 DecodePointer1 DeleteCriticalSection1 EncodePointer1 EnterCriticalSection1 ExitProcess1 FindClose1 FindFirstFileExW6 FindNextFileW2 FlsAlloc1 FlsFree1 FlsGetValue1 FlsSetValue2 FlushFileBuffers1 FormatMessageA7 FreeEnvironmentStringsW1 FreeLibrary1 GetACP0 GetCPInfo2 GetCommandLineA0 GetCommandLineW0 GetConsoleMode2 GetConsoleOutputCP0 GetCurrentDirectoryW2 GetCurrentProcess0 GetCurrentProcessId0 GetCurrentThread0 GetCurrentThreadId0 GetDateFormatW6 GetEnvironmentStringsW0 GetFileSizeEx2 GetFileType1 GetLastError0 GetFullPathNameA4 GetFullPathNameW4 GetModuleFileNameA3 GetModuleFileNameW3 GetModuleHandleA1 GetModuleHandleExA3 GetModuleHandleExW3 GetModuleHandleW1 GetOEMCP0 GetProcAddress2 GetProcessHeap0 GetProcessPriorityBoost2 GetThreadPriorityBoost2 SetHandleCount1 SetProcessPriorityBoost2 SetThreadPriorityBoost2 GetTickCount0 GetTickCount640 GetStartupInfoW1 GetStdHandle1 GetStringTypeW5 GetSystemTimeAsFileTime1 GetTimeFormatW6 GetTimeZoneInformation1 GetVersionExA1 HeapAlloc3 HeapCreate3 HeapDestroy1 HeapSize3 HeapFree3 HeapReAlloc4 InitializeCriticalSectionAndSpinCount2 InitializeCriticalSectionEx3 InitializeSListHead1 InterlockedFlushSList1 InterlockedIncrement1 InterlockedDecrement1 InterlockedExchange2 InterlockedExchangeAdd2 InterlockedCompareExchange3 IsDebuggerPresent0 IsProcessorFeaturePresent1 IsValidCodePage1 LCMapStringW6 LeaveCriticalSection1 LoadLibraryA1 LoadLibraryExW3 MultiByteToWideChar6 QueryPerformanceCounter1 QueryPerformanceFrequency1 RaiseException4 ReadConsoleW5 ReadFile5 ResetEvent1 RtlUnwind4 SetEndOfFile1 SetCurrentDirectoryW1 SetEnvironmentVariableW2 SetEvent1 SetFilePointerEx4 SetLastError1 SetStdHandle2 SetUnhandledExceptionFilter1 TerminateProcess2 TlsAlloc0 TlsFree1 TlsGetValue1 TlsSetValue2 UnhandledExceptionFilter1 VirtualAlloc4 VirtualFree3 VirtualProtect4 VirtualQuery3 WaitForSingleObjectEx3 WideCharToMultiByte8 WriteConsoleW5 WriteFile5'.split(' ').map((t) => { const m = t.match(/^(.*?)(\d)$/); return [m[1], +m[2]]; }));
const K = (name, fn) => { if (!(name in ARITY)) throw new Error('no arity for ' + name); SHIMS['kernel32.dll!' + name] = { fn, arity: ARITY[name], pop: 4 * ARITY[name] }; };
K('GetLastError', function () { return this.g.lastError; });
// The virtual Win32 environment identifies itself as Windows 10, NT platform.
K('GetVersionExA', function (p) {
  const size = p ? this.g.u32(p) : 0;
  if (size !== 148 && size !== 156) { this.g.lastError = 87; return 0; }
  this.g.u8.fill(0, p + 4, p + size);
  this.g.u32(p + 4, 10); this.g.u32(p + 8, 0);
  this.g.u32(p + 12, 19045); this.g.u32(p + 16, 2);
  if (size === 156) this.g.u8[p + 154] = 1; // VER_NT_WORKSTATION
  return 1;
});
K('SetLastError', function (e) { this.g.lastError = e; });
SHIMS['kernel32.dll!GetSystemInfo'] = { arity: 1, pop: 4, fn: function (p) {
  // Information about the virtual x86 guest, not the physical host machine.
  this.g.u8.fill(0, p, p + 36);
  this.g.u32(p + 4, 4096); this.g.u32(p + 8, 0x10000);
  this.g.u32(p + 12, this.g.growBase ? 0xfffeffff : this.g.u8.length - 1); this.g.u32(p + 16, 1);
  this.g.u32(p + 20, 1); this.g.u32(p + 24, 586); this.g.u32(p + 28, 65536);
  this.g.dv.setUint16(p + 32, 6, true); this.g.dv.setUint16(p + 34, 0x3a09, true);
} };
// The optional AMD performance-driver device does not exist in the browser
// host. Other file opens must not silently pretend to be absent.
SHIMS['kernel32.dll!CreateFileA'] = { arity: 7, pop: 28, fn: function (p, access, _share, _security, disposition) {
  const path = this.g.readStr(p);
  if (path.toLowerCase() === '\\\\.\\gdperf') { this.g.lastError = 2; return -1; }
  if (ENV.GUEST_DEBUG_CWD) console.log(`[cwd] CreateFileA(${JSON.stringify(path)}) access=0x${(access>>>0).toString(16)} disp=${disposition}`);
  if (!this.g.files) throw new Error(`CreateFileA requires a configured file volume: ${path}`);
  return this.g.files.open(path, access, disposition);
} };
K('GetCurrentThreadId', function () { return this.g.threadId; }); K('GetCurrentProcessId', () => 1); K('GetCurrentProcess', () => -1);
SHIMS['kernel32.dll!CreateThread'] = { arity: 6, pop: 24, fn: function (_security, stack, start, param, flags, outId) {
  if (flags & ~4) throw new Error(`unsupported CreateThread flags 0x${flags.toString(16)}`);
  const t = this.g.createThread(start, param, stack, !!(flags & 4));
  if (outId) this.g.u32(outId, t.id);
  return t.handle;
} };
SHIMS['kernel32.dll!ResumeThread'] = { arity: 1, pop: 4, fn: function (h) {
  const t = this.g.handles.get(h);
  if (!t || t.type !== 'thread') { this.g.lastError = 6; return -1; }
  const level = new Int32Array(this.g.mem.buffer, t.control + 504, 1);
  if (ENV.GUEST_DEBUG_THREADS) console.log(`[thread] ResumeThread(handle=0x${h.toString(16)} id=${this.g.u32(t.control + 8)} level=${Atomics.load(level, 0)})`);
  for (;;) {
    const old = Atomics.load(level, 0);
    if (old <= 0) return 0;
    if (Atomics.compareExchange(level, 0, old, old - 1) === old) {
      if (old === 1) Atomics.notify(level, 0);
      // Retail tier0/vstdlib treats a zero return as "not yet suspended" and
      // re-suspends in a loop; report the resulting count so the pool's stop
      // loop can observe that the suspension succeeded.
      return old + 1;
    }
  }
} };
SHIMS['kernel32.dll!SuspendThread'] = { arity: 1, pop: 4, fn: function (h) {
  const t = this.g.handles.get(h);
  if (!t || t.type !== 'thread') { this.g.lastError = 6; return -1; }
  const state = Atomics.load(new Int32Array(this.g.mem.buffer, t.control + 4, 1), 0);
  if (state) return 1; // terminated: report a nonzero count so pool stop loops finish
  if (t.control === this.g.currentThreadControl) throw new Error('a guest thread cannot suspend itself');
  const level = new Int32Array(this.g.mem.buffer, t.control + 504, 1);
  const ack = new Int32Array(this.g.mem.buffer, t.control + 500, 1);
  const started = Atomics.load(new Int32Array(this.g.mem.buffer, t.control + 508, 1), 0);
  if (ENV.GUEST_DEBUG_THREADS && this.g.threadId === 1)
    console.log(`[thread] SuspendThread(handle=0x${h.toString(16)} id=${this.g.u32(t.control + 8)} level=${Atomics.load(level, 0)} ack=${Atomics.load(ack, 0)} started=${started}) blocks=${this.g.lastBlocks(24).join(' ')} caller=0x${this.g.u32(this.esp).toString(16)} workerBlock=0x${this.g.u32(t.control + 480).toString(16)} frames=${(()=>{const out=[];let f=this.g.cur.ex.ebp.value>>>0;for(let k=0;k<10&&f>0x1000&&f<0x80000000;k++){const ret=this.g.u32(f+4)>>>0;out.push('0x'+ret.toString(16));const n=this.g.u32(f)>>>0;if(n<=f)break;f=n;}return out.join('<');})()}`);
  for (;;) {
    const old = Atomics.load(level, 0);
    if (old >= 127) { this.g.lastError = 164; return -1; }
    if (Atomics.compareExchange(level, 0, old, old + 1) === old) {
      // Wait until the worker reaches a host-call boundary and acknowledges.
      const deadline = performance.now() + 5000;
      if (started) while (Atomics.load(ack, 0) < old + 1 && !Atomics.load(new Int32Array(this.g.mem.buffer, t.control + 4, 1), 0)) {
        if (performance.now() > deadline) throw new Error(`guest thread ${this.g.u32(t.control + 8)} did not suspend`);
        Atomics.wait(new Int32Array(this.g.mem.buffer, 0x2140, 1), 0, 0, 2);
      }
      return old + 1;
    }
  }
} };
// Thread priority and affinity are advisory for this cooperative host; the
// guest still gets truthful success/failure results.
SHIMS['kernel32.dll!TryEnterCriticalSection'] = { arity: 1, pop: 4, fn: function (p) {
  const g = this.g;
  if (g.sharedHeap) {
    if (!p || p % 4 || g.u32(p) !== 0xffffffff) throw new Error('try-enter uninitialized critical section');
    const owner = new Int32Array(g.mem.buffer, p + 12, 1), id = g.threadId;
    const current = Atomics.load(owner, 0);
    if (current !== id && Atomics.compareExchange(owner, 0, 0, id) !== 0) return 0;
    const count = g.u32(p + 8) + 1;
    g.u32(p + 8, count); g.u32(p + 4, count - 1); return 1;
  }
  const count = g.criticalSections.get(p);
  if (count === undefined) throw new Error('try-enter uninitialized critical section');
  if (count) return 0;
  g.criticalSections.set(p, 1); g.u32(p + 4, 0); g.u32(p + 8, 1); g.u32(p + 12, 1);
  return 1;
} };
// ETW is optional diagnostics; the guest may query providers without one.
SHIMS['advapi32.dll!EventRegister'] = { arity: 4, pop: 16, fn: function (_provider, _enable, _context, out) {
  if (out) this.g.u32(out, 0); return 0;
} };
SHIMS['advapi32.dll!EventWrite'] = { arity: 4, pop: 16, fn: () => 0 };
SHIMS['advapi32.dll!EventUnregister'] = { arity: 1, pop: 4, fn: () => 0 };
SHIMS['kernel32.dll!SetThreadPriority'] = { arity: 2, pop: 8, fn: function (h, priority) {
  if (priority < -15 || priority > 15) { this.g.lastError = 87; return 0; }
  const t = this.g.handles.get(h);
  if (t && t.type === 'thread') t.priority = priority;
  return 1;
} };
SHIMS['kernel32.dll!GetThreadPriority'] = { arity: 1, pop: 4, fn: function (h) {
  const t = this.g.handles.get(h);
  if (!t || t.type !== 'thread') { this.g.lastError = 6; return 0x7fffffff; }
  return t.priority ?? 0;
} };
// Thread/process priority boost is a scheduling hint only; the headless host
// already runs each guest thread in its own worker.
K('SetThreadPriorityBoost', function (h, disable) {
  const t = this.g.handles.get(h);
  if (t && t.type === 'thread') t.priorityBoostDisabled = !!disable;
  return 1;
});
K('GetThreadPriorityBoost', function (h, out) {
  const t = this.g.handles.get(h);
  if (!t || t.type !== 'thread') { this.g.lastError = 6; return 0; }
  if (out) this.g.u32(out, t.priorityBoostDisabled ? 1 : 0);
  return 1;
});
K('SetProcessPriorityBoost', () => 1);
K('GetProcessPriorityBoost', function (_p, out) { if (out) this.g.u32(out, 0); return 1; });
SHIMS['kernel32.dll!SetThreadAffinityMask'] = { arity: 2, pop: 8, fn: function (_h, mask) {
  if (!mask) { this.g.lastError = 87; return 0; }
  return 1;
} };
SHIMS['kernel32.dll!GetProcessAffinityMask'] = { arity: 3, pop: 12, fn: function (_p, procMask, sysMask) {
  if (procMask) this.g.u32(procMask, 1);
  if (sysMask) this.g.u32(sysMask, 1);
  return 1;
} };
K('GetCurrentThread', () => -2);
SHIMS['kernel32.dll!OpenThread'] = { arity: 3, pop: 12, fn: function (_access, _inherit, id) {
  const t = [...this.g.handles.values()].find(v => v.type === 'thread' && this.g.u32(v.control + 8) === id);
  if (!t) { this.g.lastError = 87; return 0; }
  const handle = this.g.sharedHeap ? this.g.alloc(16) : this.g.nextHandle++;
  if (this.g.sharedHeap) this.g.aliasHandles.add(handle);
  t.refs++; this.g.handles.set(handle, t);
  return handle;
} };
SHIMS['kernel32.dll!SetThreadContext'] = { arity: 2, pop: 8, fn: function (h, p) {
  const t = this.g.handles.get(h);
  if (!t || t.type !== 'thread' || !p) { this.g.lastError = 6; return 0; }
  const flags = this.g.u32(p);
  if (flags !== 0x10010) throw new Error(`unsupported SetThreadContext flags 0x${flags.toString(16)}`);
  // Hardware breakpoints are recorded but not yet trapped by lifted code; the
  // retail engine only uses them for its crash handler. Documented limitation.
  t.debugRegisters = Array.from({ length: 6 }, (_, i) => this.g.u32(p + 4 + i * 4));
  return 1;
} };
K('GetProcessHeap', () => 0x10);
// Every Win32 heap draws from the one process heap. Handles are unique (shared counter) so code that
// tells heaps apart behaves; HeapDestroy does not reclaim blocks, which only leaks private-heap memory.
K('HeapCreate', function () {
  const cell = new Int32Array(this.g.mem.buffer, 0x2168, 1);
  return 0x20 + 0x10 * (Atomics.add(cell, 0, 1) + 1);
});
K('HeapDestroy', () => 1);
K('HeapSize', function (h, flags, p) { return this.g.allocationSize(p) || 0xffffffff; });
K('HeapAlloc', function (h, flags, n) { return this.g.alloc(n); });
K('HeapFree', function (h, flags, p) { this.g.free(p); return 1; });
K('HeapReAlloc', function (h, flags, p, n) { return this.g.realloc(p, n); });
SHIMS['kernel32.dll!HeapSize'] = { arity: 3, pop: 12, fn: function (_heap, _flags, p) {
  const size = this.g.allocationSize(p);
  if (!size) { this.g.lastError = 6; return -1; }
  return size;
} };
// Executable memory cannot exist: wasm cannot run x86 that the guest generates at run time. Requests for it
// fail like a DEP-restricted process, so JITs (LuaJIT) fall back to their interpreters.
const EXEC_PROT = 0xf0;   // PAGE_EXECUTE (0x10), _READ (0x20), _READWRITE (0x40), _WRITECOPY (0x80)
K('VirtualAlloc', function (a, n, t, p) {
  if (p & EXEC_PROT) { this.g.lastError = 5; return 0; }
  if (ENV.GUEST_DEBUG_VALLOC && n >= 0x100000) this.g.log(`[valloc] addr=0x${a.toString(16)} size=0x${n.toString(16)} type=0x${t.toString(16)} prot=0x${p.toString(16)} top=0x${this.g.vTop.toString(16)} ${this.g.backtrace(this.g.cur.ex.esp.value >>> 0, 24).join(' <- ')}`);
  return this.g.valloc(a, n);
});
K('VirtualFree', () => 1); K('VirtualProtect', function (a, n, p, old) { if (p & EXEC_PROT) { this.g.lastError = 5; return 0; } if (old) this.g.u32(old, 4); return 1; });
K('VirtualQuery', function (a, buf, n) { return 0; });
K('TlsAlloc', function () { return this.g.tlsAlloc(); });
K('TlsFree', () => 1); K('TlsGetValue', function (i) { return this.g.tlsGet(i); });
K('TlsSetValue', function (i, v) { return this.g.tlsSet(i,v); });
K('FlsAlloc', function (cb) { return this.g.tlsAlloc(); });
K('FlsFree', () => 1); K('FlsGetValue', function (i) { return this.g.tlsGet(i); });
K('FlsSetValue', function (i, v) { return this.g.tlsSet(i,v); });
function initCritical(g, p, spin = 0) {
  if (g.sharedHeap) {
    if (!p || p % 4 || g.u32(p) === 0xffffffff) throw new Error(`invalid critical section initialization at 0x${p.toString(16)} backtrace: ${g.backtrace(g.cur.ex.esp.value >>> 0, 40).join(' <- ')}`);
    g.u8.fill(0, p, p + 24); g.u32(p, 0xffffffff); g.u32(p + 4, 0xffffffff); g.u32(p + 20, spin);
    return;
  }
  if (!p || g.criticalSections.has(p)) throw new Error(`invalid critical section initialization at 0x${p.toString(16)}`);
  g.u8.fill(0, p, p + 24); g.u32(p + 4, 0xffffffff); g.u32(p + 20, spin);
  g.criticalSections.set(p, 0);
}
SHIMS['kernel32.dll!InitializeCriticalSection'] = { arity: 1, pop: 4, fn: function (p) { initCritical(this.g, p); } };
K('InitializeCriticalSectionAndSpinCount', function (p, spin) { initCritical(this.g, p, spin); return 1; });
K('InitializeCriticalSectionEx', function (p, spin) { initCritical(this.g, p, spin); return 1; });
K('EnterCriticalSection', function (p) {
  if (this.g.sharedHeap) {
    if (!p || p % 4 || this.g.u32(p) !== 0xffffffff) throw new Error(`enter uninitialized critical section 0x${p.toString(16)}`);
    const owner = new Int32Array(this.g.mem.buffer, p + 12, 1), id = this.g.threadId;
    const start = performance.now();
    for (;;) {
      const current = Atomics.load(owner, 0);
      if (ENV.GUEST_DEBUG_WAIT && performance.now() - start > 1000 && !this._csWarned) {
        this._csWarned = true;
        console.log(`[wait] thread ${id} blocked on critical section 0x${p.toString(16)} held by thread ${current}`);
      }
      if (current === id || (current === 0 && Atomics.compareExchange(owner, 0, 0, id) === 0)) {
        const count = this.g.u32(p + 8) + 1;
        this.g.u32(p + 8, count); this.g.u32(p + 4, count - 1); return;
      }
      Atomics.wait(owner, 0, current);
    }
  }
  if (!this.g.criticalSections.has(p)) throw new Error(`enter uninitialized critical section 0x${p.toString(16)}`);
  const count = this.g.criticalSections.get(p) + 1;
  this.g.criticalSections.set(p, count); this.g.u32(p + 4, count - 1);
  this.g.u32(p + 8, count); this.g.u32(p + 12, 1);
});
K('LeaveCriticalSection', function (p) {
  if (this.g.sharedHeap) {
    if (!p || p % 4 || this.g.u32(p) !== 0xffffffff) throw new Error(`leave uninitialized critical section 0x${p.toString(16)}`);
    const owner = new Int32Array(this.g.mem.buffer, p + 12, 1), count = this.g.u32(p + 8);
    if (Atomics.load(owner, 0) !== this.g.threadId || !count) throw new Error(`leave unowned critical section 0x${p.toString(16)}`);
    this.g.u32(p + 8, count - 1); this.g.u32(p + 4, count - 2);
    if (count === 1) { Atomics.store(owner, 0, 0); Atomics.notify(owner, 0, 1); }
    return;
  }
  const count = this.g.criticalSections.get(p);
  if (!count) throw new Error(`leave unowned critical section 0x${p.toString(16)}`);
  this.g.criticalSections.set(p, count - 1); this.g.u32(p + 4, count - 2);
  this.g.u32(p + 8, count - 1); if (count === 1) this.g.u32(p + 12, 0);
});
K('DeleteCriticalSection', function (p) {
  if (this.g.sharedHeap) {
    if (!p || p % 4 || this.g.u32(p) !== 0xffffffff || this.g.u32(p + 12)) throw new Error(`delete invalid or owned critical section 0x${p.toString(16)}`);
    this.g.u32(p, 0); return;
  }
  if (!this.g.criticalSections.has(p) || this.g.criticalSections.get(p)) throw new Error(`delete invalid or owned critical section 0x${p.toString(16)}`);
  this.g.criticalSections.delete(p);
});
function srw(g, p) {
  if (!p) throw new Error('invalid SRW lock address');
  if (!g.srwLocks.has(p)) g.srwLocks.set(p, { writer: false, readers: 0 });
  return g.srwLocks.get(p);
}
SHIMS['kernel32.dll!AcquireSRWLockExclusive'] = { arity: 1, pop: 4, fn: function (p) {
  const lock = srw(this.g, p);
  if (lock.writer || lock.readers) throw new Error('blocking SRW lock requires guest thread scheduling');
  lock.writer = true; this.g.u32(p, 1);
} };
SHIMS['kernel32.dll!ReleaseSRWLockExclusive'] = { arity: 1, pop: 4, fn: function (p) {
  const lock = srw(this.g, p);
  if (!lock.writer) throw new Error('release of unowned exclusive SRW lock');
  lock.writer = false; this.g.u32(p, 0);
} };
SHIMS['kernel32.dll!AcquireSRWLockShared'] = { arity: 1, pop: 4, fn: function (p) {
  const lock = srw(this.g, p);
  if (lock.writer) throw new Error('blocking SRW lock requires guest thread scheduling');
  lock.readers++; this.g.u32(p, lock.readers * 2);
} };
SHIMS['kernel32.dll!ReleaseSRWLockShared'] = { arity: 1, pop: 4, fn: function (p) {
  const lock = srw(this.g, p);
  if (!lock.readers) throw new Error('release of unowned shared SRW lock');
  lock.readers--; this.g.u32(p, lock.readers * 2);
} };
// There can be no waiters until a real guest thread scheduler is available.
SHIMS['kernel32.dll!WakeAllConditionVariable'] = { arity: 1, pop: 4, fn: function (_p) {} };
SHIMS['kernel32.dll!WakeConditionVariable'] = { arity: 1, pop: 4, fn: function (_p) {} };
SHIMS['kernel32.dll!SleepConditionVariableSRW'] = { arity: 4, pop: 16, fn: function () {
  throw new Error('condition-variable waits require guest thread scheduling');
} };
K('InitializeSListHead', function (p) { this.g.u8.fill(0, p, p + 8); }); K('InterlockedFlushSList', () => 0);
// Real atomic operations: guest threads share one WebAssembly.Memory, so these
// must go through Atomics rather than read/modify/write in JS.
const i32at = (g, p) => new Int32Array(g.mem.buffer, p, 1);
const i64at = (g, p) => new BigInt64Array(g.mem.buffer, p, 1);
K('InterlockedIncrement', function (p) { return (Atomics.add(i32at(this.g, p), 0, 1) + 1) | 0; });
K('InterlockedDecrement', function (p) { return (Atomics.sub(i32at(this.g, p), 0, 1) - 1) | 0; });
K('InterlockedExchange', function (p, v) { return Atomics.exchange(i32at(this.g, p), 0, v | 0); });
K('InterlockedExchangeAdd', function (p, v) { return Atomics.add(i32at(this.g, p), 0, v | 0); });
K('InterlockedCompareExchange', function (p, value, compare) {
  return Atomics.compareExchange(i32at(this.g, p), 0, compare | 0, value | 0);
});
SHIMS['kernel32.dll!InterlockedIncrement64'] = { arity: 1, pop: 4, fn: function (p) {
  return BigInt64Array.from([Atomics.add(i64at(this.g, p), 0, 1n) + 1n])[0];
} };
SHIMS['kernel32.dll!InterlockedDecrement64'] = { arity: 1, pop: 4, fn: function (p) {
  return BigInt64Array.from([Atomics.sub(i64at(this.g, p), 0, 1n) - 1n])[0];
} };
SHIMS['kernel32.dll!InterlockedExchange64'] = { arity: 3, pop: 12, fn: function (p, lo, hi) {
  const v = BigInt(lo >>> 0) | (BigInt(hi >>> 0) << 32n);
  return BigInt64Array.from([Atomics.exchange(i64at(this.g, p), 0, v)])[0];
} };
SHIMS['kernel32.dll!InterlockedCompareExchange64'] = { arity: 5, pop: 20, fn: function (p, vlo, vhi, clo, chi) {
  const v = BigInt(vlo >>> 0) | (BigInt(vhi >>> 0) << 32n);
  const c = BigInt(clo >>> 0) | (BigInt(chi >>> 0) << 32n);
  return BigInt64Array.from([Atomics.compareExchange(i64at(this.g, p), 0, c, v)])[0];
} };
K('QueryPerformanceCounter', function (p) { this.g.dv.setBigUint64(p, BigInt(Math.floor(performance.now() * 1e6)), true); return 1; });
K('QueryPerformanceFrequency', function (p) { this.g.dv.setBigUint64(p, 1000000000n, true); return 1; });
K('GetTickCount', function () { return Math.floor(performance.now()) >>> 0; });
K('GetTickCount64', function () { return BigInt(Math.floor(performance.now())); });
K('SetHandleCount', function (n) { return n; });
K('GetSystemTimeAsFileTime', function (p) { this.g.dv.setBigUint64(p, BigInt(Date.now()) * 10000n + 116444736000000000n, true); });
// FILETIME <-> SYSTEMTIME <-> JS Date. FILETIME counts 100ns intervals since
// 1601-01-01 UTC; Unix epoch is 11644473600 seconds later.
const FILETIME_EPOCH = 116444736000000000n;
const fileTimeToDate = (t) => new Date(Number((t - FILETIME_EPOCH) / 10000n));
const dateToFileTime = (d) => BigInt(d.getTime()) * 10000n + FILETIME_EPOCH;
function writeSystemTime(g, p, d) {
  g.u8.fill(0, p, p + 16);
  g.dv.setUint16(p + 0, d.getUTCFullYear(), true);
  g.dv.setUint16(p + 2, d.getUTCMonth() + 1, true);
  g.dv.setUint16(p + 4, d.getUTCDay(), true);
  g.dv.setUint16(p + 6, d.getUTCDate(), true);
  g.dv.setUint16(p + 8, d.getUTCHours(), true);
  g.dv.setUint16(p + 10, d.getUTCMinutes(), true);
  g.dv.setUint16(p + 12, d.getUTCSeconds(), true);
  g.dv.setUint16(p + 14, d.getUTCMilliseconds(), true);
}
function readSystemTime(g, p) {
  return new Date(Date.UTC(
    g.dv.getUint16(p + 0, true), g.dv.getUint16(p + 2, true) - 1, g.dv.getUint16(p + 6, true),
    g.dv.getUint16(p + 8, true), g.dv.getUint16(p + 10, true), g.dv.getUint16(p + 12, true),
    g.dv.getUint16(p + 14, true)));
}
SHIMS['kernel32.dll!FileTimeToSystemTime'] = { arity: 2, pop: 8, fn: function (ft, st) {
  if (!ft || !st) { this.g.lastError = 87; return 0; }
  writeSystemTime(this.g, st, fileTimeToDate(this.g.dv.getBigUint64(ft, true)));
  return 1;
} };
SHIMS['kernel32.dll!SystemTimeToFileTime'] = { arity: 2, pop: 8, fn: function (st, ft) {
  if (!st || !ft) { this.g.lastError = 87; return 0; }
  this.g.dv.setBigUint64(ft, dateToFileTime(readSystemTime(this.g, st)), true);
  return 1;
} };
SHIMS['kernel32.dll!FileTimeToLocalFileTime'] = { arity: 2, pop: 8, fn: function (ft, out) {
  if (!ft || !out) { this.g.lastError = 87; return 0; }
  const d = fileTimeToDate(this.g.dv.getBigUint64(ft, true));
  this.g.dv.setBigUint64(out, dateToFileTime(new Date(d.getTime() - d.getTimezoneOffset() * 60000)), true);
  return 1;
} };
SHIMS['kernel32.dll!LocalFileTimeToFileTime'] = { arity: 2, pop: 8, fn: function (ft, out) {
  if (!ft || !out) { this.g.lastError = 87; return 0; }
  const d = fileTimeToDate(this.g.dv.getBigUint64(ft, true));
  this.g.dv.setBigUint64(out, dateToFileTime(new Date(d.getTime() + d.getTimezoneOffset() * 60000)), true);
  return 1;
} };
SHIMS['kernel32.dll!GetSystemTime'] = { arity: 1, pop: 4, fn: function (st) {
  writeSystemTime(this.g, st, new Date()); return 0;
} };
SHIMS['kernel32.dll!GetLocalTime'] = { arity: 1, pop: 4, fn: function (st) {
  const d = new Date();
  writeSystemTime(this.g, st, new Date(d.getTime() - d.getTimezoneOffset() * 60000)); return 0;
} };
SHIMS['kernel32.dll!SystemTimeToTzSpecificLocalTime'] = { arity: 3, pop: 12, fn: function (_tz, utc, local) {
  if (!utc || !local) { this.g.lastError = 87; return 0; }
  const d = readSystemTime(this.g, utc);
  writeSystemTime(this.g, local, new Date(d.getTime() - d.getTimezoneOffset() * 60000));
  return 1;
} };
SHIMS['kernel32.dll!TzSpecificLocalTimeToSystemTime'] = { arity: 3, pop: 12, fn: function (_tz, local, utc) {
  if (!local || !utc) { this.g.lastError = 87; return 0; }
  const d = readSystemTime(this.g, local);
  writeSystemTime(this.g, utc, new Date(d.getTime() + d.getTimezoneOffset() * 60000));
  return 1;
} };
SHIMS['kernel32.dll!GetTimeZoneInformation'] = { arity: 1, pop: 4, fn: function (out) {
  if (out) {
    this.g.u8.fill(0, out, out + 172);
    const off = new Date().getTimezoneOffset();
    this.g.u32(out, off > 0 ? 2 : 1);               // TIME_ZONE_ID_DAYLIGHT/STANDARD
    this.g.u32(out + 84, off);                      // Bias (minutes)
  }
  return 1;
} };
// ---------------- ws2_32 (capability boundary) ----------------
// The browser has no raw Winsock; WSAStartup only initializes the guest's
// emulated socket layer state. No socket is presented as connected. Any call
// that would need real networking fails explicitly with WSAENETDOWN.
const WSAENETDOWN = 10050, WSAEFAULT = 10014, WSAEINVAL = 10022, WSAENOTCONN = 10057;
function wsaState(g) { return g.wsa ||= { started: false, error: 0, version: 0x0202 }; }
SHIMS['ws2_32.dll!WSAStartup'] = { arity: 2, pop: 8, fn: function (requested, data) {
  const g = this.g, st = wsaState(g);
  if (!data) { st.error = WSAEFAULT; return WSAEFAULT; }
  const ver = requested & 0xffff;
  st.started = true;
  st.version = (ver >= 0x0202 ? 0x0202 : ver) || 0x0101;
  g.u8.fill(0, data, data + 400);
  g.dv.setUint16(data, st.version, true);
  g.dv.setUint16(data + 2, 0x0202, true);
  const desc = 'Host-emulated Winsock (no network transport)';
  const status = 'Offline';
  for (let i = 0; i < desc.length; i++) g.u8[data + 4 + i] = desc.charCodeAt(i);
  for (let i = 0; i < status.length; i++) g.u8[data + 4 + 257 + i] = status.charCodeAt(i);
  return 0;
} };
SHIMS['ws2_32.dll!WSACleanup'] = { arity: 0, pop: 0, fn: function () { wsaState(this.g).started = false; return 0; } };
SHIMS['ws2_32.dll!WSAGetLastError'] = { arity: 0, pop: 0, fn: function () { return wsaState(this.g).error; } };
SHIMS['ws2_32.dll!WSASetLastError'] = { arity: 1, pop: 4, fn: function (e) { wsaState(this.g).error = e | 0; return 0; } };
SHIMS['ws2_32.dll!__WSAFDIsSet'] = { arity: 2, pop: 8, fn: function (_s, set) {
  // fd_set: u_int fd_count followed by SOCKET fd_array[]; only used to test
  // readiness of real sockets, which do not exist here.
  return 0;
} };
// There is no browser socket transport yet. These return the real Winsock
// failure code rather than pretending a socket exists.
function wsaFail(g, name) {
  const st = wsaState(g);
  st.error = WSAENETDOWN;
  if (!g.wsaLogged) g.wsaLogged = new Set();
  if (!g.wsaLogged.has(name)) { g.wsaLogged.add(name); g.log(`[ws2] ${name} -> WSAENETDOWN (no transport in this host)`); }
  return -1;
}
const WS = (name, arity, fn) => { SHIMS[`ws2_32.dll!${name}`] = { arity, pop: 4 * arity, fn }; };
WS('socket', 3, function () { return wsaFail(this.g, 'socket'); });
WS('closesocket', 1, () => 0);
WS('ioctlsocket', 3, function () { return wsaFail(this.g, 'ioctlsocket'); });
WS('bind', 3, function () { return wsaFail(this.g, 'bind'); });
WS('connect', 3, function () { return wsaFail(this.g, 'connect'); });
WS('listen', 2, function () { return wsaFail(this.g, 'listen'); });
WS('accept', 3, function () { return wsaFail(this.g, 'accept'); });
WS('send', 4, function () { return wsaFail(this.g, 'send'); });
WS('recv', 4, function () { return wsaFail(this.g, 'recv'); });
WS('sendto', 6, function () { return wsaFail(this.g, 'sendto'); });
WS('recvfrom', 6, function () { return wsaFail(this.g, 'recvfrom'); });
WS('select', 5, function () { return wsaFail(this.g, 'select'); });
WS('getsockname', 3, function () { return wsaFail(this.g, 'getsockname'); });
WS('getpeername', 3, function () { return wsaFail(this.g, 'getpeername'); });
WS('setsockopt', 5, function () { return wsaFail(this.g, 'setsockopt'); });
WS('getsockopt', 5, function () { return wsaFail(this.g, 'getsockopt'); });
WS('gethostname', 2, function () { return wsaFail(this.g, 'gethostname'); });
WS('WSACreateEvent', 0, function () { return WSAENETDOWN; });
K('EncodePointer', (p) => p); K('DecodePointer', (p) => p);
const wstr = (g, p) => { let s = ''; for (let i = 0; i < 260; i++) { const c = g.dv.getUint16(p + 2 * i, true); if (!c) break; s += String.fromCharCode(c); } return s; };
const systemModules = new Set(['kernel32.dll', 'kernelbase.dll', 'ntdll.dll', 'user32.dll',
  'advapi32.dll', 'ws2_32.dll', 'wsock32.dll', 'winmm.dll', 'gdi32.dll', 'shell32.dll', 'ole32.dll', 'oleaut32.dll', 'rpcrt4.dll',
  'imm32.dll', 'shlwapi.dll', 'wininet.dll', 'version.dll', 'd3d9.dll', 'd3dx9_40.dll']);   // host-provided system modules
const HOST_MODULES = new Set(['html_chromium.dll']);
function moduleHandle(g, path) {
  const name = path.replaceAll('\\', '/').split('/').pop().toLowerCase();
  const dll = g.dlls.get(name);
  if (dll) return dll.meta.base;
  if (HOST_MODULES.has(name) && !ENV.HTML_USE_STUB) {
    if (!g.systemHandles.has(name)) g.systemHandles.set(name, 0x7ff00000 + 0x10000 * g.systemHandles.size);
    return g.systemHandles.get(name);
  }
  if (!systemModules.has(name) && !name.startsWith('api-ms-win-')) return 0;
  if (!g.systemHandles.has(name)) g.systemHandles.set(name, 0x7ff00000 + 0x10000 * g.systemHandles.size);
  return g.systemHandles.get(name);
}
K('GetModuleHandleA', function (n) { return n ? moduleHandle(this.g, this.g.readStr(n)) : 0x00400000; });
K('GetModuleHandleW', function (n) { return n ? moduleHandle(this.g, wstr(this.g, n)) : 0x00400000; });
K('GetModuleHandleExA', function (f, n, out) { if (out) this.g.u32(out, 0x00400000); return 1; });
K('GetModuleHandleExW', function (f, n, out) { if (out) this.g.u32(out, 0x00400000); return 1; });
K('GetProcAddress', function (handle, ptr) {
  const name = ptr <= 0xffff ? `#${ptr}` : this.g.readStr(ptr);
  if (ENV.GUEST_DEBUG_PROC && /shader|Shader/i.test(name)) console.log(`[proc] GetProcAddress ${name}`);
  const target = [...this.g.dlls.values()].find(d => d.meta.base === handle);
  const resolved = target && this.g.resolveExport(target, name);
  if (resolved) return resolved;
  const mod = [...this.g.systemHandles].find(([, h]) => h === handle)?.[0];
  if (mod === 'html_chromium.dll' && name === 'g_pHtmlSystem') return (this.g.htmlHost ||= createHtmlHost(this.g, this.dll)).cell;
  // API-set DLLs (api-ms-win-*) forward to the implementation modules; resolve
  // them the same way Windows does rather than failing the lookup.
  let sh = mod && SHIMS[`${mod}!${name}`], key = sh ? `${mod}!${name}` : null;
  if (!sh && (mod?.startsWith('api-ms-win-') || mod === 'kernelbase.dll')) {
    for (const base of ['kernel32.dll', 'advapi32.dll']) {
      sh = SHIMS[`${base}!${name}`];
      if (sh) { key = `${base}!${name}`; break; }
    }
  }
  if (!sh) {
    if (ENV.GUEST_DEBUG_PROC) console.log(`[proc] missing ${mod || handle} :: ${name}`);
    this.g.lastError = 127; return 0;
  }
  this.dll.dynamicThunks ||= new Map();
  if (!this.dll.dynamicThunks.has(key)) {
    const arity = sh.arity ?? sh.fn.length;
    this.dll.dynamicThunks.set(key, this.g.extraThunk(this.dll, key, sh.fn, sh.pop ?? 4 * arity, !!sh.cdecl, arity));
  }
  return this.dll.dynamicThunks.get(key);
});
function loadLibrary(g, name) {
  const handle = moduleHandle(g, name);
  if (!handle) g.lastError = 126; // actual DLLs must currently be preloaded
  return handle;
}
K('LoadLibraryA', function (p) { const n = this.g.readStr(p); const h = loadLibrary(this.g, n); if (ENV.GUEST_DEBUG_PROC) console.log(`[proc] LoadLibraryA(${JSON.stringify(n)}) -> 0x${(h>>>0).toString(16)}`); return h; });
SHIMS['kernel32.dll!LoadLibraryW'] = { arity: 1, pop: 4, fn: function (p) {
  const n = wstr(this.g, p); const h = loadLibrary(this.g, n);
  if (ENV.GUEST_DEBUG_PROC) console.log(`[proc] LoadLibraryW(${JSON.stringify(n)}) -> 0x${(h>>>0).toString(16)}`);
  return h;
} };
K('LoadLibraryExW', function (p) { return loadLibrary(this.g, wstr(this.g, p)); });
SHIMS['kernel32.dll!LoadLibraryExA'] = { arity: 3, pop: 12, fn: function (p) {
  const n = this.g.readStr(p); const h = loadLibrary(this.g, n);
  if (ENV.GUEST_DEBUG_PROC) console.log(`[proc] LoadLibraryExA(${JSON.stringify(n)}) -> 0x${(h >>> 0).toString(16)}`);
  return h;
} };
K('FreeLibrary', () => 1);
function modulePath(g, h) {
  if (!h) return 'c:\\gamebox\\gmod.exe';
  const dll = [...g.dlls.values()].find(d => d.meta.base === h);
  return dll ? `c:\\gamebox\\${dll.name}` : '';
}
K('GetModuleFileNameA', function (h, buf, n) {
  const s = modulePath(this.g, h);
  if (!s) { this.g.lastError = 126; return 0; }
  if (n < s.length + 1) { this.g.lastError = 122; if (n) this.g.u8[buf + n - 1] = 0; return n; }
  for (let i = 0; i < s.length; i++) this.g.u8[buf + i] = s.charCodeAt(i);
  this.g.u8[buf + s.length] = 0; return s.length;
});
K('GetModuleFileNameW', function (h, buf, n) {
  const s = modulePath(this.g, h);
  if (!s) { this.g.lastError = 126; return 0; }
  if (n < s.length + 1) { this.g.lastError = 122; if (n) this.g.dv.setUint16(buf + 2 * (n - 1), 0, true); return n; }
  return setWstr(this.g, buf, s, n);
});
const setWstr = (g, p, s, max) => {
  const n = Math.min(s.length, max - 1);
  for (let i = 0; i < n; i++) g.dv.setUint16(p + 2 * i, s.charCodeAt(i), true);
  g.dv.setUint16(p + 2 * n, 0, true);
  return n;
};
// The virtual process directory; every path is confined to the mounted volume.
const VIRTUAL_CWD = 'c:\\gamebox';
function setCwd(g, name) {
  const normalized = name.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
  if (normalized !== 'c:\\gamebox') { g.lastError = 3; return 0; }
  return 1;
}
K('GetCurrentDirectoryW', function (n, buf) {
  if (ENV.GUEST_DEBUG_CWD) console.log(`[cwd] GetCurrentDirectoryW n=${n} buf=0x${buf.toString(16)} blocks=${this.g.lastBlocks(30).join(' ')}`);
  if (n < VIRTUAL_CWD.length + 1) { this.g.lastError = 206; return VIRTUAL_CWD.length + 1; }
  return setWstr(this.g, buf, VIRTUAL_CWD, n);
});
K('SetCurrentDirectoryW', function (p) { return setCwd(this.g, wstr(this.g, p)); });
function fullPath(name) {
  let s = name.replace(/\//g, '\\');
  if (!/^[a-z]:/i.test(s)) s = VIRTUAL_CWD + '\\' + s;
  const [drive, ...parts] = s.split('\\');
  const out = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!out.length) return null; out.pop(); continue; }
    out.push(part);
  }
  return drive + '\\' + out.join('\\');
}
function getFullPath(g, namePtr, n, buf, filePart, wide) {
  const input = wide ? wstr(g, namePtr) : g.readStr(namePtr);
  if (ENV.GUEST_DEBUG_CWD) console.log(`[cwd] GetFullPathName${wide ? 'W' : 'A'}(${JSON.stringify(input)}) n=${n}`);
  const full = fullPath(input);
  if (!full) { g.lastError = 3; return 0; }
  const needed = full.length + 1;
  if (n < needed) { g.lastError = 206; return needed; }
  if (wide) setWstr(g, buf, full, n);
  else { for (let i = 0; i < full.length; i++) g.u8[buf + i] = full.charCodeAt(i); g.u8[buf + full.length] = 0; }
  if (filePart) {
    const index = full.lastIndexOf('\\');
    const part = full.slice(index + 1);
    if (wide) setWstr(g, filePart, part, part.length + 1);
    else { for (let i = 0; i < part.length; i++) g.u8[filePart + i] = part.charCodeAt(i); g.u8[filePart + part.length] = 0; }
  }
  return full.length;
}
K('GetFullPathNameW', function (p, n, buf, part) { return getFullPath(this.g, p, n, buf, part, true); });
K('GetFullPathNameA', function (p, n, buf, part) { return getFullPath(this.g, p, n, buf, part, false); });
SHIMS['kernel32.dll!GetTempPathW'] = { arity: 2, pop: 8, fn: function (n, buf) {
  const s = 'c:\\gamebox\\garrysmod\\cache\\';
  if (n < s.length + 1) { this.g.lastError = 206; return s.length + 1; }
  setWstr(this.g, buf, s, n); return s.length;
} };
SHIMS['kernel32.dll!GetCurrentDirectoryA'] = { arity: 2, pop: 8, fn: function (n, buf) {
  if (ENV.GUEST_DEBUG_CWD) console.log(`[cwd] GetCurrentDirectoryA n=${n} buf=0x${(buf>>>0).toString(16)} retAddr=0x${this.g.u32(this.esp).toString(16)}`);
  const s = VIRTUAL_CWD;
  if (n < s.length + 1) { this.g.lastError = 206; return s.length + 1; }
  for (let i = 0; i < s.length; i++) this.g.u8[buf + i] = s.charCodeAt(i);
  this.g.u8[buf + s.length] = 0; return s.length;
} };
SHIMS['kernel32.dll!SetCurrentDirectoryA'] = { arity: 1, pop: 4, fn: function (p) {
  return setCwd(this.g, this.g.readStr(p));
} };
K('IsProcessorFeaturePresent', (f) => (f === 10 || f === 6 || f === 3 ? 1 : 0));
K('IsDebuggerPresent', () => 0); K('SetUnhandledExceptionFilter', () => 0); K('UnhandledExceptionFilter', () => 0);
K('GetCommandLineA', function () { return this.g.cmdline; }); K('GetCommandLineW', function () { return this.g.envw; });
K('GetEnvironmentStringsW', function () { return this.g.envw; }); K('FreeEnvironmentStringsW', () => 1);
K('SetEnvironmentVariableW', () => 1);
K('GetStartupInfoW', function (p) { this.g.u8.fill(0, p, p + 68); this.g.u32(p, 68); });
K('GetStdHandle', (n) => 0x20 + (n & 3)); K('SetStdHandle', () => 1);
K('GetFileType', function (h) { if (this.g.files?.object(h)) return 1; if (h >= 0x20 && h <= 0x23) return 2; this.g.lastError = 6; return 0; });
K('GetConsoleMode', () => 0);
K('GetConsoleOutputCP', () => 65001); K('GetACP', () => 65001); K('GetOEMCP', () => 437); K('IsValidCodePage', () => 1);
K('GetCPInfo', function (cp, p) { this.g.u8.fill(0, p, p + 20); this.g.u32(p, 1); return 1; });
K('WriteFile', function (h, buf, n, written, ov) {
  if (this.g.files?.object(h)) return this.g.files.write(h, buf, n, written, ov);
  if (h < 0x20 || h > 0x23) { this.g.lastError = 6; return 0; }
  const s = utf8d.decode(this.g.u8.slice(buf, buf + n)); this.g.out.push(s); this.g.log(s.trimEnd());
  if (/shader API/i.test(s)) {
    const esp = this.g.cur.ex.esp.value >>> 0;
    const stack = Array.from({ length: 64 }, (_, k) => this.g.u32((esp + 4 * k) >>> 0))
      .filter(v => v >= 0xc000000 && v < 0xc2153000).slice(0, 6).map(v => '0x' + v.toString(16)).join(',');
    const e = this.g.cur.ex; const chain = [];
    let f = e.ebp.value >>> 0;
    for (let k = 0; k < 24 && f > 0x1000 && f < 0x80000000; k++) {
      const ret = this.g.u32(f + 4) >>> 0;
      if (ret >= 0xc000000 && ret < 0xc2153000) chain.push('0x' + ret.toString(16));
      const next = this.g.u32(f) >>> 0; if (next <= f) break; f = next;
    }
    this.g.log(`[trace] WriteFile caller=0x${this.g.u32(esp).toString(16)} materialsystem frames=${chain.join('<')} stack=${stack}`);
  }
  if (written) this.g.u32(written, n); return 1;
});
K('WriteConsoleW', function (h, buf, n, written) { if (written) this.g.u32(written, n); return 1; });
K('FlushFileBuffers', function (h) { return this.g.files?.object(h) ? this.g.files.flush(h) : 1; });
function createEvent(g, manual, initial, name) {
  if (g.sharedEvents) {
    const result = g.sharedEvents.create(manual, initial, name);
    g.lastError = result.exists ? 183 : 0;
    return result.handle;
  }
  let event = name && g.namedEvents.get(name);
  if (event) g.lastError = 183; // ERROR_ALREADY_EXISTS
  else {
    event = { type: 'event', manual: !!manual, signaled: !!initial, name, refs: 0 };
    if (name) g.namedEvents.set(name, event);
    g.lastError = 0;
  }
  const h = g.nextHandle++; event.refs++; g.handles.set(h, event); return h;
}
K('CreateEventW', function (_security, manual, initial, name) { return createEvent(this.g, manual, initial, name ? wstr(this.g, name) : ''); });
SHIMS['kernel32.dll!CreateEventA'] = { arity: 4, pop: 16, fn: function (_security, manual, initial, name) {
  return createEvent(this.g, manual, initial, name ? this.g.readStr(name) : '');
} };
function signaled(g, h) {
  if (g.sharedEvents?.lookup(h)) {
    const p = g.sharedEvents.lookup(h);
    return Atomics.load(new Int32Array(g.mem.buffer, p + 4, 1), 0) === 1;
  }
  if (g.files?.object(h)) return true; // synchronous file handles are always ready
  const e = g.handles.get(h);
  if (!e) throw new Error(`invalid wait handle 0x${h.toString(16)}`);
  if (e.type === 'thread') return Atomics.load(new Int32Array(g.mem.buffer, e.control + 4, 1), 0) !== 0;
  if (e.type === 'event') return e.signaled;
  return true;
}
function consumeEvent(g, h) {
  if (g.sharedEvents?.lookup(h)) {
    const p = g.sharedEvents.lookup(h);
    if (g.u32(p + 8)) return; // manual reset
    Atomics.store(new Int32Array(g.mem.buffer, p + 4, 1), 0, 0);
    return;
  }
  const e = g.handles.get(h);
  if (e?.type === 'event' && !e.manual) e.signaled = false;
}
SHIMS['kernel32.dll!WaitForMultipleObjects'] = { arity: 4, pop: 16, fn: function (count, handles, waitAll, ms) {
  const g = this.g;
  if (!count || count > 64) { g.lastError = 87; return 0xffffffff; }
  const list = Array.from({ length: count }, (_, i) => g.u32(handles + i * 4) >>> 0);
  if (ENV.GUEST_DEBUG_WAIT && (g.wmEntered = (g.wmEntered || 0) + 1) < 60)
    console.log(`[wait] thread ${g.threadId} WfMO enter count=${count} handles=${list.map(h => '0x' + h.toString(16)).join(',')} ms=${ms}`);
  const deadline = ms === 0xffffffff ? Infinity : performance.now() + ms;
  const scratch = new Int32Array(g.mem.buffer, 0x2140, 1); // shared sleep cell
  const debug = !!ENV.GUEST_DEBUG_WAIT, started = performance.now();
  for (;;) {
    if (g.currentThreadControl) g.yieldToSuspension();
    if (debug && performance.now() - started > 1000 && !this._warned) {
      this._warned = true;
      console.log(`[wait] thread ${g.threadId} waiting count=${count} all=${waitAll} ms=${ms} ` +
        list.map(h => `${h.toString(16)}:${signaled(g, h) ? 'S' : '-'}`).join(' ') +
        ` caller=0x${g.u32(this.esp).toString(16)}`);
    }
    const states = list.map(h => signaled(g, h));
    if (waitAll ? states.every(Boolean) : states.some(Boolean)) {
      const index = waitAll ? 0 : states.indexOf(true);
      if (ENV.GUEST_DEBUG_WAIT && (g.wmLogged = (g.wmLogged || 0) + 1) < 40)
        console.log(`[wait] thread ${g.threadId} WfMO -> ${index} handles=${list.map(h => '0x' + h.toString(16)).join(',')}`);
      if (waitAll) for (const h of list) consumeEvent(g, h);
      else consumeEvent(g, list[index]);
      return index;
    }
    if (performance.now() >= deadline) return 258;
    Atomics.wait(scratch, 0, 0, Math.max(1, Math.min(deadline - performance.now(), 10)));
  }
} };
SHIMS['kernel32.dll!WaitForMultipleObjectsEx'] = SHIMS['kernel32.dll!WaitForMultipleObjects'];
SHIMS['kernel32.dll!Sleep'] = { arity: 1, pop: 4, fn: function (ms) {
  const g = this.g;
  if (ENV.GUEST_LOG_SLEEP && ms && ((g.sleepLogs = (g.sleepLogs || 0) + 1) % 50 === 1)) console.log(`[sleep] ${ms}ms t${g.threadId} from ${g.symbolize(g.u32(this.esp))} <- ${g.backtrace(this.esp, 16).slice(0, 4).join(' <- ')}`);
  if (ENV.GUEST_DEBUG_THREADS) {
    g.sleeps = (g.sleeps || 0) + 1;
    if (g.sleeps < 20 || g.sleeps % 500 === 0) {
      const threads = [...g.handles.values()].filter(x => x.type === 'thread')
        .map(t => `${g.u32(t.control + 8)}:${Atomics.load(new Int32Array(g.mem.buffer, t.control + 4, 1), 0)}` +
          `/${Atomics.load(new Int32Array(g.mem.buffer, t.control + 504, 1), 0)}`).join(' ');
      console.log(`[thread] Sleep(${ms}) t${g.threadId} #${g.sleeps} threads=${threads}`);
      for (const t of g.handles.values()) {
        if (t.type !== 'thread' || t.reported || Atomics.load(new Int32Array(g.mem.buffer, t.control + 4, 1), 0) !== 2) continue;
        t.reported = true;
        console.log(`[thread] worker ${g.u32(t.control + 8)} FAILED: ${g.readStr(t.control + 16, 495)}`);
      }
    }
  }
  const deadline = performance.now() + ms;
  const scratch = new Int32Array(g.mem.buffer, 0x2140, 1);
  do {
    if (g.currentThreadControl) g.yieldToSuspension();
    const remaining = deadline - performance.now();
    if (remaining <= 0) break;
    Atomics.wait(scratch, 0, 0, Math.min(remaining, 10));
  } while (true);
} };
SHIMS['kernel32.dll!SwitchToThread'] = { arity: 0, pop: 0, fn: function () {
  if (this.g.currentThreadControl) this.g.yieldToSuspension();
  const scratch = new Int32Array(this.g.mem.buffer, 0x2140, 1);
  Atomics.wait(scratch, 0, 0, 0);
  return 1;
} };
SHIMS['kernel32.dll!SleepEx'] = SHIMS['kernel32.dll!Sleep'];
K('CloseHandle', function (h) {
  if (this.g.sharedEvents?.lookup(h)) return this.g.sharedEvents.close(h) ? 1 : 0;
  if (this.g.files?.object(h)) return this.g.files.close(h) ? 1 : 0;
  const obj = this.g.handles.get(h);
  if (!obj) { this.g.lastError = 6; return 0; }
  this.g.handles.delete(h);
  if (this.g.aliasHandles.delete(h)) this.g.free(h);
  if (--obj.refs === 0 && obj.name) this.g.namedEvents.delete(obj.name);
  return 1;
});
function eventOp(g, h, signaled) {
  if (ENV.GUEST_DEBUG_WAIT && (g.setLogged = (g.setLogged || 0) + 1) < 60)
    console.log(`[wait] thread ${g.threadId} event 0x${h.toString(16)} -> ${signaled}`);
  if (g.sharedEvents) {
    if (!g.sharedEvents.signal(h, signaled)) { g.lastError = 6; return 0; }
    return 1;
  }
  const e = g.handles.get(h);
  if (!e || e.type !== 'event') { g.lastError = 6; return 0; }
  e.signaled = signaled; return 1;
}
K('SetEvent', function (h) { return eventOp(this.g, h, true); });
K('ResetEvent', function (h) { return eventOp(this.g, h, false); });
function waitOne(g, h, timeout) {
  const poll = () => { if (g.currentThreadControl) g.yieldToSuspension(); };
  if (g.sharedEvents?.lookup(h)) return g.sharedEvents.wait(h, timeout, poll);
  const e = g.handles.get(h);
  if (e?.type === 'thread') {
    const state = new Int32Array(g.mem.buffer, e.control + 4, 1);
    let result = Atomics.load(state, 0);
    if (!result && !timeout) return 258;
    const deadline = timeout === 0xffffffff ? Infinity : performance.now() + timeout;
    while (!result) {
      poll();
      const remaining = deadline - performance.now();
      if (remaining <= 0) return 258;
      Atomics.wait(state, 0, 0, Math.min(remaining, 10));
      result = Atomics.load(state, 0);
    }
    if (result === 2) throw new Error(`guest worker failed: ${g.readStr(e.control + 16, 495)}`);
    return 0;
  }
  if (!e || e.type !== 'event') { g.lastError = 6; return -1; }
  if (e.signaled) { if (!e.manual) e.signaled = false; return 0; }
  if (!timeout) return 258; // WAIT_TIMEOUT
  throw new Error('blocking event waits require guest thread scheduling');
}
K('WaitForSingleObjectEx', function (h, ms) { return waitOne(this.g, h, ms); });
SHIMS['kernel32.dll!WaitForSingleObject'] = { arity: 2, pop: 8, fn: function (h, ms) { return waitOne(this.g, h, ms); } };
SHIMS['kernel32.dll!GetExitCodeThread'] = { arity: 2, pop: 8, fn: function (h, out) {
  const e = this.g.handles.get(h);
  if (!e || e.type !== 'thread' || !out) { this.g.lastError = 6; return 0; }
  const state = Atomics.load(new Int32Array(this.g.mem.buffer, e.control + 4, 1), 0);
  this.g.u32(out, state ? this.g.u32(e.control + 12) : 259);
  return 1;
} };
// Win32 uses -1 (0xffffffff) to mean "the source is NUL-terminated", and the
// guest passes arguments unsigned, so compare against 0xffffffff explicitly.
K('MultiByteToWideChar', function (cp, fl, src, n, dst, m) {
  if ((n >>> 0) === 0xffffffff) n = this.g.readStr(src).length + 1;
  if (!m) return n;
  for (let i = 0; i < n; i++) this.g.dv.setUint16(dst + 2 * i, this.g.u8[src + i], true);
  return n;
});
K('WideCharToMultiByte', function (cp, fl, src, n, dst, m, def, used) {
  if ((n >>> 0) === 0xffffffff) { n = 0; while (this.g.dv.getUint16(src + 2 * n, true)) n++; n++; }
  if (!m) return n;
  for (let i = 0; i < n; i++) this.g.u8[dst + i] = this.g.dv.getUint16(src + 2 * i, true) & 255;
  return n;
});
K('GetStringTypeW', () => 1); K('LCMapStringW', () => 0); K('CompareStringW', () => 2);
K('GetDateFormatW', () => 0); K('GetTimeFormatW', () => 0); K('FormatMessageA', () => 0);
K('ExitProcess', (c) => { throw new Error('ExitProcess ' + c); }); K('TerminateProcess', () => { throw new Error('TerminateProcess'); });
K('RaiseException', function (code) { throw new Error('RaiseException 0x' + (code >>> 0).toString(16)); });
K('RtlUnwind', () => { throw new Error('RtlUnwind (SEH unwinding is not supported)'); });
K('CreateFileW', function (p, access, _share, _security, disposition) {
  const name = wstr(this.g, p);
  if (ENV.GUEST_DEBUG_CWD) console.log(`[cwd] CreateFileW(${JSON.stringify(name)}) access=0x${(access>>>0).toString(16)} disp=${disposition}`);
  if (!this.g.files) throw new Error(`CreateFileW requires a configured file volume: ${name}`);
  return this.g.files.open(name, access, disposition);
});
K('ReadFile', function (h, buffer, count, written, overlapped) {
  if (!this.g.files) throw new Error('ReadFile requires a configured file volume');
  return this.g.files.read(h, buffer, count, written, overlapped);
});
SHIMS['kernel32.dll!GetOverlappedResult'] = { arity: 4, pop: 16, fn: function (_h, ov, transferred, _wait) {
  if (!ov) { this.g.lastError = 87; return 0; }
  if (transferred) this.g.u32(transferred, this.g.u32(ov + 4));
  return 1;
} };
SHIMS['kernel32.dll!CancelIoEx'] = { arity: 2, pop: 8, fn: () => 1 };
SHIMS['kernel32.dll!CancelIo'] = { arity: 1, pop: 4, fn: () => 1 };
K('GetFileSizeEx', function (h, out) {
  if (!this.g.files) throw new Error('GetFileSizeEx requires a configured file volume');
  return this.g.files.size(h, out);
});
SHIMS['kernel32.dll!SetFilePointerEx'] = { arity: 5, pop: 20, fn: function (h, low, high, out, method) {
  if (!this.g.files) throw new Error('SetFilePointerEx requires a configured file volume');
  return this.g.files.seek(h, low, high, out, method);
} };
K('FindFirstFileExW', function (pattern, _level, out, _op, _filter, _flags) {
  if (!this.g.files) throw new Error('FindFirstFileExW requires a configured file volume');
  return this.g.files.findFirst(wstr(this.g, pattern), out, true);
});
K('FindNextFileW', function (h, out) {
  if (!this.g.files) throw new Error('FindNextFileW requires a configured file volume');
  return this.g.files.findNext(h, out, true);
});
K('FindClose', function (h) { return this.g.files?.findClose(h) ? 1 : 0; });
SHIMS['kernel32.dll!GetFileInformationByHandle'] = { arity: 2, pop: 8, fn: function (h, out) {
  if (!this.g.files) throw new Error('GetFileInformationByHandle requires a configured file volume');
  if (!this.g.files.info(h, out)) { this.g.lastError = 6; return 0; }
  this.g.lastError = 0;
  return 1;
} };
SHIMS['kernel32.dll!GetFileAttributesA'] = { arity: 1, pop: 4, fn: function (name) {
  if (!this.g.files) throw new Error('GetFileAttributesA requires a configured file volume');
  const a = this.g.files.attributes(this.g.readStr(name));
  if (!a) { this.g.lastError = 2; return -1; }
  this.g.lastError = 0;
  return a.dir ? 0x10 : 0x80;
} };
SHIMS['kernel32.dll!GetFileAttributesW'] = { arity: 1, pop: 4, fn: function (name) {
  if (!this.g.files) throw new Error('GetFileAttributesW requires a configured file volume');
  const a = this.g.files.attributes(wstr(this.g, name));
  if (!a) { this.g.lastError = 2; return -1; }
  this.g.lastError = 0;
  return a.dir ? 0x10 : 0x80;
} };
SHIMS['kernel32.dll!GetFileAttributesExA'] = { arity: 3, pop: 12, fn: function (name, _level, out) {
  if (!this.g.files) throw new Error('GetFileAttributesExA requires a configured file volume');
  const a = this.g.files.attributes(this.g.readStr(name));
  if (!a) { this.g.lastError = 2; return 0; }
  this.g.files.writeAttributeData(a, out);
  this.g.lastError = 0;
  return 1;
} };
SHIMS['kernel32.dll!GetFileAttributesExW'] = { arity: 3, pop: 12, fn: function (name, _level, out) {
  if (!this.g.files) throw new Error('GetFileAttributesExW requires a configured file volume');
  const a = this.g.files.attributes(wstr(this.g, name));
  if (!a) { this.g.lastError = 2; return 0; }
  this.g.files.writeAttributeData(a, out);
  this.g.lastError = 0;
  return 1;
} };
SHIMS['kernel32.dll!FindFirstFileW'] = { arity: 2, pop: 8, fn: function (pattern, out) {
  return this.g.files.findFirst(wstr(this.g, pattern), out, true);
} };
SHIMS['kernel32.dll!FindFirstFileA'] = { arity: 2, pop: 8, fn: function (pattern, out) {
  return this.g.files.findFirst(this.g.readStr(pattern), out, false);
} };
SHIMS['kernel32.dll!FindNextFileA'] = { arity: 2, pop: 8, fn: function (h, out) {
  return this.g.files.findNext(h, out, false);
} };
K('ReadConsoleW', function () { this.g.lastError = 2; return 0; });
K('SetEndOfFile', function (h) { return this.g.files ? this.g.files.setEndOfFile(h) : 0; });

// Remaining Win32 surface (after every K()/ARITY table above is defined).
installMore(SHIMS, { createEvent, eventOp, wstr });
installExtra(SHIMS, { createEvent, wstr });
await initGdi();
installGdi(SHIMS, { wstr });
installD3DX9(SHIMS);
