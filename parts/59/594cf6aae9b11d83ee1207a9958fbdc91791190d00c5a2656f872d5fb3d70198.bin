// GMod's HTML layer (html_chromium.dll), implemented by the host.
//
// The engine loads html_chromium.dll, reads g_pHtmlSystem and drives:
//   IHtmlSystem (7):  0 Init(a, b)  1 Shutdown()  2 CreateClient(IHtmlClientListener*)  3 Think()
//                     4 array(out, items, n)  5 string(out, chars, len)  6 object (results returned to JS callbacks)
//   IHtmlClient (19): 0 Destroy  1 Resize(w, h)  2 SetFocus(bool)  3 KeyEvent(KeyEvent)  4 MouseMove(MouseEvent, bool)
//                     5 MouseWheel(MouseEvent, dx, dy)  6 MouseButton(MouseEvent, button, up, clicks)  7 OpenURL(url)
//                     8 SetHTML(html)  9 Refresh  10 StopLoading  11 GoBack  12 GoForward  13 RunJavascript(js)
//                     14 AddFunction(object, name)  15 SetOpenLinksExternally(bool)  16 LockImageData() -> bool
//                     17 UnlockImageData()  18 GetImageData(int* w, int* h) -> BGRA pixels
//   IHtmlClientListener (10, implemented by the engine's HtmlPanel at panel + 0x1bc):
//                     0 OnChangeAddressBar(url)  1 ConsoleMessage(msg, source, line, severity)  2 OnChangeTitle(title)
//                     3 OnChangeTargetURL(url)  4 (unused here)  5 OnBeginLoadingDocument(url)  6 OnFinishLoadingDocument(url)
//                     7 OnDocumentReady(url)  8 OnChildViewCreated(src, target, popup)  9 OnJavaScriptCall(&ret, obj, fn, args)
// Argument counts were read from html_stub.dll; meanings from the engine's HtmlPanel (menusystem.dll).
//
// Pages are real documents shown by the page host (an <iframe> per client). The pixel buffer handed to the engine is
// transparent except for a marker in its first pixel, so the renderer can tell where the engine draws each panel and
// the page host can place the iframe there. `transport` carries messages: send(msg) to the page host, poll() for
// events back. Without a transport (the Node host) the panels stay blank.

import { env as ENV } from './platform.mjs';

const SYSTEM_ARGS = [2, 0, 1, 0, 3, 3, 5];
const CLIENT_ARGS = [0, 2, 1, 4, 4, 5, 6, 1, 1, 0, 0, 0, 0, 1, 2, 1, 0, 0, 2];
export const HTML_MARKER = [0x47, 0x4d, 0x48];          // B, G, R of pixel 0; alpha 0; the panel id is in pixel 1

const L = { ADDRESS: 0, CONSOLE: 1, TITLE: 2, TARGET_URL: 3, BEGIN: 5, FINISH: 6, READY: 7, CHILD_VIEW: 8, JS_CALL: 9 };
const JS = { UNDEFINED: 0, BOOL: 1, NUMBER: 2, ARRAY: 3, STRING: 4, OBJECT: 5 };

const printable = (g, p) => {
  if (p < 0x10000 || p >= g.u8.length - 64) return null;
  let s = '';
  for (let i = 0; i < 160; i++) { const c = g.u8[p + i]; if (!c) break; if (c < 32 || c > 126) return null; s += String.fromCharCode(c); }
  return s.length >= 2 ? s : null;
};

export function createHtmlHost(g, dll) {
  const trace = !!ENV.HTML_TRACE;
  const log = (s) => { if (trace) g.log(`[html] ${s}`); };
  const transport = g.htmlTransport ?? null;
  const clients = new Map();          // guest client object -> state
  let nextId = 1;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const readUtf8 = (p) => { if (!p) return ''; let e = p; while (g.u8[e]) e++; return dec.decode(g.u8.slice(p, e)); };
  const send = (msg) => transport?.send(msg);

  const makeVtable = (name, argCounts, handlers) => {
    const vt = g.alloc(4 * argCounts.length);
    argCounts.forEach((n, i) => {
      const thunk = g.extraThunk(dll, `html:${name}#${i}`, function (...args) {
        const self = this.ecx >>> 0;
        if (trace && !(name === 'system' && i === 3) && !(name === 'client' && i >= 16)) log(`${name}#${i}(${args.map((a) => { const s = printable(g, a >>> 0); return s ? `"${s}"` : '0x' + (a >>> 0).toString(16); }).join(', ')})`);
        const h = handlers[i];
        return h ? h.call(this, self, ...args) : 0;
      }, 4 * n, false, n);
      g.u32(vt + 4 * i, thunk);
    });
    return vt;
  };

  // JSValues handed to the engine: { type @0, payload @8 }. Strings and arrays are objects whose slot 0 copies them
  // and slot 1 returns their data (const char* or const JSValue*), writing the length/count through its argument.
  // Slot 0 is the copy used when the engine copies a JSValue; the data never changes, so copies share the object.
  // Data object: { vtable, data, length/count, refs, isArray }. Slot 0 is the deleting destructor (one flag
  // argument) and slot 2 the clone the engine's JSValue copy constructor uses; clones share the object by count.
  const release = (obj) => {
    const refs = g.u32(obj + 12) - 1;
    if (refs > 0) { g.u32(obj + 12, refs); return; }
    const data = g.u32(obj + 4);
    if (g.u32(obj + 16)) for (let k = 0; k < g.u32(obj + 8); k++) releaseValue(data + 16 * k);
    if (data) g.free(data);
    g.free(obj);
  };
  const releaseValue = (p) => { const t = g.u32(p); if ((t === JS.STRING || t === JS.ARRAY) && g.u32(p + 8) && g.u32(g.u32(p + 8)) === dataObjVt) release(g.u32(p + 8)); };
  const dataObjVt = makeVtable('jsdata', [1, 1, 0, 0], {
    0: (self) => { release(self); return self; },
    2: (self) => { g.u32(self + 12, g.u32(self + 12) + 1); return self; },
    1: (self, countOut) => { if (countOut) g.u32(countOut, g.u32(self + 8)); return g.u32(self + 4); },
  });
  const jsValue = (v, out = g.alloc(16)) => {
    g.u8.fill(0, out, out + 16);
    if (v === null || v === undefined) g.u32(out, JS.UNDEFINED);
    else if (typeof v === 'boolean') { g.u32(out, JS.BOOL); g.u8[out + 8] = v ? 1 : 0; }
    else if (typeof v === 'number') { g.u32(out, JS.NUMBER); g.dv.setFloat64(out + 8, v, true); }
    else if (Array.isArray(v)) {
      const items = g.alloc(Math.max(16, 16 * v.length));
      v.forEach((x, k) => jsValue(x, items + 16 * k));
      const obj = g.alloc(20); g.u32(obj, dataObjVt); g.u32(obj + 4, items); g.u32(obj + 8, v.length); g.u32(obj + 12, 1); g.u32(obj + 16, 1);
      g.u32(out, JS.ARRAY); g.u32(out + 8, obj);
    } else if (typeof v === 'object') {
      // Objects reach Lua as strings of JSON; the menu's callbacks only pass primitives and arrays.
      return jsValue(JSON.stringify(v), out);
    } else {
      const bytes = enc.encode(String(v)), p = g.alloc(bytes.length + 1);
      g.u8.set(bytes, p); g.u8[p + bytes.length] = 0;
      const obj = g.alloc(20); g.u32(obj, dataObjVt); g.u32(obj + 4, p); g.u32(obj + 8, bytes.length); g.u32(obj + 12, 1);
      g.u32(out, JS.STRING); g.u32(out + 8, obj); g.u32(out + 12, bytes.length);
    }
    return out;
  };

  // A JSValue back to JS. Strings and arrays built by us (slots 4/5) carry our data object.
  const readJsValue = (p) => {
    switch (g.u32(p)) {
      case JS.BOOL: return !!g.u8[p + 8];
      case JS.NUMBER: return g.dv.getFloat64(p + 8, true);
      case JS.STRING: case JS.ARRAY: {
        // Ours or the engine's: either way the object's slot 1 returns the data and writes the length/count.
        const obj = g.u32(p + 8);
        if (!obj) return null;
        let data, n;
        if (g.u32(obj) === dataObjVt) { data = g.u32(obj + 4); n = g.u32(obj + 8); }
        else {
          const countOut = g.alloc(4);
          try { data = g.call(dll, g.u32(g.u32(obj) + 4), [countOut], { thiscall: obj }) >>> 0; n = g.u32(countOut); }
          catch (e) { g.log(`[html] JSValue object 0x${obj.toString(16)}: ${e.message}`); return null; }
          finally { g.free(countOut); }
        }
        if (g.u32(p) === JS.STRING) return dec.decode(g.u8.slice(data, data + n));
        return [...Array(n)].map((_, k) => readJsValue(data + 16 * k));
      }
      default: return null;
    }
  };

  // Calls a listener method in guest code.
  const listen = (c, slot, args) => {
    const vt = g.u32(c.listener), fn = g.u32(vt + 4 * slot);
    try { return g.call(dll, fn, args, { thiscall: c.listener }); }
    catch (e) { g.log(`[html] listener slot ${slot} failed: ${e.message}`); return 0; }
  };
  const cstr = (s) => { const b = enc.encode(s ?? ''), p = g.alloc(b.length + 1); g.u8.set(b, p); g.u8[p + b.length] = 0; return p; };
  const withStrings = (strings, fn) => { const ptrs = strings.map(cstr); try { return fn(ptrs); } finally { for (const p of ptrs) g.free(p); } };

  const deliver = (ev) => {
    const c = [...clients.values()].find((x) => x.id === ev.id);
    if (!c) return;
    switch (ev.type) {
      case 'begin': withStrings([ev.url], ([u]) => { listen(c, L.ADDRESS, [u]); listen(c, L.BEGIN, [u]); }); break;
      case 'ready': withStrings([ev.url], ([u]) => listen(c, L.READY, [u])); break;
      case 'finish': withStrings([ev.url], ([u]) => listen(c, L.FINISH, [u])); break;
      case 'title': withStrings([ev.title], ([t]) => listen(c, L.TITLE, [t])); break;
      case 'target': withStrings([ev.url], ([u]) => listen(c, L.TARGET_URL, [u])); break;
      case 'console': withStrings([ev.message, ev.source ?? ''], ([m, s]) => listen(c, L.CONSOLE, [m, s, ev.line | 0, ev.level | 0])); break;
      case 'popup': withStrings([ev.source ?? '', ev.url], ([s, u]) => listen(c, L.CHILD_VIEW, [s, u, ev.popup ? 1 : 0])); break;
      case 'call': {
        const ret = g.alloc(16), args = jsValue(ev.args ?? []);
        withStrings([ev.object, ev.name], ([o, n]) => listen(c, L.JS_CALL, [ret, o, n, args]));
        const value = readJsValue(ret);
        log(`${ev.object}.${ev.name}(${JSON.stringify(ev.args).slice(0, 80)}) -> ${JSON.stringify(value)?.slice(0, 120)}`);
        if (ev.call) send({ type: 'return', id: c.id, call: ev.call, value });
        releaseValue(ret); releaseValue(args);
        g.free(ret); g.free(args);
        break;
      }
      default: break;
    }
  };

  const markBuffer = (c) => {
    const size = Math.max(1, c.w) * Math.max(1, c.h) * 4;
    if (c.buf) g.free(c.buf);
    c.buf = g.alloc(size);
    g.u8.fill(0, c.buf, c.buf + size);
    g.u8[c.buf] = HTML_MARKER[0]; g.u8[c.buf + 1] = HTML_MARKER[1]; g.u8[c.buf + 2] = HTML_MARKER[2]; g.u8[c.buf + 3] = 0;
    if (size >= 8) { g.u8[c.buf + 4] = c.id & 255; g.u8[c.buf + 5] = (c.id >> 8) & 255; g.u8[c.buf + 6] = 0; g.u8[c.buf + 7] = 0; }
    c.dirty = true;
  };

  const clientVt = makeVtable('client', CLIENT_ARGS, {
    0: (self) => { const c = clients.get(self); if (c) { send({ type: 'destroy', id: c.id }); clients.delete(self); } return 0; },
    1: (self, w, h) => { const c = clients.get(self); if (!c) return 0; c.w = w | 0; c.h = h | 0; markBuffer(c); send({ type: 'resize', id: c.id, w: c.w, h: c.h }); return 0; },
    2: (self, focus) => { const c = clients.get(self); if (c) send({ type: 'focus', id: c.id, focus: !!(focus & 255) }); return 0; },
    7: (self, url) => { const c = clients.get(self); if (c) { c.url = readUtf8(url); send({ type: 'open', id: c.id, url: c.url }); } return 0; },
    8: (self, html) => { const c = clients.get(self); if (c) send({ type: 'html', id: c.id, html: readUtf8(html) }); return 0; },
    9: (self) => { const c = clients.get(self); if (c) send({ type: 'refresh', id: c.id }); return 0; },
    10: (self) => { const c = clients.get(self); if (c) send({ type: 'stop', id: c.id }); return 0; },
    11: (self) => { const c = clients.get(self); if (c) send({ type: 'back', id: c.id }); return 0; },
    12: (self) => { const c = clients.get(self); if (c) send({ type: 'forward', id: c.id }); return 0; },
    13: (self, js) => { const c = clients.get(self); if (c) send({ type: 'js', id: c.id, code: readUtf8(js) }); return 0; },
    14: (self, obj, name) => { const c = clients.get(self); if (c) { const f = [readUtf8(obj), readUtf8(name)]; c.functions.push(f); send({ type: 'function', id: c.id, object: f[0], name: f[1] }); } return 0; },
    15: (self, external) => { const c = clients.get(self); if (c) send({ type: 'external-links', id: c.id, value: !!(external & 255) }); return 0; },
    16: (self) => { const c = clients.get(self); return c?.dirty && c.buf ? 1 : 0; },
    17: (self) => { const c = clients.get(self); if (c) c.dirty = false; return 0; },
    18: (self, wOut, hOut) => {
      const c = clients.get(self);
      if (!c?.buf) { if (wOut) g.u32(wOut, 0); if (hOut) g.u32(hOut, 0); return 0; }
      if (wOut) g.u32(wOut, c.w); if (hOut) g.u32(hOut, c.h);
      if (!c.fetched) { c.fetched = true; g.log(`[html] panel ${c.id} image fetched by the engine (${c.w}x${c.h})`); }
      return c.buf;
    },
  });

  const systemVt = makeVtable('system', SYSTEM_ARGS, {
    0: () => 1,
    2: (self, listener) => {
      const obj = g.alloc(16); g.u32(obj, clientVt);
      const c = { id: nextId++, obj, listener: listener >>> 0, w: 0, h: 0, buf: 0, dirty: false, functions: [], url: '' };
      clients.set(obj, c);
      send({ type: 'create', id: c.id });
      return obj;
    },
    3: () => { if (transport) for (const ev of transport.poll()) deliver(ev); return 0; },
    // Result builders: 4 array(out, items, count), 5 string(out, chars, length) (from probing the engine's calls).
    4: (self, out, items, count) => { if (out) jsValue([...Array(count >>> 0)].map((_, k) => readJsValue(items + 16 * k)), out); return out; },
    5: (self, out, chars, len) => { if (out) jsValue(dec.decode(g.u8.slice(chars, chars + (len >>> 0))), out); return out; },
    // 6 builds an object (out, keys, values, count, ?); the menu never returns objects, so they arrive as undefined.
    6: (self, out) => { if (out >>> 0 > 0x10000) g.u8.fill(0, out, out + 16); return out; },
  });
  const system = g.alloc(16);
  g.u32(system, systemVt);
  const cell = g.alloc(4);
  g.u32(cell, system);
  return { system, cell, clients };
}
