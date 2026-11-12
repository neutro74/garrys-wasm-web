// Assembles tiny D3D9 shaders by hand and checks that they translate to GLSL.
import assert from 'node:assert/strict';
import { parseShader, translate, buildProgram, disassemble, USAGE } from './shader.js';

import { R, dst, src, dcl, dclSampler, inst, ver, asm } from './asm.js';

const vs = asm(ver('vs', 2, 0),
  dcl(USAGE.POSITION, 0, R.INPUT, 0), dcl(USAGE.TEXCOORD, 0, R.INPUT, 1),
  inst(20, dst(R.RASTOUT, 0), src(R.INPUT, 0), src(R.CONST, 0)),
  inst(1, dst(R.TEXCRDOUT, 0), src(R.INPUT, 1)));
const ps = asm(ver('ps', 2, 0),
  dcl(0, 0, R.ADDR, 0), dclSampler(0, 2),
  inst(66, dst(R.TEMP, 0), src(R.ADDR, 0), src(R.SAMPLER, 0)),
  inst(5, dst(R.COLOROUT, 0, 15, { dmod: 1 }), src(R.TEMP, 0), src(R.CONST, 4)));

const vt = translate(parseShader(vs)), pt = translate(parseShader(ps));
assert.deepEqual(vt.inputs.map((i) => [i.reg, i.name]), [[0, 'POSITION0'], [1, 'TEXCOORD0']]);
assert.deepEqual(vt.outputs.map((o) => o.name), ['TEXCOORD0']);
assert.deepEqual(pt.samplers, [{ reg: 0, type: '2d' }]);
assert.equal(vt.constCount, 4);
const prog = buildProgram(vt, pt);
assert.match(prog.vs, /vv_TEXCOORD0 = oT0;/);
assert.match(prog.vs, /oPos\.xyz?w? = |oPos = vec4\(dot/);
assert.match(prog.ps, /vt_0 = vv_TEXCOORD0;/);
assert.match(prog.ps, /oC0 = clamp\(r0 \* pc\[4\], 0\.0, 1\.0\);/);
console.log(disassemble(vs));
console.log(prog.vs.split('\n').filter((l) => /main|oPos|vv_|v0 =/.test(l)).join('\n'));
console.log('shader translator: PASS');

// SM1 tokens have no instruction-length field; tex/texcrd arity changes in 1.4.
for (const minor of [1, 2, 3, 4]) {
  const code = new Uint32Array([
    ver('ps', 1, minor),
    64, dst(minor === 4 ? R.TEMP : R.ADDR, 0), ...(minor === 4 ? [src(R.ADDR, 0)] : []),
    66, dst(minor === 4 ? R.TEMP : R.ADDR, 0), ...(minor === 4 ? [src(R.ADDR, 1)] : []),
    ...(minor === 4 ? [0xfffd] : []),
    5, dst(R.TEMP, 0), src(minor === 4 ? R.TEMP : R.ADDR, 0), src(R.INPUT, 0),
    0xffff,
  ]);
  const translated = translate(parseShader(code));
  assert.deepEqual(translated.colorOuts, [0]);
  assert.deepEqual(translated.samplers, [{ reg: 0, type: '2d' }]);
  assert.match(translated.main.join('\n'), /oC0 = r0/);
  assert.match(buildProgram(vt, translated).ps, /texture\(s/);
}
console.log('SM1 texture, implicit output, phase: PASS');
const co = translate(parseShader(Uint32Array.from([
  ver('ps',1,1), 1, dst(R.TEMP,0,7), src(R.INPUT,0),
  0x40000001, dst(R.TEMP,0,8), src(R.TEMP,0,0xff), 0xffff,
])));
assert.match(co.main.join('\n'), /vec4 co0 = r0.wwww;[\s\S]*r0.xyz = \(vi_0\).xyz;[\s\S]*r0.w = \(co0\).w;/);
const depth = translate(parseShader(asm(ver('ps',2,0), inst(1,dst(R.DEPTHOUT,0),src(R.CONST,0)))));
assert.match(depth.main.join('\n'), /oDepth = \(pc\[0\]\)\.x;/);
