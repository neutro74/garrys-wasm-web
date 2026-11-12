// Verify the Node Win32 file backend against the user's installed retail data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Guest, SHIMS } from './guest.mjs';

const root = process.argv[2];
if (!root) throw new Error('usage: node host/test-installed-files.mjs GMOD_ROOT');
const g = new Guest({ filesRoot: root, sharedMemory: true });
const call = (name, ...args) => SHIMS[`kernel32.dll!${name}`].fn.call({ g }, ...args);
for (const [name, magic] of [['garrysmod/garrysmod_dir.vpk', 0x55aa1234], ['garrysmod/maps/gm_construct.bsp', 0x50534256]]) {
  const h = call('CreateFileA', g.cstr(name), 0x80000000, 1, 0, 3, 0, 0);
  assert.notEqual(h, -1, name);
  const buf = g.alloc(12), count = g.alloc(4), size = g.alloc(8);
  assert.equal(call('ReadFile', h, buf, 12, count, 0), 1);
  assert.equal(g.u32(count), 12);
  assert.equal(g.u32(buf), magic);
  assert.equal(call('GetFileSizeEx', h, size), 1);
  const fd = fs.openSync(path.join(root, name), 'r');
  const native = Buffer.alloc(12);
  fs.readSync(fd, native, 0, 12, 0);
  assert.deepEqual(Buffer.from(g.u8.subarray(buf, buf + 12)), native);
  assert.equal(g.dv.getBigInt64(size, true), BigInt(fs.fstatSync(fd).size));
  fs.closeSync(fd);
  assert.equal(call('CloseHandle', h), 1);
  console.log(`PASS ${name} header and size`);
}
