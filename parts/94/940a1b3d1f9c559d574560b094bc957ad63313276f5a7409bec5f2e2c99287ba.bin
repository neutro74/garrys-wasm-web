// Peer-to-peer play: the engine's UDP traffic (tools/lift/host/winsock.mjs) carried over WebRTC data channels.
//
// Topology is a star on a virtual 10.77.0.0/24 network: the host is 10.77.0.1, each joiner gets 10.77.0.N. Pairing needs no
// server: the host makes an invite code (an SDP offer), the joiner answers with a reply code, the host enters the reply.
// Codes carry the edition and a mismatch is refused, so one player on Extended never joins one on Base (the client would
// otherwise look for addons it does not have).
//
// By default no STUN server is used, so connections work on the same network (LAN). Passing {internet: true} adds one public
// STUN server to reach peers across NATs; that sends the browser's address to that server, so it is opt-in.
import { createRing, RingReader, RingWriter } from '../tools/lift/host/ring.mjs';

const VNET = (10 << 24) | (77 << 16), HOST_IP = VNET | 1;
const ipStr = (n) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
const b64 = (u8) => btoa(String.fromCharCode(...u8)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const unb64 = (s) => Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
async function pack(obj) { return 'GW1.' + b64(await pipe(new TextEncoder().encode(JSON.stringify(obj)), new CompressionStream('deflate-raw'))); }
async function unpack(code) {
  const m = /^GW1\.([A-Za-z0-9_-]+)$/.exec(String(code).trim());
  if (!m) throw Error('That is not a game invite code.');
  try { return JSON.parse(new TextDecoder().decode(await pipe(unb64(m[1]), new DecompressionStream('deflate-raw')))); } catch { throw Error('That invite code is damaged. Copy it again in full.'); }
}
const gathered = (pc, ms = 4000) => new Promise((resolve) => {
  if (pc.iceGatheringState === 'complete') return resolve();
  const done = () => { pc.removeEventListener('icegatheringstatechange', check); resolve(); };
  const check = () => { if (pc.iceGatheringState === 'complete') done(); };
  pc.addEventListener('icegatheringstatechange', check); setTimeout(done, ms);
});

export class P2P {
  constructor({ edition = 'base', internet = false } = {}) {
    this.edition = edition; this.internet = internet;
    this.toGuest = createRing(1 << 20); this.fromGuest = createRing(1 << 20);
    this.writer = new RingWriter(this.toGuest); this.reader = new RingReader(this.fromGuest);
    this.role = null; this.peers = new Map(); this.pending = new Map(); this.listeners = new Set(); this.ip = HOST_IP;
    this.pump();
  }
  get rings() { return { netIn: this.toGuest, netOut: this.fromGuest }; }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  changed() { for (const fn of this.listeners) fn(this.status()); }
  status() {
    return { role: this.role, edition: this.edition, ip: ipStr(this.ip), peers: [...this.peers.keys()].map(ipStr), pending: [...this.pending.keys()].map(ipStr) };
  }
  setIp(ip) { this.ip = ip; const f = new Uint8Array(5); f[0] = 2; new DataView(f.buffer).setUint32(1, ip); this.writer.tryWrite(f); }
  // Datagrams from the engine go to the peer that owns the destination; a joiner only ever talks to the host.
  async pump() {
    for (;;) {
      await this.reader.wait();
      for (let f; (f = this.reader.read());) this.route(f);
    }
  }
  route(f) {
    if (f[0] !== 1 || f.length < 13) return;
    const dst = new DataView(f.buffer, f.byteOffset).getUint32(7) >>> 0;
    const broadcast = dst === 0xffffffff || ((dst >>> 8) === (VNET >>> 8) && (dst & 255) === 255);
    const targets = broadcast ? [...this.peers.values()] : [this.peers.get(this.role === 'guest' ? HOST_IP : dst)];
    for (const ch of targets) if (ch?.readyState === 'open') { try { ch.send(f); } catch { /* channel closing */ } }
  }
  connection() { return new RTCPeerConnection({ iceServers: this.internet ? [{ urls: 'stun:stun.l.google.com:19302' }] : [] }); }
  attach(pc, ch, ip) {
    ch.binaryType = 'arraybuffer';
    ch.onopen = () => { this.peers.set(ip, ch); this.pending.delete(ip); this.changed(); };
    ch.onmessage = (e) => { if (!this.writer.tryWrite(new Uint8Array(e.data))) { /* ring full: UDP may drop */ } };
    const gone = () => { if (this.peers.get(ip) === ch) this.peers.delete(ip); this.pending.delete(ip); if (this.role === 'guest' && !this.peers.size) this.role = null; this.changed(); };
    ch.onclose = gone;
    pc.onconnectionstatechange = () => { if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) gone(); };
  }
  // Host: one invite per joiner.
  async createInvite() {
    if (this.role === 'guest') throw Error('Leave the game you joined before hosting.');
    this.role = 'host'; this.setIp(HOST_IP);
    let ip = HOST_IP + 1; while (this.peers.has(ip) || this.pending.has(ip)) ip++;
    if ((ip & 255) > 250) throw Error('Too many players.');
    const pc = this.connection(), ch = pc.createDataChannel('gw', { ordered: false, maxRetransmits: 0 });
    this.pending.set(ip, { pc, ch }); this.attach(pc, ch, ip);
    await pc.setLocalDescription(await pc.createOffer()); await gathered(pc);
    this.changed();
    return { code: await pack({ v: 1, e: this.edition, ip, sdp: pc.localDescription.sdp }), ip: ipStr(ip) };
  }
  async finishInvite(code) {
    const a = await unpack(code);
    if (a.e !== this.edition) throw Error(`That reply is from the ${a.e} edition; this game is ${this.edition}.`);
    const p = this.pending.get(a.ip);
    if (!p) throw Error('That reply is for an invite that is no longer open. Create a new one.');
    await p.pc.setRemoteDescription({ type: 'answer', sdp: a.sdp });
  }
  // Joiner: returns the reply code to send back to the host.
  async acceptInvite(code) {
    const o = await unpack(code);
    if (o.e !== this.edition) throw Error(`This invite is for the ${o.e} edition and you are running ${this.edition}. Both players must start the same edition.`);
    if (this.role === 'host') throw Error('You are hosting. Stop hosting before joining another game.');
    this.role = 'guest'; this.setIp(o.ip);
    const pc = this.connection();
    pc.ondatachannel = ({ channel }) => this.attach(pc, channel, HOST_IP);
    await pc.setRemoteDescription({ type: 'offer', sdp: o.sdp });
    await pc.setLocalDescription(await pc.createAnswer()); await gathered(pc);
    this.changed();
    return pack({ v: 1, e: this.edition, ip: o.ip, sdp: pc.localDescription.sdp });
  }
  leave() {
    for (const { pc } of this.pending.values()) pc.close();
    for (const ch of this.peers.values()) ch.close();
    this.pending.clear(); this.peers.clear(); this.role = null; this.setIp(HOST_IP); this.changed();
  }
}
