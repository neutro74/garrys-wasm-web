// The generated cross-DLL router: dispatch by image and thunk ranges, self-calls and unknown addresses to slow.
import assert from 'node:assert/strict';
import { ForeignRouter } from './foreign-router.mjs';
// (module (import "t" "hit" (func $h (param i32 i32))) (func (export "icall") (param i32) (call $h (i32.const ID) (local.get 0))))
const icallModule = (id) => new Uint8Array([0,97,115,109,1,0,0,0, 1,10,2,96,2,127,127,0,96,1,127,0, 2,9,1,1,116,3,104,105,116,0,0,
  3,2,1,1, 7,9,1,5,105,99,97,108,108,0,1, 10,10,1,8,0,65,id,32,0,16,0,11]);
const hits = [], slow = [];
const r = new ForeignRouter();
const icall = (id) => new WebAssembly.Instance(new WebAssembly.Module(icallModule(id)), { t: { hit: (i, a) => hits.push([i, a >>> 0]) } }).exports.icall;
r.add(0, { base: 0x10000000, size: 0x100000, thunk_base: 0x13000000, imports: [1, 2], spare_thunks: 2 }, icall(10));
r.add(1, { base: 0x0a000000, size: 0x200000, thunk_base: 0x13010000, imports: [1], spare_thunks: 0 }, icall(11));
r.add(2, { base: 0x20000000, size: 0x1000, imports: [] }, icall(12));
const route = r.route(0, (a) => slow.push(a >>> 0));
for (const a of [0x0a000000, 0x0a1fffff, 0x13010000, 0x20000fff, 0x10000010, 0x13000004, 0x0a200000, 0x01000000, 0x13010004, 0xffff0000]) route(a);
assert.deepEqual(hits, [[11, 0x0a000000], [11, 0x0a1fffff], [11, 0x13010000], [12, 0x20000fff]]);
assert.deepEqual(slow, [0x10000010, 0x13000004, 0x0a200000, 0x01000000, 0x13010004, 0xffff0000]);
console.log('foreign router ranges, self calls and misses: PASS');
