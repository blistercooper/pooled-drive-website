/* Pooled Drive web app. Talks to Google Drive straight from your browser. No server in between. */
(function () {
'use strict';
const CFG = window.POOLED_CONFIG || {};
const QS = new URLSearchParams(location.search);
const hasId = !!(CFG.clientId && !/PASTE|YOUR/i.test(CFG.clientId));
const DEMO = QS.has('demo') || window.POOLED_FORCE_DEMO === true || !hasId;
const SCOPE = 'openid email https://www.googleapis.com/auth/drive.file';
const MB = 1048576, GB = 1073741824, DAY = 86400000;
const BUILD = '2026-11-15 d';

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = b => b >= 1099511627776 ? (b / 1099511627776).toFixed(2) + ' TB' : b >= GB ? (b / GB).toFixed(b >= 10 * GB ? 0 : 1) + ' GB' : b >= MB ? Math.round(b / MB) + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' KB' : b + ' B';
const gb1 = b => (b / GB).toFixed(1);
const wait = ms => new Promise(r => setTimeout(r, ms));
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const sess = {
  get(k, d) { try { const v = JSON.parse(sessionStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } },
  set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

/* ---------- icons ---------- */
const P = {
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  drives: '<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 6h.01M6 18h.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  up: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  down: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  move: '<path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 12h18"/><path d="M17 3v18"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
  zip: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  phone: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'
};
const ic = n => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (P[n] || P.file) + '</svg>';
const CLOUD = 'M19.35,10.04C18.67,6.59 15.64,4 12,4 9.11,4 6.6,5.64 5.35,8.04 2.34,8.36 0,10.91 0,14c0,3.31 2.69,6 6,6h13c2.76,0 5,-2.24 5,-5 0,-2.64 -2.05,-4.78 -4.65,-4.96z';

/* ---------- state ---------- */
const S = {
  theme: store.get('pd.theme', 'auto'), pct: store.get('pd.pct', 67), layout: store.get('pd.layout', 'list'),
  view: 'dash', accounts: [], files: [], loading: false, sel: new Set(), filter: 'All', sort: 'new', q: '', eq: 0,
  tx: [], helpTab: 0, ready: false, error: null
};
const kind = f => {
  const m = f.mime || '', n = f.name.toLowerCase();
  if (m.startsWith('video/')) return 'film'; if (m.startsWith('image/')) return 'image'; if (m.startsWith('audio/')) return 'music';
  if (/\.(zip|rar|7z|tar|gz)$/.test(n)) return 'zip'; return 'file';
};
const room = a => Math.max(0, a.limit * S.pct / 100 - a.usage);
const atLimit = a => a.limit > 0 && a.usage >= a.limit * S.pct / 100;
const live = () => S.accounts.filter(a => a.ok);
const byEmail = e => S.accounts.find(a => a.email === e);

/* Where does each file go? Same rule as the Android app. */
function plan(sizes, slots) {
  const free = new Map(slots.map(s => [s.id, s.free]));
  const out = new Array(sizes.length).fill(null);
  sizes.map((s, i) => i).sort((a, b) => sizes[b] - sizes[a]).forEach(i => {
    let pick = null;
    for (const [id, f] of free) {
      if (f < sizes[i]) continue;
      if (pick === null) { pick = id; continue; }
      const best = free.get(pick);
      pick = sizes[i] >= 100 * MB ? (f > best ? id : pick) : (f < best ? id : pick);
    }
    if (pick !== null) { free.set(pick, free.get(pick) - sizes[i]); out[i] = pick; }
  });
  return out;
}
const slots = () => live().map(a => ({ id: a.email, free: room(a) }));

/* ---------- backend: real Google Drive ---------- */
const D = 'https://www.googleapis.com/drive/v3';
const real = (() => {
  let client = null, waiting = null;
  const tok = sess.get('pd.tok', {});
  const saveTok = () => sess.set('pd.tok', tok);
  const loadGIS = () => new Promise((res, rej) => {
    if (window.google && window.google.accounts) return res();
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error('Could not load Google sign-in. Check your connection.'));
    document.head.appendChild(s);
  });
  async function init() {
    await loadGIS();
    client = google.accounts.oauth2.initTokenClient({
      client_id: CFG.clientId, scope: SCOPE,
      callback: r => waiting && waiting.res(r),
      error_callback: e => waiting && waiting.rej(new Error(e.type === 'popup_closed' ? 'The sign-in window was closed.' : e.type === 'popup_failed_to_open' ? (navigator.standalone === true ? 'Google sign-in can not open from the Home Screen icon on iPhone. Open this page in Safari, sign in there, then come back.' : 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.') : (e.message || 'Sign-in failed.')))
    });
  }
  function ask(hint, prompt) {
    return new Promise((res, rej) => { waiting = { res, rej }; client.requestAccessToken({ prompt: prompt, login_hint: hint || undefined }); })
      .then(r => {
        if (r.error) throw new Error(r.error_description || r.error);
        if (r.scope && r.scope.indexOf('drive.file') < 0) throw new Error('Please allow access to Drive files, then try again.');
        return r;
      });
  }
  const has = a => { const c = tok[a.email]; return !!(c && Date.now() < c.exp - 60000); };
  async function token(a) {
    const c = tok[a.email];
    if (c && Date.now() < c.exp - 60000) return c.t;
    const r = await ask(a.email, '');
    tok[a.email] = { t: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1000 }; saveTok();
    return r.access_token;
  }
  async function connect(hint) {
    const r = await ask(hint, hint ? '' : 'select_account');
    const u = await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + r.access_token } })).json();
    const email = (u.email || '').toLowerCase();
    if (!email) throw new Error('Google did not return an email address.');
    tok[email] = { t: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1000 }; saveTok();
    return { email };
  }
  async function call(a, url, init, retry) {
    const t = await token(a);
    const h = Object.assign({ Authorization: 'Bearer ' + t }, (init && init.headers) || {});
    const r = await fetch(url, Object.assign({}, init, { headers: h }));
    if (r.status === 401 && retry !== false) { delete tok[a.email]; saveTok(); return call(a, url, init, false); }
    if (!r.ok) { let m = 'Google Drive error ' + r.status; try { const j = await r.json(); if (j.error && j.error.message) m = j.error.message; } catch (e) {} throw new Error(m); }
    return r;
  }
  const json = async (a, url, init) => (await call(a, url, init)).json();
  const rec = (x, email) => ({ id: x.id, acc: email, name: x.name, size: +x.size || 0, mime: x.mimeType || '', created: Date.parse(x.createdTime) || Date.now(), src: x.appProperties && x.appProperties.src || null });
  const FIELDS = 'id,name,size,mimeType,createdTime,appProperties';
  async function quota(a) {
    const q = (await json(a, D + '/about?fields=storageQuota')).storageQuota || {};
    return { limit: +q.limit || 1099511627776, usage: +q.usage || 0 };
  }
  async function folder(a) {
    if (a.folderId) return a.folderId;
    const q = encodeURIComponent("name='Pooled Drive' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    const f = (await json(a, D + '/files?q=' + q + '&fields=files(id)&spaces=drive')).files || [];
    if (f.length) a.folderId = f[0].id;
    else a.folderId = (await json(a, D + '/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Pooled Drive', mimeType: 'application/vnd.google-apps.folder' }) })).id;
    persistAccounts();
    return a.folderId;
  }
  async function list(a) {
    const out = []; let page = '';
    const q = encodeURIComponent("appProperties has { key='pool' and value='1' } and trashed=false");
    do {
      const j = await json(a, D + '/files?q=' + q + '&pageSize=1000&fields=nextPageToken,files(' + FIELDS + ')' + (page ? '&pageToken=' + encodeURIComponent(page) : ''));
      (j.files || []).forEach(x => out.push(rec(x, a.email))); page = j.nextPageToken || '';
    } while (page);
    return out;
  }
  const CH = 8 * MB;
  function putChunk(loc, blob, start, total, onP) {
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest(); x.open('PUT', loc);
      x.setRequestHeader('Content-Range', 'bytes ' + start + '-' + (start + blob.size - 1) + '/' + total);
      x.upload.onprogress = e => onP(start + e.loaded);
      x.onload = () => res({ status: x.status, text: x.responseText });
      x.onerror = () => rej(new Error('Network error during upload'));
      x.send(blob);
    });
  }
  async function upload(a, file, onP) {
    if (!file.size) throw new Error('Empty files can not be uploaded.');
    const parent = await folder(a);
    const init = await call(a, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=' + FIELDS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': file.type || 'application/octet-stream', 'X-Upload-Content-Length': String(file.size) },
      body: JSON.stringify({ name: file.name, parents: [parent], appProperties: { pool: '1', src: 'web' } })
    });
    const loc = init.headers.get('Location');
    if (!loc) throw new Error('Google did not start the upload. Your browser may be hiding the session address.');
    let off = 0, tries = 0;
    while (off < file.size) {
      const end = Math.min(off + CH, file.size);
      let r;
      try { r = await putChunk(loc, file.slice(off, end), off, file.size, onP); }
      catch (e) { if (++tries > 4) throw e; await wait(1000 * tries * tries); continue; }
      if (r.status === 308) { off = end; tries = 0; onP(off); }
      else if (r.status === 200 || r.status === 201) return rec(JSON.parse(r.text), a.email);
      else if ((r.status >= 500 || r.status === 429) && ++tries <= 4) await wait(1000 * tries * tries);
      else throw new Error('Upload failed (' + r.status + ')');
    }
    throw new Error('Upload ended without a file.');
  }
  async function remove(f) { await call(byEmail(f.acc), D + '/files/' + f.id, { method: 'DELETE' }); }
  async function blob(f, onP) {
    const r = await call(byEmail(f.acc), D + '/files/' + f.id + '?alt=media');
    if (!r.body || !r.body.getReader || !f.size) return r.blob();
    const rd = r.body.getReader(), parts = []; let got = 0;
    for (;;) { const c = await rd.read(); if (c.done) break; parts.push(c.value); got += c.value.length; onP && onP(got); }
    return new Blob(parts, { type: f.mime });
  }
  async function copy(f, dest, onP) {
    if (dest.email === f.acc) {
      const x = await json(byEmail(f.acc), D + '/files/' + f.id + '/copy?fields=' + FIELDS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Copy of ' + f.name, appProperties: { pool: '1', src: 'web' } }) });
      return rec(x, dest.email);
    }
    const b = await blob(f, p => onP(p / 2));
    return upload(dest, new File([b], f.name, { type: f.mime }), p => onP(f.size / 2 + p / 2));
  }
  async function manifest(a) {
    const q = encodeURIComponent("appProperties has { key='pool' and value='manifest' } and trashed=false");
    const f = (await json(a, D + '/files?q=' + q + '&fields=files(id)&orderBy=modifiedTime%20desc&pageSize=1')).files || [];
    if (!f.length) return [];
    const j = await (await call(a, D + '/files/' + f[0].id + '?alt=media')).json();
    return (j.accounts || []).map(e => String(e).toLowerCase());
  }
  const link = async f => (await json(byEmail(f.acc), D + '/files/' + f.id + '?fields=webViewLink')).webViewLink || 'https://drive.google.com/file/d/' + f.id + '/view';
  const perms = async f => ((await json(byEmail(f.acc), D + '/files/' + f.id + '/permissions?fields=permissions(id,type,role,emailAddress,displayName)')).permissions || []);
  const jp = { 'Content-Type': 'application/json' };
  const shareAnyone = (f, role) => json(byEmail(f.acc), D + '/files/' + f.id + '/permissions?fields=id', { method: 'POST', headers: jp, body: JSON.stringify({ type: 'anyone', role: role, allowFileDiscovery: false }) });
  const sharePerson = (f, email, role) => json(byEmail(f.acc), D + '/files/' + f.id + '/permissions?sendNotificationEmail=true&fields=id', { method: 'POST', headers: jp, body: JSON.stringify({ type: 'user', role: role, emailAddress: email }) });
  const setRole = (f, id, role) => json(byEmail(f.acc), D + '/files/' + f.id + '/permissions/' + id + '?fields=id', { method: 'PATCH', headers: jp, body: JSON.stringify({ role: role }) });
  const unshare = (f, id) => call(byEmail(f.acc), D + '/files/' + f.id + '/permissions/' + id, { method: 'DELETE' });
  return { init, has, connect, manifest, quota, list, upload, remove, blob, copy, link, perms, shareAnyone, sharePerson, setRole, unshare, reconnect: a => connect(a.email) };
})();

/* ---------- backend: demo (sample data, nothing leaves the page) ---------- */
function rng(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const demo = (() => {
  const now = Date.now(); let seq = 100;
  let A = [['maya.main@gmail.com', 8.2], ['maya.work@gmail.com', 11.4], ['maya.photos@gmail.com', 3.1], ['maya.backup@gmail.com', 1.2]];
  const F = [['Wedding_Raw.mov', 3400, 'video/quicktime', 0, 1], ['Goa_Trip.mp4', 2150, 'video/mp4', 1, 2], ['Photos_2025.zip', 850, 'application/zip', 2, 3], ['Lecture_Notes.pdf', 18, 'application/pdf', 3, 4], ['Passport_Scan.jpg', 3.2, 'image/jpeg', 0, 5], ['Sunset_001.jpg', 4.1, 'image/jpeg', 2, 1], ['Podcast_ep12.mp3', 46, 'audio/mpeg', 1, 2], ['Resume.pdf', 0.2, 'application/pdf', 3, 6], ['IMG_20261102.jpg', 3.4, 'image/jpeg', 2, 1], ['Budget.xlsx', 1.1, 'application/vnd.ms-excel', 0, 3], ['Drone_Clip.mp4', 640, 'video/mp4', 1, 1], ['Archive_2024.zip', 1200, 'application/zip', 1, 9]];
  const files = F.map((x, i) => ({ id: 'd' + i, acc: A[x[3]][0], name: x[0], size: Math.round(x[1] * MB), mime: x[2], created: now - x[4] * DAY, src: i % 3 === 0 ? 'Camera' : null }));
  const A0 = A.slice(), files0 = files.slice();
  const pr = {};
  const tick = async (n, onP, ms) => { for (let i = 1; i <= n; i++) { await wait(ms || 60); onP(i / n); } };
  return {
    get accounts() { return A.map(a => ({ email: a[0], limit: 15 * GB, usage: Math.round(a[1] * GB) })); },
    setCount(n) {
      const R = rng(11), NM = ['leo', 'nora', 'omar', 'ivy', 'kai', 'zoe', 'sam', 'ana', 'raj', 'eli', 'mia', 'ben', 'uma', 'dev', 'lia', 'tom', 'sia', 'noa', 'jay', 'ola', 'pia', 'rex', 'ula', 'vik'];
      const MK = [['clip', 'video/mp4', 50, 900, '.mp4'], ['photo', 'image/jpeg', 2, 9, '.jpg'], ['report', 'application/pdf', 1, 30, '.pdf'], ['song', 'audio/mpeg', 4, 12, '.mp3'], ['backup', 'application/zip', 100, 1500, '.zip']];
      A = A0.slice(0, Math.min(n, 4)); files.length = 0;
      files0.forEach(f => { if (A.some(x => x[0] === f.acc)) files.push(Object.assign({}, f)); });
      for (let i = 4; i < n; i++) {
        const email = NM[(i - 4) % NM.length] + (i >= 4 + NM.length ? i : '') + '.drive@gmail.com'; let pooled = 0;
        for (let k = 0, c = 2 + Math.floor(R() * 4); k < c; k++) {
          const t = MK[Math.floor(R() * MK.length)], sz = Math.round((t[2] + R() * (t[3] - t[2])) * MB); pooled += sz;
          files.push({ id: 'g' + i + '_' + k, acc: email, name: t[0] + '_' + (k + 1) + t[4], size: sz, mime: t[1], created: now - Math.floor(R() * 20) * DAY, src: R() < .3 ? 'Camera' : null });
        }
        A.push([email, Math.max(pooled / GB + .4, .5 + R() * 13.5)]);
      }
    },
    init: async () => {}, has: () => true,
    connect: async () => { const n = S.accounts.length + 1; return { email: 'demo.account' + n + '@gmail.com' }; },
    reconnect: async () => {},
    manifest: async () => [],
    quota: async a => ({ limit: 15 * GB, usage: a.usage }),
    list: async a => files.filter(f => f.acc === a.email).map(f => Object.assign({}, f)),
    upload: async (a, file, onP) => { await tick(12, p => onP(p * file.size), 70); const f = { id: 'u' + (++seq), acc: a.email, name: file.name, size: file.size, mime: file.type || '', created: Date.now(), src: 'web' }; files.push(f); return Object.assign({}, f); },
    remove: async f => { const i = files.findIndex(x => x.id === f.id); if (i >= 0) files.splice(i, 1); },
    blob: async (f, onP) => {
      await tick(6, p => onP && onP(p * f.size), 40);
      if (kind(f) === 'image') { const c = document.createElement('canvas'); c.width = 900; c.height = 560; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 900, 560); gr.addColorStop(0, '#2dd4bf'); gr.addColorStop(1, '#6366f1'); g.fillStyle = gr; g.fillRect(0, 0, 900, 560); g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '700 46px sans-serif'; g.textAlign = 'center'; g.fillText(f.name, 450, 290); return new Promise(r => c.toBlob(r, 'image/png')); }
      return new Blob(['Demo preview: this sample file has no real content.'], { type: 'text/plain' });
    },
    copy: async (f, dest, onP) => { await tick(10, p => onP(p * f.size), 60); const n = { id: 'c' + (++seq), acc: dest.email, name: dest.email === f.acc ? 'Copy of ' + f.name : f.name, size: f.size, mime: f.mime, created: Date.now(), src: f.src }; files.push(n); return Object.assign({}, n); },
    link: async f => 'https://drive.google.com/file/d/' + f.id + '/view',
    perms: async f => pr[f.id] || (pr[f.id] = [{ id: 'o', type: 'user', role: 'owner', emailAddress: f.acc, displayName: 'You' }]),
    shareAnyone: async (f, role) => { (await demo.perms(f)).push({ id: 'any', type: 'anyone', role: role }); },
    sharePerson: async (f, email, role) => { (await demo.perms(f)).push({ id: 'p' + (++seq), type: 'user', role: role, emailAddress: email, displayName: email.split('@')[0] }); },
    setRole: async (f, id, role) => { const p = (await demo.perms(f)).find(x => x.id === id); if (p) p.role = role; },
    unshare: async (f, id) => { pr[f.id] = (await demo.perms(f)).filter(x => x.id !== id); }
  };
})();
const B = DEMO ? demo : real;

/* ---------- persistence ---------- */
function persistAccounts() { if (!DEMO) store.set('pd.accounts', S.accounts.map(a => ({ email: a.email, folderId: a.folderId || null }))); }
function applyTheme() {
  const t = S.theme === 'auto' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : S.theme;
  document.documentElement.dataset.theme = t;
  const m = $('meta[name=theme-color]'); if (m) m.content = t === 'dark' ? '#070b16' : '#f3f6ff';
}

window.PD = { BUILD, S, B, DEMO, hasId, P, ic, $, $$, esc, fmt, gb1, wait, store, sess, kind, room, atLimit, live, byEmail, plan, slots, CLOUD, MB, GB, DAY, persistAccounts, applyTheme, CFG };
})();
