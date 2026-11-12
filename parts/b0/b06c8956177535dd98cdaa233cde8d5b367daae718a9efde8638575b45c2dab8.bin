// Upload panel for addons. Files go to the game as garrysmod/addons/<name>.gma or garrysmod/addons/<folder>/...
// (the Steam Workshop is not used; see the addon store in the host).

const css = `
#addons-btn { position: fixed; right: 12px; bottom: 12px; z-index: 10; font: 13px system-ui, sans-serif; padding: 8px 12px; border: 0; border-radius: 6px;
  background: #2b2b2b; color: #eee; cursor: pointer; opacity: .85 }
#addons-btn:hover { opacity: 1 }
#addons-panel { position: fixed; right: 12px; bottom: 52px; z-index: 10; width: 340px; max-height: 60vh; overflow: auto; background: #1d1d1dee; color: #eee;
  font: 13px system-ui, sans-serif; border-radius: 8px; padding: 12px; display: none; box-shadow: 0 4px 24px #0008 }
#addons-panel.open { display: block }
#addons-panel h3 { margin: 0 0 8px; font-size: 14px }
#addons-panel .row { display: flex; gap: 8px; margin-bottom: 8px }
#addons-panel button, #addons-panel label.btn { flex: 1; text-align: center; padding: 7px; background: #3a3a3a; border: 0; border-radius: 5px; color: #eee; cursor: pointer; font: inherit }
#addons-panel .drop { border: 1px dashed #666; border-radius: 6px; padding: 14px; text-align: center; color: #aaa; margin-bottom: 8px }
#addons-panel .drop.over { border-color: #fa0; color: #fa0 }
#addons-panel ul { list-style: none; margin: 0; padding: 0 }
#addons-panel li { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-top: 1px solid #333 }
#addons-panel li span.size { color: #999; margin: 0 8px; white-space: nowrap }
#addons-panel li button { flex: none; padding: 2px 8px }
#addons-status { color: #9c9; min-height: 1.2em; margin-bottom: 6px }
`;

const fmt = (n) => (n > 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function setupAddonPanel({ sendBinary, sendJson, onMessage }) {
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);
  const btn = document.createElement('button'); btn.id = 'addons-btn'; btn.textContent = 'Addons';
  const panel = document.createElement('div'); panel.id = 'addons-panel';
  panel.innerHTML = `<h3>Addons</h3><div id="addons-status"></div>
    <div class="drop" id="addons-drop">Drop .gma files or addon folders here</div>
    <div class="row"><label class="btn">Add .gma<input type="file" id="addons-files" accept=".gma" multiple hidden></label>
    <label class="btn">Add folder<input type="file" id="addons-folder" webkitdirectory multiple hidden></label></div><ul id="addons-list"></ul>`;
  document.body.append(btn, panel);
  const status = panel.querySelector('#addons-status'), list = panel.querySelector('#addons-list'), drop = panel.querySelector('#addons-drop');
  btn.onclick = () => { panel.classList.toggle('open'); if (panel.classList.contains('open')) sendJson({ type: 'addons-list' }); };

  let pending = 0;
  const upload = async (file, rel) => {
    pending++; status.textContent = `Uploading ${rel}...`;
    sendBinary(2, rel, new Uint8Array(await file.arrayBuffer()));
  };
  const walkEntry = async (entry, prefix) => {
    if (entry.isFile) { const file = await new Promise((r) => entry.file(r)); await upload(file, prefix + entry.name); return; }
    const reader = entry.createReader();
    for (;;) {
      const batch = await new Promise((r) => reader.readEntries(r));
      if (!batch.length) break;
      for (const e of batch) await walkEntry(e, `${prefix}${entry.name}/`);
    }
  };
  panel.querySelector('#addons-files').onchange = async (e) => { for (const f of e.target.files) await upload(f, f.name); e.target.value = ''; };
  panel.querySelector('#addons-folder').onchange = async (e) => {
    for (const f of e.target.files) await upload(f, f.webkitRelativePath || f.name);
    e.target.value = '';
  };
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = async (e) => {
    e.preventDefault(); drop.classList.remove('over');
    const entries = [...e.dataTransfer.items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
    for (const entry of entries) await walkEntry(entry, '');
  };

  onMessage((m) => {
    if (m.type === 'addon-saved') { if (--pending <= 0) { pending = 0; status.textContent = 'Uploaded. Restart the map to load new addons.'; sendJson({ type: 'addons-list' }); } }
    else if (m.type === 'addon-error') status.textContent = `Rejected ${m.name}: ${m.error}`;
    else if (m.type === 'addons') {
      list.replaceChildren(...m.items.map((a) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${a.name.replace(/[<>&]/g, '')}</span><span class="size">${fmt(a.size)}</span>`;
        const del = document.createElement('button'); del.textContent = 'Delete'; del.onclick = () => sendJson({ type: 'addons-delete', name: a.name });
        li.append(del); return li;
      }));
    }
  });
}
