import assert from 'node:assert/strict';
import { Guest, SHIMS } from './guest.mjs';

const g = new Guest({ pages: 512 });
const invoke = (name, ...args) => SHIMS[`kernel32.dll!${name}`].fn.call({ g }, ...args);
const cs = g.alloc(24);
invoke('InitializeCriticalSection', cs);
invoke('EnterCriticalSection', cs); invoke('EnterCriticalSection', cs);
assert.equal(g.u32(cs + 8), 2);
invoke('LeaveCriticalSection', cs); invoke('LeaveCriticalSection', cs);
assert.equal(g.u32(cs + 4), 0xffffffff);
assert.throws(() => invoke('LeaveCriticalSection', cs), /unowned/);
invoke('DeleteCriticalSection', cs);
const lock = g.alloc(4);
invoke('AcquireSRWLockShared', lock);
assert.throws(() => invoke('AcquireSRWLockExclusive', lock), /thread scheduling/);
invoke('ReleaseSRWLockShared', lock);
invoke('AcquireSRWLockExclusive', lock);
assert.throws(() => invoke('AcquireSRWLockShared', lock), /thread scheduling/);
invoke('ReleaseSRWLockExclusive', lock);

const name = g.cstr('test-event');
const event = invoke('CreateEventA', 0, 0, 0, name);
const other = invoke('CreateEventA', 0, 1, 1, name);
assert.equal(g.lastError, 183);
assert.equal(invoke('WaitForSingleObject', event, 0), 258);
assert.throws(() => invoke('WaitForSingleObject', event, 1), /thread scheduling/);
assert.equal(invoke('SetEvent', other), 1);
assert.equal(invoke('WaitForSingleObject', event, 0), 0);
assert.equal(invoke('WaitForSingleObject', other, 0), 258); // auto-reset
assert.equal(invoke('CloseHandle', event), 1);
assert.equal(invoke('CloseHandle', other), 1);
assert.equal(invoke('CloseHandle', other), 0);

const info = g.alloc(156);
g.u32(info, 156);
assert.equal(invoke('GetVersionExA', info), 1);
assert.equal(g.u32(info + 4), 10);
assert.equal(g.u8[info + 154], 1);
g.u32(info, 42);
assert.equal(invoke('GetVersionExA', info), 0);
assert.equal(g.lastError, 87);
invoke('GetSystemInfo', info);
assert.equal(g.u32(info + 4), 4096);
assert.equal(g.u32(info + 20), 1);
console.log('Win32 guest synchronization and system information: PASS');
