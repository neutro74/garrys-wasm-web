// Win32 behaviour the retail DLLs use beyond the core shims: locale string APIs, FormatMessage,
// version checks, file locking, hashing/random (CryptoAPI), and the pieces that cannot exist
// without a network or audio device (those fail the way Windows does when the resource is absent
// and are listed in FAKES).
import { createHash } from './hash.mjs';
import { FAKES } from './win32-more.mjs';

const ERROR_NOT_SUPPORTED = 50, ERROR_INVALID_PARAMETER = 87, ERROR_MR_MID_NOT_FOUND = 317;

export function installExtra(SHIMS, { createEvent, wstr }) {
  const def = (dll, name, arity, fn, fake) => {
    SHIMS[`${dll}.dll!${name}`] = { arity, pop: 4 * arity, fn };
    if (fake) FAKES.push(`${dll}.dll!${name}: ${fake}`);
  };
  const failWith = (code) => function () { this.g.lastError = code; return 0; };
  const stringAt = (g, p, count) => {            // UTF-16 string; count -1 means NUL-terminated
    let s = '';
    for (let i = 0; count < 0 ? true : i < count; i++) {
      const c = g.dv.getUint16(p + 2 * i, true);
      if (count < 0 && !c) break;
      s += String.fromCharCode(c);
    }
    return s;
  };
  const putWide = (g, buf, s, cap) => {          // copy including NUL; returns chars written (no NUL)
    const n = Math.min(s.length, cap - 1);
    for (let i = 0; i < n; i++) g.dv.setUint16(buf + 2 * i, s.charCodeAt(i), true);
    g.dv.setUint16(buf + 2 * n, 0, true);
    return n;
  };
  const putAnsi = (g, buf, s, cap) => {
    const n = Math.min(s.length, cap - 1);
    for (let i = 0; i < n; i++) g.u8[buf + i] = s.charCodeAt(i) & 0xff;
    g.u8[buf + n] = 0;
    return n;
  };

  // locale / string
  const NORM_IGNORECASE = 1, LINGUISTIC_IGNORECASE = 0x10;
  const compareStrings = (flags, a, b) => {
    const collator = new Intl.Collator('en-US', { sensitivity: flags & (NORM_IGNORECASE | LINGUISTIC_IGNORECASE) ? 'accent' : 'variant', usage: 'sort' });
    const r = collator.compare(a, b);
    return r < 0 ? 1 : r > 0 ? 3 : 2;            // CSTR_LESS_THAN / GREATER_THAN / EQUAL
  };
  const compare = function (flags, p1, c1, p2, c2) {
    if (!p1 || !p2) { this.g.lastError = ERROR_INVALID_PARAMETER; return 0; }
    return compareStrings(flags, stringAt(this.g, p1, c1 | 0), stringAt(this.g, p2, c2 | 0));
  };
  def('kernel32', 'CompareStringW', 6, function (_lcid, flags, p1, c1, p2, c2) { return compare.call(this, flags, p1, c1, p2, c2); });
  def('kernel32', 'CompareStringEx', 9, function (_name, flags, p1, c1, p2, c2) { return compare.call(this, flags, p1, c1, p2, c2); });

  const LCMAP_LOWERCASE = 0x100, LCMAP_UPPERCASE = 0x200, LCMAP_SORTKEY = 0x400;
  const lcmap = function (flags, src, cch, dst, cchDst) {
    const g = this.g;
    if (!src || cchDst < 0 || (flags & LCMAP_SORTKEY)) { g.lastError = ERROR_INVALID_PARAMETER; return 0; }
    let s = stringAt(g, src, cch | 0);
    if ((cch | 0) < 0) s += '\0';
    if (flags & LCMAP_LOWERCASE) s = s.toLowerCase(); else if (flags & LCMAP_UPPERCASE) s = s.toUpperCase();
    if (!cchDst) return s.length;
    if (cchDst < s.length) { g.lastError = 122; return 0; }       // ERROR_INSUFFICIENT_BUFFER
    for (let i = 0; i < s.length; i++) g.dv.setUint16(dst + 2 * i, s.charCodeAt(i), true);
    return s.length;
  };
  def('kernel32', 'LCMapStringW', 6, function (_lcid, flags, src, cch, dst, cchDst) { return lcmap.call(this, flags, src, cch, dst, cchDst); });
  def('kernel32', 'LCMapStringEx', 9, function (_name, flags, src, cch, dst, cchDst) { return lcmap.call(this, flags, src, cch, dst, cchDst); });

  // CT_CTYPE1 classification (C1_UPPER 1, LOWER 2, DIGIT 4, SPACE 8, PUNCT 0x10, CNTRL 0x20, BLANK 0x40, XDIGIT 0x80, ALPHA 0x100)
  const ctype1 = (ch) => {
    let t = 0;
    if (/\p{Lu}/u.test(ch)) t |= 1 | 0x100;
    if (/\p{Ll}/u.test(ch)) t |= 2 | 0x100;
    if (/\p{Lo}|\p{Lt}|\p{Lm}/u.test(ch)) t |= 0x100;
    if (/\p{Nd}/u.test(ch)) t |= 4;
    if (/\s/u.test(ch)) t |= 8;
    if (/[\p{P}\p{S}]/u.test(ch)) t |= 0x10;
    if (/\p{Cc}/u.test(ch)) t |= 0x20;
    if (ch === ' ' || ch === '\t') t |= 0x40;
    if (/[0-9a-fA-F]/.test(ch)) t |= 0x80;
    return t;
  };
  def('kernel32', 'GetStringTypeW', 5, function (type, src, cch, out) {
    const g = this.g;
    if (!src || !out || (type !== 1 && type !== 2 && type !== 4)) { g.lastError = ERROR_INVALID_PARAMETER; return 0; }
    const n = (cch | 0) < 0 ? stringAt(g, src, -1).length + 1 : cch;
    for (let i = 0; i < n; i++) {
      const ch = String.fromCharCode(g.dv.getUint16(src + 2 * i, true));
      g.dv.setUint16(out + 2 * i, type === 1 ? ctype1(ch) : 0, true);   // CT_CTYPE2/3 (layout, C3) are not tabulated: 0
    }
    return 1;
  }, 'CT_CTYPE2/CT_CTYPE3 report 0');

  def('kernel32', 'GetLocaleInfoEx', 4, function (_name, _type, buf, n) {
    const v = 'en-US'; if (!buf || n < v.length + 1) return v.length + 1;
    return putWide(this.g, buf, v, n) + 1;
  }, 'reports en-US for every LCTYPE');
  def('kernel32', 'EnumSystemLocalesA', 2, () => 1, 'reports no locales');
  def('kernel32', 'AreFileApisANSI', 0, () => 1);

  // FormatMessage: system messages for the common error codes; unknown ids fail like Windows (ERROR_MR_MID_NOT_FOUND).
  const SYSTEM_MESSAGES = {
    0: 'The operation completed successfully.', 1: 'Incorrect function.', 2: 'The system cannot find the file specified.',
    3: 'The system cannot find the path specified.', 5: 'Access is denied.', 6: 'The handle is invalid.',
    8: 'Not enough memory resources are available to process this command.', 18: 'There are no more files.',
    32: 'The process cannot access the file because it is being used by another process.',
    50: 'The request is not supported.', 80: 'The file exists.', 87: 'The parameter is incorrect.',
    122: 'The data area passed to a system call is too small.', 126: 'The specified module could not be found.',
    127: 'The specified procedure could not be found.', 183: 'Cannot create a file when that file already exists.',
    1168: 'Element not found.', 10035: 'A non-blocking socket operation could not be completed immediately.',
    10038: 'An operation was attempted on something that is not a socket.', 10048: 'Only one usage of each socket address (protocol/network address/port) is normally permitted.',
    10051: 'A socket operation was attempted to an unreachable network.', 10054: 'An existing connection was forcibly closed by the remote host.',
    10061: 'No connection could be made because the target machine actively refused it.',
  };
  const formatMessage = function (wide, flags, source, id, _lang, buf, size, args) {
    const g = this.g;
    let text;
    if (flags & 0x400) text = wide ? stringAt(g, source, -1) : g.readStr(source);       // FORMAT_MESSAGE_FROM_STRING
    else if (flags & 0x1000) {                                                          // FORMAT_MESSAGE_FROM_SYSTEM
      const m = SYSTEM_MESSAGES[id & 0xffff];
      if (m === undefined) { g.lastError = ERROR_MR_MID_NOT_FOUND; return 0; }
      text = m + '\r\n';
    } else { g.lastError = ERROR_MR_MID_NOT_FOUND; return 0; }
    if (!(flags & 0x200) && args) {                                                     // not IGNORE_INSERTS: %1..%9
      text = text.replace(/%([1-9])(?:!s!)?/g, (_m, i) => {
        const argp = (flags & 0x2000) ? g.u32(args + 4 * (i - 1)) : g.u32(args + 4 * (i - 1));
        return argp ? (wide ? stringAt(g, argp, -1) : g.readStr(argp)) : '';
      });
    }
    text = text.replace(/%%/g, '%').replace(/%n/g, '\r\n');
    const unit = wide ? 2 : 1;
    if (flags & 0x100) {                                                                // ALLOCATE_BUFFER: buf is a pointer to the result
      const p = g.alloc((text.length + 1) * unit);
      (wide ? putWide : putAnsi)(g, p, text, text.length + 1);
      g.u32(buf, p);
      return text.length;
    }
    if (size < text.length + 1) { g.lastError = 122; return 0; }
    return (wide ? putWide : putAnsi)(g, buf, text, size);
  };
  def('kernel32', 'FormatMessageA', 7, function (f, s, id, l, b, n, a) { return formatMessage.call(this, false, f, s, id, l, b, n, a); });
  def('kernel32', 'FormatMessageW', 7, function (f, s, id, l, b, n, a) { return formatMessage.call(this, true, f, s, id, l, b, n, a); });

  // version checks (the host reports Windows 10.0.19045, workstation)
  const HOST_VERSION = { major: 10, minor: 0, build: 19045, platform: 2, spMajor: 0, spMinor: 0, suite: 0, product: 1 };
  const VER_BITS = { 1: 0, 2: 1, 4: 2, 8: 3, 0x10: 4, 0x20: 5, 0x40: 6, 0x80: 7 };
  def('kernel32', 'VerSetConditionMask', 4, function (lo, hi, typeMask, cond) {
    let mask = BigInt(lo >>> 0) | (BigInt(hi >>> 0) << 32n);
    for (const [bit, idx] of Object.entries(VER_BITS))
      if (typeMask & bit) mask |= BigInt(cond & 7) << BigInt(3 * idx);
    return mask;
  });
  const cmp = (c, have, want) => c === 1 ? have === want : c === 2 ? have > want : c === 3 ? have >= want
    : c === 4 ? have < want : c === 5 ? have <= want : false;
  def('kernel32', 'VerifyVersionInfoW', 4, function (info, typeMask, lo, hi) {
    const g = this.g;
    const mask = BigInt(lo >>> 0) | (BigInt(hi >>> 0) << 32n);
    const condOf = (bit) => Number((mask >> BigInt(3 * VER_BITS[bit])) & 7n);
    if (!info || g.u32(info) < 276 || !typeMask) { g.lastError = ERROR_INVALID_PARAMETER; return 0; }
    const want = {
      major: g.u32(info + 4), minor: g.u32(info + 8), build: g.u32(info + 12), platform: g.u32(info + 16),
      spMajor: g.dv.getUint16(info + 276, true), spMinor: g.dv.getUint16(info + 278, true),
      suite: g.dv.getUint16(info + 280, true), product: g.u8[info + 282],
    };
    let ok = true;
    for (const [bit, key] of [[4, 'build'], [8, 'platform'], [0x80, 'product']])
      if (typeMask & bit && !cmp(condOf(bit), HOST_VERSION[key], want[key])) ok = false;
    if (typeMask & 0x40) {
      const have = HOST_VERSION.suite, c = condOf(0x40);
      if (!(c === 6 ? (have & want.suite) === want.suite : (have & want.suite) !== 0)) ok = false;
    }
    // Major, minor, service-pack major and minor are compared hierarchically: the most significant field
    // that differs decides the ordering conditions; EQUAL requires every tested field to match.
    const chain = [[2, 'major'], [1, 'minor'], [0x20, 'spMajor'], [0x10, 'spMinor']].filter(([bit]) => typeMask & bit);
    let decided = false, lastCond = 1;
    for (const [bit, key] of chain) {
      const c = condOf(bit), have = HOST_VERSION[key], w = want[key];
      lastCond = c;
      if (c === 1) { if (have !== w) { ok = false; decided = true; break; } continue; }
      if (have === w) continue;
      if (!cmp(c, have, w)) ok = false;
      decided = true; break;
    }
    if (chain.length && !decided && ![1, 3, 5].includes(lastCond)) ok = false;   // all equal: only the inclusive conditions hold
    if (!ok) g.lastError = 1150;                              // ERROR_OLD_WIN_VERSION
    return ok ? 1 : 0;
  });

  // files
  def('kernel32', 'FindFirstFileExA', 6, function (pattern, _level, out) {
    if (!this.g.files) throw new Error('FindFirstFileExA requires a configured file volume');
    return this.g.files.findFirst(this.g.readStr(pattern), out, false);
  });
  const ensureDir = (g, dir) => { if (!g.files.resolve(dir)) g.files.createDirectory(dir); };
  def('kernel32', 'GetTempPathA', 2, function (n, buf) {
    const dir = 'c:\\gamebox\\temp', path = dir + '\\';
    if (this.g.files) ensureDir(this.g, dir);
    if (n < path.length + 1) return path.length + 1;
    return putAnsi(this.g, buf, path, n);
  });
  def('kernel32', 'GetSystemDirectoryA', 2, function (buf, n) {
    const s = 'C:\\Windows\\System32';
    if (n < s.length + 1) return s.length + 1;
    return putAnsi(this.g, buf, s, n);
  });
  def('kernel32', 'GetDiskFreeSpaceW', 5, function (_root, spc, bps, free, total) {
    const g = this.g; g.u32(spc, 8); g.u32(bps, 512); g.u32(free, 1 << 24); g.u32(total, 1 << 25); return 1;
  }, 'reports 128 GiB free');
  // Only this process touches the volume, so byte-range locks are always granted.
  for (const [n, a] of [['LockFile', 5], ['UnlockFile', 5], ['LockFileEx', 6], ['UnlockFileEx', 5]])
    def('kernel32', n, a, () => 1, 'single-process volume: byte-range locks are always granted');
  def('kernel32', 'CreateFileMappingW', 6, failWith(5), 'no file mappings');
  def('kernel32', 'FlushViewOfFile', 2, () => 1);
  def('kernel32', 'HeapCompact', 2, () => 0x10000);
  def('kernel32', 'ReadDirectoryChangesW', 8, failWith(ERROR_NOT_SUPPORTED), 'no directory change notifications');
  def('kernel32', 'CreateMutexW', 3, function (_sec, owned, name) { return createEvent(this.g, false, !owned, name ? wstr(this.g, name) : ''); });

  // network (no transport in this host)
  const bswap32 = (v) => (((v & 0xff) << 24) | ((v & 0xff00) << 8) | ((v >>> 8) & 0xff00) | (v >>> 24)) | 0;
  def('ws2_32', 'htonl', 1, bswap32);
  def('wsock32', 'htonl', 1, bswap32);
  def('ws2_32', 'WSAIoctl', 9, function () { this.g.lastError = 10050; return -1; }, 'no network transport (WSAENETDOWN)');
  def('ws2_32', 'WSACloseEvent', 1, () => 1);

  // CryptoAPI: random numbers and hashing are real (Node crypto)
  const crypt = (g) => g.crypt ||= { next: 0x7000, objects: new Map() };
  const newHandle = (g, obj) => { const c = crypt(g); const h = c.next += 4; c.objects.set(h, obj); return h; };
  const ALGORITHMS = { 0x8003: ['md5', 16], 0x8004: ['sha1', 20], 0x800c: ['sha256', 32], 0x800d: ['sha384', 48], 0x800e: ['sha512', 64] };
  def('advapi32', 'CryptAcquireContextA', 5, function (out) { this.g.u32(out, newHandle(this.g, { type: 'provider' })); return 1; });
  def('advapi32', 'CryptReleaseContext', 2, function (h) { return crypt(this.g).objects.delete(h) ? 1 : 0; });
  def('advapi32', 'CryptGenRandom', 3, function (prov, len, buf) {
    const g = this.g;
    if (crypt(g).objects.get(prov)?.type !== 'provider') { g.lastError = 6; return 0; }
    for (let off = 0; off < len; off += 65536) { const chunk = new Uint8Array(Math.min(len, off + 65536) - off); globalThis.crypto.getRandomValues(chunk); g.u8.set(chunk, buf + off); }
    return 1;
  });
  def('advapi32', 'CryptCreateHash', 5, function (prov, algid, _key, _flags, out) {
    const g = this.g, alg = ALGORITHMS[algid];
    if (crypt(g).objects.get(prov)?.type !== 'provider') { g.lastError = 6; return 0; }
    if (!alg) { g.lastError = 0x80090008; return 0; }            // NTE_BAD_ALGID
    g.u32(out, newHandle(g, { type: 'hash', algid, name: alg[0], size: alg[1], hash: createHash(alg[0]), value: null }));
    return 1;
  });
  def('advapi32', 'CryptHashData', 4, function (h, data, len) {
    const o = crypt(this.g).objects.get(h);
    if (o?.type !== 'hash' || o.value) { this.g.lastError = o ? 0x80090020 : 6; return 0; }
    o.hash.update(this.g.u8.slice(data, data + len));
    return 1;
  });
  def('advapi32', 'CryptGetHashParam', 5, function (h, param, out, lenPtr) {
    const g = this.g, o = crypt(g).objects.get(h);
    if (o?.type !== 'hash') { g.lastError = 6; return 0; }
    let bytes;
    if (param === 1) { bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, o.algid, true); }   // HP_ALGID
    else if (param === 4) { bytes = new Uint8Array(4); new DataView(bytes.buffer).setUint32(0, o.size, true); }   // HP_HASHSIZE
    else if (param === 2) { o.value ||= o.hash.digest(); bytes = o.value; }                  // HP_HASHVAL
    else { g.lastError = ERROR_INVALID_PARAMETER; return 0; }
    const cap = g.u32(lenPtr);
    g.u32(lenPtr, bytes.length);
    if (!out) return 1;
    if (cap < bytes.length) { g.lastError = 234; return 0; }                                 // ERROR_MORE_DATA
    g.u8.set(bytes, out);
    return 1;
  });
  def('advapi32', 'CryptDestroyHash', 1, function (h) { return crypt(this.g).objects.delete(h) ? 1 : 0; });

  // certificates (TLS needs a socket transport first)
  for (const [n, a] of [['CertFreeCertificateChainEngine', 1], ['CertCreateCertificateChainEngine', 2], ['CertFreeCertificateChain', 1],
    ['CertFindExtension', 4], ['CertAddCertificateContextToStore', 4], ['CryptDecodeObjectEx', 8], ['PFXImportCertStore', 3],
    ['CryptStringToBinaryA', 7], ['CertFreeCertificateContext', 1], ['CertFindCertificateInStore', 6], ['CertEnumCertificatesInStore', 2],
    ['CertCloseStore', 2], ['CertOpenStore', 5], ['CertGetCertificateChain', 8], ['CryptQueryObject', 11]])
    def('crypt32', n, a, failWith(ERROR_NOT_SUPPORTED), 'no certificate store (HTTPS needs a network transport)');

  // misc
  def('user32', 'FindWindowA', 2, () => 0, 'no other windows exist in this host');
  def('winmm', 'waveOutGetPosition', 3, () => 2, 'no winmm audio device (MMSYSERR_NODRIVER)');

  // BASS (audio library behind gmod_audio.dll)
  // bass.dll is Petite-packed, so it is not lifted. The device is virtual: BASS_Init succeeds (GMod treats a
  // failed init as fatal) and anything played is discarded in this Node host. Decoding is not implemented, so
  // creating a stream or module fails the way BASS does for an unreadable format / unreachable URL, which means
  // no channel handle ever exists. Replace with a WebAudio-backed implementation when the browser backend lands.
  const BASS_ERROR_HANDLE = 5, BASS_ERROR_NONET = 32, BASS_ERROR_FILEFORM = 41;
  let bassError = 0;
  const bassFail = (code) => function () { bassError = code; return 0; };
  const BASS = [
    ['ChannelGetLevel', 1], ['ChannelGetPosition', 2], ['ChannelSetPosition', 4], ['ChannelGetLength', 2],
    ['ChannelGet3DPosition', 4], ['ChannelSet3DPosition', 4], ['ChannelGet3DAttributes', 7], ['ChannelSet3DAttributes', 7],
    ['ChannelGetAttribute', 3], ['ChannelSetAttribute', 3], ['ChannelPause', 1], ['ChannelStop', 1], ['ChannelPlay', 2],
    ['ChannelFlags', 3], ['ChannelGetTags', 2], ['ChannelIsActive', 1], ['ChannelSeconds2Bytes', 3], ['ChannelBytes2Seconds', 3],
    ['MusicFree', 1], ['PluginFree', 1], ['StreamFree', 1], ['ChannelGetData', 3], ['ChannelGetInfo', 2], ['StreamGetFilePosition', 2],
  ];
  for (const [n, a] of BASS) def('bass', `BASS_${n}`, a, bassFail(BASS_ERROR_HANDLE), 'bass.dll is not lifted: no channel can exist');
  def('bass', 'BASS_MusicLoad', 7, bassFail(BASS_ERROR_FILEFORM), 'bass.dll is not lifted: no audio decoding');
  def('bass', 'BASS_StreamCreateFileUser', 4, bassFail(BASS_ERROR_FILEFORM), 'bass.dll is not lifted: no audio decoding');
  def('bass', 'BASS_StreamCreateURL', 5, bassFail(BASS_ERROR_NONET), 'no network transport');
  def('bass', 'BASS_Init', 5, () => 1, 'virtual audio device: output is discarded');
  for (const n of ['Start', 'Stop', 'Free', 'Apply3D']) def('bass', `BASS_${n}`, 0, () => 1);
  def('bass', 'BASS_Update', 1, () => 1);
  def('bass', 'BASS_Set3DPosition', 4, () => 1);
  def('bass', 'BASS_Set3DFactors', 3, () => 1);
  def('bass', 'BASS_SetConfig', 2, () => 1);
  def('bass', 'BASS_ErrorGetCode', 0, () => bassError);
}
