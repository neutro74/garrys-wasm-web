import { Guest } from './guest.mjs';
const g = new Guest({ log: () => {} });
const lua = await g.load(process.argv[2] || 'out/lua_shared');
const ex = lua.meta.exports, call = (n, ...a) => g.call(lua, ex[n], a);
g.call(lua, lua.meta.entry, [lua.meta.base, 1, 0]);
const L = call('luaL_newstate'); call('luaL_openlibs', L); call('luaJIT_setmode', L, 0, 0);
const lenp = g.alloc(8);
function run(src) {
  const rc = call('luaL_loadstring', L, g.cstr(src)) || call('lua_pcall', L, 0, 1, 0);
  const t = call('lua_type', L, -1); let v;
  if (t === 3) { call('lua_tonumber', L, -1); v = g.st0(lua); } else if (t === 4) v = g.readStr(call('lua_tolstring', L, -1, lenp)); else if (t === 1) v = !!call('lua_toboolean', L, -1); else v = 'type ' + t;
  call('lua_settop', L, -2); return (rc ? 'ERR ' : '') + v;
}
for (const src of process.argv.slice(3)) console.log(JSON.stringify(src), '=>', run(src));
