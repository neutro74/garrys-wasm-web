import { Guest } from './guest.mjs';
const g = new Guest({ log: (s) => console.log(s) });
const lua = await g.load(process.argv[2] || 'out/lua_shared');
const ex = lua.meta.exports;
function step(name, fn) {
  try { const r = fn(); console.log(name, '->', typeof r === 'number' ? '0x' + (r >>> 0).toString(16) : r); return r; }
  catch (e) {
    console.log(name, 'FAILED:', e.message);
    console.log((e.stack || '').split('\n').filter((l) => /f_[0-9a-f]{8}/.test(l)).slice(0, 6).join('\n'));
    console.log('regs at last block start:', g.lastRegs());
    if (process.env.DUMP) console.log(g.dumpRegs(parseInt(process.env.DUMP.split(',')[0], 16), parseInt(process.env.DUMP.split(',')[1], 16)).join('\n'));
    console.log('last blocks:', g.lastBlocks(60).join(' '));
    process.exit(1);
  }
}
const call = (n, ...a) => g.call(lua, ex[n], a);
step('DllMain', () => g.call(lua, lua.meta.entry, [lua.meta.base, 1, 0], { cdecl: false }));
const L = step('luaL_newstate', () => call('luaL_newstate'));
step('luaL_openlibs', () => call('luaL_openlibs', L));
step('luaJIT_setmode(off)', () => call('luaJIT_setmode', L, 0, 0));
const code = g.cstr('return 1 + 2 * 20');
step('luaL_loadstring', () => call('luaL_loadstring', L, code));
step('lua_pcall', () => call('lua_pcall', L, 0, 1, 0));
call('lua_tonumber', L, 0xffffffff); console.log('result =', g.st0(lua));
