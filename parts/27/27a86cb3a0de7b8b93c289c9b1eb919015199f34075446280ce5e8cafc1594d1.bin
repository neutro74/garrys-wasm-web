// Cross-DLL calls without leaving wasm. A lifted DLL's dispatcher hands addresses outside its own image to its
// `foreign_call` import; routing that through JS cost a wasm->JS->wasm round trip per call (about a tenth of a
// frame in gm_construct). The router is a tiny generated module: a binary search over the loaded images and thunk
// ranges (kept in its own memory, updated as DLLs load) and a tail call through a table of each DLL's `icall`.
// Addresses it cannot place, and calls back into the caller's own image, go to `slow` (the JS path, which
// reports the error).

const u = (n) => { const o = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b); } while (n); return o; };
const s = (n) => { const o = []; for (;;) { const b = n & 0x7f; n >>= 7; if ((n === 0 && !(b & 0x40)) || (n === -1 && (b & 0x40))) { o.push(b); return o; } o.push(b | 0x80); } };
const str = (t) => [...u(t.length), ...new TextEncoder().encode(t)];
const sec = (id, body) => [id, ...u(body.length), ...body];
const vec = (items) => [...u(items.length), ...items.flat()];

const LOAD = (off) => [0x28, 2, ...u(off)];
const ENTRY = 16, STRIDE = 12;
function routerBytes() {
  const slow = (a) => [0x20, a, 0x10, 0, 0x0f];                 // local.get a; call $slow; return
  const body = [
    0x41, 0, ...LOAD(0), 0x21, 2,                               // h = count
    0x02, 0x40, 0x03, 0x40,                                     // block loop
    0x20, 1, 0x20, 2, 0x4f, 0x0d, 1,                            //   l >= h -> done
    0x20, 1, 0x20, 2, 0x6a, 0x41, 1, 0x76, 0x21, 3,             //   m = (l + h) >> 1
    0x20, 3, 0x41, ...s(STRIDE), 0x6c, ...LOAD(ENTRY), 0x20, 0, 0x4d, // lo[m] <= a
    0x04, 0x40, 0x20, 3, 0x41, 1, 0x6a, 0x21, 1,                //   then l = m + 1
    0x05, 0x20, 3, 0x21, 2, 0x0b,                               //   else h = m
    0x0c, 0, 0x0b, 0x0b,                                        // br loop; end; end
    0x20, 1, 0x45, 0x04, 0x40, ...slow(0), 0x0b,                // nothing at or below a
    0x20, 1, 0x41, 1, 0x6b, 0x41, ...s(STRIDE), 0x6c, 0x21, 3,  // p = (l - 1) * 12
    0x20, 0, 0x20, 3, ...LOAD(ENTRY), 0x6b, 0x20, 3, ...LOAD(ENTRY + 4), 0x4f, // a - lo >= len
    0x04, 0x40, ...slow(0), 0x0b,
    0x20, 3, ...LOAD(ENTRY + 8), 0x23, 0, 0x46,                 // slot == self
    0x04, 0x40, ...slow(0), 0x0b,
    0x20, 0, 0x20, 3, ...LOAD(ENTRY + 8), 0x13, 0, 0,           // return_call_indirect (a) through slot
    0x0b,
  ];
  const code = [...u(1), 3, 0x7f, ...body];                      // locals: l, h, m
  return new Uint8Array([
    0, 0x61, 0x73, 0x6d, 1, 0, 0, 0,
    ...sec(1, vec([[0x60, 1, 0x7f, 0]])),
    ...sec(2, vec([
      [...str('r'), ...str('mem'), 2, 0, 1],
      [...str('r'), ...str('tbl'), 1, 0x70, 0, 1],
      [...str('r'), ...str('self'), 3, 0x7f, 0],
      [...str('r'), ...str('slow'), 0, 0],
    ])),
    ...sec(3, vec([[0]])),
    ...sec(7, vec([[...str('route'), 0, 1]])),
    ...sec(10, vec([[...u(code.length), ...code]])),
  ]);
}

let compiled = null;
export class ForeignRouter {
  constructor() {
    compiled ??= new WebAssembly.Module(routerBytes());
    this.mem = new WebAssembly.Memory({ initial: 1 });
    this.tbl = new WebAssembly.Table({ initial: 64, element: 'anyfunc' });
    this.ranges = [];
  }
  // The `foreign_call` import for the DLL that will occupy `slot`; `slow(addr)` handles what the router can't.
  route(slot, slow) {
    return new WebAssembly.Instance(compiled, { r: { mem: this.mem, tbl: this.tbl, self: slot, slow } }).exports.route;
  }
  // A loaded DLL: calls into its image or its host thunks go to its dispatcher.
  add(slot, meta, icall) {
    if (slot >= this.tbl.length) this.tbl.grow(slot + 1 - this.tbl.length);
    this.tbl.set(slot, icall);
    this.ranges.push([meta.base >>> 0, meta.size >>> 0, slot, true]);
    const thunks = 4 * (meta.imports.length + (meta.spare_thunks ?? 0));
    if (meta.thunk_base && thunks) this.ranges.push([meta.thunk_base >>> 0, thunks, slot, false]);
    this.ranges.sort((a, b) => a[0] - b[0]);
    // Overlapping entries (old layouts put thunks inside another image) would break the search: images win.
    const list = [];
    for (const r of this.ranges) {
      const last = list[list.length - 1];
      if (last && r[0] < last[0] + last[1]) { if (r[3] && !last[3]) list[list.length - 1] = r; continue; }
      list.push(r);
    }
    if (ENTRY + list.length * STRIDE > this.mem.buffer.byteLength) this.mem.grow(1);
    const dv = new DataView(this.mem.buffer);
    list.forEach(([lo, len, sl], i) => { dv.setUint32(ENTRY + i * STRIDE, lo, true); dv.setUint32(ENTRY + i * STRIDE + 4, len, true); dv.setUint32(ENTRY + i * STRIDE + 8, sl, true); });
    dv.setUint32(0, list.length, true);
  }
}
