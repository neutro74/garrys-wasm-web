import assert from 'node:assert/strict';
import {Guest} from './guest.mjs';
import {Vpk} from '../../lib/vpk.mjs';
const root=process.argv[2]??`${process.env.HOME}/.steam/steam/steamapps/common/GarrysMod`;
const g=new Guest({filesRoot:root}),key='particles/antlion_gib_01.pcf',expected=new Vpk(root+'/sourceengine/content_hl2_dir.vpk').read(key);
const h=g.files.open('c:sourceengine\\'+key.replaceAll('/','\\'),0x80000000,3);assert.notEqual(h,-1);
const p=g.alloc(expected.length),n=g.alloc(4);assert.equal(g.files.read(h,p,expected.length,n,0),1);assert.equal(g.u32(n),expected.length);assert.deepEqual(g.u8.slice(p,p+expected.length),new Uint8Array(expected));g.files.close(h);
console.log('base HL2 particle content through Win32 volume: PASS',expected.length);
assert.equal(g.files.attributes('c:sourceengine\\'+key.replaceAll('/','\\')).size,expected.length);
