// Node development host: a Win32 volume rooted at an explicit local directory. The retail install
// is never modified: writes, creations and deletions go to a copy-on-write overlay directory
// (GMOD_OVERLAY, default <repo>/run/overlay) that is merged over it. Deleted install files are
// recorded as marker files under <overlay>.whiteouts, so every guest thread sees the same state.
// Browser/OPFS support requires a separate asynchronous backend.
import { fs, path, overlayRoot } from './platform.mjs';
import { Vpk } from '../../lib/vpk.mjs';
import { env as ENV } from './platform.mjs';

const FILE = 0x46494c45;
const WRITE_ACCESS = 0x50000006;          // GENERIC_WRITE | GENERIC_ALL | FILE_WRITE_DATA | FILE_APPEND_DATA
const OPAQUE = '.__opaque__';             // marks an overlay directory that hides the install's same-named directory
const DEFAULT_OVERLAY = overlayRoot() ?? new URL('../../../run/overlay', import.meta.url).pathname;

export class NativeFiles {
  constructor(g, root, overlay = ENV.GMOD_OVERLAY || DEFAULT_OVERLAY) {
    this.g = g; this.root = fs.realpathSync(root);
    fs.mkdirSync(overlay, { recursive: true });
    this.overlay = fs.realpathSync(overlay);
    this.whiteRoot = this.overlay + '.whiteouts';
    fs.mkdirSync(this.whiteRoot, { recursive: true });
    // Mount every *_dir.vpk in the volume, with the same loose-file priority as
    // the real game: the archive's directory prefix maps to a virtual folder.
    this.vpks = []; this.archiveFds = new Map();
    this.fileIndexes = new Map();
    this.mountedDirs = new Set();
    for (const dir of [this.root, path.join(this.root, 'garrysmod')]) this.mountVpkDir(dir);
  }

  mountVpkDir(dir) {
    if(this.mountedDirs.has(dir))return;
    this.mountedDirs.add(dir);
    if(!fs.existsSync(dir))return;
    for(const name of fs.readdirSync(dir).sort()) {
      if(!name.endsWith('_dir.vpk'))continue;
      const prefix=path.relative(this.root,dir).replaceAll(path.sep,'/');
      this.vpks.push({vpk:new Vpk(path.join(dir,name)),prefix:prefix?prefix+'/':''});
    }
  }

  lookupVpk(relPath) {
    const lower = relPath.toLowerCase();
    const contentDir=lower.split('/')[0];
    if(contentDir==='sourceengine'||contentDir==='platform')this.mountVpkDir(path.join(this.root,contentDir));
    for (const v of this.vpks) {
      if (!lower.startsWith(v.prefix)) continue;
      const key = lower.slice(v.prefix.length);
      if (v.vpk.has(key)) return { v, key };
    }
    return null;
  }

  vpkEntry(v, key) { return v.vpk.entries.get(key); }

  vpkRead(v, key, offset, count) {
    const e = this.vpkEntry(v, key);
    const out = new Uint8Array(count);
    let done = 0;
    const preload = Math.min(e.preloadBytes, count);
    if (offset < preload) {
      const n = Math.min(preload - offset, count);
      out.set(v.vpk.buf.subarray(e.preloadOffset + offset, e.preloadOffset + offset + n), 0);
      done = n;
    }
    if (done < count) {
      const archiveOffset = e.offset + Math.max(0, offset - e.preloadBytes);
      const n = count - done;
      if (e.archive === 0x7fff) {
        out.set(v.vpk.buf.subarray(v.vpk.dataStart + archiveOffset, v.vpk.dataStart + archiveOffset + n), done);
      } else {
        const file = `${v.vpk.base}_${String(e.archive).padStart(3, '0')}.vpk`;
        let fd = this.archiveFds.get(file);
        if (fd === undefined) { fd = fs.openSync(file, 'r'); this.archiveFds.set(file, fd); }
        fs.readSync(fd, out, done, n, archiveOffset);
      }
    }
    return out;
  }

  // Virtual path (as the guest names it) -> components below the volume root, or null if outside it.
  parts(input) {
    let name = input.replaceAll('\\', '/');
    const drive = name.match(/^([a-z]):(.*)$/i);
    if (drive) {
      if (drive[1].toLowerCase() !== 'c') return null;
      // "c:foo" is drive-relative (relative to C:'s current directory),
      // "c:\foo" is absolute on C:.
      name = drive[2].startsWith('/') ? drive[2] : '/gamebox/' + drive[2];
    } else if (name.startsWith('\\')) {
      name = '/gamebox/' + name.slice(1);   // root-relative on C:
    } else if (name.startsWith('/')) return null;
    else name = '/gamebox/' + name;          // relative to the current directory
    if (!/^\/gamebox(?:\/|$)/i.test(name)) return null;
    name = name.slice('/gamebox'.length);
    const parts = [];
    for (const part of name.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        if (!parts.length) return null;
        parts.pop();
      } else {
        if (part.includes(':')) return null;
        parts.push(part);
      }
    }
    return parts;
  }

  // Case-insensitive walk of `parts` below `base`; null if absent or if it would leave `base` (symlinks).
  findIn(base, parts) {
    let current = base;
    for (const part of parts) {
      let entries;
      try { entries = fs.readdirSync(current); } catch { return null; }
      const matches = entries.filter(x => x.toLowerCase() === part.toLowerCase());
      const chosen = entries.includes(part) ? part : matches.length === 1 ? matches[0] : null;
      if (!chosen || chosen === OPAQUE) return null;
      current = path.join(current, chosen);
    }
    let real;
    try { real = fs.realpathSync(current); } catch { return null; }
    const relative = path.relative(base, real);
    return relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative) ? null : real;
  }

  marker(parts) {
    const lower = parts.map(x => x.toLowerCase());
    lower[lower.length - 1] += '.wh';
    return path.join(this.whiteRoot, ...lower);
  }
  isWhiteout(parts) {
    for (let k = 1; k <= parts.length; k++) if (fs.existsSync(this.marker(parts.slice(0, k)))) return true;
    return false;
  }
  addWhiteout(parts) {
    const m = this.marker(parts);
    fs.mkdirSync(path.dirname(m), { recursive: true });
    fs.writeFileSync(m, '');
  }
  clearWhiteout(parts) { fs.rmSync(this.marker(parts), { force: true }); }
  opaqueAbove(parts) {
    for (let k = 1; k < parts.length; k++) {
      const dir = this.findIn(this.overlay, parts.slice(0, k));
      if (dir && fs.existsSync(path.join(dir, OPAQUE))) return true;
    }
    return false;
  }

  // Where `parts` lives in the merged view: the overlay copy if there is one, else the install's.
  locate(parts) {
    if (!parts.length) return { real: this.root, layer: 'root' };
    if (this.isWhiteout(parts)) return null;
    const o = this.findIn(this.overlay, parts);
    if (o) return { real: o, layer: 'overlay' };
    if (this.opaqueAbove(parts)) return null;
    const r = this.findIn(this.root, parts);
    return r ? { real: r, layer: 'root' } : null;
  }
  isDir(loc) { try { return fs.statSync(loc.real).isDirectory(); } catch { return false; } }

  resolve(input) {
    const parts = this.parts(input);
    if (!parts) return null;
    return this.locate(parts)?.real ?? null;
  }

  // Overlay path for `parts`, keeping the on-disk spelling of components that already exist in either layer.
  overlayTarget(parts) {
    let dir = this.overlay;
    const virtual = [];
    for (const part of parts) {
      virtual.push(part);
      const have = this.locate(virtual);
      dir = path.join(dir, have ? path.basename(have.real) : part);
    }
    return dir;
  }
  // The directory that would hold `parts` must exist in the merged view.
  parentExists(parts) {
    if (parts.length <= 1) return true;
    const parent = this.locate(parts.slice(0, -1));
    return !!parent && this.isDir(parent);
  }
  makeOverlayParents(target) { fs.mkdirSync(path.dirname(target), { recursive: true }); }

  open(name, access, disposition) {
    const g = this.g;
    if (ENV.GUEST_LOG_FILES) console.log(`[file] open ${name} access=${access} disp=${disposition}`);
    if (ENV.GUEST_DEBUG_BACKGROUNDS && /backgrounds/i.test(name))
      console.log(`[background-file] open ${JSON.stringify(name)} resolved=${this.resolve(name)}`);
    if ((access & WRITE_ACCESS) || disposition !== 3) return this.openForWrite(name, access, disposition);
    let real = null;
    try { real = this.resolve(name); } catch { real = null; }
    if (!real) {
      // Not a loose file: serve the same virtual path from a mounted VPK.
      const normalized = this.parts(name);
      if (!normalized) { g.lastError = 2; return -1; }
      const rel = normalized.join('/');
      const found = this.lookupVpk(rel);
      if (!found) { g.lastError = 2; return -1; }
      const e = this.vpkEntry(found.v, found.key);
      const size = e.preloadBytes + e.length;
      const obj = { type: 'vpklike', v: found.v, key: found.key, size, position: 0n, access, refs: 1 };
      if (g.sharedHeap) {
        const p = g.alloc(40);
        g.u32(p, FILE); g.u32(p + 4, 0xffffffff); g.u32(p + 20, access);
        g.u32(p + 24, found.v.vpk === found.v.vpk ? 1 : 1);
        g.vpkHandles ||= new Map();
        const slot = g.vpkHandles.size; g.vpkHandles.set(slot, obj);
        g.u32(p + 8, slot); g.u32(p + 12, 0);
        return g.sharedEvents.registerObject(p);
      }
      const h = g.nextHandle++;
      obj.position = 0n; g.handles.set(h, obj); return h;
    }
    if (!fs.existsSync(real) || !fs.statSync(real).isFile()) { g.lastError = 2; return -1; }
    let fd;
    try { fd = fs.openSync(real, 'r'); } catch (e) { g.lastError = ['EACCES', 'EPERM'].includes(e.code) ? 5 : 2; return -1; }
    if (!fs.fstatSync(fd).isFile()) { fs.closeSync(fd); g.lastError = 5; return -1; }
    if (g.sharedHeap) {
      const p = g.alloc(32);
      g.u32(p, FILE); g.u32(p + 4, fd); g.u32(p + 20, access);
      try { return g.sharedEvents.registerObject(p); }
      catch (e) { fs.closeSync(fd); g.free(p); throw e; }
    }
    const h = g.nextHandle++;
    g.handles.set(h, { type: 'file', fd, position: 0n, refs: 1, access });
    return h;
  }

  object(h) {    if (this.g.sharedHeap) {
      const p = this.g.sharedEvents.lookupObject(h, FILE);
      if (!p) return null;
      const fd = this.g.u32(p + 4);
      if (fd === 0xffffffff) {
        const o = this.g.vpkHandles?.get(this.g.u32(p + 8));
        return o ? { p, vpk: o, access: this.g.u32(p + 20) } : null;
      }
      return { p, fd, access: this.g.u32(p + 20) };
    }
    const obj = this.g.handles.get(h);
    return obj?.type === 'file' || obj?.type === 'vpklike' ? obj : null;
  }

  // BY_HANDLE_FILE_INFORMATION for GetFileInformationByHandle. Loose files use
  // the real inode metadata; VPK entries report their archive size with a
  // synthetic but stable per-handle file index.
  info(h, out) {
    const g = this.g, obj = this.object(h);
    if (!obj) return false;
    const vpk = this.vpkOf(obj);
    let size, mtime;
    if (vpk) { size = vpk.size; mtime = 0; }
    else {
      let st;
      try { st = fs.fstatSync(obj.fd); } catch { return false; }
      if (st.isDirectory()) return false;
      size = st.size; mtime = st.mtimeMs;
    }
    g.u8.fill(0, out, out + 52);
    g.u32(out, ARCHIVE | NORMAL);
    const t = filetime(mtime);
    g.dv.setBigUint64(out + 4, t, true);
    g.dv.setBigUint64(out + 12, t, true);
    g.dv.setBigUint64(out + 20, t, true);
    g.u32(out + 28, 0x47414d45);                 // volume serial "GAME"
    g.u32(out + 32, Math.floor(size / 0x100000000));
    g.u32(out + 36, size >>> 0);
    g.u32(out + 40, 1);                          // nNumberOfLinks
    let idx = this.fileIndexes.get(h);
    if (idx === undefined) { idx = 0x10000 + this.fileIndexes.size + 1; this.fileIndexes.set(h, idx); }
    g.u32(out + 44, Math.floor(idx / 0x100000000));
    g.u32(out + 48, idx >>> 0);
    return true;
  }

  vpkOf(obj) { return obj.vpk || (obj.type === 'vpklike' ? obj : null); }
  vpkPos(obj) {
    const v = this.vpkOf(obj);
    if (obj.p) return this.g.dv.getBigInt64(obj.p + 32, true);
    return v.position;
  }
  setVpkPos(obj, value) {
    const v = this.vpkOf(obj);
    if (obj.p) this.g.dv.setBigInt64(obj.p + 32, value, true);
    else v.position = value;
  }

  locked(obj, fn) {
    if (!obj.p) return fn();
    const lock = new Int32Array(this.g.mem.buffer, obj.p + 16, 1);
    while (Atomics.compareExchange(lock, 0, 0, 1) !== 0) Atomics.wait(lock, 0, 1);
    try { return fn(); } finally { Atomics.store(lock, 0, 0); Atomics.notify(lock, 0, 1); }
  }

  position(obj, value) {
    if (value === undefined) return obj.p ? this.g.dv.getBigInt64(obj.p + 8, true) : obj.position;
    if (obj.p) this.g.dv.setBigInt64(obj.p + 8, value, true); else obj.position = value;
  }

  read(h, buffer, count, written, overlapped) {
    const g = this.g, obj = this.object(h);
    if (!obj) { g.lastError = 6; return 0; }
    if (!(obj.access & 0x90000001)) { g.lastError = 5; return 0; }
    if (buffer + count > g.u8.length || buffer + count < buffer) throw new Error('invalid guest file read buffer');
    const vpk = this.vpkOf(obj);
    if (vpk) {
      const at = overlapped ? (BigInt(g.u32(overlapped + 8)) | (BigInt(g.u32(overlapped + 12)) << 32n)) : this.vpkPos(obj);
      if (at > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('file position exceeds Node safe integer range');
      const n = Math.max(0, Math.min(count, vpk.size - Number(at)));
      if (n) g.u8.set(this.vpkRead(vpk.v, vpk.key, Number(at), n), buffer);
      if (overlapped) {
        g.u32(overlapped, 0); g.u32(overlapped + 4, n);
        const event = g.u32(overlapped + 16);
        if (event) {
          if (g.sharedEvents?.lookup(event)) g.sharedEvents.signal(event, 1);
          else { const e = g.handles.get(event); if (e?.type === 'event') e.signaled = true; }
        }
      } else this.setVpkPos(obj, at + BigInt(n));
      if (written) g.u32(written, n);
      return 1;
    }
    return this.locked(obj, () => {
      const position = this.position(obj);
      if (position > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('file position exceeds Node safe integer range');
      let n;
      if (overlapped) {
        // An overlapped operation is allowed to complete synchronously; report
        // the result in OVERLAPPED::InternalHigh and do not move the file pointer.
        const at = BigInt(g.u32(overlapped + 8)) | (BigInt(g.u32(overlapped + 12)) << 32n);
        n = fs.readSync(obj.fd, new Uint8Array(g.mem.buffer, buffer, count), 0, count, Number(at));
        g.u32(overlapped, 0); g.u32(overlapped + 4, n);
        const event = g.u32(overlapped + 16);
        if (event) {
          if (g.sharedEvents?.lookup(event)) g.sharedEvents.signal(event, 1);
          else { const e = g.handles.get(event); if (e?.type === 'event') e.signaled = true; }
        }
      } else {
        n = fs.readSync(obj.fd, new Uint8Array(g.mem.buffer, buffer, count), 0, count, Number(position));
        this.position(obj, position + BigInt(n));
      }
      if (written) g.u32(written, n);
      return 1;
    });
  }

  size(h, out) {
    const obj = this.object(h);
    if (!obj || !out) { this.g.lastError = 6; return 0; }
    const vpk = this.vpkOf(obj);
    this.g.dv.setBigInt64(out, BigInt(vpk ? vpk.size : fs.fstatSync(obj.fd).size), true); return 1;
  }

  seek(h, low, high, out, method) {
    const obj = this.object(h);
    if (!obj) { this.g.lastError = 6; return 0; }
    const vpk = this.vpkOf(obj);
    const end = vpk ? BigInt(vpk.size) : null;
    return this.locked(obj, () => {
      const offset = BigInt.asIntN(64, (BigInt(high >>> 0) << 32n) | BigInt(low >>> 0));
      const base = method === 0 ? 0n
        : method === 1 ? (vpk ? this.vpkPos(obj) : this.position(obj))
        : method === 2 ? (vpk ? end : BigInt(fs.fstatSync(obj.fd).size)) : null;
      if (base === null || base + offset < 0n) { this.g.lastError = 131; return 0; }
      const next = base + offset;
      if (vpk) this.setVpkPos(obj, next); else this.position(obj, next);
      if (out) this.g.dv.setBigInt64(out, next, true);
      return 1;
    });
  }

  close(h) {
    const g = this.g;
    if (g.sharedHeap) {
      const p = g.sharedEvents.removeObject(h, FILE);
      if (!p) return false;
      const fd = g.u32(p + 4);
      if (fd !== 0xffffffff) fs.closeSync(fd);
      else g.vpkHandles?.delete(g.u32(p + 8));
      g.u32(p, 0); g.free(p); return true;
    }
    const obj = this.object(h);
    if (!obj) return false;
    g.handles.delete(h);
    if (obj.type !== 'vpklike') fs.closeSync(obj.fd);
    return true;
  }
}

const FIND = 0x46494e44;
const DIRECTORY = 0x10, ARCHIVE = 0x20, NORMAL = 0x80;

function filetime(ms) {
  return (BigInt(Math.floor(ms)) * 10000n) + 116444736000000000n;
}
function matchWildcard(name, pattern) {
  const re = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
  return re.test(name);
}

export class FindState {
  constructor(g, entries, index = 0) { this.g = g; this.entries = entries; this.index = index; }
}

// Entries of a merged directory: overlay first, then the install's (unless hidden by an opaque
// overlay directory), minus anything deleted.
NativeFiles.prototype.listDir = function (parts) {
  const out = new Map();
  const add = (dir, hideDeleted) => {
    let names;
    try { names = fs.readdirSync(dir); } catch { return; }
    for (const n of names) {
      if (n === OPAQUE || out.has(n.toLowerCase())) continue;
      if (hideDeleted && this.isWhiteout([...parts, n])) continue;
      try {
        const st = fs.statSync(path.join(dir, n));
        out.set(n.toLowerCase(), { name: n, dir: st.isDirectory(), size: st.size, mtime: st.mtimeMs });
      } catch { /* dangling symlink */ }
    }
  };
  const o = parts.length ? this.findIn(this.overlay, parts) : this.overlay;
  const r = parts.length ? this.findIn(this.root, parts) : this.root;
  if (o) add(o, false);
  const hidden = parts.length && (this.isWhiteout(parts) || this.opaqueAbove(parts) || (o && fs.existsSync(path.join(o, OPAQUE))));
  if (r && !hidden) add(r, true);
  return out;
};

NativeFiles.prototype.findFirst = function (pattern, out, wide = true) {
  const g = this.g;
  let p = pattern.replaceAll('\\', '/');
  const slash = p.lastIndexOf('/');
  const dirPart = slash < 0 ? '.' : p.slice(0, slash);
  const mask = slash < 0 ? p : p.slice(slash + 1);
  const dirParts = this.parts(dirPart === '.' ? '' : dirPart);
  const dirLoc = dirParts && this.locate(dirParts);
  if (!dirLoc || !this.isDir(dirLoc)) { g.lastError = 3; return -1; }
  const entries = [...this.listDir(dirParts).values()];
  const matched = entries.filter(e => matchWildcard(e.name, mask))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!matched.length) { g.lastError = 2; return -1; }
  // Windows also reports . and .. only for wildcard masks.
  const all = mask === '*' || mask === '*.*'
    ? [{ name: '.', dir: true, size: 0, mtime: Date.now() },
       { name: '..', dir: true, size: 0, mtime: Date.now() }, ...matched]
    : matched;
  const state = new FindState(g, all, 1);
  let handle;
  if (g.sharedHeap) {
    const cell = g.alloc(16);
    g.u32(cell, FIND); g.u32(cell + 4, g.findStates.push(state) - 1);
    handle = g.sharedEvents.registerObject(cell);
    state.cell = cell;
  } else {
    handle = g.nextHandle++; g.handles.set(handle, { type: 'find', state, refs: 1 });
  }
  this.writeFindData(state.entries[0], out, wide);
  return handle;
};

NativeFiles.prototype.findNext = function (handle, out, wide = true) {
  const g = this.g;
  let state;
  if (g.sharedHeap) {
    const cell = g.sharedEvents.lookupObject(handle, FIND);
    if (!cell) { g.lastError = 6; return 0; }
    state = g.findStates[g.u32(cell + 4)];
  } else {
    const obj = g.handles.get(handle);
    if (!obj || obj.type !== 'find') { g.lastError = 6; return 0; }
    state = obj.state;
  }
  if (!state || state.index >= state.entries.length) { g.lastError = 18; return 0; }
  this.writeFindData(state.entries[state.index++], out, wide);
  return 1;
};

NativeFiles.prototype.findClose = function (handle) {
  const g = this.g;
  if (g.sharedHeap) {
    const cell = g.sharedEvents.removeObject(handle, FIND);
    if (!cell) return false;
    g.free(cell); return true;
  }
  const obj = g.handles.get(handle);
  if (!obj || obj.type !== 'find') return false;
  g.handles.delete(handle); return true;
};

NativeFiles.prototype.attributes = function (name) {
  let real;
  try { real = this.resolve(name); } catch { return null; }
  if (!real) {
    // Loose files win, but VPK entries still exist for the engine.
    const parts=this.parts(name);
    if(!parts)return null;
    const rel=parts.join('/');
    const hit = this.lookupVpk(rel);
    if (hit) { const e = this.vpkEntry(hit.v, hit.key); return { dir: false, size: e.preloadBytes + e.length, mtime: 0 }; }
    return null;
  }
  try {
    const st = fs.statSync(real);
    return { dir: st.isDirectory(), size: st.isDirectory() ? 0 : st.size, mtime: st.mtimeMs };
  } catch { return null; }
};

NativeFiles.prototype.writeAttributeData = function (a, out) {
  const g = this.g;
  g.u32(out, a.dir ? DIRECTORY : (ARCHIVE | NORMAL));
  const t = filetime(a.mtime);
  g.dv.setBigUint64(out + 4, t, true);
  g.dv.setBigUint64(out + 12, t, true);
  g.dv.setBigUint64(out + 20, t, true);
  g.u32(out + 28, Math.floor(a.size / 0x100000000));
  g.u32(out + 32, a.size >>> 0);
};

NativeFiles.prototype.writeFindData = function (entry, out, wide) {
  const g = this.g;
  const attr = entry.dir ? DIRECTORY : (ARCHIVE | NORMAL);
  g.u8.fill(0, out, out + (wide ? 592 : 320));
  g.u32(out, attr);
  const t = filetime(entry.mtime);
  g.dv.setBigUint64(out + 4, t, true); g.dv.setBigUint64(out + 12, t, true); g.dv.setBigUint64(out + 20, t, true);
  g.u32(out + 28, Math.floor(entry.size / 0x100000000)); g.u32(out + 32, entry.size >>> 0);
  if (wide) {
    for (let i = 0; i < entry.name.length && i < 259; i++) g.dv.setUint16(out + 44 + 2 * i, entry.name.charCodeAt(i), true);
  } else {
    for (let i = 0; i < entry.name.length && i < 259; i++) g.u8[out + 44 + i] = entry.name.charCodeAt(i);
    // 8.3 name: only fill when the name does not fit (kept empty otherwise).
  }
};

// writable overlay operations
const ERROR = { FILE_NOT_FOUND: 2, PATH_NOT_FOUND: 3, ACCESS_DENIED: 5, NOT_SAME_DEVICE: 17, FILE_EXISTS: 80, DIR_NOT_EMPTY: 145, ALREADY_EXISTS: 183, NOT_SUPPORTED: 50 };

NativeFiles.prototype.newHandle = function (fd, access) {
  const g = this.g;
  if (g.sharedHeap) {
    const p = g.alloc(40);
    g.u32(p, FILE); g.u32(p + 4, fd); g.u32(p + 20, access);
    try { return g.sharedEvents.registerObject(p); }
    catch (e) { fs.closeSync(fd); g.free(p); throw e; }
  }
  const h = g.nextHandle++;
  g.handles.set(h, { type: 'file', fd, position: 0n, refs: 1, access });
  return h;
};

// Make `parts` exist in the overlay as a real file so it can be written; returns its overlay path.
NativeFiles.prototype.materialize = function (parts, loc, truncate) {
  const target = loc?.layer === 'overlay' ? loc.real : this.overlayTarget(parts);
  this.makeOverlayParents(target);
  if (loc?.layer === 'root' && !truncate) fs.copyFileSync(loc.real, target);
  this.clearWhiteout(parts);
  return target;
};

NativeFiles.prototype.openForWrite = function (name, access, disposition) {
  const g = this.g;
  const parts = this.parts(name);
  if (!parts || !parts.length) { g.lastError = ERROR.PATH_NOT_FOUND; return -1; }
  if (!this.parentExists(parts)) { g.lastError = ERROR.PATH_NOT_FOUND; return -1; }
  const loc = this.locate(parts);
  if (loc && this.isDir(loc)) { g.lastError = ERROR.ACCESS_DENIED; return -1; }
  const exists = !!loc;
  // CREATE_NEW=1, CREATE_ALWAYS=2, OPEN_EXISTING=3, OPEN_ALWAYS=4, TRUNCATE_EXISTING=5
  if (disposition === 1 && exists) { g.lastError = ERROR.FILE_EXISTS; return -1; }
  if ((disposition === 3 || disposition === 5) && !exists) { g.lastError = ERROR.FILE_NOT_FOUND; return -1; }
  if (![1, 2, 3, 4, 5].includes(disposition)) { g.lastError = 87; return -1; }
  const truncate = disposition === 2 || disposition === 5;
  let target;
  try {
    target = this.materialize(parts, loc, truncate);
    const flags = fs.constants.O_RDWR | fs.constants.O_CREAT | (truncate ? fs.constants.O_TRUNC : 0);
    const fd = fs.openSync(target, flags, 0o644);
    g.lastError = (disposition === 2 || disposition === 4) && exists ? ERROR.ALREADY_EXISTS : 0;
    return this.newHandle(fd, access);
  } catch (e) {
    g.lastError = ['EACCES', 'EPERM', 'EISDIR'].includes(e.code) ? ERROR.ACCESS_DENIED : ERROR.PATH_NOT_FOUND;
    return -1;
  }
};

NativeFiles.prototype.write = function (h, buffer, count, written, overlapped) {
  const g = this.g, obj = this.object(h);
  if (!obj) { g.lastError = 6; return 0; }
  if (this.vpkOf(obj) || !(obj.access & WRITE_ACCESS)) { g.lastError = ERROR.ACCESS_DENIED; return 0; }
  if (buffer + count > g.u8.length || buffer + count < buffer) throw new Error('invalid guest file write buffer');
  const appendOnly = (obj.access & 0x4) && !(obj.access & (0x2 | 0x40000000 | 0x10000000));
  return this.locked(obj, () => {
    const view = new Uint8Array(g.mem.buffer, buffer, count);
    let at;
    if (overlapped) at = Number(BigInt(g.u32(overlapped + 8)) | (BigInt(g.u32(overlapped + 12)) << 32n));
    else at = appendOnly ? fs.fstatSync(obj.fd).size : Number(this.position(obj));
    let done = 0;
    try { while (done < count) done += fs.writeSync(obj.fd, view, done, count - done, at + done); }
    catch (e) { g.lastError = e.code === 'ENOSPC' ? 112 : ERROR.ACCESS_DENIED; return 0; }
    if (overlapped) {
      g.u32(overlapped, 0); g.u32(overlapped + 4, done);
      const event = g.u32(overlapped + 16);
      if (event) {
        if (g.sharedEvents?.lookup(event)) g.sharedEvents.signal(event, 1);
        else { const e = g.handles.get(event); if (e?.type === 'event') e.signaled = true; }
      }
    } else this.position(obj, BigInt(at + done));
    if (written) g.u32(written, done);
    return 1;
  });
};

NativeFiles.prototype.setEndOfFile = function (h) {
  const g = this.g, obj = this.object(h);
  if (!obj) { g.lastError = 6; return 0; }
  if (this.vpkOf(obj) || !(obj.access & WRITE_ACCESS)) { g.lastError = ERROR.ACCESS_DENIED; return 0; }
  return this.locked(obj, () => { fs.ftruncateSync(obj.fd, Number(this.position(obj))); return 1; });
};

NativeFiles.prototype.flush = function (h) {
  const obj = this.object(h);
  if (!obj) { this.g.lastError = 6; return 0; }
  if (obj.fd !== undefined && (obj.access & WRITE_ACCESS)) fs.fsyncSync(obj.fd);
  return 1;
};

NativeFiles.prototype.createDirectory = function (name) {
  const g = this.g, parts = this.parts(name);
  if (!parts || !parts.length) { g.lastError = ERROR.ALREADY_EXISTS; return 0; }
  if (!this.parentExists(parts)) { g.lastError = ERROR.PATH_NOT_FOUND; return 0; }
  if (this.locate(parts)) { g.lastError = ERROR.ALREADY_EXISTS; return 0; }
  const target = this.overlayTarget(parts);
  fs.mkdirSync(target, { recursive: true });
  // A directory recreated over a deleted install directory must not resurface the old contents.
  if (this.isWhiteout(parts) || this.findIn(this.root, parts)) fs.writeFileSync(path.join(target, OPAQUE), '');
  this.clearWhiteout(parts);
  return 1;
};

NativeFiles.prototype.deleteFile = function (name) {
  if (ENV.GUEST_LOG_FILES) console.log(`[file] delete ${name}`);
  const g = this.g, parts = this.parts(name);
  if (!parts || !parts.length) { g.lastError = ERROR.PATH_NOT_FOUND; return 0; }
  const loc = this.locate(parts);
  if (!loc) { g.lastError = this.parentExists(parts) ? ERROR.FILE_NOT_FOUND : ERROR.PATH_NOT_FOUND; return 0; }
  if (this.isDir(loc)) { g.lastError = ERROR.ACCESS_DENIED; return 0; }
  if (loc.layer === 'overlay') fs.unlinkSync(loc.real);
  if (this.findIn(this.root, parts) && !this.opaqueAbove(parts)) this.addWhiteout(parts);
  return 1;
};

NativeFiles.prototype.removeDirectory = function (name) {
  const g = this.g, parts = this.parts(name);
  if (!parts || !parts.length) { g.lastError = ERROR.ACCESS_DENIED; return 0; }
  const loc = this.locate(parts);
  if (!loc) { g.lastError = ERROR.PATH_NOT_FOUND; return 0; }
  if (!this.isDir(loc)) { g.lastError = 267; return 0; }          // ERROR_DIRECTORY
  if (this.listDir(parts).size) { g.lastError = ERROR.DIR_NOT_EMPTY; return 0; }
  const o = this.findIn(this.overlay, parts);
  if (o) fs.rmSync(o, { recursive: true, force: true });
  if (this.findIn(this.root, parts)) this.addWhiteout(parts);
  return 1;
};

NativeFiles.prototype.copyFile = function (from, to, failIfExists) {
  if (ENV.GUEST_LOG_FILES) console.log(`[file] copyFile ${from} -> ${to}`);
  const g = this.g, src = this.parts(from), dst = this.parts(to);
  const sloc = src && this.locate(src);
  if (!sloc) { g.lastError = ERROR.FILE_NOT_FOUND; return 0; }
  if (this.isDir(sloc)) { g.lastError = ERROR.ACCESS_DENIED; return 0; }
  if (!dst || !dst.length || !this.parentExists(dst)) { g.lastError = ERROR.PATH_NOT_FOUND; return 0; }
  const dloc = this.locate(dst);
  if (dloc && this.isDir(dloc)) { g.lastError = ERROR.ACCESS_DENIED; return 0; }
  if (dloc && failIfExists) { g.lastError = ERROR.FILE_EXISTS; return 0; }
  const target = this.materialize(dst, dloc, true);
  fs.copyFileSync(sloc.real, target);
  return 1;
};

// MOVEFILE_REPLACE_EXISTING = 1. Moving a directory is not supported; files are copied then deleted.
NativeFiles.prototype.moveFile = function (from, to, flags) {
  if (ENV.GUEST_LOG_FILES) console.log(`[file] moveFile ${from} -> ${to}`);
  const g = this.g, src = this.parts(from), sloc = src && this.locate(src);
  if (!sloc) { g.lastError = ERROR.FILE_NOT_FOUND; return 0; }
  if (this.isDir(sloc)) { g.lastError = ERROR.NOT_SUPPORTED; return 0; }
  if (!this.copyFile(from, to, !(flags & 1))) return 0;
  return this.deleteFile(from);
};
