// Indirect calls inside a lifted DLL (virtual calls, function pointers, jumps through registers) go through the
// core module's `icall`/`dispatch`: a generated search over every function address. That function is so large
// that it stays slow (about a tenth of a frame in gm_construct). The chunks import `icall` and `dispatch`, so the
// host hands them this small replacement instead: a hash table of address -> table index (the DLL's `dispatch`
// metadata, from build_dll.py or dispatch_map.py) and a tail call through the DLL's table. Anything not in the
// table (host thunks, the LuaJIT VM region, longjmp continuations, other DLLs) goes to the original.

const u = (n) => { const o = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b); } while (n); return o; };
const s = (n) => { const o = []; for (;;) { const b = n & 0x7f; n >>= 7; if ((n === 0 && !(b & 0x40)) || (n === -1 && (b & 0x40))) { o.push(b); return o; } o.push(b | 0x80); } };
const str = (t) => [...u(t.length), ...new TextEncoder().encode(t)];
const sec = (id, body) => [id, ...u(body.length), ...body];
const vec = (items) => [...u(items.length), ...items.flat()];
const fn = (locals, body) => { const c = [...(locals ? [1, locals, 0x7f] : [0]), ...body]; return [...u(c.length), ...c]; };

const HASH = 0x9e3779b1 | 0;
// Globals: 0 target (the core's g_target), 1 shift, 2 mask, 3 base (the table's offset in the shared memory). Functions: 0 slow icall, 1 slow dispatch, 2 look,
// 3 icall, 4 dispatch.
function bytes() {
  const slot = [0x20, 1, 0x41, 3, 0x74, 0x23, 3, 0x6a];                     // base + (h << 3)
  const look = fn(2, [
    0x20, 0, 0x41, ...s(HASH), 0x6c, 0x23, 1, 0x76, 0x21, 1,              // h = (a * K) >>> shift
    0x03, 0x40,
    ...slot, 0x28, 2, 0, 0x22, 2,                                          //   k = key[h]
    0x20, 0, 0x46, 0x04, 0x40, ...slot, 0x28, 2, 4, 0x0f, 0x0b,             //   k == a: return value[h]
    0x20, 2, 0x45, 0x04, 0x40, 0x41, 0x7f, 0x0f, 0x0b,                     //   empty slot: return -1
    0x20, 1, 0x41, 1, 0x6a, 0x23, 2, 0x71, 0x21, 1, 0x0c, 0,               //   h = (h + 1) & mask
    0x0b, 0x00, 0x0b,
  ]);
  const icall = fn(1, [
    0x20, 0, 0x24, 0,
    0x20, 0, 0x10, 2, 0x22, 1, 0x41, 0, 0x48, 0x04, 0x40, 0x20, 0, 0x12, 0, 0x0b,
    0x20, 1, 0x13, 1, 0, 0x0b,
  ]);
  const dispatch = fn(2, [
    0x23, 0, 0x21, 0,
    0x20, 0, 0x10, 2, 0x22, 1, 0x41, 0, 0x48, 0x04, 0x40, 0x12, 1, 0x0b,
    0x20, 1, 0x13, 1, 0, 0x0b,
  ]);
  return new Uint8Array([
    0, 0x61, 0x73, 0x6d, 1, 0, 0, 0,
    ...sec(1, vec([[0x60, 1, 0x7f, 0], [0x60, 0, 0], [0x60, 1, 0x7f, 1, 0x7f]])),
    ...sec(2, vec([
      [...str('r'), ...str('mem'), 2, 0, 1],
      [...str('r'), ...str('tbl'), 1, 0x70, 0, 1],
      [...str('r'), ...str('target'), 3, 0x7f, 1],
      [...str('r'), ...str('shift'), 3, 0x7f, 0],
      [...str('r'), ...str('mask'), 3, 0x7f, 0],
      [...str('r'), ...str('base'), 3, 0x7f, 0],
      [...str('r'), ...str('icall'), 0, 0],
      [...str('r'), ...str('dispatch'), 0, 1],
    ])),
    ...sec(3, vec([[2], [0], [1]])),
    ...sec(7, vec([[...str('icall'), 0, 3], [...str('dispatch'), 0, 4]])),
    ...sec(10, vec([look, icall, dispatch])),
  ]);
}

let compiled = null;
// One memory per worker for every DLL's table: each wasm memory reserves a large stretch of address space, and one
// per DLL per thread runs out.
let shared = null, used = 0;
// `map` is [address, table index, ...]; `core` the core instance's exports (target global, original icall/dispatch).
export function fastDispatch(map, table, core) {
  compiled ??= new WebAssembly.Module(bytes());
  const n = map.length / 2;
  let bits = 4; while ((1 << bits) < n * 2) bits++;                        // load factor <= 1/2
  const bytes8 = (1 << bits) * 8, base = used;
  shared ??= new WebAssembly.Memory({ initial: 1 });
  const need = Math.ceil((base + bytes8) / 65536) - shared.buffer.byteLength / 65536;
  if (need > 0) shared.grow(need);
  used += bytes8;
  const mem = shared, words = new Uint32Array(mem.buffer, base, bytes8 / 4), mask = (1 << bits) - 1;
  for (let i = 0; i < map.length; i += 2) {
    const a = map[i] >>> 0;
    if (!a) continue;
    let h = Math.imul(a, HASH) >>> (32 - bits);
    while (words[h * 2]) h = (h + 1) & mask;
    words[h * 2] = a; words[h * 2 + 1] = map[i + 1];
  }
  return new WebAssembly.Instance(compiled, { r: { mem, tbl: table, target: core.target, shift: 32 - bits, mask, base, icall: core.icall, dispatch: core.dispatch } }).exports;
}
