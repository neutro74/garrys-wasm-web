import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { Guest, SHIMS } from './guest.mjs';

const root = process.argv[2];
for (const sharedMemory of [false, true]) {
  const g = new Guest({ filesRoot: root, sharedMemory });
  const invoke = (name, ...args) => SHIMS[`kernel32.dll!${name}`].fn.call({ g }, ...args);
  const open = name => invoke('CreateFileA', g.cstr(name), 0x80000000, 1, 0, 3, 0, 0);
  const h = open('folder\\DATA.bin');
  assert.notEqual(h, -1);
  const buf = g.alloc(32), n = g.alloc(4), size = g.alloc(8), pos = g.alloc(8);
  assert.equal(invoke('GetFileSizeEx', h, size), 1);
  assert.equal(g.dv.getBigInt64(size, true), 10n);
  assert.equal(invoke('ReadFile', h, buf, 4, n, 0), 1);
  assert.equal(g.u32(n), 4);
  assert.equal(Buffer.from(g.u8.subarray(buf, buf + 4)).toString(), '0123');
  assert.equal(invoke('SetFilePointerEx', h, 0xfffffffe, 0xffffffff, pos, 1), 1);
  assert.equal(g.dv.getBigInt64(pos, true), 2n);
  assert.equal(invoke('ReadFile', h, buf, 3, n, 0), 1);
  assert.equal(Buffer.from(g.u8.subarray(buf, buf + 3)).toString(), '234');
  assert.equal(invoke('WriteFile', h, buf, 3, n, 0), 0);
  assert.equal(g.lastError, 5);
  assert.equal(open('../outside.txt'), -1);
  assert.equal(open('escape.txt'), -1); // symlink must not escape the mounted root
  const metadataOnly = invoke('CreateFileA', g.cstr('Folder/data.bin'), 0, 1, 0, 3, 0, 0);
  assert.notEqual(metadataOnly, -1);
  assert.equal(invoke('ReadFile', metadataOnly, buf, 1, n, 0), 0);
  assert.equal(g.lastError, 5);
  assert.equal(invoke('CloseHandle', metadataOnly), 1);
  if (sharedMemory) {
    const worker = new Worker(new URL('./test-shared-file-worker.mjs', import.meta.url), { workerData: { mem: g.mem, root, handle: h } });
    const result = await new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); });
    assert.deepEqual(result, { ok: 1, count: 3, text: '567' });
    assert.equal(invoke('ReadFile', h, buf, 2, n, 0), 1);
    assert.equal(Buffer.from(g.u8.subarray(buf, buf + 2)).toString(), '89');
  }
  assert.equal(invoke('CloseHandle', h), 1);
  assert.equal(invoke('ReadFile', h, buf, 1, n, 0), 0);
  assert.equal(g.lastError, 6);
}
console.log('read-only guest files / seek / case / containment / cross-worker offset: PASS');
