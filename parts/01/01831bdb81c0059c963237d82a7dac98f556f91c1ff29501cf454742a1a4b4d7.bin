import assert from 'node:assert/strict';
import { Guest, SHIMS } from './guest.mjs';

const g = new Guest({ sharedMemory: true });
const d = await g.load(`${process.argv[2]}/primary`);
g.initialize(d);
const id = g.alloc(4);
const context = { g, dll: d };
const critical = d.meta.base + 0x2820;
SHIMS['kernel32.dll!InitializeCriticalSection'].fn.call(context, critical);
SHIMS['kernel32.dll!EnterCriticalSection'].fn.call(context, critical);
const event = SHIMS['kernel32.dll!CreateEventA'].fn.call(context, 0, 0, 0, 0);
g.u32(d.meta.base + 0x2850, event);
const create = SHIMS['kernel32.dll!CreateThread'].fn;
const handle = create.call(context, 0, 0, d.meta.exports.worker, 23, 4, id);
assert.ok(handle);
assert.equal(g.u32(id), 2);
const alias = SHIMS['kernel32.dll!OpenThread'].fn.call(context, 0x12, 0, 2);
assert.notEqual(alias, handle);
const ctx = g.alloc(28);
g.u32(ctx, 0x10010);
assert.equal(SHIMS['kernel32.dll!SetThreadContext'].fn.call(context, alias, ctx), 1);
g.u32(ctx + 4, 1);
// Debug registers are recorded; execution breakpoints are a documented gap.
assert.equal(SHIMS['kernel32.dll!SetThreadContext'].fn.call(context, alias, ctx), 1);
assert.equal(g.handles.get(alias).debugRegisters[0], 1);
const wait = SHIMS['kernel32.dll!WaitForSingleObject'].fn;
assert.equal(wait.call(context, handle, 0), 258);
assert.equal(g.u32(d.meta.base + 0x2800), 0);
// SuspendThread reports the resulting count (see guest.mjs); resume until the
// thread is runnable again.
const level0 = g.u32(handle + 504);
assert.ok(level0 >= 1, 'CreateThread(CREATE_SUSPENDED) starts suspended');
assert.equal(SHIMS['kernel32.dll!SuspendThread'].fn.call(context, alias), level0 + 1);
let resumes = 0;
while (SHIMS['kernel32.dll!ResumeThread'].fn.call(context, handle) !== 0) resumes++;
assert.equal(resumes, level0 + 1);
assert.equal(SHIMS['kernel32.dll!CloseHandle'].fn.call(context, alias), 1);
SHIMS['kernel32.dll!LeaveCriticalSection'].fn.call(context, critical);
assert.equal(SHIMS['kernel32.dll!SetEvent'].fn.call(context, event), 1);
assert.equal(wait.call(context, handle, 15000), 0);
const exit = g.alloc(4);
assert.equal(SHIMS['kernel32.dll!GetExitCodeThread'].fn.call(context, handle, exit), 1);
assert.equal(g.u32(exit), 0x42);
assert.equal(g.u32(d.meta.base + 0x2800), 23);
assert.notEqual(g.u32(d.meta.base + 0x2804), 0x1000); // worker's own TEB
assert.equal(g.u32(d.meta.base + 0x2808), 1); // DLL_THREAD_ATTACH
assert.equal(g.u32(d.meta.base + 0x280c), 1); // DLL_THREAD_DETACH
SHIMS['kernel32.dll!DeleteCriticalSection'].fn.call(context, critical);
SHIMS['kernel32.dll!CloseHandle'].fn.call(context, event);
console.log('guest CreateThread / worker / attach / detach / wait: PASS');
