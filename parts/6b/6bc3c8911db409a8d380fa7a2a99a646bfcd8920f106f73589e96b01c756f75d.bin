// Process-wide guest heap in shared Wasm memory. Free-list metadata and the
// allocator lock live in guest memory, so every worker uses the same state.
import { env as ENV } from './platform.mjs';
const MAGIC = 0x48454150;
const ALLOCATED = 0x4c495645;
const FREE = 0x46524545;
const CHUNK = 16 << 20;

export class SharedHeap {
  // `more(bytes)` returns the start of a fresh region of at least `bytes` (from the guest's virtual-allocation
  // break) once [start, end) is used up; without it the heap is fixed-size.
  constructor(memory, { control = 0x2000, start = 0x01000000, end = 0x04000000, initialize = false, more = null } = {}) {
    if (!(memory.buffer instanceof SharedArrayBuffer)) throw new Error('shared heap requires shared memory');
    if (control % 4 || start % 16 || end <= start) throw new Error('invalid shared heap layout');
    this.memory = memory; this.more = more;
    this.refresh();
    this.state = new Int32Array(memory.buffer, control, 13); // lock, magic, top, large free head, end, eight small free heads
    this.start = start;
    if (initialize) {
      if (Atomics.compareExchange(this.state, 1, 0, MAGIC) !== 0) throw new Error('shared heap already initialized');
      Atomics.store(this.state, 2, start); Atomics.store(this.state, 3, 0); Atomics.store(this.state, 4, end);
      this.state.fill(0, 5);
    } else if (Atomics.load(this.state, 1) !== MAGIC) {
      throw new Error('shared heap is not initialized');
    }
  }

  // Views over the whole memory; called again after the memory grows.
  refresh() { this.bytes = new Uint8Array(this.memory.buffer); this.dv = new DataView(this.memory.buffer); }

  locked(fn) {
    const start = ENV.GUEST_DEBUG_WAIT ? performance.now() : 0;
    while (Atomics.compareExchange(this.state, 0, 0, 1) !== 0) {
      if (ENV.GUEST_DEBUG_WAIT && performance.now() - start > 1000 && !this._warned) {
        this._warned = true; console.log(`[wait] shared heap lock held (state=${Atomics.load(this.state, 0)})`);
      }
      Atomics.wait(this.state, 0, 1, 100);
    }
    try { return fn(); } finally { Atomics.store(this.state, 0, 0); Atomics.notify(this.state, 0, 1); }
  }

  // Control occupies 52 bytes, below the process state at control + 64.
  // Power-of-two ranges keep a large request from walking thousands of small frees.
  freeHead(size) { return size > 2048 ? 3 : 5 + Math.max(0, 28 - Math.clz32(size - 1)); }

  insertFree(p, size) {
    const head=this.freeHead(size);
    this.dv.setUint32(p-12,Atomics.load(this.state,head)>>>0,true);
    this.dv.setUint32(p-8,size,true);this.dv.setUint32(p-4,FREE,true);
    Atomics.store(this.state,head,p);
  }

  allocate(requested) {
    if (!Number.isSafeInteger(requested) || requested < 0) throw new Error('invalid allocation size');
    const need = Math.ceil(Math.max(requested, 16) / 16) * 16;
    return this.locked(() => {
      let p;
      const first=this.freeHead(need);
      for(let bin=first===3?13:first;bin<=13;bin++) {
        const head=bin===13?3:bin;
        let prev=0;p=Atomics.load(this.state,head)>>>0;
        while(p) {
          const next=this.dv.getUint32(p-12,true),size=this.dv.getUint32(p-8,true);
          if(this.dv.getUint32(p-4,true)!==FREE)throw new Error('corrupt shared heap free list');
          if(size>=need) {
            if(prev)this.dv.setUint32(prev-12,next,true);else Atomics.store(this.state,head,next);
            let capacity=size;
            if(size>=need+32) {
              capacity=need;this.insertFree(p+need+16,size-need-16);
              this.dv.setUint32(p-8,need,true);
            }
            this.dv.setUint32(p-12,0,true);this.dv.setUint32(p-4,ALLOCATED,true);
            this.bytes.fill(0,p,p+capacity);return p;
          }
          prev=p;p=next;
        }
      }
      let top = Atomics.load(this.state, 2) >>> 0;
      let next = top + 16 + need;
      if (next > (Atomics.load(this.state, 4) >>> 0)) {
        if (!this.more) throw new Error('guest shared heap exhausted');
        // Continue in a new region; the rest of the old one is abandoned (at most one chunk's tail).
        const chunk = Math.max(CHUNK, need + 16);
        top = this.more(chunk); next = top + 16 + need;
        if (this.dv.byteLength < top + chunk) this.refresh();
        Atomics.store(this.state, 4, top + chunk);
      }
      p = top + 16;
      this.dv.setUint32(p - 12, 0, true); this.dv.setUint32(p - 8, need, true);
      // Fresh memory past the top has never been used and is already zero; filling it would only make every page
      // of a large, sparsely used allocation resident.
      this.dv.setUint32(p - 4, ALLOCATED, true);
      Atomics.store(this.state, 2, next);
      return p;
    });
  }

  size(p) {
    return this.locked(() => this.sizeUnlocked(p));
  }

  sizeUnlocked(p) {
    const top = Atomics.load(this.state, 2) >>> 0;
    if (!Number.isInteger(p) || p < this.start + 16 || p >= top || p % 16 || this.dv.getUint32(p - 4, true) !== ALLOCATED)
      throw new Error(`invalid shared heap pointer 0x${Number(p).toString(16)}`);
    return this.dv.getUint32(p - 8, true);
  }

  free(p) {
    if (!p) return;
    this.locked(() => {
      this.insertFree(p, this.sizeUnlocked(p));
    });
  }

  realloc(p, size) {
    if (!p) return this.allocate(size);
    const old = this.size(p);
    if (size <= old) return p;
    const next = this.allocate(size);
    this.bytes.copyWithin(next, p, p + old);
    this.free(p);
    return next;
  }
}
