import { Guest } from './guest.mjs';
let g, lua, ex, call, L, lenp;
async function fresh() {
  const shared = JSON.parse((await import('node:fs')).readFileSync((process.argv[3] || process.argv[2]) + '.json', 'utf8')).shared_memory;
  g = new Guest({ sharedMemory: !!shared, log: (s) => console.log('  [guest]', s) });
  const dependencies = [];
  for (const prefix of process.argv.slice(3)) dependencies.push(await g.load(prefix));
  lua = await g.load(process.argv[2] || 'out/lua_shared');
  ex = lua.meta.exports; call = (n, ...a) => g.call(lua, ex[n], a);
  for (const d of [...dependencies, lua]) {
    g.initialize(d);
  }
  L = call('luaL_newstate'); call('luaL_openlibs', L); if (!process.env.LUA_JIT_ON) call('luaJIT_setmode', L, 0, 0);   // LUA_JIT_ON=1 leaves LuaJIT's default (JIT on)
  lenp = g.alloc(8);
}
const only = process.env.ONLY;
function run(src) {
  const top0 = call('lua_gettop', L);
  const rc = call('luaL_loadstring', L, g.cstr(src)) || call('lua_pcall', L, 0, 1, 0);
  const t = call('lua_type', L, -1);
  let v;
  if (t === 3) { call('lua_tonumber', L, -1); v = g.st0(lua); }
  else if (t === 4) { const p = call('lua_tolstring', L, -1, lenp); v = g.readStr(p); }
  else if (t === 1) v = !!call('lua_toboolean', L, -1);
  else v = `type ${t}`;
  call('lua_settop', L, top0);
  return rc ? `ERR(${rc}) ${v}` : v;
}
const tests = [
  ['arith', 'return (7 * 6) / 4 + 2^10 - 17 % 5', 1024 + 10.5 - 2 + 0 - 0 + 0],
  ['fib', 'local function f(n) if n < 2 then return n end return f(n-1) + f(n-2) end return f(24)', 46368],
  ['loop sum', 'local s = 0 for i = 1, 1000000 do s = s + i * 0.5 end return s', 250000250000],
  ['string.rep/len', 'return #string.rep("ab", 5000)', 10000],
  ['string.format', 'return string.format("%5.2f|%d|%s|%x", 3.14159, 42, "hi", 255)', ' 3.14|42|hi|ff'],
  ['gsub', 'return (("hello world"):gsub("o", "0"))', 'hell0 w0rld'],
  ['table.sort', 'local t = {} for i = 1, 500 do t[i] = (i * 7919) % 1009 end table.sort(t) return t[1] .. "," .. t[250] .. "," .. t[500]', '1,502,1006'],
  ['closures', 'local function mk() local n = 0 return function() n = n + 1 return n end end local a, b = mk(), mk() a() a() return a() * 10 + b()', 31],
  ['pcall error', 'local ok, e = pcall(function() error("boom") end) return tostring(ok) .. ":" .. e', 'false:[string "local ok, e = pcall(function() error("boom") end) return tostring(ok) .. ":" .. e"]:1: boom'],
  ['math', 'return math.floor(math.sin(1) * 1000) .. ":" .. math.floor(math.sqrt(2) * 1e6) .. ":" .. math.max(3, 9, 4) .. ":" .. math.abs(-2.5)', '841:1414213:9:2.5'],
  ['tostring num', 'return tostring(1/3) .. " " .. tostring(2^53) .. " " .. tostring(-0.5)', '0.33333333333333 9.007199254741e+15 -0.5'],
  ['coroutine', 'local co = coroutine.wrap(function() for i = 1, 3 do coroutine.yield(i) end end) return co() + co() + co()', 6],
  ['metatable', 'local mt = {__add = function(a, b) return a.v + b.v end} local x = setmetatable({v = 5}, mt) local y = setmetatable({v = 7}, mt) return x + y', 12],
  ['string.byte/char', 'return string.char(72, 105) .. string.byte("A")', 'Hi65'],
  ['bit', 'return bit.band(0xff00, 0x0ff0) + bit.lshift(1, 20) + bit.bxor(5, 3)', 0x0f00 + (1 << 20) + 6],
  ['tonumber', 'return tonumber("0x1F") + tonumber("  12.5  ") + tonumber("1e2")', 31 + 12.5 + 100],
  ['jit off', 'return jit.status() == false and 1 or 0', 1],
];
let pass = 0, fail = 0;
for (const [name, src, want] of tests) {
  if (only && name !== only) continue;
  await fresh();
  let got;
  try { got = run(src); } catch (e) { got = 'CRASH ' + e.message.split('\n')[0]; if (process.env.TRACE) console.log(g.lastRegs(), '\n', g.lastBlocks(30).join(' ')); }
  const ok = want === null ? !String(got).startsWith('ERR') && !String(got).startsWith('CRASH') : (typeof want === 'number' ? Math.abs(got - want) < 1e-6 * Math.max(1, Math.abs(want)) : got === want);
  console.log(ok ? 'PASS' : 'FAIL', name, '=>', got, ok ? '' : `(want ${want})`);
  ok ? pass++ : fail++;
}
console.log(`${pass} pass, ${fail} fail`);
if (fail) process.exitCode = 1;
