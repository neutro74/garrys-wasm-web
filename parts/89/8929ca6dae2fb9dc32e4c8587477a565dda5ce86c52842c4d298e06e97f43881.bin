// Synchronous random-access reads of the game install from a browser worker, as the `reader` for webfs.mjs.
// Sync XHR with Range requests is allowed in workers; small reads are served from a block cache so scattered
// VPK/BSP/VTF reads do not each cost a round trip.

const BLOCK = 128 * 1024;
// Each worker has its own cache, so the limit is per worker (the page sets a larger one for the main guest thread).
export function createHttpReader(base = '/game/', { cacheLimit = 8 * 1024 * 1024 } = {}) {
  const cache = new Map();            // "path:block" -> Uint8Array, insertion order = LRU order
  let cached = 0;

  const fetchRange = (path, start, end) => {
    // A failed read here throws into the engine, so retry transient failures (network error, 5xx) before giving up.
    for (let attempt = 0; ; attempt++) {
      const x = new XMLHttpRequest();
      x.open('GET', base + path.split('/').map(encodeURIComponent).join('/'), false);
      x.responseType = 'arraybuffer';
      x.setRequestHeader('Range', `bytes=${start}-${end}`);
      let failure = null;
      try { x.send(); } catch (error) { failure = error.message; }
      if (!failure && (x.status === 206 || x.status === 200)) {
        const bytes = new Uint8Array(x.response);
        return x.status === 200 ? bytes.subarray(start, end + 1) : bytes;   // a server that ignores Range sends everything
      }
      if (!failure && x.status < 500 && x.status !== 0) throw new Error(`read ${path} [${start}-${end}]: HTTP ${x.status}`);
      if (attempt >= 2) throw new Error(`read ${path} [${start}-${end}]: ${failure ?? 'HTTP ' + x.status}`);
    }
  };

  const block = (path, idx) => {
    const key = `${path}:${idx}`;
    let b = cache.get(key);
    if (b) { cache.delete(key); cache.set(key, b); return b; }
    b = fetchRange(path, idx * BLOCK, (idx + 1) * BLOCK - 1).slice();
    cache.set(key, b); cached += b.length;
    while (cached > cacheLimit) { const [k, v] = cache.entries().next().value; cache.delete(k); cached -= v.length; }
    return b;
  };

  // Fills `buf` from file offset `pos`; returns the number of bytes read.
  return (path, pos, buf) => {
    if (buf.length >= BLOCK * 2) { buf.set(fetchRange(path, pos, pos + buf.length - 1)); return buf.length; }   // large read: no caching
    let done = 0;
    while (done < buf.length) {
      const at = pos + done, idx = Math.floor(at / BLOCK), off = at - idx * BLOCK;
      const b = block(path, idx);
      if (off >= b.length) break;
      const n = Math.min(buf.length - done, b.length - off);
      buf.set(b.subarray(off, off + n), done);
      done += n;
      if (b.length < BLOCK) break;      // short block: end of file
    }
    return done;
  };
}
