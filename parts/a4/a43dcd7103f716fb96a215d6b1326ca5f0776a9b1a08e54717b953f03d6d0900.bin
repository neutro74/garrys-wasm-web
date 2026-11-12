// Hand assembler for D3D9 shader tokens, used by tests.
export const R = { TEMP: 0, INPUT: 1, CONST: 2, ADDR: 3, RASTOUT: 4, ATTROUT: 5, TEXCRDOUT: 6, CONSTINT: 7, COLOROUT: 8, DEPTHOUT: 9, SAMPLER: 10 };

export const param = (type, num, { mask = null, swz = 0xe4, smod = 0, dmod = 0, shift = 0, rel = false } = {}) => {
  let t = 0x80000000 | ((type & 7) << 28) | (((type >> 3) & 3) << 11) | num | (rel ? 1 << 13 : 0);
  if (mask !== null) t |= (mask << 16) | (dmod << 20) | ((shift & 15) << 24);
  else t |= (swz << 16) | (smod << 24);
  return t >>> 0;
};
export const inst = (op, ...tokens) => [(op | (tokens.length << 24)) >>> 0, ...tokens];
export const dst = (type, num, mask = 15, o = {}) => param(type, num, { mask, ...o });
export const src = (type, num, swz = 0xe4, smod = 0, o = {}) => param(type, num, { swz, smod, ...o });
export const dcl = (usage, index, type, num, mask = 15) => inst(31, ((usage | (index << 16)) | 0x80000000) >>> 0, dst(type, num, mask));
export const dclSampler = (num, texType) => inst(31, ((texType << 27) | 0x80000000) >>> 0, dst(R.SAMPLER, num, 0));
export const ver = (stage, major, minor) => (((stage === 'vs' ? 0xfffe : 0xffff) << 16) | (major << 8) | minor) >>> 0;
export const asm = (...parts) => Uint32Array.from([...parts.flat(), 0xffff]);
export const swz = (x, y, z, w) => x | (y << 2) | (z << 4) | (w << 6);
