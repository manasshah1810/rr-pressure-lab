(() => {
const D = window.RR_DATA, R = window.RR_REPORT;
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const YEARS = [2022, 2023, 2024, 2025, 2026], PHASES = ['Powerplay', 'Middle', 'Death'];
const PL = D.players;
const repBy = {}; R.players.forEach(p => { repBy[p.type + p.id] = p; });

const S = {
  view: 'overview', role: 'bat', cls: 'all', years: new Set(YEARS), phases: new Set(PHASES), min: 300,
  sel: { bat: R.players.find(p => p.type === 'bat').id, bowl: R.players.find(p => p.type === 'bowl').id },
  metric: 0, sort: { k: 'lift', asc: false }, cmp: { bat: [], bowl: [] }
};
try { const v = localStorage.getItem('rr-view'); if (v) S.view = v; } catch (e) {}

/* ---------- helpers ---------- */
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const fmt = (v, d = 1) => v == null || !isFinite(v) ? '—' : v.toFixed(d);
const sgn = (v, d = 1) => v == null || !isFinite(v) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
const initials = n => n.split(' ').map(w => w[0]).slice(0, 2).join('');
const isRR = s => /\bRR\b|Rajasthan/.test(s || '');
const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), 1600); };
const charts = {};
function chart(id, cfg) { if (charts[id]) charts[id].destroy(); const el = document.getElementById(id); if (!el) return; charts[id] = new Chart(el, cfg); return charts[id]; }

/* metrics on an aggregate bucket {b,r,o,d,x,w} */
const M = {
  bat: [
    { k: 'sr', l: 'Strike rate', f: a => a.b ? a.r / a.b * 100 : null, d: 1, hi: true },
    { k: 'dot', l: 'Dot %', f: a => a.b ? a.d / a.b * 100 : null, d: 1, hi: false },
    { k: 'bnd', l: 'Boundary %', f: a => a.b ? a.x / a.b * 100 : null, d: 1, hi: true },
    { k: 'avg', l: 'Average', f: a => a.o ? a.r / a.o : (a.r || null), d: 1, hi: true },
  ],
  bowl: [
    { k: 'econ', l: 'Economy', f: a => a.b ? a.r / a.b * 6 : null, d: 2, hi: false },
    { k: 'dot', l: 'Dot %', f: a => a.b ? a.d / a.b * 100 : null, d: 1, hi: true },
    { k: 'bnd', l: 'Boundary %', f: a => a.b ? a.x / a.b * 100 : null, d: 1, hi: false },
    { k: 'wk', l: 'Balls per wicket', f: a => a.o ? a.b / a.o : null, d: 1, hi: false },
  ]
};
const blank = () => ({ b: 0, r: 0, o: 0, d: 0, x: 0, w: 0 });
const add = (a, r) => { a.b += r[5]; a.r += r[6]; a.o += r[7]; a.d += r[8]; a.x += r[9]; a.w += r[10]; };

function rows(role, o = {}) {
  const yrs = o.years || S.years, ph = o.phases || S.phases, cls = o.cls || S.cls;
  return D[role].filter(r => yrs.has(r[1]) && ph.has(r[3]) && (cls === 'all' || r[2] === cls) && (o.id == null || r[0] === o.id));
}
function aggregate(role, o) {
  const out = {};
  rows(role, o).forEach(r => { const p = out[r[0]] || (out[r[0]] = { id: r[0], hp: blank(), n: blank(), all: blank() }); add(r[4] ? p.hp : p.n, r); add(p.all, r); });
  return out;
}
function table(role) {
  const ms = M[role], main = ms[0];
  return Object.values(aggregate(role)).filter(p => p.all.b >= S.min && p.hp.b >= 20).map(p => {
    const hp = main.f(p.hp), n = main.f(p.n);
    const lift = role === 'bat' ? hp - n : n - hp;
    return { ...p, name: PL[p.id].n, hpm: hp, nm: n, lift, share: p.hp.b / p.all.b * 100, wpa: p.all.w / p.all.b * 100, rep: repBy[role + p.id] };
  });
}

/* ---------- filters ---------- */
function buildFilters() {
  $('#f-year').innerHTML = YEARS.map(y => `<button data-v="${y}" class="on">${y}</button>`).join('');
  $('#f-phase').innerHTML = PHASES.map(y => `<button data-v="${y}" class="on">${y === 'Powerplay' ? 'Powerplay' : y}</button>`).join('');
  $$('#f-role button').forEach(b => b.onclick = () => { S.role = b.dataset.v; S.metric = 0; segOn('#f-role', b); renderAll(); });
  $$('#f-cls button').forEach(b => b.onclick = () => { S.cls = b.dataset.v; segOn('#f-cls', b); renderAll(); });
  const chip = (sel, set, cast) => $$(sel + ' button').forEach(b => b.onclick = () => {
    const v = cast(b.dataset.v);
    if (set.has(v) && set.size === 1) return toast('Keep at least one selected');
    set.has(v) ? set.delete(v) : set.add(v); b.classList.toggle('on'); renderAll();
  });
  chip('#f-year', S.years, Number); chip('#f-phase', S.phases, String);
  $('#f-min').oninput = e => { S.min = +e.target.value; $('#minv').textContent = S.min; renderAll(); };
  $('#reset').onclick = () => {
    S.cls = 'all'; S.years = new Set(YEARS); S.phases = new Set(PHASES); S.min = 300; $('#f-min').value = 300; $('#minv').textContent = 300;
    buildFilters(); segOn('#f-cls', $('#f-cls button')); segOn('#f-role', $(`#f-role [data-v=${S.role}]`)); renderAll(); toast('Filters reset');
  };
}
const segOn = (g, b) => { $$(g + ' button').forEach(x => x.classList.toggle('on', x === b)); };

/* ---------- search ---------- */
function buildSearch() {
  const opts = [];
  ['bat', 'bowl'].forEach(role => { const ids = new Set(D[role].map(r => r[0])); ids.forEach(id => opts.push(`<option value="${PL[id].n} · ${role === 'bat' ? 'batting' : 'bowling'}">`)); });
  $('#plist').innerHTML = opts.join('');
  $('#q').addEventListener('change', e => {
    const m = e.target.value.match(/^(.*) · (batting|bowling)$/); if (!m) return;
    const role = m[2] === 'batting' ? 'bat' : 'bowl';
    const id = +Object.keys(PL).find(k => PL[k].n === m[1]); if (!id) return;
    openPlayer(role, id); e.target.value = '';
  });
}
function openPlayer(role, id) {
  S.role = role; S.sel[role] = id; S.metric = 0;
  segOn('#f-role', $(`#f-role [data-v=${role}]`)); setView('overview'); renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- views ---------- */
function setView(v) {
  S.view = v; try { localStorage.setItem('rr-view', v); } catch (e) {}
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  $$('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + v));
  renderView();
}
function renderAll() { renderView(); }
function renderView() {
  Chart.defaults.color = css('--ink-3'); Chart.defaults.borderColor = css('--line');
  Chart.defaults.font.family = 'Onest, system-ui, sans-serif';
  ({ overview: renderOverview, rank: renderRank, explore: renderExplore, compare: renderCompare, auction: renderAuction, method: renderMethod })[S.view]();
}

/* ---------- PLAYER ---------- */
function renderOverview() {
  const role = S.role, id = S.sel[role], P = PL[id], rep = repBy[role + id], ms = M[role];
  const agg = aggregate(role, { id })[id] || { hp: blank(), n: blank(), all: blank() };
  $('#p-name').textContent = P.n;
  $('#p-team').textContent = rep ? `${role === 'bat' ? 'Batter' : 'Bowler'} #${rep.rank} · ${rep.role} · ${rep.status}` : [P.ipl, P.nat, role === 'bat' ? P.bt : P.wt].filter(Boolean).join(' · ');

  // re-run bars
  const rr = rep ? rep.reruns : null;
  $('#clutchbars').innerHTML = Array.from({ length: 20 }, (_, i) => `<i class="${rr != null && i < Math.round(rr / 5) ? 'on' : ''}"></i>`).join('');
  $('#clutchnum').textContent = rr != null ? rr + '%' : 'n/a';

  const main = ms[0], hp = main.f(agg.hp), nm = main.f(agg.n);
  if (rep) {
    $('#k-main-l').textContent = role === 'bat' ? 'Pressure rating · runs added per 100 pressure balls' : 'Pressure rating · runs saved per 100 pressure balls';
    $('#k-main').textContent = sgn(rep.rating);
    $('#k-delta').className = 'pill ' + rep.tier; $('#k-delta').textContent = rep.tier;
    $('#k-hint').textContent = `Ranked #${rep.rank} of ${role === 'bat' ? R.meta.qualBat : R.meta.qualBowl} qualifiers on ${rep.pb} pressure balls. ${rep.blurb}`;
  } else {
    $('#k-main-l').textContent = `${main.l} on pressure balls (filtered)`;
    $('#k-main').textContent = fmt(hp, main.d);
    const lift = role === 'bat' ? hp - nm : nm - hp;
    $('#k-delta').className = 'pill ' + (lift >= 0 ? 'STRONG' : 'FRINGE'); $('#k-delta').textContent = (lift >= 0 ? '↗ ' : '↘ ') + sgn(lift, main.d) + ' vs normal';
    $('#k-hint').textContent = 'Not in the report top 10, so this view uses the raw ball-by-ball splits only.';
  }
  const st = rep ? rep.stats : {};
  const tiles = role === 'bat' ? [
    ['Pressure SR', rep ? rep.pP : fmt(hp), rep ? `avg batter ${rep.pAvg}` : `normal ${fmt(nm)}`, 'var(--pink)'],
    ['Survives definitions', rep ? `${rep.defs}/14` : '—', 'alt. pressure rules', 'var(--gold)'],
    [rep ? 'Career SR' : 'Pressure balls', rep ? st['Strike rate'] : agg.hp.b, rep ? `${st['Runs']} runs · avg ${st['Average']}` : `of ${agg.all.b} faced`, 'var(--blue-2)'],
    [rep ? 'Matches' : 'Pressure dot %', rep ? st['Matches'] : fmt(ms[1].f(agg.hp)), rep ? `${st['Balls faced']} balls faced` : `normal ${fmt(ms[1].f(agg.n))}`, 'var(--good)'],
  ] : [
    ['Pressure economy', rep ? rep.pP.toFixed(2) : fmt(hp, 2), rep ? `avg bowler ${rep.pAvg.toFixed(2)}` : `normal ${fmt(nm, 2)}`, 'var(--pink)'],
    ['Survives definitions', rep ? `${rep.defs}/14` : '—', 'alt. pressure rules', 'var(--gold)'],
    [rep ? 'Wickets' : 'Pressure balls', rep ? st['Wickets'] : agg.hp.b, rep ? `avg ${st['Average']} · SR ${st['Strike rate']}` : `of ${agg.all.b} bowled`, 'var(--blue-2)'],
    [rep ? 'Career economy' : 'Pressure dot %', rep ? st['Economy'] : fmt(ms[1].f(agg.hp)), rep ? `${st['Overs']} overs · dot ${st['Dot-ball %']}` : `normal ${fmt(ms[1].f(agg.n))}`, 'var(--good)'],
  ];
  $('#tiles').innerHTML = tiles.map(t => `<div class="tile" style="--c:${t[3]}"><p>${t[0]}</p><b>${t[1]}</b><small>${t[2]}</small></div>`).join('');

  // trend
  $('#trend-metric').innerHTML = ms.slice(0, 3).map((m, i) => `<button class="${i === S.metric ? 'on' : ''}" data-i="${i}">${m.l}</button>`).join('');
  $$('#trend-metric button').forEach(b => b.onclick = () => { S.metric = +b.dataset.i; renderOverview(); });
  const m = ms[S.metric];
  const per = YEARS.map(y => aggregate(role, { id, years: new Set([y]) })[id] || { hp: blank(), n: blank() });
  const hpv = per.map(a => a.hp.b >= 6 ? +m.f(a.hp)?.toFixed(2) : null), nv = per.map(a => a.n.b >= 6 ? +m.f(a.n)?.toFixed(2) : null);
  $('#trend-sub').textContent = `${m.l}: pressure balls vs the rest · ${S.cls === 'all' ? 'IPL + T20I' : S.cls}`;
  const W = 'rgba(255,255,255,', grid = W + '.14)';
  chart('trend', {
    data: {
      labels: YEARS.map(String), datasets: [
        { type: 'line', label: 'Pressure', data: hpv, borderColor: '#fff', backgroundColor: W + '.18)', fill: 'origin', tension: .35, pointRadius: 5, pointBackgroundColor: '#fff', pointBorderColor: css('--pink'), pointBorderWidth: 2, borderWidth: 2.5, spanGaps: true, yAxisID: 'y' },
        { type: 'line', label: 'Normal', data: nv, borderColor: W + '.6)', borderDash: [5, 5], tension: .35, pointRadius: 3, pointBackgroundColor: W + '.7)', borderWidth: 1.5, spanGaps: true, yAxisID: 'y' },
        { type: 'bar', label: 'Pressure balls', data: per.map(a => a.hp.b), backgroundColor: W + '.12)', borderRadius: 6, yAxisID: 'y2', barPercentage: .5 },
      ]
    },
    options: {
      maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', align: 'end', labels: { color: '#fff', boxWidth: 10, boxHeight: 10, usePointStyle: true } }, tooltip: tipStyle() },
      scales: {
        x: { grid: { color: grid }, ticks: { color: W + '.85)' }, border: { display: false } },
        y: { grid: { color: grid }, ticks: { color: W + '.75)' }, border: { display: false }, reverse: false },
        y2: { display: false, position: 'right', beginAtZero: true, suggestedMax: Math.max(...per.map(a => a.hp.b)) * 3 }
      }
    }
  });

  // watchlist
  const top = R.players.filter(p => p.type === role);
  $('#watch').innerHTML = top.map(p => `<button class="wi ${p.id === id ? 'on' : ''}" data-id="${p.id}">
    <span class="av" style="background:${p.tier === 'STRONG' ? 'var(--pink)' : p.tier === 'CONTENDER' ? 'var(--blue)' : 'var(--ink-3)'}">${initials(p.name)}</span>
    <span class="t">${p.rank}. ${p.name.split(' ').slice(-1)}<b>${sgn(p.rating)}</b></span><canvas id="sp${p.id}" width="64" height="28"></canvas></button>`).join('');
  $$('#watch .wi').forEach(b => b.onclick = () => { S.sel[role] = +b.dataset.id; renderOverview(); });
  top.forEach(p => {
    const v = YEARS.map(y => { const a = (aggregate(role, { id: p.id, years: new Set([y]) })[p.id] || {}).hp; return a && a.b >= 6 ? ms[0].f(a) : null; });
    const good = role === 'bat' ? (v.at(-1) ?? 0) >= (v.find(x => x != null) ?? 0) : (v.at(-1) ?? 99) <= (v.find(x => x != null) ?? 0);
    chart('sp' + p.id, { type: 'line', data: { labels: YEARS, datasets: [{ data: v, borderColor: good ? css('--good') : css('--bad'), borderWidth: 1.6, pointRadius: v.map((_, i) => i === v.length - 1 ? 2.5 : 0), tension: .4, spanGaps: true }] }, options: { responsive: false, animation: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } } });
  });

  // phase bars
  const phAgg = PHASES.map(ph => (aggregate(role, { id, phases: new Set([ph]) })[id] || { hp: blank() }).hp);
  const tot = phAgg.reduce((s, a) => s + a.b, 0) || 1;
  const cols = [css('--pink'), css('--gold'), css('--ink')];
  $('#phase-sub').textContent = `${tot} pressure balls`;
  $('#phasebars').innerHTML = PHASES.map((ph, i) => { const a = phAgg[i], pc = a.b / tot * 100; return `<div class="pb"><div class="col"><div class="fill" style="height:${Math.max(pc, 4)}%;background:${cols[i]};color:${i === 2 ? css('--frame') : i === 1 ? '#2b1e00' : '#fff'}">${Math.round(pc)}%<small>${ms[0].l.split(' ')[0]} ${fmt(ms[0].f(a), ms[0].d)}</small></div></div><span>${ph}</span></div>`; }).join('');

  // gauge
  const gv = rep ? rep.reruns : Math.round(agg.hp.b / (agg.all.b || 1) * 100);
  $('#g-num').textContent = gv + '%';
  $('#g-sub').textContent = rep ? `top 10 in re-runs · likely #${rep.lo}–#${rep.hi}` : `of balls in pressure moments`;
  chart('gauge', { type: 'doughnut', data: { datasets: [{ data: [gv, 100 - gv], backgroundColor: [css('--good'), css('--card-2')], borderWidth: 0, borderRadius: [20, 0], cutout: '78%', circumference: 220, rotation: -110 }] }, options: { maintainAspectRatio: false, plugins: { tooltip: { enabled: false }, legend: { display: false } }, layout: { padding: { bottom: 30, top: 6 } } } });

  // notes
  if (rep) {
    $('#notes-h').textContent = 'Scouting notes';
    $('#notes').innerHTML = `<div><h4>Why he fits</h4><p class="q">${rep.why.join('. ')}.</p></div><div><h4>How opponents handle him</h4><p>${rep.how}</p></div><div><h4>Caveat</h4><p>${rep.caveat}</p></div>`;
  } else {
    const rs = ms.map(m => [m.l, m.f(agg.hp), m.f(agg.n), m]);
    $('#notes-h').textContent = 'Pressure vs normal';
    $('#notes').innerHTML = rs.map(([l, a, b, m]) => { const better = m.hi ? a > b : a < b; return `<div><h4>${l}</h4><p class="q mono">${fmt(a, m.d)} <span class="${better ? 'up' : 'dn'}">${better ? '▲' : '▼'}</span> <span class="muted">normal ${fmt(b, m.d)}</span></p></div>`; }).join('');
  }

  // knocks
  $('#knocks-card').style.display = rep ? '' : 'none';
  if (rep) {
    $('#knocks-h').textContent = role === 'bat' ? 'Best pressure knocks' : 'Best pressure spells';
    $('#knocks').innerHTML = rep.games.map(g => `<div class="kn"><div class="top2"><div><div class="opp">v ${g.opp}</div><div class="cmp">${g.comp}</div></div><div class="gain">+${g.gain}</div></div>
      <div class="fig">${g.fig}</div><div class="sit">${g.sit}<br>${g.pb} pressure balls</div><span class="res ${g.res === 'no result' ? 'no' : g.res}">${g.res}</span></div>`).join('');
  }
}
function tipStyle() { return { backgroundColor: '#0b0b0d', titleColor: '#fff', bodyColor: '#ddd', borderColor: 'rgba(255,255,255,.1)', borderWidth: 1, padding: 12, cornerRadius: 12, titleFont: { weight: '600' }, bodyFont: { family: 'JetBrains Mono' } }; }

/* ---------- RANKINGS ---------- */
function renderRank() {
  const role = S.role, list = R.players.filter(p => p.type === role);
  $('#takeaways').innerHTML = R.meta.takeaways.map((t, i) => `<div class="card"><b>0${i + 1}</b><p>${t}</p></div>`).join('');
  $('#rk-h').textContent = `Top 10 ${role === 'bat' ? 'batters' : 'bowlers'} by rating`;
  const tierC = t => t === 'STRONG' ? css('--pink') : t === 'CONTENDER' ? css('--blue-2') : css('--ink-3');
  const click = (e, els) => { if (els[0]) openPlayer(role, list[els[0].index].id); };
  chart('rkbar', {
    type: 'bar', data: { labels: list.map(p => p.name), datasets: [{ data: list.map(p => p.rating), backgroundColor: list.map(p => tierC(p.tier)), borderRadius: 8, barPercentage: .7 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, onClick: click, plugins: { legend: { display: false }, tooltip: { ...tipStyle(), callbacks: { label: c => ` ${sgn(c.raw)} · ${list[c.dataIndex].tier} · ${list[c.dataIndex].pb} pressure balls` } } }, scales: { x: { beginAtZero: true, grid: { color: css('--line') } }, y: { grid: { display: false }, ticks: { color: css('--ink') } } } }
  });
  chart('rkrange', {
    data: { labels: list.map(p => p.name), datasets: [
      { type: 'bar', label: 'Likely range', data: list.map(p => [p.lo, p.hi]), backgroundColor: list.map(p => tierC(p.tier) + '55'), borderRadius: 20, barPercentage: .4 },
      { type: 'scatter', label: 'Report rank', data: list.map((p, i) => ({ x: p.rank, y: p.name })), backgroundColor: css('--ink'), pointRadius: 5 } ] },
    options: { indexAxis: 'y', maintainAspectRatio: false, onClick: click, plugins: { legend: { display: false }, tooltip: { ...tipStyle(), callbacks: { label: c => c.datasetIndex ? ` Rank #${c.raw.x}` : ` #${c.raw[0]} to #${c.raw[1]}` } } }, scales: { x: { min: 0, max: 50, title: { display: true, text: 'rank (lower is better)' }, grid: { color: css('--line') } }, y: { type: 'category', grid: { display: false }, ticks: { color: css('--ink') } } } }
  });
  const pk = role === 'bat' ? 'Pressure SR v avg' : 'Pressure econ v avg';
  $('#rktbl thead').innerHTML = `<tr><th>#</th><th>Player</th><th>Role</th><th>2027 status</th><th class="n">Rating</th><th>Tier</th><th class="n">${pk}</th><th class="n">Pressure balls</th><th>Definitions survived</th><th class="n">Re-runs top 10</th></tr>`;
  $('#rktbl tbody').innerHTML = list.map(p => `<tr data-id="${p.id}" class="${isRR(p.status) ? 'rr' : ''}"><td class="n">${p.rank}</td><td><b>${p.name}</b></td><td>${p.role}</td><td>${p.status.replace(' for 2027', '')}</td><td class="n">${sgn(p.rating)}</td><td><span class="tag ${p.tier}">${p.tier}</span></td>
    <td class="n">${role === 'bat' ? p.pP : p.pP.toFixed(2)} <span class="muted">v ${role === 'bat' ? p.pAvg : p.pAvg.toFixed(2)}</span></td><td class="n">${p.pb}</td><td><span class="meter"><i style="width:${p.defs / 14 * 100}%"></i></span>${p.defs}/14</td><td class="n">${p.reruns}%</td></tr>`).join('');
  $$('#rktbl tbody tr').forEach(tr => tr.onclick = () => openPlayer(role, +tr.dataset.id));
}

/* ---------- EXPLORER ---------- */
function renderExplore() {
  const role = S.role, ms = M[role], main = ms[0], T = table(role);
  $('#sc-sub').textContent = role === 'bat' ? 'Strike rate. Above the line = scores faster under pressure. Pink = report top 10.' : 'Economy. Below the line = concedes less under pressure. Pink = report top 10.';
  const vals = T.flatMap(p => [p.hpm, p.nm]).filter(isFinite), lo = Math.floor(Math.min(...vals) - 5), hi = Math.ceil(Math.max(...vals) + 5);
  const bmax = Math.max(...T.map(p => p.hp.b), 1);
  chart('scatter', {
    type: 'scatter', data: { datasets: [
      { label: 'Even', type: 'line', data: [{ x: lo, y: lo }, { x: hi, y: hi }], borderColor: css('--ink-3'), borderDash: [4, 4], pointRadius: 0, borderWidth: 1 },
      { label: 'Players', data: T.map(p => ({ x: +p.nm.toFixed(2), y: +p.hpm.toFixed(2), p })), pointRadius: T.map(p => 3 + p.hp.b / bmax * 9), pointHoverRadius: T.map(p => 5 + p.hp.b / bmax * 9),
        backgroundColor: T.map(p => p.rep ? css('--pink') : p.id === S.sel[role] ? css('--gold') : css('--blue-2') + '66'), borderColor: T.map(p => p.rep ? css('--pink') : 'transparent') } ] },
    options: { maintainAspectRatio: false, onClick: (e, els) => { const el = els.find(x => x.datasetIndex === 1); if (el) openPlayer(role, T[el.index].id); },
      plugins: { legend: { display: false }, tooltip: { ...tipStyle(), filter: c => c.datasetIndex === 1, callbacks: { label: c => { const p = c.raw.p; return ` ${p.name}: ${fmt(p.hpm, main.d)} pressure · ${fmt(p.nm, main.d)} normal · ${p.hp.b} balls`; } } } },
      scales: { x: { min: lo, max: hi, title: { display: true, text: `${main.l}, normal balls` }, grid: { color: css('--line') } }, y: { min: lo, max: hi, title: { display: true, text: `${main.l}, pressure balls` }, grid: { color: css('--line') } } } }
  });
  const L = [...T].filter(p => p.hp.b >= 60).sort((a, b) => b.lift - a.lift).slice(0, 12);
  $('#lift-sub').textContent = `${role === 'bat' ? 'Strike-rate gain' : 'Economy saving'} on pressure balls vs his own normal · 60+ pressure balls`;
  chart('liftbar', { type: 'bar', data: { labels: L.map(p => p.name), datasets: [{ data: L.map(p => +p.lift.toFixed(2)), backgroundColor: L.map(p => p.rep ? css('--pink') : css('--gold')), borderRadius: 6 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, onClick: (e, els) => { if (els[0]) openPlayer(role, L[els[0].index].id); }, plugins: { legend: { display: false }, tooltip: { ...tipStyle(), callbacks: { label: c => ` ${sgn(c.raw, main.d)} · ${L[c.dataIndex].hp.b} pressure balls` } } }, scales: { x: { grid: { color: css('--line') } }, y: { grid: { display: false }, ticks: { color: css('--ink') } } } } });

  const cols = [
    ['name', 'Player', p => `<b>${p.name}</b>${p.rep ? ` <span class="tag ${p.rep.tier}">#${p.rep.rank}</span>` : ''}`],
    ['team', 'Last IPL side', p => PL[p.id].ipl || '<span class="muted">—</span>'],
    ['balls', 'Balls', p => p.all.b, 1], ['hpb', 'Pressure balls', p => p.hp.b, 1],
    ['share', 'Pressure %', p => fmt(p.share) + '%', 1],
    ['nm', `${main.l} normal`, p => fmt(p.nm, main.d), 1], ['hpm', `${main.l} pressure`, p => fmt(p.hpm, main.d), 1],
    ['lift', 'Lift', p => `<span class="${p.lift >= 0 ? 'up' : 'dn'}">${sgn(p.lift, main.d)}</span>`, 1],
    ['dotp', 'Pressure dot %', p => fmt(ms[1].f(p.hp)), 1],
    ['wpa', 'Wins added /100 balls', p => sgn(p.wpa, 2), 1],
  ];
  const key = { name: p => p.name, team: p => PL[p.id].ipl, balls: p => p.all.b, hpb: p => p.hp.b, share: p => p.share, nm: p => p.nm, hpm: p => p.hpm, lift: p => p.lift, dotp: p => ms[1].f(p.hp), wpa: p => p.wpa };
  const k = key[S.sort.k] ? S.sort.k : 'lift';
  T.sort((a, b) => { const x = key[k](a), y = key[k](b); const r = typeof x === 'string' ? x.localeCompare(y) : x - y; return S.sort.asc ? r : -r; });
  $('#tbl-count').textContent = `${T.length} players · min ${S.min} balls · click a header to sort`;
  $('#tbl thead').innerHTML = '<tr>' + cols.map(c => `<th data-k="${c[0]}" class="${c[3] ? 'n' : ''} ${c[0] === k ? 's' + (S.sort.asc ? ' asc' : '') : ''}">${c[1]}</th>`).join('') + '</tr>';
  $('#tbl tbody').innerHTML = T.map(p => `<tr data-id="${p.id}" class="${isRR(PL[p.id].ipl) ? 'rr' : ''}">` + cols.map(c => `<td class="${c[3] ? 'n' : ''}">${c[2](p)}</td>`).join('') + '</tr>').join('') || `<tr><td colspan="10" class="muted">No one qualifies. Lower the minimum balls or widen the filters.</td></tr>`;
  $$('#tbl th').forEach(th => th.onclick = () => { const kk = th.dataset.k; S.sort = { k: kk, asc: S.sort.k === kk ? !S.sort.asc : kk === 'name' }; renderExplore(); });
  $$('#tbl tbody tr[data-id]').forEach(tr => tr.onclick = () => openPlayer(role, +tr.dataset.id));
}

/* ---------- COMPARE ---------- */
function renderCompare() {
  const role = S.role, T = table(role), ms = M[role];
  if (T.length < 2) { $('#cmptbl').innerHTML = '<p class="muted">Not enough players in this filter.</p>'; return; }
  T.sort((a, b) => a.name.localeCompare(b.name));
  const ids = T.map(p => p.id);
  let [a, b] = S.cmp[role];
  if (!ids.includes(a)) a = ids.includes(S.sel[role]) ? S.sel[role] : ids[0];
  if (!ids.includes(b) || b === a) { const r2 = R.players.find(p => p.type === role && p.id !== a && ids.includes(p.id)); b = r2 ? r2.id : ids.find(x => x !== a); }
  S.cmp[role] = [a, b];
  const opt = sel => T.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${p.name}${p.rep ? ' · #' + p.rep.rank : ''}</option>`).join('');
  $('#ca').innerHTML = opt(a); $('#cb').innerHTML = opt(b);
  $('#ca').onchange = e => { S.cmp[role][0] = +e.target.value; renderCompare(); };
  $('#cb').onchange = e => { S.cmp[role][1] = +e.target.value; renderCompare(); };
  const A = T.find(p => p.id === a), B = T.find(p => p.id === b);
  const axes = [
    [`${ms[0].l} (pressure)`, p => ms[0].f(p.hp), ms[0].hi], [`${ms[0].l} (normal)`, p => ms[0].f(p.n), ms[0].hi],
    ['Lift', p => p.lift, true], [`${ms[1].l} (pressure)`, p => ms[1].f(p.hp), ms[1].hi],
    [`${ms[2].l} (pressure)`, p => ms[2].f(p.hp), ms[2].hi], ['Wins added', p => p.wpa, true], ['Pressure balls', p => p.hp.b, true]
  ];
  const pct = (fn, hi, p) => { const v = fn(p), all = T.map(fn).filter(isFinite); const below = all.filter(x => hi ? x < v : x > v).length; return Math.round(below / Math.max(all.length - 1, 1) * 100); };
  const cA = css('--pink'), cB = css('--blue-2');
  chart('radar', { type: 'radar', data: { labels: axes.map(x => x[0]), datasets: [A, B].map((p, i) => ({ label: p.name, data: axes.map(x => pct(x[1], x[2], p)), borderColor: i ? cB : cA, backgroundColor: (i ? cB : cA) + '30', pointBackgroundColor: i ? cB : cA, borderWidth: 2 })) },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { ...tipStyle(), callbacks: { label: c => ` ${c.dataset.label}: ${c.raw}th percentile` } } }, scales: { r: { min: 0, max: 100, ticks: { display: false, stepSize: 25 }, grid: { color: css('--line') }, angleLines: { color: css('--line') }, pointLabels: { color: css('--ink-2'), font: { size: 11 } } } } } });
  const ph = p => PHASES.map(x => { const g = (aggregate(role, { id: p.id, phases: new Set([x]) })[p.id] || { hp: blank() }).hp; return g.b >= 6 ? +ms[0].f(g).toFixed(2) : null; });
  $('#cmpbar-h').textContent = `${ms[0].l} by phase, pressure balls only`;
  chart('cmpbar', { type: 'bar', data: { labels: PHASES, datasets: [A, B].map((p, i) => ({ label: p.name, data: ph(p), backgroundColor: i ? cB : cA, borderRadius: 8, barPercentage: .7 })) }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: tipStyle() }, scales: { y: { grid: { color: css('--line') }, beginAtZero: true }, x: { grid: { display: false } } } } });
  const rowsC = [['Balls', p => p.all.b, true, 0], ['Pressure balls', p => p.hp.b, true, 0], ...ms.map(m => [m.l + ' (pressure)', p => m.f(p.hp), m.hi, m.d]), ...ms.slice(0, 1).map(m => [m.l + ' (normal)', p => m.f(p.n), m.hi, m.d]), ['Lift', p => p.lift, true, 2], ['Wins added /100 balls', p => p.wpa, true, 2],
    ['Report rating', p => p.rep ? p.rep.rating : null, true, 1], ['Re-runs top 10', p => p.rep ? p.rep.reruns : null, true, 0]];
  $('#cmptbl').innerHTML = `<div class="a"><b style="color:${cA}">${A.name}</b></div><div class="m"></div><div class="b"><b style="color:${cB}">${B.name}</b></div>` + rowsC.map(([l, f, hi, d]) => {
    const x = f(A), y = f(B), ok = x != null && y != null && isFinite(x) && isFinite(y);
    const wa = ok && (hi ? x > y : x < y), wb = ok && (hi ? y > x : y < x);
    return `<div class="a ${wa ? 'w' : ''}">${fmt(x, d)}</div><div class="m">${l}</div><div class="b ${wb ? 'w' : ''}">${fmt(y, d)}</div>`;
  }).join('');
}

/* ---------- AUCTION ---------- */
function renderAuction() {
  const role = S.role, list = R.pool[role];
  $('#au-h').textContent = `Best ${role === 'bat' ? 'batters' : 'bowlers'} under pressure in the 2027 auction pool`;
  chart('aubar', { type: 'bar', data: { labels: list.map(p => p.n), datasets: [{ label: 'Rating', data: list.map(p => p.rating), backgroundColor: list.map(p => isRR(p.last) ? css('--pink') : p.tier === 'STRONG' ? css('--gold') : p.tier === 'CONTENDER' ? css('--blue-2') : css('--ink-3')), borderRadius: 8 }] },
    options: { maintainAspectRatio: false, onClick: (e, els) => { const p = els[0] && list[els[0].index]; if (p && p.id) openPlayer(role, p.id); }, plugins: { legend: { display: false }, tooltip: { ...tipStyle(), callbacks: { label: c => { const p = list[c.dataIndex]; return [` Rating ${sgn(p.rating)} · ${p.tier}`, ` Overall #${p.rank} · last ${p.last}`]; } } } }, scales: { y: { grid: { color: css('--line') } }, x: { grid: { display: false }, ticks: { color: css('--ink'), maxRotation: 50, autoSkip: false } } } } });
  $('#autbl thead').innerHTML = `<tr><th>#</th><th>Player</th><th class="n">Overall rank</th><th class="n">Rating</th><th>Tier</th><th class="n">${role === 'bat' ? 'Pressure SR v avg' : 'Pressure econ v avg'}</th><th class="n">Pressure balls</th><th>IPL share</th><th>Last IPL team</th></tr>`;
  $('#autbl tbody').innerHTML = list.map((p, i) => `<tr data-id="${p.id || ''}" class="${isRR(p.last) ? 'rr' : ''}"><td class="n">${i + 1}</td><td><b>${p.n}</b></td><td class="n">#${p.rank} of ${role === 'bat' ? 52 : 66}</td><td class="n">${sgn(p.rating)}</td><td><span class="tag ${p.tier}">${p.tier}</span></td><td class="n">${p.cmp}</td><td class="n">${p.pb}</td><td><span class="meter"><i style="width:${p.ipl}%"></i></span>${p.ipl}%</td><td>${p.last}</td></tr>`).join('');
  $$('#autbl tbody tr').forEach(tr => tr.onclick = () => tr.dataset.id && openPlayer(role, +tr.dataset.id));
}

/* ---------- METHOD ---------- */
function renderMethod() {
  $('#steps').innerHTML = R.meta.steps.map((s, i) => `<div class="step"><b>0${i + 1}</b><h4>${s[0]}</h4><p>${s[1]}</p></div>`).join('');
  const w = R.meta.worked;
  chart('worked', { type: 'bar', data: { labels: ['Average bowler economy, same balls', `${w.name.split(' ')[1]} economy on them`, 'Runs + wickets value /100 balls', 'After small-sample adjustment'], datasets: [{ data: [w.avg, w.econ, w.raw, w.final], backgroundColor: [css('--ink-3'), css('--pink'), css('--gold'), css('--good')], borderRadius: 8, barPercentage: .6 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { ...tipStyle(), callbacks: { label: c => ' ' + c.raw } } }, scales: { x: { beginAtZero: true, grid: { color: css('--line') } }, y: { grid: { display: false }, ticks: { color: css('--ink'), font: { size: 12 } } } } } });
}

/* ---------- boot ---------- */
$$('#tabs button').forEach(b => b.onclick = () => setView(b.dataset.view));
$('#theme').onclick = () => {
  const cur = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = cur; try { localStorage.setItem('rr-theme', cur); } catch (e) {}
  renderView();
};
buildFilters(); buildSearch(); setView(S.view);
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(renderView, 200); });
})();
