'use strict';
(function () {

/* ============ utils ============ */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
const ESCMAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESCMAP[c]); }
const I = (n, st) => '<svg class="ic"' + (st ? ' style="' + st + '"' : '') + '><use href="#i-' + n + '"/></svg>';
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sleep = (m) => new Promise((r) => setTimeout(r, m));
function debounce(f, m) { let t; return function () { const a = arguments; clearTimeout(t); t = setTimeout(() => f.apply(null, a), m); }; }
function ft(s) {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? h + ':' + String(m).padStart(2, '0') + ':' + String(x).padStart(2, '0') : m + ':' + String(x).padStart(2, '0');
}
function fsz(b) {
  if (b == null) return '—';
  if (b >= 1073741824) return (b / 1073741824).toFixed(2).replace('.', ',') + ' ГБ';
  if (b >= 1048576) return (b / 1048576).toFixed(1).replace('.', ',') + ' МБ';
  return Math.max(1, Math.round(b / 1024)) + ' КБ';
}
function ago(t) {
  const d = Math.floor((Date.now() - t) / 864e5);
  return d <= 0 ? 'сегодня' : d === 1 ? 'вчера' : d < 7 ? d + ' дн назад' : new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}
function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return String(u).slice(0, 40); } }
function vibe(m) { try { if (navigator.vibrate) navigator.vibrate(m); } catch (e) {} }
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => res(); s.onerror = () => rej(new Error('не загрузился ' + src));
    document.head.appendChild(s);
  });
}

/* ============ platforms ============ */
const CORS_OK = ['commondatastorage.googleapis.com', 'storage.googleapis.com', 'test-streams.mux.dev', 'devstreaming-cdn.apple.com'];
const P = {
  file:        { n: 'Файл',       c: '#00E5C7', engine: 'native', dl: true,  ctrl: 'full' },
  hls:         { n: 'HLS',        c: '#00E5C7', engine: 'hls',    dl: true,  ctrl: 'full' },
  dash:        { n: 'DASH',       c: '#5CFFE4', engine: 'dash',   dl: false, ctrl: 'full' },
  youtube:     { n: 'YouTube',    c: '#FF4438', engine: 'yt',     dl: false, ctrl: 'full' },
  vimeo:       { n: 'Vimeo',      c: '#3B9DFF', engine: 'vimeo',  dl: false, ctrl: 'full' },
  rutube:      { n: 'RuTube',     c: '#B8FF3D', engine: 'frame',  dl: false, ctrl: 'native' },
  dailymotion: { n: 'Dailymotion',c: '#3B9DFF', engine: 'frame',  dl: false, ctrl: 'native' },
  ok:          { n: 'OK',         c: '#FFB020', engine: 'frame',  dl: false, ctrl: 'native' },
  tiktok:      { n: 'TikTok',     c: '#FF3D8B', engine: 'frame',  dl: false, ctrl: 'native' },
  twitch:      { n: 'Twitch',     c: '#A78BFA', engine: 'frame',  dl: false, ctrl: 'native' },
  vk:          { n: 'VK Видео',   c: '#3B9DFF', engine: 'server', dl: false, ctrl: 'none' },
  dzen:        { n: 'Дзен',       c: '#8FB6B8', engine: 'server', dl: false, ctrl: 'none' },
  site:        { n: 'Сайт',       c: '#8FB6B8', engine: 'server', dl: false, ctrl: 'none' }
};
const capOf = (k) => P[k] || P.site;

function detect(u) {
  const s = String(u || '').trim();
  let url; try { url = new URL(s); } catch (e) { return null; }
  if (!/^https?:$/.test(url.protocol)) return null;
  const h = url.hostname.replace(/^www\./, ''), p = url.pathname;
  if (/\.m3u8$/i.test(p)) return { kind: 'hls', id: s };
  if (/\.mpd$/i.test(p)) return { kind: 'dash', id: s };
  if (/\.(mp4|m4v|mov|webm|ogv|ogg|m4s|mkv)$/i.test(p)) return { kind: 'file', id: s };
  if (/(^|\.)youtube\.com$|youtu\.be$/.test(h)) {
    let id = url.searchParams.get('v');
    if (!id && h === 'youtu.be') id = p.slice(1);
    if (!id && /^\/(shorts|embed|live)\//.test(p)) id = p.split('/')[2];
    return id && /^[\w-]{6,}$/.test(id) ? { kind: 'youtube', id: id } : { kind: 'site', id: s };
  }
  if (/(^|\.)vimeo\.com$/.test(h)) { const m = p.match(/\/(\d{6,})/); return m ? { kind: 'vimeo', id: m[1] } : { kind: 'site', id: s }; }
  if (/(^|\.)rutube\.ru$/.test(h)) { const m = p.match(/\/(?:video|play\/embed|shorts)\/([0-9a-f]{8,})/i); return m ? { kind: 'rutube', id: m[1] } : { kind: 'site', id: s }; }
  if (/(^|\.)dailymotion\.com$|dai\.ly$/.test(h)) { const m = p.match(/\/video\/([a-z0-9]+)/i) || p.match(/^\/([a-z0-9]+)$/i); return m ? { kind: 'dailymotion', id: m[1] } : { kind: 'site', id: s }; }
  if (/(^|\.)ok\.ru$/.test(h)) { const m = p.match(/\/(?:video|videoembed|live)\/(\d+)/); return m ? { kind: 'ok', id: m[1] } : { kind: 'site', id: s }; }
  if (/(^|\.)tiktok\.com$/.test(h)) { const m = p.match(/\/video\/(\d+)/); return m ? { kind: 'tiktok', id: m[1] } : { kind: 'site', id: s }; }
  if (/(^|\.)twitch\.tv$/.test(h)) {
    const v = p.match(/\/videos\/(\d+)/); if (v) return { kind: 'twitch', id: 'v' + v[1] };
    const c = p.match(/^\/([A-Za-z0-9_]{3,})$/); return c ? { kind: 'twitch', id: c[1] } : { kind: 'site', id: s };
  }
  if (/(^|\.)vk\.com$|vkvideo\.ru$|vk\.ru$/.test(h)) return { kind: 'vk', id: s };
  if (/(^|\.)dzen\.ru$/.test(h)) return { kind: 'dzen', id: s };
  return { kind: 'site', id: s };
}
function caps(it) {
  const c = capOf(it.kind), ext = !!state.settings.extractor;
  return {
    play: c.engine !== 'server' || ext || !!it.resolved,
    download: c.dl || !!it.resolvedDownload,
    ctrl: it.resolved ? 'full' : c.ctrl,
    engine: it.resolved ? 'native' : c.engine
  };
}

/* ============ storage ============ */
const DB = { ok: false, db: null };
function idb() {
  return new Promise((res) => {
    if (DB.db) return res(DB.db);
    let rq; try { rq = indexedDB.open('signal-v2', 1); } catch (e) { return res(null); }
    rq.onupgradeneeded = () => {
      const d = rq.result;
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
      if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs');
    };
    rq.onsuccess = () => { DB.db = rq.result; DB.ok = true; res(DB.db); };
    rq.onerror = () => { DB.ok = false; res(null); };
    rq.onblocked = () => res(null);
  });
}
async function kvGet(k, def) {
  const d = await idb();
  if (!d) { try { const v = localStorage.getItem('sig.' + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  return new Promise((r) => {
    try { const t = d.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => r(t.result === undefined ? def : t.result); t.onerror = () => r(def); }
    catch (e) { r(def); }
  });
}
async function kvSet(k, v) {
  const d = await idb();
  if (!d) { try { localStorage.setItem('sig.' + k, JSON.stringify(v)); } catch (e) {} return; }
  return new Promise((r) => {
    try { const t = d.transaction('kv', 'readwrite').objectStore('kv').put(v, k); t.onsuccess = () => r(); t.onerror = () => r(); }
    catch (e) { r(); }
  });
}
async function blobPut(k, b) {
  const d = await idb(); if (!d) throw new Error('нет доступа к памяти устройства');
  return new Promise((res, rej) => {
    try { const t = d.transaction('blobs', 'readwrite').objectStore('blobs').put(b, k); t.onsuccess = () => res(); t.onerror = () => rej(t.error || new Error('память переполнена')); }
    catch (e) { rej(e); }
  });
}
async function blobGet(k) {
  const d = await idb(); if (!d) return null;
  return new Promise((r) => {
    try { const t = d.transaction('blobs').objectStore('blobs').get(k); t.onsuccess = () => r(t.result || null); t.onerror = () => r(null); }
    catch (e) { r(null); }
  });
}
async function blobDel(keys) {
  const d = await idb(); if (!d || !keys.length) return;
  return new Promise((r) => {
    try { const t = d.transaction('blobs', 'readwrite').objectStore('blobs'); keys.forEach((k) => t.delete(k)); t.oncomplete = () => r(); t.onerror = () => r(); }
    catch (e) { r(); }
  });
}

/* ============ state ============ */
const GB = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/';
function mk(o) {
  return Object.assign({
    id: uid(), url: '', kind: 'site', pid: '', title: 'Без названия', note: '', dur: 0,
    fav: false, pos: 0, seenAt: 0, addedAt: Date.now(), thumb: '', hue: 172,
    offline: null, bytes: 0, dl: null, resolved: null, resolvedDownload: null, author: ''
  }, o);
}
function seed() {
  const n = Date.now(), D = 864e5;
  return {
    items: [
      mk({ url: GB + 'BigBuckBunny.mp4', kind: 'file', pid: GB + 'BigBuckBunny.mp4', title: 'Big Buck Bunny — файл MP4', dur: 596, hue: 172, fav: true, pos: 214, seenAt: n - D, addedAt: n - 2 * D, note: 'Прямой файл: качается по-настоящему и играет без сети' }),
      mk({ url: 'https://test-streams.mux.dev/tos_ismc/main.m3u8', kind: 'hls', pid: 'https://test-streams.mux.dev/tos_ismc/main.m3u8', title: 'Tears of Steel — HLS, несколько качеств', dur: 734, hue: 196, fav: true, addedAt: n - 3 * D, note: 'Живой адаптивный поток: качество переключается по-настоящему' }),
      mk({ url: 'https://www.youtube.com/watch?v=eRsGyueVLvQ', kind: 'youtube', pid: 'eRsGyueVLvQ', title: 'Sintel — Blender Foundation', dur: 888, hue: 14, addedAt: n - 4 * D, thumb: 'https://i.ytimg.com/vi/eRsGyueVLvQ/hqdefault.jpg', author: 'Blender' }),
      mk({ url: 'https://vimeo.com/1084537', kind: 'vimeo', pid: '1084537', title: 'Big Buck Bunny — Vimeo', dur: 596, hue: 210, addedAt: n - 5 * D, fav: true }),
      mk({ url: GB + 'ForBiggerBlazes.mp4', kind: 'file', pid: GB + 'ForBiggerBlazes.mp4', title: 'For Bigger Blazes — короткий файл', dur: 15, hue: 32, addedAt: n - 6 * D, note: 'Маленький файл — качается за секунды, удобно проверить офлайн' }),
      mk({ url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', kind: 'youtube', pid: 'aqz-KE-bpKQ', title: 'Big Buck Bunny 4K 60fps — YouTube', dur: 596, hue: 340, pos: 96, seenAt: n - 0.4 * D, addedAt: n - 7 * D, thumb: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg' })
    ],
    views: [
      { id: uid(), name: 'Вечернее', q: '', filter: 'fav', sort: 'dur' },
      { id: uid(), name: 'Без сети', q: '', filter: 'off', sort: 'new' }
    ],
    recent: [],
    settings: { eco: true, cap: 480, next: true, pos: true, sfx: true, muted: false, extractor: '', proxy: '' }
  };
}
let state = seed();
const ui = { tab: 'add', q: '', filter: 'all', sort: 'new', sel: false, set: new Set(), view: null, busy: false, vis: [], suppress: false };
const save = debounce(() => {
  kvSet('state', {
    items: state.items.map((i) => Object.assign({}, i, { dl: null })),
    views: state.views, recent: state.recent, settings: state.settings
  });
}, 260);
const byId = (id) => state.items.find((x) => x.id === id);
const isSeen = (i) => i.dur > 0 && i.pos >= i.dur - 12;
const isWatching = (i) => i.pos > 15 && !isSeen(i);

/* ============ audio ============ */
let AC = null;
document.addEventListener('pointerdown', () => {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
});
function tone(f, t, d, ty, g, sl) {
  if (!AC) return;
  const o = AC.createOscillator(), n = AC.createGain();
  o.type = ty || 'sine';
  o.frequency.setValueAtTime(f, AC.currentTime + t);
  if (sl) o.frequency.exponentialRampToValueAtTime(sl, AC.currentTime + t + d);
  n.gain.setValueAtTime(0.0001, AC.currentTime + t);
  n.gain.exponentialRampToValueAtTime(g || 0.05, AC.currentTime + t + 0.014);
  n.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + t + d);
  o.connect(n).connect(AC.destination);
  o.start(AC.currentTime + t); o.stop(AC.currentTime + t + d + 0.05);
}
function sfx(k) {
  if (!state.settings.sfx || state.settings.muted || !AC || AC.state !== 'running') return;
  try {
    if (k === 'tap') tone(640, 0, 0.06, 'sine', 0.04, 780);
    else if (k === 'pop') { tone(880, 0, 0.08, 'sine', 0.055); tone(1320, 0.05, 0.09, 'sine', 0.045); }
    else if (k === 'ok') { tone(523, 0, 0.14); tone(659, 0.07, 0.14); tone(784, 0.14, 0.22); }
    else if (k === 'done') { tone(660, 0, 0.13, 'triangle', 0.06); tone(880, 0.09, 0.13, 'triangle', 0.06); tone(1180, 0.18, 0.28, 'triangle', 0.06); }
    else if (k === 'err') tone(180, 0, 0.2, 'square', 0.045, 120);
    else if (k === 'sheet') tone(430, 0, 0.12, 'sine', 0.03, 200);
  } catch (e) {}
}

/* ============ toasts ============ */
function toast(type, msg, opt) {
  opt = opt || {};
  const w = $('#toasts');
  while (w.children.length >= 3) w.firstChild.remove();
  const life = opt.life || (opt.action ? 6500 : 4200);
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  const ic = { success: 'check', error: 'alert', info: 'info', warn: 'alert' }[type] || 'info';
  t.innerHTML = I(ic) + '<span class="tm">' + esc(msg) + '</span>' +
    (opt.action ? '<button class="ta">' + esc(opt.action.label) + '</button>' : '') +
    '<button class="tx">' + I('x') + '</button><span class="tl" style="animation-duration:' + life + 'ms"></span>';
  const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 300); };
  const tm = setTimeout(kill, life);
  t.querySelector('.tx').onclick = () => { clearTimeout(tm); kill(); };
  if (opt.action) t.querySelector('.ta').onclick = () => { clearTimeout(tm); kill(); opt.action.fn(); };
  w.appendChild(t);
  if (type === 'error') sfx('err');
}

/* ============ sheet ============ */
let sheetKind = null, onSheetClose = null;
function openSheet(kind, html, bind, onClose) {
  sheetKind = kind; onSheetClose = onClose || null;
  const c = $('#scnt'); c.innerHTML = html; c.scrollTop = 0;
  $('#swrap').classList.add('open');
  requestAnimationFrame(() => requestAnimationFrame(() => $('#swrap').classList.add('in')));
  $('#sheet').style.transform = '';
  sfx('sheet');
  if (bind) bind(c);
}
function closeSheet(silent) {
  if (!$('#swrap').classList.contains('open')) return;
  const cb = onSheetClose; onSheetClose = null; sheetKind = null;
  $('#swrap').classList.remove('in');
  setTimeout(() => { $('#swrap').classList.remove('open'); $('#scnt').innerHTML = ''; $('#sheet').style.transform = ''; }, 340);
  if (cb && !silent) cb();
}
$('#sbd').onclick = () => closeSheet();
(function () {
  const h = $('#shd'), s = $('#sheet');
  let on = false, sy = 0, dy = 0;
  h.addEventListener('pointerdown', (e) => { on = true; sy = e.clientY; dy = 0; s.classList.add('dragging'); h.setPointerCapture(e.pointerId); });
  h.addEventListener('pointermove', (e) => { if (!on) return; dy = Math.max(0, e.clientY - sy); s.style.transform = 'translate(-50%,' + dy + 'px)'; });
  const up = () => { if (!on) return; on = false; s.classList.remove('dragging'); if (dy > 110) closeSheet(); else s.style.transform = ''; };
  h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
})();

/* ============ posters ============ */
const pcache = new Map();
function poster(it) {
  if (it.thumb) return it.thumb;
  const k = it.id + '_' + it.hue;
  if (pcache.has(k)) return pcache.get(k);
  const h = it.hue, h2 = (h + 38) % 360, h3 = (h + 76) % 360;
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='336' height='189'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(" + h + ",60%,12%)'/><stop offset='.55' stop-color='hsl(" + h2 + ",62%,22%)'/><stop offset='1' stop-color='hsl(" + h3 + ",70%,32%)'/></linearGradient><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .05 0'/></filter></defs><rect width='336' height='189' fill='url(#g)'/><path d='M0 130h40l14-46 20 92 16-62 14 30h60l12-38 18 70 14-46 12 22h116' fill='none' stroke='hsl(" + h3 + ",90%,66%)' stroke-width='2.4' opacity='.85'/><circle cx='282' cy='95' r='42' fill='none' stroke='rgba(255,255,255,.24)' stroke-width='2'/><path d='M269 74l40 21-40 21z' fill='rgba(255,255,255,.24)'/><rect width='336' height='189' filter='url(#n)' opacity='.5'/></svg>";
  const u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg).replace(/'/g, '%27');
  pcache.set(k, u);
  return u;
}
const thumbStyle = (it) => "background-image:url('" + poster(it) + "')";

/* ============ telemetry ============ */
const TEL = { net: [], real: [], bytes: 0, last: 0 };
const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const netMbps = () => (conn && typeof conn.downlink === 'number' ? conn.downlink : null);
setInterval(() => { const v = netMbps(); TEL.net.push(v == null ? 0 : v); if (TEL.net.length > 90) TEL.net.shift(); drawScopes(); }, 1000);
function pushReal(m) { if (!isFinite(m) || m <= 0) return; TEL.real.push(m); if (TEL.real.length > 90) TEL.real.shift(); TEL.last = m; }
function addBytes(b) { TEL.bytes += b; const e = $('#tsBytes'); if (e) e.textContent = fsz(TEL.bytes); }
function drawScope(cv, big) {
  if (!cv || !cv.clientWidth) return;
  const ctx = cv.getContext('2d'); if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth, h = cv.clientHeight || 70;
  if (cv.width !== w * dpr || cv.height !== h * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#06171C'; ctx.fillRect(0, 0, w, h);
  const max = Math.max(4, ...TEL.net, ...TEL.real) * 1.18;
  ctx.strokeStyle = '#123642'; ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) { const y = h * i / 4; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  const line = (arr, color, fill) => {
    if (arr.length < 2) return;
    ctx.beginPath();
    arr.forEach((v, i) => { const x = w * i / (arr.length - 1), y = h - clamp(v / max, 0, 1) * (h - 8) - 4; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.strokeStyle = color; ctx.lineWidth = big ? 2.2 : 1.8; ctx.lineJoin = 'round'; ctx.stroke();
    if (fill) { ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, color + '44'); g.addColorStop(1, color + '00'); ctx.fillStyle = g; ctx.fill(); }
  };
  line(TEL.net, '#3B9DFF', false);
  line(TEL.real, '#00E5C7', true);
  if (PL.bufPct > 0) { ctx.fillStyle = '#FFB02055'; ctx.fillRect(0, h - 3, w * PL.bufPct, 3); }
  ctx.fillStyle = '#6C979B'; ctx.font = '9px JetBrains Mono, monospace';
  ctx.fillText(max.toFixed(1) + ' Мбит/с', 5, 11);
  if (!TEL.real.length) ctx.fillText('ждём первый поток…', 5, h - 8);
}
function drawScopes() {
  drawScope($('#scopeBig'), true); drawScope($('#scopeSmall'), false);
  const nm = netMbps();
  const a = $('#scopeNow'); if (a) a.textContent = TEL.last ? TEL.last.toFixed(1) + ' Мбит/с' : (nm != null ? nm.toFixed(1) + ' Мбит/с' : 'нет данных');
  const b = $('#tsDown'); if (b) b.textContent = nm != null ? nm.toFixed(1) + ' Мбит/с' : 'нет API';
  const c = $('#tsReal'); if (c) c.textContent = TEL.last ? TEL.last.toFixed(1) + ' Мбит/с' : '—';
  const k = $('#netKind'); if (k) k.textContent = conn ? String(conn.effectiveType || '').toUpperCase() + (navigator.onLine ? '' : ' · офлайн') : (navigator.onLine ? 'онлайн' : 'офлайн');
}
if (conn && conn.addEventListener) conn.addEventListener('change', drawScopes);

/* ============ libs ============ */
let pHls = null, pDash = null, pYT = null, pVM = null;
function ensureHls() {
  if (window.Hls) return Promise.resolve();
  if (pHls) return pHls;
  pHls = loadScript('https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js')
    .catch(() => loadScript('https://unpkg.com/hls.js@1.5.17/dist/hls.min.js'))
    .then(renderDiag).catch(renderDiag);
  return pHls;
}
function ensureDash() {
  if (window.dashjs) return Promise.resolve();
  if (pDash) return pDash;
  pDash = loadScript('https://cdn.jsdelivr.net/npm/dashjs@4.7.4/dist/dash.all.min.js')
    .catch(() => loadScript('https://unpkg.com/dashjs@4.7.4/dist/dash.all.min.js'))
    .then(renderDiag).catch(renderDiag);
  return pDash;
}
function ensureYT() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (pYT) return pYT;
  pYT = new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('YouTube API не ответил')), 13000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(to); renderDiag(); res(); };
    loadScript('https://www.youtube.com/iframe_api').catch((e) => { clearTimeout(to); rej(e); });
  });
  return pYT;
}
function ensureVimeo() {
  if (window.Vimeo && window.Vimeo.Player) return Promise.resolve();
  if (pVM) return pVM;
  pVM = loadScript('https://player.vimeo.com/api/player.js').then(renderDiag);
  return pVM;
}

/* ============ renderers ============ */
const TITLES = { add: 'Ловить', lib: 'Полка', off: 'Офлайн', set: 'Настройки' };
function renderTop() {
  const s = state.settings;
  $('#muteIco').setAttribute('href', s.muted ? '#i-spkx' : '#i-spk');
  $('#btnMute').classList.toggle('on', !s.muted);
  const c = $('#netChip');
  c.className = 'netchip ' + (!navigator.onLine ? 'off' : s.eco ? 'eco' : 'full');
  $('#netTxt').textContent = !navigator.onLine ? 'офлайн' : s.eco ? 'эконом' : 'полное';
  $('#obanner').classList.toggle('show', !navigator.onLine);
  $('#screenTitle').textContent = TITLES[ui.tab] || '';
}
function renderNav() {
  $$('[data-nav]').forEach((b) => b.classList.toggle('on', b.dataset.nav === ui.tab));
  const n = state.items.filter((i) => i.dl && ['queue', 'run', 'pause'].indexOf(i.dl.st) >= 0).length;
  const b = $('#dlBadge'); b.hidden = !n; b.textContent = n;
  const r = $('#railDl'); r.hidden = !n; r.textContent = n;
  $('#railLib').textContent = state.items.length;
}
function renderAdd() {
  const s = state.settings;
  $('#swEcoHome').checked = s.eco;
  const r = $('#netRow'); r.classList.toggle('eco', s.eco); r.classList.toggle('full', !s.eco);
  $('#netDesc').textContent = s.eco ? (s.cap ? 'HLS/DASH не выше ' + s.cap + 'p' : 'без потолка') : 'без ограничений';
  const c = state.items.filter(isWatching).sort((a, b) => b.seenAt - a.seenAt)[0];
  const w = $('#contWrap');
  if (c) {
    w.innerHTML = '<div class="hs">' + I('clock') + 'Продолжить</div><div class="cont" data-cont="' + c.id + '"><div class="thumb" style="' + thumbStyle(c) + '"><div class="tp">' + I('play') + '</div></div><div style="flex:1;min-width:0"><b>' + esc(c.title) + '</b><div class="meta"><span class="dot" style="background:' + capOf(c.kind).c + '"></span>' + capOf(c.kind).n + ' · осталось ' + ft(Math.max(0, c.dur - c.pos)) + '</div><div class="cp"><i style="width:' + clamp(c.pos / c.dur * 100, 0, 100) + '%"></i></div></div>' + I('chevR', 'width:15px;height:15px;color:var(--dim)') + '</div>';
    w.querySelector('[data-cont]').onclick = () => { sfx('tap'); openPlayer(c.id, [c.id]); };
  } else w.innerHTML = '';
  const rw = $('#recWrap');
  rw.innerHTML = state.recent.length ? '<div class="hs">' + I('refresh') + 'Недавние ссылки</div>' + state.recent.slice(0, 5).map((r) => {
    const d = detect(r.url), k = d ? d.kind : 'site';
    return '<button class="rec" data-rec="' + esc(r.url) + '"><span class="dot" style="background:' + capOf(k).c + '"></span><span>' + esc(host(r.url)) + '</span>' + I('chevR') + '</button>';
  }).join('') : '';
  rw.querySelectorAll('[data-rec]').forEach((b) => b.onclick = () => { $('#urlInput').value = b.dataset.rec; detectUI(); catchIt(); });
  $('#capsList').innerHTML = ['file', 'hls', 'dash', 'youtube', 'vimeo', 'rutube', 'dailymotion', 'ok', 'tiktok', 'twitch', 'vk', 'dzen'].map((k) => {
    const c2 = P[k];
    const play = c2.engine === 'server' ? '<span class="pill srv">экстрактор</span>' : '<span class="pill ok">играет</span>';
    const dl = c2.dl ? '<span class="pill dl">качается</span>' : '<span class="pill no">0 МБ</span>';
    return '<div class="caprow"><span class="dot" style="background:' + c2.c + ';color:' + c2.c + '"></span><b>' + c2.n + '</b><span class="st">' + play + dl + '</span></div>';
  }).join('');
  drawScopes();
}
function visible() {
  let a = state.items.slice();
  const q = ui.q.trim().toLowerCase();
  if (q) a = a.filter((x) => (x.title + ' ' + x.note + ' ' + capOf(x.kind).n + ' ' + host(x.url)).toLowerCase().indexOf(q) >= 0);
  if (ui.filter === 'fav') a = a.filter((x) => x.fav);
  else if (ui.filter === 'off') a = a.filter((x) => x.offline);
  else if (ui.filter === 'watch') a = a.filter(isWatching);
  else if (ui.filter === 'dl') a = a.filter((x) => caps(x).download);
  const s = ui.sort;
  if (s === 'new') a.sort((x, y) => y.addedAt - x.addedAt);
  else if (s === 'old') a.sort((x, y) => x.addedAt - y.addedAt);
  else if (s === 'title') a.sort((x, y) => x.title.localeCompare(y.title, 'ru'));
  else if (s === 'dur') a.sort((x, y) => y.dur - x.dur);
  else if (s === 'size') a.sort((x, y) => (y.bytes || 0) - (x.bytes || 0));
  return a;
}
function row(it) {
  const c = capOf(it.kind), cp = caps(it);
  const b = [
    it.fav ? '<span class="bdg fav">' + I('heartF') + 'избранное</span>' : '',
    it.offline ? '<span class="bdg off">' + I('check') + 'офлайн ' + fsz(it.bytes) + '</span>' : '',
    isSeen(it) ? '<span class="bdg seen">' + I('check') + 'досмотрено</span>' : '',
    !cp.play ? '<span class="bdg warn">' + I('server') + 'нужен экстрактор</span>' : ''
  ].join('');
  const gp = ui.sort === 'manual' && !ui.sel ? '<button class="gp" data-grip>' + I('grip') + '</button>' : '';
  return '<div class="vr' + (ui.set.has(it.id) ? ' sel' : '') + '" data-id="' + it.id + '"><div class="sc">' + I('check') + '</div>' +
    '<div class="thumb" style="' + thumbStyle(it) + '">' + (it.pos > 5 && it.dur ? '<div class="tp"><i style="width:' + clamp(it.pos / it.dur * 100, 0, 100) + '%"></i></div>' : '') + '</div>' +
    '<div class="vi"><div class="vt">' + esc(it.title) + '</div>' +
    '<div class="meta"><span class="dot" style="background:' + c.c + '"></span>' + c.n + ' · ' + (it.dur ? ft(it.dur) : 'длит. при просмотре') + '</div>' +
    (b ? '<div class="vb">' + b + '</div>' : '') + '</div>' + gp + (!ui.sel ? '<button class="kb" data-kb>' + I('chevR') + '</button>' : '') + '</div>';
}
function renderLib() {
  const C = {
    all: state.items.length,
    fav: state.items.filter((x) => x.fav).length,
    off: state.items.filter((x) => x.offline).length,
    watch: state.items.filter(isWatching).length,
    dl: state.items.filter((x) => caps(x).download).length
  };
  $('#libCount').textContent = C.all;
  $('#btnSel').textContent = ui.sel ? 'Готово' : 'Выбрать';
  $('#btnSort').classList.toggle('custom', ui.sort === 'manual');
  $('#viewsRow').innerHTML = state.views.map((v) =>
    '<span class="vw' + (ui.view === v.id ? ' on' : '') + '" data-view="' + v.id + '" role="button" tabindex="0">' + I('spark') + esc(v.name) + '<button class="vx" data-vdel="' + v.id + '">' + I('x') + '</button></span>'
  ).join('') + '<button class="vadd" id="vAdd">' + I('plus') + 'Сохранить вид</button>';
  $('#filterRow').innerHTML = [['all', 'Все'], ['fav', 'Избранное'], ['off', 'Офлайн'], ['watch', 'Смотрю'], ['dl', 'Можно качать']]
    .map((f) => '<button class="chip' + (ui.filter === f[0] ? ' on' : '') + '" data-f="' + f[0] + '">' + f[1] + '<span class="cnt">' + C[f[0]] + '</span></button>').join('');
  const a = visible(); ui.vis = a.map((x) => x.id);
  const L = $('#list'); L.classList.toggle('selmode', ui.sel); L.innerHTML = a.map(row).join('');
  const e = $('#libEmpty');
  if (!a.length) {
    const m = ui.q ? ['Ничего не нашлось', 'Другой запрос или сброс поиска'] : ({
      all: ['Полка пуста', 'Вставь ссылку на вкладке «Ловить»'],
      fav: ['Нет избранного', 'Избранное хранит только ссылку — 0 МБ памяти'],
      off: ['Ничего не скачано', 'Скачай файл или HLS — будет играть без сети'],
      watch: ['Нечего досматривать', 'Начни смотреть, ролик появится тут'],
      dl: ['Нет качаемых источников', 'Файлы и HLS качаются; для площадок подключи экстрактор']
    })[ui.filter];
    e.innerHTML = '<div class="empty"><div class="art">' + I(ui.q ? 'search' : 'film') + '</div><b>' + m[0] + '</b><p>' + m[1] + '</p>' +
      (ui.q ? '<button class="btn btn-gh btn-sm" id="emReset">Сбросить поиск</button>' : '<button class="btn btn-cta btn-sm" id="emGo">' + I('link') + 'Ловить ссылку</button>') + '</div>';
    const g = $('#emGo'), r = $('#emReset');
    if (g) g.onclick = () => { go('add'); setTimeout(() => $('#urlInput').focus(), 320); };
    if (r) r.onclick = () => { ui.q = ''; $('#qInput').value = ''; ui.view = null; renderLib(); };
  } else e.innerHTML = '';
  $('#bulk').classList.toggle('show', ui.sel);
  $('#bulkN').textContent = ui.set.size + ' выбрано';
}
async function renderOff() {
  const done = state.items.filter((x) => x.offline);
  const mine = done.reduce((s, x) => s + (x.bytes || 0), 0);
  let quota = 0, usage = 0;
  try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); quota = e.quota || 0; usage = e.usage || 0; } } catch (e) {}
  const txt = fsz(mine) + ' в приложении' + (quota ? ' · занято ' + fsz(usage) + ' из ' + fsz(quota) : '');
  $('#storTxt').textContent = txt; $('#storTxt2').textContent = txt;
  const base = quota || 8 * 1073741824;
  $('#storBar').innerHTML = done.map((x) => '<i title="' + esc(x.title) + ' · ' + fsz(x.bytes) + '" style="width:' + clamp((x.bytes || 0) / base * 100, 0.6, 100) + '%;background:linear-gradient(180deg,hsl(' + x.hue + ',85%,62%),hsl(' + x.hue + ',78%,44%))"></i>').join('');
  $('#storLeg').innerHTML = done.slice(0, 5).map((x) => '<span><i style="background:hsl(' + x.hue + ',85%,60%)"></i>' + esc(x.title.length > 15 ? x.title.slice(0, 14) + '…' : x.title) + '</span>').join('') + (done.length > 5 ? '<span>+' + (done.length - 5) + '</span>' : '');
  $('#btnWipe').disabled = !done.length; $('#btnFree').disabled = !done.length;
  const act = state.items.filter((x) => x.dl && ['queue', 'run', 'pause'].indexOf(x.dl.st) >= 0);
  $('#actCnt').textContent = act.length ? act.length + ' в очереди' : '';
  $('#actList').innerHTML = act.map((it) => {
    const d = it.dl;
    const pct = d.total ? clamp(d.got / d.total * 100, 0, 100) : (d.segs ? clamp(d.doneSeg / d.segs * 100, 0, 100) : 0);
    const meta = d.st === 'run'
      ? (d.segs ? 'Сегменты ' + d.doneSeg + '/' + d.segs + ' · ' + fsz(d.got) : fsz(d.got) + (d.total ? ' / ' + fsz(d.total) : '') + ' · ' + (d.spd || 0).toFixed(1).replace('.', ',') + ' МБ/с')
      : d.st === 'pause' ? 'Пауза — нажми ▶' : 'В очереди…';
    return '<div class="dlc ' + (d.st === 'run' ? 'active' : d.st === 'pause' ? 'paused' : '') + '" data-dl="' + it.id + '"><div class="dlt"><div class="thumb" style="' + thumbStyle(it) + '"></div><div class="di"><b>' + esc(it.title) + '</b><div class="dlm">' + meta + '</div></div><div class="dlbs">' +
      (d.st === 'pause' ? '<button class="dlb" data-resume="' + it.id + '">' + I('play') + '</button>' : d.st === 'run' && d.canPause ? '<button class="dlb" data-pause="' + it.id + '">' + I('pause') + '</button>' : '') +
      '<button class="dlb x" data-cancel="' + it.id + '">' + I('x') + '</button></div></div><div class="dltr"><div class="dlf" style="width:' + pct + '%"></div></div><div class="dlpr"><span class="got">' + fsz(d.got) + (d.total ? ' / ' + fsz(d.total) : '') + '</span><b class="pct">' + Math.floor(pct) + '%</b></div></div>';
  }).join('');
  $('#doneList').innerHTML = done.sort((a, b) => b.addedAt - a.addedAt).map((it) =>
    '<div class="dnr" data-done="' + it.id + '"><div class="thumb" style="' + thumbStyle(it) + '"></div><div class="dn"><b>' + esc(it.title) + '</b><div class="meta"><span class="bdg off">' + I('check') + (it.offline.type === 'hls' ? 'HLS' : 'файл') + '</span>' + fsz(it.bytes) + ' · ' + ago(it.addedAt) + '</div></div>' +
    (it.offline.type === 'file' ? '<button class="dlb" data-save="' + it.id + '" title="Сохранить в файлы">' + I('save') + '</button>' : '') +
    '<button class="dlb x" data-rm="' + it.id + '" title="Удалить">' + I('trash') + '</button><button class="pb" data-play="' + it.id + '">' + I('play') + '</button></div>'
  ).join('');
  $('#offEmpty').innerHTML = (!act.length && !done.length)
    ? '<div class="empty"><div class="art">' + I('dl') + '</div><b>Пока пусто</b><p>Открой файл или HLS и нажми «Скачать». Байты лягут в память устройства и будут играть без сети.</p><button class="btn btn-cta btn-sm" id="offGo">' + I('link') + 'Ловить ссылку</button></div>'
    : (!done.length ? '<div class="empty" style="padding:18px"><p style="margin:0">Готовые файлы появятся здесь</p></div>' : '');
  const g = $('#offGo'); if (g) g.onclick = () => go('add');
}
function renderSet() {
  const s = state.settings;
  $('#swEco').checked = s.eco; $('#setCap').value = String(s.cap);
  $('#swNext').checked = s.next; $('#swPos').checked = s.pos; $('#swSfx').checked = s.sfx;
  $('#extInput').value = s.extractor || '';
  $('#proxyInput').value = s.proxy || '';
  const st = $('#extState');
  if (s.extractor) { st.className = 'ext-state ok'; st.textContent = 'Подключён: ' + s.extractor; }
  else { st.className = 'ext-state'; st.textContent = 'Не подключён. Работают файлы, HLS, DASH и встроенные плееры.'; }
  renderDiag();
}
function renderDiag() {
  const box = $('#diagList'); if (!box) return;
  const R = [
    ['hls.js', window.Hls ? 'ok' : 'wait', window.Hls ? 'готов' : 'грузится по требованию'],
    ['dash.js', window.dashjs ? 'ok' : 'wait', window.dashjs ? 'готов' : 'грузится по требованию'],
    ['YouTube API', window.YT && window.YT.Player ? 'ok' : 'wait', 'по требованию'],
    ['Vimeo SDK', window.Vimeo ? 'ok' : 'wait', 'по требованию'],
    ['IndexedDB', DB.ok ? 'ok' : 'no', DB.ok ? 'загрузки доступны' : 'недоступно'],
    ['Storage API', navigator.storage ? 'ok' : 'no', ''],
    ['Буфер обмена', navigator.clipboard ? 'ok' : 'no', ''],
    ['Картинка в картинке', document.pictureInPictureEnabled ? 'ok' : 'no', ''],
    ['Полный экран', document.fullscreenEnabled ? 'ok' : 'no', ''],
    ['Service Worker', navigator.serviceWorker && navigator.serviceWorker.controller ? 'ok' : 'wait', location.protocol === 'file:' ? 'нужен https://' : ''],
    ['Сеть', navigator.onLine ? 'ok' : 'no', navigator.onLine ? 'онлайн' : 'офлайн']
  ];
  box.innerHTML = R.map((r) => '<div class="dg ' + r[1] + '"><i></i>' + r[0] + (r[2] ? '<span>' + esc(r[2]) + '</span>' : '') + '</div>').join('');
}
function renderAll() { renderTop(); renderNav(); renderAdd(); renderLib(); renderOff(); renderSet(); }
function go(t) {
  if (ui.tab !== t) sfx('tap');
  if (t !== 'lib' && ui.sel) { ui.sel = false; ui.set.clear(); }
  ui.tab = t;
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + t));
  renderTop(); renderNav();
  if (t === 'lib') renderLib();
  if (t === 'off') renderOff();
  if (t === 'add') renderAdd();
  if (t === 'set') renderSet();
  const sc = $('.screens'); if (sc) sc.scrollTop = 0;
  window.scrollTo(0, 0);
}
$$('[data-nav]').forEach((b) => b.onclick = () => go(b.dataset.nav));

/* ============ detect UI ============ */
function detectUI() {
  const v = $('#urlInput').value.trim();
  $('#urlBox').classList.toggle('has', !!v);
  const d = $('#detect');
  if (!v) { d.className = 'det'; d.innerHTML = ''; return; }
  const p = detect(v);
  if (!p) { d.className = 'det show bad'; d.innerHTML = I('alert', 'width:13px;height:13px') + 'Нужна ссылка http(s)://'; return; }
  const c = capOf(p.kind), cp = caps({ kind: p.kind, resolved: null });
  d.className = 'det show';
  d.innerHTML = '<span class="dot" style="background:' + c.c + ';color:' + c.c + '"></span>' + c.n +
    '<span class="st">' + (cp.play ? '<span class="pill ok">играет</span>' : '<span class="pill srv">экстрактор</span>') +
    (cp.download ? '<span class="pill dl">качается</span>' : '<span class="pill no">избранное 0 МБ</span>') + '</span>';
}
$('#urlInput').addEventListener('input', detectUI);
$('#urlInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); catchIt(); } });
$('#btnClearUrl').onclick = () => { $('#urlInput').value = ''; detectUI(); $('#urlInput').focus(); };
$('#btnPaste').onclick = async () => {
  sfx('tap');
  try {
    const t = await navigator.clipboard.readText();
    if (t && t.trim()) { $('#urlInput').value = t.trim(); detectUI(); toast('info', 'Вставлено из буфера'); }
    else { $('#urlInput').focus(); toast('info', 'Буфер пуст'); }
  } catch (e) { $('#urlInput').focus(); toast('info', 'Вставь вручную: долгое нажатие на поле или Ctrl+V'); }
};
$('#btnCatch').onclick = catchIt;
$('#btnManual').onclick = () => {
  const v = $('#manualUrl').value.trim();
  if (!v) { toast('warn', 'Вставь прямую ссылку'); return; }
  $('#urlInput').value = v; detectUI(); catchIt();
};
$('#manualUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#btnManual').click(); } });

/* ============ metadata helpers ============ */
async function oembed(url) {
  try {
    const c = new AbortController(); const to = setTimeout(() => c.abort(), 6500);
    const r = await fetch('https://noembed.com/embed?url=' + encodeURIComponent(url), { signal: c.signal });
    clearTimeout(to);
    if (!r.ok) return null;
    const j = await r.json();
    return j && j.title ? j : null;
  } catch (e) { return null; }
}
function probe(url, useCors) {
  return new Promise((res, rej) => {
    const v = document.createElement('video');
    v.preload = 'metadata'; v.muted = true; v.playsInline = true;
    if (useCors) v.crossOrigin = 'anonymous';
    const to = setTimeout(() => { cl(); rej(new Error('таймаут 9 с')); }, 9000);
    const cl = () => { clearTimeout(to); v.removeAttribute('src'); try { v.load(); } catch (e) {} };
    v.onloadedmetadata = () => { const d = v.duration; cl(); res(isFinite(d) ? d : 0); };
    v.onerror = () => { cl(); rej(new Error('источник не отвечает')); };
    v.src = url;
  });
}
async function callExtractor(base, url) {
  const u = base + (base.indexOf('?') >= 0 ? '&' : '?') + 'url=' + encodeURIComponent(url);
  const c = new AbortController(); const to = setTimeout(() => c.abort(), 25000);
  const r = await fetch(u, { signal: c.signal }); clearTimeout(to);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (!j || (!j.stream && !j.download)) throw new Error('сервер не вернул поток');
  return j;
}

/* ============ resolve ============ */
let catchToken = 0;
async function catchIt() {
  const url = $('#urlInput').value.trim();
  const p = detect(url);
  if (!p) { const b = $('#urlBox'); b.classList.remove('err'); void b.offsetWidth; b.classList.add('err'); toast('error', 'Нужна корректная ссылка http(s)://'); return; }
  const ex = state.items.find((x) => x.url === url);
  if (ex) { toast('info', 'Уже на полке'); openDetail(ex.id); return; }
  if (ui.busy) return;
  ui.busy = true; const tok = ++catchToken;
  const btn = $('#btnCatch'); btn.innerHTML = '<span class="spin"></span><span>Разбираю…</span>';
  const c = capOf(p.kind);
  const steps = ['Определяю источник и возможности', c.engine === 'server' ? 'Проверяю экстрактор' : 'Читаю настоящие метаданные', 'Готовлю плеер'];
  openSheet('res', '<div class="sh">' + I('wave') + 'Разбираю ссылку</div><div class="resurl">' + I('link') + '<span>' + esc(url) + '</span></div><div class="rsteps">' +
    steps.map((s, i) => '<div class="rst" data-s="' + i + '"><span class="ri"><span class="rd"></span></span>' + s + '</div>').join('') +
    '</div><div class="rtrack"><div class="rfill" id="rfill"></div></div><button class="btn btn-gh wf" id="rCancel" style="margin-top:13px">Отмена</button>',
    (r) => { r.querySelector('#rCancel').onclick = () => { catchToken++; closeSheet(); }; });
  const st = (i, s) => {
    const e = $('#scnt').querySelector('[data-s="' + i + '"]'); if (!e) return;
    e.className = 'rst ' + s;
    e.querySelector('.ri').innerHTML = s === 'now' ? '<span class="rs"></span>' : s === 'done' ? I('check') : '<span class="rd"></span>';
  };
  const fill = (v) => { const f = $('#rfill'); if (f) f.style.width = v + '%'; };
  const alive = () => tok === catchToken && sheetKind === 'res';
  try {
    st(0, 'now'); fill(14); await sleep(320); if (!alive()) return;
    st(0, 'done'); st(1, 'now'); fill(46);
    const it = mk({ url: url, kind: p.kind, pid: p.id, hue: (p.kind.charCodeAt(0) * 7 + p.id.length * 13) % 360 });
    if (p.kind === 'youtube') { it.thumb = 'https://i.ytimg.com/vi/' + p.id + '/hqdefault.jpg'; it.title = 'YouTube · ' + p.id; }
    if (p.kind === 'file') {
      const useCors = CORS_OK.indexOf(host(url)) >= 0;
      let d = 0;
      try { d = await probe(url, useCors); }
      catch (e) { try { d = await probe(url, false); } catch (e2) { throw new Error('Файл не отвечает или формат не поддерживается браузером'); } }
      if (!alive()) return;
      it.dur = Math.round(d);
      let nm = 'Видео по ссылке';
      try { nm = decodeURIComponent(new URL(url).pathname.split('/').pop()).replace(/\.[a-z0-9]+$/i, '').replace(/[-_+]/g, ' ') || nm; } catch (e) {}
      it.title = nm;
    } else if (p.kind === 'hls') {
      it.title = 'HLS · ' + host(url);
      await ensureHls(); if (!alive()) return;
      if ((!window.Hls || !window.Hls.isSupported()) && !document.createElement('video').canPlayType('application/vnd.apple.mpegurl'))
        throw new Error('Браузер не поддерживает HLS');
    } else if (p.kind === 'dash') {
      it.title = 'DASH · ' + host(url);
      await ensureDash(); if (!alive()) return;
      if (!window.dashjs) throw new Error('dash.js не загрузился — проверь сеть');
    } else if (c.engine === 'server') {
      if (!state.settings.extractor) {
        const oe = await oembed(url);
        if (oe) { it.title = oe.title; if (oe.thumbnail_url) it.thumb = oe.thumbnail_url; it.author = oe.author_name || ''; }
        else it.title = host(url) + ' · ссылка';
        if (!alive()) return;
        st(1, 'done'); st(2, 'done'); fill(100); await sleep(220); if (!alive()) return;
        pushItem(it); openDetail(it.id);
        toast('warn', 'Сохранено ссылкой. Для просмотра подключи экстрактор');
        return;
      }
      const j = await callExtractor(state.settings.extractor, url); if (!alive()) return;
      it.resolved = j.stream || j.download; it.resolvedDownload = j.download || null;
      it.title = j.title || host(url); it.dur = Math.round(j.duration || 0);
      if (j.thumbnail) it.thumb = j.thumbnail;
    } else {
      const oe = await oembed(url); if (!alive()) return;
      if (oe) { it.title = oe.title; if (oe.thumbnail_url) it.thumb = oe.thumbnail_url; it.author = oe.author_name || ''; }
      else it.title = c.n + ' · ' + p.id;
    }
    st(1, 'done'); st(2, 'now'); fill(80); await sleep(280); if (!alive()) return;
    st(2, 'done'); fill(100); await sleep(200); if (!alive()) return;
    pushItem(it); sfx('ok'); vibe(12); openDetail(it.id); toast('success', 'Готово: ' + it.title);
  } catch (err) {
    if (!alive()) return;
    openSheet('reserr', '<div class="sh">' + I('alert') + 'Не получилось</div><p class="ctext">' + esc(err.message || 'Источник недоступен') + '</p><div class="cbtns"><button class="btn btn-gh" id="reSet">Настройки</button><button class="btn btn-cta" id="reOk">Понятно</button></div>', (r) => {
      r.querySelector('#reOk').onclick = () => closeSheet();
      r.querySelector('#reSet').onclick = () => { closeSheet(true); go('set'); };
    });
  } finally {
    ui.busy = false;
    btn.innerHTML = I('play') + '<span>Открыть в плеере</span>';
  }
}
function pushItem(it) {
  state.items.unshift(it);
  state.recent = [{ url: it.url }].concat(state.recent.filter((r) => r.url !== it.url)).slice(0, 5);
  save(); $('#urlInput').value = ''; detectUI(); renderAll();
}

/* ============ page scanner (proxy) ============ */
function proxyList() {
  const own = state.settings.proxy;
  const l = [];
  if (own) l.push({ name: 'свой прокси', url: (u) => own.replace('{url}', encodeURIComponent(u)).replace(/\{raw\}/g, u), kind: 'text' });
  l.push({ name: 'allorigins/raw', url: (u) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u), kind: 'text' });
  l.push({ name: 'allorigins/get', url: (u) => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u), kind: 'json' });
  l.push({ name: 'codetabs', url: (u) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u), kind: 'text' });
  l.push({ name: 'corsproxy.io', url: (u) => 'https://corsproxy.io/?url=' + encodeURIComponent(u), kind: 'text' });
  return l;
}
async function fetchVia(url, p, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms || 15000);
  try {
    const res = await fetch(p.url(url), { method: 'GET', signal: ctrl.signal, headers: { Accept: '*/*' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    let text = '';
    if (p.kind === 'json') { const j = await res.json(); text = (j && j.contents) ? j.contents : ''; }
    else text = await res.text();
    if (!text || text.length < 40) throw new Error('пустой ответ');
    return text;
  } finally { clearTimeout(timer); }
}
async function fetchPage(url) {
  const errors = [];
  const list = proxyList();
  for (let i = 0; i < list.length; i++) {
    try { const text = await fetchVia(url, list[i]); return { text: text, proxy: list[i].name }; }
    catch (err) { errors.push(list[i].name + ' → ' + (err.name === 'AbortError' ? 'таймаут' : (err.message || 'ошибка'))); }
  }
  throw new Error('Ни один прокси не отдал страницу:\n' + errors.join('\n'));
}
function extractMedia(html, pageUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const map = new Map();
  function push(raw, label) {
    if (!raw) return;
    let u = String(raw).trim().replace(/^['"]+|['"]+$/g, '').replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
    if (!u || /^(blob|data|javascript|about|chrome|file):/i.test(u)) return;
    let abs; try { abs = new URL(u, pageUrl).href; } catch (e) { return; }
    if (!/^https?:/i.test(abs)) return;
    const d = detect(abs);
    if (!d) return;
    if (['file', 'hls', 'dash'].indexOf(d.kind) < 0) return;
    if (!map.has(abs)) map.set(abs, { url: abs, kind: d.kind, label: label || '' });
  }
  $$('video').forEach(() => {});
  Array.prototype.forEach.call(doc.querySelectorAll('video'), (v) => {
    push(v.getAttribute('src'), 'video'); push(v.getAttribute('data-src'), 'video'); push(v.getAttribute('data-url'), 'video');
    Array.prototype.forEach.call(v.querySelectorAll('source'), (s) => { push(s.getAttribute('src'), 'source'); push(s.getAttribute('data-src'), 'source'); });
  });
  Array.prototype.forEach.call(doc.querySelectorAll('source[src]'), (s) => push(s.getAttribute('src'), 'source'));
  const MK = ['og:video', 'og:video:url', 'og:video:secure_url', 'twitter:player:stream', 'video_src'];
  Array.prototype.forEach.call(doc.querySelectorAll('meta'), (m) => {
    const key = (m.getAttribute('property') || m.getAttribute('name') || '').toLowerCase();
    if (MK.indexOf(key) >= 0) push(m.getAttribute('content'), 'meta ' + key);
  });
  Array.prototype.forEach.call(doc.querySelectorAll('a[href]'), (n) => push(n.getAttribute('href'), 'link'));
  Array.prototype.forEach.call(doc.querySelectorAll('script[type="application/ld+json"]'), (n) => {
    try {
      const j = JSON.parse(n.textContent || '{}');
      const arr = Array.isArray(j) ? j : [j];
      arr.forEach((o) => { if (o && (o.contentUrl || o.embedUrl)) { push(o.contentUrl, 'json-ld'); } });
    } catch (e) {}
  });
  const clean = html.replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
  const patterns = [
    /https?:\/\/[^\s"'<>()\\]+?\.(?:mp4|m4v|mov|webm|ogv|m3u8|mpd)(?:\?[^\s"'<>()\\]*)?/gi,
    /["'](?:file|src|url|hls|dash|manifest)["']\s*:\s*["']([^"']+\.(?:mp4|m3u8|mpd|webm)[^"']*)["']/gi
  ];
  patterns.forEach((re) => { let m, guard = 0; while ((m = re.exec(clean)) !== null && guard++ < 500) push(m[1] || m[0], 'regex'); });
  const embeds = [];
  Array.prototype.forEach.call(doc.querySelectorAll('iframe[src], embed[src]'), (n) => {
    const s = n.getAttribute('src'); if (!s) return;
    let abs; try { abs = new URL(s, pageUrl).href; } catch (e) { return; }
    const d = detect(abs);
    if (d && ['youtube', 'vimeo', 'rutube', 'dailymotion', 'ok', 'tiktok', 'twitch'].indexOf(d.kind) >= 0) embeds.push({ url: abs, kind: d.kind, id: d.id });
  });
  const meta = (p) => { const n = doc.querySelector('meta[property="' + p + '"], meta[name="' + p + '"]'); return n ? (n.getAttribute('content') || '') : ''; };
  let title = (meta('og:title') || doc.title || '').trim().slice(0, 180);
  if (!title) title = host(pageUrl);
  let thumb = meta('og:image') || meta('twitter:image') || '';
  if (thumb) { try { thumb = new URL(thumb, pageUrl).href; } catch (e) { thumb = ''; } }
  const drm = /widevine|playready|fairplay|licenseUrl|\bdrm\b/i.test(html);
  const order = { hls: 0, file: 1, dash: 2 };
  const items = Array.prototype.slice.call(map.values()).sort((a, b) => order[a.kind] - order[b.kind]).slice(0, 30);
  return { items: items, embeds: embeds, title: title, thumb: thumb, drm: drm };
}
let scanBusy = false;
$('#btnScan').onclick = async () => {
  if (scanBusy) return;
  const url = $('#urlInput').value.trim();
  const p = detect(url);
  if (!p) { toast('error', 'Вставь ссылку на страницу'); return; }
  if (['file', 'hls', 'dash'].indexOf(p.kind) >= 0) { toast('info', 'Это уже прямой поток — жми «Открыть в плеере»'); return; }
  scanBusy = true;
  const b = $('#btnScan'); b.disabled = true; b.innerHTML = '<span class="spin" style="border-color:#8FB6B844;border-top-color:var(--sig)"></span>Сканирую';
  const w = $('#scanWrap');
  w.innerHTML = '<div class="card scanres"><div class="scanhead">' + I('radar', 'width:14px;height:14px;color:var(--sig)') + 'Тяну HTML через прокси…<span class="sp"></span></div><div class="rtrack"><div class="rfill" style="width:45%"></div></div></div>';
  try {
    const res = await fetchPage(url);
    const data = extractMedia(res.text, url);
    const total = data.items.length + data.embeds.length;
    if (!total) {
      w.innerHTML = '<div class="card scanres"><div class="scanhead">' + I('alert', 'width:14px;height:14px;color:var(--amb)') + 'Прокси: ' + esc(res.proxy) + '</div><p class="ctext" style="margin:0">' +
        (data.drm ? 'На странице есть признаки DRM (Widevine / PlayReady / FairPlay). Такие потоки воспроизвести нельзя.' : 'Прямых видео-ссылок в HTML нет. Скорее всего плеер собирается из JavaScript с подписанными ссылками — сканер тут бессилен. Подключи экстрактор в настройках или вставь прямой .mp4/.m3u8.') + '</p></div>';
      toast('warn', 'В HTML видео не найдено');
    } else {
      const cards = data.items.map((m, i) => {
        const c = capOf(m.kind);
        return '<div class="vr" data-scan="' + esc(m.url) + '" data-kind="' + m.kind + '"><div class="thumb" style="' + (data.thumb ? "background-image:url('" + esc(data.thumb) + "')" : '') + '"></div><div class="vi"><div class="vt">' + esc(data.title) + ' — вариант ' + (i + 1) + '</div><div class="meta"><span class="dot" style="background:' + c.c + '"></span>' + c.n + ' · ' + esc(host(m.url)) + '</div></div>' + I('chevR', 'width:15px;height:15px;color:var(--dim)') + '</div>';
      }).join('') + data.embeds.map((m) => {
        const c = capOf(m.kind);
        return '<div class="vr" data-scan="' + esc(m.url) + '" data-kind="' + m.kind + '"><div class="thumb" style="' + (m.kind === 'youtube' ? "background-image:url('https://i.ytimg.com/vi/" + esc(m.id) + "/hqdefault.jpg')" : '') + '"></div><div class="vi"><div class="vt">' + esc(data.title) + '</div><div class="meta"><span class="dot" style="background:' + c.c + '"></span>встроенный ' + c.n + '</div></div>' + I('chevR', 'width:15px;height:15px;color:var(--dim)') + '</div>';
      }).join('');
      w.innerHTML = '<div class="scanres"><div class="scanhead">' + I('check', 'width:14px;height:14px;color:var(--lime)') + 'Найдено: ' + total + ' · прокси: ' + esc(res.proxy) + '<span class="sp"></span><button class="btn btn-gh btn-sm" id="scanClose">Скрыть</button></div><div class="vlist">' + cards + '</div></div>';
      $('#scanClose').onclick = () => { w.innerHTML = ''; };
      w.querySelectorAll('[data-scan]').forEach((el) => {
        el.onclick = () => {
          const u = el.dataset.scan, d = detect(u);
          if (!d) return;
          const exist = state.items.find((x) => x.url === u);
          if (exist) { openDetail(exist.id); return; }
          const it = mk({
            url: u, kind: d.kind, pid: d.id, title: data.title, thumb: d.kind === 'youtube' ? 'https://i.ytimg.com/vi/' + d.id + '/hqdefault.jpg' : data.thumb,
            hue: (d.kind.charCodeAt(0) * 11 + u.length * 7) % 360
          });
          pushItem(it); sfx('ok'); openDetail(it.id);
        };
      });
      sfx('ok'); toast('success', 'Найдено вариантов: ' + total);
    }
  } catch (err) {
    w.innerHTML = '<div class="card scanres"><div class="scanhead">' + I('alert', 'width:14px;height:14px;color:var(--red)') + 'Сканер не смог загрузить страницу</div><p class="ctext" style="white-space:pre-wrap;margin:0 0 10px">' + esc(err.message) + '</p><button class="btn btn-gh btn-sm" id="scanSet">' + I('gear') + 'Настроить прокси</button></div>';
    $('#scanSet').onclick = () => go('set');
  } finally {
    scanBusy = false; b.disabled = false; b.innerHTML = I('radar') + 'Сканировать';
  }
};

/* ============ detail ============ */
function dlBtn(it) {
  const cp = caps(it);
  if (it.offline) return '<button class="btn btn-dg" id="dDl">' + I('trash') + 'Удалить файл</button>';
  if (it.dl && ['queue', 'run', 'pause'].indexOf(it.dl.st) >= 0) return '<button class="btn btn-gh" id="dDl" style="color:var(--amb);border-color:#FFB02055">' + I('clock') + 'Качается · отменить</button>';
  if (cp.download) return '<button class="btn btn-dl" id="dDl">' + I('dl') + 'Скачать</button>';
  return '<button class="btn btn-gh" id="dDl" style="color:var(--amb);border-color:#FFB02044">' + I('info') + 'Скачивание недоступно</button>';
}
function openDetail(id) {
  const it = byId(id); if (!it) return;
  const c = capOf(it.kind), cp = caps(it);
  openSheet('detail',
    '<div class="dcov" style="' + thumbStyle(it) + '"><div class="dp"><button id="dBig" aria-label="Смотреть">' + I('play') + '</button></div>' + (it.dur ? '<span class="dd">' + ft(it.dur) + '</span>' : '') + (it.offline ? '<span class="bdg off doff">' + I('check') + 'на устройстве</span>' : '') + '</div>' +
    '<div class="dtr"><input class="dti" id="dTitle" value="' + esc(it.title) + '" maxlength="120"><span style="color:var(--dim);margin-top:8px">' + I('edit', 'width:14px;height:14px') + '</span></div>' +
    '<div class="dmetas"><a class="dm a" href="' + esc(it.url) + '" target="_blank" rel="noopener"><span class="dot" style="background:' + c.c + '"></span>' + c.n + ' ' + I('ext') + '</a>' +
    (it.dur ? '<span class="dm">' + I('clock') + ft(it.dur) + '</span>' : '') +
    (it.offline ? '<span class="dm">' + I('hdd') + fsz(it.bytes) + '</span>' : '') +
    '<span class="dm">' + I('plus') + ago(it.addedAt) + '</span>' + (it.author ? '<span class="dm">' + esc(it.author) + '</span>' : '') + '</div>' +
    '<textarea class="dnote" id="dNote" placeholder="Заметка…" maxlength="280">' + esc(it.note) + '</textarea>' +
    '<div class="capbox"><div class="ct">Что реально доступно</div>' +
    '<div class="capline ' + (cp.play ? 'yes' : 'no') + '">' + I(cp.play ? 'check' : 'alert') + '<span>' + (cp.play ? '<b>Играет прямо здесь</b>' : 'Нужен экстрактор — подключи в настройках') + '</span></div>' +
    '<div class="capline ' + (cp.download ? 'yes' : 'no') + '">' + I(cp.download ? 'check' : 'alert') + '<span>' + (cp.download ? '<b>Скачивается байт в байт</b> на устройство' : 'Площадка не отдаёт файл. Избранное хранит только ссылку — 0 МБ') + '</span></div>' +
    '<div class="capline ' + (cp.ctrl === 'full' ? 'yes' : 'no') + '">' + I(cp.ctrl === 'full' ? 'check' : 'info') + '<span>' + (cp.ctrl === 'full' ? 'Полный пульт: перемотка, скорость, качество' : cp.ctrl === 'native' ? 'Встроенный плеер: перемотка внутри него, картинка и звук — в пульте' : 'Управление на стороне источника') + '</span></div></div>' +
    '<div class="dacts"><button class="btn btn-cta" id="dWatch">' + I('play') + (it.offline ? 'Смотреть офлайн' : 'Смотреть') + '</button>' + dlBtn(it) + '</div>' +
    '<div class="dmini"><button class="btn btn-gh favb' + (it.fav ? ' on' : '') + '" id="dFav">' + I(it.fav ? 'heartF' : 'heart') + (it.fav ? 'В избранном' : 'В избранное') + '</button><button class="btn btn-gh" id="dShare">' + I('share') + 'Поделиться</button></div>' +
    (it.offline && it.offline.type === 'file' ? '<div class="dmini"><button class="btn btn-gh" id="dSave">' + I('save') + 'Сохранить в файлы телефона</button></div>' : '') +
    '<button class="ddel" id="dDel">' + I('trash') + 'Удалить с полки</button>',
    (r) => {
      const t = r.querySelector('#dTitle');
      t.onchange = () => { const v = t.value.trim(); if (v && v !== it.title) { it.title = v; save(); renderLib(); renderAdd(); if (PL.id === it.id) $('#pTitle').textContent = v; toast('success', 'Название обновлено'); } };
      const n = r.querySelector('#dNote');
      n.oninput = debounce(() => { it.note = n.value; save(); }, 350);
      n.onchange = () => renderLib();
      const w = () => {
        if (!caps(it).play) { toast('warn', 'Подключи экстрактор в настройках'); closeSheet(true); go('set'); return; }
        closeSheet(true); openPlayer(it.id, ui.vis.length ? ui.vis : [it.id]);
      };
      r.querySelector('#dWatch').onclick = w;
      r.querySelector('#dBig').onclick = w;
      r.querySelector('#dFav').onclick = (e) => {
        fav(it);
        const b = e.currentTarget;
        b.classList.toggle('on', it.fav); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
        b.innerHTML = I(it.fav ? 'heartF' : 'heart') + (it.fav ? 'В избранном' : 'В избранное');
      };
      r.querySelector('#dShare').onclick = async () => {
        sfx('tap');
        try { if (navigator.share) await navigator.share({ title: it.title, url: it.url }); else { await navigator.clipboard.writeText(it.url); toast('success', 'Ссылка скопирована'); } }
        catch (e) { try { await navigator.clipboard.writeText(it.url); toast('success', 'Ссылка скопирована'); } catch (e2) { toast('info', it.url); } }
      };
      r.querySelector('#dDel').onclick = () => { closeSheet(true); delItems([it.id]); };
      const sv = r.querySelector('#dSave'); if (sv) sv.onclick = () => saveToDevice(it.id);
      r.querySelector('#dDl').onclick = () => {
        if (it.offline) { removeOffline(it.id); openDetail(it.id); return; }
        if (it.dl && ['queue', 'run', 'pause'].indexOf(it.dl.st) >= 0) { cancelDl(it.id); openDetail(it.id); return; }
        if (!caps(it).download) { toast('warn', 'Площадка не отдаёт файл. Избранное работает без памяти; для скачивания подключи экстрактор'); return; }
        startDl(it.id); openDetail(it.id);
      };
    });
}
function fav(it) {
  it.fav = !it.fav; save(); sfx('pop'); vibe(8);
  renderLib(); renderAdd();
  if (PL.id === it.id) syncFav();
  toast(it.fav ? 'success' : 'info', it.fav ? 'В избранном — 0 МБ памяти' : 'Убрано из избранного');
}
function offlineKeys(it) {
  if (!it.offline) return [];
  return it.offline.type === 'hls' ? it.offline.keys.concat(it.offline.mapKey ? [it.offline.mapKey] : []) : [it.offline.key];
}
function delItems(ids) {
  const snap = [];
  ids.forEach((id) => { const i = state.items.findIndex((x) => x.id === id); if (i > -1) snap.push({ i: i, it: state.items[i] }); });
  if (!snap.length) return;
  snap.forEach((s) => { if (s.it.offline) blobDel(offlineKeys(s.it)); });
  state.items = state.items.filter((x) => ids.indexOf(x.id) < 0);
  ids.forEach((id) => ui.set.delete(id));
  if (ids.indexOf(PL.id) >= 0) closePlayer();
  save(); renderAll();
  toast('warn', snap.length === 1 ? 'Удалено: ' + snap[0].it.title : 'Удалено: ' + snap.length, {
    action: { label: 'Вернуть', fn: () => { snap.sort((a, b) => a.i - b.i).forEach((s) => state.items.splice(Math.min(s.i, state.items.length), 0, s.it)); save(); renderAll(); sfx('ok'); toast('success', 'Восстановлено'); } }
  });
}

/* ============ downloads ============ */
const RUN = new Map();
function startDl(id) {
  const it = byId(id); if (!it || it.offline) return;
  const src = it.resolvedDownload || it.resolved || it.url;
  const isHls = it.kind === 'hls' && !it.resolved;
  it.dl = { st: 'queue', got: 0, total: 0, spd: 0, segs: 0, doneSeg: 0, canPause: !isHls, src: src, isHls: isHls, parts: [] };
  save(); renderAll(); sfx('tap'); toast('info', 'В очереди: ' + it.title);
}
function pauseDl(id) { const it = byId(id); if (!it || !it.dl) return; const r = RUN.get(id); if (r) r.abort(); it.dl.st = 'pause'; save(); renderOff(); renderNav(); }
function resumeDl(id) { const it = byId(id); if (!it || !it.dl) return; it.dl.st = 'queue'; save(); renderOff(); renderNav(); }
function cancelDl(id) { const it = byId(id); if (!it) return; const r = RUN.get(id); if (r) r.abort(); RUN.delete(id); it.dl = null; save(); renderAll(); toast('info', 'Загрузка отменена'); }
async function removeOffline(id) {
  const it = byId(id); if (!it || !it.offline) return;
  const keys = offlineKeys(it), snap = it.offline, bytes = it.bytes;
  await blobDel(keys); it.offline = null; it.bytes = 0; save(); renderAll();
  toast('warn', 'Файл удалён · ' + fsz(bytes), {
    action: { label: 'Вернуть', fn: async () => {
      if (snap.type === 'file' && snap.blob) {
        try { await blobPut(snap.key, snap.blob); it.offline = { type: 'file', key: snap.key, blob: snap.blob }; it.bytes = bytes; save(); renderAll(); toast('success', 'Файл снова на устройстве'); }
        catch (e) { toast('error', 'Не удалось вернуть файл'); }
      } else toast('info', 'HLS нужно скачать заново — сегменты стёрты');
    } }
  });
}
async function saveToDevice(id) {
  const it = byId(id); if (!it || !it.offline || it.offline.type !== 'file') return;
  const b = await blobGet(it.offline.key);
  if (!b) { toast('error', 'Файл не найден в памяти'); return; }
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u; a.download = (it.title || 'video').replace(/[^\wа-яА-ЯёЁ -]/g, '').slice(0, 60) + '.mp4';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 8000);
  sfx('ok'); toast('success', 'Файл отправлен в загрузки устройства');
}
setInterval(() => {
  if (RUN.size >= 2) return;
  const next = state.items.find((x) => x.dl && x.dl.st === 'queue');
  if (next) { next.dl.st = 'run'; renderOff(); renderNav(); runDl(next); }
}, 400);
async function runDl(it) {
  const ctl = { aborted: false, ac: null, abort: function () { ctl.aborted = true; if (ctl.ac) ctl.ac.abort(); } };
  RUN.set(it.id, ctl);
  try {
    if (it.dl.isHls) await dlHls(it, ctl); else await dlFile(it, ctl);
    if (ctl.aborted) return;
    it.dl = null; save(); renderAll(); sfx('done'); vibe([12, 40, 12]);
    toast('success', 'Скачано: ' + it.title + ' · ' + fsz(it.bytes));
    const el = document.querySelector('[data-done="' + it.id + '"]'); if (el) burst(el);
  } catch (e) {
    RUN.delete(it.id);
    if (ctl.aborted) { if (it.dl && it.dl.st !== 'pause') it.dl.st = 'pause'; save(); renderOff(); return; }
    it.dl = null; save(); renderAll();
    toast('error', 'Загрузка не удалась: ' + (e.message || 'неизвестная ошибка'));
  }
  RUN.delete(it.id);
}
async function dlFile(it, ctl) {
  const d = it.dl;
  let received = d.got || 0;
  const parts = d.parts || [];
  ctl.ac = new AbortController();
  const headers = {};
  if (received > 0) headers.Range = 'bytes=' + received + '-';
  const r = await fetch(d.src, { signal: ctl.ac.signal, headers: headers });
  if (received > 0 && r.status !== 206) { received = 0; parts.length = 0; toast('info', 'Сервер не умеет докачку — качаю с начала'); }
  if (!r.ok && r.status !== 206) throw new Error('HTTP ' + r.status);
  const len = Number(r.headers.get('Content-Length') || 0);
  d.total = (received + len) || d.total || 0;
  if (!r.body) {
    const b = await r.blob(); parts.push(b); received = b.size; addBytes(b.size);
  } else {
    const rd = r.body.getReader();
    let t0 = performance.now(), b0 = received;
    for (;;) {
      const chunk = await rd.read();
      if (chunk.done) break;
      parts.push(chunk.value); received += chunk.value.byteLength; addBytes(chunk.value.byteLength);
      d.got = received;
      const dt = (performance.now() - t0) / 1000;
      if (dt >= 0.5) { const mbps = ((received - b0) * 8 / 1e6) / dt; d.spd = mbps / 8; pushReal(mbps); b0 = received; t0 = performance.now(); }
      paintDl(it);
      if (ctl.aborted) throw new Error('abort');
    }
  }
  const blob = new Blob(parts, { type: 'video/mp4' });
  const key = 'f_' + it.id;
  await blobPut(key, blob);
  it.offline = { type: 'file', key: key, blob: blob };
  it.bytes = blob.size; d.parts = []; d.got = blob.size; d.total = blob.size;
  if (!it.dur) { try { const u = URL.createObjectURL(blob); it.dur = Math.round(await probe(u, false)); URL.revokeObjectURL(u); } catch (e) {} }
}
function parsePlaylist(text, base) {
  const lines = text.split(/\r?\n/);
  const segs = []; let map = null, key = null, dur = 0;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i].trim();
    if (L.indexOf('#EXT-X-KEY') === 0 && !/METHOD=NONE/.test(L)) key = L;
    if (L.indexOf('#EXT-X-MAP') === 0) { const m = L.match(/URI="([^"]+)"/); if (m) map = new URL(m[1], base).href; }
    if (L.indexOf('#EXTINF') === 0) dur += parseFloat(L.split(':')[1]) || 0;
    if (L && L[0] !== '#') segs.push(new URL(L, base).href);
  }
  return { segs: segs, map: map, key: key, dur: dur };
}
async function dlHls(it, ctl) {
  const d = it.dl;
  await ensureHls();
  ctl.ac = new AbortController();
  let masterUrl = d.src;
  let text = await (await fetch(masterUrl, { signal: ctl.ac.signal })).text();
  if (text.indexOf('#EXT-X-STREAM-INF') >= 0) {
    const lines = text.split(/\r?\n/), variants = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].indexOf('#EXT-X-STREAM-INF') === 0) {
        const bw = Number((lines[i].match(/BANDWIDTH=(\d+)/) || [])[1] || 0);
        const hh = (lines[i].match(/RESOLUTION=\d+x(\d+)/) || [])[1] || 0;
        const u = lines[i + 1] && lines[i + 1].trim();
        if (u && u[0] !== '#') variants.push({ bw: bw, h: +hh, url: new URL(u, masterUrl).href });
      }
    }
    if (!variants.length) throw new Error('пустой мастер-плейлист');
    const cap = state.settings.eco ? (state.settings.cap || 480) : 0;
    let pick = variants.sort((a, b) => a.bw - b.bw);
    if (cap) { const ok = pick.filter((v) => v.h && v.h <= cap); if (ok.length) pick = ok; }
    masterUrl = pick[pick.length - 1].url;
    text = await (await fetch(masterUrl, { signal: ctl.ac.signal })).text();
  }
  const pl = parsePlaylist(text, masterUrl);
  if (pl.key) throw new Error('поток зашифрован — офлайн невозможен');
  if (!pl.segs.length) throw new Error('в плейлисте нет сегментов');
  d.segs = pl.segs.length; d.doneSeg = 0; d.total = 0;
  const keys = []; let total = 0, mapKey = null;
  if (pl.map) {
    const b = await (await fetch(pl.map, { signal: ctl.ac.signal })).blob();
    mapKey = 'm_' + it.id; await blobPut(mapKey, b); total += b.size; addBytes(b.size);
  }
  let t0 = performance.now(), b0 = 0;
  for (let i = 0; i < pl.segs.length; i++) {
    if (ctl.aborted) throw new Error('abort');
    const b = await (await fetch(pl.segs[i], { signal: ctl.ac.signal })).blob();
    const k = 's_' + it.id + '_' + i;
    await blobPut(k, b); keys.push(k);
    total += b.size; addBytes(b.size); d.got = total; d.doneSeg = i + 1;
    const dt = (performance.now() - t0) / 1000;
    if (dt >= 0.6) { const mbps = ((total - b0) * 8 / 1e6) / dt; pushReal(mbps); d.spd = mbps / 8; b0 = total; t0 = performance.now(); }
    paintDl(it);
  }
  let local = text;
  if (pl.map) local = local.replace(/#EXT-X-MAP:([^\n]*)URI="([^"]+)"/, (m, a) => '#EXT-X-MAP:' + a + 'URI="__MAP__"');
  let idx = 0;
  local = local.split(/\r?\n/).map((L) => { const t = L.trim(); if (t && t[0] !== '#') return '__SEG' + (idx++) + '__'; return L; }).join('\n');
  it.offline = { type: 'hls', playlist: local, keys: keys, mapKey: mapKey };
  it.bytes = total;
  if (!it.dur && pl.dur) it.dur = Math.round(pl.dur);
}
function paintDl(it) {
  const el = document.querySelector('[data-dl="' + it.id + '"]');
  if (!el || !it.dl) return;
  const d = it.dl;
  const pct = d.total ? clamp(d.got / d.total * 100, 0, 100) : (d.segs ? clamp(d.doneSeg / d.segs * 100, 0, 100) : 0);
  el.querySelector('.dlf').style.width = pct + '%';
  el.querySelector('.pct').textContent = Math.floor(pct) + '%';
  el.querySelector('.got').textContent = fsz(d.got) + (d.total ? ' / ' + fsz(d.total) : '');
  el.querySelector('.dlm').textContent = d.segs
    ? 'Сегменты ' + d.doneSeg + '/' + d.segs + ' · ' + fsz(d.got)
    : fsz(d.got) + (d.total ? ' / ' + fsz(d.total) : '') + ' · ' + (d.spd || 0).toFixed(1).replace('.', ',') + ' МБ/с';
}
function burst(el) {
  const C = ['#B8FF3D', '#00E5C7', '#3B9DFF', '#FFB020', '#FF3D8B', '#A78BFA'];
  for (let i = 0; i < 12; i++) {
    const s = document.createElement('span');
    s.className = 'burst'; s.style.background = C[i % 6];
    s.style.setProperty('--dx', (Math.random() * 130 - 65) + 'px');
    s.style.setProperty('--dy', (Math.random() * -76 - 8) + 'px');
    el.appendChild(s);
    s.addEventListener('animationend', () => s.remove());
  }
}
function wipe() {
  const done = state.items.filter((x) => x.offline);
  if (!done.length) return;
  confirmSheet('Очистить память?', 'Удалится ' + done.length + ' файлов (' + fsz(done.reduce((s, x) => s + (x.bytes || 0), 0)) + '). Ссылки и избранное останутся.', 'Очистить', async () => {
    for (const it of done) { await blobDel(offlineKeys(it)); it.offline = null; it.bytes = 0; }
    save(); renderAll(); toast('warn', 'Память освобождена');
  });
}
$('#btnWipe').onclick = wipe;
$('#btnFree').onclick = wipe;
$('#scr-off').addEventListener('click', (e) => {
  const p = e.target.closest('[data-pause]'); if (p) { pauseDl(p.dataset.pause); return; }
  const r = e.target.closest('[data-resume]'); if (r) { resumeDl(r.dataset.resume); return; }
  const c = e.target.closest('[data-cancel]'); if (c) { cancelDl(c.dataset.cancel); return; }
  const rm = e.target.closest('[data-rm]'); if (rm) { removeOffline(rm.dataset.rm); return; }
  const sv = e.target.closest('[data-save]'); if (sv) { saveToDevice(sv.dataset.save); return; }
  const pl = e.target.closest('[data-play]');
  if (pl) { const it = byId(pl.dataset.play); if (it) { sfx('tap'); openPlayer(it.id, state.items.filter((x) => x.offline).map((x) => x.id)); } return; }
  const row = e.target.closest('[data-done]');
  if (row && !e.target.closest('button')) openDetail(row.dataset.done);
});

/* ============ PLAYER ============ */
const pv = $('#pv');
const PL = { id: null, list: [], engine: null, mode: null, hls: null, dash: null, yt: null, vm: null, dur: 0, time: 0, paused: true, bufPct: 0, raf: 0, urls: [], levels: [], ab: { a: null, b: null, on: false }, applied: false, vmBusy: false, vmT: 0, vmD: 0, lastSave: 0, corsTried: false, nextTimer: null, scrub: false };

function syncFav() { const it = byId(PL.id); if (!it) return; $('#pFavIco').setAttribute('href', it.fav ? '#i-heartF' : '#i-heart'); $('#pFav').classList.toggle('on', it.fav); }
function syncMute() { const m = state.settings.muted || +$('#rVol').value === 0; $('#pMuteIco').setAttribute('href', m ? '#i-spkx' : '#i-spk'); }
function flash(n) { $('#pFlashIco').setAttribute('href', '#i-' + n); const f = $('#pFlash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
function setPlayed(f) { f = clamp(f || 0, 0, 1); $('#pPlayed').style.width = f * 100 + '%'; $('#pDot').style.left = f * 100 + '%'; }
function applyPic() {
  const b = +$('#rBri').value, c = +$('#rCon').value, s = +$('#rSat').value, w = $('#swWarm').checked;
  $('#mediaHost').style.filter = 'brightness(' + b + ') contrast(' + c + ') saturate(' + s + ')' + (w ? ' sepia(.28) hue-rotate(-8deg)' : '');
  $('#vBri').textContent = Math.round(b * 100) + '%';
  $('#vCon').textContent = Math.round(c * 100) + '%';
  $('#vSat').textContent = Math.round(s * 100) + '%';
  const fit = $('#selFit').value;
  pv.style.objectFit = fit;
  const fr = $('#mediaHost').querySelector('iframe');
  if (fr) { fr.style.transform = fit === 'cover' ? 'scale(1.34)' : fit === 'fill' ? 'scaleY(1.02)' : 'none'; fr.style.transformOrigin = 'center'; }
}
function setTile(sel, enabled, note) {
  const t = $(sel); if (!t) return;
  t.classList.toggle('off', !enabled);
  t.querySelectorAll('input,select,button').forEach((e) => { e.disabled = !enabled; });
  const na = t.querySelector('.na'); if (na) na.textContent = enabled ? '' : (note || 'нет');
}
function showErr(t, x) { $('#errTitle').textContent = t; $('#errText').textContent = x; $('#pErr').classList.add('show'); $('#pSpin').classList.remove('show'); sfx('err'); }

async function openPlayer(id, list) {
  const it = byId(id); if (!it) return;
  destroyEngine();
  PL.id = id; PL.list = list && list.indexOf(id) >= 0 ? list : [id];
  PL.applied = false; PL.time = 0; PL.dur = it.dur || 0; PL.bufPct = 0; PL.corsTried = false;
  PL.ab = { a: null, b: null, on: false };
  $('#player').classList.add('open');
  $('#pErr').classList.remove('show'); $('#pSpin').classList.remove('show');
  $('#abMark').classList.remove('show'); $('#vAB').textContent = 'выкл';
  $('#abA').classList.remove('set'); $('#abB').classList.remove('set');
  $('#pTitle').textContent = it.title;
  const c = capOf(it.kind);
  $('#pMeta').innerHTML = '<span class="dot" style="background:' + c.c + '"></span>' + c.n + (it.offline ? ' · офлайн с устройства' : '') + (it.resolved ? ' · через экстрактор' : '');
  syncFav();
  $('#pCur').textContent = ft(it.pos || 0);
  $('#pDur').textContent = it.dur ? ft(it.dur) : '--:--';
  setPlayed(it.dur ? it.pos / it.dur : 0);
  $('#pBuf').style.width = '0%';
  $('#rSpeed').value = 1; $('#vSpeed').textContent = '1.00×';
  $('#rVol').value = state.settings.muted ? 0 : 1; $('#vVol').textContent = Math.round((state.settings.muted ? 0 : 1) * 100) + '%';
  $('#selCap').value = String(state.settings.eco ? (state.settings.cap || 0) : 0);
  $('#selSub').innerHTML = '<option value="-1">Выключены</option>';
  $('#selQual').innerHTML = '<option value="-1">Авто</option>';
  $('#swLoop').checked = false;
  $('#pPip').hidden = !document.pictureInPictureEnabled;
  $('#pFull').hidden = !document.fullscreenEnabled;
  applyPic(); syncMute();
  const cp = caps(it), eng = cp.engine;
  PL.mode = eng;
  const external = eng === 'frame';
  $('#extNote').classList.toggle('show', external);
  $('#pSeek').style.display = external ? 'none' : 'flex';
  $('#pCur').style.display = external ? 'none' : '';
  $('#pDur').style.display = external ? 'none' : '';
  $('#pB10').disabled = external; $('#pF10').disabled = external;
  $('#pZones').style.display = external ? 'none' : 'flex';
  setTile('#tSpeed', !external); setTile('#tVol', !external); setTile('#tAB', !external);
  setTile('#tQual', false, 'авто'); setTile('#tCap', false, 'нет'); setTile('#tSub', false, 'нет');
  $('#deckMode').textContent = eng === 'native' ? 'файл' : eng === 'hls' ? 'HLS' : eng === 'dash' ? 'DASH' : eng === 'yt' ? 'YouTube API' : eng === 'vimeo' ? 'Vimeo API' : eng === 'frame' ? 'встроенный' : '—';
  try {
    if (eng === 'native') await mountNative(it);
    else if (eng === 'hls') await mountHls(it);
    else if (eng === 'dash') await mountDash(it);
    else if (eng === 'yt') await mountYT(it);
    else if (eng === 'vimeo') await mountVimeo(it);
    else if (eng === 'frame') mountFrame(it);
    else throw new Error('Для этого сайта нужен экстрактор. Подключи его в настройках — готовый код сервера там же.');
  } catch (e) { showErr('Не запустилось', e.message || 'Источник недоступен'); }
  startLoop();
}
function destroyEngine() {
  stopLoop();
  if (PL.nextTimer) { clearInterval(PL.nextTimer); PL.nextTimer = null; }
  try { pv.pause(); } catch (e) {}
  if (PL.hls) { try { PL.hls.destroy(); } catch (e) {} PL.hls = null; }
  if (PL.dash) { try { PL.dash.reset(); } catch (e) {} PL.dash = null; }
  if (PL.yt) { try { PL.yt.destroy(); } catch (e) {} PL.yt = null; }
  if (PL.vm) { try { PL.vm.unload().catch(() => {}); } catch (e) {} PL.vm = null; }
  $('#mediaHost').querySelectorAll('iframe,.mount').forEach((n) => n.remove());
  PL.urls.forEach((u) => { try { URL.revokeObjectURL(u); } catch (e) {} });
  PL.urls = [];
  pv.onwaiting = pv.onplaying = pv.onended = pv.onplay = pv.onpause = pv.onerror = pv.onloadedmetadata = null;
  pv.removeAttribute('src'); pv.removeAttribute('crossorigin');
  try { pv.load(); } catch (e) {}
  pv.style.display = 'none';
  PL.levels = []; PL.engine = null;
}
function closePlayer() {
  if (!$('#player').classList.contains('open')) return;
  const it = byId(PL.id);
  if (it && PL.time > 0) {
    it.pos = isSeen(it) ? it.dur : PL.time; it.seenAt = Date.now();
    if (PL.dur > 0 && Math.abs(PL.dur - it.dur) > 2) it.dur = Math.round(PL.dur);
    save();
  }
  try { if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {}); } catch (e) {}
  try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {}
  destroyEngine();
  $('#player').classList.remove('open', 'fs');
  PL.id = null;
  renderAll();
}
$('#pBack').onclick = () => { sfx('tap'); closePlayer(); };
$('#pOpen').onclick = () => { const it = byId(PL.id); if (it) window.open(it.url, '_blank', 'noopener'); };
$('#pFav').onclick = () => { const it = byId(PL.id); if (it) { fav(it); const b = $('#pFav'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); } };

function nativeEngine() {
  return {
    play: () => pv.play(), pause: () => pv.pause(), seek: (t) => { pv.currentTime = t; },
    time: () => pv.currentTime, dur: () => pv.duration || PL.dur,
    rate: (r) => { pv.playbackRate = r; },
    vol: (v) => { pv.volume = v; pv.muted = v === 0 || state.settings.muted; },
    paused: () => pv.paused
  };
}
function bindNativeEvents(onMeta) {
  pv.onwaiting = () => { $('#pSpin').classList.add('show'); $('#pSpinTxt').textContent = 'Буферизация…'; };
  pv.onplaying = () => $('#pSpin').classList.remove('show');
  pv.oncanplay = () => $('#pSpin').classList.remove('show');
  pv.onended = () => onEnded();
  pv.onplay = () => $('#pPlayIco').setAttribute('href', '#i-pause');
  pv.onpause = () => $('#pPlayIco').setAttribute('href', '#i-play');
  pv.onloadedmetadata = onMeta;
}
function applyResume(it) {
  if (!state.settings.pos || !it || !(it.pos > 15) || !(it.pos < (PL.dur || 1e9) - 20)) return;
  try { pv.currentTime = it.pos; toast('info', 'Продолжаем с ' + ft(it.pos)); } catch (e) {}
}
function syncDur(it) {
  PL.dur = pv.duration || PL.dur;
  $('#pDur').textContent = ft(PL.dur);
  if (it && PL.dur > 0 && Math.abs(PL.dur - it.dur) > 2) { it.dur = Math.round(PL.dur); save(); renderLib(); }
}
async function mountNative(it) {
  let src = it.resolved || it.url;
  if (it.offline && it.offline.type === 'file') {
    const b = await blobGet(it.offline.key);
    if (!b) throw new Error('Файл не найден в памяти устройства');
    src = URL.createObjectURL(b); PL.urls.push(src);
  }
  pv.style.display = 'block';
  if (CORS_OK.indexOf(host(it.url)) >= 0 || src.indexOf('blob:') === 0) pv.crossOrigin = 'anonymous';
  PL.engine = nativeEngine();
  bindNativeEvents(() => { syncDur(it); if (!PL.applied) { PL.applied = true; applyResume(it); } pv.play().catch(() => {}); setupTracks(); });
  pv.onerror = () => {
    if (pv.crossOrigin && !PL.corsTried) { PL.corsTried = true; pv.removeAttribute('crossorigin'); pv.src = src; pv.load(); return; }
    if ($('#player').classList.contains('open')) showErr('Файл не играет', 'Источник недоступен, формат не поддерживается или сервер закрыл доступ. Открой источник или попробуй другую ссылку.');
  };
  pv.src = src; pv.load();
  setTile('#tQual', false, 'исходное'); setTile('#tCap', false, 'файл');
  $('#btnShot').disabled = false;
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: it.title, artist: capOf(it.kind).n, artwork: it.thumb ? [{ src: it.thumb, sizes: '480x360', type: 'image/jpeg' }] : [] });
      navigator.mediaSession.setActionHandler('play', () => pv.play());
      navigator.mediaSession.setActionHandler('pause', () => pv.pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => skip(-10));
      navigator.mediaSession.setActionHandler('seekforward', () => skip(10));
    } catch (e) {}
  }
}
function setupTracks() {
  const tt = pv.textTracks;
  if (!tt || !tt.length) { setTile('#tSub', false, 'нет'); return; }
  const opts = ['<option value="-1">Выключены</option>'];
  for (let i = 0; i < tt.length; i++) { tt[i].mode = 'disabled'; opts.push('<option value="' + i + '">' + esc(tt[i].label || tt[i].language || 'Дорожка ' + (i + 1)) + '</option>'); }
  $('#selSub').innerHTML = opts.join('');
  setTile('#tSub', true);
}
async function mountHls(it) {
  pv.style.display = 'block';
  let src = it.url;
  if (it.offline && it.offline.type === 'hls') {
    let text = it.offline.playlist;
    if (it.offline.mapKey) {
      const mb = await blobGet(it.offline.mapKey);
      if (mb) { const u = URL.createObjectURL(mb); PL.urls.push(u); text = text.replace('__MAP__', u); }
    }
    for (let i = 0; i < it.offline.keys.length; i++) {
      const b = await blobGet(it.offline.keys[i]);
      if (!b) throw new Error('Сегмент ' + (i + 1) + ' потерян — скачай заново');
      const u = URL.createObjectURL(b); PL.urls.push(u);
      text = text.replace('__SEG' + i + '__', u);
    }
    const local = URL.createObjectURL(new Blob([text], { type: 'application/vnd.apple.mpegurl' }));
    PL.urls.push(local); src = local;
  }
  await ensureHls();
  PL.engine = nativeEngine();
  bindNativeEvents(() => { syncDur(it); if (!PL.applied) { PL.applied = true; applyResume(it); } });
  if (window.Hls && window.Hls.isSupported()) {
    const hls = new window.Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: state.settings.eco ? 18 : 30, backBufferLength: 20 });
    PL.hls = hls;
    hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
      PL.levels = hls.levels || [];
      $('#selQual').innerHTML = '<option value="-1">Авто</option>' + PL.levels.map((l, i) =>
        '<option value="' + i + '">' + (l.height ? l.height + 'p' : Math.round(l.bitrate / 1000) + ' кбит/с') + '</option>').join('');
      setTile('#tQual', PL.levels.length > 1, 'одна');
      setTile('#tCap', PL.levels.length > 1, 'одна');
      applyCap();
      pv.play().catch(() => {});
    });
    hls.on(window.Hls.Events.LEVEL_SWITCHED, (e, d) => {
      if ($('#selQual').value === '-1') { const l = PL.levels[d.level]; if (l && l.height) $('#naQual').textContent = 'авто·' + l.height + 'p'; }
    });
    hls.on(window.Hls.Events.FRAG_LOADED, (e, d) => {
      const st = d.frag && d.frag.stats;
      if (!st) return;
      const bytes = st.loaded || 0; addBytes(bytes);
      const dur = (st.loading && st.loading.end - st.loading.start) || 0;
      if (dur > 0) pushReal(bytes * 8 / 1e6 / (dur / 1000));
    });
    hls.on(window.Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
      const tr = hls.subtitleTracks || [];
      if (tr.length) {
        $('#selSub').innerHTML = '<option value="-1">Выключены</option>' + tr.map((t, i) => '<option value="' + i + '">' + esc(t.name || t.lang || 'Дорожка ' + (i + 1)) + '</option>').join('');
        setTile('#tSub', true);
      } else setTile('#tSub', false, 'нет');
    });
    hls.on(window.Hls.Events.ERROR, (e, d) => {
      if (!d.fatal) return;
      if (d.type === window.Hls.ErrorTypes.NETWORK_ERROR) { try { hls.startLoad(); } catch (x) {} }
      else if (d.type === window.Hls.ErrorTypes.MEDIA_ERROR) { try { hls.recoverMediaError(); } catch (x) {} }
      else showErr('Поток оборвался', 'HLS сообщил фатальную ошибку: ' + (d.details || 'неизвестно'));
    });
    hls.loadSource(src); hls.attachMedia(pv);
  } else if (pv.canPlayType('application/vnd.apple.mpegurl')) {
    pv.src = src; pv.load();
    pv.play().catch(() => {});
    setTile('#tQual', false, 'системное'); setTile('#tCap', false, 'системное');
  } else throw new Error('Браузер не поддерживает HLS');
  pv.onerror = () => { if (!PL.hls && $('#player').classList.contains('open')) showErr('HLS не играет', 'Поток недоступен или закрыт CORS.'); };
  $('#btnShot').disabled = false;
}
async function mountDash(it) {
  await ensureDash();
  if (!window.dashjs) throw new Error('dash.js не загрузился');
  pv.style.display = 'block';
  PL.engine = nativeEngine();
  bindNativeEvents(() => { syncDur(it); if (!PL.applied) { PL.applied = true; applyResume(it); } });
  const mp = window.dashjs.MediaPlayer().create();
  PL.dash = mp;
  mp.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } }, buffer: { fastSwitchEnabled: true } } });
  mp.initialize(pv, it.url, true);
  mp.on(window.dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => {
    try {
      const list = mp.getBitrateInfoListFor('video') || [];
      PL.levels = list.map((b) => ({ height: b.height, bitrate: b.bitrate }));
      $('#selQual').innerHTML = '<option value="-1">Авто</option>' + PL.levels.map((l, i) => '<option value="' + i + '">' + (l.height ? l.height + 'p' : Math.round(l.bitrate / 1000) + 'к') + '</option>').join('');
      setTile('#tQual', PL.levels.length > 1, 'одна');
      setTile('#tCap', false, 'DASH авто');
    } catch (e) {}
    pv.play().catch(() => {});
  });
  mp.on(window.dashjs.MediaPlayer.events.ERROR, (e) => {
    showErr('DASH не играет', (e && e.error && e.error.message) || 'Поток недоступен или закрыт CORS.');
  });
  $('#btnShot').disabled = false;
}
async function mountYT(it) {
  await ensureYT();
  const mount = document.createElement('div');
  mount.className = 'mount'; mount.id = 'ytMount';
  $('#mediaHost').appendChild(mount);
  await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('YouTube не ответил')), 14000);
    PL.yt = new window.YT.Player('ytMount', {
      videoId: it.pid,
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin, autoplay: 1 },
      events: {
        onReady: (e) => {
          clearTimeout(to);
          PL.engine = {
            play: () => e.target.playVideo(), pause: () => e.target.pauseVideo(), seek: (t) => e.target.seekTo(t, true),
            time: () => e.target.getCurrentTime() || 0, dur: () => e.target.getDuration() || PL.dur,
            rate: (r) => e.target.setPlaybackRate(r),
            vol: (v) => { e.target.setVolume(Math.round(v * 100)); if (v === 0 || state.settings.muted) e.target.mute(); else e.target.unMute(); },
            paused: () => e.target.getPlayerState() !== 1
          };
          PL.dur = e.target.getDuration() || PL.dur;
          $('#pDur').textContent = ft(PL.dur);
          if (PL.dur > 0 && Math.abs(PL.dur - it.dur) > 2) { it.dur = Math.round(PL.dur); save(); renderLib(); }
          if (state.settings.pos && it.pos > 15 && it.pos < PL.dur - 20) { e.target.seekTo(it.pos, true); toast('info', 'Продолжаем с ' + ft(it.pos)); }
          e.target.setVolume(Math.round(+$('#rVol').value * 100));
          e.target.playVideo();
          res();
        },
        onStateChange: (e) => {
          if (e.data === 1) { $('#pPlayIco').setAttribute('href', '#i-pause'); $('#pSpin').classList.remove('show'); }
          if (e.data === 2) $('#pPlayIco').setAttribute('href', '#i-play');
          if (e.data === 3) { $('#pSpin').classList.add('show'); $('#pSpinTxt').textContent = 'YouTube буферизует…'; }
          if (e.data === 0) onEnded();
        },
        onError: (e) => {
          clearTimeout(to);
          const map = { 2: 'Неверный идентификатор ролика', 5: 'Ошибка HTML5-плеера', 100: 'Ролик удалён или скрыт', 101: 'Владелец запретил встраивание', 150: 'Владелец запретил встраивание' };
          showErr('YouTube не отдал ролик', (map[e.data] || 'Код ' + e.data) + '. Это ограничение площадки — открой ролик кнопкой «Источник».');
          rej(new Error('yt-' + e.data));
        }
      }
    });
  });
  setTile('#tQual', false, 'YouTube'); setTile('#tCap', false, 'YouTube'); setTile('#tSub', false, 'в плеере');
  $('#btnShot').disabled = true;
}
async function mountVimeo(it) {
  await ensureVimeo();
  const mount = document.createElement('div');
  mount.className = 'mount';
  $('#mediaHost').appendChild(mount);
  const p = new window.Vimeo.Player(mount, { id: it.pid, playsinline: true, autoplay: true, controls: false });
  PL.vm = p;
  await p.ready();
  PL.dur = await p.getDuration().catch(() => PL.dur);
  $('#pDur').textContent = ft(PL.dur);
  if (PL.dur > 0 && Math.abs(PL.dur - it.dur) > 2) { it.dur = Math.round(PL.dur); save(); renderLib(); }
  if (state.settings.pos && it.pos > 15 && it.pos < PL.dur - 20) { await p.setCurrentTime(it.pos).catch(() => {}); toast('info', 'Продолжаем с ' + ft(it.pos)); }
  await p.setVolume(+$('#rVol').value).catch(() => {});
  p.play().catch(() => {});
  p.on('play', () => { $('#pPlayIco').setAttribute('href', '#i-pause'); $('#pSpin').classList.remove('show'); });
  p.on('pause', () => $('#pPlayIco').setAttribute('href', '#i-play'));
  p.on('ended', () => onEnded());
  p.on('bufferstart', () => { $('#pSpin').classList.add('show'); $('#pSpinTxt').textContent = 'Vimeo буферизует…'; });
  p.on('bufferend', () => $('#pSpin').classList.remove('show'));
  p.on('error', (e) => showErr('Vimeo не отдал ролик', (e && e.message) || 'Возможно, ролик закрыт приватностью.'));
  PL.engine = {
    play: () => p.play().catch(() => {}), pause: () => p.pause().catch(() => {}), seek: (t) => p.setCurrentTime(t).catch(() => {}),
    time: () => PL.vmT, dur: () => PL.vmD || PL.dur, rate: (r) => p.setPlaybackRate(r).catch(() => {}),
    vol: (v) => p.setVolume(state.settings.muted ? 0 : v).catch(() => {}), paused: () => PL.paused
  };
  const q = await p.getQualities().catch(() => []);
  if (q && q.length > 1) {
    $('#selQual').innerHTML = '<option value="-1">Авто</option>' + q.map((x) => '<option value="' + esc(x.id) + '">' + esc(x.label) + '</option>').join('');
    setTile('#tQual', true);
  } else setTile('#tQual', false, 'Vimeo');
  setTile('#tCap', false, 'Vimeo');
  const tt = await p.getTextTracks().catch(() => []);
  if (tt && tt.length) {
    $('#selSub').innerHTML = '<option value="-1">Выключены</option>' + tt.map((t, i) => '<option value="' + i + '">' + esc(t.label || t.language) + '</option>').join('');
    setTile('#tSub', true);
  } else setTile('#tSub', false, 'нет');
  $('#btnShot').disabled = true;
}
function mountFrame(it) {
  const h = location.hostname;
  let src = '';
  if (it.kind === 'rutube') src = 'https://rutube.ru/play/embed/' + it.pid;
  else if (it.kind === 'dailymotion') src = 'https://www.dailymotion.com/embed/video/' + it.pid;
  else if (it.kind === 'ok') src = 'https://ok.ru/videoembed/' + it.pid;
  else if (it.kind === 'tiktok') src = 'https://www.tiktok.com/embed/v2/' + it.pid;
  else if (it.kind === 'twitch') {
    if (!h) throw new Error('Twitch требует домен. Открой приложение по http(s), а не как локальный файл.');
    src = 'https://player.twitch.tv/?' + (it.url.indexOf('/videos/') >= 0 ? 'video=' + it.pid : 'channel=' + it.pid) + '&parent=' + h + '&autoplay=true';
  }
  if (!src) throw new Error('Не собран адрес встроенного плеера');
  const f = document.createElement('iframe');
  f.src = src;
  f.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
  f.allowFullscreen = true;
  f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  $('#mediaHost').appendChild(f);
  PL.engine = null; PL.paused = false;
  $('#pPlayIco').setAttribute('href', '#i-play');
  $('#btnShot').disabled = true;
  toast('info', 'Встроенный плеер ' + capOf(it.kind).n + '. Если ролик закрыт — кнопка «Источник».');
}
function startLoop() { stopLoop(); const step = () => { PL.raf = requestAnimationFrame(step); tick(); }; PL.raf = requestAnimationFrame(step); }
function stopLoop() { if (PL.raf) { cancelAnimationFrame(PL.raf); PL.raf = 0; } }
function tick() {
  if (!$('#player').classList.contains('open')) return;
  if (PL.vm && !PL.vmBusy) {
    PL.vmBusy = true;
    Promise.all([PL.vm.getCurrentTime().catch(() => PL.vmT), PL.vm.getDuration().catch(() => PL.vmD), PL.vm.getPaused().catch(() => PL.paused)])
      .then((r) => { PL.vmT = r[0] || 0; PL.vmD = r[1] || PL.vmD; PL.paused = !!r[2]; })
      .finally(() => { PL.vmBusy = false; });
  }
  const e = PL.engine;
  if (e) {
    const t = e.time() || 0, d = e.dur() || PL.dur;
    PL.time = t; PL.dur = d; PL.paused = e.paused();
    if (!PL.scrub) { $('#pCur').textContent = ft(t); if (d) $('#pDur').textContent = ft(d); setPlayed(d ? t / d : 0); }
    if (PL.ab.on && PL.ab.a != null && PL.ab.b != null && t >= PL.ab.b) e.seek(PL.ab.a);
    const it = byId(PL.id);
    if (it && Date.now() - PL.lastSave > 3000) { PL.lastSave = Date.now(); it.pos = t; it.seenAt = Date.now(); save(); }
  }
  if (pv.buffered && pv.buffered.length && pv.duration) {
    try {
      const end = pv.buffered.end(pv.buffered.length - 1);
      PL.bufPct = clamp(end / pv.duration, 0, 1);
      $('#pBuf').style.width = PL.bufPct * 100 + '%';
      if ($('#pSpin').classList.contains('show')) $('#pSpinTxt').textContent = 'Буферизация… ' + Math.floor(PL.bufPct * 100) + '%';
    } catch (x) {}
  }
}
function onEnded() {
  const it = byId(PL.id);
  if (it) { it.pos = it.dur; it.seenAt = Date.now(); save(); renderLib(); renderAdd(); }
  if ($('#swLoop').checked && PL.engine) { PL.engine.seek(0); PL.engine.play(); return; }
  const i = PL.list.indexOf(PL.id), nid = PL.list[i + 1], nx = nid && byId(nid);
  $('#pPlayIco').setAttribute('href', '#i-play');
  if (state.settings.next && nx) {
    let n = 5;
    toast('info', 'Следующий через ' + n + ': ' + nx.title, { life: 5200 });
    if (PL.nextTimer) clearInterval(PL.nextTimer);
    PL.nextTimer = setInterval(() => {
      n--;
      if (n <= 0) { clearInterval(PL.nextTimer); PL.nextTimer = null; if ($('#player').classList.contains('open')) openPlayer(nx.id, PL.list); }
    }, 1000);
  }
}
function togglePlay() {
  if (!PL.engine) { toast('info', 'Управление внутри встроенного плеера'); return; }
  if (PL.paused) { PL.engine.play(); flash('play'); } else { PL.engine.pause(); flash('pause'); }
}
function skip(s) { if (!PL.engine) return; PL.engine.seek(clamp((PL.engine.time() || 0) + s, 0, PL.dur || 1e9)); flash(s > 0 ? 'f10' : 'b10'); }
$('#pPlay').onclick = togglePlay;
$('#pB10').onclick = () => skip(-10);
$('#pF10').onclick = () => skip(10);
$('#pMute').onclick = () => {
  const v = +$('#rVol').value;
  if (v > 0) { $('#rVol').dataset.prev = v; $('#rVol').value = 0; } else $('#rVol').value = $('#rVol').dataset.prev || 1;
  onVol(); sfx('tap');
};
$('#pPip').onclick = async () => {
  try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await pv.requestPictureInPicture(); sfx('tap'); }
  catch (e) { toast('warn', 'Картинка-в-картинке недоступна для этого источника'); }
};
$('#pFull').onclick = () => {
  try {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else $('#player').requestFullscreen().catch(() => toast('warn', 'Полный экран недоступен'));
    sfx('tap');
  } catch (e) {}
};
document.addEventListener('fullscreenchange', () => { $('#player').classList.toggle('fs', !!document.fullscreenElement); });
$('#errRetry').onclick = () => { $('#pErr').classList.remove('show'); const id = PL.id; if (id) openPlayer(id, PL.list); };
$('#errOpen').onclick = () => { const it = byId(PL.id); if (it) window.open(it.url, '_blank', 'noopener'); };
(function () {
  const s = $('#pSeek');
  const pf = (e) => { const r = s.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1); };
  const preview = (e) => { const p = pf(e); setPlayed(p); const b = $('#pBub'); b.style.left = p * 100 + '%'; b.textContent = ft(p * (PL.dur || 0)); };
  s.addEventListener('pointerdown', (e) => { if (!PL.engine) return; PL.scrub = true; s.classList.add('scrub'); s.setPointerCapture(e.pointerId); preview(e); });
  s.addEventListener('pointermove', (e) => { if (PL.scrub) preview(e); });
  const up = (e) => {
    if (!PL.scrub) return;
    PL.scrub = false; s.classList.remove('scrub');
    const p = pf(e);
    if (PL.engine && PL.dur) { PL.engine.seek(p * PL.dur); setPlayed(p); $('#pCur').textContent = ft(p * PL.dur); }
  };
  s.addEventListener('pointerup', up); s.addEventListener('pointercancel', up);
})();
(function () {
  let tl = null, tr = null, tc = null;
  $('#zL').addEventListener('click', () => {
    if (tl) { clearTimeout(tl); tl = null; skip(-10); const f = $('#fL'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
    else tl = setTimeout(() => { tl = null; togglePlay(); }, 260);
  });
  $('#zR').addEventListener('click', () => {
    if (tr) { clearTimeout(tr); tr = null; skip(10); const f = $('#fR'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
    else tr = setTimeout(() => { tr = null; togglePlay(); }, 260);
  });
  $('#zC').addEventListener('click', () => {
    if (tc) { clearTimeout(tc); tc = null; togglePlay(); }
    else tc = setTimeout(() => { tc = null; togglePlay(); }, 260);
  });
})();
function onVol() { const v = +$('#rVol').value; $('#vVol').textContent = Math.round(v * 100) + '%'; if (PL.engine) PL.engine.vol(v); syncMute(); }
$('#rVol').addEventListener('input', onVol);
$('#rSpeed').addEventListener('input', () => { const r = +$('#rSpeed').value; $('#vSpeed').textContent = r.toFixed(2) + '×'; if (PL.engine) PL.engine.rate(r); });
['#rBri', '#rCon', '#rSat'].forEach((s) => $(s).addEventListener('input', applyPic));
$('#swWarm').addEventListener('change', () => { applyPic(); sfx('tap'); });
$('#selFit').addEventListener('change', () => { applyPic(); sfx('tap'); });
$('#selQual').addEventListener('change', () => {
  const v = $('#selQual').value;
  if (PL.hls) { PL.hls.currentLevel = +v; $('#naQual').textContent = ''; toast('info', v === '-1' ? 'Качество: авто' : 'Качество зафиксировано'); }
  else if (PL.dash) { try { PL.dash.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: v === '-1' } } } }); if (v !== '-1') PL.dash.setQualityFor('video', +v); } catch (e) {} }
  else if (PL.vm) { v === '-1' ? PL.vm.setQuality('auto').catch(() => {}) : PL.vm.setQuality(v).catch(() => {}); }
  sfx('tap');
});
$('#selCap').addEventListener('change', () => { applyCap(); sfx('tap'); toast('info', $('#selCap').value === '0' ? 'Лимит снят' : 'Не выше ' + $('#selCap').value + 'p'); });
function applyCap() {
  if (!PL.hls || !PL.levels.length) return;
  const cap = +$('#selCap').value;
  if (!cap) { PL.hls.autoLevelCapping = -1; return; }
  let idx = -1;
  PL.levels.forEach((l, i) => { if (l.height && l.height <= cap) idx = i; });
  PL.hls.autoLevelCapping = idx;
}
$('#selSub').addEventListener('change', () => {
  const v = +$('#selSub').value;
  if (PL.hls) PL.hls.subtitleTrack = v;
  else if (PL.vm) { const o = $('#selSub').selectedOptions[0]; if (v < 0) PL.vm.disableTextTrack().catch(() => {}); else PL.vm.enableTextTrack(o.textContent).catch(() => {}); }
  else if (pv.textTracks) { for (let i = 0; i < pv.textTracks.length; i++) pv.textTracks[i].mode = i === v ? 'showing' : 'disabled'; }
  sfx('tap');
});
$('#swLoop').addEventListener('change', () => { pv.loop = $('#swLoop').checked; sfx('tap'); });
$('#abA').onclick = () => { if (!PL.engine) return; PL.ab.a = PL.engine.time() || 0; $('#abA').classList.add('set'); updAB(); };
$('#abB').onclick = () => { if (!PL.engine) return; PL.ab.b = PL.engine.time() || 0; $('#abB').classList.add('set'); updAB(); };
$('#abX').onclick = () => { PL.ab = { a: null, b: null, on: false }; $('#abA').classList.remove('set'); $('#abB').classList.remove('set'); updAB(); };
function updAB() {
  PL.ab.on = PL.ab.a != null && PL.ab.b != null && PL.ab.b > PL.ab.a;
  $('#vAB').textContent = PL.ab.on ? ft(PL.ab.a) + '–' + ft(PL.ab.b) : 'выкл';
  $('#abMark').classList.toggle('show', PL.ab.on);
  if (PL.ab.on) $('#abMark').textContent = 'A—B ' + ft(PL.ab.a) + '–' + ft(PL.ab.b);
  sfx('tap');
}
$('#btnResetPic').onclick = () => {
  $('#rBri').value = 1; $('#rCon').value = 1; $('#rSat').value = 1;
  $('#swWarm').checked = false; $('#selFit').value = 'contain';
  applyPic(); sfx('tap'); toast('success', 'Картинка сброшена');
};
$('#btnShot').onclick = () => {
  if (!pv.videoWidth) { toast('warn', 'Кадр доступен только для файла, HLS и DASH'); return; }
  try {
    const c = document.createElement('canvas');
    c.width = pv.videoWidth; c.height = pv.videoHeight;
    const x = c.getContext('2d');
    x.filter = $('#mediaHost').style.filter || 'none';
    x.drawImage(pv, 0, 0);
    const u = c.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = u; a.download = 'kadr-' + Math.floor(PL.time) + 's.png';
    document.body.appendChild(a); a.click(); a.remove();
    sfx('ok'); toast('success', 'Кадр сохранён в PNG');
  } catch (e) { toast('warn', 'Источник закрыл доступ к пикселям (CORS) — кадр снять нельзя'); }
};
document.addEventListener('keydown', (e) => {
  const t = (e.target.tagName || '').toLowerCase();
  if (t === 'input' || t === 'textarea' || t === 'select') return;
  if (e.key === 'Escape') {
    if ($('#swrap').classList.contains('open')) closeSheet();
    else if ($('#player').classList.contains('open')) closePlayer();
    return;
  }
  if (!$('#player').classList.contains('open')) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowLeft') skip(-10);
  else if (e.key === 'ArrowRight') skip(10);
  else if (e.key.toLowerCase() === 'm' || e.key === 'ь') $('#pMute').click();
  else if (e.key.toLowerCase() === 'f' || e.key === 'а') $('#pFull').click();
});

/* ============ library interactions ============ */
$('#qInput').addEventListener('input', (e) => { ui.q = e.target.value; ui.view = null; renderLib(); });
$('#filterRow').addEventListener('click', (e) => { const c = e.target.closest('[data-f]'); if (!c) return; ui.filter = c.dataset.f; ui.view = null; renderLib(); sfx('tap'); });
$('#btnSel').onclick = () => { ui.sel = !ui.sel; if (!ui.sel) ui.set.clear(); renderLib(); sfx('tap'); };
$('#bulkX').onclick = () => { ui.sel = false; ui.set.clear(); renderLib(); sfx('tap'); };
$('#bulkAll').onclick = () => { const v = ui.vis; if (v.every((i) => ui.set.has(i))) v.forEach((i) => ui.set.delete(i)); else v.forEach((i) => ui.set.add(i)); renderLib(); sfx('tap'); };
$('#bulkFav').onclick = () => { let n = 0; ui.set.forEach((i) => { const x = byId(i); if (x && !x.fav) { x.fav = true; n++; } }); save(); renderAll(); sfx('pop'); toast('success', n ? 'В избранное: ' + n : 'Уже в избранном'); };
$('#bulkDl').onclick = () => {
  let n = 0;
  ui.set.forEach((i) => { const x = byId(i); if (x && caps(x).download && !x.offline && !(x.dl && ['queue', 'run', 'pause'].indexOf(x.dl.st) >= 0)) { startDl(x.id); n++; } });
  toast(n ? 'info' : 'warn', n ? 'В очереди: ' + n : 'Нет качаемых среди выбранных');
};
$('#bulkDel').onclick = () => { if (!ui.set.size) return; const ids = Array.from(ui.set); ui.sel = false; ui.set.clear(); delItems(ids); };
(function () {
  const L = $('#list');
  let tm = null, fired = false, sx = 0, sy = 0, pr = null;
  L.addEventListener('pointerdown', (e) => {
    const r = e.target.closest('.vr'); if (!r) return;
    if (e.target.closest('[data-grip]')) { drag(r, e); return; }
    pr = r; fired = false; sx = e.clientX; sy = e.clientY;
    clearTimeout(tm);
    tm = setTimeout(() => {
      fired = true; ui.suppress = true;
      if (!ui.sel) { ui.sel = true; ui.set.clear(); }
      ui.set.add(r.dataset.id); vibe(12); sfx('pop'); renderLib();
    }, 470);
  });
  L.addEventListener('pointermove', (e) => { if (pr && (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10)) { clearTimeout(tm); pr = null; } });
  const c = () => { clearTimeout(tm); pr = null; };
  L.addEventListener('pointerup', c); L.addEventListener('pointercancel', c); L.addEventListener('pointerleave', c);
  L.addEventListener('click', (e) => {
    if (ui.suppress) { ui.suppress = false; return; }
    const r = e.target.closest('.vr');
    if (!r || e.target.closest('[data-grip]')) return;
    const id = r.dataset.id;
    if (ui.sel) { if (ui.set.has(id)) ui.set.delete(id); else ui.set.add(id); renderLib(); sfx('tap'); return; }
    sfx('tap'); openDetail(id);
  });
})();
function drag(row, e) {
  if (ui.sort !== 'manual' || ui.sel) return;
  e.preventDefault();
  const g = e.target.closest('[data-grip]'), L = $('#list');
  g.setPointerCapture(e.pointerId);
  row.classList.add('drag'); vibe(8);
  let raf = null, y = e.clientY;
  const flip = () => {
    const rows = Array.prototype.slice.call(L.querySelectorAll('.vr'));
    const before = new Map(rows.map((r) => [r, r.getBoundingClientRect().top]));
    let moved = false;
    for (const s of rows) {
      if (s === row) continue;
      const b = s.getBoundingClientRect(), mid = b.top + b.height / 2;
      if ((row.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING) && y > mid) { L.insertBefore(row, s.nextSibling); moved = true; break; }
      if ((row.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_PRECEDING) && y < mid) { L.insertBefore(row, s); moved = true; break; }
    }
    if (moved) Array.prototype.slice.call(L.querySelectorAll('.vr')).forEach((r) => {
      const b = before.get(r); if (b == null) return;
      const d = b - r.getBoundingClientRect().top;
      if (Math.abs(d) > 2) r.animate([{ transform: 'translateY(' + d + 'px)' }, { transform: 'none' }], { duration: 160, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
  };
  const mv = (ev) => { y = ev.clientY; if (!raf) raf = requestAnimationFrame(() => { raf = null; flip(); }); };
  const up = () => {
    g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
    row.classList.remove('drag');
    const ids = Array.prototype.slice.call(L.querySelectorAll('.vr')).map((r) => r.dataset.id);
    const pos = ids.map((i) => state.items.findIndex((x) => x.id === i)).sort((a, b) => a - b);
    pos.forEach((p, i) => { state.items[p] = byId(ids[i]); });
    save(); renderLib(); sfx('tap');
  };
  g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
}
const SORTS = [['new', 'Сначала новые'], ['old', 'Сначала старые'], ['title', 'По алфавиту'], ['dur', 'По длительности'], ['size', 'По размеру файла'], ['manual', 'Мой порядок', 'перетаскивай']];
$('#btnSort').onclick = () => {
  sfx('tap');
  openSheet('sort', '<div class="sh">' + I('sort') + 'Сортировка</div><div class="opts">' + SORTS.map((s) =>
    '<button class="opt' + (ui.sort === s[0] ? ' on' : '') + '" data-s="' + s[0] + '">' + I('check') + s[1] + (s[2] ? '<small>' + s[2] + '</small>' : '') + '</button>').join('') + '</div>',
    (r) => { r.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { ui.sort = b.dataset.s; ui.view = null; closeSheet(true); renderLib(); sfx('tap'); if (ui.sort === 'manual') toast('info', 'Тяни за точки слева от ролика'); }); });
};
$('#viewsRow').addEventListener('click', (e) => {
  const d = e.target.closest('[data-vdel]');
  if (d) {
    e.stopPropagation();
    const id = d.dataset.vdel, v = state.views.find((x) => x.id === id);
    state.views = state.views.filter((x) => x.id !== id);
    if (ui.view === id) ui.view = null;
    save(); renderLib(); toast('info', 'Вид удалён' + (v ? ': ' + v.name : ''));
    return;
  }
  const c = e.target.closest('[data-view]');
  if (c) {
    const v = state.views.find((x) => x.id === c.dataset.view); if (!v) return;
    ui.q = v.q; ui.filter = v.filter; ui.sort = v.sort; ui.view = v.id;
    $('#qInput').value = v.q; renderLib(); sfx('tap'); toast('info', 'Вид: ' + v.name);
    return;
  }
  if (e.target.closest('#vAdd')) {
    sfx('tap');
    const fn = { all: 'все', fav: 'избранное', off: 'офлайн', watch: 'смотрю', dl: 'можно качать' }[ui.filter];
    const sn = (SORTS.find((s) => s[0] === ui.sort) || [])[1] || '';
    openSheet('vn', '<div class="sh">' + I('spark') + 'Сохранить вид</div><input class="vninput" id="vnI" maxlength="24" placeholder="Например: В дорогу"><div class="vndesc">фильтр: ' + fn + ' · ' + sn.toLowerCase() + (ui.q ? ' · поиск «' + esc(ui.q) + '»' : '') + '</div><div class="cbtns"><button class="btn btn-gh" id="vnN">Отмена</button><button class="btn btn-cta" id="vnO">' + I('check') + 'Сохранить</button></div>', (r) => {
      const i = r.querySelector('#vnI');
      setTimeout(() => i.focus(), 360);
      const ok = () => {
        const v = { id: uid(), name: i.value.trim() || 'Мой вид', q: ui.q, filter: ui.filter, sort: ui.sort };
        state.views.push(v); ui.view = v.id; save(); closeSheet(true); renderLib(); sfx('ok'); toast('success', 'Вид сохранён: ' + v.name);
      };
      r.querySelector('#vnO').onclick = ok;
      r.querySelector('#vnN').onclick = () => closeSheet();
      i.onkeydown = (ev) => { if (ev.key === 'Enter') ok(); };
    });
  }
});

/* ============ settings ============ */
function setEco(v) {
  state.settings.eco = v; save();
  renderTop(); renderAdd(); renderSet(); renderLib(); applyCap(); sfx('tap');
  toast(v ? 'warn' : 'info', v ? 'Экономия: не выше ' + (state.settings.cap || 480) + 'p' : 'Экономия выключена');
}
$('#swEcoHome').addEventListener('change', (e) => setEco(e.target.checked));
$('#swEco').addEventListener('change', (e) => setEco(e.target.checked));
$('#netChip').onclick = () => setEco(!state.settings.eco);
$('#setCap').addEventListener('change', (e) => { state.settings.cap = +e.target.value; save(); renderAdd(); applyCap(); sfx('tap'); toast('info', state.settings.cap ? 'Потолок: ' + state.settings.cap + 'p' : 'Потолок снят'); });
$('#swNext').addEventListener('change', (e) => { state.settings.next = e.target.checked; save(); sfx('tap'); });
$('#swPos').addEventListener('change', (e) => { state.settings.pos = e.target.checked; save(); sfx('tap'); });
$('#swSfx').addEventListener('change', (e) => { state.settings.sfx = e.target.checked; save(); if (e.target.checked) sfx('pop'); });
$('#btnMute').onclick = () => {
  state.settings.muted = !state.settings.muted; save(); renderTop();
  if (PL.engine) PL.engine.vol(+$('#rVol').value);
  syncMute();
  if (!state.settings.muted) sfx('pop');
  toast('info', state.settings.muted ? 'Звук выключен полностью' : 'Звук включён');
};
$('#extSave').onclick = () => {
  const v = $('#extInput').value.trim();
  if (v && !/^https?:\/\//i.test(v)) { toast('error', 'Адрес должен начинаться с http:// или https://'); return; }
  state.settings.extractor = v; save(); renderSet(); renderLib(); sfx('ok');
  toast('success', v ? 'Экстрактор подключён' : 'Экстрактор отключён');
};
$('#extTest').onclick = async () => {
  const v = $('#extInput').value.trim(), st = $('#extState');
  if (!v) { st.className = 'ext-state bad'; st.textContent = 'Впиши адрес сервера'; return; }
  st.className = 'ext-state'; st.textContent = 'Проверяю…';
  try {
    const j = await callExtractor(v, GB + 'ForBiggerBlazes.mp4');
    st.className = 'ext-state ok'; st.textContent = 'Ответ получен: ' + JSON.stringify(j).slice(0, 180);
    sfx('ok');
  } catch (e) {
    st.className = 'ext-state bad'; st.textContent = 'Не отвечает: ' + e.message + '. Проверь, что сервер запущен, CORS открыт и адрес доступен с телефона.';
    sfx('err');
  }
};
$('#btnProxySave').onclick = () => {
  const v = $('#proxyInput').value.trim();
  if (v && v.indexOf('{url}') < 0 && v.indexOf('{raw}') < 0) { toast('error', 'В адресе должен быть {url} или {raw}'); return; }
  state.settings.proxy = v; save(); sfx('ok');
  toast('success', v ? 'Свой прокси сохранён и будет первым' : 'Свой прокси убран');
};
$('#btnProxyTest').onclick = async () => {
  const box = $('#proxyResults');
  const list = proxyList();
  box.innerHTML = list.map((p, i) => '<div class="dg wait" data-p="' + i + '"><i></i>' + esc(p.name) + '<span>проверяю…</span></div>').join('');
  const testUrl = GB + 'ForBiggerBlazes.mp4';
  for (let i = 0; i < list.length; i++) {
    const el = box.querySelector('[data-p="' + i + '"]');
    const t0 = performance.now();
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 9000);
      const r = await fetch(list[i].url(testUrl), { signal: ctrl.signal, headers: { Accept: '*/*' } });
      clearTimeout(to);
      const ms = Math.round(performance.now() - t0);
      if (el) { el.className = 'dg ' + (r.ok ? 'ok' : 'no'); el.querySelector('span').textContent = (r.ok ? 'HTTP ' + r.status + ' · ' : 'HTTP ' + r.status + ' · ') + ms + ' мс'; }
    } catch (e) {
      if (el) { el.className = 'dg no'; el.querySelector('span').textContent = e.name === 'AbortError' ? 'таймаут 9 с' : (e.message || 'ошибка'); }
    }
  }
  sfx('ok'); toast('info', 'Проверка прокси завершена');
};
const SERVER_CODE = [
  '// server.js — экстрактор для «СИГНАЛ»',
  '// Node 18+ · npm i express cors · yt-dlp должен быть в PATH',
  "import express from 'express';",
  "import cors from 'cors';",
  "import { execFile } from 'node:child_process';",
  '',
  'const app = express();',
  'app.use(cors());',
  '',
  "app.get('/resolve', (req, res) => {",
  '  const url = req.query.url;',
  "  if (!url) return res.status(400).json({ error: 'url required' });",
  '',
  "  execFile('yt-dlp', ['-j', '--no-warnings', '--no-playlist', url],",
  '    { maxBuffer: 1 << 24 },',
  '    (err, stdout) => {',
  '      if (err) return res.status(502).json({ error: String(err.message || err) });',
  '      try {',
  '        const info = JSON.parse(stdout);',
  '        const prog = (info.formats || [])',
  "          .filter(f => f.vcodec !== 'none' && f.acodec !== 'none' && f.url)",
  '          .sort((a, b) => (b.height || 0) - (a.height || 0));',
  '        res.json({',
  '          title: info.title,',
  '          duration: info.duration,',
  '          thumbnail: info.thumbnail,',
  '          stream: (prog[0] && prog[0].url) || info.url,',
  '          download: (prog[0] && prog[0].url) || null',
  '        });',
  "      } catch (e) { res.status(500).json({ error: 'parse failed' }); }",
  '    });',
  '});',
  '',
  "app.listen(8787, () => console.log('extractor: http://0.0.0.0:8787/resolve'));",
  '// адрес для приложения: http://IP-КОМПЬЮТЕРА:8787/resolve'
].join('\n');
$('#extCode').onclick = () => {
  openSheet('code', '<div class="sh">' + I('server') + 'Готовый сервер-экстрактор</div><p class="ctext">Запусти на компьютере в той же сети или на VPS, впиши адрес выше — и приложение начнёт реально открывать и качать ролики с VK, Дзен и любых сайтов, которые понимает yt-dlp.</p><div class="code">' + esc(SERVER_CODE) + '</div><div class="hnote"><b>Важно:</b> ссылки от yt-dlp часто привязаны к IP и живут несколько часов. Качай сразу. Соблюдай правила площадок и авторские права.</div><div class="cbtns"><button class="btn btn-gh" id="cClose">Закрыть</button><button class="btn btn-cta" id="cCopy">' + I('copy') + 'Копировать код</button></div>', (r) => {
    r.querySelector('#cClose').onclick = () => closeSheet();
    r.querySelector('#cCopy').onclick = async () => {
      try { await navigator.clipboard.writeText(SERVER_CODE); sfx('ok'); toast('success', 'Код сервера скопирован'); }
      catch (e) { toast('warn', 'Выдели код и скопируй вручную'); }
    };
  });
};
function confirmSheet(t, x, ok, fn) {
  openSheet('cf', '<div class="sh">' + I('alert') + esc(t) + '</div><p class="ctext">' + esc(x) + '</p><div class="cbtns"><button class="btn btn-gh" id="cfN">Отмена</button><button class="btn btn-dg" id="cfO">' + esc(ok) + '</button></div>', (r) => {
    r.querySelector('#cfN').onclick = () => closeSheet();
    r.querySelector('#cfO').onclick = () => { closeSheet(true); fn(); };
  });
}
$('#btnReset').onclick = () => confirmSheet('Сбросить всё?', 'Полка, виды, настройки и скачанные файлы будут удалены.', 'Сбросить', async () => {
  for (const it of state.items) if (it.offline) await blobDel(offlineKeys(it));
  closePlayer();
  state = seed();
  ui.q = ''; ui.filter = 'all'; ui.sort = 'new'; ui.sel = false; ui.set.clear(); ui.view = null;
  $('#qInput').value = ''; $('#urlInput').value = ''; $('#scanWrap').innerHTML = '';
  detectUI(); await kvSet('state', null); save(); renderAll(); go('add'); sfx('ok');
  toast('success', 'Сброшено');
});
function howto() {
  sfx('tap');
  openSheet('how', '<div class="sh">' + I('info') + 'Что здесь по-настоящему</div>' +
    '<div class="hstep"><span class="n">1</span><div><b>Файлы, HLS и DASH — полностью рабочие</b><p>Прямые .mp4/.webm, .m3u8 и .mpd играют сами, без прокси и без сервера. Качество переключается по реальным дорожкам манифеста, скорость и громкость настоящие.</p></div></div>' +
    '<div class="hstep"><span class="n">2</span><div><b>Скачивание — реальные байты</b><p>Файл качается потоком с прогрессом и докачкой по Range, кладётся в IndexedDB и играет без сети. HLS сохраняется сегментами и собирается в локальный плейлист. Кнопка «Сохранить в файлы» отдаёт MP4 в загрузки телефона.</p></div></div>' +
    '<div class="hstep"><span class="n">3</span><div><b>Площадки — официальные плееры</b><p>YouTube и Vimeo управляются через их API. RuTube, Dailymotion, OK, TikTok, Twitch — через официальные встраивания. Скачать оттуда файл браузер не может; избранное хранит только ссылку — 0 МБ.</p></div></div>' +
    '<div class="hnote"><b>Про прокси честно:</b> сканер тянет HTML через публичные CORS-прокси. Они лимитированы и часто лежат, а современные сайты собирают плеер из JavaScript с подписанными ссылками — в HTML просто нечего находить. Поэтому сканер вынесен в отдельную кнопку и не мешает основному flow. Проверить, какие прокси живы, можно в настройках. Для VK, Дзен и скачивания с площадок есть подключение своего экстрактора с готовым кодом сервера.</div>' +
    '<button class="btn btn-cta wf" id="hOk">Понятно</button>', (r) => { r.querySelector('#hOk').onclick = () => closeSheet(); });
}
$('#howBtn').onclick = howto;
$('#aboutBtn').onclick = howto;

/* ============ examples ============ */
const EX = [
  { t: 'MP4 · Big Buck Bunny', s: 'файл, качается', u: GB + 'BigBuckBunny.mp4' },
  { t: 'HLS · Tears of Steel', s: 'качества, качается', u: 'https://test-streams.mux.dev/tos_ismc/main.m3u8' },
  { t: 'YouTube · Sintel', s: 'официальный плеер', u: 'https://www.youtube.com/watch?v=eRsGyueVLvQ' },
  { t: 'Vimeo · Big Buck Bunny', s: 'официальный плеер', u: 'https://vimeo.com/1084537' },
  { t: 'MP4 · короткий клип', s: 'скачается за секунды', u: GB + 'ForBiggerBlazes.mp4' },
  { t: 'HLS · Apple BipBop', s: 'субтитры и дорожки', u: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8' }
];
$('#exGrid').innerHTML = EX.map((x, i) => {
  const d = detect(x.u), c = capOf(d ? d.kind : 'site');
  return '<button class="ex" data-ex="' + i + '"><span class="dot" style="background:' + c.c + ';color:' + c.c + '"></span><div><b>' + esc(x.t) + '</b><span>' + esc(x.s) + '</span></div></button>';
}).join('');
$$('#exGrid [data-ex]').forEach((b) => b.onclick = () => {
  const x = EX[+b.dataset.ex];
  sfx('tap'); $('#urlInput').value = x.u; detectUI(); catchIt();
});

/* ============ network / pwa ============ */
function netEvt() {
  renderTop(); renderDiag(); drawScopes();
  toast(navigator.onLine ? 'success' : 'warn', navigator.onLine ? 'Сеть снова есть' : 'Сеть пропала — играет только скачанное');
}
window.addEventListener('online', netEvt);
window.addEventListener('offline', netEvt);
let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });
function doInstall() {
  if (installEvt) {
    installEvt.prompt();
    installEvt.userChoice.then((r) => { installEvt = null; toast(r.outcome === 'accepted' ? 'success' : 'info', r.outcome === 'accepted' ? 'Установлено' : 'Установка отменена'); }).catch(() => {});
  } else if (location.protocol === 'file:') {
    toast('warn', 'Открой приложение по https:// — с file:// установка невозможна');
  } else {
    toast('info', 'В меню браузера выбери «На экран домой» / «Установить приложение»');
  }
}
$('#btnInstall').onclick = doInstall;
$('#btnInstallRail').onclick = doInstall;
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(renderDiag).catch(() => {});
  });
}
window.addEventListener('resize', debounce(drawScopes, 150));

/* ============ init ============ */
(async function init() {
  await idb();
  const saved = await kvGet('state', null);
  if (saved && Array.isArray(saved.items) && saved.items.length) {
    state.items = saved.items.map((i) => Object.assign(mk({}), i, { dl: null }));
    state.views = saved.views || state.views;
    state.recent = saved.recent || [];
    state.settings = Object.assign(state.settings, saved.settings || {});
  }
  renderAll(); detectUI(); drawScopes();
  ensureHls();
  if (!DB.ok) toast('warn', 'Память устройства недоступна (приватный режим?) — скачивание работать не будет');
  const params = new URLSearchParams(location.search);
  const tab = params.get('tab');
  if (tab && TITLES[tab]) go(tab);
  const shared = params.get('url') || params.get('text') || params.get('title') || '';
  const m = shared.match(/https?:\/\/[^\s]+/);
  if (m) { $('#urlInput').value = m[0]; detectUI(); setTimeout(catchIt, 400); }
  if (params.toString() && history.replaceState) history.replaceState(null, '', location.pathname);
  for (const it of state.items.filter((x) => x.kind === 'file' && !x.dur).slice(0, 3)) {
    try { const d = await probe(it.url, CORS_OK.indexOf(host(it.url)) >= 0); if (d) { it.dur = Math.round(d); save(); renderLib(); renderAdd(); } } catch (e) {}
  }
})();

})();