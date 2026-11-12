// d3dx9_40.dll math used by shaderapidx9 / materialsystem, implemented for real
// (D3DMATRIX is row-major with the row-vector convention: v' = v * M).
// D3DXCompileShader is the one deliberate non-implementation: shipping shaders
// are precompiled bytecode, and an HLSL compiler is not part of the retail path.

const D3DERR_INVALIDCALL = 0x8876086c;
const f32buf = new DataView(new ArrayBuffer(4));
const toF = (u) => { f32buf.setUint32(0, u >>> 0, true); return f32buf.getFloat32(0, true); };

const readM = (g, p) => Array.from({ length: 16 }, (_, i) => g.dv.getFloat32(p + 4 * i, true));
const writeM = (g, p, m) => { for (let i = 0; i < 16; i++) g.dv.setFloat32(p + 4 * i, m[i], true); };
const IDENT = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const mul = (a, b) => {
  const r = new Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++)
    r[4 * i + j] = a[4 * i] * b[j] + a[4 * i + 1] * b[4 + j] + a[4 * i + 2] * b[8 + j] + a[4 * i + 3] * b[12 + j];
  return r;
};
export function invert(m) {
  // Cofactor expansion in f64 (matches D3DX up to float rounding).
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (det === 0) return null;
  const d = 1 / det;
  return {
    det,
    m: [
      (a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d, (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
      (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d, (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
      (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d, (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
      (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d, (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d,
    ],
  };
}
const vecM = (v, m) => [0, 1, 2, 3].map((j) => v[0] * m[j] + v[1] * m[4 + j] + v[2] * m[8 + j] + v[3] * m[12 + j]);

function rotAxis(axis, angle) {
  let [x, y, z] = axis; const n = Math.hypot(x, y, z); if (n) { x /= n; y /= n; z /= n; }
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  return [
    t * x * x + c, t * x * y + s * z, t * x * z - s * y, 0,
    t * x * y - s * z, t * y * y + c, t * y * z + s * x, 0,
    t * x * z + s * y, t * y * z - s * x, t * z * z + c, 0,
    0, 0, 0, 1,
  ];
}
function yawPitchRoll(yaw, pitch, roll) {
  // D3DX: roll about Z, then pitch about X, then yaw about Y.
  const rz = rotAxis([0, 0, 1], roll), rx = rotAxis([1, 0, 0], pitch), ry = rotAxis([0, 1, 0], yaw);
  return mul(mul(rz, rx), ry);
}

export function installD3DX9(SHIMS) {
  const def = (name, arity, fn) => { SHIMS[`d3dx9_40.dll!${name}`] = { arity, pop: 4 * arity, fn }; };

  // Called for most draws by the shader API: same arithmetic as mul(), without the per-call arrays.
  const MA = new Float64Array(16), MB = new Float64Array(16);
  def('D3DXMatrixMultiply', 3, function (out, a, b) {
    const dv = this.g.dv;
    for (let i = 0; i < 16; i++) { MA[i] = dv.getFloat32(a + 4 * i, true); MB[i] = dv.getFloat32(b + 4 * i, true); }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++)
      dv.setFloat32(out + 16 * i + 4 * j, MA[4 * i] * MB[j] + MA[4 * i + 1] * MB[4 + j] + MA[4 * i + 2] * MB[8 + j] + MA[4 * i + 3] * MB[12 + j], true);
    return out;
  });
  const transposeBits=new Uint32Array(16);
  def('D3DXMatrixTranspose', 2, function (out, m) {
    const dv=this.g.dv;
    // A transpose is a bitwise permutation. Snapshot before any write so
    // in-place, partially overlapping and unaligned matrices remain valid.
    for(let i=0;i<16;i++)transposeBits[i]=dv.getUint32(m+4*i,true);
    for(let r=0;r<4;r++)for(let c=0;c<4;c++)dv.setUint32(out+16*r+4*c,transposeBits[4*c+r],true);
    return out;
  });
  def('D3DXMatrixInverse', 3, function (out, pDet, m) {
    const r = invert(readM(this.g, m));
    if (pDet) this.g.dv.setFloat32(pDet, r ? r.det : 0, true);
    if (!r) return 0;
    writeM(this.g, out, r.m); return out;
  });
  def('D3DXMatrixTranslation', 4, function (out, x, y, z) { const m = IDENT(); m[12] = toF(x); m[13] = toF(y); m[14] = toF(z); writeM(this.g, out, m); return out; });
  def('D3DXMatrixPerspectiveRH', 5, function (out, w, h, zn, zf) {
    w = toF(w); h = toF(h); zn = toF(zn); zf = toF(zf);
    writeM(this.g, out, [2 * zn / w, 0, 0, 0, 0, 2 * zn / h, 0, 0, 0, 0, zf / (zn - zf), -1, 0, 0, zn * zf / (zn - zf), 0]); return out;
  });
  def('D3DXMatrixPerspectiveOffCenterRH', 7, function (out, l, r, b, t, zn, zf) {
    l = toF(l); r = toF(r); b = toF(b); t = toF(t); zn = toF(zn); zf = toF(zf);
    writeM(this.g, out, [2 * zn / (r - l), 0, 0, 0, 0, 2 * zn / (t - b), 0, 0, (l + r) / (r - l), (t + b) / (t - b), zf / (zn - zf), -1, 0, 0, zn * zf / (zn - zf), 0]); return out;
  });
  def('D3DXMatrixOrthoOffCenterRH', 7, function (out, l, r, b, t, zn, zf) {
    l = toF(l); r = toF(r); b = toF(b); t = toF(t); zn = toF(zn); zf = toF(zf);
    writeM(this.g, out, [2 / (r - l), 0, 0, 0, 0, 2 / (t - b), 0, 0, 0, 0, 1 / (zn - zf), 0, (l + r) / (l - r), (t + b) / (b - t), zn / (zn - zf), 1]); return out;
  });
  def('D3DXPlaneNormalize', 2, function (out, p) {
    const g = this.g, v = [0, 1, 2, 3].map((i) => g.dv.getFloat32(p + 4 * i, true));
    const n = Math.hypot(v[0], v[1], v[2]);
    for (let i = 0; i < 4; i++) g.dv.setFloat32(out + 4 * i, n ? v[i] / n : 0, true);
    return out;
  });
  def('D3DXPlaneTransform', 3, function (out, p, m) {
    const g = this.g, v = [0, 1, 2, 3].map((i) => g.dv.getFloat32(p + 4 * i, true)), r = vecM(v, readM(g, m));
    for (let i = 0; i < 4; i++) g.dv.setFloat32(out + 4 * i, r[i], true);
    return out;
  });
  def('D3DXVec3TransformCoord', 3, function (out, v, m) {
    const g = this.g, r = vecM([0, 1, 2].map((i) => g.dv.getFloat32(v + 4 * i, true)).concat(1), readM(g, m));
    const w = r[3] || 1;   // D3DX divides by w
    for (let i = 0; i < 3; i++) g.dv.setFloat32(out + 4 * i, r[i] / w, true);
    return out;
  });
  def('D3DXVec4Transform', 3, function (out, v, m) {
    const g = this.g, r = vecM([0, 1, 2, 3].map((i) => g.dv.getFloat32(v + 4 * i, true)), readM(g, m));
    for (let i = 0; i < 4; i++) g.dv.setFloat32(out + 4 * i, r[i], true);
    return out;
  });
  def('D3DXVec4Normalize', 2, function (out, v) {
    const g = this.g, a = [0, 1, 2, 3].map((i) => g.dv.getFloat32(v + 4 * i, true)), n = Math.hypot(...a);
    for (let i = 0; i < 4; i++) g.dv.setFloat32(out + 4 * i, n ? a[i] / n : 0, true);
    return out;
  });
  // First token of a compiled shader is its version (e.g. 0xFFFF0300 = ps_3_0).
  def('D3DXGetShaderVersion', 1, function (fn) { return fn ? this.g.u32(fn) : 0; });
  def('D3DXCompileShader', 10, function () { return D3DERR_INVALIDCALL; });

  // ID3DXMatrixStack: IUnknown(0-2) Pop Push LoadIdentity LoadMatrix MultMatrix MultMatrixLocal
  // RotateAxis RotateAxisLocal RotateYawPitchRoll RotateYawPitchRollLocal Scale ScaleLocal
  // Translate TranslateLocal GetTop.
  def('D3DXCreateMatrixStack', 2, function (_flags, pp) {
    const g = this.g, dll = this.dll;
    // Native D3DX exposes a pointer to the mutable top matrix. Keep matrices in
    // guest memory and retain capacity, rather than copying 16 floats on every GetTop.
    const buffers=[g.alloc(64)];let depth=0;writeM(g,buffers[0],IDENT());
    const top=()=>readM(g,buffers[depth]);
    const set=m=>{writeM(g,buffers[depth],m);return 0;};
    const obj = g.alloc(8), vt = g.alloc(4 * 20);
    g.u32(obj, vt); g.u32(obj + 4, 1);
    const scale = (x, y, z) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
    const trans = (x, y, z) => { const m = IDENT(); m[12] = x; m[13] = y; m[14] = z; return m; };
    const vec3 = (p) => [0, 1, 2].map((i) => g.dv.getFloat32(p + 4 * i, true));
    const methods = [
      [2, 'QueryInterface', (_s, _iid, out) => { g.u32(out, obj); g.u32(obj + 4, g.u32(obj + 4) + 1); return 0; }],
      [0, 'AddRef', () => { const r = g.u32(obj + 4) + 1; g.u32(obj + 4, r); return r; }],
      [0, 'Release', () => { const r = g.u32(obj + 4) - 1; g.u32(obj + 4, r);if(!r){for(const p of buffers)g.free(p);g.free(vt);g.free(obj);} return r; }],
      [0, 'Pop', () => { if(depth>0)depth--;return 0; }],
      [0, 'Push', () => { const previous=buffers[depth++];buffers[depth]??=g.alloc(64);g.u8.copyWithin(buffers[depth],previous,previous+64);return 0; }],
      [0, 'LoadIdentity', () => set(IDENT())],
      [1, 'LoadMatrix', (_s, m) => set(readM(g, m))],
      [1, 'MultMatrix', (_s, m) => set(mul(top(), readM(g, m)))],
      [1, 'MultMatrixLocal', (_s, m) => set(mul(readM(g, m), top()))],
      [2, 'RotateAxis', (_s, ax, ang) => set(mul(top(), rotAxis(vec3(ax), toF(ang))))],
      [2, 'RotateAxisLocal', (_s, ax, ang) => set(mul(rotAxis(vec3(ax), toF(ang)), top()))],
      [3, 'RotateYawPitchRoll', (_s, y, p, r) => set(mul(top(), yawPitchRoll(toF(y), toF(p), toF(r))))],
      [3, 'RotateYawPitchRollLocal', (_s, y, p, r) => set(mul(yawPitchRoll(toF(y), toF(p), toF(r)), top()))],
      [3, 'Scale', (_s, x, y, z) => set(mul(top(), scale(toF(x), toF(y), toF(z))))],
      [3, 'ScaleLocal', (_s, x, y, z) => set(mul(scale(toF(x), toF(y), toF(z)), top()))],
      [3, 'Translate', (_s, x, y, z) => set(mul(top(), trans(toF(x), toF(y), toF(z))))],
      [3, 'TranslateLocal', (_s, x, y, z) => set(mul(trans(toF(x), toF(y), toF(z)), top()))],
      [0, 'GetTop', () => buffers[depth]],
    ];
    methods.forEach(([nargs, name, fn], i) => {
      g.u32(vt + 4 * i, g.extraThunk(dll, `d3dx#MatrixStack:${name}`, function (self,a0,a1,a2) { return fn(self,a0,a1,a2); }, (nargs + 1) * 4, false, nargs+1, true));
    });
    g.u32(pp, obj);
    return 0;
  });
}
