import fs from 'node:fs';

const inputs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = [];
for (const item of inputs) {
  const mem = new WebAssembly.Memory({ initial: 8, maximum: 8, shared: true });
  const env = { mem, sin: Math.sin, cos: Math.cos, tan: Math.tan, log2: Math.log2,
    exp2: x => 2 ** x, exp2m1: x => 2 ** x - 1, atan2: Math.atan2,
    fmod: (a, b) => a % b, rdtsc: () => 0n, unwind: () => {},
    hostcall: () => { throw new Error('unexpected hostcall'); },
    bad_icall: a => { throw new Error(`bad instruction 0x${(a >>> 0).toString(16)}`); }, trace: () => {},
  };
  const ex = (await WebAssembly.instantiate(fs.readFileSync(item.wasm), { env })).instance.exports;
  const dv = new DataView(mem.buffer);
  dv.setUint32(0x10000, item.word, true); dv.setUint32(0x10004, item.word2, true);
  dv.setUint32(0x20800, 0xdead0000, true);
  for (const [r, v] of Object.entries(item.regs)) ex[r].value = v | 0;
  for (const [r, v] of Object.entries(item.flags)) ex[r].value = v;
  ex.f_00001000();
  const regs = Object.fromEntries(Object.keys(item.regs).map(r => [r, ex[r].value >>> 0]));
  const flags = Object.fromEntries(Object.keys(item.flags).map(r => [r, ex[r].value]));
  out.push({ regs, flags, word: dv.getUint32(0x10000, true), word2: dv.getUint32(0x10004, true) });
}
console.log(JSON.stringify(out));
