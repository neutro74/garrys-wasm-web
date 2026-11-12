// Incremental MD5, SHA-1, SHA-256, SHA-384 and SHA-512 in plain JS. CryptoAPI hashing is synchronous in the guest,
// and the browser's SubtleCrypto is async only.

const rotl = (x, n) => (x << n) | (x >>> (32 - n));
const rotr = (x, n) => (x >>> n) | (x << (32 - n));

class Block32 {
  constructor(blockSize, bigEndianLength, lengthBytes) { this.bs = blockSize; this.be = bigEndianLength; this.lb = lengthBytes; this.buf = new Uint8Array(blockSize); this.n = 0; this.len = 0; }
  update(data) {
    this.len += data.length;
    let i = 0;
    if (this.n) { const take = Math.min(this.bs - this.n, data.length); this.buf.set(data.subarray(0, take), this.n); this.n += take; i = take; if (this.n === this.bs) { this.block(this.buf, 0); this.n = 0; } }
    for (; i + this.bs <= data.length; i += this.bs) this.block(data, i);
    if (i < data.length) { this.buf.set(data.subarray(i), 0); this.n = data.length - i; }
    return this;
  }
  finish() {
    const bits = BigInt(this.len) * 8n, pad = new Uint8Array(this.bs * 2);
    pad[0] = 0x80;
    const total = ((this.len + 1 + this.lb + this.bs - 1) / this.bs | 0) * this.bs - this.len;
    const tail = new Uint8Array(total);
    tail[0] = 0x80;
    const dv = new DataView(tail.buffer);
    if (this.be) dv.setBigUint64(total - 8, bits, false); else dv.setBigUint64(total - 8, bits, true);
    const len = this.len; this.update(tail); this.len = len;
    return this.out();
  }
}

class MD5 extends Block32 {
  constructor() { super(64, false, 8); this.h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476]; }
  block(b, o) {
    const w = new Uint32Array(16); for (let i = 0; i < 16; i++) w[i] = b[o + 4 * i] | (b[o + 4 * i + 1] << 8) | (b[o + 4 * i + 2] << 16) | (b[o + 4 * i + 3] << 24);
    let [a, bb, c, d] = this.h;
    for (let i = 0; i < 64; i++) {
      let f, g;
      if (i < 16) { f = (bb & c) | (~bb & d); g = i; } else if (i < 32) { f = (d & bb) | (~d & c); g = (5 * i + 1) & 15; }
      else if (i < 48) { f = bb ^ c ^ d; g = (3 * i + 5) & 15; } else { f = c ^ (bb | ~d); g = (7 * i) & 15; }
      const t = d; d = c; c = bb; bb = (bb + rotl((a + f + MD5.K[i] + w[g]) | 0, MD5.S[i])) | 0; a = t;
    }
    this.h = [(this.h[0] + a) | 0, (this.h[1] + bb) | 0, (this.h[2] + c) | 0, (this.h[3] + d) | 0];
  }
  out() { const o = new Uint8Array(16), dv = new DataView(o.buffer); this.h.forEach((v, i) => dv.setUint32(4 * i, v >>> 0, true)); return o; }
}
MD5.S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
MD5.K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) | 0);

class SHA1 extends Block32 {
  constructor() { super(64, true, 8); this.h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0]; }
  block(b, o) {
    const w = new Uint32Array(80);
    for (let i = 0; i < 16; i++) w[i] = (b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3];
    for (let i = 16; i < 80; i++) w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    let [a, bb, c, d, e] = this.h;
    for (let i = 0; i < 80; i++) {
      const [f, k] = i < 20 ? [(bb & c) | (~bb & d), 0x5a827999] : i < 40 ? [bb ^ c ^ d, 0x6ed9eba1] : i < 60 ? [(bb & c) | (bb & d) | (c & d), 0x8f1bbcdc] : [bb ^ c ^ d, 0xca62c1d6];
      const t = (rotl(a, 5) + f + e + k + w[i]) | 0; e = d; d = c; c = rotl(bb, 30); bb = a; a = t;
    }
    this.h = [(this.h[0] + a) | 0, (this.h[1] + bb) | 0, (this.h[2] + c) | 0, (this.h[3] + d) | 0, (this.h[4] + e) | 0];
  }
  out() { const o = new Uint8Array(20), dv = new DataView(o.buffer); this.h.forEach((v, i) => dv.setUint32(4 * i, v >>> 0, false)); return o; }
}

const K256 = Uint32Array.from('428a2f98 71374491 b5c0fbcf e9b5dba5 3956c25b 59f111f1 923f82a4 ab1c5ed5 d807aa98 12835b01 243185be 550c7dc3 72be5d74 80deb1fe 9bdc06a7 c19bf174 e49b69c1 efbe4786 0fc19dc6 240ca1cc 2de92c6f 4a7484aa 5cb0a9dc 76f988da 983e5152 a831c66d b00327c8 bf597fc7 c6e00bf3 d5a79147 06ca6351 14292967 27b70a85 2e1b2138 4d2c6dfc 53380d13 650a7354 766a0abb 81c2c92e 92722c85 a2bfe8a1 a81a664b c24b8b70 c76c51a3 d192e819 d6990624 f40e3585 106aa070 19a4c116 1e376c08 2748774c 34b0bcb5 391c0cb3 4ed8aa4a 5b9cca4f 682e6ff3 748f82ee 78a5636f 84c87814 8cc70208 90befffa a4506ceb bef9a3f7 c67178f2'.split(' ').map((x) => parseInt(x, 16)));
class SHA256 extends Block32 {
  constructor() { super(64, true, 8); this.h = Uint32Array.from([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]); }
  block(b, o) {
    const w = new Uint32Array(64);
    for (let i = 0; i < 16; i++) w[i] = (b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, bb, c, d, e, f, g, h] = this.h;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
    }
    const v = [a, bb, c, d, e, f, g, h]; for (let i = 0; i < 8; i++) this.h[i] = (this.h[i] + v[i]) | 0;
  }
  out() { const o = new Uint8Array(32), dv = new DataView(o.buffer); this.h.forEach((v, i) => dv.setUint32(4 * i, v, false)); return o; }
}

const K512 = '428a2f98d728ae22 7137449123ef65cd b5c0fbcfec4d3b2f e9b5dba58189dbbc 3956c25bf348b538 59f111f1b605d019 923f82a4af194f9b ab1c5ed5da6d8118 d807aa98a3030242 12835b0145706fbe 243185be4ee4b28c 550c7dc3d5ffb4e2 72be5d74f27b896f 80deb1fe3b1696b1 9bdc06a725c71235 c19bf174cf692694 e49b69c19ef14ad2 efbe4786384f25e3 0fc19dc68b8cd5b5 240ca1cc77ac9c65 2de92c6f592b0275 4a7484aa6ea6e483 5cb0a9dcbd41fbd4 76f988da831153b5 983e5152ee66dfab a831c66d2db43210 b00327c898fb213f bf597fc7beef0ee4 c6e00bf33da88fc2 d5a79147930aa725 06ca6351e003826f 142929670a0e6e70 27b70a8546d22ffc 2e1b21385c26c926 4d2c6dfc5ac42aed 53380d139d95b3df 650a73548baf63de 766a0abb3c77b2a8 81c2c92e47edaee6 92722c851482353b a2bfe8a14cf10364 a81a664bbc423001 c24b8b70d0f89791 c76c51a30654be30 d192e819d6ef5218 d69906245565a910 f40e35855771202a 106aa07032bbd1b8 19a4c116b8d2d0c8 1e376c085141ab53 2748774cdf8eeb99 34b0bcb5e19b48a8 391c0cb3c5c95a63 4ed8aa4ae3418acb 5b9cca4f7763e373 682e6ff3d6b2b8a3 748f82ee5defb2fc 78a5636f43172f60 84c87814a1f0ab72 8cc702081a6439ec 90befffa23631e28 a4506cebde82bde9 bef9a3f7b2c67915 c67178f2e372532b ca273eceea26619c d186b8c721c0c207 eada7dd6cde0eb1e f57d4f7fee6ed178 06f067aa72176fba 0a637dc5a2c898a6 113f9804bef90dae 1b710b35131c471b 28db77f523047d84 32caab7b40c72493 3c9ebe0a15c9bebc 431d67c49c100d4c 4cc5d4becb3e42b6 597f299cfc657e2a 5fcb6fab3ad6faec 6c44198c4a475817'.split(' ').map((x) => BigInt('0x' + x));
const M64 = (1n << 64n) - 1n, r64 = (x, n) => ((x >> BigInt(n)) | (x << BigInt(64 - n))) & M64;
class SHA512 extends Block32 {
  constructor(init, outBytes) { super(128, true, 16); this.h = init.map((x) => BigInt('0x' + x)); this.outBytes = outBytes; }
  block(b, o) {
    const w = new Array(80);
    for (let i = 0; i < 16; i++) { let v = 0n; for (let k = 0; k < 8; k++) v = (v << 8n) | BigInt(b[o + 8 * i + k]); w[i] = v; }
    for (let i = 16; i < 80; i++) {
      const s0 = r64(w[i - 15], 1) ^ r64(w[i - 15], 8) ^ (w[i - 15] >> 7n), s1 = r64(w[i - 2], 19) ^ r64(w[i - 2], 61) ^ (w[i - 2] >> 6n);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) & M64;
    }
    let [a, bb, c, d, e, f, g, h] = this.h;
    for (let i = 0; i < 80; i++) {
      const t1 = (h + (r64(e, 14) ^ r64(e, 18) ^ r64(e, 41)) + ((e & f) ^ (~e & M64 & g)) + K512[i] + w[i]) & M64;
      const t2 = ((r64(a, 28) ^ r64(a, 34) ^ r64(a, 39)) + ((a & bb) ^ (a & c) ^ (bb & c))) & M64;
      h = g; g = f; f = e; e = (d + t1) & M64; d = c; c = bb; bb = a; a = (t1 + t2) & M64;
    }
    const v = [a, bb, c, d, e, f, g, h]; for (let i = 0; i < 8; i++) this.h[i] = (this.h[i] + v[i]) & M64;
  }
  out() { const o = new Uint8Array(64), dv = new DataView(o.buffer); this.h.forEach((v, i) => dv.setBigUint64(8 * i, v, false)); return o.subarray(0, this.outBytes); }
}
const SHA512_INIT = '6a09e667f3bcc908 bb67ae8584caa73b 3c6ef372fe94f82b a54ff53a5f1d36f1 510e527fade682d1 9b05688c2b3e6c1f 1f83d9abfb41bd6b 5be0cd19137e2179'.split(' ');
const SHA384_INIT = 'cbbb9d5dc1059ed8 629a292a367cd507 9159015a3070dd17 152fecd8f70e5939 67332667ffc00b31 8eb44a8768581511 db0c2e0d64f98fa7 47b5481dbefa4fa4'.split(' ');

export function createHash(name) {
  const h = { md5: () => new MD5(), sha1: () => new SHA1(), sha256: () => new SHA256(), sha384: () => new SHA512(SHA384_INIT, 48), sha512: () => new SHA512(SHA512_INIT, 64) }[name]?.();
  if (!h) throw new Error(`unsupported hash ${name}`);
  return { update(data) { h.update(data); return this; }, digest() { return h.finish(); } };
}
