/*!
 * Gully Chain Night (GN) charts: window.GNCharts. gully-labs/gully-ops sites/_shared/gullychain-night/charts.js
 * Dependency-free SVG: spark, line (with area), bars, stream (live bars), count; optional hover readout (o.tip). Colours come from tokens.css
 * (GNCharts.palette / series(i): emerald, silver, amber; mint highlight; delta(node, v) colours up/down); motion from components.css
 * (off under prefers-reduced-motion). Honest data: fewer than two points draws the `empty` text, never a zero line.
 *   GNCharts.line(el, [1, 4, 3], { height: 160, area: true, label: 'TVL, 30 days' })
 *   GNCharts.bars(el, [{ label: 'Oct 28', value: 12 }], { height: 120, label: 'Transactions per day' })
 *   GNCharts.count(el, 2757, { decimals: 0, prefix: '#' })
 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function el(n, a, p) { var e = document.createElementNS(NS, n); for (var k in a) if (a[k] != null) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  function root(host, w, h, label) {
    host.textContent = ''; host.classList.add('gn-chart');
    return el('svg', { viewBox: '0 0 ' + w + ' ' + h, preserveAspectRatio: 'none', role: 'img', 'aria-label': label || 'Chart' }, host);
  }
  function clean(v) { return (v || []).map(Number).filter(function (x) { return isFinite(x); }); }
  function empty(svg, w, h, text) {
    el('line', { x1: 0, y1: h - 1, x2: w, y2: h - 1, class: 'grid' }, svg);
    if (text) { var t = el('text', { x: w / 2, y: h / 2 + 4, 'text-anchor': 'middle', class: 'empty' }, svg); t.textContent = text; }
  }
  function ys(vals, h, pad, zero) {
    var min = zero ? 0 : Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (max === min) { max += 1; min = Math.max(0, min - 1); }
    return function (v) { return pad + (h - pad * 2) * (1 - (v - min) / (max - min)); };
  }
  function pts(vals, w, h, pad, zero) {
    var y = ys(vals, h, pad, zero), n = vals.length;
    return vals.map(function (v, i) { return [n === 1 ? w / 2 : i * w / (n - 1), y(v)]; });
  }
  function d(p) { return p.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' '); }
  function stroke(path, w) { path.style.setProperty('--gn-len', String(Math.ceil(w * 2.4))); if (!reduced) path.setAttribute('class', path.getAttribute('class') + ' draw'); }

  // hover readout: o.tip(i) returns the text for point/bar i; a guide line (line charts) or a lit bar follows the pointer
  function hover(host, svg, cnt, w, h, o, mark) {
    var N = typeof cnt === 'function' ? cnt : function () { return cnt; };
    if (!o.tip || (typeof cnt !== 'function' && cnt < 1)) return;
    var tip = document.createElement('div'); tip.className = 'gn-tip'; tip.setAttribute('aria-hidden', 'true'); host.appendChild(tip);
    host.style.position = host.style.position || 'relative';
    function at(e) {
      var n = N(); if (n < 1) return;
      var r = svg.getBoundingClientRect(), fx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      var i = n === 1 ? 0 : Math.round(fx * (n - 1)); if (o.bars) i = Math.min(n - 1, Math.floor(fx * n));
      tip.textContent = o.tip(i); tip.classList.add('on');
      var px = o.bars ? (i + 0.5) / n : (n === 1 ? 0.5 : i / (n - 1));
      tip.style.left = Math.max(8, Math.min(r.width - tip.offsetWidth - 8, px * r.width - tip.offsetWidth / 2)) + 'px';
      mark(i, px);
    }
    svg.addEventListener('pointermove', at); svg.addEventListener('pointerdown', at);
    svg.addEventListener('pointerleave', function () { tip.classList.remove('on'); mark(-1); });
  }
  function spark(host, values, o) {
    o = o || {}; var w = o.width || 120, h = o.height || 32, v = clean(values), svg = root(host, w, h, o.label);
    if (v.length < 2) { empty(svg, w, h, o.empty || ''); return; }
    var q = pts(v, w, h, 3), p = el('path', { d: d(q), class: 'ln' }, svg);
    if (o.color) p.style.stroke = o.color;
    stroke(p, w);
    var dot = el('circle', { r: 2.5, class: 'hdot' }, svg);
    hover(host, svg, q.length, w, h, o, function (i) {
      if (i < 0) { dot.classList.remove('on'); return; }
      dot.setAttribute('cx', q[i][0]); dot.setAttribute('cy', q[i][1]); dot.classList.add('on');
    });
  }
  function line(host, values, o) {
    o = o || {}; var w = o.width || 600, h = o.height || 160, v = clean(values), svg = root(host, w, h, o.label);
    for (var g = 1; g <= 3; g++) el('line', { x1: 0, x2: w, y1: (h * g / 4).toFixed(1), y2: (h * g / 4).toFixed(1), class: 'grid' }, svg);
    if (v.length < 2) { empty(svg, w, h, o.empty || 'No data yet'); return; }
    var p = pts(v, w, h, 6, o.zero);
    if (o.area !== false) el('path', { d: d(p) + ' L' + w + ' ' + h + ' L0 ' + h + ' Z', class: 'ar' + (reduced ? '' : ' fade') }, svg);
    var ln = el('path', { d: d(p), class: 'ln' }, svg);
    if (o.color) ln.style.stroke = o.color;
    stroke(ln, w);
    var last = p[p.length - 1];
    el('circle', { cx: last[0].toFixed(1), cy: last[1].toFixed(1), r: 3.5, fill: o.color || 'var(--gn-c1)', class: 'end' }, svg);
    var guide = el('line', { x1: 0, x2: 0, y1: 0, y2: h, class: 'guide' }, svg), dot = el('circle', { r: 4, class: 'hdot' }, svg);
    hover(host, svg, p.length, w, h, o, function (i) {
      if (i < 0) { guide.classList.remove('on'); dot.classList.remove('on'); return; }
      guide.setAttribute('x1', p[i][0]); guide.setAttribute('x2', p[i][0]); dot.setAttribute('cx', p[i][0]); dot.setAttribute('cy', p[i][1]);
      guide.classList.add('on'); dot.classList.add('on');
    });
  }
  function bars(host, rows, o) {
    o = o || {}; var w = o.width || 600, h = o.height || 140, svg = root(host, w, h, o.label);
    rows = (rows || []).filter(function (r) { return isFinite(Number(r.value)); });
    el('line', { x1: 0, y1: h - 0.5, x2: w, y2: h - 0.5, class: 'grid' }, svg);
    if (!rows.length) { empty(svg, w, h, o.empty || 'No data yet'); return; }
    var max = Math.max.apply(null, rows.map(function (r) { return Number(r.value); })) || 1, n = rows.length, gap = Math.min(10, w / n * 0.25), bw = (w - gap * (n - 1)) / n;
    rows.forEach(function (r, i) {
      var bh = Math.max(Number(r.value) > 0 ? 2 : 0, (h - 4) * Number(r.value) / max);
      var b = el('rect', { x: (i * (bw + gap)).toFixed(1), y: (h - bh).toFixed(1), width: bw.toFixed(1), height: bh.toFixed(1), rx: Math.min(4, bw / 3), class: 'br' + (r.hi ? ' c2' : '') + (reduced ? '' : ' grow') }, svg);
      if (!reduced) b.style.animationDelay = (i * 40) + 'ms';
      if (!o.tip) { var t = el('title', {}, b); t.textContent = (r.label || '') + ': ' + (o.format ? o.format(r.value) : r.value); }
    });
    var rects = svg.querySelectorAll('rect');
    o.bars = true;
    hover(host, svg, rows.length, w, h, o, function (i) { for (var k = 0; k < rects.length; k++) rects[k].classList.toggle('on', k === i); });
  }
  // stream: live bars kept between updates. rows [{ key, label, value, hi }], oldest first; o.slots fixes the bar width.
  // A bar is a full-height rect moved by a CSS transform (translate + scaleY from the baseline), so new rows grow in at
  // the right, old rows slide out on the left and changed values ease (components.css .sb; off under reduced motion).
  function stream(host, rows, o) {
    o = o || {}; var w = o.width || 600, h = o.height || 140, st = host.gnStream;
    rows = (rows || []).filter(function (r) { return isFinite(Number(r.value)); });
    if (!st || !host.contains(st.svg)) {
      var svg = root(host, w, h, o.label);
      el('line', { x1: 0, y1: h - 0.5, x2: w, y2: h - 0.5, class: 'grid' }, svg);
      st = host.gnStream = { svg: svg, g: el('g', {}, svg), bars: {}, rows: [], msg: null };
      hover(host, svg, function () { return st.rows.length; }, w, h, { tip: o.tip && function (i) { return o.tip(st.rows[i], i); }, bars: true }, function (i) {
        st.rows.forEach(function (r, k) { var b = st.bars[r.k]; if (b) b.classList.toggle('on', k === i); });
      });
    }
    if (!rows.length) {
      if (!st.msg) { st.msg = el('text', { x: w / 2, y: h / 2 + 4, 'text-anchor': 'middle', class: 'empty' }, st.svg); }
      st.msg.textContent = o.empty || 'No data yet'; return;
    }
    if (st.msg) { st.msg.remove(); st.msg = null; }
    var n = Math.max(o.slots || rows.length, rows.length), gap = Math.min(8, w / n * 0.25), bw = (w - gap * (n - 1)) / n;
    var max = Math.max.apply(null, rows.map(function (r) { return Number(r.value); })) || 1, keep = {}, off = n - rows.length;
    var tf = function (x, k) { return 'translate(' + x.toFixed(1) + 'px, 0px) translate(0px, ' + h + 'px) scale(1, ' + k.toFixed(4) + ') translate(0px, -' + h + 'px)'; };
    st.rows = rows.map(function (r, i) {
      var key = String(r.key != null ? r.key : r.label), b = st.bars[key], x = (off + i) * (bw + gap);
      var k = Math.max(Number(r.value) > 0 ? 2 / h : 0, ((h - 4) / h) * Number(r.value) / max);
      keep[key] = 1;
      if (!b) {
        b = st.bars[key] = el('rect', { x: 0, y: 0, width: bw.toFixed(1), height: h, rx: Math.min(4, bw / 3), class: 'br sb' }, st.g);
        b.style.transform = tf(x, 0); b.getBoundingClientRect();
      }
      b.setAttribute('width', bw.toFixed(1));
      b.setAttribute('class', 'br sb' + (r.hi ? ' c2' : ''));
      b.style.transform = tf(x, k);
      r.k = key; return r;
    });
    Object.keys(st.bars).forEach(function (key) {
      if (keep[key]) return;
      var b = st.bars[key]; delete st.bars[key];
      b.setAttribute('class', 'br sb out'); b.style.transform = tf(-bw - gap, 0);
      setTimeout(function () { b.remove(); }, reduced ? 0 : 800);
    });
  }
  function count(node, to, o) {
    o = o || {}; var dec = o.decimals || 0, pre = o.prefix || '', suf = o.suffix || '';
    var f = function (x) { return pre + Number(x).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; };
    var prev = node.getAttribute('data-v'), from = prev ? Number(prev) : 0; node.setAttribute('data-v', String(to));
    if (reduced || !isFinite(from) || from === to) { node.textContent = f(to); return; }
    var t0 = null, dur = 900;
    function step(t) { if (!t0) t0 = t; var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); node.textContent = f(from + (to - from) * e); if (k < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }
  // GN 2.0 palette (owner-approved, brand kit v4): emerald primary series, silver comparison, mint highlight, amber third
  // series; green/red only for up/down deltas. Values are the tokens, so a page follows tokens.css.
  var PALETTE = { primary: 'var(--gn-c1)', comparison: 'var(--gn-c2)', third: 'var(--gn-c3)', highlight: 'var(--gn-c-highlight)', up: 'var(--gn-up)', down: 'var(--gn-down)' };
  var SERIES = [PALETTE.primary, PALETTE.comparison, PALETTE.third];
  function series(i) { return SERIES[i] || PALETTE.primary; }
  function delta(node, v) { node.classList.remove('gn-up', 'gn-down'); if (v > 0) node.classList.add('gn-up'); else if (v < 0) node.classList.add('gn-down'); }
  window.GNCharts = { spark: spark, line: line, bars: bars, stream: stream, count: count, palette: PALETTE, series: series, delta: delta };
})();
