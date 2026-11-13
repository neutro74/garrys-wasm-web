// Host-side Steamworks emulation at the steam_api.dll import boundary.
//
// The retail Steam client (steamclient.dll) is not available in this
// environment, so the engine's steam_api.dll imports are redirected to these
// shims. Interface objects are real COM objects in guest memory whose vtables
// have accurate per-version arities (see steam-abi.mjs, generated from the
// Steamworks SDK headers). Methods we do not implement yet are logged on first
// call and return the neutral "Steam is offline" value; set STEAM_STRICT=1 to
// turn them into hard errors instead.
import { STEAM_VTABLES, STEAM_SRET, STEAM_NAMES } from './steam-abi.mjs';
import { env as ENV } from './platform.mjs';

const STRICT = !!ENV.STEAM_STRICT;
const DEBUG = !!ENV.STEAM_DEBUG;

export function steamState(g) {
  return g.steam ||= {
    pipe: 1,
    user: 1,
    gsUser: 1,
    ipcCount: 0,
    installPath: 0,
    ifaces: new Map(),      // version string -> guest object pointer
    unhandled: new Map(),   // "Version#idx" -> true (log once)
    callbacks: [],          // { cb, id }
    callResults: new Map(), // SteamAPICall_t -> cb
    nextCall: 0x1000,
    appId: 4000,
    personaName: 0,
    personaNameFriend: 0,
    steamId: 76561197960287930n,
  };
}

function ownerDll(g, addr) {
  for (const d of g.dlls.values())
    if (addr >= d.meta.base && addr < d.meta.base + d.meta.size) return d;
  return null;
}

function unhandled(ctx, version, index) {
  const st = steamState(ctx.g);
  const key = `${version}#${index}`;
  if (STRICT) throw new Error(`unimplemented Steam interface method ${key}`);
  if (!st.unhandled.has(key)) {
    st.unhandled.set(key, true);
    ctx.g.log(`[steam] unimplemented ${key} -> 0 (offline)`);
  }
  if (DEBUG) {
    const names = [];
    for (let i = 0; i < 6; i++) names.push(ctx.g.u32(ctx.esp + 4 + 4 * i).toString(16));
    ctx.g.log(`[steam]   args ${names.join(' ')}`);
  }
  return 0;
}

// Per-interface method implementations. Anything not listed falls back to the
// logged offline value above.
// ISteamUGC with no Workshop: nothing is subscribed or installed and every query completes empty. Addons come
// from files the user uploads (see the addon store), so this never reports Workshop content.
const UGC_QUERY_COMPLETED = 3401;
function ugcMethod(st, version, index, args) {
  const name = STEAM_NAMES[version]?.[index];
  switch (name) {
    case 'CreateQueryUserUGCRequest': case 'CreateQueryAllUGCRequest': case 'CreateQueryUGCDetailsRequest':
      return BigInt(st.nextQuery = (st.nextQuery ?? 0x100) + 1);
    case 'SendQueryUGCRequest': {
      const p = new Uint8Array(24), v = new DataView(p.buffer);
      v.setBigUint64(0, asBig(args[0], args[1]), true); v.setInt32(8, 1, true);     // k_EResultOK, zero results
      return queueApiCall(st, UGC_QUERY_COMPLETED, p);
    }
    case 'ReleaseQueryUGCRequest': return 1;
    case 'GetNumSubscribedItems': case 'GetSubscribedItems': case 'GetItemState': return 0;
    case 'GetQueryUGCResult': case 'GetItemInstallInfo': case 'GetItemDownloadInfo': case 'DownloadItem': return 0;
    default: return /^(Set|Add)/.test(name ?? '') && name !== 'AddItemToFavorites' ? 1 : undefined;
  }
}

// Source app id -> game folder, for the folders the Extended edition adds. Null when this is the base edition.
const APP_DIRS = { 220: 'hl2', 240: 'cstrike', 300: 'dod', 320: 'hl2mp', 340: 'lostcoast', 380: 'episodic', 400: 'portal', 420: 'ep2', 620: 'portal2' };
let bundled;
function bundledApps() {
  if (bundled !== undefined) return bundled;
  const files = globalThis.__fsInit?.ext?.files;
  if (!files) return (bundled = null);
  const dirs = new Set(files.map((f) => f.split('/')[0]));
  return (bundled = new Map(Object.entries(APP_DIRS).filter(([, d]) => dirs.has(d)).map(([id, d]) => [+id, d])));
}

// Peer-to-peer play (web/p2p.js) runs without Steam, but the engine's connect path still wants a session ticket from the client
// and a "logged on" game server that accepts it. The ticket is a fixed token; the server side accepts any ticket
// (BeginAuthSession -> OK and a ValidateAuthTicketResponse_t callback). Nothing here proves identity: it is for LAN/P2P play only.
const TICKET_BYTES = 32;
function authTicket(g, buf, cap, lenp) {
  const n = Math.min(TICKET_BYTES, cap | 0);
  if (buf && n > 0) { g.u8.fill(0, buf, buf + n); g.u8.set([0x47, 0x57, 0x31], buf); }
  if (lenp) g.u32(lenp, n);
  return n > 0 ? 1 : 0;
}
const CB_SERVERS_CONNECTED = 101, CB_GS_POLICY = 115, CB_VALIDATE_AUTH = 143;
function serverMethod(ctx, st, index, args) {
  const g = ctx.g;
  switch (index) {
    case 5: case 6:                        // LogOn, LogOnAnonymous: connected, not VAC-secure
      queueCallback(st, CB_SERVERS_CONNECTED, new Uint8Array(1));
      queueCallback(st, CB_GS_POLICY, new Uint8Array(4));
      return 0;
    case 8: return 1;                      // BLoggedOn
    case 10: return st.steamId;            // GetSteamID
    case 25: return authTicket(g, args[0], args[1], args[2]);
    case 26: {                             // BeginAuthSession(ticket, cb, steamID): always OK, and say so
      const p = new Uint8Array(20), dv = new DataView(p.buffer);
      dv.setUint32(0, args[2] >>> 0, true); dv.setUint32(4, args[3] >>> 0, true);
      dv.setUint32(8, 0, true);            // k_EAuthSessionResponseOK
      dv.setUint32(12, args[2] >>> 0, true); dv.setUint32(16, args[3] >>> 0, true);
      queueCallback(st, CB_VALIDATE_AUTH, p);
      return 0;                            // k_EBeginAuthSessionResultOK
    }
    case 29: return 0;                     // UserHasLicenseForApp: k_EUserHasLicenseResultHasLicense
    default: return undefined;
  }
}

function steamMethod(ctx, version, index, args) {
  const g = ctx.g, st = steamState(g);
  if (version.startsWith('STEAMUGC_INTERFACE_VERSION')) {
    const r = ugcMethod(st, version, index, args);
    if (r !== undefined) return r;
  }
  if (DEBUG) g.log(`[steam] ${version}#${index}(${args.map((a) => '0x' + (a >>> 0).toString(16)).join(', ')})`);
  // Extended edition: the game folders it bundles (game/ext, see edition-fs.mjs) are reported as owned and installed under
  // the install root, which is how GMod's Games menu decides to mount them. Base edition: nothing is owned (offline).
  if (version === 'STEAMAPPS_INTERFACE_VERSION009') {
    const dir = bundledApps()?.get(args[0] >>> 0);
    switch (index) {
      case 6: case 19: return dir ? 1 : 0;      // BIsSubscribedApp, BIsAppInstalled
      case 18: {                                // GetAppInstallDir(appId, buf, cap): the folder that contains the game folder
        if (!dir) return 0;
        const buf = args[1], max = args[2] | 0, path = 'c:\\gamebox';
        if (buf && max > 0) { const n = Math.min(path.length, max - 1); for (let i = 0; i < n; i++) g.u8[buf + i] = path.charCodeAt(i); g.u8[buf + n] = 0; }
        return path.length + 1;
      }
    }
  }
  if (ENV.mp && version === 'SteamGameServer015') {
    const r = serverMethod(ctx, st, index, args);
    if (r !== undefined) return r;
  }
  if (version === 'SteamUser023') {
    switch (index) {
      case 0: return st.user;              // GetHSteamUser
      case 1: return 1;                    // BLoggedOn
      case 2: return st.steamId;           // GetSteamID (64-bit -> eax:edx)
      case 6: {                            // GetUserDataFolder
        const buf = args[0], max = args[1] | 0;
        const path = `${g.filesRoot || '.'}/garrysmod`;
        if (buf && max > 0) {
          for (let i = 0; i < Math.min(path.length, max - 1); i++) g.u8[buf + i] = path.charCodeAt(i);
          g.u8[buf + Math.min(path.length, max - 1)] = 0;
        }
        return 1;
      }
      case 13:                             // GetAuthSessionTicket(pTicket, cbMax, pcbTicket)
        if (!ENV.mp) { if (args[2]) g.u32(args[2], 0); return 0; }   // no ticket offline; only peer-to-peer play (?mp=1) fakes one
        return authTicket(g, args[0], args[1], args[2]);
      case 17: return 0;                   // CancelAuthTicket
      case 18: return 1;                   // UserHasLicenseForApp(appid) -> owned
      case 19: return 0;                   // BIsBehindNAT
      case 20: return 0;                   // AdvertiseGame
      case 21:                             // RequestEncryptedAppTicket
      case 22:                             // GetEncryptedAppTicket
        if (args[2]) g.u32(args[2], 0);
        return 0;
      case 23: return 0;                   // GetGameBadgeLevel
      case 24: return 0;                   // GetPlayerSteamLevel
      case 25: return 0;                   // RequestStoreAuthURL
      case 26: case 27: case 28: case 29: return 0;
      case 30: return 0;                   // GetMarketEligibility
      case 31: return 0;                   // GetDurationControl
    }
  }
  if (version === 'SteamFriends018') {
    switch (index) {
      case 0: return st.user;              // GetHSteamUser
      case 1: {                            // GetPersonaName
        if (!st.personaName) st.personaName = g.cstr('Player');
        return st.personaName;
      }
      case 2: return 0;                    // SetPersonaName (async handle)
      case 3: return 1;                    // GetPersonaState -> Online
      case 4: return 0;                    // GetFriendCount
      case 5: return 0;                    // GetFriendByIndex
      case 6: return 0;                    // GetFriendRelationship
      case 7: return 1;                    // GetFriendPersonaState -> Online
      case 8: {                            // GetFriendPersonaName
        if (!st.personaNameFriend) st.personaNameFriend = g.cstr('Player');
        return st.personaNameFriend;
      }
      case 9: return 0;                    // GetFriendGamePlayed
      case 10: return 0;                   // GetFriendPersonaNameHistory
      case 11: return -1;                  // GetFriendSteamLevel
      case 12:                             // GetPlayerNickname
        if (!st.personaName) st.personaName = g.cstr('Player');
        return st.personaName;
      case 13: return 0;                   // GetFriendsGroupCount
      case 14: return 0;                   // GetFriendsGroupIDByIndex
      case 15: return 0;                   // GetFriendsGroupName
      case 16: return 0;                   // GetFriendsGroupMembersCount
      case 17: return 0;                   // GetFriendsGroupMembersList
      case 18: return 1;                   // HasFriend
      case 19: return 0;                   // GetClanCount
      case 20: return 0;                   // GetClanByIndex
      case 21: return 0;                   // GetClanName
      case 22: return 0;                   // GetClanTag
      case 23: return 1;                   // GetClanActivityCounts
      case 24: return 0;                   // DownloadClanActivityCounts
      case 25: return 0;                   // GetFriendCountFromSource
      case 26: return 0;                   // GetFriendFromSourceByIndex
      case 27: return 0;                   // IsUserInSource
      case 28: return 0;                   // SetInGameVoiceSpeaking
      case 29: return 0;                   // ActivateGameOverlay
      case 30: return 0;                   // ActivateGameOverlayToUser
      case 31: return 0;                   // ActivateGameOverlayToWebPage
      case 32: return 0;                   // ActivateGameOverlayToStore
      case 33: return 0;                   // SetPlayedWith
      case 34: return 0;                   // ActivateGameOverlayInviteDialog
      case 35: return 0;                   // GetSmallFriendAvatar
      case 36: return 0;                   // GetMediumFriendAvatar
      case 37: return 0;                   // GetLargeFriendAvatar
      case 38: return 0;                   // RequestUserInformation
      case 39: return 0;                   // RequestClanOfficerList
      case 40: return 0;                   // GetClanOwner
      case 41: return 0;                   // GetClanOfficerCount
      case 42: return 0;                   // GetClanOfficerByIndex
      case 43: return 0;                   // GetUserRestrictions
      case 44: return 1;                   // SetRichPresence
      case 45: return 0;                   // ClearRichPresence
      case 46: {                           // GetFriendRichPresence
        return g.cstr('');
      }
      case 47: return 0;                   // GetFriendRichPresenceKeyCount
      case 48: return 0;                   // GetFriendRichPresenceKeyByIndex
      case 49: return 0;                   // RequestFriendRichPresence
      case 50: return 0;                   // InviteUserToGame
      case 51: return 0;                   // GetCoplayFriendCount
      case 52: return 0;                   // GetCoplayFriend
      case 53: return 0;                   // GetFriendCoplayTime
      case 54: return 0;                   // GetFriendCoplayGame
      case 55: return 0;                   // JoinClanChatRoom
      case 56: return 0;                   // LeaveClanChatRoom
      case 57: return 0;                   // GetClanChatMemberCount
      case 58: return 0;                   // GetChatMemberByIndex
      case 59: return 0;                   // SendClanChatMessage
      case 60: return 0;                   // GetClanChatMessage
      case 61: return 0;                   // IsClanChatAdmin
      case 62: return 0;                   // IsClanChatWindowOpenInSteam
      case 63: return 0;                   // OpenClanChatWindowInSteam
      case 64: return 0;                   // CloseClanChatWindowInSteam
      case 65: return 1;                   // SetListenForFriendsMessages
      case 66: return 0;                   // ReplyToFriendMessage
      case 67: return 0;                   // GetFriendMessage
      case 68: return 0;                   // GetFollowerCount
      case 69: return 0;                   // IsFollowing
      case 70: return 0;                   // EnumerateFollowingList
      case 71: return 0;                   // IsClanPublic
      case 72: return 0;                   // IsClanOfficialGameGroup
      case 73: return 0;                   // GetNumChatsWithUnreadPriorityMessages
      case 74: return 0;                   // ActivateGameOverlayRemotePlayTogetherInviteDialog
      case 75: return 0;                   // RegisterProtocolInOverlayBrowser
      case 76: return 0;                   // ActivateGameOverlayInviteDialogConnectString
      case 77: return 0;                   // RequestEquippedProfileItems
    }
  }
  if (version === 'SteamUtils010') {
    switch (index) {
      case 0: case 1: return 0;            // GetSecondsSinceAppActive / ComputerActive
      case 2: return 1;                    // GetConnectedUniverse -> k_EUniversePublic
      case 3: return Math.floor(Date.now() / 1000); // GetServerRealTime
      case 4: return g.cstr('US');         // GetIPCountry
      case 5: case 6: return 0;            // GetImageSize / GetImageRGBA: no avatar images offline
      case 7: return 0;                    // GetCSERIPPort: no CSER server
      case 8: return 255;                  // GetCurrentBatteryPower: AC power
      case 9: return st.appId;             // GetAppID
      case 11: return utilsCalls.isCompleted(g, st, ...args);        // IsAPICallCompleted
      case 12: return utilsCalls.failureReason();                    // GetAPICallFailureReason
      case 13: return utilsCalls.getResult(g, st, ...args);          // GetAPICallResult
      case 19: return utilsCalls.checkFileSignature(g, st, args[0]); // CheckFileSignature
      case 23: return g.cstr('english');   // GetSteamUILanguage
      default: return 0;                   // overlay, API-call queries, gamepad text: nothing pending offline
    }
  }
  if (version === 'SteamUtils011') {
    // Index order follows the SDK header (see the SteamUtils011 arity table in steam-abi.mjs).
    switch (index) {
      case 0: return 0;                    // GetSecondsSinceAppActive
      case 1: return 0;                    // GetSecondsSinceComputerActive
      case 2: return 1;                    // GetConnectedUniverse -> k_EUniversePublic
      case 3: return Math.floor(Date.now() / 1000); // GetServerRealTime
      case 4: return g.cstr('US');         // GetIPCountry
      case 5: return 0;                    // GetImageSize: no avatar images offline
      case 6: return 0;                    // GetImageRGBA
      case 7: return 255;                  // GetCurrentBatteryPower: AC power, no battery
      case 8: return st.appId;             // GetAppID
      case 9: return 0;                    // SetOverlayNotificationPosition
      case 10: return utilsCalls.isCompleted(g, st, ...args);     // IsAPICallCompleted
      case 11: return utilsCalls.failureReason();                 // GetAPICallFailureReason
      case 12: return utilsCalls.getResult(g, st, ...args);       // GetAPICallResult
      case 13: return 0;                   // RunFrame
      case 14: return 0;                   // GetIPCCallCount
      case 15: return 0;                   // SetWarningMessageHook
      case 16: return 0;                   // IsOverlayEnabled
      case 17: return 0;                   // BOverlayNeedsPresent
      case 18: return utilsCalls.checkFileSignature(g, st, args[0]); // CheckFileSignature
      case 19: return 0;                   // ShowGamepadTextInput
      case 20: return 0;                   // GetEnteredGamepadTextLength
      case 21: return 0;                   // GetEnteredGamepadTextInput
      case 22: return g.cstr('english');   // GetSteamUILanguage
      case 23: return 0;                   // IsSteamRunningInVR
      case 24: return 0;                   // SetOverlayNotificationInset
      case 25: return 0;                   // IsSteamInBigPictureMode
      case 26: return 0;                   // StartVRDashboard
      case 27: return 0;                   // IsVRHeadsetStreamingEnabled
      case 28: return 0;                   // SetVRHeadsetStreamingEnabled
      case 29: return 0;                   // IsSteamChinaLauncher
    }
  }
  return unhandled(ctx, version, index);
}

// Interface versions the SDK headers here don't cover. The 64-bit SteamAPICall_t arguments take two
// stack words. SteamUtils010 still has GetCSERIPPort at index 7 (removed in 011), which shifts every
// later method by one, and its ShowGamepadTextInput has no existing-text parameter.
const EXTRA_VTABLES = {
  SteamUtils010: [0, 0, 0, 0, 0, 3, 3, 2, 0, 0, 1, 3, 2, 6, 0, 0, 1, 0, 0, 1, 4, 0, 2, 0, 0, 2],
};
function arityTable(version) { return EXTRA_VTABLES[version] || STEAM_VTABLES[version]; }
const canonicalVersion = (version) => version;


// SteamAPICall_t bookkeeping for ISteamUtils. Calls that complete synchronously in the host (no Steam
// client to answer them) are stored with their callback id and payload, then polled by the guest.
// Real Steam would verify the file's signature; with no signature data offline it reports
// k_ECheckFileSignatureNoSignaturesFoundForThisApp (3), which the engine accepts.
const CHECK_FILE_SIGNATURE_CALLBACK = 705;
function apiCalls(st) { return st.apiCalls ||= new Map(); }
function queueApiCall(st, callbackId, payload) {
  const handle = BigInt(st.nextCall++);
  apiCalls(st).set(handle, { callbackId, payload });
  (st.pending ||= []).push(handle);
  return handle;
}
// A callback with no API call behind it (e.g. persona state changes): broadcast to registered callbacks only.
function queueCallback(st, callbackId, payload) {
  (st.broadcasts ||= []).push({ callbackId, payload });
}

// CCallbackBase vtable slot 1 is Run(void*, bool, SteamAPICall_t) or Run(void*) depending on how MSVC ordered the
// overloads; passing all four words works for both (the callee pops what it declares).
function deliver(g, dll, cb, payload, handle) {
  const vt = g.u32(cb), run = vt ? g.u32(vt + 4) : 0;
  if (!run) return;
  const pv = g.alloc(Math.max(16, payload.length));
  g.u8.set(payload, pv);
  try { g.call(dll, run, [pv, 0, Number(handle & 0xffffffffn), Number(handle >> 32n)], { thiscall: cb }); }
  catch (e) { g.log(`[steam] callback delivery failed: ${e.message}`); }
  finally { g.free(pv); }
}
const asBig = (lo, hi) => BigInt(lo >>> 0) | (BigInt(hi >>> 0) << 32n);

// Steam's dispatcher: each completed API call goes to the CCallResult registered for it, and its callback id is
// also broadcast to every registered CCallback of that id.
function runCallbacks(g, dll) {
  const st = steamState(g);
  for (const handle of (st.pending ||= []).splice(0)) {
    const call = apiCalls(st).get(handle);
    if (!call) continue;
    const key = `${handle}`;
    const target = st.callResults.get(key);
    if (target) { st.callResults.delete(key); deliver(g, dll, target, call.payload, handle); apiCalls(st).delete(handle); }
    for (const cb of [...st.callbacks]) if (cb.id === call.callbackId) deliver(g, dll, cb.cb, call.payload, handle);
  }
  for (const b of (st.broadcasts ||= []).splice(0))
    for (const cb of [...st.callbacks]) if (cb.id === b.callbackId) deliver(g, dll, cb.cb, b.payload, 0n);
}
const u64 = (lo, hi) => BigInt(lo >>> 0) | (BigInt(hi >>> 0) << 32n);
const utilsCalls = {
  checkFileSignature(g, st, namePtr) {
    g.log(`[steam] CheckFileSignature(${namePtr ? g.readStr(namePtr) : ''}) -> NoSignaturesFoundForThisApp`);
    const payload = new Uint8Array(4); new DataView(payload.buffer).setUint32(0, 3, true);
    return queueApiCall(st, CHECK_FILE_SIGNATURE_CALLBACK, payload);
  },
  isCompleted(g, st, lo, hi, failedPtr) {
    const done = apiCalls(st).has(u64(lo, hi));
    if (done && failedPtr) g.u8[failedPtr] = 0;
    return done ? 1 : 0;
  },
  failureReason: () => 0xFFFFFFFF,   // k_ESteamAPICallFailureNone
  getResult(g, st, lo, hi, outPtr, cub, expectedId, failedPtr) {
    const call = apiCalls(st).get(u64(lo, hi));
    if (!call || call.callbackId !== expectedId) { if (failedPtr) g.u8[failedPtr] = 1; return 0; }
    g.u8.set(call.payload.subarray(0, cub), outPtr);
    if (failedPtr) g.u8[failedPtr] = 0;
    apiCalls(st).delete(u64(lo, hi));
    return 1;
  },
};

// MSVC returns a class by value through a hidden first argument: the callee fills it in and returns it in EAX.
function callMethod(ctx, version, index, args) {
  const size = STEAM_SRET[version]?.[index];
  if (!size) return steamMethod(ctx, version, index, args);
  const [out, ...rest] = args, g = ctx.g;
  const r = steamMethod(ctx, version, index, rest);
  g.u8.fill(0, out, out + size);
  g.dv.setBigUint64(out, typeof r === 'bigint' ? r : BigInt(r >>> 0), true);
  return out;
}

function makeInterface(g, dll, version) {
  const st = steamState(g);
  if (st.ifaces.has(version)) return st.ifaces.get(version);
  const arities = arityTable(version);
  if (!arities) {
    g.log(`[steam] no arity table for interface ${version}; refusing to fabricate a vtable`);
    if (STRICT) throw new Error(`unknown Steam interface ${version}`);
    return 0;
  }
  const obj = g.alloc(16);
  const vt = g.alloc(4 * arities.length);
  g.u32(obj, vt);
  for (let i = 0; i < arities.length; i++) {
    const words = arities[i];
    const thunk = g.extraThunk(dll, `steam:${version}#${i}`, function (...args) {
      return callMethod(this, canonicalVersion(version), i, args);
    }, 4 * words, false, words);
    g.u32(vt + 4 * i, thunk);
  }
  st.ifaces.set(version, obj);
  g.log(`[steam] created ${version} object=0x${obj.toString(16)} methods=${arities.length}`);
  return obj;
}

function steamInstallPath(g) {
  const st = steamState(g);
  if (!st.installPath) st.installPath = g.cstr(`${g.filesRoot || '.'}/steam`);
  return st.installPath;
}

const C = (fn, arity) => ({ fn, arity, cdecl: true, pop: 0 });

export function installSteam(SHIMS, DYNAMIC_SHIMS = []) {
  DYNAMIC_SHIMS.push((name) => {
    const m = /^steam:(.+)#(\d+)$/.exec(name);
    const arities = m && arityTable(m[1]);
    if (!arities || !(m[2] in arities)) return null;
    const version = m[1], index = +m[2], words = arities[index];
    return { fn: function (...args) { return callMethod(this, canonicalVersion(version), index, args); }, pop: 4 * words, cdecl: false, arity: words };
  });
  const S = (name, arity, fn) => { SHIMS[`steam_api.dll!${name}`] = C(fn, arity); };

  // Returns the modern ESteamAPIInitResult enum: 0 == k_ESteamAPIInitResult_OK.
  S('SteamInternal_SteamAPI_Init', 2, function (_version, errOut) {
    const g = this.g;
    g.log('[steam] SteamInternal_SteamAPI_Init -> OK (host emulation, no Steam client)');
    if (errOut) g.u8[errOut] = 0;
    return 0;
  });
  S('SteamAPI_Init', 0, function () { return 1; });
  S('SteamAPI_InitSafe', 0, function () { return 1; });
  S('SteamAPI_RestartAppIfNecessary', 1, function (appid) {
    steamState(this.g).appId = appid >>> 0;
    return 0;
  });
  S('SteamAPI_Shutdown', 0, function () {
    const st = steamState(this.g);
    st.ifaces.clear();
    st.callbacks.length = 0;
    st.callResults.clear();
    return 0;
  });
  S('SteamAPI_IsSteamRunning', 0, () => 1);
  S('SteamAPI_GetHSteamPipe', 0, function () { return steamState(this.g).pipe; });
  S('SteamAPI_GetHSteamUser', 0, function () { return steamState(this.g).user; });
  S('SteamAPI_GetSteamInstallPath', 0, function () { return steamInstallPath(this.g); });
  S('SteamAPI_ReleaseCurrentThreadMemory', 0, () => 0);
  S('SteamAPI_SetTryCatchCallbacks', 1, () => 0);
  S('SteamAPI_SetBreakpadAppID', 1, function (appid) {
    steamState(this.g).appId = appid >>> 0; return 0;
  });
  S('SteamAPI_WriteMiniDump', 3, () => 0);
  S('SteamAPI_SetMiniDumpComment', 1, () => 0);
  S('SteamAPI_RunCallbacks', 0, function () { runCallbacks(this.g, this.dll); return 0; });
  S('SteamAPI_RegisterCallback', 2, function (cb, id) {
    const st = steamState(this.g), g = this.g;
    cb >>>= 0;
    g.u8[cb + 4] |= 1;                 // k_ECallbackFlagsRegistered: the object's destructor unregisters itself
    g.u32(cb + 8, id | 0);             // m_iCallback
    st.callbacks.push({ cb, id: id | 0 });
    return 0;
  });
  S('SteamAPI_UnregisterCallback', 1, function (cb) {
    const st = steamState(this.g);
    cb >>>= 0;
    this.g.u8[cb + 4] &= ~1;
    st.callbacks = st.callbacks.filter((x) => x.cb !== cb);
    return 0;
  });
  S('SteamAPI_RegisterCallResult', 3, function (cb, lo, hi) {
    steamState(this.g).callResults.set(`${asBig(lo, hi)}`, cb >>> 0);
    return 0;
  });
  S('SteamAPI_UnregisterCallResult', 3, function (cb, lo, hi) {
    steamState(this.g).callResults.delete(`${asBig(lo, hi)}`);
    return 0;
  });
  S('SteamInternal_CreateInterface', 1, function (versionPtr) {
    const g = this.g, version = g.readStr(versionPtr);
    g.log(`[steam] SteamInternal_CreateInterface(${version})`);
    return makeInterface(g, this.dll, version);
  });
  S('SteamInternal_FindOrCreateUserInterface', 2, function (_user, versionPtr) {
    const g = this.g, version = g.readStr(versionPtr);
    g.log(`[steam] FindOrCreateUserInterface(${version})`);
    return makeInterface(g, this.dll, version);
  });
  S('SteamInternal_FindOrCreateGameServerInterface', 2, function (_user, versionPtr) {
    const g = this.g, version = g.readStr(versionPtr);
    g.log(`[steam] FindOrCreateGameServerInterface(${version})`);
    return makeInterface(g, this.dll, version);
  });
  S('SteamInternal_GameServer_Init_V2', 6, () => 0);
  // ContextInit: SteamContextInitData { pfn, pData, unused } at ctx. The first
  // call runs the guest-provided pfn (which calls back into our interface
  // shims) and caches the resulting interface pointer in pData.
  S('SteamInternal_ContextInit', 1, function (ctxPtr) {
    const g = this.g;
    if (!ctxPtr) return 0;
    const pfn = g.u32(ctxPtr);
    if (!pfn) return 0;
    const dataPtr = ctxPtr + 4;
    if (!g.u32(dataPtr)) {
      const out = g.alloc(4);
      g.u32(out, 0);
      const dll = ownerDll(g, pfn) || this.dll;
      g.call(dll, pfn, [out]);
      g.u32(dataPtr, g.u32(out));
    }
    return dataPtr;
  });
  S('SteamGameServer_GetHSteamUser', 0, function () { return steamState(this.g).gsUser; });
  S('SteamGameServer_GetIPCCallCount', 0, function () { return steamState(this.g).ipcCount++; });
  S('SteamGameServer_RunCallbacks', 0, function () { if (ENV.mp) runCallbacks(this.g, this.dll); return 0; });
  S('SteamGameServer_Shutdown', 0, () => 0);
  S('SteamGameServer_Init', 5, () => 1);
  S('SteamGameServer_InitSafe', 5, () => 1);
  S('SteamGameServer_BSecure', 0, () => 0);
  S('SteamGameServer_GetSteamID', 0, function () { return steamState(this.g).steamId; });

  // Interface accessors exposed by steam_api.dll itself (used by client.dll
  // and GameUI.dll through the accessor macros).
  SHIMS['steam_api.dll!SteamUser'] = C(function () {
    return makeInterface(this.g, this.dll, 'SteamUser023');
  }, 0);
  SHIMS['steam_api.dll!SteamFriends'] = C(function () {
    return makeInterface(this.g, this.dll, 'SteamFriends018');
  }, 0);
  SHIMS['steam_api.dll!SteamUtils'] = C(function () {
    return makeInterface(this.g, this.dll, 'SteamUtils011');
  }, 0);
}
