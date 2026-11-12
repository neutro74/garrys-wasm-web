import assert from 'node:assert/strict';
import { Guest } from './guest.mjs';

const g = new Guest({ pages: 512 });
const dll = await g.load(`${process.argv[2]}/primary`);
g.u32(0x402900, 0xdeadbeef);
assert.equal(g.call(dll, dll.meta.exports.entry), 1); // GetAdapterCount
assert.equal(g.u32(0x402800), 0x7ff10500); // GetAdapterMonitor, slot 15
assert.equal(g.u32(0x402900), 0); // GetAdapterIdentifier writes output argument
assert.equal(g.u32(0x402804), 0x1feffc); // all stdcall arguments, including this, popped
assert.equal(dll.ex.esp.value >>> 0, 0x1ff000); // guest ret popped return address
console.log('D3D9 COM stdcall / this pointer / stack: PASS');
