/* Motion layer: entrances, scroll reveals, count-ups, chart choreography, tab indicator.
   Everything is skipped when the user prefers reduced motion. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = s => document.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const easeOut = t => 1 - Math.pow(1 - t, 4);

  /* ---- chart choreography: bars grow in sequence, lines draw ---- */
  if (window.Chart) {
    Chart.defaults.animation = reduce ? false : {
      duration: 900, easing: 'easeOutQuart',
      delay: ctx => (ctx.type === 'data' && ctx.mode === 'default') ? Math.min(ctx.dataIndex, 14) * 45 + ctx.datasetIndex * 120 : 0
    };
    if (!reduce) Chart.defaults.transitions.active = { animation: { duration: 250 } };
  }
  if (reduce) { document.documentElement.classList.add('rm'); return; }
  document.documentElement.classList.add('motion');

  /* ---- count-up numbers ---- */
  const NUM = /^([^\d−-]*)([−-]?)(\d[\d,]*(?:\.\d+)?)(.*)$/s;
  function countUp(el) {
    if (el.children.length) return;
    const txt = el.textContent.trim(), m = txt.match(NUM);
    if (!m) return;
    const [, pre, sign, num, post] = m, dec = (num.split('.')[1] || '').length, comma = num.includes(',');
    const to = parseFloat(num.replace(/,/g, '')) * (sign ? -1 : 1);
    const from = el.dataset.v != null && el.dataset.txt !== txt ? parseFloat(el.dataset.v) : (el.dataset.txt === txt ? to : 0);
    el.dataset.v = to; el.dataset.txt = txt;
    if (from === to) return;
    const t0 = performance.now(), dur = 900;
    const fmt = v => { const s = Math.abs(v).toFixed(dec); return pre + (v < 0 ? (sign || '−') : '') + (comma ? Number(s).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : s) + post; };
    cancelAnimationFrame(el._raf);
    const step = now => { const k = Math.min(1, (now - t0) / dur); el.textContent = k < 1 ? fmt(from + (to - from) * easeOut(k)) : txt; if (k < 1) el._raf = requestAnimationFrame(step); };
    el._raf = requestAnimationFrame(step);
  }
  const COUNT = '.view.on .big, .view.on .gap b, .view.on .tile b, .view.on #g-num, .view.on .wi .t b, .view.on .kn .gain';

  /* ---- scroll reveal ---- */
  const io = new IntersectionObserver(es => {
    let i = 0;
    es.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target; io.unobserve(el);
      el.style.transitionDelay = (i++ * 70) + 'ms';
      el.classList.add('in');
      setTimeout(() => { el.style.transitionDelay = ''; }, 900 + i * 70);
      $$('.big, .gap b, .tile b, #g-num', el).forEach(countUp);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  function stage(view) {
    const sel = '.card, .gap, .step, .howto > .card, .tile';
    $$(sel, view).forEach(el => { el.classList.remove('in'); el.classList.add('rv'); io.observe(el); });
  }

  /* ---- table rows ripple ---- */
  function ripple(view) {
    $$('tbody', view).forEach(tb => $$('tr', tb).slice(0, 24).forEach((tr, i) => { tr.style.animationDelay = (i * 28) + 'ms'; tr.classList.remove('row-in'); void tr.offsetWidth; tr.classList.add('row-in'); }));
  }

  /* ---- sliding tab indicator ---- */
  const tabs = $('#tabs'), ind = document.createElement('span');
  ind.className = 'tab-ind'; tabs && tabs.appendChild(ind);
  function moveInd(instant) {
    const on = tabs && tabs.querySelector('button.on');
    if (!on || innerWidth <= 700) { ind.style.opacity = 0; return; }
    if (instant) ind.style.transition = 'none';
    ind.style.opacity = 1;
    ind.style.width = (on.offsetWidth - 24) + 'px';
    ind.style.transform = `translateX(${on.offsetLeft + 12}px)`;
    if (instant) requestAnimationFrame(() => { ind.style.transition = ''; });
  }
  addEventListener('resize', () => moveInd(true));

  /* ---- star pop ---- */
  let popKey = null;
  document.addEventListener('pointerdown', e => { const s = e.target.closest('[data-star],#p-star'); popKey = s ? (s.dataset.star || 'hero') : null; }, true);

  /* ---- render hook from app.js ---- */
  let lastView = null, first = true;
  document.addEventListener('rr:render', e => {
    const view = $('.view.on'); if (!view) return;
    const changed = e.detail.view !== lastView; lastView = e.detail.view;
    moveInd(first);
    if (changed) { view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); stage(view); ripple(view); }
    else ripple(view);
    requestAnimationFrame(() => $$(COUNT).forEach(el => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0 && (!el.closest('.rv') || el.closest('.rv.in'))) countUp(el); }));
    if (popKey) { const t = popKey === 'hero' ? $('#p-star') : $(`[data-star="${popKey}"]`); if (t) { t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop'); } popKey = null; }
    first = false;
  });

  /* ---- intro ---- */
  document.documentElement.classList.add('mo-intro');
  addEventListener('load', () => setTimeout(() => document.documentElement.classList.remove('mo-intro'), 900));

  /* ---- magnetic hover glow on cards (pointer devices only) ---- */
  if (matchMedia('(hover: hover)').matches) {
    document.addEventListener('pointermove', e => {
      const c = e.target.closest && e.target.closest('.gap, .panel, .rr-hero, .howto .card, .step');
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      c.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    }, { passive: true });
  }
})();
