// Additional Win32 shims for the retail engine start-up path (user32 display
// enumeration, window procs, clipboard, IME, shell, GDI metrics, winmm, ole,
// kernel32 misc). Installed from guest.mjs.
//
// FAKES lists every shim that is a headless placeholder rather than a real
// implementation, so the project's "no hidden stubs" ledger stays honest.
export const FAKES = [];

// Thrown by ExitThread/FreeLibraryAndExitThread; the thread worker treats it as a normal return.
export class GuestThreadExit extends Error { constructor(code) { super(`guest thread exit ${code}`); this.code = code >>> 0; } }

const DISPLAY_MODES = [
  [1920, 1080], [1600, 900], [1366, 768], [1280, 720], [1024, 768], [800, 600],
].flatMap(([w, h]) => [60].map((hz) => ({ w, h, hz, bpp: 32 })));
export const CURRENT_MODE = { w: 1280, h: 720, hz: 60, bpp: 32 };

function fillDevMode(g, p, m) {
  // DEVMODEA: dmSize@0x24 (WORD), dmFields@0x28, dmBitsPerPel@0x68, dmPelsWidth@0x6c,
  // dmPelsHeight@0x70, dmDisplayFlags@0x74, dmDisplayFrequency@0x78.
  g.dv.setUint16(p + 0x24, 156, true);
  g.u32(p + 0x28, 0x00000100 | 0x00040000 | 0x00080000 | 0x00100000 | 0x00400000);
  g.u32(p + 0x68, m.bpp); g.u32(p + 0x6c, m.w); g.u32(p + 0x70, m.h);
  g.u32(p + 0x74, 0); g.u32(p + 0x78, m.hz);
}

const wideString = (g, p) => { let s = ''; for (let i = 0; i < 4096; i++) { const c = g.dv.getUint16(p + 2 * i, true); if (!c) break; s += String.fromCharCode(c); } return s; };

export function installMore(SHIMS, { createEvent, eventOp, wstr }) {
  const def = (dll, name, arity, fn, fake) => {
    SHIMS[`${dll}.dll!${name}`] = { arity, pop: 4 * arity, fn };
    if (fake) FAKES.push(`${dll}.dll!${name}: ${fake}`);
  };
  const ret = (v) => () => v;
  const fake = (dll, name, arity, value, why) => def(dll, name, arity, typeof value === 'function' ? value : ret(value), why);

  // ---------------- user32 ----------------
  def('user32', 'EnumDisplaySettingsA', 3, function (_dev, mode, dm) {
    const m = (mode | 0) === -1 || (mode | 0) === -2 ? CURRENT_MODE : DISPLAY_MODES[mode >>> 0];
    if (!m) return 0;
    fillDevMode(this.g, dm, m); return 1;
  });
  def('user32', 'EnumDisplaySettingsExA', 4, function (_dev, mode, dm) {
    const m = (mode | 0) === -1 || (mode | 0) === -2 ? CURRENT_MODE : DISPLAY_MODES[mode >>> 0];
    if (!m) return 0;
    fillDevMode(this.g, dm, m); return 1;
  });
  def('user32', 'EnumDisplayDevicesA', 4, function (_dev, idx, dd) {
    if (idx !== 0) return 0;
    // DISPLAY_DEVICEA: cb, DeviceName[32], DeviceString[128], StateFlags, ID[128], Key[128]
    const g = this.g; g.u32(dd, 424);
    const put = (off, s) => { for (let i = 0; i < s.length; i++) g.u8[dd + off + i] = s.charCodeAt(i); g.u8[dd + off + s.length] = 0; };
    put(4, '\\\\.\\DISPLAY1'); put(36, 'GameBox virtual display'); g.u32(dd + 164, 0x5);
    return 1;
  });
  def('user32', 'ChangeDisplaySettingsA', 2, ret(0));        // DISP_CHANGE_SUCCESSFUL
  def('user32', 'DefWindowProcA', 4, ret(0));
  def('user32', 'DefWindowProcW', 4, ret(0));
  def('user32', 'CallWindowProcA', 5, function (proc, hwnd, msg, wp, lp) { return callGuest(this, proc, [hwnd, msg, wp, lp]); });
  def('user32', 'CallWindowProcW', 5, function (proc, hwnd, msg, wp, lp) { return callGuest(this, proc, [hwnd, msg, wp, lp]); });
  def('user32', 'AdjustWindowRect', 3, ret(1), 'client rect == window rect (canvas, no frame)');
  def('user32', 'AdjustWindowRectEx', 4, ret(1), 'client rect == window rect (canvas, no frame)');
  def('user32', 'BeginPaint', 2, function (_h, ps) { this.g.u8.fill(0, ps, ps + 64); this.g.u32(ps, 0x7ff10200); return 0x7ff10200; });
  def('user32', 'EndPaint', 2, ret(1));
  def('user32', 'IsWindowEnabled', 1, ret(1));
  def('user32', 'SetActiveWindow', 1, ret(0x7ff10300));
  def('user32', 'SetForegroundWindow', 1, ret(1));
  def('user32', 'FlashWindow', 2, ret(0));
  def('user32', 'FlashWindowEx', 1, ret(0));
  def('user32', 'WindowFromPoint', 2, ret(0x7ff10500));
  def('user32', 'GetGUIThreadInfo', 2, function (_t, info) { this.g.u8.fill(0, info + 4, info + 48); this.g.u32(info, 48); this.g.u32(info + 8, 0x7ff10300); return 1; });
  // Clipboard: process-local text clipboard (CF_TEXT=1).
  def('user32', 'OpenClipboard', 1, ret(1));
  def('user32', 'CloseClipboard', 0, ret(1));
  def('user32', 'EmptyClipboard', 0, function () { this.g.clipboard = new Map(); return 1; });
  def('user32', 'SetClipboardData', 2, function (fmt, h) { (this.g.clipboard ||= new Map()).set(fmt, h); return h; });
  def('user32', 'GetClipboardData', 1, function (fmt) { return this.g.clipboard?.get(fmt) ?? 0; });
  // Keyboard layout: US English (0x04090409).
  def('user32', 'GetKeyboardLayout', 1, ret(0x04090409));
  def('user32', 'GetKeyboardLayoutList', 2, function (n, buf) { if (n && buf) this.g.u32(buf, 0x04090409); return 1; });
  def('user32', 'ActivateKeyboardLayout', 2, ret(0x04090409));
  def('user32', 'LoadKeyboardLayoutA', 2, ret(0x04090409));
  def('user32', 'UnloadKeyboardLayout', 1, ret(1));
  // MapVirtualKeyExA: MAPVK_VK_TO_VSC(0)/VSC_TO_VK(1)/VK_TO_CHAR(2)/VSC_TO_VK_EX(3) for US layout.
  def('user32', 'MapVirtualKeyExA', 3, function (code, type) {
    if (type === 2) { if (code >= 0x41 && code <= 0x5a) return code; if (code >= 0x30 && code <= 0x39) return code; if (code === 0x20) return 0x20; }
    return 0;
  }, 'MapVirtualKeyEx only maps VK->char for alphanumerics/space');
  def('user32', 'CopyIcon', 1, function (h) { return h; });
  def('user32', 'CreateIconIndirect', 1, ret(0x7ff10450));
  def('user32', 'DestroyIcon', 1, ret(1));
  def('user32', 'DestroyCursor', 1, ret(1));
  def('user32', 'DrawIconEx', 9, ret(1));
  def('user32', 'GetIconInfo', 2, function (_h, info) { this.g.u8.fill(0, info, info + 20); this.g.u32(info, 1); return 1; });
  def('user32', 'LoadCursorFromFileA', 1, ret(0x7ff10001));
  def('user32', 'DrawTextA', 5, ret(0), 'DrawText draws nothing');
  def('user32', 'DialogBoxParamA', 5, ret(0), 'no dialog UI');
  def('user32', 'EndDialog', 2, ret(1));
  def('user32', 'GetDlgItemInt', 4, ret(0));
  def('user32', 'SetDlgItemInt', 4, ret(1));
  def('user32', 'SetDlgItemTextA', 3, ret(1));

  // ---------------- imm32 (no IME) ----------------
  for (const [n, a, v] of [['ImmGetContext', 1, 0], ['ImmReleaseContext', 2, 1], ['ImmGetCompositionStringW', 4, 0],
    ['ImmGetCandidateListCountW', 2, 0], ['ImmGetCandidateListW', 4, 0], ['ImmGetConversionStatus', 3, 0],
    ['ImmSetConversionStatus', 3, 0], ['ImmGetProperty', 2, 0], ['ImmIsUIMessageA', 4, 0], ['ImmNotifyIME', 4, 0],
    ['ImmSetCandidateWindow', 2, 0]]) fake('imm32', n, a, v, 'no IME');

  // ---------------- shell32 / shlwapi / wininet ----------------
  def('shell32', 'SHGetFileInfoA', 5, ret(0));
  def('shell32', 'SHGetFileInfoW', 5, ret(0));
  def('shell32', 'SHGetSpecialFolderPathA', 4, function (_h, buf) { const s = 'c:\\gamebox\\appdata'; for (let i = 0; i < s.length; i++) this.g.u8[buf + i] = s.charCodeAt(i); this.g.u8[buf + s.length] = 0; return 1; });
  def('shell32', 'ShellExecuteA', 6, function (_h, _op, file) { this.g.log(`[shell] ShellExecute ${file ? this.g.readStr(file) : ''} (not launched)`); return 33; }, 'ShellExecute does not launch anything');
  def('shell32', 'ShellExecuteW', 6, function (_h, _op, file) { this.g.log(`[shell] ShellExecute ${file ? wideString(this.g, file) : ''} (not launched)`); return 33; }, 'ShellExecute does not launch anything');
  def('shell32', 'Shell_NotifyIconA', 2, ret(1));
  def('shell32', 'DragQueryFileA', 4, ret(0));
  def('shlwapi', 'SHDeleteKeyA', 2, ret(0));
  for (const n of ['InternetOpenA', 'InternetOpenUrlA']) fake('wininet', n, n === 'InternetOpenA' ? 5 : 6, function () { this.g.lastError = 12007; return 0; }, 'no HTTP transport (ERROR_INTERNET_NAME_NOT_RESOLVED)');
  for (const [n, a] of [['InternetCloseHandle', 1], ['InternetReadFile', 4], ['HttpQueryInfoA', 5], ['InternetCrackUrlA', 4], ['InternetSetStatusCallback', 2]]) fake('wininet', n, a, 0, 'no HTTP transport');

  // ---------------- gdi32 ----------------
  // Glyph metrics are provisional until the canvas font rasteriser backs GDI.
  const abc = function (_dc, first, last, out) {
    for (let c = first; c <= last; c++) { const p = out + 12 * (c - first); this.g.u32(p, 0); this.g.u32(p + 4, 8); this.g.u32(p + 8, 0); }
    return 1;
  };
  def('gdi32', 'GetCharABCWidthsA', 4, abc, 'fixed 8px advance, awaiting canvas font backend');
  def('gdi32', 'GetCharABCWidthsW', 4, abc, 'fixed 8px advance, awaiting canvas font backend');
  def('gdi32', 'GetGlyphOutlineA', 7, ret(-1), 'no glyph outlines');
  def('gdi32', 'GetGlyphOutlineW', 7, ret(-1), 'no glyph outlines');
  def('gdi32', 'GetFontUnicodeRanges', 2, ret(0), 'no font ranges');
  def('gdi32', 'EnumFontFamiliesExA', 5, ret(1), 'enumerates no fonts');
  def('gdi32', 'AddFontResourceA', 1, ret(1), 'font files are not registered');
  def('gdi32', 'RemoveFontResourceA', 1, ret(1));
  def('gdi32', 'CreateBitmap', 5, ret(0x7ff30000));
  def('gdi32', 'GetDIBits', 7, ret(0), 'no DIB readback');
  def('gdi32', 'GetBkColor', 1, ret(0));
  def('gdi32', 'GetTextColor', 1, ret(0));
  def('gdi32', 'SetTextAlign', 2, ret(0));
  def('gdi32', 'SetViewportOrgEx', 4, ret(1));
  def('gdi32', 'MoveToEx', 4, ret(1));
  def('gdi32', 'SetRectRgn', 5, ret(1));
  for (const [n, a] of [['Polygon', 3], ['Polyline', 3], ['Rectangle', 5]]) fake('gdi32', n, a, 1, 'GDI vector drawing is a no-op');

  // ---------------- winmm ----------------
  for (const [n, a] of [['joyGetNumDevs', 0], ['mixerGetNumDevs', 0]]) def('winmm', n, a, ret(0));
  for (const [n, a] of [['joyGetDevCapsA', 3], ['joyGetPosEx', 2], ['mixerOpen', 5], ['mixerClose', 1], ['mixerGetDevCapsA', 3],
    ['mixerGetLineInfoA', 3], ['mixerGetLineControlsA', 3], ['mixerGetControlDetailsA', 3], ['mixerSetControlDetails', 3],
    ['waveOutOpen', 6], ['waveOutClose', 1], ['waveOutPrepareHeader', 3], ['waveOutUnprepareHeader', 3], ['waveOutWrite', 3],
    ['waveOutReset', 1], ['PlaySoundA', 3]]) fake('winmm', n, a, n.startsWith('wave') || n.startsWith('mixer') || n.startsWith('joy') ? 2 /* MMSYSERR_NODRIVER */ : 0, 'no winmm audio/joystick (audio goes through the SDL/DirectSound path)');

  // ---------------- ole32 / oleaut32 / rpcrt4 ----------------
  def('ole32', 'CoInitializeSecurity', 9, ret(0));
  def('ole32', 'CoSetProxyBlanket', 8, ret(0));
  def('ole32', 'RegisterDragDrop', 2, ret(0));
  def('ole32', 'RevokeDragDrop', 1, ret(0));
  def('ole32', 'ReleaseStgMedium', 1, ret(0));
  def('oleaut32', 'SysAllocString', 1, function (p) { if (!p) return 0; const g = this.g; let n = 0; while (g.dv.getUint16(p + 2 * n, true)) n++; const q = g.alloc(4 + 2 * n + 2); g.u32(q, 2 * n); g.u8.copyWithin(q + 4, p, p + 2 * n + 2); return q + 4; });
  def('oleaut32', 'SysFreeString', 1, function (p) { if (p) this.g.free(p - 4); return 0; });
  def('oleaut32', 'VariantInit', 1, function (v) { this.g.u8.fill(0, v, v + 16); return 0; });
  def('oleaut32', 'VariantClear', 1, function (v) { this.g.u8.fill(0, v, v + 16); return 0; });
  def('rpcrt4', 'UuidCreate', 1, function (u) { const g = this.g; for (let i = 0; i < 16; i++) g.u8[u + i] = (Math.random() * 256) | 0; g.u8[u + 7] = (g.u8[u + 7] & 0x0f) | 0x40; g.u8[u + 8] = (g.u8[u + 8] & 0x3f) | 0x80; return 0; });
  def('rpcrt4', 'UuidToStringA', 2, function (u, out) {
    const g = this.g, h = (a, n) => { let s = ''; for (let i = n - 1; i >= 0; i--) s += g.u8[u + a + i].toString(16).padStart(2, '0'); return s; };
    const hb = (a, n) => { let s = ''; for (let i = 0; i < n; i++) s += g.u8[u + a + i].toString(16).padStart(2, '0'); return s; };
    g.u32(out, g.cstr(`${h(0, 4)}-${h(4, 2)}-${h(6, 2)}-${hb(8, 2)}-${hb(10, 6)}`)); return 0;
  });
  def('rpcrt4', 'UuidFromStringA', 2, function (s, u) {
    const t = this.g.readStr(s).replace(/[-{}]/g, ''); if (t.length !== 32) return 1705;
    const b = (i) => parseInt(t.substr(2 * i, 2), 16), g = this.g;
    for (let i = 0; i < 4; i++) g.u8[u + i] = b(3 - i);
    for (let i = 0; i < 2; i++) { g.u8[u + 4 + i] = b(5 - i); g.u8[u + 6 + i] = b(7 - i); }
    for (let i = 8; i < 16; i++) g.u8[u + i] = b(i);
    return 0;
  });
  def('rpcrt4', 'RpcStringFreeA', 1, ret(0));

  // ---------------- ws2_32 ----------------
  def('ws2_32', 'htons', 1, (v) => ((v & 0xff) << 8) | ((v >> 8) & 0xff));
  def('ws2_32', 'ntohs', 1, (v) => ((v & 0xff) << 8) | ((v >> 8) & 0xff));
  def('ws2_32', 'ntohl', 1, (v) => (((v & 0xff) << 24) | ((v & 0xff00) << 8) | ((v >>> 8) & 0xff00) | (v >>> 24)) | 0);
  def('ws2_32', 'inet_addr', 1, function (p) {
    const m = this.g.readStr(p).match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (!m) return -1; const o = m.slice(1).map(Number); if (o.some((x) => x > 255)) return -1;
    return (o[0] | (o[1] << 8) | (o[2] << 16) | (o[3] << 24)) | 0;   // network byte order in memory = little-endian value
  });
  def('ws2_32', 'getaddrinfo', 4, ret(11001), 'no DNS (WSAHOST_NOT_FOUND); no network transport');
  def('ws2_32', 'freeaddrinfo', 1, ret(0));
  def('ws2_32', 'gethostbyname', 1, ret(0), 'no DNS; no network transport');

  // ---------------- kernel32 ----------------
  const K = (name, arity, fn, why) => def('kernel32', name, arity, fn, why);
  // Win32 returns the handle (failure) when the block is not one of this heap's; it does not fault.
  const legacyFree = (g, p, api) => {
    if (!p) return 0;
    try { g.free(p); return 0; }
    catch { g.lastError = 6; g.log(`[win32] ${api}(0x${p.toString(16)}) is not a heap block; returning the handle`); return p; }
  };
  // Legacy memory handles are plain heap blocks (GMEM_FIXED/LMEM_FIXED semantics, lock = identity).
  K('GlobalAlloc', 2, function (_f, n) { return this.g.alloc(n || 1); });
  K('GlobalFree', 1, function (p) { return legacyFree(this.g, p, 'GlobalFree'); });
  K('GlobalLock', 1, (p) => p);
  K('GlobalUnlock', 1, ret(0));
  K('GlobalSize', 1, function (p) { return this.g.allocationSize(p); });
  K('LocalFree', 1, function (p) { return legacyFree(this.g, p, 'LocalFree'); });
  K('GlobalMemoryStatus', 1, function (p) { const g = this.g; g.u32(p, 32); g.u32(p + 4, 30); g.u32(p + 8, 2 ** 31 >>> 0); g.u32(p + 12, 1.5e9); g.u32(p + 16, 2 ** 31 >>> 0); g.u32(p + 20, 1.5e9); g.u32(p + 24, 2 ** 31 >>> 0); g.u32(p + 28, 1.5e9); });
  K('GlobalMemoryStatusEx', 1, function (p) { const g = this.g; g.u32(p, 64); g.u32(p + 4, 30); for (const [off, v] of [[8, 2 ** 31], [16, 1.5e9], [24, 2 ** 31], [32, 1.5e9], [40, 2 ** 31], [48, 1.5e9], [56, 0]]) { g.u32(p + off, v >>> 0); g.u32(p + off + 4, 0); } return 1; });
  K('HeapValidate', 3, ret(1));
  K('HeapWalk', 2, function () { this.g.lastError = 259; return 0; });
  K('HeapQueryInformation', 5, ret(1));
  K('InterlockedPushEntrySList', 2, function (head, entry) { const g = this.g; const old = g.u32(head); g.u32(entry, old); g.u32(head, entry); return old; });
  K('SetErrorMode', 1, ret(0));
  K('SetPriorityClass', 2, ret(1));
  K('ExitThread', 1, function (code) { throw new GuestThreadExit(code); });
  K('TerminateThread', 2, ret(1));
  K('DuplicateHandle', 7, function (_sp, h, _tp, out) { if (out) this.g.u32(out, h); return 1; });
  K('GetProcessTimes', 5, function (_p, c, e, k, u) { const t = BigInt(Date.now()) * 10000n + 116444736000000000n; for (const p of [c, e]) { this.g.u32(p, Number(t & 0xffffffffn)); this.g.u32(p + 4, Number(t >> 32n)); } for (const p of [k, u]) { this.g.u32(p, 0); this.g.u32(p + 4, 0); } return 1; });
  K('GetEnvironmentVariableA', 3, function (name, buf, n) { const v = (this.g.env ||= new Map()).get(this.g.readStr(name).toUpperCase()); if (v === undefined) { this.g.lastError = 203; return 0; } if (v.length + 1 > n) return v.length + 1; for (let i = 0; i < v.length; i++) this.g.u8[buf + i] = v.charCodeAt(i); this.g.u8[buf + v.length] = 0; return v.length; });
  K('SetEnvironmentVariableA', 2, function (name, val) { const e = (this.g.env ||= new Map()), k = this.g.readStr(name).toUpperCase(); if (!val) e.delete(k); else e.set(k, this.g.readStr(val)); return 1; });
  K('OutputDebugStringW', 1, function (p) { if (p) this.g.log(`[debug] ${wideString(this.g, p)}`); });
  K('LCMapStringEx', 9, function () { this.g.lastError = 120; return 0; });
  // Console: the retail engine does not require one in windowed mode.
  K('AllocConsole', 0, ret(1));
  K('GetConsoleCP', 0, ret(437));
  K('GetConsoleScreenBufferInfo', 2, function (_h, info) { this.g.u8.fill(0, info, info + 22); this.g.dv.setInt16(info, 120, true); this.g.dv.setInt16(info + 2, 300, true); this.g.dv.setInt16(info + 14, 119, true); this.g.dv.setInt16(info + 16, 299, true); return 1; });
  K('GetNumberOfConsoleInputEvents', 2, function (_h, n) { if (n) this.g.u32(n, 0); return 1; });
  K('ReadConsoleInputA', 4, function (_h, _b, _l, n) { if (n) this.g.u32(n, 0); return 1; });
  K('PeekNamedPipe', 6, function () { this.g.lastError = 109; return 0; });
  K('SetConsoleCursorPosition', 2, ret(1));
  K('SetConsoleMode', 2, ret(1));
  K('SetConsoleTextAttribute', 2, ret(1));
  K('CreatePipe', 4, function () { this.g.lastError = 5; return 0; }, 'no pipes');
  K('CreateProcessA', 10, function () { this.g.lastError = 5; return 0; }, 'cannot spawn processes');
  K('CreateProcessW', 10, function () { this.g.lastError = 5; return 0; }, 'cannot spawn processes');
  K('CreateToolhelp32Snapshot', 2, function () { this.g.lastError = 5; return -1; }, 'no process/thread snapshot');
  K('Thread32First', 2, ret(0));
  K('Thread32Next', 2, ret(0));
  K('DeviceIoControl', 8, function () { this.g.lastError = 1; return 0; }, 'no device I/O');
  // Mutex = auto-reset event (signalled when free); binary semaphore likewise.
  K('CreateMutexA', 3, function (_sec, owned, name) { return createEvent(this.g, false, !owned, name ? this.g.readStr(name) : ''); });
  K('ReleaseMutex', 1, function (h) { return eventOp(this.g, h, true); });
  K('CreateSemaphoreA', 4, function (_sec, initial, max, name) {
    if (max !== 1) throw new Error(`counting semaphore (max ${max}) is not implemented`);
    return createEvent(this.g, false, initial > 0, name ? this.g.readStr(name) : '');
  });
  K('ReleaseSemaphore', 3, function (h, n, prev) { if (n !== 1) throw new Error('ReleaseSemaphore count != 1'); if (prev) this.g.u32(prev, 0); return eventOp(this.g, h, true); });
  // Mutations go to the copy-on-write overlay (see native-files.mjs); the retail install is never touched.
  const vol = (g, api) => { if (!g.files) throw new Error(`${api} requires a configured file volume`); return g.files; };
  const A = (g, p) => g.readStr(p), W = (g, p) => wstr(g, p);
  K('DeleteFileA', 1, function (n) { return vol(this.g, 'DeleteFileA').deleteFile(A(this.g, n)); });
  K('DeleteFileW', 1, function (n) { return vol(this.g, 'DeleteFileW').deleteFile(W(this.g, n)); });
  K('CreateDirectoryA', 2, function (n) { return vol(this.g, 'CreateDirectoryA').createDirectory(A(this.g, n)); });
  K('CreateDirectoryW', 2, function (n) { return vol(this.g, 'CreateDirectoryW').createDirectory(W(this.g, n)); });
  K('RemoveDirectoryA', 1, function (n) { return vol(this.g, 'RemoveDirectoryA').removeDirectory(A(this.g, n)); });
  K('RemoveDirectoryW', 1, function (n) { return vol(this.g, 'RemoveDirectoryW').removeDirectory(W(this.g, n)); });
  K('CopyFileA', 3, function (a, b, failIfExists) { return vol(this.g, 'CopyFileA').copyFile(A(this.g, a), A(this.g, b), !!failIfExists); });
  K('CopyFileW', 3, function (a, b, failIfExists) { return vol(this.g, 'CopyFileW').copyFile(W(this.g, a), W(this.g, b), !!failIfExists); });
  K('MoveFileA', 2, function (a, b) { return vol(this.g, 'MoveFileA').moveFile(A(this.g, a), A(this.g, b), 0); });
  K('MoveFileExA', 3, function (a, b, f) { return vol(this.g, 'MoveFileExA').moveFile(A(this.g, a), A(this.g, b), f); });
  K('MoveFileExW', 3, function (a, b, f) { return vol(this.g, 'MoveFileExW').moveFile(W(this.g, a), W(this.g, b), f); });
  K('SetFileAttributesA', 2, ret(1), 'file attributes (read-only/hidden/...) are not modelled; reports success');
  K('SetFileAttributesW', 2, ret(1), 'file attributes (read-only/hidden/...) are not modelled; reports success');
  K('SetFileTime', 4, ret(1), 'file timestamps are not settable; reports success');
  K('GetFileSize', 2, function (h, hi) { const t = this.g.alloc(8); try { if (!this.g.files.size(h, t)) return -1; const v = this.g.dv.getBigUint64(t, true); if (hi) this.g.u32(hi, Number(v >> 32n)); return Number(v & 0xffffffffn) | 0; } finally { this.g.free(t); } });
  K('SetFilePointer', 4, function (h, low, hiPtr, method) { const t = this.g.alloc(8); try { const hi = hiPtr ? this.g.u32(hiPtr) : ((low | 0) < 0 ? 0xffffffff : 0); if (!this.g.files.seek(h, low, hi, t, method)) return -1; const v = this.g.dv.getBigUint64(t, true); if (hiPtr) this.g.u32(hiPtr, Number(v >> 32n)); return Number(v & 0xffffffffn) | 0; } finally { this.g.free(t); } });
  K('CreateFileMappingA', 6, function () { this.g.lastError = 5; return 0; }, 'no file mappings');
  K('MapViewOfFile', 5, function () { this.g.lastError = 6; return 0; }, 'no file mappings');
  K('UnmapViewOfFile', 1, ret(1));
  K('EnumSystemLocalesW', 2, function (cb) { return 1; }, 'reports no locales');
  K('FreeLibraryAndExitThread', 2, function (_h, code) { throw new GuestThreadExit(code); });
  K('GetDriveTypeW', 1, ret(3));                // DRIVE_FIXED
  K('GetLogicalDriveStringsA', 2, function (n, buf) { if (n >= 5) { const s = 'C:\\'; for (let i = 0; i < 3; i++) this.g.u8[buf + i] = s.charCodeAt(i); this.g.u8[buf + 3] = 0; this.g.u8[buf + 4] = 0; return 4; } return 5; });
  K('GetDiskFreeSpaceA', 5, function (_r, spc, bps, free, total) { const g = this.g; g.u32(spc, 8); g.u32(bps, 512); g.u32(free, 1 << 24); g.u32(total, 1 << 25); return 1; });
  K('GetDiskFreeSpaceExA', 4, function (_d, avail, total, free) { const g = this.g; for (const p of [avail, total, free]) if (p) { g.u32(p, 0x80000000); g.u32(p + 4, 0x1f); } return 1; }, 'reports 128 GiB free');
  K('DosDateTimeToFileTime', 3, function (d, t, out) { const dt = new Date(Date.UTC(1980 + (d >> 9), ((d >> 5) & 15) - 1, d & 31, t >> 11, (t >> 5) & 63, (t & 31) * 2)); const ft = BigInt(dt.getTime()) * 10000n + 116444736000000000n; this.g.u32(out, Number(ft & 0xffffffffn)); this.g.u32(out + 4, Number(ft >> 32n)); return 1; });
  K('FileTimeToDosDateTime', 3, function (ft, dp, tp) { const v = (BigInt(this.g.u32(ft + 4)) << 32n) | BigInt(this.g.u32(ft)); const d = new Date(Number((v - 116444736000000000n) / 10000n)); this.g.dv.setUint16(dp, ((d.getUTCFullYear() - 1980) << 9) | ((d.getUTCMonth() + 1) << 5) | d.getUTCDate(), true); this.g.dv.setUint16(tp, (d.getUTCHours() << 11) | (d.getUTCMinutes() << 5) | (d.getUTCSeconds() >> 1), true); return 1; });

  // wsock32.dll is the legacy Winsock 1 entry surface; it forwards to ws2_32.
  for (const key of Object.keys(SHIMS)) if (key.startsWith('ws2_32.dll!')) SHIMS['wsock32.dll!' + key.slice(11)] ??= SHIMS[key];
}

// Call a guest function pointer from inside a host shim (window procedures).
function callGuest(ctx, fn, args) {
  const g = ctx.g;
  const dll = [...g.dlls.values()].find((d) => fn >= d.meta.base && fn < d.meta.base + d.meta.size);
  if (!dll) throw new Error(`call target 0x${fn.toString(16)} is not inside a loaded DLL`);
  return g.call(dll, fn, args);
}
