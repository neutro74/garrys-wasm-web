// Runs inside GMod's own menu pages (added by html-panels.js to asset:// documents). The browser build has no
// folders to drop files into, so the game's Addons and Saves pages get the missing controls in their sidebars,
// in the same markup as the entries around them:
//   Addons: "Install addon from file…" and the installed .gma files, each removable.
//   Saves:  "Import saves…" and "Export saves" next to "Open folder".
// Requests go to the page through window.__gmodHost (see the bridge in html-panels.js and menuHost in storage.js).

const host = (op, args) => window.__gmodHost(op, args);

function item(text, onClick, cls = '') {
  const li = document.createElement('li'), a = document.createElement('a');
  a.textContent = text; a.className = cls; a.href = '';
  a.addEventListener('click', (e) => { e.preventDefault(); onClick(a); });
  li.append(a);
  return li;
}
function note(text = '') {
  const li = document.createElement('li');
  li.className = 'wasm-note'; li.style.cssText = 'opacity:.75;font-size:11px;padding:2px 0 2px 8px;white-space:normal';
  li.textContent = text;
  return li;
}
function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept; input.style.display = 'none';
    input.addEventListener('change', () => { resolve(input.files[0] ?? null); input.remove(); }, { once: true });
    document.body.append(input); input.click();
  });
}
const scopeOf = (el) => window.angular?.element(el).scope();
const refresh = (page) => { const s = scopeOf(page); if (s?.Switch) s.$apply(() => s.Switch(s.Category, 0)); };
// Lua runs in the menu state; mounting makes an installed addon's content available without a restart.
const lua = (code) => { try { window.lua?.Run(code); } catch { /* not in engine */ } };

async function addonsSidebar(page, ul) {
  const status = note(), header = document.createElement('li'), list = [];
  header.innerHTML = '<a class="notactive" style="pointer-events:none">Addons from files</a>';
  const render = async () => {
    for (const li of list.splice(0)) li.remove();
    let addons = [];
    try { addons = await host('addons'); } catch (e) { status.textContent = e.message; }
    if (!addons.length) list.push(note('None installed. Addon files (.gma) stay in this browser.'));
    for (const a of addons) {
      const li = item(`${a.title}  ✕`, async (link) => {
        if (!confirm(`Remove "${a.title}"? It is deleted from this browser.`)) return;
        link.textContent = 'Removing…';
        try { await host('remove-addon', { name: a.file }); status.textContent = `Removed ${a.title}. Restart the game to unload it.`; } catch (e) { status.textContent = e.message; }
        render();
      });
      li.title = `${a.file} (${(a.size / 1048576).toFixed(1)} MB) — click to remove`;
      list.push(li);
    }
    header.after(...list);
  };
  const install = item('Install addon from file…', async () => {
    const file = await pickFile('.gma');
    if (!file) return;
    status.textContent = `Installing ${file.name}…`;
    try {
      const name = await host('install-addon', { name: file.name, bytes: await file.arrayBuffer() });
      lua(`if game.MountGMA then game.MountGMA("addons/${name}") end`);
      status.textContent = `Installed ${file.name}. It loads with the next map.`;
    } catch (e) { status.textContent = `Could not install ${file.name}: ${e.message}`; }
    render();
  });
  ul.append(document.createElement('li'), header, install, status);
  render();
}

function savesSidebar(page, ul) {
  const status = note();
  const anchor = [...ul.querySelectorAll('a')].find((a) => /OpenFolder/.test(a.getAttribute('ng-click') ?? ''))?.closest('li');
  const imp = item('Import saves…', async () => {
    const file = await pickFile('.gwb');
    if (!file) return;
    status.textContent = `Importing ${file.name}…`;
    try { const n = await host('import-saves', { bytes: await file.arrayBuffer() }); status.textContent = `Imported ${n} save${n === 1 ? '' : 's'}.`; refresh(page); } catch (e) { status.textContent = e.message; }
  });
  const exp = item('Export saves', async () => {
    try { const n = await host('export-saves'); status.textContent = `Exported ${n} save${n === 1 ? '' : 's'} to gmod-saves.gwb.`; } catch (e) { status.textContent = e.message; }
  });
  if (anchor) anchor.after(imp, exp, status); else ul.append(imp, exp, status);
  // "Open folder" has no meaning in a browser: point it at export instead of a Windows Explorer call.
  if (anchor) anchor.style.display = 'none';
}

// Multiplayer page: peer-to-peer play (web/p2p.js). The in-game server browser stays the way to play; this only builds the
// network under it. Host: Start New Game with more than one player, then "Invite a player" here and send the code. Joiner:
// paste it, send the reply code back; the game connects when the link is up. Both players must run the same edition.
async function serversSidebar(page, ul) {
  try { if ((await host('p2p-status')).disabled) return; } catch { return; }   // experimental: only with ?mp=1
  const status = note(), header = document.createElement('li');
  header.innerHTML = '<a class="notactive" style="pointer-events:none">Play over the internet or LAN</a>';
  const field = (label, readonly = false) => {
    const li = document.createElement('li'), ta = document.createElement('textarea');
    li.className = 'wasm-note'; li.style.cssText = 'padding:2px 0 2px 8px;white-space:normal;font-size:11px;opacity:.9';
    ta.rows = 3; ta.readOnly = readonly; ta.placeholder = label; ta.style.cssText = 'width:92%;font-size:10px;word-break:break-all;resize:none';
    li.append(ta); return { li, ta };
  };
  const out = field('Your code appears here', true), reply = field('Paste the other player\'s code');
  out.li.hidden = reply.li.hidden = true;
  const show = (text, readonly = true) => { out.ta.value = text; out.li.hidden = !text; if (text && readonly) out.ta.select(); };
  const refresh = async () => {
    try {
      const st = await host('p2p-status');
      status.textContent = st.role === 'host' ? `Hosting as ${st.ip}. ${st.peers.length} player${st.peers.length === 1 ? '' : 's'} linked${st.pending.length ? `, ${st.pending.length} waiting for a reply` : ''}.`
        : st.role === 'guest' ? (st.peers.length ? `Linked to the host. Connecting to ${'10.77.0.1'}…` : 'Waiting for the host to finish pairing…') : 'Not linked. Both players need the same edition.';
      return st;
    } catch (e) { status.textContent = e.message; }
  };
  let wait = 0;
  const connectWhenLinked = () => {
    clearInterval(wait); let tries = 0;
    wait = setInterval(async () => {
      const st = await refresh();
      if (st?.role === 'guest' && st.peers.length) { clearInterval(wait); lua('RunConsoleCommand("connect","10.77.0.1")'); }
      else if (++tries > 120) clearInterval(wait);
    }, 1000);
  };
  const invite = item('Invite a player…', async () => {
    try { const r = await host('p2p-invite'); show(r.code); reply.li.hidden = false; reply.ta.placeholder = 'Paste their reply code, then press "Link player"'; status.textContent = `Send this code. They will be ${r.ip}.`; } catch (e) { status.textContent = e.message; }
  });
  const link = item('Link player (enter their reply)', async () => {
    try { await host('p2p-finish', { code: reply.ta.value }); reply.ta.value = ''; await refresh(); } catch (e) { status.textContent = e.message; }
  });
  const join = item('Join with an invite…', async () => {
    const code = reply.ta.value.trim();
    reply.li.hidden = false;
    if (!code) { reply.ta.placeholder = 'Paste the host\'s invite code here, then press this again'; status.textContent = 'Paste the invite code, then press Join again.'; return; }
    try { const r = await host('p2p-accept', { code }); reply.ta.value = ''; show(r); status.textContent = 'Send this reply code back to the host.'; connectWhenLinked(); } catch (e) { status.textContent = e.message; }
  });
  const leave = item('Disconnect', async () => { try { await host('p2p-leave'); show(''); await refresh(); lua('RunConsoleCommand("disconnect")'); } catch (e) { status.textContent = e.message; } });
  ul.append(document.createElement('li'), header, invite, link, join, leave, out.li, reply.li, status);
  refresh();
}

const done = new WeakSet();
function scan() {
  if (!window.__gmodHost) return;
  for (const [ctrl, add] of [['ControllerAddons', addonsSidebar], ['ControllerSaves', savesSidebar], ['ControllerServers', serversSidebar]]) {
    for (const page of document.querySelectorAll(`[ng-controller="${ctrl}"]`)) {
      const ul = page.querySelector('.options > ul');
      if (!ul || done.has(page)) continue;
      done.add(page);
      add(page, ul);
    }
  }
}
new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
scan();
