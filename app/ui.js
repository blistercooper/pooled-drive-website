/* Pooled Drive web app: screens and actions. */
(function () {
'use strict';
const { S, B, DEMO, hasId, ic, $, $$, esc, fmt, gb1, wait, store, kind, room, atLimit, live, byEmail, plan, slots, CLOUD, MB, GB, DAY, persistAccounts, applyTheme, CFG } = window.PD;
const EQ = f => ['≈ ' + Math.round(f / (4 * MB)).toLocaleString() + ' photos', '≈ ' + Math.round(f / (5 * MB)).toLocaleString() + ' songs', '≈ ' + Math.floor(f / (2 * GB)) + ' movies', '≈ ' + Math.floor(f / (7 * GB)) + ' hours of 4K video'];
const mood = u => u < .1 ? 'Wide open skies' : u < .35 ? 'Plenty of room to float' : u < .6 ? 'Getting cozy up here' : u < .8 ? 'Heavy clouds, rain soon' : 'Storm warning! Add another drive';
const NAV = [['dash', 'Dashboard', 'home'], ['files', 'Files', 'folder'], ['accounts', 'Accounts', 'drives'], ['settings', 'Settings', 'gear'], ['help', 'Help', 'help']];
const TITLES = { dash: ['Dashboard', 'Everything you have, as one cloud'], files: ['Files', 'Every file, whichever Gmail holds it'], accounts: ['Accounts', 'The Google accounts in your pool'], settings: ['Settings', 'Make it yours'], help: ['Help', 'Guide, features and answers'] };
const dateS = t => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/* ---------- toast, modal, transfers ---------- */
let tt; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 3200); }
let onClose = null;
function openModal(html, wide, cb) { const m = $('#modal'); m.className = 'modal' + (wide ? ' wide' : ''); m.innerHTML = html; $('#scrim').classList.add('on'); onClose = cb || null; }
function closeModal() { $('#scrim').classList.remove('on'); $('#modal').innerHTML = ''; if (onClose) { onClose(); onClose = null; } }
let txid = 0, txRaf = 0;
function addTx(name, size, dir, acc) { const t = { id: ++txid, name, size, done: 0, dir, acc, state: 'run' }; S.tx.unshift(t); renderTx(); return t; }
function upd(t, d) { t.done = d; if (!txRaf) txRaf = requestAnimationFrame(() => { txRaf = 0; renderTx(); }); }
function endTx(t, err) { t.state = err ? 'err' : 'ok'; t.error = err; t.done = t.size; renderTx(); if (!err) setTimeout(() => { S.tx = S.tx.filter(x => x !== t); renderTx(); }, 5000); }
function renderTx() {
  const el = $('#tx'); if (!el) return;
  const list = S.tx.slice(0, 6);
  el.classList.toggle('on', list.length > 0);
  el.innerHTML = list.length ? '<div class="card" style="padding:14px 16px"><h2 style="margin-bottom:6px">Transfers <span class="lnk" data-a="txclear">Clear</span></h2>' + list.map(t =>
    '<div class="txi"><div style="display:flex;gap:8px"><span class="nm grow">' + (t.dir === 'up' ? '↑ ' : '↓ ') + esc(t.name) + '</span><span class="tiny muted">' + (t.state === 'err' ? 'Failed' : t.state === 'ok' ? 'Done' : Math.round(t.size ? t.done / t.size * 100 : 0) + '%') + '</span></div>' +
    (t.acc ? '<div class="tiny faint">' + esc(t.acc) + '</div>' : '') +
    (t.state === 'err' ? '<div class="tiny" style="color:var(--bad)">' + esc(t.error || 'Failed') + '</div>' : '<div class="pb"><b style="width:' + (t.size ? Math.min(100, t.done / t.size * 100) : 0) + '%"></b></div>') + '</div>').join('') + '</div>' : '';
}
function confetti() {
  const c = $('#fx'); if (!c || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  c.width = innerWidth; c.height = innerHeight; const g = c.getContext('2d');
  const cs = ['#2dd4bf', '#818cf8', '#fbbf24', '#f472b6', '#ffffff'];
  const ps = Array.from({ length: 90 }, () => ({ x: c.width / 2, y: c.height * .8, a: -Math.PI * (.15 + Math.random() * .7), v: 6 + Math.random() * 11, s: 3 + Math.random() * 5, c: cs[(Math.random() * cs.length) | 0] }));
  let t = 0; (function f() { g.clearRect(0, 0, c.width, c.height); t++; ps.forEach(p => { p.x += Math.cos(p.a) * p.v; p.y += Math.sin(p.a) * p.v + t * .25; p.v *= .985; g.globalAlpha = Math.max(0, 1 - t / 95); g.fillStyle = p.c; g.fillRect(p.x, p.y, p.s, p.s * 1.6); }); if (t < 100) requestAnimationFrame(f); else g.clearRect(0, 0, c.width, c.height); })();
}

/* ---------- data refresh ---------- */
async function refreshAccount(a) {
  if (!B.has(a)) { a.ok = false; return; }
  try {
    const [q, files] = await Promise.all([B.quota(a), B.list(a)]);
    a.limit = q.limit; a.usage = q.usage; a.ok = true; a.err = null;
    S.files = S.files.filter(f => f.acc !== a.email).concat(files);
    const c = store.get('pd.quota', {}); c[a.email] = { limit: q.limit, usage: q.usage }; store.set('pd.quota', c);
  } catch (e) { a.err = e.message; }
}
let refreshing = false;
async function refreshAll(silent) {
  if (refreshing) return; refreshing = true; S.loading = !silent; if (!silent) renderView();
  try { await Promise.all(S.accounts.map(refreshAccount)); } finally { refreshing = false; S.loading = false; S.ready = true; renderView(); }
}
function loadAccounts() {
  if (DEMO) { S.accounts = B.accounts.map(a => Object.assign({ ok: true }, a)); return; }
  const q = store.get('pd.quota', {});
  S.accounts = store.get('pd.accounts', []).map(a => Object.assign({ email: a.email, folderId: a.folderId, limit: (q[a.email] || {}).limit || 15 * GB, usage: (q[a.email] || {}).usage || 0 }, { ok: B.has(a) }));
}
async function addAccount() {
  try {
    const r = await B.connect(); let a = byEmail(r.email);
    if (!a) { a = { email: r.email, limit: 15 * GB, usage: 0, ok: true }; S.accounts.push(a); } else a.ok = true;
    persistAccounts(); await refreshAccount(a); S.sel.clear(); renderView(); toast('Added ' + r.email);
  } catch (e) { toast(e.message); }
}
async function reconnect(a) {
  try { await B.reconnect(a); a.ok = true; await refreshAccount(a); renderView(); toast(a.email + ' reconnected'); return true; }
  catch (e) { toast(e.message); return false; }
}
async function reconnectAll() { for (const a of S.accounts.filter(x => !x.ok)) { if (!(await reconnect(a))) break; } }
function removeAccount(email) {
  openModal('<h3>Remove ' + esc(email) + '?</h3><p class="muted small">This page forgets the account. Its files stay safe in that Google Drive, and come back if you add it again.</p><div style="display:flex;gap:10px;margin-top:16px"><button class="btn grow" data-a="close">Cancel</button><button class="btn d grow" data-a="rmgo" data-id="' + esc(email) + '">Remove</button></div>');
}

/* ---------- derived numbers ---------- */
function totals() {
  const accs = S.accounts, total = accs.reduce((s, a) => s + a.limit, 0), used = accs.reduce((s, a) => s + a.usage, 0);
  const safe = live().reduce((s, a) => s + room(a), 0);
  const recent = S.files.filter(f => f.created > Date.now() - 14 * DAY).reduce((s, f) => s + f.size, 0) / 14;
  const days = recent > 512 * 1024 ? Math.round(safe / recent) : null;
  return { total, used, free: Math.max(0, total - used), safe, frac: total ? used / total : 0, days: days !== null && days <= 3650 ? days : null };
}
const mode = () => S.tx.some(t => t.state === 'run' && t.dir === 'up') ? 'up' : S.tx.some(t => t.state === 'run' && t.dir === 'down') ? 'down' : 'idle';
const need = () => S.accounts.filter(a => !a.ok);

/* ---------- what fills each account: file types in colour ---------- */
const TYPES = [['film', 'Videos'], ['image', 'Photos'], ['file', 'Documents'], ['music', 'Music'], ['zip', 'Archives'], ['other', 'Mail & other']];
const TYPE_FILTER = { film: 'Videos', image: 'Photos', file: 'Docs', music: 'Music', zip: 'Archives' };
function poolAcc() { const T = totals(); return { email: '__pool', label: 'The whole pool', limit: T.total, usage: T.used, ok: true, __pool: true }; }
function typeStats(a) {
  const by = { film: 0, image: 0, file: 0, music: 0, zip: 0 };
  S.files.forEach(f => { if (a.__pool || f.acc === a.email) by[kind(f)] += f.size; });
  const pooled = Object.values(by).reduce((s, v) => s + v, 0);
  by.other = Math.max(0, a.usage - pooled);       // everything in the Google account that Pooled Drive did not create
  return { by, pooled, free: Math.max(0, a.limit - a.usage) };
}
function typeTotals() {
  const t = { film: 0, image: 0, file: 0, music: 0, zip: 0, other: 0 };
  S.accounts.forEach(a => { const st = typeStats(a); Object.keys(t).forEach(k => t[k] += st.by[k]); });
  return t;
}
function stackBar(a, plain) {
  const st = typeStats(a), L = a.limit || 1;
  const parts = TYPES.filter(t => st.by[t[0]] > 0);
  const label = a.email + ': ' + parts.map(t => t[1] + ' ' + fmt(st.by[t[0]])).join(', ') + ', free ' + fmt(st.free);
  return '<div class="sbar' + (a.__pool ? ' big' : '') + '"' + (plain ? '' : ' tabindex="0" role="img" data-pop="' + esc(a.email) + '" aria-label="' + esc(label) + '"') + '>' +
    parts.map(t => '<i data-t="' + t[0] + '" style="width:' + Math.min(100, st.by[t[0]] / L * 100).toFixed(2) + '%"></i>').join('') + '</div>';
}
function typeCard() {
  const p = poolAcc(), st = typeStats(p), U = Math.max(1, p.usage), pc = v => v > 0 && v / U < .01 ? '<1%' : Math.round(v / U * 100) + '%';
  return '<div class="card typecard" style="margin-top:16px"><h2>What is filling your pool</h2><div class="tbody"><div class="donutxl">' + donut(p, true, true) + '</div><div class="tlist">' +
    TYPES.filter(t => st.by[t[0]] > 0).map(t => '<button class="trow" data-hl="' + t[0] + '"' + (t[0] !== 'other' ? ' data-a="typefilter" data-id="' + t[0] + '"' : '') + '><i data-t="' + t[0] + '"></i><span class="grow">' + t[1] + '</span><b>' + fmt(st.by[t[0]]) + '</b><em>' + pc(st.by[t[0]]) + '</em></button>').join('') +
    '<div class="trow free"><i class="free"></i><span class="grow">Free space (not in the ring)</span><b>' + fmt(st.free) + '</b><em></em></div></div></div>' +
    '<div class="tiny faint" style="margin-top:12px;line-height:1.55">The ring shows how the used space is made up. Click a type to see those files. “Mail & other” is everything in these Google accounts that Pooled Drive did not create, such as Gmail, Google Photos and files you added to Drive yourself. Each account’s own breakdown is under Your accounts.</div></div>';
}
function donut(a, withText, byUsed) {
  const st = typeStats(a), R = 22, C = 2 * Math.PI * R, L = byUsed ? Math.max(1, a.usage) : (a.limit || 1); let off = 0, arcs = '';
  TYPES.forEach(t => { const v = st.by[t[0]]; if (v <= 0) return; const len = Math.min(C - off, v / L * C); if (len <= 0) return; arcs += '<circle class="arc" data-t="' + t[0] + '" cx="27" cy="27" r="' + R + '" transform="rotate(-90 27 27)" stroke-dasharray="' + Math.max(.1, len - .7).toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>'; off += len; });
  const ang = (S.pct / 100) * 2 * Math.PI - Math.PI / 2, x1 = 27 + (R - 6) * Math.cos(ang), y1 = 27 + (R - 6) * Math.sin(ang), x2 = 27 + (R + 6) * Math.cos(ang), y2 = 27 + (R + 6) * Math.sin(ang);
  return '<svg class="ring" viewBox="0 0 54 54"><circle class="t" cx="27" cy="27" r="' + R + '"/>' + arcs + (S.pct < 100 && !byUsed ? '<line class="lim" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>' : '') + (byUsed ? '<text class="c1" x="27" y="25" dy=".35em">' + fmt(a.usage) + '</text><text class="c2" x="27" y="33.5" dy=".35em">used</text>' : '') + (withText === false || byUsed ? '' : '<text x="27" y="27" dy=".35em" style="' + (atLimit(a) ? 'fill:var(--warn)' : '') + '">' + Math.round(Math.min(1, a.usage / (a.limit || 1)) * 100) + '</text>') + '</svg>';
}
function popHtml(a) {
  const st = typeStats(a), rows = TYPES.filter(t => st.by[t[0]] > 0);
  return '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px"><b class="nm grow" style="font-size:14px">' + esc(a.label || a.email) + '</b><span class="tiny muted" style="white-space:nowrap">' + gb1(a.usage) + ' of ' + gb1(a.limit) + ' GB</span></div>' +
    '<div class="pbody"><div class="donutlg">' + donut(a) + '</div><div class="plegend">' + rows.map(t => '<div><i data-t="' + t[0] + '"></i><span>' + t[1] + '</span><b>' + fmt(st.by[t[0]]) + '</b></div>').join('') + '<div class="pfree"><i class="free"></i><span>Free</span><b>' + fmt(st.free) + '</b></div></div></div>' +
    (a.ok ? '' : '<div class="tiny" style="color:var(--warn);margin-top:10px">Reconnect this account to see its file types.</div>') +
    '<div class="tiny faint" style="margin-top:10px;line-height:1.5">“Mail & other” is everything in this Google account that Pooled Drive did not create, such as Gmail, Google Photos and files you added to Drive yourself. The small tick marks your mail-safe limit.</div>';
}


/* ---------- many accounts: sort, search, compact rows ---------- */
const COMPACT = 7;
S.accSort = 'attn'; S.accQ = '';
const attn = () => S.accounts.filter(a => !a.ok || atLimit(a)).length;
function sortedAccounts() {
  const q = S.accQ.trim().toLowerCase(), fr = a => a.limit ? a.usage / a.limit : 0, at = a => !a.ok ? 2 : atLimit(a) ? 1 : 0;
  const l = S.accounts.filter(a => !q || a.email.toLowerCase().includes(q));
  if (S.accSort === 'full') l.sort((x, y) => fr(y) - fr(x)); else if (S.accSort === 'room') l.sort((x, y) => room(y) - room(x));
  else if (S.accSort === 'name') l.sort((x, y) => x.email.localeCompare(y.email)); else l.sort((x, y) => at(y) - at(x) || fr(y) - fr(x));
  return l;
}
const accState = a => !a.ok ? ['Reconnect', 'w'] : atLimit(a) ? ['Paused', 'w'] : [gb1(room(a)) + ' GB free', 'g'];
const accRow = a => { const s = accState(a); return '<div class="arow" tabindex="0" data-pop="' + esc(a.email) + '"><span class="nm" title="' + esc(a.email) + '">' + esc(a.email.split('@')[0]) + '</span>' + stackBar(a, true) + '<span class="rmx ' + s[1] + '">' + s[0] + '</span></div>'; };
const accTools = () => '<div class="atools"><select id="asort" aria-label="Sort accounts"><option value="attn"' + (S.accSort === 'attn' ? ' selected' : '') + '>Needs attention first</option><option value="full"' + (S.accSort === 'full' ? ' selected' : '') + '>Fullest first</option><option value="room"' + (S.accSort === 'room' ? ' selected' : '') + '>Most room first</option><option value="name"' + (S.accSort === 'name' ? ' selected' : '') + '>Name A to Z</option></select>' + (S.accounts.length > 10 ? '<input class="field" id="aq" style="height:36px;max-width:220px" placeholder="Find an account" value="' + esc(S.accQ) + '">' : '') + '</div>';
function accountsCard(accs) {
  const head = '<div class="card"><h2>Your accounts <span class="tag">' + accs.length + '</span><span class="lnk" data-a="go" data-id="accounts">Manage</span></h2>';
  if (accs.length <= COMPACT) return head + '<div class="rings">' + accs.map(a => '<div class="ringc" tabindex="0" data-pop="' + esc(a.email) + '">' + ringSvg(a) + '<div class="grow"><div class="nm" title="' + esc(a.email) + '">' + esc(a.email.split('@')[0]) + '</div><div class="tiny ' + (a.ok ? 'muted' : '') + '" style="' + (!a.ok ? 'color:var(--warn)' : '') + '">' + (!a.ok ? 'Reconnect' : atLimit(a) ? 'Paused at limit' : gb1(room(a)) + ' GB room') + '</div></div></div>').join('') + '</div></div>';
  return head + accTools() + '<div class="arows" id="arows">' + sortedAccounts().map(accRow).join('') + '</div></div>';
}
function renderAccRows() { const r = $('#arows'); if (r) r.innerHTML = sortedAccounts().map(accRow).join('') || '<div class="muted small" style="padding:14px">No account matches.</div>'; const d = $('#adet'); if (d) d.innerHTML = accDetails(); }
function accDetail(a) {
  const st = typeStats(a), s = accState(a);
  return '<details class="adet"><summary tabindex="0" data-pop="' + esc(a.email) + '"><span class="nm" title="' + esc(a.email) + '">' + esc(a.email) + '</span>' + stackBar(a, true) + '<span class="tag ' + s[1] + '">' + s[0] + '</span></summary><div class="adbody"><div class="lg2" style="margin-top:0">' +
    TYPES.filter(t => st.by[t[0]] > 0).map(t => '<div><i data-t="' + t[0] + '"></i><span>' + t[1] + '</span><b>' + fmt(st.by[t[0]]) + '</b></div>').join('') + '<div><i class="free"></i><span>Free</span><b>' + fmt(st.free) + '</b></div></div>' +
    (a.err ? '<div class="tiny" style="color:var(--bad);margin-top:8px">' + esc(a.err) + '</div>' : '') +
    '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' + (a.ok ? '' : '<button class="btn p sm" data-a="reconnect" data-id="' + esc(a.email) + '">' + ic('refresh') + 'Reconnect</button>') + '<a class="btn sm" target="_blank" rel="noopener" href="https://drive.google.com/drive/' + (a.folderId ? 'folders/' + a.folderId : 'my-drive') + '?authuser=' + encodeURIComponent(a.email) + '">' + ic('ext') + 'Open in Drive</a><button class="btn d sm" data-a="rm" data-id="' + esc(a.email) + '">' + ic('trash') + 'Remove</button></div></div></details>';
}
const accDetails = () => sortedAccounts().map(accDetail).join('') || '<div class="muted small" style="padding:14px">No account matches.</div>';


/* ---------- the Android app card ---------- */
const UA = navigator.userAgent || '';
const IS_IOS = /iP(hone|ad|od)/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const STANDALONE = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

const APK_REPO = 'blistercooper/pooled-drive-website', APK_PAGE = 'https://github.com/' + APK_REPO + '/releases/latest', APK_DIRECT = 'https://github.com/' + APK_REPO + '/releases/latest/download/PooledDrive.apk';
const QR = { n: 41, d: 'M0 0h7v1h-7zM9 0h4v1h-4zM14 0h1v1h-1zM17 0h7v1h-7zM25 0h2v1h-2zM28 0h1v1h-1zM30 0h2v1h-2zM34 0h7v1h-7zM0 1h1v1h-1zM6 1h1v1h-1zM13 1h2v1h-2zM16 1h2v1h-2zM20 1h2v1h-2zM25 1h1v1h-1zM27 1h3v1h-3zM32 1h1v1h-1zM34 1h1v1h-1zM40 1h1v1h-1zM0 2h1v1h-1zM2 2h3v1h-3zM6 2h1v1h-1zM8 2h3v1h-3zM12 2h3v1h-3zM17 2h2v1h-2zM21 2h3v1h-3zM26 2h3v1h-3zM30 2h2v1h-2zM34 2h1v1h-1zM36 2h3v1h-3zM40 2h1v1h-1zM0 3h1v1h-1zM2 3h3v1h-3zM6 3h1v1h-1zM8 3h3v1h-3zM12 3h1v1h-1zM14 3h2v1h-2zM21 3h1v1h-1zM23 3h2v1h-2zM27 3h1v1h-1zM29 3h1v1h-1zM34 3h1v1h-1zM36 3h3v1h-3zM40 3h1v1h-1zM0 4h1v1h-1zM2 4h3v1h-3zM6 4h1v1h-1zM8 4h1v1h-1zM15 4h1v1h-1zM18 4h3v1h-3zM22 4h3v1h-3zM28 4h1v1h-1zM30 4h3v1h-3zM34 4h1v1h-1zM36 4h3v1h-3zM40 4h1v1h-1zM0 5h1v1h-1zM6 5h1v1h-1zM8 5h1v1h-1zM12 5h2v1h-2zM16 5h1v1h-1zM20 5h1v1h-1zM22 5h1v1h-1zM25 5h1v1h-1zM27 5h3v1h-3zM32 5h1v1h-1zM34 5h1v1h-1zM40 5h1v1h-1zM0 6h7v1h-7zM8 6h1v1h-1zM10 6h1v1h-1zM12 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM18 6h1v1h-1zM20 6h1v1h-1zM22 6h1v1h-1zM24 6h1v1h-1zM26 6h1v1h-1zM28 6h1v1h-1zM30 6h1v1h-1zM32 6h1v1h-1zM34 6h7v1h-7zM8 7h1v1h-1zM11 7h1v1h-1zM13 7h1v1h-1zM15 7h2v1h-2zM18 7h2v1h-2zM21 7h2v1h-2zM27 7h2v1h-2zM31 7h2v1h-2zM0 8h1v1h-1zM2 8h5v1h-5zM10 8h2v1h-2zM13 8h1v1h-1zM17 8h1v1h-1zM20 8h1v1h-1zM22 8h1v1h-1zM24 8h2v1h-2zM29 8h1v1h-1zM31 8h1v1h-1zM34 8h5v1h-5zM4 9h2v1h-2zM9 9h3v1h-3zM13 9h1v1h-1zM17 9h4v1h-4zM23 9h2v1h-2zM28 9h9v1h-9zM38 9h3v1h-3zM0 10h2v1h-2zM4 10h3v1h-3zM8 10h2v1h-2zM11 10h2v1h-2zM16 10h1v1h-1zM18 10h1v1h-1zM20 10h3v1h-3zM26 10h4v1h-4zM32 10h1v1h-1zM35 10h2v1h-2zM3 11h1v1h-1zM5 11h1v1h-1zM7 11h3v1h-3zM12 11h2v1h-2zM19 11h1v1h-1zM21 11h2v1h-2zM27 11h2v1h-2zM31 11h3v1h-3zM35 11h3v1h-3zM40 11h1v1h-1zM4 12h4v1h-4zM9 12h1v1h-1zM11 12h1v1h-1zM14 12h1v1h-1zM16 12h2v1h-2zM20 12h1v1h-1zM22 12h6v1h-6zM29 12h1v1h-1zM31 12h2v1h-2zM35 12h1v1h-1zM37 12h2v1h-2zM40 12h1v1h-1zM0 13h2v1h-2zM3 13h1v1h-1zM5 13h1v1h-1zM7 13h2v1h-2zM10 13h2v1h-2zM13 13h1v1h-1zM15 13h2v1h-2zM21 13h2v1h-2zM26 13h1v1h-1zM28 13h6v1h-6zM35 13h4v1h-4zM40 13h1v1h-1zM0 14h3v1h-3zM5 14h2v1h-2zM9 14h2v1h-2zM13 14h1v1h-1zM15 14h1v1h-1zM20 14h1v1h-1zM22 14h4v1h-4zM27 14h1v1h-1zM29 14h1v1h-1zM32 14h2v1h-2zM35 14h4v1h-4zM0 15h3v1h-3zM4 15h2v1h-2zM7 15h1v1h-1zM9 15h1v1h-1zM11 15h6v1h-6zM18 15h1v1h-1zM21 15h3v1h-3zM26 15h2v1h-2zM34 15h4v1h-4zM40 15h1v1h-1zM1 16h1v1h-1zM3 16h1v1h-1zM5 16h4v1h-4zM10 16h4v1h-4zM16 16h3v1h-3zM22 16h6v1h-6zM29 16h1v1h-1zM31 16h3v1h-3zM35 16h1v1h-1zM38 16h1v1h-1zM40 16h1v1h-1zM0 17h1v1h-1zM2 17h1v1h-1zM4 17h2v1h-2zM8 17h3v1h-3zM13 17h2v1h-2zM16 17h1v1h-1zM18 17h3v1h-3zM23 17h1v1h-1zM26 17h1v1h-1zM28 17h1v1h-1zM30 17h3v1h-3zM34 17h3v1h-3zM39 17h2v1h-2zM0 18h2v1h-2zM3 18h7v1h-7zM12 18h1v1h-1zM15 18h2v1h-2zM18 18h1v1h-1zM20 18h1v1h-1zM22 18h1v1h-1zM24 18h1v1h-1zM27 18h1v1h-1zM32 18h2v1h-2zM36 18h1v1h-1zM38 18h1v1h-1zM1 19h1v1h-1zM4 19h2v1h-2zM8 19h1v1h-1zM10 19h2v1h-2zM14 19h3v1h-3zM19 19h2v1h-2zM27 19h2v1h-2zM32 19h3v1h-3zM36 19h2v1h-2zM40 19h1v1h-1zM0 20h1v1h-1zM2 20h1v1h-1zM6 20h2v1h-2zM10 20h2v1h-2zM13 20h2v1h-2zM16 20h1v1h-1zM18 20h5v1h-5zM24 20h1v1h-1zM27 20h1v1h-1zM29 20h2v1h-2zM33 20h1v1h-1zM38 20h2v1h-2zM5 21h1v1h-1zM11 21h1v1h-1zM13 21h2v1h-2zM19 21h3v1h-3zM23 21h1v1h-1zM25 21h1v1h-1zM29 21h12v1h-12zM0 22h1v1h-1zM2 22h3v1h-3zM6 22h3v1h-3zM10 22h1v1h-1zM16 22h1v1h-1zM24 22h4v1h-4zM30 22h1v1h-1zM33 22h1v1h-1zM35 22h4v1h-4zM2 23h1v1h-1zM4 23h2v1h-2zM11 23h1v1h-1zM15 23h1v1h-1zM19 23h1v1h-1zM21 23h1v1h-1zM23 23h1v1h-1zM27 23h2v1h-2zM35 23h3v1h-3zM39 23h2v1h-2zM0 24h2v1h-2zM5 24h5v1h-5zM11 24h5v1h-5zM17 24h1v1h-1zM20 24h1v1h-1zM22 24h1v1h-1zM24 24h6v1h-6zM38 24h1v1h-1zM40 24h1v1h-1zM0 25h3v1h-3zM5 25h1v1h-1zM7 25h2v1h-2zM10 25h3v1h-3zM19 25h3v1h-3zM23 25h1v1h-1zM28 25h2v1h-2zM31 25h1v1h-1zM34 25h4v1h-4zM39 25h2v1h-2zM0 26h1v1h-1zM3 26h1v1h-1zM6 26h2v1h-2zM9 26h1v1h-1zM13 26h1v1h-1zM16 26h1v1h-1zM20 26h1v1h-1zM22 26h1v1h-1zM25 26h1v1h-1zM27 26h1v1h-1zM32 26h1v1h-1zM36 26h1v1h-1zM1 27h1v1h-1zM3 27h2v1h-2zM7 27h4v1h-4zM13 27h2v1h-2zM16 27h1v1h-1zM18 27h1v1h-1zM21 27h3v1h-3zM27 27h1v1h-1zM30 27h4v1h-4zM35 27h1v1h-1zM37 27h1v1h-1zM39 27h1v1h-1zM0 28h2v1h-2zM4 28h1v1h-1zM6 28h1v1h-1zM9 28h2v1h-2zM13 28h1v1h-1zM17 28h1v1h-1zM19 28h1v1h-1zM22 28h2v1h-2zM25 28h2v1h-2zM28 28h2v1h-2zM31 28h1v1h-1zM37 28h3v1h-3zM0 29h1v1h-1zM3 29h3v1h-3zM7 29h1v1h-1zM9 29h2v1h-2zM13 29h1v1h-1zM17 29h2v1h-2zM20 29h1v1h-1zM24 29h1v1h-1zM28 29h5v1h-5zM34 29h7v1h-7zM0 30h1v1h-1zM2 30h1v1h-1zM5 30h4v1h-4zM12 30h1v1h-1zM16 30h2v1h-2zM19 30h1v1h-1zM22 30h1v1h-1zM26 30h3v1h-3zM33 30h2v1h-2zM36 30h4v1h-4zM0 31h1v1h-1zM2 31h2v1h-2zM5 31h1v1h-1zM9 31h2v1h-2zM13 31h4v1h-4zM19 31h3v1h-3zM24 31h1v1h-1zM27 31h1v1h-1zM30 31h2v1h-2zM33 31h2v1h-2zM36 31h2v1h-2zM0 32h1v1h-1zM2 32h3v1h-3zM6 32h3v1h-3zM10 32h1v1h-1zM12 32h2v1h-2zM15 32h2v1h-2zM19 32h1v1h-1zM22 32h1v1h-1zM24 32h2v1h-2zM27 32h3v1h-3zM32 32h7v1h-7zM8 33h2v1h-2zM14 33h1v1h-1zM16 33h2v1h-2zM19 33h3v1h-3zM23 33h1v1h-1zM25 33h1v1h-1zM28 33h3v1h-3zM32 33h1v1h-1zM36 33h2v1h-2zM39 33h2v1h-2zM0 34h7v1h-7zM9 34h1v1h-1zM11 34h3v1h-3zM16 34h2v1h-2zM21 34h1v1h-1zM25 34h5v1h-5zM31 34h2v1h-2zM34 34h1v1h-1zM36 34h2v1h-2zM0 35h1v1h-1zM6 35h1v1h-1zM8 35h1v1h-1zM10 35h4v1h-4zM15 35h4v1h-4zM20 35h4v1h-4zM25 35h1v1h-1zM27 35h1v1h-1zM30 35h3v1h-3zM36 35h2v1h-2zM39 35h2v1h-2zM0 36h1v1h-1zM2 36h3v1h-3zM6 36h1v1h-1zM8 36h1v1h-1zM11 36h1v1h-1zM13 36h3v1h-3zM19 36h1v1h-1zM21 36h1v1h-1zM23 36h1v1h-1zM26 36h2v1h-2zM29 36h1v1h-1zM32 36h5v1h-5zM38 36h2v1h-2zM0 37h1v1h-1zM2 37h3v1h-3zM6 37h1v1h-1zM8 37h1v1h-1zM12 37h2v1h-2zM15 37h2v1h-2zM18 37h3v1h-3zM22 37h2v1h-2zM28 37h1v1h-1zM30 37h4v1h-4zM35 37h1v1h-1zM37 37h2v1h-2zM0 38h1v1h-1zM2 38h3v1h-3zM6 38h1v1h-1zM8 38h3v1h-3zM12 38h1v1h-1zM14 38h1v1h-1zM18 38h1v1h-1zM20 38h3v1h-3zM25 38h1v1h-1zM27 38h2v1h-2zM33 38h4v1h-4zM0 39h1v1h-1zM6 39h1v1h-1zM11 39h2v1h-2zM14 39h1v1h-1zM16 39h2v1h-2zM20 39h2v1h-2zM24 39h1v1h-1zM26 39h3v1h-3zM30 39h3v1h-3zM34 39h1v1h-1zM36 39h2v1h-2zM39 39h1v1h-1zM0 40h7v1h-7zM8 40h1v1h-1zM10 40h2v1h-2zM13 40h1v1h-1zM15 40h1v1h-1zM18 40h1v1h-1zM22 40h6v1h-6zM29 40h1v1h-1zM31 40h1v1h-1zM34 40h3v1h-3zM38 40h1v1h-1z' };
const ago = t => { const d = Math.floor((Date.now() - Date.parse(t)) / DAY); return d < 1 ? 'today' : d === 1 ? 'yesterday' : d < 30 ? d + ' days ago' : new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
const verName = t => /^v\d+$/.test(t || '') ? '1.' + t.slice(1) : (t || '');
function apkMeta() { const a = S.apk; if (!a) return 'Latest version on GitHub'; return [a.tag ? 'Version ' + verName(a.tag) : '', a.size ? fmt(a.size) : '', a.date ? 'updated ' + ago(a.date) : ''].filter(Boolean).join(' · '); }
function iosCard() {
  return '<div class="appcard"><div class="ahead"><span class="aico">' + ic('phone') + '</span><div><div class="at">Add it to your iPhone</div><div class="as">Works like an app. No App Store.</div></div></div>' +
    '<ol class="steps"><li><span>Open this page in <b>Safari</b></span></li><li><span>Tap the <b>Share</b> button</span></li><li><span>Choose <b>Add to Home Screen</b></span></li></ol>' +
    '<div class="ahint">The Android app is Android only. This website does the same job.</div></div>';
}
function appCard() {
  if (STANDALONE) return '';
  if (IS_IOS) return iosCard();
  const href = APK_DIRECT, w = QR.n + 4;
  return '<div class="appcard"><div class="ahead"><span class="aico">' + ic('phone') + '</span><div><div class="at">Get the Android app</div><div class="as">Morning backup, in your pocket</div></div></div>' +
    '<div class="qrplate"><svg viewBox="-2 -2 ' + w + ' ' + w + '" shape-rendering="crispEdges" role="img" aria-label="QR code for the Android app download page"><rect x="-2" y="-2" width="' + w + '" height="' + w + '" fill="#fff"/><path d="' + QR.d + '" fill="#0a1020"/></svg><div class="qrcap">Scan with your phone</div></div>' +
    '<a class="btn p apkbtn" href="' + href + '" target="_blank" rel="noopener">' + ic('down') + 'Download APK</a><div class="ameta"><span id="apkmeta">' + esc(apkMeta()) + '</span> · <a href="' + APK_PAGE + '" target="_blank" rel="noopener">all versions</a></div>' +
    '<div class="ahint">Android asks once to allow installs from your browser. After that the app updates itself.</div></div>';
}
function showApk() { const m = $('#apkmeta'); if (m) m.textContent = apkMeta(); }
async function loadApk() {
  if (DEMO) { S.apk = { tag: 'v12', size: 14.6 * MB | 0, date: new Date(Date.now() - 2 * DAY).toISOString(), url: APK_PAGE }; showApk(); return; }
  const c = window.PD.sess.get('pd.apk', null);
  if (c && Date.now() - c.t < 30 * 60000) { S.apk = c.v; showApk(); return; }
  try {
    const r = await fetch('https://api.github.com/repos/' + APK_REPO + '/releases/latest'); if (!r.ok) return;
    const j = await r.json(), f = (j.assets || []).find(x => /\.apk$/i.test(x.name));
    S.apk = { tag: j.tag_name, size: f ? f.size : 0, date: j.published_at, url: f ? f.browser_download_url : j.html_url };
    window.PD.sess.set('pd.apk', { t: Date.now(), v: S.apk }); showApk();
  } catch (e) { /* offline or blocked: the card still works as a link */ }
}

/* ---------- views ---------- */
const frow = f => { const sel = S.sel.has(f.id); return '<div class="fr' + (sel ? ' sel' : '') + '" data-a="row" data-id="' + f.id + '"><span class="ck" data-a="ck" data-id="' + f.id + '">' + ic('check') + '</span><div class="av">' + ic(kind(f)) + '</div><div class="grow"><div class="nm">' + esc(f.name) + '</div><div class="sb">' + esc(f.acc) + '</div></div><span class="tag">' + fmt(f.size) + '</span><span class="small faint" style="min-width:92px;text-align:right">' + dateS(f.created) + '</span></div>'; };
const fgrid = f => { const sel = S.sel.has(f.id); return '<div class="fg' + (sel ? ' sel' : '') + '" data-a="row" data-id="' + f.id + '"><span class="ck" data-a="ck" data-id="' + f.id + '">' + ic('check') + '</span><div class="big-i">' + ic(kind(f)) + '</div><div class="nm">' + esc(f.name) + '</div><div class="sb">' + esc(f.acc) + '</div><div style="margin-top:8px"><span class="tag">' + fmt(f.size) + '</span></div></div>'; };
const mini = f => '<div class="row" data-a="open" data-id="' + f.id + '" style="cursor:pointer"><div class="av">' + ic(kind(f)) + '</div><div class="grow"><div class="nm">' + esc(f.name) + '</div><div class="sb">' + esc(f.acc) + '</div></div><span class="tag">' + fmt(f.size) + '</span></div>';
const ringSvg = a => donut(a);
const banner = () => need().length ? '<div class="banner">' + ic('refresh') + '<span class="grow"><b>' + need().length + ' account' + (need().length > 1 ? 's' : '') + ' need to reconnect.</b> Google sign-ins last about an hour in a browser.</span><button class="btn p sm" data-a="reconnectall">Reconnect</button></div>' : '';
const demoBanner = () => DEMO ? '<div class="banner">' + ic('shield') + '<span class="grow"><b>Demo mode.</b> You are looking at sample data. Nothing here touches Google. Try it with <button class="chip' + (S.accounts.length === 4 ? ' on' : '') + '" data-a="demon" data-id="4">4</button><button class="chip' + (S.accounts.length === 12 ? ' on' : '') + '" data-a="demon" data-id="12">12</button><button class="chip' + (S.accounts.length === 20 ? ' on' : '') + '" data-a="demon" data-id="20">20</button> accounts.' + (hasId ? '' : ' To connect your real accounts, add your Web client ID in <code>config.js</code> (see the setup guide).') + '</span></div>' : '';

function dash() {
  const T = totals(), m = mode(), accs = S.accounts;
  if (!accs.length) return welcome();
  const status = m === 'up' ? 'Raining files into your cloud…' : m === 'down' ? 'Your cloud is raining files to you…' : T.days !== null ? 'At your pace: about ' + T.days + ' days until full' : mood(T.frac);
  const big = plan([GB], slots())[0], small = plan([5 * MB], slots())[0];
  const row = (l, e) => '<div style="margin-bottom:10px"><div class="tiny muted">' + l + '</div>' + (e ? '<div style="font-weight:650;color:var(--a1)">' + esc(e) + ' <span class="muted small" style="font-weight:500">· ' + gb1(room(byEmail(e))) + ' GB room</span></div>' : '<div style="color:var(--warn);font-weight:600">No drive has room. Add one or raise the limit.</div>') + '</div>';
  const hogs = [...S.files].sort((a, b) => b.size - a.size).slice(0, 5), recent = [...S.files].sort((a, b) => b.created - a.created).slice(0, 5);
  return demoBanner() + banner() + '<div class="card hero' + (appCard() ? '' : ' nocard') + '"><svg class="cloud" viewBox="0 0 26 24"><defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--a1)"/><stop offset="1" style="stop-color:var(--a2)"/></linearGradient><clipPath id="clp"><path d="' + CLOUD + '"/></clipPath></defs><g transform="translate(1 .5)"><path d="' + CLOUD + '" style="fill:var(--bg);fill-opacity:.55;stroke:none"/><g clip-path="url(#clp)"><path id="w2" style="fill:url(#cg);fill-opacity:.35;stroke:none"/><path id="w1" style="fill:url(#cg);stroke:none"/></g><path d="' + CLOUD + '" style="stroke:url(#cg);stroke-width:1.1;fill:none"/><g id="rainU" style="stroke:var(--a1);stroke-width:.35;stroke-linecap:round"></g><g id="rainD" style="stroke:var(--a1);stroke-width:.35;stroke-linecap:round"></g></g></svg>' +
    '<div><div class="muted small">Your pooled cloud</div><div class="big">' + fmt(T.free) + '</div><div class="muted">free of ' + fmt(T.total) + ' across ' + accs.length + ' account' + (accs.length > 1 ? 's' : '') + '</div>' +
    '<div style="height:14px"></div>' +
    '<div style="color:' + (m === 'idle' ? 'var(--muted)' : 'var(--a1)') + ';font-weight:600;font-size:14px">' + status + '</div>' +
    '<span class="eq" data-a="eq">Room for ' + EQ(T.free)[S.eq % 4] + ' · tap me</span>' +
    '<div class="status"><span class="tag g">Mail-safe ' + S.pct + '%</span><span class="tag">' + fmt(T.safe) + ' safe room</span>' + (attn() ? '<button class="tag w" data-a="attn">' + attn() + ' need attention</button>' : '') + '</div>' +
    '<div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap"><button class="btn p" data-a="pick">' + ic('up') + 'Upload files</button><button class="btn" data-a="add">' + ic('plus') + 'Add account</button></div></div>' + appCard() + '</div>' +
    '<div class="grid g3" style="margin-top:16px"><div class="card stat"><div class="n">' + fmt(T.used) + '</div><div class="l">Used across the pool</div></div><div class="card stat"><div class="n">' + S.files.length + '</div><div class="l">Files stored by Pooled Drive</div></div><div class="card stat"><div class="n">' + fmt(S.files.reduce((s, f) => s + f.size, 0)) + '</div><div class="l">Size of those files</div></div></div>' +
    typeCard() +
    '<div class="grid g12" style="margin-top:16px">' + accountsCard(accs) +
    '<div class="card"><h2>Smart placement</h2>' + row('Next big file', big) + row('Next small file', small) + '<div class="tiny faint">Big files (100 MB and up) go to the drive with the most room. Small ones fill gaps in the fullest drive that still fits.</div><hr><div style="display:flex"><b class="grow" style="font-size:14px">Mail-safe limit</b><span class="muted small" id="pctl">' + S.pct + '% · about ' + (15 * S.pct / 100).toFixed(1) + ' of 15 GB</span></div><input type="range" id="pct" min="50" max="100" value="' + S.pct + '" aria-label="Mail-safe limit"><div class="tiny faint">Uploads stop on a Gmail at this level so mail keeps arriving. Gmail, Drive and Photos all count.</div></div></div>' +
    '<div class="grid g2" style="margin-top:16px"><div class="card"><h2>Recent files <span class="lnk" data-a="go" data-id="files">See all</span></h2>' + (recent.map(mini).join('') || '<p class="muted small">No files yet.</p>') + '</div><div class="card"><h2>Space hogs <span class="lnk" data-a="go" data-id="files">Biggest files</span></h2>' + (hogs.map(mini).join('') || '<p class="muted small">No files yet.</p>') + '</div></div>';
}
function welcome() {
  return demoBanner() + '<div class="welcome"><svg viewBox="0 0 26 24" style="width:140px;height:130px;margin:0 auto 10px;display:block"><defs><linearGradient id="wg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--a1)"/><stop offset="1" style="stop-color:var(--a2)"/></linearGradient></defs><g transform="translate(1 .5)"><path d="' + CLOUD + '" style="stroke:url(#wg);stroke-width:1.1;fill:none"/></g></svg><div class="big">Pool your drives</div><p class="muted" style="font-size:16px;line-height:1.6">Sign in with the Google accounts you own and see all their free space as one cloud. The page picks the best account for every file.</p><button class="btn p" data-a="add" style="margin-top:12px">' + ic('plus') + 'Connect a Google account</button><p class="tiny faint" style="margin-top:18px">Your files go only between this browser and Google. There is no Pooled Drive server.</p></div>';
}
const FILTERS = ['All', 'Videos', 'Photos', 'Docs', 'Music', 'Archives', 'Phone backups'];
function filtered() {
  const q = S.q.trim().toLowerCase();
  let l = S.files.filter(f => (S.filter === 'All' || (S.filter === 'Videos' && kind(f) === 'film') || (S.filter === 'Photos' && kind(f) === 'image') || (S.filter === 'Docs' && kind(f) === 'file') || (S.filter === 'Music' && kind(f) === 'music') || (S.filter === 'Archives' && kind(f) === 'zip') || (S.filter === 'Phone backups' && f.src && f.src !== 'web')) && (!q || f.name.toLowerCase().includes(q) || f.acc.toLowerCase().includes(q)));
  return S.sort === 'size' ? l.sort((a, b) => b.size - a.size) : S.sort === 'name' ? l.sort((a, b) => a.name.localeCompare(b.name)) : l.sort((a, b) => b.created - a.created);
}
function fileList() {
  const l = filtered();
  if (S.loading && !S.files.length) return '<div class="empty">' + ic('refresh') + '<div>Loading your files…</div></div>';
  if (!l.length) return '<div class="empty">' + ic('cloud') + '<div style="font-weight:600;color:var(--text)">' + (S.files.length ? 'Nothing matches' : 'No files yet') + '</div><div class="small" style="margin-top:6px">' + (S.files.length ? 'Try another search or filter.' : 'Drag files onto this page, or press Upload.') + '</div></div>';
  return S.layout === 'grid' ? '<div class="fgrid">' + l.map(fgrid).join('') + '</div>' : '<div class="flist">' + l.map(frow).join('') + '</div>';
}
function files() {
  return demoBanner() + banner() + '<div class="bar">' + FILTERS.map(f => '<button class="chip' + (f === S.filter ? ' on' : '') + '" data-a="filter" data-id="' + f + '">' + f + '</button>').join('') +
    '<span class="grow"></span><select id="sort" aria-label="Sort"><option value="new"' + (S.sort === 'new' ? ' selected' : '') + '>Newest first</option><option value="size"' + (S.sort === 'size' ? ' selected' : '') + '>Largest first</option><option value="name"' + (S.sort === 'name' ? ' selected' : '') + '>Name A to Z</option></select>' +
    '<button class="iconb" data-a="layout" aria-label="Switch layout" title="Switch layout">' + ic(S.layout === 'grid' ? 'list' : 'grid') + '</button><button class="btn p sm" data-a="pick">' + ic('up') + 'Upload</button></div><div class="small muted" style="margin:-4px 0 12px" id="cnt"></div><div id="fl">' + fileList() + '</div>';
}
function accounts() {
  if (S.accounts.length > COMPACT) return demoBanner() + banner() + '<div class="card"><h2>Accounts <span class="tag">' + S.accounts.length + '</span></h2>' + accTools() + '<div id="adet">' + accDetails() + '</div></div>' + '<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn p" data-a="add">' + ic('plus') + 'Add Google account</button><button class="btn" data-a="refresh">' + ic('refresh') + 'Refresh everything</button></div><p class="tiny faint" style="margin-top:14px">Passwords are never stored. Each account signs in through Google. In a browser, Google sign-ins last about an hour, then you tap Reconnect.</p>';
  return demoBanner() + banner() + '<div class="grid g2">' + S.accounts.map(a => '<div class="card"><div style="display:flex;gap:14px;align-items:center" tabindex="0" data-pop="' + esc(a.email) + '">' + ringSvg(a) + '<div class="grow"><div class="nm">' + esc(a.email) + '</div><div class="small muted">' + gb1(a.usage) + ' of ' + gb1(a.limit) + ' GB used</div><div style="margin-top:6px"><span class="tag ' + (!a.ok ? 'w' : atLimit(a) ? 'w' : 'g') + '">' + (!a.ok ? 'Needs reconnect' : atLimit(a) ? 'Paused at limit' : 'Connected') + '</span> <span class="tag">' + S.files.filter(f => f.acc === a.email).length + ' files</span></div></div></div>' +
    '<div class="lg2">' + (() => { const st = typeStats(a); return TYPES.filter(t => st.by[t[0]] > 0).map(t => '<div><i data-t="' + t[0] + '"></i><span>' + t[1] + '</span><b>' + fmt(st.by[t[0]]) + '</b></div>').join('') + '<div><i class="free"></i><span>Free</span><b>' + fmt(st.free) + '</b></div>'; })() + '</div>' +
    (a.err ? '<div class="tiny" style="color:var(--bad);margin-top:8px">' + esc(a.err) + '</div>' : '') +
    '<div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">' + (a.ok ? '' : '<button class="btn p sm" data-a="reconnect" data-id="' + esc(a.email) + '">' + ic('refresh') + 'Reconnect</button>') + '<a class="btn sm" target="_blank" rel="noopener" href="https://drive.google.com/drive/' + (a.folderId ? 'folders/' + a.folderId : 'my-drive') + '?authuser=' + encodeURIComponent(a.email) + '">' + ic('ext') + 'Open in Drive</a><button class="btn d sm" data-a="rm" data-id="' + esc(a.email) + '">' + ic('trash') + 'Remove</button></div></div>').join('') + '</div>' +
    '<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn p" data-a="add">' + ic('plus') + 'Add Google account</button><button class="btn" data-a="refresh">' + ic('refresh') + 'Refresh everything</button></div><p class="tiny faint" style="margin-top:14px">Passwords are never stored. Each account signs in through Google. In a browser, Google sign-ins last about an hour, then you tap Reconnect.</p>';
}
let installEvt = null;
function settings() {
  const seg = (k, a) => '<div class="seg" role="group">' + a.map(([v, l]) => '<button data-a="' + k + '" data-id="' + v + '" aria-pressed="' + (S[k === 'theme' ? 'theme' : 'layout'] === v) + '">' + l + '</button>').join('') + '</div>';
  return demoBanner() + '<div class="grid g2"><div class="card"><h2>Appearance</h2><p class="muted small">Auto follows your device.</p>' + seg('theme', [['auto', 'Auto'], ['dark', 'Dark'], ['light', 'Daylight']]) + '<hr><h2>File view</h2>' + seg('layout', [['list', 'List'], ['grid', 'Grid']]) + '</div>' +
    '<div class="card"><h2>Mail-safe limit</h2><p class="muted small">Uploads stop on an account at this level so mail keeps arriving. Gmail, Drive and Photos all count.</p><div style="display:flex"><b class="grow">Limit</b><span class="muted small" id="pctl">' + S.pct + '% · about ' + (15 * S.pct / 100).toFixed(1) + ' of 15 GB</span></div><input type="range" id="pct" min="50" max="100" value="' + S.pct + '"></div>' +
    '<div class="card"><h2>This site</h2><p class="muted small" style="line-height:1.6">Mode: <b>' + (DEMO ? 'demo (sample data)' : 'connected to Google') + '</b>.<br>Saved in this browser: your account list, your settings. Sign-in keys are kept for this tab only and are gone when you close it.</p><div style="display:flex;gap:8px;flex-wrap:wrap">' + (installEvt ? '<button class="btn p sm" data-a="install">Install as an app</button>' : '') + (IS_IOS && !STANDALONE ? '<span class="small muted">To install on iPhone or iPad: tap Share, then Add to Home Screen.</span>' : '') + '<button class="btn d sm" data-a="wipe">Clear saved data</button></div></div>' +
    '<div class="card"><h2>Keyboard</h2><p class="muted small" style="line-height:1.9"><b>/</b> search &nbsp; <b>Esc</b> close or clear selection &nbsp; <b>U</b> upload &nbsp; <b>T</b> switch theme</p></div></div>';
}
const FEATS = [['Smart placement', 'Every file goes to the best account: big files to the one with most room, small ones fill gaps.'], ['Mail-safe limit', 'You choose how full an account may get, from 50 to 100 percent.'], ['One pool', 'See the combined free space of all your accounts as a single cloud.'], ['All files in one place', 'Search, filter and sort, and see which Gmail holds each file.'], ['View and play', 'Open photos, play videos and music, and read PDFs right here.'], ['Select many', 'Copy, move, download, delete or share many files at once.'], ['Share links', 'Anyone with the link, or specific people as viewer, commenter or editor.'], ['Works with the Android app', 'Both use the same Google Drive folders, so files show up in both.']];
const TASKS = [['Add an account', ['Press Add account and sign in on Google\'s own window.', 'Allow access to Drive files.', 'Repeat for each account you want in the pool.']], ['Upload', ['Press Upload, or drag files anywhere on the page.', 'The site chooses an account for each file.', 'Watch progress in the Transfers box. The cloud shows rain while files go up.']], ['Find and select', ['Use the search box or the filter chips.', 'Click a file to preview it. Click the tick on a card to select many.', 'Use the bar that appears to copy, move, download, delete or share.']], ['Share a file', ['Select one file and press Share.', 'Switch on Anyone with the link and pick Viewer, Commenter or Editor.', 'Copy the link, or add people by email.']], ['Control how full accounts get', ['Drag the Mail-safe limit slider on the Dashboard or in Settings.', 'An account at its limit shows Paused and is skipped.']]];
const FAQS = [['Does it work on iPhone, iPad and Safari?', 'Yes, in Safari and other modern browsers. The Android app is Android only, but the website does the same job. On iPhone, tap Share, then Add to Home Screen, to get an icon. If Google sign-in will not open from that icon, open the page in Safari, sign in there, then return. Safari also forgets a site you have not opened for about a week, so you may need to add your accounts again.'], ['How do I get the Android app?', 'Press Download APK on the Dashboard, or scan the code with your phone. Open the downloaded file, and allow installs from your browser when Android asks. After that the app updates itself from inside.'], ['Which account will my file go to?', 'The page checks each account\'s room, skips any past your limit, then decides. Files of 100 MB or more go to the account with the most room. Smaller ones go to the fullest account that still fits. The Smart placement card shows the next choice.'], ['Why do I have to reconnect?', 'A browser can only hold a Google sign-in for about an hour, and it is forgotten when you close the tab. Press Reconnect and Google usually approves in a second. The Android app keeps its sign-ins much longer.'], ['Will I see files from the Android app here?', 'They are stored in the same "Pooled Drive" folder in each account, so they should appear after a refresh. If a file from the app does not show up, tell the person who set the site up.'], ['What does Delete do?', 'It removes the file from Google Drive for good. It does not go to the Drive trash.'], ['Can I upload a file bigger than any one account\'s free space?', 'No. A file has to fit inside a single account.'], ['How long can a file be to preview?', 'Files up to about 150 MB open in the preview. Bigger ones can be downloaded instead.'], ['Is my data safe?', 'There is no Pooled Drive server. Files and sign-ins go only between your browser and Google. Passwords are never stored.'], ['Is using several accounts allowed by Google?', 'Google\'s rules discourage using multiple accounts to get around storage limits, and Google can restrict accounts. Treat this as a personal tool, use it for files you can replace, and keep a second copy of anything important.'], ['How do I see changes made on my phone?', 'The page refreshes by itself every 45 seconds while it is open, and whenever you come back to the tab. You can also press Refresh everything on the Accounts page.']];
function help() {
  const t = S.helpTab;
  const tabs = '<div class="bar">' + ['About', 'How to use', 'FAQ'].map((l, i) => '<button class="chip' + (i === t ? ' on' : '') + '" data-a="htab" data-id="' + i + '">' + l + '</button>').join('') + '</div>';
  if (t === 0) return tabs + '<div class="grid g2"><div class="card"><h2>Pooled Drive</h2><p class="muted" style="line-height:1.6">One drive made from your own Google accounts. See all your free space together, and let the app decide where each file goes. This website and the Android app work on the same files.</p><p class="tiny faint" style="line-height:1.6">Built with the help of an AI assistant and tested lightly. Keep a second copy of anything important. Google\'s rules discourage using several accounts to get around storage limits, so use the pool for files you can replace.</p></div><div class="card"><h2>What it does</h2>' + FEATS.map(f => '<div class="row"><div class="av">' + ic('check') + '</div><div class="grow"><div class="nm">' + f[0] + '</div><div class="sb" style="white-space:normal">' + f[1] + '</div></div></div>').join('') + '</div></div>';
  if (t === 1) return tabs + '<div class="grid g2">' + TASKS.map(k => '<div class="card"><h2>' + k[0] + '</h2><ol class="steps">' + k[1].map(s => '<li>' + esc(s) + '</li>').join('') + '</ol></div>').join('') + '</div>';
  return tabs + '<div class="card faq">' + FAQS.map(f => '<details><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>').join('') + '</div>';
}
const VIEWS = { dash, files, accounts, settings, help };

/* ---------- shell ---------- */
function shell() {
  $('#app').innerHTML = '<aside><div class="brand"><span class="mark"><svg viewBox="0 0 24 24" style="width:22px;height:22px">' + PD.P.cloud + '</svg></span>Pooled Drive</div>' +
    NAV.map(n => '<button class="navb" data-a="go" data-id="' + n[0] + '" id="n-' + n[0] + '">' + ic(n[2]) + n[1] + (n[0] === 'files' ? '<span class="dotc" id="fc" hidden></span>' : '') + '</button>').join('') +
    '<div class="sp"></div>' + (IS_IOS || STANDALONE ? '' : '<a class="sidedl" href="' + APK_DIRECT + '" target="_blank" rel="noopener">' + ic('phone') + 'Android app</a>') + '<div class="side-foot">' + (DEMO ? 'Demo mode' : 'Connected to Google') + '<br>No server. No ads. No tracking.</div></aside>' +
    '<main><div class="top"><div><h1 id="ttl"></h1><div class="sub" id="sub"></div></div><label class="searchbox">' + ic('search') + '<span class="sr">Search files</span><input id="q" placeholder="Search files or Gmail  ( / )" autocomplete="off"></label><button class="iconb" data-a="themebtn" aria-label="Switch theme" id="tb"></button></div><div id="view"></div></main>' +
    '<nav class="mnav" aria-label="Main">' + NAV.filter(n => n[0] !== 'help').map(n => '<button data-a="go" data-id="' + n[0] + '" id="m-' + n[0] + '">' + ic(n[2]) + n[1] + '</button>').join('') + '<button data-a="go" data-id="help" id="m-help">' + ic('help') + 'Help</button></nav>';
}
function renderView() {
  hidePop();
  const v = S.view; $('#ttl').textContent = TITLES[v][0]; $('#sub').textContent = TITLES[v][1];
  $$('.navb,.mnav button').forEach(b => b.dataset.id === v ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  $('#view').innerHTML = VIEWS[v]();
  $('#tb').innerHTML = ic(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon');
  const fc = $('#fc'); if (fc) { fc.hidden = !S.files.length; fc.textContent = S.files.length; }
  if (v === 'files') updCount(); updSel();
}
function updCount() { const c = $('#cnt'); if (c) c.textContent = filtered().length + ' of ' + S.files.length + ' files · click the tick to select'; }
function renderFileList() { const fl = $('#fl'); if (fl) { fl.innerHTML = fileList(); updCount(); } updSel(); }
function updSel() {
  let bar = $('#selbar'); if (!bar) { bar = document.createElement('div'); bar.id = 'selbar'; bar.className = 'selbar'; document.body.appendChild(bar); }
  const n = S.sel.size; bar.classList.toggle('on', n > 0 && S.view === 'files');
  bar.innerHTML = '<b>' + n + ' selected</b><button class="btn sm" data-a="s-share">' + ic('share') + (n > 1 ? 'Links' : 'Share') + '</button><button class="btn sm" data-a="s-copy">' + ic('copy') + 'Copy</button><button class="btn sm" data-a="s-move">' + ic('move') + 'Move</button><button class="btn sm" data-a="s-dl">' + ic('down') + 'Download</button><button class="btn sm d" data-a="s-del">' + ic('trash') + 'Delete</button><button class="iconb" style="width:34px;height:34px" data-a="s-clear" aria-label="Clear selection">' + ic('x') + '</button>';
}
function go(v) { if (!VIEWS[v]) v = 'dash'; S.view = v; S.sel.clear(); if (location.hash !== '#' + v) history.replaceState(null, '', '#' + v); renderView(); scrollTo(0, 0); }

/* ---------- the cloud animation ---------- */
let cur = 0.06;
function wave(l, a, k, ph) { let d = 'M-1 ' + (l + a * Math.sin(-k + ph)); for (let x = -1; x <= 25; x += .5) d += ' L' + x + ' ' + (l + a * Math.sin(x * k + ph)); return d + ' L25 22 L-1 22Z'; }
const XS = [6.5, 9.5, 12, 14.5, 17.5], OFF = [0, .37, .71, .18, .55];
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
function frame(t) {
  const w1 = $('#w1');
  if (w1) {
    const target = Math.max(.06, totals().frac); cur += (target - cur) * .06;
    const ph = t / 5200 * Math.PI * 2, r = (t / 1100) % 1, lv = 20 - 16 * cur + .12 * Math.sin(ph), m = mode();
    w1.setAttribute('d', wave(lv, .35, .62, ph)); $('#w2').setAttribute('d', wave(lv - 1.7, .5, .5, ph + 1.3));
    const U = $('#rainU'), Dn = $('#rainD');
    const drops = (g, on, y0, f) => { if (!on) { g.innerHTML = ''; return; } if (!g.firstChild) g.innerHTML = XS.map(() => '<line/>').join(''); [...g.children].forEach((ln, i) => { const p = (r + OFF[i]) % 1, y = f(p); ln.setAttribute('x1', XS[i]); ln.setAttribute('x2', XS[i]); ln.setAttribute('y1', y); ln.setAttribute('y2', y + 1.1); ln.setAttribute('opacity', 1 - p * .6); }); };
    drops(U, m === 'up', 0, p => -.4 + p * (lv - 1.2)); drops(Dn, m === 'down', 0, p => 20.8 + p * 2);
  }
  if (!still) requestAnimationFrame(frame);
}

/* ---------- file actions ---------- */
const sel = () => S.files.filter(f => S.sel.has(f.id));
async function startUploads(list) {
  list = [...list]; if (!list.length) return;
  if (!live().length) { toast(S.accounts.length ? 'Reconnect an account first' : 'Connect an account first'); go('accounts'); return; }
  const p = plan(list.map(f => f.size), slots()); let ok = 0;
  const queue = list.map((f, i) => ({ f, a: p[i] ? byEmail(p[i]) : null }));
  const worker = async () => {
    while (queue.length) {
      const it = queue.shift(), t = addTx(it.f.name, it.f.size, 'up', it.a && it.a.email);
      if (!it.a) { endTx(t, 'No account has room under your limit'); continue; }
      try { const r = await B.upload(it.a, it.f, d => upd(t, d)); S.files.unshift(r); it.a.usage += r.size; ok++; endTx(t); if (S.view === 'files') renderFileList(); else if (S.view === 'dash') renderView(); }
      catch (e) { endTx(t, e.message); }
    }
  };
  await Promise.all([worker(), worker()]);
  if (ok) { toast(ok + ' file' + (ok > 1 ? 's' : '') + ' uploaded'); confetti(); renderView(); }
}
function pick() { $('#pick').click(); }
async function download(list) {
  for (const f of list) {
    const t = addTx(f.name, f.size, 'down', f.acc);
    try { const b = await B.blob(f, d => upd(t, d)); const u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 30000); endTx(t); }
    catch (e) { endTx(t, e.message); }
  }
}
function delSheet(list) {
  openModal('<h3>Delete ' + list.length + ' file' + (list.length > 1 ? 's' : '') + '?</h3><p class="muted small">They are removed from Google Drive too. This can not be undone from here.</p><div style="display:flex;gap:10px;margin-top:16px"><button class="btn grow" data-a="close">Cancel</button><button class="btn d grow" data-a="delgo">Delete</button></div>');
  S._del = list;
}
async function doDelete(list) {
  let n = 0;
  for (const f of list) { try { await B.remove(f); S.files = S.files.filter(x => x.id !== f.id); const a = byEmail(f.acc); if (a) a.usage = Math.max(0, a.usage - f.size); S.sel.delete(f.id); n++; } catch (e) { toast('Could not delete ' + f.name + ': ' + e.message); } }
  if (n) toast('Deleted ' + n + ' file' + (n > 1 ? 's' : '')); renderView();
}
function destSheet(list, move) {
  const total = list.reduce((s, f) => s + f.size, 0); S._mv = { list, move };
  openModal('<h3>' + (move ? 'Move' : 'Copy') + ' ' + list.length + ' file' + (list.length > 1 ? 's' : '') + ' to…</h3><div style="margin-top:10px"><div class="row" data-a="dest" data-id="auto" style="cursor:pointer"><div class="grow"><div class="nm">Best drive (automatic)</div><div class="sb">Picks a drive with room</div></div></div>' +
    live().map(a => { const ok = room(a) >= total; return '<div class="row" ' + (ok ? 'data-a="dest" data-id="' + esc(a.email) + '" style="cursor:pointer"' : 'style="opacity:.45"') + '><div class="grow"><div class="nm">' + esc(a.email) + '</div><div class="sb">' + (ok ? gb1(room(a)) + ' GB room' : 'Not enough room') + '</div></div></div>'; }).join('') + '</div><button class="btn" style="margin-top:12px;width:100%" data-a="close">Cancel</button>');
}
async function transfer(list, dest, move) {
  const free = new Map(live().map(a => [a.email, room(a)])); let n = 0, skip = 0;
  for (const f of [...list].sort((a, b) => b.size - a.size)) {
    let d = dest; if (d === 'auto') { const p = plan([f.size], live().filter(a => a.email !== f.acc).map(a => ({ id: a.email, free: free.get(a.email) }))); d = p[0]; }
    if (!d) { toast('No other drive has room for ' + f.name); continue; }
    if (d === f.acc && move) { skip++; continue; }
    if ((free.get(d) || 0) < f.size) { toast(d + ' has no room for ' + f.name); continue; }
    const t = addTx(f.name, f.size, 'up', d);
    try {
      const r = await B.copy(f, byEmail(d), p => upd(t, p)); S.files.unshift(r); byEmail(d).usage += f.size; free.set(d, free.get(d) - f.size);
      if (move) { await B.remove(f); S.files = S.files.filter(x => x.id !== f.id); const a = byEmail(f.acc); if (a) a.usage = Math.max(0, a.usage - f.size); }
      endTx(t); n++;
    } catch (e) { endTx(t, e.message); }
  }
  S.sel.clear(); renderView(); toast(n ? (move ? 'Moved ' : 'Copied ') + n + ' file' + (n > 1 ? 's' : '') : skip ? 'Already on that drive' : 'Nothing was transferred');
}
async function openPreview(f) {
  const k = kind(f), canShow = k === 'image' || k === 'film' || k === 'music' || /pdf/.test(f.mime);
  let url = null;
  const head = '<div class="mhead"><div class="av">' + ic(k) + '</div><div class="grow"><h3>' + esc(f.name) + '</h3><div class="small muted">' + esc(f.acc) + ' · ' + fmt(f.size) + '</div></div><button class="btn sm" data-a="pv-share" data-id="' + f.id + '">' + ic('share') + 'Share</button><button class="btn sm" data-a="pv-dl" data-id="' + f.id + '">' + ic('down') + 'Download</button><button class="iconb" data-a="close" aria-label="Close">' + ic('x') + '</button></div>';
  openModal(head + '<div class="preview" id="pvbox"><div class="muted">' + (canShow ? 'Loading preview…' : 'No preview for this file type. Download it to open.') + '</div></div>', true, () => { if (url) URL.revokeObjectURL(url); });
  if (!canShow) return;
  if (f.size > 150 * MB) { $('#pvbox').innerHTML = '<div class="muted" style="padding:30px;text-align:center">This file is large (' + fmt(f.size) + '). Download it, or open it in the Android app.</div>'; return; }
  try {
    const b = await B.blob(f, d => { const bx = $('#pvbox'); if (bx && f.size) bx.firstChild.textContent = 'Loading preview… ' + Math.round(d / f.size * 100) + '%'; });
    url = URL.createObjectURL(b); const bx = $('#pvbox'); if (!bx) { URL.revokeObjectURL(url); return; }
    bx.innerHTML = k === 'image' ? '<img alt="">' : k === 'film' ? '<video controls autoplay playsinline></video>' : k === 'music' ? '<audio controls autoplay style="width:90%"></audio>' : '<iframe title="PDF"></iframe>';
    const el = bx.firstChild; el.src = url; if (k === 'image') el.alt = f.name;
    if (DEMO && !/image|video|audio|pdf/.test(b.type)) bx.innerHTML = '<div class="muted" style="padding:30px;text-align:center">Demo preview: this sample file has no real content.</div>';
  } catch (e) { const bx = $('#pvbox'); if (bx) bx.innerHTML = '<div style="color:var(--bad);padding:30px">' + esc(e.message) + '</div>'; }
}
const ROLES = [['reader', 'Viewer'], ['commenter', 'Commenter'], ['writer', 'Editor']], RN = { reader: 'Viewer', commenter: 'Commenter', writer: 'Editor', owner: 'Owner' };
async function shareSheet(f) {
  let perms = [], link = '', busy = true, err = '', role = 'reader';
  const draw = () => {
    const any = perms.find(p => p.type === 'anyone'), people = perms.filter(p => p.type === 'user');
    $('#modal').innerHTML = '<div class="mhead"><div class="grow"><h3>Share</h3><div class="small muted nm">' + esc(f.name) + '</div></div><button class="iconb" data-a="close" aria-label="Close">' + ic('x') + '</button></div>' + (err ? '<div class="small" style="color:var(--bad);margin-bottom:8px">' + esc(err) + '</div>' : '') +
      '<div class="row" style="padding-top:0"><div class="grow"><div class="nm">Anyone with the link</div><div class="sb" style="white-space:normal">' + (any ? 'Anyone who has the link can ' + ({ reader: 'view', commenter: 'comment', writer: 'edit' }[any.role]) : 'Restricted: only the people added below') + '</div></div><button class="sw" role="switch" aria-checked="' + !!any + '" data-sh="any" aria-label="Anyone with the link"></button></div>' +
      (any ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px">' + ROLES.map(r => '<button class="chip' + (any.role === r[0] ? ' on' : '') + '" data-sh="arole" data-id="' + r[0] + '">' + r[1] + '</button>').join('') + '</div>' : '') +
      '<div class="row" style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:6px 8px 6px 14px;margin-top:10px"><span class="grow small muted nm">' + esc(link || '…') + '</span><button class="btn sm" data-sh="copy">Copy</button></div>' +
      '<hr><div style="font-weight:600;margin-bottom:4px">People with access</div>' + (people.length ? people.map(p => '<div class="row"><div class="av">' + ic('mail') + '</div><div class="grow"><div class="nm">' + esc(p.displayName || p.emailAddress || 'Someone') + '</div><div class="sb">' + esc(p.emailAddress || '') + '</div></div>' + (p.role === 'owner' ? '<span class="tag">Owner</span>' : '<button class="chip" data-sh="prole" data-id="' + esc(p.id) + '" data-r="' + p.role + '">' + RN[p.role] + ' ▾</button><button class="iconb" style="width:34px;height:34px" data-sh="pdel" data-id="' + esc(p.id) + '" aria-label="Remove">' + ic('x') + '</button>') + '</div>').join('') : '<div class="small muted" style="padding:6px 0">Only you.</div>') +
      '<div style="display:flex;gap:8px;margin-top:10px"><input class="field" id="em" type="email" placeholder="Add people by email"><button class="btn p" data-sh="padd">Add</button></div>' + (busy ? '<div class="tiny muted" style="margin-top:8px">Working…</div>' : '');
  };
  const load = async () => { busy = true; err = ''; draw(); try { [link, perms] = await Promise.all([B.link(f), B.perms(f)]); } catch (e) { err = e.message; } busy = false; draw(); };
  openModal('<div class="muted">Loading…</div>'); await load();
  const run = async fn => { try { busy = true; draw(); await fn(); } catch (e) { err = e.message; } await load(); };
  $('#modal').onclick = async e => {
    const el = e.target.closest('[data-sh]'); if (!el) return; const a = el.dataset.sh, any = perms.find(p => p.type === 'anyone');
    if (a === 'any') run(() => any ? B.unshare(f, any.id) : B.shareAnyone(f, 'reader'));
    else if (a === 'arole') run(() => B.setRole(f, any.id, el.dataset.id));
    else if (a === 'prole') { const nx = { reader: 'commenter', commenter: 'writer', writer: 'reader' }[el.dataset.r]; run(() => B.setRole(f, el.dataset.id, nx)); }
    else if (a === 'pdel') run(() => B.unshare(f, el.dataset.id));
    else if (a === 'padd') { const v = ($('#em').value || '').trim(); if (!v.includes('@')) return toast('Type a full email address'); run(() => B.sharePerson(f, v, 'reader')); }
    else if (a === 'copy') { try { await navigator.clipboard.writeText(link); toast('Link copied'); } catch (x) { toast('Copy failed. Select the link and copy it by hand.'); } }
  };
}
async function linksFor(list) {
  const out = [];
  for (const f of list) { try { const ps = await B.perms(f); if (!ps.some(p => p.type === 'anyone')) await B.shareAnyone(f, 'reader'); out.push(f.name + '\n' + await B.link(f)); } catch (e) { toast('Could not share ' + f.name + ': ' + e.message); } }
  if (out.length) { try { await navigator.clipboard.writeText(out.join('\n\n')); toast(out.length + ' link' + (out.length > 1 ? 's' : '') + ' copied'); } catch (e) { toast('Links ready, but copying was blocked by the browser.'); } }
  S.sel.clear(); renderView();
}

/* ---------- events ---------- */
function toggleSel(id) { S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); renderFileList(); }
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]'); if (!el) return; const a = el.dataset.a, id = el.dataset.id, fl = id && S.files.find(f => f.id === id);
  if (a === 'go') go(id); else if (a === 'close') closeModal();
  else if (a === 'demon') { B.setCount(+id); loadAccounts(); S.files = []; S.sel.clear(); await refreshAll(false); }
  else if (a === 'attn') { S.accSort = 'attn'; go('accounts'); }
  else if (a === 'add') addAccount(); else if (a === 'reconnect') reconnect(byEmail(id)); else if (a === 'reconnectall') reconnectAll();
  else if (a === 'rm') removeAccount(id);
  else if (a === 'rmgo') { S.accounts = S.accounts.filter(x => x.email !== id); S.files = S.files.filter(f => f.acc !== id); persistAccounts(); closeModal(); renderView(); toast('Removed ' + id); }
  else if (a === 'refresh') { toast('Refreshing…'); refreshAll(false); }
  else if (a === 'pick') pick();
  else if (a === 'eq') { S.eq++; renderView(); }
  else if (a === 'typefilter') { S.filter = TYPE_FILTER[id] || 'All'; go('files'); }
  else if (a === 'filter') { S.filter = id; S.sel.clear(); renderView(); }
  else if (a === 'layout') { S.layout = id || (S.layout === 'grid' ? 'list' : 'grid'); store.set('pd.layout', S.layout); renderView(); }
  else if (a === 'theme') { S.theme = id; store.set('pd.theme', id); applyTheme(); renderView(); }
  else if (a === 'themebtn') { S.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; store.set('pd.theme', S.theme); applyTheme(); renderView(); }
  else if (a === 'htab') { S.helpTab = +id; renderView(); }
  else if (a === 'ck') { e.stopPropagation(); toggleSel(id); }
  else if (a === 'row') { if (S.sel.size) toggleSel(id); else if (fl) openPreview(fl); }
  else if (a === 'open') { if (fl) openPreview(fl); }
  else if (a === 'pv-share') { closeModal(); if (fl) shareSheet(fl); } else if (a === 'pv-dl') { if (fl) download([fl]); }
  else if (a === 's-clear') { S.sel.clear(); renderFileList(); }
  else if (a === 's-del') delSheet(sel()); else if (a === 'delgo') { closeModal(); doDelete(S._del || []); }
  else if (a === 's-copy') destSheet(sel(), false); else if (a === 's-move') destSheet(sel(), true);
  else if (a === 'dest') { closeModal(); transfer(S._mv.list, id, S._mv.move); }
  else if (a === 's-dl') download(sel());
  else if (a === 's-share') { const l = sel(); l.length === 1 ? shareSheet(l[0]) : linksFor(l); }
  else if (a === 'txclear') { S.tx = S.tx.filter(t => t.state === 'run'); renderTx(); }
  else if (a === 'install' && installEvt) { installEvt.prompt(); installEvt = null; }
  else if (a === 'wipe') { ['pd.accounts', 'pd.quota', 'pd.theme', 'pd.pct', 'pd.layout'].forEach(k => localStorage.removeItem(k)); sessionStorage.removeItem('pd.tok'); toast('Saved data cleared'); setTimeout(() => location.reload(), 600); }
});
document.addEventListener('contextmenu', e => { const r = e.target.closest('[data-a=row]'); if (r && S.view === 'files') { e.preventDefault(); toggleSel(r.dataset.id); } });
document.addEventListener('input', e => {
  if (e.target.id === 'q') { S.q = e.target.value; if (S.view !== 'files') { S.view = 'files'; history.replaceState(null, '', '#files'); renderView(); $('#q').focus(); } else renderFileList(); }
  else if (e.target.id === 'aq') { S.accQ = e.target.value; renderAccRows(); }
  else if (e.target.id === 'pct') { const v = +e.target.value; $$('#pctl').forEach(x => x.textContent = v + '% · about ' + (15 * v / 100).toFixed(1) + ' of 15 GB'); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'pct') { S.pct = +e.target.value; store.set('pd.pct', S.pct); renderView(); toast('Mail-safe limit set to ' + S.pct + '%'); }
  else if (e.target.id === 'sort') { S.sort = e.target.value; renderFileList(); }
  else if (e.target.id === 'asort') { S.accSort = e.target.value; renderAccRows(); }
  else if (e.target.id === 'pick') { startUploads(e.target.files); e.target.value = ''; }
});
$('#scrim').addEventListener('click', e => { if (e.target.id === 'scrim') closeModal(); });
document.addEventListener('keydown', e => {
  const typing = /INPUT|SELECT|TEXTAREA/.test((document.activeElement || {}).tagName || '');
  if (e.key === 'Escape') { if ($('#scrim').classList.contains('on')) closeModal(); else if (S.sel.size) { S.sel.clear(); renderFileList(); } else if (typing) document.activeElement.blur(); }
  else if (!typing && !e.metaKey && !e.ctrlKey) { if (e.key === '/') { e.preventDefault(); $('#q').focus(); } else if (e.key === 'u') pick(); else if (e.key === 't') document.querySelector('[data-a=themebtn]').click(); }
});
let dragN = 0;
addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { dragN++; $('#dz').classList.add('on'); } });
addEventListener('dragleave', () => { dragN = Math.max(0, dragN - 1); if (!dragN) $('#dz').classList.remove('on'); });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); dragN = 0; $('#dz').classList.remove('on'); if (e.dataTransfer.files.length) startUploads(e.dataTransfer.files); });
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (S.view === 'settings') renderView(); });
addEventListener('hashchange', () => { const v = location.hash.slice(1); if (VIEWS[v] && v !== S.view) go(v); });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.theme === 'auto') { applyTheme(); renderView(); } });
setInterval(() => { if (!document.hidden && S.accounts.length && !S.tx.some(t => t.state === 'run') && !$('#scrim').classList.contains('on')) refreshAll(true); }, 45000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.accounts.length && S.ready) refreshAll(true); });


/* ---------- the ring pop-up ---------- */
let popFor = null, pinned = false;
function popEl() { let p = $('#pop'); if (!p) { p = document.createElement('div'); p.id = 'pop'; p.className = 'pop'; p.setAttribute('role', 'tooltip'); document.body.appendChild(p); } return p; }
function hidePop() { const p = $('#pop'); if (p) p.classList.remove('on'); popFor = null; pinned = false; }
function showPop(el) {
  const a = el.dataset.pop === '__pool' ? poolAcc() : byEmail(el.dataset.pop); if (!a) return; popFor = el; const p = popEl(); p.innerHTML = popHtml(a); p.classList.add('on');
  const r = el.getBoundingClientRect(), w = p.offsetWidth, h = p.offsetHeight;
  let x = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)), y = r.bottom + 12;
  if (y + h > innerHeight - 8) y = Math.max(8, r.top - h - 12);
  p.style.left = x + 'px'; p.style.top = y + 'px';
}
document.addEventListener('mouseover', e => {
  const hl = e.target.closest('[data-hl]'), hero = $('.typecard');
  if (hero) { [...hero.classList].filter(c => c.startsWith('hl-')).forEach(c => hero.classList.remove(c)); if (hl) hero.classList.add('hl-' + hl.dataset.hl); }
  const el = e.target.closest('[data-pop]');
  if (el && !pinned && el !== popFor) showPop(el); else if (!el && !pinned && popFor && !e.target.closest('#pop')) hidePop();
});
document.addEventListener('focusin', e => { const el = e.target.closest('[data-pop]'); if (el) showPop(el); });
document.addEventListener('focusout', e => { if (!pinned && e.target.closest && e.target.closest('[data-pop]')) hidePop(); });
document.addEventListener('click', e => {
  const el = e.target.closest('[data-pop]');
  if (el && el.tagName === 'SUMMARY') hidePop();
  else if (el) { if (popFor === el && pinned) hidePop(); else { showPop(el); pinned = true; } }
  else if (!e.target.closest('#pop')) hidePop();
}, true);
addEventListener('scroll', () => { if (popFor) hidePop(); }, { passive: true });

/* ---------- start ---------- */
(async function boot() {
  applyTheme(); shell();
  const h = location.hash.slice(1); S.view = VIEWS[h] ? h : 'dash';
  renderView(); renderTx(); requestAnimationFrame(frame); loadApk();
  try { await B.init(); } catch (e) { $('#view').innerHTML = '<div class="card" style="max-width:560px;margin:40px auto"><h2>Could not start</h2><p class="muted">' + esc(e.message) + '</p></div>'; return; }
  loadAccounts(); S.loading = true; renderView();
  await refreshAll(true);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
})();
