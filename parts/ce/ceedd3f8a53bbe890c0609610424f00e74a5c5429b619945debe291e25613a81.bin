// Process-wide Win32 event handles. State and the handle table are stored in
// shared guest memory so waits and signals work across independent JS workers.
import { env as ENV } from './platform.mjs';
const EVENT = 0x45564e54;
const FIRST_HANDLE = 0x100, HANDLE_COUNT = 4096;

export class SharedEvents {
  constructor(memory, heap) {
    this.mem = memory; this.heap = heap;
    this.state = new Int32Array(memory.buffer, 0x2200, 2); // registry lock, named-event list
    this.table = new Int32Array(memory.buffer, 0x4000, HANDLE_COUNT);
    this.refresh();
    this.encoder = new TextEncoder(); this.decoder = new TextDecoder();
  }

  // Views over the whole memory; called again after the memory grows.
  refresh() { this.dv = new DataView(this.mem.buffer); this.bytes = new Uint8Array(this.mem.buffer); }

  locked(fn) {
    const start = performance.now();
    while (Atomics.compareExchange(this.state, 0, 0, 1) !== 0) {
      if (ENV.GUEST_DEBUG_WAIT && performance.now() - start > 1000 && !this._warned) {
        this._warned = true; console.log(`[wait] shared event lock held (state=${Atomics.load(this.state, 0)})`);
      }
      Atomics.wait(this.state, 0, 1, 100);
    }
    try { return fn(); } finally { Atomics.store(this.state, 0, 0); Atomics.notify(this.state, 0, 1); }
  }

  // slice: browsers' TextDecoder rejects views of shared memory.
  name(p) { return this.decoder.decode(this.bytes.slice(p + 32, p + 32 + this.dv.getUint32(p + 16, true))); }
  lookup(h) {
    if (!Number.isInteger(h) || h < FIRST_HANDLE || h >= HANDLE_COUNT) return 0;
    const p = Atomics.load(this.table, h) >>> 0;
    return p && this.dv.getUint32(p, true) === EVENT ? p : 0;
  }

  lookupObject(h, magic) {
    if (!Number.isInteger(h) || h < FIRST_HANDLE || h >= HANDLE_COUNT) return 0;
    const p = Atomics.load(this.table, h) >>> 0;
    return p && this.dv.getUint32(p, true) === magic ? p : 0;
  }

  registerObject(p) {
    return this.locked(() => {
      let h = FIRST_HANDLE;
      while (h < HANDLE_COUNT && Atomics.load(this.table, h)) h++;
      if (h === HANDLE_COUNT) throw new Error('shared handle table exhausted');
      Atomics.store(this.table, h, p); return h;
    });
  }

  removeObject(h, magic) {
    return this.locked(() => {
      const p = this.lookupObject(h, magic);
      if (p) Atomics.store(this.table, h, 0);
      return p;
    });
  }

  create(manual, initial, name = '') {
    return this.locked(() => {
      let handle = FIRST_HANDLE;
      while (handle < HANDLE_COUNT && Atomics.load(this.table, handle)) handle++;
      if (handle === HANDLE_COUNT) throw new Error('shared event handle table exhausted');
      let object = Atomics.load(this.state, 1) >>> 0;
      while (object && this.name(object) !== name) object = this.dv.getUint32(object + 20, true);
      const exists = !!name && !!object;
      if (!exists) {
        const encoded = this.encoder.encode(name);
        object = this.heap.allocate(32 + encoded.length);
        this.dv.setUint32(object, EVENT, true);
        this.dv.setUint32(object + 4, initial ? 1 : 0, true);
        this.dv.setUint32(object + 8, manual ? 1 : 0, true);
        this.dv.setUint32(object + 16, encoded.length, true);
        this.bytes.set(encoded, object + 32);
        if (name) {
          this.dv.setUint32(object + 20, Atomics.load(this.state, 1) >>> 0, true);
          Atomics.store(this.state, 1, object);
        }
      }
      this.dv.setUint32(object + 12, this.dv.getUint32(object + 12, true) + 1, true);
      Atomics.store(this.table, handle, object);
      return { handle, exists };
    });
  }

  close(h) {
    return this.locked(() => {
      const p = this.lookup(h);
      if (!p) return false;
      Atomics.store(this.table, h, 0);
      const refs = this.dv.getUint32(p + 12, true) - 1;
      this.dv.setUint32(p + 12, refs, true);
      if (!refs) {
        if (this.dv.getUint32(p + 16, true)) {
          let cur = Atomics.load(this.state, 1) >>> 0, prev = 0;
          while (cur && cur !== p) { prev = cur; cur = this.dv.getUint32(cur + 20, true); }
          const next = this.dv.getUint32(p + 20, true);
          if (prev) this.dv.setUint32(prev + 20, next, true); else Atomics.store(this.state, 1, next);
        }
        this.dv.setUint32(p, 0, true); this.heap.free(p);
      }
      return true;
    });
  }

  signal(h, value) {
    const p = this.lookup(h);
    if (!p) return false;
    const state = new Int32Array(this.mem.buffer, p + 4, 1);
    Atomics.store(state, 0, value ? 1 : 0);
    if (value) Atomics.notify(state, 0, this.dv.getUint32(p + 8, true) ? Infinity : 1);
    return true;
  }

  wait(h, timeout, poll = null) {
    const p = this.lookup(h);
    if (!p) return -1;
    const state = new Int32Array(this.mem.buffer, p + 4, 1);
    const manual = !!this.dv.getUint32(p + 8, true);
    const deadline = timeout === 0xffffffff ? Infinity : performance.now() + timeout;
    const debug = !!ENV.GUEST_DEBUG_WAIT, started = performance.now();
    for (;;) {
      if (debug && performance.now() - started > 1000 && !this._warned) {
        this._warned = true;
        const name = this.name(p);
        console.log(`[wait] event handle=0x${h.toString(16)} name=${JSON.stringify(name)} manual=${manual} ` +
          `state=${Atomics.load(state, 0)} timeout=${timeout}`);
      }
      if (manual ? Atomics.load(state, 0) === 1 : Atomics.compareExchange(state, 0, 1, 0) === 1) return 0;
      const remaining = deadline - performance.now();
      if (remaining <= 0) return 258;
      if (poll) poll();
      const slice = remaining === Infinity ? 10 : Math.min(remaining, 10);
      if (Atomics.wait(state, 0, 0, slice) === 'timed-out' && remaining !== Infinity && slice === remaining) return 258;
    }
  }
}
