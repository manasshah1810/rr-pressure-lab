(() => {
const D = window.RR_DATA, R = window.RR_REPORT;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const YEARS = [2022, 2023, 2024, 2025, 2026], PHASES = ['Powerplay', 'Middle', 'Death'];
const PL = D.players;
const repBy = {}; R.players.forEach(p => { repBy[p.type + p.id] = p; });
const poolBy = {}; ['bat', 'bowl'].forEach(r => R.pool[r].forEach(p => { if (p.id) poolBy[r + p.id] = p; }));
const isRRteam = s => /Rajasthan/.test(s || '');
const RR_SQUAD = Object.keys(PL).filter(k => /Rajasthan Royals \(2026\)/.test(PL[k].ipl)).map(Number);
const FILTER_VIEWS = new Set(['rr', 'overview', 'explore', 'compare']);
const DEF = { cls: 'all', min: 300 };

const S = {
  view: 'rr', role: 'bat', cls: 'all', years: new Set(YEARS), phases: new Set(PHASES), min: 300,
  sel: { bat: R.players.find(p => p.type === 'bat').id, bowl: R.players.find(p => p.type === 'bowl').id },
  metric: 0, sort: { k: 'vsl', asc: false }, cmp: { bat: [], bowl: [] }, from: null, sl: []
};
try { S.sl = JSON.parse(localStorage.getItem('rr-sl') || '[]'); S.rrMode = localStorage.getItem('rr-sqmode') || 'chart'; } catch (e) {}

/* ---------- helpers ---------- */
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const fmt = (v, d = 1) => v == null || !isFinite(v) ? '—' : v.toFixed(d);
const sgn = (v, d = 1) => v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
const initials = n => n.split(' ').map(w => w[0]).slice(0, 2).join('');
const shortN = n => n.length > 15 ? n.split(' ')[0][0] + '. ' + n.split(' ').slice(1).join(' ') : n;
const TEAM_AB = { 'Rajasthan Royals': 'RR', 'Mumbai Indians': 'MI', 'Chennai Super Kings': 'CSK', 'Royal Challengers Bengaluru': 'RCB', 'Royal Challengers Bangalore': 'RCB', 'Kolkata Knight Riders': 'KKR', 'Delhi Capitals': 'DC', 'Punjab Kings': 'PBKS', 'Sunrisers Hyderabad': 'SRH', 'Gujarat Titans': 'GT', 'Lucknow Super Giants': 'LSG' };
const teamAb = s => { if (!s) return ''; const m = s.match(/^(.*) \((\d+)\)$/); return m ? (TEAM_AB[m[1]] || m[1]) + ' ' + m[2] : s; };
const RECENT = new Set([2025, 2026]);
function callOf(rep, isl) {
  if (!rep) return null;
  if (rep.tier === 'STRONG' && rep.reruns >= 60 && isl >= 50) return ['Back', 'Strong tier, top 10 in 60%+ of re-runs and mostly IPL balls'];
  if (rep.small && rep.tier !== 'STRONG') return ['Caution', 'Under 200 pressure balls and not STRONG in re-runs'];
  if (rep.tier === 'FRINGE' || isl < 50 || rep.defs <= 3) return ['Caution', rep.tier === 'FRINGE' ? 'Fragile rank: top 10 in under 30% of re-runs' : isl < 50 ? 'Most pressure balls came in T20Is' : 'Top 10 under only ' + rep.defs + ' of 14 definitions'];
  return ['Watch', 'Contender: solid rating, but the rank could move'];
}
const callTag = (rep, isl) => { const c = callOf(rep, isl); return c ? `<span class="call ${c[0]}" title="${c[1]}">${c[0]}</span>` : ''; };
const iplShareOf = (role, id) => { let t = 0, i = 0; D[role].forEach(r => { if (r[0] === id) { t += r[5]; if (r[2] === 'IPL') i += r[5]; } }); return t ? i / t * 100 : 0; };
const roleWord = r => r === 'bat' ? 'batters' : 'bowlers';
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 1800); };
const charts = {};
function chart(id, cfg) { if (charts[id]) charts[id].destroy(); const el = document.getElementById(id); if (!el) return; charts[id] = new Chart(el, cfg); return charts[id]; }
function tip() { return { backgroundColor: '#0b0b0d', titleColor: '#fff', bodyColor: '#ddd', borderColor: 'rgba(255,255,255,.1)', borderWidth: 1, padding: 12, cornerRadius: 10, titleFont: { weight: '600', family: 'Onest' }, bodyFont: { family: 'Onest' }, displayColors: false }; }
const grid = () => ({ color: css('--line') });
const copy = (txt, msg) => { (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast(msg), () => { prompt('Copy this link', txt); }); };
const empty = (id, msg) => { const e = document.getElementById(id + '-e'); if (!e) return; e.hidden = !msg; e.textContent = msg || ''; const c = document.getElementById(id); if (c) c.style.visibility = msg ? 'hidden' : 'visible'; };

/* metrics */
const M = {
  bat: [
    { k: 'sr', l: 'Strike rate', f: a => a.b ? a.r / a.b * 100 : null, d: 1, hi: true },
    { k: 'dot', l: 'Dot %', f: a => a.b ? a.d / a.b * 100 : null, d: 1, hi: false },
    { k: 'bnd', l: 'Boundary %', f: a => a.b ? a.x / a.b * 100 : null, d: 1, hi: true },
    { k: 'bpo', l: 'Balls per dismissal', f: a => a.o ? a.b / a.o : null, d: 1, hi: true },
  ],
  bowl: [
    { k: 'econ', l: 'Economy', f: a => a.b ? a.r / a.b * 6 : null, d: 2, hi: false },
    { k: 'dot', l: 'Dot %', f: a => a.b ? a.d / a.b * 100 : null, d: 1, hi: true },
    { k: 'bnd', l: 'Boundary %', f: a => a.b ? a.x / a.b * 100 : null, d: 1, hi: false },
    { k: 'bpw', l: 'Balls per wicket', f: a => a.o ? a.b / a.o : null, d: 1, hi: false },
  ]
};
const better = (role, a, b) => role === 'bat' ? a - b : b - a;
const blank = () => ({ b: 0, r: 0, o: 0, d: 0, x: 0, w: 0 });
const add = (a, r) => { a.b += r[5]; a.r += r[6]; a.o += r[7]; a.d += r[8]; a.x += r[9]; a.w += r[10]; };
function rows(role, o = {}) {
  const yrs = o.years || S.years, ph = o.phases || S.phases, cls = o.cls || S.cls;
  return D[role].filter(r => yrs.has(r[1]) && ph.has(r[3]) && (cls === 'all' || r[2] === cls) && (o.id == null || r[0] === o.id));
}
function aggregate(role, o) {
  const out = {};
  rows(role, o).forEach(r => { const p = out[r[0]] || (out[r[0]] = { id: r[0], hp: blank(), n: blank(), all: blank(), ipl: 0 }); add(r[4] ? p.hp : p.n, r); add(p.all, r); if (r[2] === 'IPL') p.ipl += r[5]; });
  return out;
}
function league(role, o) { const a = blank(), n = blank(); rows(role, o).forEach(r => add(r[4] ? a : n, r)); return { hp: a, n }; }
function table(role) {
  const main = M[role][0], L = main.f(league(role).hp);
  return Object.values(aggregate(role)).filter(p => p.all.b >= S.min && p.hp.b >= 20).map(p => {
    const hp = main.f(p.hp), n = main.f(p.n);
    return { ...p, name: PL[p.id].n, hpm: hp, nm: n, lift: better(role, hp, n), vsl: better(role, hp, L), share: p.hp.b / p.all.b * 100, wpa: p.all.w / p.all.b * 100, iplShare: p.ipl / p.all.b * 100, rep: repBy[role + p.id] };
  });
}

/* ---------- shortlist ---------- */
const slKey = (role, id) => role + ':' + id;
const inSL = (role, id) => S.sl.includes(slKey(role, id));
function toggleSL(role, id) {
  const k = slKey(role, id); S.sl = inSL(role, id) ? S.sl.filter(x => x !== k) : [...S.sl, k];
  try { localStorage.setItem('rr-sl', JSON.stringify(S.sl)); } catch (e) {}
  toast(inSL(role, id) ? `${PL[id].n} added to shortlist` : `${PL[id].n} removed`);
  renderSL(); renderView();
}
const starBtn = (role, id) => `<button class="star ${inSL(role, id) ? 'on' : ''}" data-star="${role}:${id}" aria-label="Shortlist ${PL[id].n}" aria-pressed="${inSL(role, id)}">${inSL(role, id) ? '★' : '☆'}</button>`;
function bindStars(root) { root.querySelectorAll('[data-star]').forEach(b => b.onclick = e => { e.stopPropagation(); const [r, i] = b.dataset.star.split(':'); toggleSL(r, +i); }); }
function slRow(k) {
  const [role, id] = k.split(':'); const p = PL[id], rep = repBy[role + id], pool = poolBy[role + id];
  const t = table(role).find(x => x.id === +id);
  return { role, id: +id, name: p.n, team: p.ipl, rating: rep ? rep.rating : pool ? pool.rating : null, tier: rep ? rep.tier : pool ? pool.tier : '', status: rep ? rep.status : pool ? 'Auction pool' : '', pm: t ? t.hpm : null };
}
function renderSL() {
  $('#sl-cnt').hidden = !S.sl.length; $('#sl-cnt').textContent = S.sl.length;
  $('#sl-h').textContent = `${S.sl.length} player${S.sl.length === 1 ? '' : 's'}`;
  $('#sl-body').innerHTML = S.sl.length ? S.sl.map(slRow).map(r => `<div class="sl" data-open="${r.role}:${r.id}" style="cursor:pointer"><div><b>${r.name}</b><small>${r.role === 'bat' ? 'Batter' : 'Bowler'} · ${r.team || 'no IPL side'}${r.status ? ' · ' + r.status : ''}</small></div><div>${r.rating != null ? `<b>${sgn(r.rating)}</b> <span class="tag ${r.tier}">${r.tier}</span>` : `<span class="muted">${M[r.role][0].l.split(' ')[0]} ${fmt(r.pm, M[r.role][0].d)}</span>`}</div>${starBtn(r.role, r.id)}</div>`).join('')
    : '<p class="muted">Nothing yet. Tap ☆ on any player, table row or auction name to build a shortlist you can export or share.</p>';
  bindStars($('#sl-body'));
  $$('#sl-body [data-open]').forEach(d => d.onclick = () => { const [r, i] = d.dataset.open.split(':'); closeSL(); openPlayer(r, +i); });
}
const openSL = () => { renderSL(); $('#drawer').classList.add('on'); $('#scrim').classList.add('on'); $('#drawer').setAttribute('aria-hidden', 'false'); $('#sl-close').focus(); };
const closeSL = () => { $('#drawer').classList.remove('on'); $('#scrim').classList.remove('on'); $('#drawer').setAttribute('aria-hidden', 'true'); };

/* ---------- URL state ---------- */
function toHash() {
  const p = new URLSearchParams();
  p.set('r', S.role);
  if (S.cls !== 'all') p.set('c', S.cls);
  if (S.years.size < 5) p.set('y', [...S.years].join('.'));
  if (S.phases.size < 3) p.set('ph', [...S.phases].map(x => x[0]).join(''));
  if (S.min !== DEF.min) p.set('m', S.min);
  if (S.view === 'overview') p.set('p', S.sel[S.role]);
  if (S.view === 'compare' && S.cmp[S.role].length) p.set('vs', S.cmp[S.role].join('.'));
  return '#' + S.view + '?' + p.toString();
}
function fromHash() {
  const h = location.hash.slice(1); if (!h) return;
  const [v, q] = h.split('?'); const p = new URLSearchParams(q || '');
  if (document.getElementById('v-' + v)) S.view = v;
  if (p.get('r')) S.role = p.get('r') === 'bowl' ? 'bowl' : 'bat';
  S.cls = p.get('c') || 'all';
  S.years = new Set(p.get('y') ? p.get('y').split('.').map(Number) : YEARS);
  S.phases = new Set(p.get('ph') ? PHASES.filter(x => p.get('ph').includes(x[0])) : PHASES);
  S.min = +(p.get('m') || DEF.min);
  if (p.get('p')) S.sel[S.role] = +p.get('p');
  if (p.get('vs')) S.cmp[S.role] = p.get('vs').split('.').map(Number);
  if (p.get('sl')) { S.sl = [...new Set([...S.sl, ...p.get('sl').split('.')])]; try { localStorage.setItem('rr-sl', JSON.stringify(S.sl)); } catch (e) {} }
}
function sync(push) { const h = toHash(); if (location.hash === h) return; push ? history.pushState(null, '', h) : history.replaceState(null, '', h); }
addEventListener('popstate', () => { fromHash(); paintFilters(); applyView(); });

/* ---------- filters ---------- */
function paintFilters() {
  $('#f-year').innerHTML = YEARS.map(y => `<button data-v="${y}" class="${S.years.has(y) ? 'on' : ''}" aria-pressed="${S.years.has(y)}">${y}</button>`).join('');
  $('#f-phase').innerHTML = PHASES.map(y => `<button data-v="${y}" class="${S.phases.has(y) ? 'on' : ''}" aria-pressed="${S.phases.has(y)}">${y}</button>`).join('');
  $$('#f-role button').forEach(b => { b.classList.toggle('on', b.dataset.v === S.role); b.setAttribute('aria-pressed', b.dataset.v === S.role); });
  $$('#f-cls button').forEach(b => b.classList.toggle('on', b.dataset.v === S.cls));
  $('#f-min').value = S.min; $('#minv').textContent = S.min;
  const chip = (sel, set, all) => $$(sel + ' button').forEach(b => b.onclick = e => {
    const v = sel === '#f-year' ? +b.dataset.v : b.dataset.v;
    if (e.shiftKey || e.metaKey || e.ctrlKey) { if (set.has(v) && set.size === 1) return; set.has(v) ? set.delete(v) : set.add(v); }
    else if (set.size === 1 && set.has(v)) { all.forEach(x => set.add(x)); }
    else if (set.size === all.length) { set.clear(); set.add(v); }
    else { if (set.has(v) && set.size === 1) return; set.has(v) ? set.delete(v) : set.add(v); }
    paintFilters(); changed();
  });
  chip('#f-year', S.years, YEARS); chip('#f-phase', S.phases, PHASES);
  const n = (S.cls !== 'all') + (S.years.size < 5) + (S.phases.size < 3) + (S.min !== DEF.min);
  $('#reset').disabled = !n; $('#reset').textContent = n ? `Reset (${n})` : 'Reset';
  $('#ftoggle-s').innerHTML = `<b>${S.role === 'bat' ? 'Batting' : 'Bowling'}</b><i>·</i>${S.cls === 'all' ? 'IPL + T20I' : S.cls}<i>·</i>${S.years.size === 5 ? '2022–26' : [...S.years].sort().join(', ')}<i>·</i>${S.phases.size === 3 ? 'All phases' : [...S.phases].join(' + ')}<i>·</i>${S.min}+ balls${n ? `<em>${n} changed</em>` : ''}`;
  const cnt = table(S.role).length;
  const yr = S.years.size === 5 ? '2022–26' : [...S.years].sort().join(', ');
  const ph = S.phases.size === 3 ? 'all phases' : [...S.phases].join(' + ');
  $('#fsum').innerHTML = `<span><b>${cnt} ${roleWord(S.role)}</b> · ${S.cls === 'all' ? 'IPL + T20I' : S.cls} · ${yr} · ${ph} · ${S.min}+ balls</span>${S.cls !== 'IPL' ? '<span class="warn" title="T20I balls include weaker opposition. Pick IPL for like-for-like.">⚠ includes T20I</span>' : ''}<span class="help">Click a season or phase to isolate it, shift-click to add. Filters move raw stats only; report ratings stay fixed.</span>`;
}
function bindFilters() {
  $$('#f-role button').forEach(b => b.onclick = () => { S.role = b.dataset.v; S.metric = 0; paintFilters(); changed(); });
  $$('#f-cls button').forEach(b => b.onclick = () => { S.cls = b.dataset.v; paintFilters(); changed(); });
  $('#f-min').oninput = e => { S.min = +e.target.value; $('#minv').textContent = S.min; clearTimeout(S._mt); S._mt = setTimeout(() => { paintFilters(); changed(); }, 120); };
  $('#reset').onclick = () => { S.cls = 'all'; S.years = new Set(YEARS); S.phases = new Set(PHASES); S.min = DEF.min; paintFilters(); changed(); toast('Filters reset'); };
  $('#ftoggle').onclick = () => { const o = $('#filters').classList.toggle('open'); $('#ftoggle').setAttribute('aria-expanded', o); $('#ft-edit').textContent = o ? 'Done' : 'Edit filters'; };
}
function changed() { sync(false); renderView(); }

/* ---------- search (combobox) ---------- */
const IDX = []; ['bat', 'bowl'].forEach(role => new Set(D[role].map(r => r[0])).forEach(id => IDX.push({ role, id, n: PL[id].n, key: PL[id].n.toLowerCase(), rep: repBy[role + id] })));
let act = -1, cur = [];
function suggest() {
  const q = $('#q').value.trim().toLowerCase(), box = $('#sugg');
  if (!q) { box.classList.remove('on'); $('#q').setAttribute('aria-expanded', 'false'); return; }
  cur = IDX.filter(x => x.key.includes(q)).sort((a, b) => (b.key.startsWith(q) - a.key.startsWith(q)) || (!!b.rep - !!a.rep) || a.n.localeCompare(b.n)).slice(0, 10);
  act = cur.length ? 0 : -1;
  box.innerHTML = cur.length ? cur.map((x, i) => `<button role="option" data-i="${i}" class="${i === act ? 'act' : ''}">${x.n}${x.rep ? ` · #${x.rep.rank}` : ''}<span>${x.role === 'bat' ? 'Batting' : 'Bowling'}</span></button>`).join('') : `<p>No player matches "${$('#q').value.replace(/</g, '')}"</p>`;
  box.classList.add('on'); $('#q').setAttribute('aria-expanded', 'true');
  $$('#sugg button').forEach(b => b.onmousedown = e => { e.preventDefault(); pick(+b.dataset.i); });
}
function pick(i) { const x = cur[i]; if (!x) return; $('#q').value = ''; $('#sugg').classList.remove('on'); $('#q').blur(); openPlayer(x.role, x.id); }
function bindSearch() {
  const q = $('#q');
  q.oninput = suggest; q.onfocus = suggest; q.onblur = () => setTimeout(() => $('#sugg').classList.remove('on'), 120);
  q.onkeydown = e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); act = Math.max(0, Math.min(cur.length - 1, act + (e.key === 'ArrowDown' ? 1 : -1))); $$('#sugg button').forEach((b, i) => b.classList.toggle('act', i === act)); }
    else if (e.key === 'Enter') pick(act); else if (e.key === 'Escape') { q.value = ''; suggest(); q.blur(); }
  };
  addEventListener('keydown', e => { if (e.key === '/' && !/INPUT|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); } if (e.key === 'Escape') closeSL(); });
}

/* ---------- navigation ---------- */
function openPlayer(role, id) {
  S.from = S.view !== 'overview' ? S.view : S.from;
  S.role = role; S.sel[role] = id; S.metric = 0; S.view = 'overview';
  paintFilters(); sync(true); applyView(); scrollTo({ top: 0, behavior: 'smooth' }); $('#p-name').focus({ preventScroll: true });
}
function setView(v) { S.from = null; S.view = v; sync(true); applyView(); }
function applyView() {
  $$('#tabs button[data-view]').forEach(b => { const on = b.dataset.view === S.view; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  $$('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + S.view));
  const f = FILTER_VIEWS.has(S.view); document.body.dataset.view = S.view;
  $('#filters').classList.toggle('off', !f); $('#fnote').classList.toggle('on', !f);
  $('#fnote').innerHTML = !f ? `Showing <b>${roleWord(S.role)}</b> from the fixed report, so filters are hidden here. <button class="btn" id="fn-sw" style="margin-left:8px;padding:4px 10px">Switch to ${S.role === 'bat' ? 'bowlers' : 'batters'}</button>` : '';
  if (!f) $('#fn-sw').onclick = () => { S.role = S.role === 'bat' ? 'bowl' : 'bat'; paintFilters(); sync(false); applyView(); };
  renderView();
}
function renderView() {
  Chart.defaults.color = css('--ink-3'); Chart.defaults.borderColor = css('--line');
  Chart.defaults.font.family = 'Onest, system-ui, sans-serif'; Chart.defaults.font.size = 12;
  ({ rr: renderRR, overview: renderOverview, rank: renderRank, explore: renderExplore, compare: renderCompare, auction: renderAuction, method: renderMethod })[S.view]();
  document.dispatchEvent(new CustomEvent('rr:render', { detail: { view: S.view } }));
}
function bindRows(sel, role) {
  $$(sel + ' tbody tr[data-id]').forEach(tr => { if (!tr.dataset.id) return; tr.tabIndex = 0; tr.onclick = () => openPlayer(role, +tr.dataset.id); tr.onkeydown = e => { if (e.key === 'Enter') openPlayer(role, +tr.dataset.id); }; });
  bindStars($(sel));
}
const hov = (e, els) => { e.native.target.style.cursor = els.length ? 'pointer' : 'default'; };

/* ---------- RR ROOM ---------- */
function renderRR() {
  const role = S.role, main = M[role][0], word = role === 'bat' ? 'strike rate' : 'economy';
  $$('#rr-role button').forEach(b => { b.classList.toggle('on', b.dataset.v === role); b.onclick = () => { S.role = b.dataset.v; S.metric = 0; paintFilters(); changed(); }; });
  const squad = RR_SQUAD.filter(id => D[role].some(r => r[0] === id));
  const AG = aggregate(role);
  const cards = PHASES.map(ph => {
    const P = new Set([ph]), sq = blank(); rows(role, { phases: P }).forEach(r => { if (r[4] && squad.includes(r[0])) add(sq, r); });
    const lv = main.f(league(role, { phases: P }).hp), sv = main.f(sq), d = better(role, sv, lv);
    const tol = role === 'bat' ? 3 : 0.25;
    const st = sq.b < 30 ? 'few' : d < -tol ? 'weak' : d > tol ? 'ok' : 'eq';
    const pa = aggregate(role, { phases: P });
    const cands = Object.values(pa).filter(p => !squad.includes(p.id) && p.hp.b >= 60 && p.ipl / p.all.b >= .5 && better(role, main.f(p.hp), lv) > 0 && (poolBy[role + p.id] || !/2026/.test(PL[p.id].ipl)))
      .map(p => ({ id: p.id, v: main.f(p.hp), b: p.hp.b, adj: better(role, main.f(p.hp), lv) * p.hp.b / (p.hp.b + 150) })).sort((x, y) => y.adj - x.adj).slice(0, 4);
    return { ph, sq, sv, lv, d, st, cands };
  });
  const weak = cards.filter(c => c.st === 'weak').sort((x, y) => x.d - y.d);
  $('#rr-h').textContent = weak.length ? `RR's ${role === 'bat' ? 'batting' : 'bowling'} gap is the ${weak.map(c => c.ph.toLowerCase()).join(' and ')}: ${sgn(weak[0].d, main.d)} ${word} vs the league on pressure balls.` : `RR's ${roleWord(role)} hold up in every phase on pressure balls in this filter.`;
  $('#rr-intro').innerHTML = `${squad.length} squad ${roleWord(role)} with data, pooled and set against every regular on the same pressure balls.`;
  $('#gaps').innerHTML = cards.map(c => `<div class="gap ${c.st === 'weak' ? 'weak' : c.st === 'ok' ? 'ok' : ''}"><p class="kicker">${c.ph}</p>
      ${c.st === 'few' ? `<b>—</b><p>Only ${c.sq.b} squad pressure balls. Too few to judge.</p>` : `<b>${fmt(c.sv, main.d)}</b><span class="d ${c.st === 'weak' ? 'dn' : c.st === 'ok' ? 'up' : 'eq'}">${c.st === 'eq' ? 'Level with' : sgn(c.d, main.d) + ' vs'} league ${fmt(c.lv, main.d)}</span>
      <p>${c.sq.b} squad pressure balls · ${c.st === 'weak' ? 'gap to fill' : c.st === 'ok' ? 'a strength' : 'no edge either way'}</p>`}
      <p class="sub">Better here, outside RR's squad</p>
      <div class="fill-list">${c.cands.map(x => { const rp = repBy[role + x.id], pl = poolBy[role + x.id]; return `<button data-open="${x.id}" class="${x.b < 100 ? 'thin' : ''}">${PL[x.id].n}${pl ? ' <span class="tag CONTENDER">pool</span>' : ''}${rp ? ` <span class="tag ${rp.tier}">#${rp.rank}</span>` : ''}<span>${fmt(x.v, main.d)} · ${x.b} balls</span></button>`; }).join('') || '<span class="muted">No clear alternative with 60+ IPL-heavy pressure balls.</span>'}</div></div>`).join('');
  $('#rr-legend').innerHTML = `Red = squad behind the league by more than ${role === 'bat' ? '3 strike-rate points' : '0.25 an over'}; green = ahead by more. Suggestions need 60+ pressure balls in that phase, mostly IPL, ranked by sample-adjusted edge; faded = under 100. <span class="tag CONTENDER">pool</span> = report's 2027 auction pool, <span class="tag STRONG">#n</span> = report rank.`;
  $$('#gaps [data-open]').forEach(b => b.onclick = () => openPlayer(role, +b.dataset.open));
  const L = main.f(league(role).hp), RECs = aggregate(role, { years: RECENT });
  const shrink = p => better(role, main.f(p.hp), L) * p.hp.b / (p.hp.b + 150);
  const list = squad.map(id => AG[id]).filter(p => p && p.hp.b >= 15).map(p => ({ id: p.id, n: PL[p.id].n, v: main.f(p.hp), b: p.hp.b, nv: main.f(p.n), adj: shrink(p), rec: RECs[p.id] && RECs[p.id].hp.b >= 20 ? main.f(RECs[p.id].hp) : null })).sort((x, y) => y.adj - x.adj);
  $('#rrsq-h').textContent = (S.rrMode || 'chart') === 'chart' ? `RR ${roleWord(role)}: edge on pressure balls, sample-adjusted` : `RR ${roleWord(role)} on pressure balls: raw numbers and recent form`;
  empty('rrbar', list.length ? '' : 'No RR squad players with 15+ pressure balls in this filter. Widen seasons or phases.');
  if (list.length) chart('rrbar', {
    type: 'bar', data: { labels: list.map(p => shortN(p.n)), datasets: [{ data: list.map(p => +p.adj.toFixed(2)), backgroundColor: list.map(p => p.adj >= 0 ? css('--pink') : css('--blue-2')), borderRadius: 6, barPercentage: .7 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, layout: { padding: { left: 6 } }, onClick: (e, els) => { if (els[0]) openPlayer(role, list[els[0].index].id); }, onHover: hov,
      plugins: { legend: { display: false }, tooltip: { ...tip(), callbacks: { title: c => list[c[0].dataIndex].n, label: c => { const p = list[c.dataIndex]; return [`Raw ${word} ${fmt(p.v, main.d)} vs league ${fmt(L, main.d)}`, `${p.b} pressure balls, so the edge shrinks to ${sgn(p.adj, main.d)}`]; } } } },
      scales: { x: { grid: grid(), title: { display: true, text: `${word} edge vs league, shrunk for small samples` } }, y: { grid: { display: false }, ticks: { color: css('--ink'), padding: 6 } } } }
  });
  $('#rrtbl-s').textContent = `${list.length} players · league ${fmt(L, main.d)} · faded = under 100 pressure balls`;
  $('#rrtbl thead').innerHTML = `<tr><th>Player</th><th class="n">Pressure ${role === 'bat' ? 'SR' : 'econ'}</th><th class="n">Raw vs league</th><th class="n">Other balls</th><th class="n">2025–26</th><th>Report</th></tr>`;
  $('#rrtbl tbody').innerHTML = list.map(p => { const rp = repBy[role + p.id], d = better(role, p.v, L); return `<tr data-id="${p.id}" class="${p.b < 100 ? 'thin' : ''}"><td><b>${p.n}</b> ${starBtn(role, p.id)}<br><span class="muted">${p.b} pressure balls${p.b < 100 ? ' · thin sample' : ''}</span></td><td class="n">${fmt(p.v, main.d)}</td><td class="n ${d >= 0 ? 'up' : 'dn'}">${sgn(d, main.d)}</td><td class="n">${fmt(p.nv, main.d)}</td><td class="n">${fmt(p.rec, main.d)}</td><td>${rp ? `<span class="tag ${rp.tier}">#${rp.rank}</span>` : '<span class="muted">—</span>'}</td></tr>`; }).join('');
  bindRows('#rrtbl', role);
  const card = $('.rrchart'); card.dataset.mode = S.rrMode || 'chart';
  $$('#rrsq-mode button').forEach(b => { const on = b.dataset.v === card.dataset.mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    b.onclick = () => { S.rrMode = b.dataset.v; try { localStorage.setItem('rr-sqmode', S.rrMode); } catch (e) {} renderRR(); }; });
  renderRRMatchups(role, squad);
}

/* ---------- PLAYER ---------- */
function renderOverview() {
  const role = S.role, id = S.sel[role], P = PL[id], rep = repBy[role + id], pool = poolBy[role + id], ms = M[role], main = ms[0];
  const agg = aggregate(role, { id })[id] || { hp: blank(), n: blank(), all: blank(), ipl: 0 };
  const L = league(role);
  $('#back').classList.toggle('on', !!S.from);
  $('#back').textContent = '← Back to ' + ({ rank: 'Top 10 report', explore: 'Explore all', rr: 'RR room', auction: 'Auction pool', compare: 'Head to head', method: 'How it works' }[S.from] || '');
  $('#back').onclick = () => setView(S.from);
  $('#p-name').textContent = P.n;
  $('#p-team').textContent = rep ? `${role === 'bat' ? 'Batter' : 'Bowler'} · #${rep.rank} of ${role === 'bat' ? R.meta.qualBat : R.meta.qualBowl} · ${rep.role} · ${rep.status}` : [role === 'bat' ? 'Batter' : 'Bowler', P.ipl ? 'Last IPL: ' + P.ipl : 'No IPL side in data', P.nat].filter(Boolean).join(' · ');
  $('#p-star').textContent = inSL(role, id) ? '★ Shortlisted' : '☆ Shortlist'; $('#p-star').classList.toggle('on', inSL(role, id));
  $('#p-star').onclick = () => toggleSL(role, id);
  $('#p-cmp').onclick = () => { const nxt = R.players.find(p => p.type === role && p.id !== id); S.cmp[role] = [id, nxt.id]; setView('compare'); };
  $('#p-link').onclick = () => copy(location.href, 'Link copied');

  const hp = main.f(agg.hp), nm = main.f(agg.n), lv = main.f(L.hp);
  const isl = agg.all.b ? agg.ipl / agg.all.b * 100 : 0;
  if (rep) {
    $('#k-main-l').innerHTML = `Pressure rating <span class="scope rep">Report</span><button class="info" data-tip="Runs he ${role === 'bat' ? 'added' : 'saved'} per 100 pressure balls compared with an average player on exactly the same balls. +10 is about 2 runs every 20 balls.">i</button>`;
    $('#k-main').textContent = sgn(rep.rating);
    $('#verdict').innerHTML = `${callTag(rep, iplShareOf(role, id))}<span class="tier ${rep.tier}">${rep.tier}</span><span>${rep.pb} pressure balls${rep.pm ? ` in ${rep.pm} matches` : ''}${rep.beat ? ` · beat the benchmark in ${rep.beat[0]} of ${rep.beat[1]} matches` : ''}</span>${rep.small ? '<span class="tag t20" title="Under 200 pressure balls: the rating rests on a smaller sample">small sample</span>' : ''}`;
    $('#k-hint').textContent = rep.blurb;
  } else {
    $('#k-main-l').innerHTML = `${main.l} on pressure balls <span class="scope live">Filtered</span>`;
    $('#k-main').textContent = fmt(hp, main.d);
    const d = better(role, hp, lv);
    $('#verdict').innerHTML = pool ? `<span class="tier ${pool.tier}">${pool.tier}</span><span>Auction pool · overall #${pool.rank} · rating ${sgn(pool.rating)}</span>` : `<span class="${d >= 0 ? 'up' : 'dn'}">${sgn(d, main.d)} vs league on pressure balls</span>`;
    $('#k-hint').textContent = agg.hp.b < 30 ? `Only ${agg.hp.b} pressure balls in this filter, so treat these numbers as noise.` : 'Outside the report top 10, so this view uses the raw ball-by-ball splits under your filters.';
  }
  const st = rep ? rep.stats : {};
  const t = (l, v, s, flag) => { if (!flag) return `<div class="tile"><p>${l}</p><b>${v}</b><small>${s}</small></div>`; const base = rep ? rep.pAvg : lv, val = rep ? rep.pP : hp, dd = better(role, val, base); return `<div class="tile flag"><div><p>${l}</p><b>${v}</b><small>${s}</small></div><span class="delta pillish ${dd >= 0 ? 'up' : 'dn'}">${sgn(dd, role === 'bat' ? 0 : 2)}</span></div>`; };
  $('#k-hint').insertAdjacentHTML('beforeend', `<span class="isl ${isl < 50 ? 'warn' : ''}">${Math.round(isl)}% of his balls in this filter came in the IPL${isl < 50 ? ', so weigh with care' : ''}.</span>`);
  $('#tiles').innerHTML = (role === 'bat' ? [
    t('Pressure strike rate', rep ? rep.pP : fmt(hp), rep ? `average batter, same balls: ${rep.pAvg}` : `league on pressure balls: ${fmt(lv)}`, 1),
    t('Holds up under', rep ? `${rep.defs} of 14` : '—', 'other definitions'),
    t(rep ? 'Career strike rate' : 'Normal strike rate', rep ? st['Strike rate'] : fmt(nm), rep ? `${st['Runs']} runs` : `${agg.n.b} other balls`),
  ] : [
    t('Pressure economy', rep ? rep.pP.toFixed(2) : fmt(hp, 2), rep ? `average bowler, same balls: ${rep.pAvg.toFixed(2)}` : `league on pressure balls: ${fmt(lv, 2)}`, 1),
    t('Holds up under', rep ? `${rep.defs} of 14` : '—', 'other pressure definitions'),
    t(rep ? 'Wickets' : 'Normal economy', rep ? st['Wickets'] : fmt(nm, 2), rep ? `avg ${st['Average']} · SR ${st['Strike rate']}` : `${agg.n.b} other balls`),
  ]).join('');

  $('#trend-metric').innerHTML = ms.slice(0, 3).map((m, i) => `<button class="${i === S.metric ? 'on' : ''}" data-i="${i}" aria-pressed="${i === S.metric}">${m.l}</button>`).join('');
  $$('#trend-metric button').forEach(b => b.onclick = () => { S.metric = +b.dataset.i; renderOverview(); });
  const m = ms[S.metric];
  const per = YEARS.map(y => S.years.has(y) ? (aggregate(role, { id, years: new Set([y]) })[id] || { hp: blank(), n: blank() }) : { hp: blank(), n: blank() });
  const hpv = per.map(a => a.hp.b >= 12 ? +m.f(a.hp).toFixed(2) : null), nv = per.map(a => a.n.b >= 12 ? +m.f(a.n).toFixed(2) : null);
  $('#trend-sub').textContent = `${m.l}: pressure balls vs the rest`;
  empty('trend', hpv.every(v => v == null) ? `Not enough pressure balls for ${P.n} in this filter. Try more seasons or phases.` : '');
  const W = 'rgba(255,255,255,';
  chart('trend', {
    data: { labels: YEARS.map(String), datasets: [
      { type: 'line', label: 'Pressure balls', data: hpv, borderColor: '#fff', backgroundColor: W + '.14)', fill: 'origin', tension: .15, pointRadius: 5, pointBackgroundColor: '#fff', pointBorderColor: '#a50e5c', pointBorderWidth: 2, borderWidth: 2.5, spanGaps: true },
      { type: 'line', label: 'Other balls', data: nv, borderColor: '#ffd36b', tension: .15, pointRadius: 3, pointBackgroundColor: '#ffd36b', borderWidth: 1.6, spanGaps: true },
    ] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', align: 'end', labels: { color: '#fff', boxWidth: 8, boxHeight: 8, usePointStyle: true } },
        tooltip: { ...tip(), displayColors: true, callbacks: { afterBody: c => { const a = per[c[0].dataIndex]; return `${a.hp.b} pressure · ${a.n.b} other balls`; } } } },
      scales: { x: { grid: { color: W + '.1)' }, ticks: { color: W + '.85)' }, border: { display: false } }, y: { grid: { color: W + '.07)' }, ticks: { color: W + '.85)' }, border: { display: false } } } }
  });

  const top = R.players.filter(p => p.type === role);
  $('#watch-l').innerHTML = `Top 10 ${roleWord(role)}<small>tap to switch</small>`;
  $('#watch').innerHTML = top.map(p => `<button class="wi ${p.id === id ? 'on' : ''}" data-id="${p.id}" ${p.id === id ? 'aria-current="true"' : ''}>
    <span class="av" style="background:${p.tier === 'STRONG' ? 'var(--pink)' : p.tier === 'CONTENDER' ? 'var(--blue)' : '#55555e'}">${initials(p.name)}</span>
    <span class="t">#${p.rank} ${p.name.split(' ').slice(-1)}<b>${sgn(p.rating)}</b></span><canvas id="sp${p.id}" width="56" height="24" aria-hidden="true"></canvas></button>`).join('');
  $$('#watch .wi').forEach(b => b.onclick = () => { S.sel[role] = +b.dataset.id; sync(false); renderOverview(); });
  top.forEach(p => {
    const v = YEARS.map(y => { const a = (aggregate(role, { id: p.id, years: new Set([y]) })[p.id] || {}).hp; return a && a.b >= 12 ? main.f(a) : null; });
    chart('sp' + p.id, { type: 'line', data: { labels: YEARS, datasets: [{ data: v, borderColor: css('--ink-3'), borderWidth: 1.4, pointRadius: v.map((_, i) => i === v.length - 1 ? 2.5 : 0), pointBackgroundColor: css('--pink'), tension: .2, spanGaps: true }] }, options: { responsive: false, animation: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false, reverse: role === 'bowl' } } } });
  });
  const wl = $('#watch'); $('#wprev').onclick = () => wl.scrollBy({ left: -300, behavior: 'smooth' }); $('#wnext').onclick = () => wl.scrollBy({ left: 300, behavior: 'smooth' });
  const on = wl.querySelector('.on'); if (on) wl.scrollLeft = Math.max(0, on.offsetLeft - wl.offsetLeft - 40);

  const phA = PHASES.map(ph => (aggregate(role, { id, phases: new Set([ph]) })[id] || { hp: blank() }).hp);
  const phL = PHASES.map(ph => main.f(league(role, { phases: new Set([ph]) }).hp));
  const tot = phA.reduce((s, a) => s + a.b, 0);
  const cols = [css('--pink'), css('--gold'), css('--blue-2')];
  $('#stack').innerHTML = tot ? phA.map((a, i) => `<i style="width:${a.b / tot * 100}%;background:${cols[i]}"></i>`).join('') : '';
  $('#plist').innerHTML = tot ? PHASES.map((ph, i) => { const a = phA[i], v = main.f(a), d = better(role, v, phL[i]); return `<div class="prow"><span class="dot" style="background:${cols[i]}"></span><span><b>${ph}</b> <span class="v">${Math.round(a.b / tot * 100)}% · ${a.b} balls</span></span><span>${a.b >= 12 ? fmt(v, main.d) : '—'}</span><span class="v ${a.b >= 12 ? (d >= 0 ? 'up' : 'dn') : ''}" title="vs league on pressure balls in this phase">${a.b >= 12 ? sgn(d, main.d) + ' vs lg' : 'few balls'}</span></div>`; }).join('') : '<p class="muted">No pressure balls in this filter.</p>';

  if (rep) {
    $('#g-h').innerHTML = 'Rank stability <span class="scope rep">Report</span><button class="info" data-tip="The ranking was re-run 180 times, each on a resample of whole matches. This is how often he stayed in the top 10.">i</button>';
    $('#g-num').textContent = rep.reruns + '%'; $('#g-sub').textContent = 'of 180 re-runs kept him top 10';
    $('#g-foot').textContent = rep.lo ? `Likely rank range #${rep.lo} to #${rep.hi}` : 'Rank range not published for this player';
  } else {
    const v = agg.all.b ? Math.round(agg.hp.b / agg.all.b * 100) : 0;
    $('#g-h').innerHTML = 'Pressure exposure <span class="scope live">Filtered</span>';
    $('#g-num').textContent = v + '%'; $('#g-sub').textContent = 'of his balls were pressure balls';
    $('#g-foot').textContent = `${agg.hp.b} of ${agg.all.b} balls in this filter`;
  }
  const gv = rep ? rep.reruns : (agg.all.b ? agg.hp.b / agg.all.b * 100 : 0);
  chart('gauge', { type: 'doughnut', data: { datasets: [{ data: [gv, 100 - gv], backgroundColor: [css('--gold'), css('--card-2')], borderWidth: 0, borderRadius: 12, cutout: '84%', circumference: 240, rotation: -120 }] }, options: { maintainAspectRatio: false, plugins: { tooltip: { enabled: false }, legend: { display: false } }, layout: { padding: { bottom: 14, top: 4 } } } });

  if (rep) {
    $('#notes-h').innerHTML = 'Scouting notes <span class="scope rep">Report</span>';
    $('#notes').innerHTML = `<div><h4>Why he fits</h4><p class="q">${rep.why.join('. ')}.</p></div><div><h4>${role === 'bat' ? 'How to bowl to him' : 'How batters play him'}</h4><p>${rep.how}</p></div><div><h4>Caveat</h4><p>${rep.caveat}</p></div>`;
  } else {
    $('#notes-h').innerHTML = 'Pressure vs normal <span class="scope live">Filtered</span>';
    $('#notes').innerHTML = ms.map(mm => { const a = mm.f(agg.hp), b = mm.f(agg.n), ok = mm.hi ? a > b : a < b; return `<div><h4>${mm.l}</h4><p class="q">${fmt(a, mm.d)} <span class="${ok ? 'up' : 'dn'}">${ok ? '▲' : '▼'}</span> <span class="muted">normal ${fmt(b, mm.d)} · league ${fmt(mm.f(L.hp), mm.d)}</span></p></div>`; }).join('')
      + (pool ? `<div class="use">In the 2027 auction pool: overall #${pool.rank}, pressure ${pool.cmp} vs average, last IPL side ${pool.last}.</div>` : '');
  }

  renderMatchups(role, id);
  $('#knocks-card').style.display = rep ? '' : 'none';
  if (rep) {
    $('#knocks-h').innerHTML = (role === 'bat' ? 'Pressure knocks: best and worst' : 'Pressure spells: best and worst') + ' <span class="scope rep">Report</span>';
    $('#knocks').innerHTML = rep.games.map(g => `<div class="kn"><div><div class="opp">v ${g.opp}</div><div class="cmp">${g.comp}</div></div><div class="fig">${g.fig}</div><div class="sit">${g.sit} · ${g.pb} pressure balls</div><span class="res ${g.res === 'no result' ? 'no' : g.res}">${g.res}</span><div class="gain ${g.gain < 0 ? 'dn' : ''}">${g.gain > 0 ? '+' : g.gain < 0 ? '−' : ''}${Math.abs(g.gain)}</div></div>`).join('');
  }
}


/* ---------- SPLITS ---------- */
const SP = window.RR_SPLITS, VEN = SP.venues;
const DIMS = { bat: [['ps', 'Pace v spin'], ['inn', 'Setting v chasing'], ['ven', 'Venues']], bowl: [['hand', 'v RHB / LHB'], ['inn', 'First v defending'], ['ven', 'Venues']] };
S.mudim = { bat: 'ps', bowl: 'hand' }; S.rrdim = { bat: 'ps', bowl: 'hand' };
const add2 = (a, r) => { a.b += r[6]; a.r += r[7]; a.o += r[8]; a.d += r[9]; a.x += r[10]; };
function splitAgg(role, dim, ids) {
  const out = {};
  SP[role].forEach(r => {
    if (r[4] !== dim || !S.years.has(r[1]) || (S.cls !== 'all' && r[2] !== S.cls) || (ids && !ids.has(r[0]))) return;
    const k = r[5], o = out[k] || (out[k] = { hp: blank(), n: blank(), byId: {} });
    add2(r[3] ? o.hp : o.n, r);
    if (ids) { const p = o.byId[r[0]] || (o.byId[r[0]] = { hp: blank(), n: blank() }); add2(r[3] ? p.hp : p.n, r); }
  });
  return out;
}
const vLabel = (dim, v) => dim === 'ven' ? (VEN[v] || 'Venue ' + v) : dim === 'hand' ? (v === 'RHB' ? 'v right-handers' : 'v left-handers') : dim === 'ps' ? 'v ' + v.toLowerCase() : v;
function segDims(sel, role, store, cb) {
  $(sel).innerHTML = DIMS[role].map(([k, l]) => `<button data-v="${k}" class="${store[role] === k ? 'on' : ''}" aria-pressed="${store[role] === k}">${l}</button>`).join('');
  $$(sel + ' button').forEach(b => b.onclick = () => { store[role] = b.dataset.v; cb(); });
}
function renderMatchups(role, id) {
  const main = M[role][0], dim = S.mudim[role], ms = M[role];
  segDims('#mu-dim', role, S.mudim, () => renderMatchups(role, id));
  const mine = splitAgg(role, dim, new Set([id])), lg = splitAgg(role, dim);
  let keys = Object.keys(mine).filter(k => mine[k].hp.b + mine[k].n.b > 0);
  if (dim === 'ven') keys = keys.sort((x, y) => (mine[y].hp.b + mine[y].n.b) - (mine[x].hp.b + mine[x].n.b)).slice(0, 8);
  else keys.sort();
  $('#mu-sub').textContent = `${dim === 'ven' ? 'His 8 most-played grounds. IPL ground names come from the team that hosts most games there. ' : ''}Seasons and competition filters apply; phase does not. Faded = under 20 pressure balls.`;
  const pv = keys.map(k => mine[k].hp.b >= 8 ? +main.f(mine[k].hp).toFixed(2) : null), nv = keys.map(k => mine[k].n.b >= 8 ? +main.f(mine[k].n).toFixed(2) : null), lv = keys.map(k => lg[k] ? +main.f(lg[k].hp).toFixed(2) : null);
  empty('mubar', keys.length ? '' : 'No balls for this split in the current filter.');
  if (keys.length) chart('mubar', { data: { labels: keys.map(k => shortV(vLabel(dim, k))), datasets: [
      { type: 'bar', label: 'Pressure balls', data: pv, backgroundColor: keys.map(k => mine[k].hp.b >= 20 ? css('--pink') : css('--pink') + '55'), borderRadius: 6, barPercentage: .7, categoryPercentage: .7 },
      { type: 'bar', label: 'Other balls', data: nv, backgroundColor: css('--blue-2') + 'aa', borderRadius: 6, barPercentage: .7, categoryPercentage: .7 },
      { type: 'line', label: 'League, pressure', data: lv, borderColor: css('--gold'), borderDash: [4, 4], pointRadius: 4, pointBackgroundColor: css('--gold'), showLine: false } ] },
    options: { indexAxis: dim === 'ven' ? 'y' : 'x', maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { ...tip(), displayColors: true, callbacks: { title: c => vLabel(dim, keys[c[0].dataIndex]), afterBody: c => { const k = keys[c[0].dataIndex]; return `${mine[k].hp.b} pressure · ${mine[k].n.b} other balls`; } } } },
      scales: { x: { grid: dim === 'ven' ? grid() : { display: false }, ticks: { color: css('--ink') } }, y: { grid: dim === 'ven' ? { display: false } : grid(), ticks: { color: css('--ink') }, beginAtZero: true } } } });
  $('#mutbl thead').innerHTML = `<tr><th>${dim === 'ven' ? 'Ground' : 'Split'}</th><th class="n">Pressure balls</th><th class="n">${main.l} pressure</th><th class="n">Other balls</th><th class="n">vs league</th><th class="n">${role === 'bat' ? 'Balls / out' : 'Balls / wkt'}</th></tr>`;
  $('#mutbl tbody').innerHTML = keys.map(k => { const a = mine[k], p = main.f(a.hp), d = lg[k] ? better(role, p, main.f(lg[k].hp)) : null, thin = a.hp.b < 20;
    return `<tr class="${thin ? 'thin' : ''} ${/Rajasthan/.test(vLabel(dim, k)) ? 'rr' : ''}" style="cursor:default"><td>${vLabel(dim, k)}</td><td class="n">${a.hp.b}</td><td class="n">${a.hp.b >= 8 ? fmt(p, main.d) : '—'}</td><td class="n">${fmt(main.f(a.n), main.d)}</td><td class="n ${d == null || a.hp.b < 8 ? '' : d >= 0 ? 'up' : 'dn'}">${a.hp.b >= 8 ? sgn(d, main.d) : '—'}</td><td class="n">${fmt(ms[3].f(a.hp), 1)}</td></tr>`; }).join('');
}
const shortV = s => s.replace(' home ground', ' home').replace(/ \(\d+ IPL games\)/, '').replace('Royal Challengers Bengaluru', 'RCB').replace('Sunrisers Hyderabad', 'SRH').replace('Lucknow Super Giants', 'LSG').replace('Kolkata Knight Riders', 'KKR').replace('Chennai Super Kings', 'CSK');
function renderRRMatchups(role, squad) {
  const main = M[role][0], dim = S.rrdim[role];
  segDims('#rrmu-dim', role, S.rrdim, () => renderRRMatchups(role, squad));
  const ids = new Set(squad), sq = splitAgg(role, dim, ids), lg = splitAgg(role, dim);
  let keys = Object.keys(sq);
  if (dim === 'ven') { keys = keys.filter(k => /Rajasthan/.test(VEN[k] || '')).concat(keys.filter(k => !/Rajasthan/.test(VEN[k] || '')).sort((x, y) => sq[y].hp.b - sq[x].hp.b).slice(0, 4)); }
  else keys.sort();
  $('#rrmu-sub').textContent = `${main.l} on pressure balls for each squad player; the top row pools the whole squad against the league. ${dim === 'ven' ? 'RR home grounds first, then the 4 grounds where the squad faced most pressure balls. ' : ''}Cells under 15 pressure balls are blank.`;
  const tint = d => { if (d == null || !isFinite(d)) return ''; const s = Math.max(-1, Math.min(1, d / (role === 'bat' ? 40 : 2.5))); return `background:color-mix(in srgb,${s >= 0 ? 'var(--good)' : 'var(--bad)'} ${Math.round(Math.abs(s) * 38)}%,transparent)`; };
  const cell = (a, k) => { if (!a || a.hp.b < 15) return `<td class="n muted">·</td>`; const v = main.f(a.hp), d = better(role, v, main.f(lg[k].hp)); return `<td class="n" style="${tint(d)}" title="${a.hp.b} pressure balls · ${sgn(d, main.d)} vs league">${fmt(v, main.d)}</td>`; };
  $('#rrmu thead').innerHTML = `<tr><th>Player</th>${keys.map(k => `<th class="n">${shortV(vLabel(dim, k))}</th>`).join('')}</tr>`;
  const players = squad.filter(id => keys.some(k => sq[k].byId[id] && sq[k].byId[id].hp.b >= 15));
  $('#rrmu tbody').innerHTML = `<tr style="cursor:default"><td><b>Whole squad</b><br><span class="muted">league in brackets</span></td>${keys.map(k => { const a = sq[k].hp, v = main.f(a), d = better(role, v, main.f(lg[k].hp)); return `<td class="n" style="${tint(d)}"><b>${fmt(v, main.d)}</b><br><span class="muted">(${fmt(main.f(lg[k].hp), main.d)})</span></td>`; }).join('')}</tr>`
    + players.map(id => `<tr data-id="${id}"><td><b>${PL[id].n}</b></td>${keys.map(k => cell(sq[k].byId[id], k)).join('')}</tr>`).join('');
  bindRows('#rrmu', role);
}

/* ---------- RANKINGS ---------- */
function renderRank() {
  const role = S.role, list = R.players.filter(p => p.type === role);
  $('#ht1').textContent = role === 'bat' ? 'Places 2–5 sit within 0.7 runs per 100 balls, and 6–10 within 1.5. The tier says how secure a place is; the range chart shows how far it could move.' : 'Rashid leads Bumrah by 1.4. From #3 to #8 the ratings sit within 2.4 runs per 100 balls, so read the tier first.';
  const G = [['Locks', 'STRONG', 'top 10 in 60%+ of re-runs', css('--good')], ['Contenders', 'CONTENDER', '30–59%', css('--gold')], ['Fragile', 'FRINGE', 'under 30%', css('--ink-3')]];
  $('#groups').innerHTML = G.map(([h, t, s, c]) => `<div class="grp"><h4><span style="width:8px;height:8px;border-radius:50%;background:${c}"></span>${h} <span class="muted">${s}</span></h4>${list.filter(p => p.tier === t).sort((a, b) => b.reruns - a.reruns).map(p => `<button data-id="${p.id}">#${p.rank} ${p.name}<span>${p.reruns}% · ${sgn(p.rating)}</span></button>`).join('') || '<p class="muted">None</p>'}</div>`).join('');
  $$('#groups [data-id]').forEach(b => b.onclick = () => openPlayer(role, +b.dataset.id));
  $('#rk-h').innerHTML = `Top 10 ${roleWord(role)} by rating <span class="scope rep">Report</span>`;
  const tc = t => t === 'STRONG' ? css('--pink') : t === 'CONTENDER' ? css('--blue-2') : css('--blue-2') + '66';
  const click = (e, els) => { if (els[0]) openPlayer(role, list[els[0].index].id); };
  chart('rkbar', { type: 'bar', data: { labels: list.map(p => p.name), datasets: [{ data: list.map(p => p.rating), backgroundColor: list.map(p => tc(p.tier)), borderRadius: 6, barPercentage: .72 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, onClick: click, onHover: hov, plugins: { legend: { display: false }, tooltip: { ...tip(), callbacks: { label: c => { const p = list[c.dataIndex]; return [`${sgn(p.rating)} per 100 pressure balls`, `${p.tier} · ${p.pb} pressure balls`]; } } } }, scales: { x: { beginAtZero: true, grid: grid() }, y: { grid: { display: false }, ticks: { color: css('--ink') } } } } });
  chart('rkrange', { data: { labels: list.map(p => p.name), datasets: [
      { type: 'bar', data: list.map(p => p.lo ? [p.lo, p.hi] : null), backgroundColor: list.map(p => tc(p.tier) + '88'), borderRadius: 20, barPercentage: .38 },
      { type: 'scatter', data: list.map(p => ({ x: p.rank, y: p.name })), backgroundColor: css('--ink'), pointRadius: 5, pointHoverRadius: 7 } ] },
    options: { indexAxis: 'y', maintainAspectRatio: false, onClick: click, onHover: hov, plugins: { legend: { display: false }, tooltip: { ...tip(), callbacks: { label: c => c.datasetIndex ? `Report rank #${c.raw.x}` : `Likely #${c.raw[0]} to #${c.raw[1]}` } } }, scales: { x: { min: 0, max: 50, title: { display: true, text: 'rank, lower is better' }, grid: grid() }, y: { type: 'category', grid: { display: false }, ticks: { color: css('--ink') } } } } });
  const pk = role === 'bat' ? 'Pressure SR v avg' : 'Pressure econ v avg';
  $('#rktbl thead').innerHTML = `<tr><th>Player</th><th class="n">#</th><th>Role</th><th>2027 status</th><th class="n">Rating</th><th>Tier</th><th class="n">${pk}</th><th class="n">Pressure balls</th><th>Holds under</th><th class="n">Rank stability</th><th>Call</th><th></th></tr>`;
  $('#rktbl tbody').innerHTML = list.map(p => `<tr data-id="${p.id}" class="${isRRteam(PL[p.id].ipl) ? 'rr' : ''}"><td><b>${p.name}</b></td><td class="n">${p.rank}</td><td>${p.role}</td><td>${p.status.replace(' for 2027', '')}</td><td class="n">${sgn(p.rating)}</td><td><span class="tag ${p.tier}">${p.tier}</span></td>
    <td class="n">${role === 'bat' ? p.pP : p.pP.toFixed(2)} <span class="muted">v ${role === 'bat' ? p.pAvg : p.pAvg.toFixed(2)}</span></td><td class="n">${p.pb}</td><td><span class="meter"><i style="width:${p.defs / 14 * 100}%"></i></span>${p.defs}/14</td><td class="n">${p.reruns}%</td><td>${callTag(p, iplShareOf(role, p.id))}</td><td>${starBtn(role, p.id)}</td></tr>`).join('');
  bindRows('#rktbl', role);
}

/* ---------- EXPLORER ---------- */
function renderExplore() {
  const role = S.role, ms = M[role], main = ms[0], T = table(role), L = main.f(league(role).hp), RC = aggregate(role, { years: RECENT });
  T.forEach(p => { const r = RC[p.id]; p.rec = r && r.hp.b >= 20 ? main.f(r.hp) : null; });
  $('#sc-sub').textContent = role === 'bat' ? 'Strike rate. Above the line = faster under pressure than his own normal. Pink = report top 10, white = RR, blue = everyone else. Click a dot.' : 'Economy. Below the line = cheaper under pressure than his own normal. Pink = report top 10, white = RR, blue = everyone else. Click a dot.';
  empty('scatter', T.length ? '' : 'No one qualifies. Lower the minimum balls or widen the filters.');
  if (T.length) {
    const vals = T.flatMap(p => [p.hpm, p.nm]).filter(isFinite), lo = Math.floor(Math.min(...vals) * .95), hi = Math.ceil(Math.max(...vals) * 1.03);
    const bmax = Math.max(...T.map(p => p.hp.b), 1);
    chart('scatter', { type: 'scatter', data: { datasets: [
        { type: 'line', data: [{ x: lo, y: lo }, { x: hi, y: hi }], borderColor: css('--ink-3'), borderDash: [4, 4], pointRadius: 0, borderWidth: 1 },
        { data: T.map(p => ({ x: +p.nm.toFixed(2), y: +p.hpm.toFixed(2) })), pointRadius: T.map(p => p.rep || isRRteam(PL[p.id].ipl) ? 6 : 4), pointHoverRadius: 8,
          backgroundColor: T.map(p => p.rep ? css('--pink') : isRRteam(PL[p.id].ipl) ? css('--ink') : css('--blue-2') + '77'), borderColor: css('--card'), borderWidth: T.map(p => p.rep || isRRteam(PL[p.id].ipl) ? 2 : 0) } ] },
      options: { maintainAspectRatio: false, onClick: (e, els) => { const el = els.find(x => x.datasetIndex === 1); if (el) openPlayer(role, T[el.index].id); }, onHover: (e, els) => { e.native.target.style.cursor = els.some(x => x.datasetIndex === 1) ? 'pointer' : 'default'; },
        plugins: { legend: { display: false }, tooltip: { ...tip(), filter: c => c.datasetIndex === 1, callbacks: { title: c => T[c[0].dataIndex].name, label: c => { const p = T[c.dataIndex]; return [`Pressure ${fmt(p.hpm, main.d)} · normal ${fmt(p.nm, main.d)}`, `${p.hp.b} pressure balls · ${Math.round(p.iplShare)}% IPL`]; } } } },
        scales: { x: { min: lo, max: hi, title: { display: true, text: `${main.l}, other balls` }, grid: grid() }, y: { min: lo, max: hi, title: { display: true, text: `${main.l}, pressure balls` }, grid: grid() } } } });
  }
  const Lb = [...T].filter(p => p.hp.b >= 60).sort((a, b) => b.vsl - a.vsl).slice(0, 12);
  $('#lift-sub').textContent = `${role === 'bat' ? 'Strike rate' : 'Economy'} on pressure balls minus the league's ${fmt(L, main.d)} in this filter · 60+ pressure balls · pink = report top 10 · outlined = mostly T20I balls`;
  chart('liftbar', { type: 'bar', data: { labels: Lb.map(p => p.name + (p.iplShare < 50 ? ' · T20I' : '')), datasets: [{ data: Lb.map(p => +p.vsl.toFixed(2)), backgroundColor: Lb.map(p => p.rep ? css('--pink') : p.iplShare < 50 ? 'transparent' : css('--blue-2')), borderColor: Lb.map(p => p.rep ? css('--pink') : css('--blue-2')), borderWidth: Lb.map(p => p.iplShare < 50 ? 1.5 : 0), borderRadius: 6 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, onClick: (e, els) => { if (els[0]) openPlayer(role, Lb[els[0].index].id); }, onHover: hov, plugins: { legend: { display: false }, tooltip: { ...tip(), callbacks: { label: c => { const p = Lb[c.dataIndex]; return [`${sgn(p.vsl, main.d)} vs league`, `${fmt(p.hpm, main.d)} on ${p.hp.b} pressure balls`, `${Math.round(p.iplShare)}% IPL`]; } } } }, scales: { x: { grid: grid() }, y: { grid: { display: false }, ticks: { color: css('--ink') } } } } });

  const cols = [
    ['name', 'Player', p => `<b>${p.name}</b>${p.rep ? ` <span class="tag ${p.rep.tier}">#${p.rep.rank}</span>` : ''}${p.iplShare < 50 ? ' <span class="tag t20">T20I</span>' : ''}`, 0, p => p.name],
    ['team', 'Last IPL', p => teamAb(PL[p.id].ipl) || '<span class="muted">—</span>', 0, p => PL[p.id].ipl],
    ['hpb', 'Pressure balls', p => p.hp.b, 1, p => p.hp.b],
    ['hpm', `${main.l} pressure`, p => fmt(p.hpm, main.d), 1, p => role === 'bat' ? p.hpm : -p.hpm],
    ['vsl', 'vs league', p => `<span class="${p.vsl >= 0 ? 'up' : 'dn'}">${sgn(p.vsl, main.d)}</span>`, 1, p => p.vsl],
    ['rec', '2025–26', p => fmt(p.rec, main.d), 1, p => p.rec == null ? -1e9 : role === 'bat' ? p.rec : -p.rec],
    ['nm', 'Other balls', p => fmt(p.nm, main.d), 1, p => role === 'bat' ? p.nm : -p.nm],
    ['lift', 'vs own normal', p => `<span class="${p.lift >= 0 ? 'up' : 'dn'}">${sgn(p.lift, main.d)}</span>`, 1, p => p.lift],
    ['dotp', 'Pressure dot %', p => fmt(ms[1].f(p.hp)), 1, p => ms[1].f(p.hp)],
    ['ipl', 'IPL %', p => Math.round(p.iplShare) + '%', 1, p => p.iplShare],
    ['wpa', 'Wins added /100', p => sgn(p.wpa, 2), 1, p => p.wpa],
  ];
  const c = cols.find(x => x[0] === S.sort.k) || cols[4];
  T.sort((a, b) => { const x = c[4](a), y = c[4](b); const r = typeof x === 'string' || typeof y === 'string' ? String(x || '').localeCompare(String(y || '')) : x - y; return S.sort.asc ? r : -r; });
  $('#tbl-count').innerHTML = `${T.length} players · click a header to sort <button class="linkbtn" id="morecols">${S.moreCols ? 'Fewer columns' : 'More columns'}</button>`;
  $('#tbl').classList.toggle('lean', !S.moreCols);
  $('#tbl thead').innerHTML = '<tr>' + cols.map(x => `<th data-k="${x[0]}" class="${x[3] ? 'n' : ''} ${x[0] === c[0] ? 's' + (S.sort.asc ? ' asc' : '') : ''}" aria-sort="${x[0] === c[0] ? (S.sort.asc ? 'ascending' : 'descending') : 'none'}">${x[1]}</th>`).join('') + '<th></th></tr>';
  $('#tbl tbody').innerHTML = T.map(p => `<tr data-id="${p.id}" class="${isRRteam(PL[p.id].ipl) ? 'rr' : ''}">` + cols.map(x => `<td class="${x[3] ? 'n' : ''}">${x[2](p)}</td>`).join('') + `<td>${starBtn(role, p.id)}</td></tr>`).join('') || `<tr><td colspan="11" class="muted">No one qualifies. Lower the minimum balls or widen the filters.</td></tr>`;
  $$('#tbl th[data-k]').forEach(th => th.onclick = () => { const k = th.dataset.k; S.sort = { k, asc: S.sort.k === k ? !S.sort.asc : k === 'name' || k === 'team' }; renderExplore(); });
  bindRows('#tbl', role);
  $('#morecols').onclick = () => { S.moreCols = !S.moreCols; renderExplore(); };
}

/* ---------- COMPARE ---------- */
function renderCompare() {
  const role = S.role, T = table(role), ms = M[role], main = ms[0];
  if (T.length < 2) { $('#cmptbl').innerHTML = '<p class="muted">Not enough players in this filter. Lower the minimum balls.</p>'; return; }
  T.sort((a, b) => (!!b.rep - !!a.rep) || a.name.localeCompare(b.name));
  const ids = T.map(p => p.id);
  let [a, b] = S.cmp[role];
  if (!ids.includes(a)) a = ids.includes(S.sel[role]) ? S.sel[role] : ids[0];
  if (!ids.includes(b) || b === a) { const r2 = R.players.find(p => p.type === role && p.id !== a && ids.includes(p.id)); b = r2 ? r2.id : ids.find(x => x !== a); }
  S.cmp[role] = [a, b]; sync(false);
  const opt = sel => `<optgroup label="Report top 10">${T.filter(p => p.rep).map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${p.name} · #${p.rep.rank}</option>`).join('')}</optgroup><optgroup label="Everyone else">${T.filter(p => !p.rep).map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${p.name}</option>`).join('')}</optgroup>`;
  $('#ca').innerHTML = opt(a); $('#cb').innerHTML = opt(b);
  $('#ca').onchange = e => { S.cmp[role][0] = +e.target.value; renderCompare(); };
  $('#cb').onchange = e => { S.cmp[role][1] = +e.target.value; renderCompare(); };
  const A = T.find(p => p.id === a), B = T.find(p => p.id === b);
  const axes = [
    [`${main.l} under pressure`, p => main.f(p.hp), main.hi], ['vs league', p => p.vsl, true], ['vs own normal', p => p.lift, true],
    [`${ms[1].l} under pressure`, p => ms[1].f(p.hp), ms[1].hi], [`${ms[2].l} under pressure`, p => ms[2].f(p.hp), ms[2].hi],
    [ms[3].l + ' (pressure)', p => ms[3].f(p.hp), ms[3].hi], ['Wins added', p => p.wpa, true], ['Pressure sample', p => p.hp.b, true]
  ];
  const pct = (fn, hi, p) => { const v = fn(p), all = T.map(fn).filter(isFinite); if (!isFinite(v)) return 0; const below = all.filter(x => hi ? x < v : x > v).length; return Math.round(below / Math.max(all.length - 1, 1) * 100); };
  const cA = css('--pink'), cB = css('--blue-2');
  chart('radar', { type: 'bar', data: { labels: axes.map(x => x[0]), datasets: [A, B].map((p, i) => ({ label: p.name, data: axes.map(x => pct(x[1], x[2], p)), backgroundColor: i ? cB : cA, borderRadius: 4, barPercentage: .8, categoryPercentage: .7 })) },
    options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { ...tip(), displayColors: true, callbacks: { label: c => `${c.dataset.label}: ${c.raw}th percentile` } } }, scales: { x: { min: 0, max: 100, grid: grid(), ticks: { callback: v => v + 'th' } }, y: { grid: { display: false }, ticks: { color: css('--ink') } } } } });
  const ph = p => PHASES.map(x => { const g = (aggregate(role, { id: p.id, phases: new Set([x]) })[p.id] || { hp: blank() }).hp; return g.b >= 12 ? +main.f(g).toFixed(2) : null; });
  const phL = PHASES.map(x => +main.f(league(role, { phases: new Set([x]) }).hp).toFixed(2));
  $('#cmpbar-h').textContent = `${main.l} by phase, pressure balls only`;
  chart('cmpbar', { data: { labels: PHASES, datasets: [...[A, B].map((p, i) => ({ type: 'bar', label: p.name, data: ph(p), backgroundColor: i ? cB : cA, borderRadius: 6, barPercentage: .7 })), { type: 'line', label: 'League', data: phL, borderColor: css('--gold'), borderDash: [4, 4], pointRadius: 4, pointBackgroundColor: css('--gold'), borderWidth: 1.5 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { ...tip(), displayColors: true } }, scales: { y: { grid: grid(), beginAtZero: role === 'bat' }, x: { grid: { display: false } } } } });
  const rowsC = [['Pressure balls', p => p.hp.b, true, 0], ...ms.map(mm => [mm.l + ' (pressure)', p => mm.f(p.hp), mm.hi, mm.d]), [main.l + ' (normal)', p => main.f(p.n), main.hi, main.d], ['vs league', p => p.vsl, true, main.d], ['vs own normal', p => p.lift, true, main.d], ['IPL share %', p => p.iplShare, true, 0], ['Wins added /100', p => p.wpa, true, 2],
    ['Report rating', p => p.rep ? p.rep.rating : null, true, 1], ['Rank stability %', p => p.rep ? p.rep.reruns : null, true, 0]];
  $('#cmptbl').innerHTML = `<div class="a"><b style="color:${cA}">${A.name}</b></div><div class="m"></div><div class="b"><b style="color:${cB}">${B.name}</b></div>` + rowsC.map(([l, f, hi, d]) => {
    const x = f(A), y = f(B), ok = x != null && y != null && isFinite(x) && isFinite(y);
    return `<div class="a ${ok && (hi ? x > y : x < y) ? 'w' : ''}">${fmt(x, d)}</div><div class="m">${l}</div><div class="b ${ok && (hi ? y > x : y < x) ? 'w' : ''}">${fmt(y, d)}</div>`;
  }).join('');
}

/* ---------- AUCTION ---------- */
function renderAuction() {
  const role = S.role, list = R.pool[role];
  $('#au-h').innerHTML = `Best ${roleWord(role)} under pressure in the 2027 auction pool <span class="scope rep">Report</span>`;
  chart('aubar', { type: 'bar', data: { labels: list.map(p => p.n), datasets: [{ data: list.map(p => p.rating), backgroundColor: list.map(p => /^RR/.test(p.last) ? css('--pink') : p.tier === 'STRONG' ? css('--gold') : p.tier === 'CONTENDER' ? css('--blue-2') : css('--blue-2') + '66'), borderRadius: 6 }] },
    options: { maintainAspectRatio: false, onClick: (e, els) => { const p = els[0] && list[els[0].index]; if (p && p.id) openPlayer(role, p.id); }, onHover: hov, plugins: { legend: { display: false }, tooltip: { ...tip(), callbacks: { label: c => { const p = list[c.dataIndex]; return [`Rating ${sgn(p.rating)} · ${p.tier}`, `Overall #${p.rank} · last ${p.last}`]; } } } }, scales: { y: { grid: { color: css('--line') }, title: { display: true, text: 'Rating: runs per 100 pressure balls vs average' } }, x: { grid: { display: false }, ticks: { color: css('--ink'), maxRotation: 40, autoSkip: false } } } } });
  $('#autbl thead').innerHTML = `<tr><th>Player</th><th class="n">#</th><th class="n">Overall rank</th><th class="n">Rating</th><th>Tier</th><th class="n">${role === 'bat' ? 'Pressure SR v avg' : 'Pressure econ v avg'}</th><th class="n">Pressure balls</th><th>IPL share</th><th>Last IPL team</th><th></th></tr>`;
  $('#autbl tbody').innerHTML = list.map((p, i) => `<tr data-id="${p.id || ''}" class="${/^RR/.test(p.last) ? 'rr' : ''}"><td><b>${p.n}</b></td><td class="n">${i + 1}</td><td class="n">#${p.rank} of ${role === 'bat' ? R.meta.qualBat : R.meta.qualBowl}</td><td class="n">${sgn(p.rating)}</td><td><span class="tag ${p.tier}">${p.tier}</span></td><td class="n">${p.cmp}</td><td class="n">${p.pb}</td><td><span class="meter"><i style="width:${p.ipl}%"></i></span>${p.ipl}%</td><td>${p.last}</td><td>${p.id ? starBtn(role, p.id) : ''}</td></tr>`).join('');
  bindRows('#autbl', role);
}

/* ---------- METHOD ---------- */
function renderMethod() {
  $('#steps').innerHTML = R.meta.steps.map((s, i) => `<div class="step"><p class="kicker">Step ${i + 1}</p><h4>${s[0]}</h4><p>${s[1]}</p></div>`).join('');
  const w = R.meta.worked;
  chart('worked', { type: 'bar', data: { labels: ['Average bowler, same balls (econ)', `${w.name.split(' ')[0]} on them (econ)`, 'Value per 100 balls, unweighted', 'After year weights + adjustment'], datasets: [{ data: [w.avg, w.econ, w.raw, w.final], backgroundColor: [css('--ink-3'), css('--pink'), css('--gold') + '99', css('--gold')], borderRadius: 6, barPercentage: .6 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...tip(), callbacks: { label: c => ' ' + c.raw } } }, scales: { x: { beginAtZero: true, grid: grid() }, y: { grid: { display: false }, ticks: { color: css('--ink') } } } } });
  $('#gloss').innerHTML = [
    ['Pressure ball', 'One of the tightest fifth of balls in an innings, where the result can swing most.'],
    ['Rating', 'Runs added (batters) or saved (bowlers) per 100 pressure balls against an average player on the same balls, after small-sample adjustment.'],
    ['Tier', 'STRONG = top 10 in 60%+ of 180 re-runs, CONTENDER 30–59%, FRINGE under 30%.'],
    ['Rank stability', 'Share of the 180 re-runs (each a resample of whole matches) where the player stayed top 10.'],
    ['Holds up under X of 14', 'How many of 14 alternative pressure definitions still put him in the top 10.'],
    ['vs league', 'His raw pressure number minus everyone else\'s on pressure balls in the same filter.'],
    ['vs own normal', 'His pressure number minus his own number on other balls. Can flatter players with a low normal.'],
    ['Wins added /100', 'Change in win probability he caused per 100 balls (all balls in the filter).'],
  ].map(([a, b]) => `<div><b>${a}</b>${b}</div>`).join('');
}

/* ---------- boot ---------- */
$$('#tabs button[data-view]').forEach(b => { b.setAttribute('aria-controls', 'v-' + b.dataset.view); b.onclick = () => { $('#tabs').classList.remove('open'); $('#more').textContent = 'More'; closeMenu(); setView(b.dataset.view); }; });
function openMenu() { $('#tabs').classList.add('menu'); $('#scrim').classList.add('on'); document.body.classList.add('menu-open'); $('#hamb').setAttribute('aria-expanded', 'true'); $('#hamb').setAttribute('aria-label', 'Close menu'); const on = $('#tabs button.on') || $('#tabs button'); on.focus(); }
function closeMenu() { if (!$('#tabs').classList.contains('menu')) return; $('#tabs').classList.remove('menu'); if (!$('#drawer').classList.contains('on')) $('#scrim').classList.remove('on'); document.body.classList.remove('menu-open'); $('#hamb').setAttribute('aria-expanded', 'false'); $('#hamb').setAttribute('aria-label', 'Open menu'); }
$('#hamb').onclick = () => $('#tabs').classList.contains('menu') ? closeMenu() : openMenu();
addEventListener('keydown', e => { if (e.key === 'Escape' && $('#tabs').classList.contains('menu')) { closeMenu(); $('#hamb').focus(); } });
addEventListener('resize', () => { if (innerWidth > 700) closeMenu(); });
$('#more').onclick = () => { const o = $('#tabs').classList.toggle('open'); $('#more').setAttribute('aria-expanded', o); $('#more').textContent = o ? 'Less' : 'More'; };
$('#brand').onclick = e => { e.preventDefault(); setView('rr'); };
$('#theme').onclick = () => { const c = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'; document.documentElement.dataset.theme = c; try { localStorage.setItem('rr-theme', c); } catch (e) {} renderView(); };
$('#sl-open').onclick = openSL; $('#sl-close').onclick = closeSL; $('#scrim').onclick = () => { closeSL(); closeMenu(); };
$('#sl-clear').onclick = () => { S.sl = []; try { localStorage.setItem('rr-sl', '[]'); } catch (e) {} renderSL(); renderView(); };
$('#sl-csv').onclick = () => {
  if (!S.sl.length) return toast('Shortlist is empty');
  const rs = S.sl.map(slRow), head = 'Player,Role,Last IPL side,Report rating,Tier,Status\n';
  const csv = head + rs.map(r => [r.name, r.role === 'bat' ? 'Batter' : 'Bowler', r.team, r.rating ?? '', r.tier, r.status].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'rr-pressure-shortlist.csv'; a.click();
};
$('#sl-link').onclick = () => { if (!S.sl.length) return toast('Shortlist is empty'); copy(location.href.split('#')[0] + '#rank?r=' + S.role + '&sl=' + S.sl.join('.'), 'Shortlist link copied'); };
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(renderView, 200); });
fromHash(); bindFilters(); bindSearch(); paintFilters(); renderSL(); sync(false); applyView();
})();
