// Retail DLL smoke test; does not claim to initialize the engine or a map.
import assert from 'node:assert/strict';
import { Guest } from './guest.mjs';

const g = new Guest();
const prefixes = process.argv.slice(2);
for (const p of prefixes.length ? prefixes : ['out/tier0-multi', 'out/vstdlib-multi', 'out/steam-multi', 'out/lua-multi', 'out/input-multi', 'out/engine-multi', 'out/server-multi'])
  await g.load(p);
for (const dll of g.dlls.values()) {
  assert.ok(dll.meta.tls, `${dll.name} requires TLS metadata in this retail build`);
  assert.equal(g.initialize(dll), 1);
  console.log(`PASS ${dll.name} DllMain`);
}
function get(dll, name) {
  const status = g.alloc(4);
  const object = g.call(dll, dll.meta.exports.CreateInterface, [g.cstr(name), status]);
  return { object, status: g.u32(status) };
}
function check(dll, name) {
  assert.ok(dll?.meta.exports.CreateInterface, `${dll?.name} CreateInterface`);
  const { object, status } = get(dll, name);
  assert.equal(status, 0, name);
  assert.notEqual(object, 0, name);
  const vtable = g.u32(object);
  assert.ok(vtable >= dll.meta.base && vtable < dll.meta.base + dll.meta.size, name);
  assert.equal(get(dll, name).object, object, `${name} should be stable`);
  console.log(`PASS ${name} object=0x${object.toString(16)} vtable=0x${vtable.toString(16)}`);
}
const server = g.dlls.get('server.dll');
for (const name of ['ServerGameDLL009', 'ServerGameClients004', 'ServerGameEnts001']) check(server, name);
const engine = g.dlls.get('engine.dll');
for (const name of ['VEngineServer021', 'VEngineClient015']) check(engine, name);
assert.deepEqual(get(server, 'GameBoxNonexistentInterface'), { object: 0, status: 1 });
assert.deepEqual(get(engine, 'GameBoxNonexistentInterface'), { object: 0, status: 1 });
console.log('PASS unknown interface rejection');
