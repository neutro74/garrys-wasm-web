// Hash-table dispatcher: mapped addresses tail-call their table entry, everything else reaches the originals.
import assert from 'node:assert/strict';
import { fastDispatch } from './fast-dispatch.mjs';
// (module (import "t" "hit" (func (param i32))) (func (export "f") (call 0 (i32.const ID))))
const fnModule = (id) => new Uint8Array([0,97,115,109,1,0,0,0, 1,8,2,96,1,127,0,96,0,0, 2,9,1,1,116,3,104,105,116,0,0,
  3,2,1,1, 7,5,1,1,102,0,1, 10,8,1,6,0,65,id,16,0,11]);
const hits = [], slow = [];
const table = new WebAssembly.Table({ initial: 40, element: 'anyfunc' });
for (let i = 0; i < 40; i++) table.set(i, new WebAssembly.Instance(new WebAssembly.Module(fnModule(i)), { t: { hit: (x) => hits.push(x) } }).exports.f);
const target = new WebAssembly.Global({ value: 'i32', mutable: true }, 0);
const map = []; for (let i = 0; i < 40; i++) map.push(0x10000000 + i * 0x1000 + (i & 3), i);
const fd = fastDispatch(map, table, { target, icall: (a) => slow.push(['icall', a >>> 0]), dispatch: () => slow.push(['dispatch', target.value >>> 0]) });
fd.icall(0x10000000 + 7 * 0x1000 + 3); fd.icall(0x10005000 + 1); fd.icall(0x13000004);
target.value = 0x10000000 + 39 * 0x1000 + 3; fd.dispatch(); target.value = 0x12345678; fd.dispatch();
assert.deepEqual(hits, [7, 5, 39]);
assert.deepEqual(slow, [['icall', 0x13000004], ['dispatch', 0x12345678]]);
assert.equal(target.value >>> 0, 0x12345678);
console.log('fast dispatch hits, misses and target global: PASS');
