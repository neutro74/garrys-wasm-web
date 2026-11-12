// GMA index layout follows Facepunch/gmad include/AddonReader.h.
const decode = new TextDecoder('utf-8', { fatal: true });
const displayDecode = new TextDecoder('utf-8');
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let k=0;k<8;k++) n=(n&1)?0xedb88320^(n>>>1):n>>>1;
  return n>>>0;
});
export function crc32(bytes) {
  let crc=0xffffffff;
  for (const b of bytes) crc=crcTable[(crc^b)&255]^(crc>>>8);
  return (crc^0xffffffff)>>>0;
}
export function addonPath(path) {
  if (typeof path!=='string' || !path || path.includes('\\') || /[:\x00-\x1f]/.test(path) || path.startsWith('/') ||
      path.split('/').some(p=>!p || p==='.' || p==='..')) throw new Error(`Invalid addon path: ${path}`);
  return path.toLowerCase();
}

export function readGma(input, { maxBytes=256*1024*1024, maxFiles=100000, strictArchiveCrc=true }={}) {
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(bytes.length>maxBytes) throw new Error('GMA exceeds byte limit');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let pos=0;
  function take(n) { if(!Number.isSafeInteger(n)||n<0||pos+n>bytes.length) throw new Error('GMA truncated/out of bounds'); const start=pos;pos+=n;return start; }
  function u32() { return view.getUint32(take(4),true); }
  function u64() { return view.getBigUint64(take(8),true); }
  function str(strict=false) { const start=pos;while(pos<bytes.length&&bytes[pos]!==0)pos++;if(pos===bytes.length)throw new Error('GMA truncated string');const out=(strict?decode:displayDecode).decode(bytes.subarray(start,pos));pos++;return out; }
  if(decode.decode(bytes.subarray(take(4),4))!=='GMAD')throw new Error('GMA magic mismatch');
  const version=bytes[take(1)];
  if(version<1||version>3)throw new Error(`Unsupported GMA version ${version}`);
  const steamId=u64().toString(), timestamp=u64().toString(), required=[];
  if(version>1) { let item;while((item=str())!=='')required.push(item); }
  const name=str(), description=str(), author=str();u32();
  const entries=[], names=new Set();
  while(u32()!==0) {
    if(entries.length>=maxFiles)throw new Error('GMA exceeds file limit');
    const path=addonPath(str(true)), size=u64(), crc=u32();
    if(names.has(path))throw new Error(`GMA duplicate path: ${path}`);
    if(size>BigInt(maxBytes))throw new Error('GMA entry out of bounds');
    names.add(path);entries.push({path,size:Number(size),crc});
  }
  const files=new Map();
  for(const e of entries) {
    const start=take(e.size), data=bytes.subarray(start,pos);
    // Workshop writers also emit zero to mean no checksum was supplied.
    if(e.crc!==0 && crc32(data)!==e.crc)throw new Error(`GMA file CRC mismatch: ${e.path}`);
    files.set(e.path,data);
  }
  if(pos!==bytes.length && pos+4!==bytes.length)throw new Error('GMA trailing data out of bounds');
  let archiveCrcMismatch=false;
  if(pos+4===bytes.length) {
    const expected=crc32(bytes.subarray(0,pos)), supplied=u32();
    if(supplied!==0 && expected!==supplied) {
      if(strictArchiveCrc) throw new Error('GMA archive CRC mismatch');
      archiveCrcMismatch=true;
    }
  }
  return {name,description,author,version,steamId,timestamp,required,files,archiveCrcMismatch};
}

export function mountAddons(addons) {
  const files=new Map(), owners=new Map(), conflicts=[];
  for(const addon of addons) for(const [raw,data] of addon.files) {
    const path=addonPath(raw);
    if(files.has(path))conflicts.push({path,previous:owners.get(path),replacement:addon.name});
    files.set(path,data);owners.set(path,addon.name);
  }
  return {files,owners,conflicts};
}

// Builds a version-3 .gma (the layout readGma reads; used by tests and tools/make-gma.mjs).
export function writeGma({ name = 'addon', description = '{"description":"","type":"tool","tags":[]}', author = 'unknown', files }) {
  const enc = new TextEncoder(), parts = [], u32 = (v) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, true); return b; };
  const u64 = (v) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(v), true); return b; };
  const z = (s) => { const b = enc.encode(s); const o = new Uint8Array(b.length + 1); o.set(b); return o; };
  parts.push(enc.encode('GMAD'), Uint8Array.of(3), u64(0), u64(Math.floor(Date.now() / 1000)), Uint8Array.of(0), z(name), z(description), z(author), u32(1));
  const list = [...files].map(([p, data]) => [addonPath(p), typeof data === 'string' ? enc.encode(data) : data]);
  list.forEach(([p, data], i) => parts.push(u32(i + 1), z(p), u64(data.length), u32(crc32(data))));
  parts.push(u32(0));
  for (const [, data] of list) parts.push(data);
  const body = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
  let at = 0; for (const b of parts) { body.set(b, at); at += b.length; }
  const out = new Uint8Array(body.length + 4); out.set(body); out.set(u32(crc32(body)), body.length);
  return out;
}
