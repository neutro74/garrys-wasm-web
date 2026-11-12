// Direct3D 9 shader bytecode (vs/ps 1.x-3.0) to GLSL ES 3.00.
//
// parseShader() decodes the token stream; translate() turns it into a GLSL body whose
// varyings, vertex inputs and samplers are described in the returned metadata so the
// renderer can link a vertex/pixel pair and bind resources.

export const USAGE = { POSITION: 0, BLENDWEIGHT: 1, BLENDINDICES: 2, NORMAL: 3, PSIZE: 4, TEXCOORD: 5, TANGENT: 6, BINORMAL: 7, TESSFACTOR: 8, POSITIONT: 9, COLOR: 10, FOG: 11, DEPTH: 12, SAMPLE: 13 };
const USAGE_NAMES = ['POSITION', 'BLENDWEIGHT', 'BLENDINDICES', 'NORMAL', 'PSIZE', 'TEXCOORD', 'TANGENT', 'BINORMAL', 'TESSFACTOR', 'POSITIONT', 'COLOR', 'FOG', 'DEPTH', 'SAMPLE'];

const R = { TEMP: 0, INPUT: 1, CONST: 2, ADDR: 3, RASTOUT: 4, ATTROUT: 5, TEXCRDOUT: 6, CONSTINT: 7, COLOROUT: 8, DEPTHOUT: 9, SAMPLER: 10, CONST2: 11, CONST3: 12, CONST4: 13, CONSTBOOL: 14, LOOP: 15, TEMPFLOAT16: 16, MISC: 17, LABEL: 18, PREDICATE: 19 };

// opcode -> [name, hasDestination, sourceCount]; lengths are explicit in 2.0+ tokens, counts are used for 1.x.
const OPS = {
  0: ['nop', 0, 0], 1: ['mov', 1, 1], 2: ['add', 1, 2], 3: ['sub', 1, 2], 4: ['mad', 1, 3], 5: ['mul', 1, 2], 6: ['rcp', 1, 1], 7: ['rsq', 1, 1],
  8: ['dp3', 1, 2], 9: ['dp4', 1, 2], 10: ['min', 1, 2], 11: ['max', 1, 2], 12: ['slt', 1, 2], 13: ['sge', 1, 2], 14: ['exp', 1, 1], 15: ['log', 1, 1],
  16: ['lit', 1, 1], 17: ['dst', 1, 2], 18: ['lrp', 1, 3], 19: ['frc', 1, 1], 20: ['m4x4', 1, 2], 21: ['m4x3', 1, 2], 22: ['m3x4', 1, 2], 23: ['m3x3', 1, 2],
  24: ['m3x2', 1, 2], 25: ['call', 0, 1], 26: ['callnz', 0, 2], 27: ['loop', 0, 2], 28: ['ret', 0, 0], 29: ['endloop', 0, 0], 30: ['label', 0, 1],
  31: ['dcl', 0, 0], 32: ['pow', 1, 2], 33: ['crs', 1, 2], 34: ['sgn', 1, 3], 35: ['abs', 1, 1], 36: ['nrm', 1, 1], 37: ['sincos', 1, 1], 38: ['rep', 0, 1],
  39: ['endrep', 0, 0], 40: ['if', 0, 1], 41: ['ifc', 0, 2], 42: ['else', 0, 0], 43: ['endif', 0, 0], 44: ['break', 0, 0], 45: ['breakc', 0, 2],
  46: ['mova', 1, 1], 47: ['defb', 0, 0], 48: ['defi', 0, 0],
  64: ['texcoord', 1, 0], 65: ['texkill', 1, 0], 66: ['texld', 1, 0], 67: ['texbem', 1, 1], 68: ['texbeml', 1, 1], 69: ['texreg2ar', 1, 1], 70: ['texreg2gb', 1, 1],
  71: ['texm3x2pad', 1, 1], 72: ['texm3x2tex', 1, 1], 73: ['texm3x3pad', 1, 1], 74: ['texm3x3tex', 1, 1], 76: ['texm3x3spec', 1, 2], 77: ['texm3x3vspec', 1, 1],
  78: ['expp', 1, 1], 79: ['logp', 1, 1], 80: ['cnd', 1, 3], 81: ['def', 0, 0], 82: ['texreg2rgb', 1, 1], 83: ['texdp3tex', 1, 1], 84: ['texm3x2depth', 1, 1],
  85: ['texdp3', 1, 1], 86: ['texm3x3', 1, 1], 87: ['texdepth', 1, 0], 88: ['cmp', 1, 3], 89: ['bem', 1, 2], 90: ['dp2add', 1, 3], 91: ['dsx', 1, 1],
  92: ['dsy', 1, 1], 93: ['texldd', 1, 4], 94: ['setp', 1, 2], 95: ['texldl', 1, 2], 96: ['breakp', 0, 1],
};

const regType = (tok) => ((tok >>> 28) & 7) | ((tok >>> 8) & 0x18);

function readParam(words, i, major, isDst) {
  const tok = words[i++];
  const p = { type: regType(tok), num: tok & 0x7ff, rel: !!((tok >>> 13) & 1) };
  if (isDst) {
    p.mask = (tok >>> 16) & 0xf;
    p.mod = (tok >>> 20) & 0xf;
    p.shift = (tok >>> 24) & 0xf; if (p.shift > 7) p.shift -= 16;
  } else {
    p.swz = (tok >>> 16) & 0xff;
    p.smod = (tok >>> 24) & 0xf;
  }
  if (p.rel) {
    if (major >= 2) {
      const rt = words[i++];
      p.relReg = { type: regType(rt), num: rt & 0x7ff, swz: (rt >>> 16) & 0xff };
    } else {
      p.relReg = { type: R.ADDR, num: 0, swz: 0 };      // vs_1_1: relative addressing always uses a0.x
    }
  }
  return [p, i];
}

export function parseShader(words) {
  const ver = words[0];
  const stage = (ver >>> 16) === 0xfffe ? 'vs' : 'ps';
  const major = (ver >>> 8) & 0xff, minor = ver & 0xff;
  const insts = [], dcls = [], defs = { f: new Map(), i: new Map(), b: new Map() };
  let i = 1;
  while (i < words.length) {
    const tok = words[i];
    const op = tok & 0xffff;
    if (op === 0xffff) break;
    if (op === 0xfffd && stage === 'ps' && major === 1 && minor === 4) { i++; continue; }
    if (op === 0xfffe) { i += 1 + ((tok >>> 16) & 0x7fff); continue; }
    const info = OPS[op];
    if (!info) throw new Error(`unknown shader opcode ${op} at token ${i}`);
    const [name, hasDst, nsrc] = info;
    let next;
    if (major >= 2) next = i + 1 + ((tok >>> 24) & 0xf);
    const inst = { op, name, control: (tok >>> 16) & 0xff, pred: null, coissue: !!(tok & 0x40000000) };
    let p = i + 1;
    if (name === 'dcl') {
      const d = words[p];
      const usage = d & 0x1f, index = (d >>> 16) & 0xf, texType = (d >>> 27) & 0xf;
      const [dst] = readParam(words, p + 1, major, true);
      dcls.push({ ...dst, usage, index, texType });
      i = next ?? p + 2; continue;
    }
    if (name === 'def') {
      const [dst, q] = readParam(words, p, major, true);
      const f = new Float32Array(new Uint32Array([words[q], words[q + 1], words[q + 2], words[q + 3]]).buffer);
      defs.f.set(dst.num, Array.from(f));
      i = q + 4; continue;
    }
    if (name === 'defi') {
      const [dst, q] = readParam(words, p, major, true);
      defs.i.set(dst.num, [words[q] | 0, words[q + 1] | 0, words[q + 2] | 0, words[q + 3] | 0]);
      i = q + 4; continue;
    }
    if (name === 'defb') {
      const [dst, q] = readParam(words, p, major, true);
      defs.b.set(dst.num, words[q] !== 0);
      i = q + 1; continue;
    }
    if (tok & 0x10000000) inst.hasPred = true;
    const srcLimit = next ?? Infinity;
    let dst = null;
    const srcs = [];
    const dstIsFirst = hasDst || (name === 'texkill') || name === 'texcoord';
    if (hasDst) { [dst, p] = readParam(words, p, major, true); inst.dst = dst; }
    else if (name === 'texkill' || name === 'texcoord') { [dst, p] = readParam(words, p, major, true); inst.dst = dst; }
    void dstIsFirst;
    // 1.x instructions carry no length: read the fixed source count. 2.0+ reads until the length ends.
    if (major >= 2) {
      let end = next;
      if (inst.hasPred) end -= 1;
      while (p < end) { let s; [s, p] = readParam(words, p, major, false); srcs.push(s); }
      if (inst.hasPred) { let s; [s, p] = readParam(words, p, major, false); inst.pred = s; }
      p = next;
    } else {
      for (let k = 0; k < (stage === 'ps' && major === 1 && minor === 4 && (name === 'texld' || name === 'texcoord') ? 1 : nsrc); k++) { let s; [s, p] = readParam(words, p, major, false); srcs.push(s); }
    }
    void srcLimit;
    inst.srcs = srcs;
    insts.push(inst);
    i = p;
  }
  return { stage, major, minor, insts, dcls, defs };
}

const SW = 'xyzw';
const swzString = (swz, n = 4) => { let s = ''; for (let k = 0; k < n; k++) s += SW[(swz >>> (2 * k)) & 3]; return s; };
const maskString = (m) => { let s = ''; for (let k = 0; k < 4; k++) if (m & (1 << k)) s += SW[k]; return s; };
const f = (v) => { if (!Number.isFinite(v)) return v > 0 ? '1.0e38' : v < 0 ? '-1.0e38' : '0.0'; const s = String(v); return /[.eE]/.test(s) ? s : s + '.0'; };

export const semName = (usage, index) => `${USAGE_NAMES[usage] ?? 'U' + usage}${index}`;

// Output of translate():
//   stage, glsl (function bodies and declarations without the #version header and varying declarations),
//   inputs: vertex shader attributes [{reg, usage, index}], outs: VS varying semantics, ins: PS varying semantics,
//   samplers: [{reg, type}], constCount, usesPos / psize flags.
export function translate(sh) {
  const { stage, major, defs } = sh;
  const legacyPs = stage === 'ps' && major === 1;
  const legacyTex = new Set();
  const vs = stage === 'vs';
  const pre = vs ? 'v' : 'p';
  const decl = [];          // global declarations
  const funcs = new Map();  // label -> lines
  let cur = [];
  const main = cur;
  let depth = 0, loopDepth = 0;
  const line = (s) => cur.push(s);

  const usedTemps = new Set(), usedConst = new Set();
  let maxConst = 0, relConst = false, maxTemp = -1;
  const samplers = new Map();
  const inputs = new Map();     // vs: reg -> {usage,index}; ps: key -> name
  const outputs = new Map();    // key "type:num" -> semantic name
  const texTypes = new Map();
  let usesDepthOut = false, usesFace = false, usesPos = false, usesPsize = false, usesColorOut = new Set();
  const dclByKey = new Map();
  for (const d of sh.dcls) {
    dclByKey.set(`${d.type}:${d.num}`, d);
    if (d.type === R.SAMPLER) { const t = d.texType; texTypes.set(d.num, t === 3 ? 'cube' : t === 4 ? 'volume' : '2d'); }
  }

  // Semantics of input/output registers.
  const inputSem = (type, num) => {
    const d = dclByKey.get(`${type}:${num}`);
    if (vs) return d ? semName(d.usage, d.index) : semName(USAGE.POSITION, num);
    if (major >= 3 && type === R.INPUT) return d ? semName(d.usage, d.index) : `TEXCOORD${num}`;
    if (type === R.INPUT) return `COLOR${num}`;
    return `TEXCOORD${num}`;
  };
  const outputSem = (type, num) => {
    if (type === R.ATTROUT) return `COLOR${num}`;
    if (type === R.TEXCRDOUT && major < 3) return `TEXCOORD${num}`;
    const d = dclByKey.get(`${type}:${num}`);
    return d ? semName(d.usage, d.index) : `TEXCOORD${num}`;
  };

  const reg = (p, isDst) => {
    const n = p.num;
    switch (p.type) {
      case R.TEMP: usedTemps.add(n); if (n > maxTemp) maxTemp = n; return `r${n}`;
      case R.INPUT:
        if (vs) { inputs.set(n, inputSem(R.INPUT, n)); return `v${n}`; }
        { const name = inputSem(R.INPUT, n); inputs.set(`I${n}`, name); return `vi_${n}`; }
      case R.CONST: case R.CONST2: case R.CONST3: case R.CONST4: {
        if (p.type === R.CONST2) throw new Error('constant registers above c2047 are not supported');
        if (p.rel) {
          relConst = true;
          return `${pre}c[${relIndex(p, n)}]`;
        }
        if (n + 1 > maxConst) maxConst = n + 1;
        if (defs.f.has(n)) return `cd${n}`;
        return `${pre}c[${n}]`;
      }
      case R.ADDR:
        if (vs) return 'a0';
        { const name = `TEXCOORD${n}`; inputs.set(`T${n}`, name); if (legacyPs) { legacyTex.add(n); return `t${n}`; } return `vt_${n}`; }
      case R.RASTOUT: if (n === 0) { usesPos = true; return 'oPos'; } if (n === 1) { outputs.set(`4:1`, 'FOG0'); return 'oFog'; } usesPsize = true; return 'oPts';
      case R.ATTROUT: outputs.set(`5:${n}`, outputSem(R.ATTROUT, n)); return `oD${n}`;
      case R.TEXCRDOUT: outputs.set(`6:${n}`, outputSem(R.TEXCRDOUT, n)); return major >= 3 ? `o${n}` : `oT${n}`;
      case R.COLOROUT: usesColorOut.add(n); return `oC${n}`;
      case R.DEPTHOUT: usesDepthOut = true; return 'oDepth';
      case R.CONSTINT: return defs.i.has(n) ? `ci${n}` : `${pre}i[${n}]`;
      case R.CONSTBOOL: return defs.b.has(n) ? `(${defs.b.get(n) ? 'true' : 'false'})` : `(${pre}b[${n}].x != 0)`;
      case R.LOOP: return 'aL';
      case R.MISC: if (n === 0) { return 'vPos'; } usesFace = true; return 'vFace';
      case R.PREDICATE: return 'p0';
      case R.SAMPLER: return `s${n}`;
      default: throw new Error(`unhandled register type ${p.type}`);
    }
    void isDst;
  };
  const relIndex = (p, base) => {
    const rr = p.relReg;
    const comp = SW[rr.swz & 3];
    if (rr.type === R.LOOP) return `aL + ${base}`;
    return `int(a0.${comp}) + ${base}`;
  };

  const modExpr = (e, mod) => {
    switch (mod) {
      case 0: return e;
      case 1: return `(-${e})`;
      case 2: return `(${e} - 0.5)`;
      case 3: return `(-(${e} - 0.5))`;
      case 4: return `((${e} - 0.5) * 2.0)`;
      case 5: return `(-((${e} - 0.5) * 2.0))`;
      case 6: return `(1.0 - ${e})`;
      case 7: return `(${e} * 2.0)`;
      case 8: return `(-(${e} * 2.0))`;
      case 9: return `(${e}.xyxy / ${e}.z)`;
      case 10: return `(${e}.xyxy / ${e}.w)`;
      case 11: return `abs(${e})`;
      case 12: return `(-abs(${e}))`;
      case 13: return `(!${e})`;
      default: throw new Error(`unhandled source modifier ${mod}`);
    }
  };
  // Source operand as a vec4 expression (swizzle then modifier).
  const snapshots = new Map();
  const S = (p) => {
    if (snapshots.has(p)) return snapshots.get(p);
    let base;
    if (p.type === R.CONSTINT) base = `vec4(${reg(p)})`;
    else if (p.type === R.LOOP) base = 'vec4(float(aL))';
    else if (p.type === R.MISC && p.num === 1) { usesFace = true; base = 'vec4(vFace)'; }
    else if (p.type === R.CONSTBOOL) base = `vec4(${reg(p)} ? 1.0 : 0.0)`;
    else if (p.type === R.PREDICATE) base = 'vec4(p0)';
    else if (p.type === R.ADDR && vs) base = 'vec4(a0)';
    else base = reg(p);
    const sw = p.swz === 0xe4 ? '' : '.' + swzString(p.swz);
    let e = sw ? `${base}${sw}` : base;
    if (p.type === R.CONSTBOOL || p.type === R.PREDICATE) return e;
    return modExpr(e, p.smod);
  };
  const srcScalar = (p) => `${S(p)}.x`;

  const D = (inst, expr) => {
    const d = inst.dst;
    let e = expr;
    if (d.shift) e = `(${e}) * ${f(Math.pow(2, d.shift))}`;
    if (d.mod & 1) e = `clamp(${e}, 0.0, 1.0)`;
    const name = reg(d, true);
    if (d.type === R.DEPTHOUT) { line(`${name} = (${e}).x;`); return; }
    const mask = d.mask === 15 ? '' : '.' + maskString(d.mask);
    if (d.type === R.ADDR && vs) { line(`a0${mask} = ivec4(floor(${e}))${mask};`); return; }
    if (!mask) line(`${name} = ${e};`);
    else line(`${name}${mask} = (${e})${mask};`);
  };

  const predWrap = (inst, body) => {
    if (inst.pred) {
      const sw = swzString(inst.pred.swz, 1);
      const neg = inst.pred.smod === 13 ? '!' : '';
      line(`if (${neg}p0.${sw}) {`); body(); line('}');
    } else body();
  };

  const cmpOp = (c) => ({ 1: '>', 2: '==', 3: '>=', 4: '<', 5: '!=', 6: '<=' }[c] ?? '==');
  const sampleExpr = (inst, coord, samplerNum, kind) => {
    const type = texTypes.get(samplerNum) ?? '2d';
    samplers.set(samplerNum, type);
    const s = `s${samplerNum}`;
    const c = coord;
    const dim = type === '2d' ? 'xy' : 'xyz';
    let t;
    if (kind === 'proj') t = type === '2d' ? `texture(${s}, ${c}.xy / ${c}.w)` : `texture(${s}, ${c}.xyz / ${c}.w)`;
    else if (kind === 'bias') t = `texture(${s}, ${c}.${dim}, ${c}.w)`;
    else if (kind === 'lod') t = `textureLod(${s}, ${c}.${dim}, ${c}.w)`;
    else t = `texture(${s}, ${c}.${dim})`;
    return stage === 'ps' ? `srgbRead(${t}, ${samplerNum})` : t;
  };

  let snapshotCount = 0;
  for (let index = 0; index < sh.insts.length; index++) {
    const inst = sh.insts[index];
    if (legacyPs && sh.insts[index + 1]?.coissue) {
      for (const operand of sh.insts[index + 1].srcs) {
        const name = `co${snapshotCount++}`;
        line(`vec4 ${name} = ${S(operand)};`);
        snapshots.set(operand, name);
      }
    }
    const { name, srcs } = inst;
    const s0 = srcs[0], s1 = srcs[1], s2 = srcs[2];
    switch (name) {
      case 'nop': break;
      case 'mov': predWrap(inst, () => D(inst, S(s0))); break;
      case 'mova': predWrap(inst, () => { const m = inst.dst.mask === 15 ? '' : '.' + maskString(inst.dst.mask); line(`a0${m} = ivec4(floor(${S(s0)} + 0.5))${m};`); }); break;
      case 'add': predWrap(inst, () => D(inst, `${S(s0)} + ${S(s1)}`)); break;
      case 'sub': predWrap(inst, () => D(inst, `${S(s0)} - ${S(s1)}`)); break;
      case 'mul': predWrap(inst, () => D(inst, `${S(s0)} * ${S(s1)}`)); break;
      case 'mad': predWrap(inst, () => D(inst, `${S(s0)} * ${S(s1)} + ${S(s2)}`)); break;
      case 'rcp': predWrap(inst, () => D(inst, `vec4(1.0 / ${srcScalar(s0)})`)); break;
      case 'rsq': predWrap(inst, () => D(inst, `vec4(inversesqrt(abs(${srcScalar(s0)})))`)); break;
      case 'dp2add': predWrap(inst, () => D(inst, `vec4(dot(${S(s0)}.xy, ${S(s1)}.xy) + ${srcScalar(s2)})`)); break;
      case 'dp3': predWrap(inst, () => D(inst, `vec4(dot(${S(s0)}.xyz, ${S(s1)}.xyz))`)); break;
      case 'dp4': predWrap(inst, () => D(inst, `vec4(dot(${S(s0)}, ${S(s1)}))`)); break;
      case 'min': predWrap(inst, () => D(inst, `min(${S(s0)}, ${S(s1)})`)); break;
      case 'max': predWrap(inst, () => D(inst, `max(${S(s0)}, ${S(s1)})`)); break;
      case 'slt': predWrap(inst, () => D(inst, `vec4(lessThan(${S(s0)}, ${S(s1)}))`)); break;
      case 'sge': predWrap(inst, () => D(inst, `vec4(greaterThanEqual(${S(s0)}, ${S(s1)}))`)); break;
      case 'exp': case 'expp': predWrap(inst, () => D(inst, `vec4(exp2(${srcScalar(s0)}))`)); break;
      case 'log': case 'logp': predWrap(inst, () => D(inst, `vec4(log2(abs(${srcScalar(s0)})))`)); break;
      case 'lit': predWrap(inst, () => D(inst, `d3dLit(${S(s0)})`)); break;
      case 'dst': predWrap(inst, () => D(inst, `vec4(1.0, ${S(s0)}.y * ${S(s1)}.y, ${S(s0)}.z, ${S(s1)}.w)`)); break;
      case 'lrp': predWrap(inst, () => D(inst, `mix(${S(s2)}, ${S(s1)}, ${S(s0)})`)); break;
      case 'frc': predWrap(inst, () => D(inst, `fract(${S(s0)})`)); break;
      case 'pow': predWrap(inst, () => D(inst, `vec4(pow(abs(${srcScalar(s0)}), ${srcScalar(s1)}))`)); break;
      case 'crs': predWrap(inst, () => D(inst, `vec4(cross(${S(s0)}.xyz, ${S(s1)}.xyz), 0.0)`)); break;
      case 'sgn': predWrap(inst, () => D(inst, `sign(${S(s0)})`)); break;
      case 'abs': predWrap(inst, () => D(inst, `abs(${S(s0)})`)); break;
      case 'nrm': predWrap(inst, () => D(inst, `(${S(s0)} * inversesqrt(max(dot(${S(s0)}.xyz, ${S(s0)}.xyz), 1.0e-30)))`)); break;
      case 'sincos': predWrap(inst, () => D(inst, `vec4(cos(${srcScalar(s0)}), sin(${srcScalar(s0)}), 0.0, 0.0)`)); break;
      case 'cmp': predWrap(inst, () => D(inst, `mix(${S(s2)}, ${S(s1)}, vec4(greaterThanEqual(${S(s0)}, vec4(0.0))))`)); break;
      case 'cnd': predWrap(inst, () => D(inst, `mix(${S(s2)}, ${S(s1)}, vec4(greaterThan(${S(s0)}, vec4(0.5))))`)); break;
      case 'm4x4': case 'm4x3': case 'm3x4': case 'm3x3': case 'm3x2': predWrap(inst, () => {
        const rows = { m4x4: 4, m4x3: 3, m3x4: 4, m3x3: 3, m3x2: 2 }[name];
        const cols = { m4x4: 'xyzw', m4x3: 'xyzw', m3x4: 'xyz', m3x3: 'xyz', m3x2: 'xyz' }[name];
        const n = cols.length;
        const v = S(s0);
        const parts = [];
        for (let k = 0; k < rows; k++) {
          const row = { ...s1, num: s1.num + k };
          parts.push(`dot(${v}.${cols}, ${S(row)}.${cols})`);
        }
        void n;
        while (parts.length < 4) parts.push('0.0');
        D(inst, `vec4(${parts.join(', ')})`);
      }); break;
      case 'dsx': predWrap(inst, () => D(inst, `dFdx(${S(s0)})`)); break;
      case 'dsy': predWrap(inst, () => D(inst, `dFdy(${S(s0)})`)); break;
      case 'setp': predWrap(inst, () => {
        const m = maskString(inst.dst.mask);
        const op = cmpOp(inst.control & 7);
        line(`p0.${m} = (${S(s0)}.${m} ${op} ${S(s1)}.${m});`);
      }); break;
      case 'texkill': {
        const e = reg(inst.dst);
        line(`if (any(lessThan(${e}.xyz, vec3(0.0)))) discard;`);
        break;
      }
      case 'texcoord': {
        D(inst, s0 ? S(s0) : `clamp(vt_${inst.dst.num}, 0.0, 1.0)`);
        if (!s0) reg(inst.dst);
        break;
      }
      case 'texld': case 'texldl': case 'texldd': {
        let coord, samp, kind = 'plain';
        if (legacyPs) {
          if (s0) coord = S(s0);
          else { reg(inst.dst); coord = `vt_${inst.dst.num}`; }
          samp = inst.dst.num;
        } else if (major >= 2) {
          coord = S(s0); samp = s1.num;
          const ctl = inst.control & 0xf;
          if (name === 'texldl') kind = 'lod'; else if (ctl === 1) kind = 'proj'; else if (ctl === 2) kind = 'bias';
          if (name === 'texldd') {
            const type = texTypes.get(samp) ?? '2d'; samplers.set(samp, type);
            const dim = type === '2d' ? 'xy' : 'xyz';
            const g = `textureGrad(s${samp}, ${coord}.${dim}, ${S(srcs[2])}.${dim}, ${S(srcs[3])}.${dim})`;
            predWrap(inst, () => D(inst, stage === 'ps' ? `srgbRead(${g}, ${samp})` : g));
            break;
          }
        } else throw new Error('pixel shader 1.x texture instructions are not supported');
        predWrap(inst, () => D(inst, sampleExpr(inst, coord, samp, kind)));
        break;
      }
      case 'if': {
        const cond = s0.type === R.PREDICATE ? `p0.${swzString(s0.swz, 1)}` : s0.type === R.CONSTBOOL ? reg(s0) : `${S(s0)}.x != 0.0`;
        line(`if (${s0.smod === 13 ? '!' : ''}(${cond})) {`); depth++; break;
      }
      case 'ifc': line(`if (${S(s0)}.x ${cmpOp(inst.control & 7)} ${S(s1)}.x) {`); depth++; break;
      case 'else': line('} else {'); break;
      case 'endif': line('}'); depth--; break;
      case 'rep': {
        const d = loopDepth++;
        line(`for (int n${d} = 0; n${d} < ${reg(s0)}.x; n${d}++) {`); break;
      }
      case 'endrep': loopDepth--; line('}'); break;
      case 'loop': {
        const d = loopDepth++;
        line(`{ int sv${d} = aL; ivec4 lp${d} = ${reg(s1)};`);
        line(`for (int n${d} = 0; n${d} < lp${d}.x; n${d}++) { aL = lp${d}.y + n${d} * lp${d}.z;`); break;
      }
      case 'endloop': { loopDepth--; const d = loopDepth; line(`} aL = sv${d}; }`); break; }
      case 'break': line('break;'); break;
      case 'breakc': line(`if (${S(s0)}.x ${cmpOp(inst.control & 7)} ${S(s1)}.x) break;`); break;
      case 'breakp': line(`if (p0.${swzString(s0.swz, 1)}) break;`); break;
      case 'call': line(`sub${s0.num}();`); break;
      case 'callnz': predWrap(inst, () => line(`if (${s1.type === R.PREDICATE ? `p0.${swzString(s1.swz, 1)}` : reg(s1)}) sub${s0.num}();`)); break;
      case 'label': {
        cur = [];
        funcs.set(s0.num, cur);
        break;
      }
      case 'ret':
        if (cur === main && depth === 0) { cur = [];  /* anything after the main ret belongs to subroutines */ funcs.set('tail', cur); } else line('return;');
        break;
      default:
        throw new Error(`shader instruction '${name}' is not supported`);
    }
  }

  if (legacyPs) {
    reg({ type: R.TEMP, num: 0 }); usesColorOut.add(0);
    main.push('oC0 = r0;');
    for (const n of legacyTex) { decl.push(`vec4 t${n};`); main.unshift(`t${n} = vt_${n};`); }
  }

  // Declarations
  decl.push(`vec4 ${Array.from({ length: maxTemp + 1 }, (_, k) => `r${k}`).join(', ')};`.replace(/^vec4 $/, ''));
  if (maxTemp < 0) decl.pop();
  if (vs) decl.push('ivec4 a0;');
  decl.push('int aL;');
  decl.push('bvec4 p0;');
  for (const [n, v] of defs.f) decl.push(`const vec4 cd${n} = vec4(${v.map(f).join(', ')});`);
  for (const [n, v] of defs.i) decl.push(`const ivec4 ci${n} = ivec4(${v.join(', ')});`);

  const cCount = relConst ? 256 : Math.max(maxConst, 1);
  const inputList = vs
    ? [...inputs.entries()].map(([reg, name]) => ({ reg, name }))
    : [...inputs.entries()].map(([k, name]) => ({ key: k, name }));

  const body = [];
  const emitFunc = (n, lines) => { body.push(`void sub${n}() {`, ...lines, '}'); };
  const subs = [...funcs.entries()].filter(([k]) => k !== 'tail');
  for (const [n] of subs) body.push(`void sub${n}();`);
  for (const [n, lines] of subs) emitFunc(n, lines);
  void emitFunc;
  return {
    stage, major, decl, main, body,
    constCount: cCount, relConst,
    inputs: inputList, outputs: [...outputs.entries()].map(([k, name]) => ({ key: k, name })),
    samplers: [...samplers.entries()].map(([reg, type]) => ({ reg, type })),
    usesDepthOut, usesFace, usesPos, usesPsize, colorOuts: [...usesColorOut].sort(),
    defs, texTypes,
    maxTemp,
  };
}

// Disassembly for debugging.
export function disassemble(words) {
  const sh = parseShader(words);
  const out = [`${sh.stage}_${sh.major}_${sh.minor}`];
  const rn = (p) => ['r', 'v', 'c', sh.stage === 'vs' ? 'a' : 't', 'rast', 'oD', 'oT', 'i', 'oC', 'oDepth', 's', 'c', 'c', 'c', 'b', 'aL', 'r', 'misc', 'l', 'p'][p.type] + (p.type === R.LOOP ? '' : p.num);
  for (const d of sh.dcls) out.push(`dcl usage=${d.usage}/${d.index} ${rn(d)}`);
  for (const [n, v] of sh.defs.f) out.push(`def c${n}, ${v.join(', ')}`);
  for (const i of sh.insts) {
    const d = i.dst ? ` ${rn(i.dst)}.${maskString(i.dst.mask)}${i.dst.mod & 1 ? '_sat' : ''}` : '';
    const s = i.srcs.map((p) => `${rn(p)}${p.rel ? '[rel]' : ''}.${swzString(p.swz)}${p.smod ? '/m' + p.smod : ''}`).join(', ');
    out.push(`${i.name}${d}${i.dst && i.srcs.length ? ',' : ''} ${s}`);
  }
  return out.join('\n');
}

const HELPERS = `
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
vec4 d3dLit(vec4 s) {
  float d = max(s.x, 0.0);
  float sp = (s.x > 0.0 && s.y > 0.0) ? pow(s.y, clamp(s.w, -127.9961, 127.9961)) : 0.0;
  return vec4(1.0, d, sp, 1.0);
}
`;

const MISC_UBO = `layout(std140) uniform Misc {
  vec4 uVp;          // 1/viewport width, 1/viewport height, y flip, alpha reference
  ivec4 uMode;       // BGRA attribute mask, sRGB read mask, sRGB write, alpha function (0 = off)
  ivec4 uMode2;      // clip plane mask
  vec4 uClip[6];
};`;

const outVar = (sh, o) => {
  const [type, num] = o.key.split(':').map(Number);
  if (type === 4) return num === 1 ? 'oFog' : 'oPts';
  if (type === 5) return `oD${num}`;
  return sh.major >= 3 ? `o${num}` : `oT${num}`;
};

// Builds linked GLSL sources for a vertex/pixel pair. Varyings are matched by semantic; pixel inputs the
// vertex shader does not write read as zero.
export function buildProgram(vsT, psT) {
  const positionOut = vsT.outputs.find((o) => o.name === 'POSITION0' && vsT.major >= 3);
  const posVar = positionOut ? outVar(vsT, positionOut) : 'oPos';
  const vsOutNames = new Map();
  for (const o of vsT.outputs) if (o.name !== 'POSITION0' || vsT.major < 3) vsOutNames.set(o.name, outVar(vsT, o));

  const psIns = psT.inputs.map((i) => ({ ...i, varName: i.key[0] === 'I' ? `vi_${i.key.slice(1)}` : `vt_${i.key.slice(1)}` }));
  const shared = psIns.filter((i) => vsOutNames.has(i.name));
  const sharedNames = [...new Set(shared.map((i) => i.name))];

  const vs = [];
  vs.push('#version 300 es', 'precision highp float;', 'precision highp int;');
  vs.push('layout(std140) uniform VSC { vec4 vc[256]; ivec4 vi[16]; ivec4 vb[16]; };', MISC_UBO);
  for (const i of vsT.inputs) vs.push(`layout(location = ${i.reg}) in vec4 av${i.reg};`);
  for (const n of sharedNames) vs.push(`out vec4 vv_${n};`);
  vs.push('out vec4 vClip;');
  vs.push('vec4 oPos, oFog, oPts;');
  for (const o of vsT.outputs) { const v = outVar(vsT, o); if (!/^o(Pos|Fog|Pts)$/.test(v)) vs.push(`vec4 ${v};`); }
  for (const s of vsT.samplers) vs.push(`uniform ${s.type === 'cube' ? 'samplerCube' : s.type === 'volume' ? 'sampler3D' : 'sampler2D'} s${s.reg};`);
  vs.push(...vsT.inputs.map((i) => `vec4 v${i.reg};`));
  vs.push(HELPERS, ...vsT.decl, ...vsT.body);
  vs.push('void main() {');
  vs.push('  oPos = vec4(0.0); oFog = vec4(0.0); oPts = vec4(1.0); aL = 0; a0 = ivec4(0); p0 = bvec4(false);');
  for (let k = 0; k <= vsT.maxTemp; k++) vs.push(`  r${k} = vec4(0.0);`);
  for (const o of vsT.outputs) { const v = outVar(vsT, o); if (!/^o(Pos|Fog|Pts)$/.test(v)) vs.push(`  ${v} = vec4(0.0);`); }
  for (const i of vsT.inputs) vs.push(`  v${i.reg} = ((uMode.x >> ${i.reg}) & 1) != 0 ? av${i.reg}.zyxw : av${i.reg};`);
  vs.push(...vsT.main.map((l) => '  ' + l));
  for (const n of sharedNames) vs.push(`  vv_${n} = ${vsOutNames.get(n)};`);
  vs.push(`  vClip = ${posVar};`);
  vs.push(`  vec4 p = ${posVar};`);
  vs.push('  gl_Position = vec4(p.x - p.w * uVp.x, (p.y + p.w * uVp.y) * uVp.z, 2.0 * p.z - p.w, p.w);');
  if (vsT.usesPsize || vsT.outputs.some((o) => o.name === 'PSIZE0')) vs.push('  gl_PointSize = max(oPts.x, 1.0);');
  vs.push('}');

  const ps = [];
  ps.push('#version 300 es', 'precision highp float;', 'precision highp int;', 'precision highp sampler2D;', 'precision highp samplerCube;', 'precision highp sampler3D;');
  ps.push('layout(std140) uniform PSC { vec4 pc[256]; ivec4 pi[16]; ivec4 pb[16]; };', MISC_UBO);
  for (const s of psT.samplers) ps.push(`uniform ${s.type === 'cube' ? 'samplerCube' : s.type === 'volume' ? 'sampler3D' : 'sampler2D'} s${s.reg};`);
  for (const n of sharedNames) ps.push(`in vec4 vv_${n};`);
  ps.push('in vec4 vClip;');
  const colorOuts = psT.colorOuts.length ? psT.colorOuts : [0];
  for (const n of colorOuts) ps.push(`layout(location = ${n}) out vec4 fo${n};`);
  ps.push(...colorOuts.map((n) => `vec4 oC${n};`), 'float oDepth;', 'vec4 vPos;', 'float vFace;');
  const seen = new Set();
  for (const i of psIns) if (!seen.has(i.varName)) { seen.add(i.varName); ps.push(`vec4 ${i.varName};`); }
  ps.push(HELPERS);
  ps.push('vec4 srgbRead(vec4 t, int s) { return ((uMode.y >> s) & 1) != 0 ? vec4(toLinear(t.rgb), t.a) : t; }');
  ps.push(...psT.decl, ...psT.body);
  ps.push('void main() {');
  ps.push('  aL = 0; p0 = bvec4(false); oDepth = 0.0;');
  ps.push('  for (int k = 0; k < 6; k++) if (((uMode2.x >> k) & 1) != 0 && dot(uClip[k], vClip) < 0.0) discard;');
  for (const n of colorOuts) ps.push(`  oC${n} = vec4(0.0);`);
  for (let k = 0; k <= psT.maxTemp; k++) ps.push(`  r${k} = vec4(0.0);`);
  for (const i of psIns) ps.push(`  ${i.varName} = ${vsOutNames.has(i.name) ? `vv_${i.name}` : 'vec4(0.0)'};`);
  ps.push('  vPos = vec4(gl_FragCoord.xy - 0.5, gl_FragCoord.z, 1.0 / gl_FragCoord.w);');
  ps.push('  vFace = gl_FrontFacing ? 1.0 : -1.0;');
  ps.push(...psT.main.map((l) => '  ' + l));
  ps.push('  if (uMode.w != 0) {');
  ps.push('    float a = oC0.a, ref = uVp.w; bool pass = true;');
  ps.push('    if (uMode.w == 1) pass = false; else if (uMode.w == 2) pass = a < ref; else if (uMode.w == 3) pass = a == ref; else if (uMode.w == 4) pass = a <= ref;');
  ps.push('    else if (uMode.w == 5) pass = a > ref; else if (uMode.w == 6) pass = a != ref; else if (uMode.w == 7) pass = a >= ref;');
  ps.push('    if (!pass) discard;');
  ps.push('  }');
  ps.push('  if (uMode.z != 0) oC0.rgb = toSrgb(clamp(oC0.rgb, 0.0, 1.0));');
  for (const n of colorOuts) ps.push(`  fo${n} = oC${n};`);
  if (psT.usesDepthOut) ps.push('  gl_FragDepth = oDepth;');
  ps.push('}');

  return { vs: vs.join('\n'), ps: ps.join('\n'), vsInputs: vsT.inputs, samplers: psT.samplers, vsSamplers: vsT.samplers };
}
