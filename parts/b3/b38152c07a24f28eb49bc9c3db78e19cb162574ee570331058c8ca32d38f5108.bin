// Reads Valve VPK v1/v2 directory files and the archives they point to.
import { fs, path } from '../lift/host/platform.mjs';

export class Vpk {
  constructor(dirPath) {
    this.dirPath = dirPath;
    this.base = dirPath.replace(/_dir\.vpk$/, '');
    this.entries = new Map();
    const buf = fs.readFileSync(dirPath);
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    if (dv.getUint32(0, true) !== 0x55aa1234) throw new Error(`not a vpk: ${dirPath}`);
    const version = dv.getUint32(4, true);
    const treeSize = dv.getUint32(8, true);
    const headerSize = version === 2 ? 28 : 12;
    this.dataStart = headerSize + treeSize;
    this.buf = buf;

    let p = headerSize;
    const str = () => {
      const end = buf.indexOf(0, p);
      let s = '';
      for (let i = p; i < end; i++) s += String.fromCharCode(buf[i]);
      p = end + 1;
      return s;
    };
    for (;;) {
      const ext = str();
      if (!ext) break;
      for (;;) {
        const dir = str();
        if (!dir) break;
        for (;;) {
          const name = str();
          if (!name) break;
          const preloadBytes = dv.getUint16(p + 4, true);
          const entry = {
            archive: dv.getUint16(p + 6, true),
            offset: dv.getUint32(p + 8, true),
            length: dv.getUint32(p + 12, true),
            preloadOffset: p + 18,
            preloadBytes,
          };
          p += 18 + preloadBytes;
          const full = (dir === ' ' ? '' : dir + '/') + name + (ext === ' ' ? '' : '.' + ext);
          this.entries.set(full.toLowerCase(), entry);
        }
      }
    }
  }

  has(file) {
    return this.entries.has(file.toLowerCase());
  }

  list(prefix = '') {
    prefix = prefix.toLowerCase();
    return [...this.entries.keys()].filter((k) => k.startsWith(prefix));
  }

  // limit: read at most this many bytes from the start of the file.
  read(file, limit = Infinity) {
    const e = this.entries.get(file.toLowerCase());
    if (!e) return null;
    const preload = this.buf.subarray(e.preloadOffset, e.preloadOffset + Math.min(e.preloadBytes, limit));
    const length = Math.min(e.length, Math.max(limit - preload.length, 0));
    if (!length) return preload.slice();
    let body;
    if (e.archive === 0x7fff) {
      body = this.buf.subarray(this.dataStart + e.offset, this.dataStart + e.offset + length);
    } else {
      const archivePath = `${this.base}_${String(e.archive).padStart(3, '0')}.vpk`;
      const fd = fs.openSync(archivePath, 'r');
      body = new Uint8Array(length);
      fs.readSync(fd, body, 0, length, e.offset);
      fs.closeSync(fd);
    }
    const out = new Uint8Array(preload.length + body.length);
    out.set(preload); out.set(body, preload.length);
    return out;
  }
}

// Source search path for one game: loose files first, then every *_dir.vpk, across the
// given content folders in priority order.
export class GameFs {
  constructor(folders) {
    this.folders = folders.filter((f) => fs.existsSync(f));
    this.vpks = [];
    for (const folder of this.folders) {
      for (const name of fs.readdirSync(folder).sort()) {
        if (name.endsWith('_dir.vpk')) this.vpks.push(new Vpk(path.join(folder, name)));
      }
    }
  }

  read(file) {
    for (const folder of this.folders) {
      const loose = path.join(folder, file);
      if (fs.existsSync(loose) && fs.statSync(loose).isFile()) return fs.readFileSync(loose);
    }
    for (const vpk of this.vpks) {
      const data = vpk.read(file);
      if (data) return data;
    }
    return null;
  }

  list(prefix) {
    const out = new Map(), loose = new Map();
    for (const vpk of this.vpks) for (const k of vpk.list(prefix)) out.set(k.toLowerCase(), k);
    for (const folder of this.folders) {
      const dir = path.join(folder, prefix);
      if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
        for (const name of fs.readdirSync(dir, { recursive: true })) {
          const actual=path.posix.join(prefix,String(name)),key=actual.toLowerCase();
          // Windows assets mix case. Preserve the spelling needed to reopen a
          // loose file on Linux, while deduplicating by the Source lookup key.
          if(!loose.has(key))loose.set(key,actual);
        }
      }
    }
    for(const [key,actual] of loose)out.set(key,actual);
    return [...out.values()].sort();
  }
}
