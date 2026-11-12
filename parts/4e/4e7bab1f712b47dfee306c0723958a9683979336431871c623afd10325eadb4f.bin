// Single-producer single-consumer byte ring over a SharedArrayBuffer. The producer (the synchronous guest
// thread) blocks when the ring is full, which is the only flow control the renderer link needs.
// Layout: Int32 [0] = bytes written (head), [1] = bytes read (tail), [2] = closed flag; data starts at 16.
// Frames are [u32 length][payload]; head and tail are free-running counters.

export function createRing(capacity = 64 * 1024 * 1024) {
  return new SharedArrayBuffer(16 + capacity);
}

export class RingWriter {
  constructor(sab) {
    this.sab = sab; this.ctl = new Int32Array(sab, 0, 4); this.data = new Uint8Array(sab, 16);
    this.cap = this.data.length;
  }
  write(payload) {
    const need = 4 + payload.length;
    if (need > this.cap) throw new Error(`frame of ${payload.length} bytes exceeds the ring capacity`);
    for (;;) {
      const head = Atomics.load(this.ctl, 0), tail = Atomics.load(this.ctl, 1);
      if (this.cap - (head - tail) >= need) {
        this.put(head, new Uint8Array(new Uint32Array([payload.length]).buffer));
        this.put(head + 4, payload);
        Atomics.store(this.ctl, 0, head + need);
        Atomics.notify(this.ctl, 0);
        return;
      }
      Atomics.wait(this.ctl, 1, tail, 1000);
    }
  }
  put(pos, bytes) {
    const i = pos % this.cap, first = Math.min(bytes.length, this.cap - i);
    this.data.set(bytes.subarray(0, first), i);
    if (first < bytes.length) this.data.set(bytes.subarray(first), 0);
  }
  // Non-blocking variant for threads that must not wait (a page's main thread): false when the ring is full.
  tryWrite(payload) {
    const need = 4 + payload.length, head = Atomics.load(this.ctl, 0), tail = Atomics.load(this.ctl, 1);
    if (this.cap - (head - tail) < need) return false;
    this.put(head, new Uint8Array(new Uint32Array([payload.length]).buffer));
    this.put(head + 4, payload);
    Atomics.store(this.ctl, 0, head + need);
    Atomics.notify(this.ctl, 0);
    return true;
  }
  close() { Atomics.store(this.ctl, 2, 1); Atomics.notify(this.ctl, 0); }
}

export class RingReader {
  constructor(sab) {
    this.ctl = new Int32Array(sab, 0, 4); this.data = new Uint8Array(sab, 16);
    this.cap = this.data.length;
  }
  get closed() { return Atomics.load(this.ctl, 2) === 1; }
  get(pos, n) {
    const out = new Uint8Array(n), i = pos % this.cap, first = Math.min(n, this.cap - i);
    out.set(this.data.subarray(i, i + first));
    if (first < n) out.set(this.data.subarray(0, n - first), first);
    return out;
  }
  // Next frame, or null when the ring is empty.
  read() {
    const head = Atomics.load(this.ctl, 0), tail = Atomics.load(this.ctl, 1);
    if (head === tail) return null;
    const len = new Uint32Array(this.get(tail, 4).buffer)[0];
    const frame = this.get(tail + 4, len);
    Atomics.store(this.ctl, 1, tail + 4 + len);
    Atomics.notify(this.ctl, 1);
    return frame;
  }
  async wait() {
    const head = Atomics.load(this.ctl, 0);
    if (head !== Atomics.load(this.ctl, 1) || this.closed) return;
    await Atomics.waitAsync(this.ctl, 0, head).value;
  }
}
