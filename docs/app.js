(() => {
  'use strict';

  const MAX_DIGITS = 4;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const els = {
    numberA: document.getElementById('numberA'),
    numberB: document.getElementById('numberB'),
    buildBtn: document.getElementById('buildBtn'),
    playBtn: document.getElementById('playBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    stepBtn: document.getElementById('stepBtn'),
    resetBtn: document.getElementById('resetBtn'),
    exampleBtn: document.getElementById('exampleBtn'),
    randomBtn: document.getElementById('randomBtn'),
    speed: document.getElementById('speed'),
    speedText: document.getElementById('speedText'),
    progressBar: document.getElementById('progressBar'),
    warning: document.getElementById('warning'),
    legend: document.getElementById('legend'),
    stageTitle: document.getElementById('stageTitle'),
    stageDetail: document.getElementById('stageDetail'),
    diagram: document.getElementById('diagram'),
    complexity: document.getElementById('complexity'),
    countChips: document.getElementById('countChips'),
    carryBody: document.getElementById('carryBody'),
    result: document.getElementById('result'),
    resultCheck: document.getElementById('resultCheck'),
    equationPreview: document.getElementById('equationPreview'),
    equalsPreview: document.getElementById('equalsPreview'),
  };

  const colorsA = ['#fb923c', '#34d399', '#fbbf24', '#f472b6'];
  const colorsB = ['#60a5fa', '#a78bfa', '#22d3ee', '#fb7185'];
  const bandColors = ['#fda4af', '#f0abfc', '#a5b4fc', '#7dd3fc', '#67e8f9', '#86efac', '#fde68a'];
  const DEFAULT_A = sanitize(els.numberA.value);
  const DEFAULT_B = sanitize(els.numberB.value);

  let timeline = [];
  let cursor = 0;
  let timer = null;
  let playing = false;
  let current = null;

  function createSvg(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    setAttrs(node, attrs);
    return node;
  }

  function setAttrs(node, attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === undefined || value === null) continue;
      if (key === 'text') node.textContent = value;
      else if (key === 'className') node.setAttribute('class', value);
      else node.setAttribute(key, value);
    }
  }

  function sanitize(value) {
    const cleaned = String(value || '')
      .replace(/[^0-9]/g, '')
      .slice(0, MAX_DIGITS)
      .replace(/^0+(?=\d)/, '');
    return cleaned || '0';
  }

  function queryNumbers() {
    const params = new URLSearchParams(window.location.search);
    const hasA = params.has('a');
    const hasB = params.has('b');
    return {
      hasAny: hasA || hasB,
      aString: hasA ? sanitize(params.get('a')) : DEFAULT_A,
      bString: hasB ? sanitize(params.get('b')) : DEFAULT_B,
    };
  }

  function setInputsFromQuery() {
    const query = queryNumbers();
    els.numberA.value = query.aString;
    els.numberB.value = query.bString;
    return query.hasAny;
  }

  function writeNumberParams(aString, bString) {
    const url = new URL(window.location.href);
    url.searchParams.set('a', aString);
    url.searchParams.set('b', bString);

    const next = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next === currentUrl) return;

    window.history.pushState({ a: aString, b: bString }, '', next);
  }

  function plural(n, singular, pluralWord = `${singular}s`) {
    return n === 1 ? singular : pluralWord;
  }

  function placeName(power) {
    const names = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands', 'hundred-thousands', 'millions'];
    return names[power] || `10^${power}`;
  }

  function placeShort(power) {
    return power === 0 ? 'ones' : `10^${power}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }

  function rgbToHex({ r, g, b }) {
    return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
  }

  function mixColors(a, b, weight = 0.5) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    return rgbToHex({
      r: ca.r * (1 - weight) + cb.r * weight,
      g: ca.g * (1 - weight) + cb.g * weight,
      b: ca.b * (1 - weight) + cb.b * weight,
    });
  }

  function formatResultDigits(productString, groups) {
    const chars = [...productString];
    const offset = chars.length - groups.length;
    return chars.map((char, idx) => {
      const color = bandColors[Math.max(0, idx - offset) % bandColors.length];
      return `<span style="color:${color}">${escapeHtml(char)}</span>`;
    }).join('');
  }

  function computeMultiplication(aString, bString) {
    const aDigits = [...aString].map(Number);
    const bDigits = [...bString].map(Number);
    const bandCount = aDigits.length + bDigits.length - 1;
    const rawCounts = Array(bandCount).fill(0);

    for (let i = 0; i < aDigits.length; i += 1) {
      for (let j = 0; j < bDigits.length; j += 1) {
        rawCounts[i + j] += aDigits[i] * bDigits[j];
      }
    }

    const carryingRightToLeft = [];
    const written = Array(bandCount).fill(0);
    let carry = 0;
    for (let s = bandCount - 1; s >= 0; s -= 1) {
      const total = rawCounts[s] + carry;
      const digit = total % 10;
      const carryOut = Math.floor(total / 10);
      written[s] = digit;
      carryingRightToLeft.push({
        s,
        power: bandCount - 1 - s,
        raw: rawCounts[s],
        carryIn: carry,
        total,
        digit,
        carryOut,
      });
      carry = carryOut;
    }

    const carryPrefix = carry > 0 ? String(carry) : '';
    let productString = `${carryPrefix}${written.join('')}`.replace(/^0+(?=\d)/, '');
    if (!productString) productString = '0';

    const actual = (BigInt(aString) * BigInt(bString)).toString();

    return {
      aDigits,
      bDigits,
      rawCounts,
      carryingRightToLeft,
      written,
      carryPrefix,
      productString,
      actual,
    };
  }

  function unitOffsets(count, gap) {
    if (count <= 0) return [];
    return Array.from({ length: count }, (_, i) => (i - (count - 1) / 2) * gap);
  }

  function makeEllipsePath(cx, cy, rx, ry) {
    const k = 0.5522847498;
    return [
      `M ${cx - rx} ${cy}`,
      `C ${cx - rx} ${cy - ry * k} ${cx - rx * k} ${cy - ry} ${cx} ${cy - ry}`,
      `C ${cx + rx * k} ${cy - ry} ${cx + rx} ${cy - ry * k} ${cx + rx} ${cy}`,
      `C ${cx + rx} ${cy + ry * k} ${cx + rx * k} ${cy + ry} ${cx} ${cy + ry}`,
      `C ${cx - rx * k} ${cy + ry} ${cx - rx} ${cy + ry * k} ${cx - rx} ${cy}`,
    ].join(' ');
  }

  function buildGeometry(calc) {
    const { aDigits, bDigits, rawCounts } = calc;
    const n = aDigits.length;
    const m = bDigits.length;
    const groupGap = 1.56;
    const lineGap = 0.13;
    const margin = 0.82;
    const eU = { x: 92, y: 52 };
    const eV = { x: 90, y: -74 };

    const uGroups = aDigits.map((_, i) => (i - (n - 1) / 2) * groupGap);
    const vGroups = bDigits.map((_, j) => (j - (m - 1) / 2) * groupGap);

    const toXY = (u, v) => ({ x: u * eU.x + v * eV.x, y: u * eU.y + v * eV.y });

    const aLinePositions = aDigits.map((digit, i) => unitOffsets(digit, lineGap).map((off, k) => ({
      u: uGroups[i] + off,
      i,
      k,
      digit,
      color: colorsA[i % colorsA.length],
    })));

    const bLinePositions = bDigits.map((digit, j) => unitOffsets(digit, lineGap).map((off, k) => ({
      v: vGroups[j] + off,
      j,
      k,
      digit,
      color: colorsB[j % colorsB.length],
    })));

    const allU = [];
    aLinePositions.flat().forEach((line) => allU.push(line.u));
    uGroups.forEach((u) => allU.push(u));
    const allV = [];
    bLinePositions.flat().forEach((line) => allV.push(line.v));
    vGroups.forEach((v) => allV.push(v));

    const uMin = Math.min(...allU) - margin;
    const uMax = Math.max(...allU) + margin;
    const vMin = Math.min(...allV) - margin;
    const vMax = Math.max(...allV) + margin;

    const aLines = [];
    aLinePositions.forEach((group) => {
      group.forEach((line) => {
        const p1 = toXY(line.u, vMin);
        const p2 = toXY(line.u, vMax);
        aLines.push({ ...line, p1, p2 });
      });
    });

    const bLines = [];
    bLinePositions.forEach((group) => {
      group.forEach((line) => {
        const p1 = toXY(uMin, line.v);
        const p2 = toXY(uMax, line.v);
        bLines.push({ ...line, p1, p2 });
      });
    });

    const dots = [];
    aLinePositions.forEach((aGroup) => {
      aGroup.forEach((aLine) => {
        bLinePositions.forEach((bGroup) => {
          bGroup.forEach((bLine) => {
            const point = toXY(aLine.u, bLine.v);
            dots.push({
              x: point.x,
              y: point.y,
              i: aLine.i,
              j: bLine.j,
              s: aLine.i + bLine.j,
              color: mixColors(aLine.color, bLine.color, 0.52),
            });
          });
        });
      });
    });

    const bands = rawCounts.map((raw, s) => {
      const pointSet = dots.filter((dot) => dot.s === s);
      const cellCenters = [];
      for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < m; j += 1) {
          if (i + j === s) cellCenters.push(toXY(uGroups[i], vGroups[j]));
        }
      }
      const used = pointSet.length ? pointSet : cellCenters;
      const xs = used.map((p) => p.x);
      const ys = used.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const rx = Math.max(58, (maxX - minX) / 2 + 42);
      const ry = Math.max(50, (maxY - minY) / 2 + 38);
      const labelX = maxX + Math.max(52, rx * 0.48);
      const labelY = cy;
      return {
        s,
        raw,
        power: rawCounts.length - 1 - s,
        color: bandColors[s % bandColors.length],
        dots: pointSet,
        cx,
        cy,
        rx,
        ry,
        minX,
        maxX,
        minY,
        maxY,
        labelX,
        labelY,
      };
    });

    const bandPad = 18;
    const countHalfWidth = 50;
    const countHalfHeight = 38;
    const endpoints = [
      ...aLines.flatMap((line) => [line.p1, line.p2]),
      ...bLines.flatMap((line) => [line.p1, line.p2]),
      ...dots,
      ...bands.flatMap((band) => [
        { x: band.cx - band.rx - bandPad, y: band.cy - band.ry - bandPad },
        { x: band.cx + band.rx + bandPad, y: band.cy + band.ry + bandPad },
        { x: band.labelX - countHalfWidth - bandPad, y: band.labelY - countHalfHeight - bandPad },
        { x: band.labelX + countHalfWidth + bandPad, y: band.labelY + countHalfHeight + bandPad },
      ]),
    ];

    if (!endpoints.length) endpoints.push({ x: -180, y: -100 }, { x: 180, y: 100 });

    const minX = Math.min(...endpoints.map((p) => p.x));
    const maxX = Math.max(...endpoints.map((p) => p.x));
    const minY = Math.min(...endpoints.map((p) => p.y));
    const maxY = Math.max(...endpoints.map((p) => p.y));

    return {
      aLines,
      bLines,
      dots,
      bands,
      uGroups,
      vGroups,
      toXY,
      ranges: { uMin, uMax, vMin, vMax },
      viewBox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
    };
  }

  function addText(parent, text, x, y, attrs = {}) {
    const node = createSvg('text', { x, y, ...attrs });
    node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function renderLegend(aString, bString, calc) {
    const aDigits = calc.aDigits;
    const bDigits = calc.bDigits;
    els.legend.innerHTML = '';

    aDigits.forEach((digit, i) => {
      const power = aDigits.length - 1 - i;
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="swatch" style="background:${colorsA[i % colorsA.length]}"></span>
        <span class="legend-text"><strong>${escapeHtml(aString[i])}</strong> in the first number's ${placeName(power)} place → ${digit} ${plural(digit, 'line')}</span>
      `;
      els.legend.appendChild(item);
    });

    bDigits.forEach((digit, j) => {
      const power = bDigits.length - 1 - j;
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="swatch" style="background:${colorsB[j % colorsB.length]}"></span>
        <span class="legend-text"><strong>${escapeHtml(bString[j])}</strong> in the second number's ${placeName(power)} place → ${digit} ${plural(digit, 'line')}</span>
      `;
      els.legend.appendChild(item);
    });
  }

  function renderSidePanels(aString, bString, calc) {
    const bandCount = calc.rawCounts.length;
    els.countChips.innerHTML = '';
    calc.rawCounts.forEach((raw, s) => {
      const chip = document.createElement('div');
      chip.className = 'count-chip';
      chip.dataset.band = String(s);
      chip.innerHTML = `
        <span class="label">Band ${s + 1} · ${placeName(bandCount - 1 - s)}</span>
        <span class="value" style="color:${bandColors[s % bandColors.length]}">0</span>
      `;
      els.countChips.appendChild(chip);
    });

    els.carryBody.innerHTML = '';
    calc.carryingRightToLeft.forEach((step) => {
      const row = document.createElement('tr');
      row.dataset.band = String(step.s);
      row.innerHTML = `
        <td>${placeName(step.power)}</td>
        <td>${step.raw}</td>
        <td>${step.carryIn}</td>
        <td>${step.total}</td>
        <td><strong>${step.digit}</strong></td>
        <td>${step.carryOut}</td>
      `;
      els.carryBody.appendChild(row);
    });

    els.result.innerHTML = '—';
    els.resultCheck.textContent = '';
    els.equationPreview.textContent = `${aString} × ${bString}`;
    els.equalsPreview.textContent = `= ${calc.actual}`;
  }

  function renderDiagram(aString, bString, calc, geometry) {
    const svg = els.diagram;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const vb = geometry.viewBox;
    const padX = 28;
    const padTop = 46;
    const padBottom = 92;
    svg.setAttribute('viewBox', `${vb.x - padX} ${vb.y - padTop} ${vb.width + padX * 2} ${vb.height + padTop + padBottom}`);

    const defs = createSvg('defs');
    defs.innerHTML = `
      <marker id="arrowHead" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L8,3 z" fill="rgba(251, 191, 36, 0.96)"></path>
      </marker>
      <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="4" result="blur"></feGaussianBlur>
        <feMerge>
          <feMergeNode in="blur"></feMergeNode>
          <feMergeNode in="SourceGraphic"></feMergeNode>
        </feMerge>
      </filter>
    `;
    svg.appendChild(defs);

    const title = createSvg('text', {
      x: vb.x,
      y: vb.y - 14,
      className: 'svg-label show',
      fill: 'rgba(238,244,255,.74)',
      'font-size': '22',
      'font-weight': '900',
    });
    title.textContent = `${aString} × ${bString}`;
    svg.appendChild(title);

    const grid = createSvg('g', { className: 'grid' });
    svg.appendChild(grid);
    const gridStep = 90;
    const startX = Math.floor((vb.x - padX) / gridStep) * gridStep;
    const endX = Math.ceil((vb.x + vb.width + padX) / gridStep) * gridStep;
    const startY = Math.floor((vb.y - padTop) / gridStep) * gridStep;
    const endY = Math.ceil((vb.y + vb.height + padBottom) / gridStep) * gridStep;
    for (let x = startX; x <= endX; x += gridStep) {
      grid.appendChild(createSvg('line', { className: 'grid-line', x1: x, y1: startY, x2: x, y2: endY }));
    }
    for (let y = startY; y <= endY; y += gridStep) {
      grid.appendChild(createSvg('line', { className: 'grid-line', x1: startX, y1: y, x2: endX, y2: y }));
    }

    const groups = {
      curves: createSvg('g', { id: 'curvesLayer' }),
      lineA: createSvg('g', { id: 'firstNumberLines' }),
      lineB: createSvg('g', { id: 'secondNumberLines' }),
      dots: createSvg('g', { id: 'dotsLayer' }),
      labels: createSvg('g', { id: 'labelsLayer' }),
      carry: createSvg('g', { id: 'carryLayer' }),
      final: createSvg('g', { id: 'finalLayer' }),
    };

    svg.appendChild(groups.curves);
    svg.appendChild(groups.lineA);
    svg.appendChild(groups.lineB);
    svg.appendChild(groups.dots);
    svg.appendChild(groups.labels);
    svg.appendChild(groups.carry);
    svg.appendChild(groups.final);

    const lineNodesA = [];
    geometry.aLines.forEach((line) => {
      const node = createSvg('line', {
        className: 'math-line first-line',
        x1: line.p1.x,
        y1: line.p1.y,
        x2: line.p2.x,
        y2: line.p2.y,
        stroke: line.color,
      });
      groups.lineA.appendChild(node);
      lineNodesA.push({ node, line });
    });

    const lineNodesB = [];
    geometry.bLines.forEach((line) => {
      const node = createSvg('line', {
        className: 'math-line second-line',
        x1: line.p1.x,
        y1: line.p1.y,
        x2: line.p2.x,
        y2: line.p2.y,
        stroke: line.color,
      });
      groups.lineB.appendChild(node);
      lineNodesB.push({ node, line });
    });

    const bandNodes = geometry.bands.map((band) => {
      const curve = createSvg('path', {
        className: 'group-curve',
        d: makeEllipsePath(band.cx, band.cy, band.rx, band.ry),
        stroke: band.color,
      });
      groups.curves.appendChild(curve);

      const countGroup = createSvg('g', {
        className: 'count-label',
        transform: `translate(${band.labelX}, ${band.labelY})`,
      });
      countGroup.appendChild(createSvg('rect', {
        className: 'count-bubble',
        x: -50,
        y: -38,
        width: 100,
        height: 76,
        rx: 20,
      }));
      const value = addText(countGroup, '0', 0, -7, { className: 'count-main' });
      addText(countGroup, placeShort(band.power), 0, 23, { className: 'count-place' });
      groups.labels.appendChild(countGroup);

      return { band, curve, countGroup, value, shownDots: 0 };
    });

    const dotNodes = geometry.dots.map((dot) => {
      const node = createSvg('circle', {
        className: 'intersection-dot',
        cx: dot.x,
        cy: dot.y,
        r: 8.4,
        fill: dot.color,
      });
      groups.dots.appendChild(node);
      return { node, dot };
    });

    const digitLabels = [];
    const { toXY, uGroups, vGroups, ranges } = geometry;
    const digitLabelOffset = 0.22;
    calc.aDigits.forEach((digit, i) => {
      const p = toXY(uGroups[i], ranges.vMax + digitLabelOffset);
      const group = createSvg('g', { className: 'svg-label' });
      group.appendChild(createSvg('circle', {
        cx: p.x,
        cy: p.y - 7,
        r: 18,
        fill: colorsA[i % colorsA.length],
        opacity: 0.18,
      }));
      addText(group, `${digit}`, p.x, p.y, {
        'text-anchor': 'middle',
        fill: colorsA[i % colorsA.length],
        'font-size': 26,
        'font-weight': 950,
      });
      groups.labels.appendChild(group);
      digitLabels.push(group);
    });
    calc.bDigits.forEach((digit, j) => {
      const p = toXY(ranges.uMax + digitLabelOffset, vGroups[j]);
      const group = createSvg('g', { className: 'svg-label' });
      group.appendChild(createSvg('circle', {
        cx: p.x,
        cy: p.y - 7,
        r: 18,
        fill: colorsB[j % colorsB.length],
        opacity: 0.18,
      }));
      addText(group, `${digit}`, p.x, p.y, {
        'text-anchor': 'middle',
        fill: colorsB[j % colorsB.length],
        'font-size': 26,
        'font-weight': 950,
      });
      groups.labels.appendChild(group);
      digitLabels.push(group);
    });

    const carryNodes = [];
    calc.carryingRightToLeft.forEach((step) => {
      const source = bandNodes[step.s];
      if (!source) return;
      if (step.carryOut > 0 && step.s > 0) {
        const target = bandNodes[step.s - 1];
        const sx = source.band.labelX - 15;
        const sy = source.band.labelY - 48;
        const tx = target.band.labelX + 15;
        const ty = target.band.labelY + 48;
        const midX = (sx + tx) / 2;
        const path = createSvg('path', {
          className: 'carry-arrow',
          d: `M ${sx} ${sy} C ${midX} ${sy - 58}, ${midX} ${ty + 58}, ${tx} ${ty}`,
          markerEnd: 'url(#arrowHead)',
        });
        groups.carry.appendChild(path);
        const label = createSvg('g', { className: 'carry-label' });
        addText(label, `carry ${step.carryOut}`, midX, (sy + ty) / 2 - 20, { 'text-anchor': 'middle' });
        groups.carry.appendChild(label);
        carryNodes.push({ s: step.s, arrow: path, label, step });
      } else if (step.carryOut > 0 && step.s === 0) {
        const x = source.band.labelX - 88;
        const y = source.band.labelY - 53;
        const label = createSvg('g', { className: 'carry-label' });
        addText(label, `prefix ${step.carryOut}`, x, y, { 'text-anchor': 'middle' });
        groups.carry.appendChild(label);
        carryNodes.push({ s: step.s, arrow: null, label, step });
      }
    });

    const finalGroup = createSvg('g', { className: 'final-svg-label' });
    const finalX = vb.x + vb.width / 2;
    const finalY = vb.y + vb.height + 58;
    addText(finalGroup, `${aString} × ${bString} = ${calc.productString}`, finalX, finalY, { 'text-anchor': 'middle' });
    groups.final.appendChild(finalGroup);

    return {
      lineNodesA,
      lineNodesB,
      dotNodes,
      bandNodes,
      carryNodes,
      digitLabels,
      finalGroup,
    };
  }

  function setStage(title, detail) {
    els.stageTitle.textContent = title;
    els.stageDetail.textContent = detail;
  }

  function clearTimer() {
    if (timer) window.clearTimeout(timer);
    timer = null;
  }

  function setProgress() {
    const pct = timeline.length ? (cursor / timeline.length) * 100 : 0;
    els.progressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  }

  function addTimeline(title, detail, duration, fn) {
    timeline.push({ title, detail, duration, fn });
  }

  function showNode(node) {
    if (node) node.classList.add('show');
  }

  function updateChip(s, count, final = false) {
    const chip = els.countChips.querySelector(`[data-band="${s}"]`);
    if (!chip) return;
    chip.classList.add('show');
    const value = chip.querySelector('.value');
    if (value) value.textContent = String(count);
    if (final) chip.title = `${count} dots in this diagonal band`;
  }

  function buildTimeline(aString, bString, calc, rendered) {
    timeline = [];
    cursor = 0;
    setProgress();

    addTimeline(
      'Ready',
      `Prepared ${aString} × ${bString}. The first number will be drawn as rising lines.`,
      180,
      () => {}
    );

    rendered.digitLabels.forEach((label, idx) => {
      addTimeline(
        'Color key',
        `Showing digit label ${idx + 1}. Each digit has its own color.`,
        120,
        () => showNode(label)
      );
    });

    rendered.lineNodesA.forEach(({ node, line }) => {
      addTimeline(
        'Draw first number',
        `Digit ${line.digit} in the first number: line ${line.k + 1} of ${line.digit}.`,
        72,
        () => showNode(node)
      );
    });

    if (rendered.lineNodesA.length === 0) {
      addTimeline('Draw first number', 'The first number is zero, so it contributes no lines.', 220, () => {});
    }

    rendered.lineNodesB.forEach(({ node, line }) => {
      addTimeline(
        'Draw second number',
        `Digit ${line.digit} in the second number: line ${line.k + 1} of ${line.digit}.`,
        72,
        () => showNode(node)
      );
    });

    if (rendered.lineNodesB.length === 0) {
      addTimeline('Draw second number', 'The second number is zero, so it contributes no lines.', 220, () => {});
    }

    rendered.bandNodes.forEach(({ band, curve }) => {
      addTimeline(
        'Group diagonals',
        `Band ${band.s + 1} is the ${placeName(band.power)} place.`,
        270,
        () => showNode(curve)
      );
    });

    rendered.bandNodes.forEach((bandNode) => {
      const { band, countGroup, value } = bandNode;
      addTimeline(
        'Count intersections',
        `Counting intersections in band ${band.s + 1} (${placeName(band.power)}).`,
        120,
        () => {
          showNode(countGroup);
          value.textContent = '0';
          bandNode.shownDots = 0;
          updateChip(band.s, 0);
        }
      );

      const dots = rendered.dotNodes.filter(({ dot }) => dot.s === band.s);
      dots.forEach(({ node }) => {
        addTimeline(
          'Count intersections',
          `Each dot is one crossing in the ${placeName(band.power)} band.`,
          dots.length > 160 ? 8 : 24,
          () => {
            showNode(node);
            bandNode.shownDots += 1;
            value.textContent = String(bandNode.shownDots);
            updateChip(band.s, bandNode.shownDots);
          }
        );
      });

      addTimeline(
        'Raw band total',
        `${band.raw} ${plural(band.raw, 'dot')} in the ${placeName(band.power)} band before carrying.`,
        230,
        () => {
          value.textContent = String(band.raw);
          updateChip(band.s, band.raw, true);
        }
      );
    });

    calc.carryingRightToLeft.forEach((step) => {
      addTimeline(
        'Carry right to left',
        `${placeName(step.power)}: ${step.raw} dots + carry ${step.carryIn} = ${step.total}; write ${step.digit}, carry ${step.carryOut}.`,
        520,
        () => {
          const row = els.carryBody.querySelector(`[data-band="${step.s}"]`);
          if (row) row.classList.add('show');
          rendered.carryNodes
            .filter((node) => node.s === step.s)
            .forEach((node) => {
              showNode(node.arrow);
              showNode(node.label);
            });
        }
      );
    });

    addTimeline(
      'Final result',
      `The carried digits give ${aString} × ${bString} = ${calc.productString}.`,
      900,
      () => {
        els.result.innerHTML = `${escapeHtml(aString)} × ${escapeHtml(bString)} = ${formatResultDigits(calc.productString, calc.rawCounts)}`;
        els.resultCheck.textContent = calc.productString === calc.actual
          ? 'Matches the ordinary arithmetic product.'
          : `Expected ${calc.actual}; check the diagram.`;
        showNode(rendered.finalGroup);
      }
    );
  }

  function renderAll() {
    pause();
    const aString = sanitize(els.numberA.value);
    const bString = sanitize(els.numberB.value);
    els.numberA.value = aString;
    els.numberB.value = bString;

    const calc = computeMultiplication(aString, bString);
    const geometry = buildGeometry(calc);
    renderLegend(aString, bString, calc);
    renderSidePanels(aString, bString, calc);
    const rendered = renderDiagram(aString, bString, calc, geometry);
    buildTimeline(aString, bString, calc, rendered);

    const totalLines = rendered.lineNodesA.length + rendered.lineNodesB.length;
    const totalDots = rendered.dotNodes.length;
    els.complexity.textContent = `${totalLines} lines · ${totalDots} dots`;
    els.warning.textContent = totalDots > 500
      ? 'Dense diagram: animation may take longer and intersections will overlap. Use smaller digits for teaching.'
      : '';
    els.equationPreview.textContent = `${aString} × ${bString}`;
    els.equalsPreview.textContent = `= ${calc.actual}`;
    setStage('Ready', 'Press Animate to play the full sequence, or Step to inspect it one event at a time.');
    setProgress();

    current = { aString, bString, calc, geometry, rendered };
  }

  function shouldScrollForAnimation() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function scrollToAnimation() {
    if (!shouldScrollForAnimation()) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.requestAnimationFrame(() => {
      els.diagram.closest('.visual-panel').scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  }

  function ensureRenderedFromInputs() {
    const aString = sanitize(els.numberA.value);
    const bString = sanitize(els.numberB.value);
    if (!current || current.aString !== aString || current.bString !== bString) {
      renderAll();
    }
  }

  function play(options = {}) {
    if (!current) renderAll();
    if (options.scroll) scrollToAnimation();
    if (playing) return;
    playing = true;
    runNext();
  }

  function animateFromInputs(options = {}) {
    ensureRenderedFromInputs();
    if (current) writeNumberParams(current.aString, current.bString);
    play(options);
  }

  function pause() {
    playing = false;
    clearTimer();
  }

  function runNext() {
    clearTimer();
    if (!playing) return;
    if (cursor >= timeline.length) {
      playing = false;
      setStage('Complete', 'The final product is shown.');
      setProgress();
      return;
    }
    const item = timeline[cursor];
    cursor += 1;
    item.fn();
    setStage(item.title, item.detail);
    setProgress();
    const speed = Number(els.speed.value) || 1;
    timer = window.setTimeout(runNext, Math.max(4, item.duration / speed));
  }

  function step() {
    if (!current) renderAll();
    pause();
    if (cursor >= timeline.length) {
      setStage('Complete', 'The final product is shown.');
      setProgress();
      return;
    }
    const item = timeline[cursor];
    cursor += 1;
    item.fn();
    setStage(item.title, item.detail);
    setProgress();
  }

  function randomNumber() {
    const length = Math.floor(Math.random() * 3) + 2;
    let result = String(Math.floor(Math.random() * 8) + 1);
    for (let i = 1; i < length; i += 1) {
      result += String(Math.floor(Math.random() * 7) + 1);
    }
    return result;
  }

  function bindEvents() {
    [els.numberA, els.numberB].forEach((input) => {
      input.addEventListener('input', () => {
        const pos = input.selectionStart;
        input.value = input.value.replace(/[^0-9]/g, '').slice(0, MAX_DIGITS);
        try { input.setSelectionRange(pos, pos); } catch (_) { /* ignore unsupported inputs */ }
      });
      input.addEventListener('change', renderAll);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          animateFromInputs({ scroll: true });
        }
      });
    });

    els.buildBtn.addEventListener('click', renderAll);
    els.playBtn.addEventListener('click', () => animateFromInputs({ scroll: true }));
    els.pauseBtn.addEventListener('click', pause);
    els.stepBtn.addEventListener('click', step);
    els.resetBtn.addEventListener('click', renderAll);
    els.exampleBtn.addEventListener('click', () => {
      els.numberA.value = '14';
      els.numberB.value = '27';
      renderAll();
    });
    els.randomBtn.addEventListener('click', () => {
      els.numberA.value = randomNumber();
      els.numberB.value = randomNumber();
      renderAll();
    });
    els.speed.addEventListener('input', () => {
      const speed = Number(els.speed.value);
      els.speedText.textContent = `${Number.isInteger(speed) ? speed.toFixed(1) : String(speed)}×`;
    });

    window.addEventListener('keydown', (event) => {
      if (event.target && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
      if (event.code === 'Space') {
        event.preventDefault();
        playing ? pause() : animateFromInputs();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        step();
      } else if (event.key.toLowerCase() === 'r') {
        renderAll();
      }
    });

    window.addEventListener('popstate', () => {
      const hasQueryNumbers = setInputsFromQuery();
      renderAll();
      if (hasQueryNumbers) play();
    });
  }

  bindEvents();
  const hasQueryNumbers = setInputsFromQuery();
  renderAll();
  if (hasQueryNumbers) play();
})();
