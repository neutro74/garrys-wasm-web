// Writable overlay over a read-only install: nothing may ever reach the install directory.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Guest, SHIMS } from './guest.mjs';

for (const sharedMemory of [false, true]) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'overlay-test-'));
  const root = path.join(tmp, 'install'), overlay = path.join(tmp, 'overlay');
  fs.mkdirSync(path.join(root, 'cfg'), { recursive: true });
  fs.mkdirSync(path.join(root, 'maps'), { recursive: true });
  fs.writeFileSync(path.join(root, 'cfg', 'default.cfg'), 'original');
  fs.writeFileSync(path.join(root, 'maps', 'a.bsp'), 'AAAA');
  process.env.GMOD_OVERLAY = overlay;
  const g = new Guest({ filesRoot: root, sharedMemory });
  const call = (name, ...a) => SHIMS[`kernel32.dll!${name}`].fn.call({ g }, ...a);
  const s = (str) => g.cstr(str);
  const buf = g.alloc(64), n = g.alloc(4), pos = g.alloc(8);
  const GENERIC_READ = 0x80000000, GENERIC_WRITE = 0x40000000;
  const readAll = (name) => {
    const h = call('CreateFileA', s(name), GENERIC_READ, 1, 0, 3, 0, 0);
    assert.notEqual(h, -1, `open ${name}`);
    assert.equal(call('ReadFile', h, buf, 64, n, 0), 1);
    const text = Buffer.from(g.u8.subarray(buf, buf + g.u32(n))).toString();
    call('CloseHandle', h); return text;
  };

  // create + write a new file in an existing install directory
  let h = call('CreateFileA', s('cfg\\config.cfg'), GENERIC_WRITE, 1, 0, 2, 0, 0);
  assert.notEqual(h, -1);
  g.u8.set(Buffer.from('hello'), buf);
  assert.equal(call('WriteFile', h, buf, 5, n, 0), 1);
  assert.equal(g.u32(n), 5);
  assert.equal(call('CloseHandle', h), 1);
  assert.equal(readAll('cfg\\config.cfg'), 'hello');
  assert.equal(fs.existsSync(path.join(root, 'cfg', 'config.cfg')), false, 'install must not gain files');

  // modify an install file: copy-on-write
  h = call('CreateFileA', s('cfg\\default.cfg'), GENERIC_READ | GENERIC_WRITE, 1, 0, 3, 0, 0);
  assert.notEqual(h, -1);
  assert.equal(call('SetFilePointerEx', h, 0, 0, pos, 2), 1);        // seek to end
  g.u8.set(Buffer.from('+more'), buf);
  assert.equal(call('WriteFile', h, buf, 5, n, 0), 1);
  call('CloseHandle', h);
  assert.equal(readAll('cfg\\default.cfg'), 'original+more');
  assert.equal(fs.readFileSync(path.join(root, 'cfg', 'default.cfg'), 'utf8'), 'original');

  // directories
  assert.equal(call('CreateDirectoryA', s('data'), 0), 1);
  assert.equal(call('CreateDirectoryA', s('data'), 0), 0);
  assert.equal(g.lastError, 183);
  assert.equal(call('CreateDirectoryA', s('nope\\child'), 0), 0);
  assert.equal(g.lastError, 3);
  assert.equal(fs.existsSync(path.join(root, 'data')), false);

  // delete an install file: whiteout, install untouched
  assert.equal(call('DeleteFileA', s('maps\\a.bsp')), 1);
  assert.equal(call('CreateFileA', s('maps\\a.bsp'), GENERIC_READ, 1, 0, 3, 0, 0), -1);
  assert.equal(fs.existsSync(path.join(root, 'maps', 'a.bsp')), true);
  // ...and recreating it works
  h = call('CreateFileA', s('maps\\a.bsp'), GENERIC_WRITE, 1, 0, 1, 0, 0);
  assert.notEqual(h, -1); call('CloseHandle', h);

  // move + copy
  assert.equal(call('MoveFileExA', s('cfg\\config.cfg'), s('data\\moved.cfg'), 0), 1);
  assert.equal(readAll('data\\moved.cfg'), 'hello');
  assert.equal(call('CreateFileA', s('cfg\\config.cfg'), GENERIC_READ, 1, 0, 3, 0, 0), -1);
  assert.equal(call('CopyFileA', s('data\\moved.cfg'), s('data\\copy.cfg'), 1), 1);
  assert.equal(call('CopyFileA', s('data\\moved.cfg'), s('data\\copy.cfg'), 1), 0);
  assert.equal(g.lastError, 80);

  // read-only handles still cannot write; escapes still refused
  h = call('CreateFileA', s('cfg\\default.cfg'), GENERIC_READ, 1, 0, 3, 0, 0);
  assert.equal(call('WriteFile', h, buf, 1, n, 0), 0);
  assert.equal(g.lastError, 5);
  assert.equal(call('CreateFileA', s('..\\outside.txt'), GENERIC_WRITE, 1, 0, 2, 0, 0), -1);

  // directory removal hides the install directory's whiteout state
  assert.equal(call('DeleteFileA', s('data\\moved.cfg')), 1);
  assert.equal(call('DeleteFileA', s('data\\copy.cfg')), 1);
  assert.equal(call('RemoveDirectoryA', s('data')), 1);
  assert.equal(call('RemoveDirectoryA', s('cfg')), 0);               // still has default.cfg
  assert.equal(g.lastError, 145);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`PASS overlay (sharedMemory=${sharedMemory})`);
}
process.exit(0);
