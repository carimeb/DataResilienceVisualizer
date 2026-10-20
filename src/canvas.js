// SVG renderer: turns (model, evaluation, layout) into markup. No geometry decisions here; those live in layout.js.
import { layout, route, stub, roundedPath, opLabelBoxes, G } from './layout.js';
import { regionPriority, LIMITS } from './engine.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const PILL_MAX_W = 76;
const pillWidth = (text) => Math.min(PILL_MAX_W, Math.round(text.length * 5.9 + 14));

// Text that must never overflow its slot gets textLength when the estimate is close to the limit.
function fitText(text, x, y, maxW, cls, anchor = 'middle', charW = 5.9) {
  const est = text.length * charW;
  const fit = est > maxW ? ` textLength="${maxW}" lengthAdjust="spacingAndGlyphs"` : '';
  return `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}"${fit}>${esc(text)}</text>`;
}

function button({ x, y, w, h, label, act, region, cls = '', disabled = false, title = '' }) {
  return `<g class="sbtn ${cls}${disabled ? ' disabled' : ''}" data-act="${act}" data-region="${region}" role="button" tabindex="${disabled ? -1 : 0}" aria-disabled="${disabled}" aria-label="${esc(title || label)}">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/>
    ${fitText(label, x + w / 2, y + h / 2 + 4, w - 12, 'sbtn-text', 'middle', 6.3)}
  </g>`;
}

function stepper({ x, y, label, value, act, region, canMinus, canPlus, t }) {
  return `<g class="stepper">
    ${fitText(label, x, y + 14, 58, 'stepper-label', 'start', 6.2)}
    ${button({ x: x + 62, y, w: 20, h: 20, label: '−', act: `${act}-minus`, region, cls: 'round', disabled: !canMinus, title: `${label} −` })}
    <text x="${x + 93}" y="${y + 14}" class="stepper-value" text-anchor="middle">${value}</text>
    ${button({ x: x + 104, y, w: 20, h: 20, label: '+', act: `${act}-plus`, region, cls: 'round', disabled: !canPlus, title: `${label} +` })}
  </g>`;
}

// Generic database glyph (cylinder), drawn inside each node.
function dbGlyph(cx, cy) {
  const w = 16, h = 18, ry = 3.5, x = cx - w / 2, y = cy - h / 2;
  return `<g class="glyph">
    <path d="M${x},${y + ry} v${h - 2 * ry} a${w / 2},${ry} 0 0 0 ${w},0 v${-(h - 2 * ry)}"/>
    <ellipse cx="${cx}" cy="${y + ry}" rx="${w / 2}" ry="${ry}"/>
    <path d="M${x},${cy + 1} a${w / 2},${ry} 0 0 0 ${w},0" class="glyph-line"/>
  </g>`;
}

export function nodeLabel(t, model, node) {
  const region = model.regions.find((r) => r.id === node.regionId);
  return t('nodeName', { region: region.name, kind: t(`kind.${node.kind}`), n: node.index + 1 });
}

export function renderCanvas(model, ev, t) {
  const geo = layout(model);
  const byId = Object.fromEntries(ev.nodes.map((n) => [n.id, n]));
  const totalElectable = ev.topo.V;
  const ackSet = new Set(ev.write.ok ? ev.write.ackIds : []);
  const parts = [];

  parts.push(`<defs>
    <marker id="ah-write" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ah-write"/></marker>
    <marker id="ah-read" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ah-read"/></marker>
    <marker id="ah-bad" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ah-bad"/></marker>
    <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" class="hatch-bg"/><line x1="0" y1="0" x2="0" y2="8" class="hatch-line"/></pattern>
  </defs>`);

  // Regions
  geo.regions.forEach((reg, ri) => {
    const r = model.regions[ri];
    const nodesIn = ev.nodes.filter((n) => n.regionId === r.id);
    const cls = ['region', r.outage ? 'is-outage' : '', r.isolated ? 'is-isolated' : '', ri === 0 ? 'is-highest' : ''].join(' ');
    const hx = reg.x + G.LANE_W;
    const removable = model.regions.length > 1 && ri > 0;
    const prio = regionPriority(ri);
    const meta = ri === 0 ? `★ ${t('region.priority', { p: prio })} · ${t('region.highest')}` : t('region.priority', { p: prio });
    parts.push(`<g class="${cls}" data-region="${r.id}">
      <rect x="${reg.x}" y="${reg.y}" width="${reg.w}" height="${reg.h}" rx="12" class="region-card"/>
      ${r.outage ? `<rect x="${reg.x + 1}" y="${reg.gridY}" width="${reg.w - 2}" height="${reg.footerY - reg.gridY}" class="region-hatch" fill="url(#hatch)"/>` : ''}
      <g class="sbtn provider prov-${r.provider.toLowerCase()}" data-act="provider" data-region="${r.id}" role="button" tabindex="0" aria-label="${esc(t('region.providerHint'))}">
        <title>${esc(t('region.providerHint'))}</title>
        <rect x="${hx}" y="${reg.y + 12}" width="48" height="20" rx="4"/>
        <text x="${hx + 24}" y="${reg.y + 26}" text-anchor="middle" class="provider-text">${r.provider === 'AZURE' ? 'Azure' : r.provider}</text>
      </g>
      <g class="sbtn region-name-btn" data-act="rename" data-region="${r.id}" role="button" tabindex="0" aria-label="${esc(t('region.nameHint'))}">
        <title>${esc(t('region.nameHint'))}</title>
        ${fitText(r.name, hx + 56, reg.y + 27, reg.w - G.LANE_W - 56 - 34, 'region-name', 'start', 8.4)}
      </g>
      ${removable ? `<g class="sbtn icon" data-act="remove" data-region="${r.id}" role="button" tabindex="0" aria-label="${esc(t('region.remove'))}"><title>${esc(t('region.remove'))}</title><rect x="${reg.x + reg.w - 30}" y="${reg.y + 12}" width="20" height="20" rx="10"/><text x="${reg.x + reg.w - 20}" y="${reg.y + 26}" text-anchor="middle" class="icon-text">×</text></g>` : ''}
      <text x="${hx}" y="${reg.y + 48}" class="region-meta">${esc(meta)}</text>
      ${ri > 0 ? `<g class="sbtn icon" data-act="up" data-region="${r.id}" role="button" tabindex="0" aria-label="${esc(t('region.up'))}"><title>${esc(t('region.up'))}</title><rect x="${hx + 92}" y="${reg.y + 37}" width="18" height="15" rx="4"/><text x="${hx + 101}" y="${reg.y + 48}" text-anchor="middle" class="icon-text small">▲</text></g>` : ''}
    </g>`);

    // Ribbon on the top edge for outage / partition
    if (r.outage || r.isolated) {
      const label = r.outage ? t('region.outageBadge') : t('region.isolatedBadge');
      const w = Math.round(label.length * 6.4 + 22);
      parts.push(`<g class="ribbon ${r.outage ? 'outage' : 'isolated'}"><rect x="${reg.x + reg.w / 2 - w / 2}" y="${reg.y - 9}" width="${w}" height="18" rx="9"/>${fitText(label, reg.x + reg.w / 2, reg.y + 4, w - 14, 'ribbon-text', 'middle', 6.4)}</g>`);
    }

    // Footer controls
    const fy = reg.footerY;
    const nodeCount = r.electable + r.readOnly;
    parts.push(button({ x: reg.x + 12, y: fy + 10, w: 124, h: 26, label: r.outage ? `↺ ${t('region.restore')}` : `⚡ ${t('region.outage')}`, act: 'outage', region: r.id, cls: r.outage ? 'active danger' : 'danger-ghost' }));
    parts.push(button({ x: reg.x + 148, y: fy + 10, w: 124, h: 26, label: r.isolated ? `⇄ ${t('region.reconnect')}` : `✂ ${t('region.isolate')}`, act: 'isolate', region: r.id, cls: r.isolated ? 'active warn' : 'warn-ghost', disabled: r.outage }));
    parts.push(stepper({ x: reg.x + 12, y: fy + 46, label: t('region.electable'), value: r.electable, act: 'e', region: r.id, canMinus: r.electable > (ri === 0 ? 1 : 0) && nodeCount > 1, canPlus: totalElectable < LIMITS.votingMax, t }));
    parts.push(stepper({ x: reg.x + 148, y: fy + 46, label: t('region.readOnly'), value: r.readOnly, act: 'r', region: r.id, canMinus: r.readOnly > 0 && nodeCount > 1, canPlus: r.readOnly < LIMITS.readOnlyPerRegionMax, t }));

    void nodesIn;
  });

  // Add-region card
  if (geo.addCard) {
    const a = geo.addCard;
    parts.push(`<g class="sbtn add-region" data-act="add-region" data-region="" role="button" tabindex="0" aria-label="${esc(t('region.add'))}">
      <rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="12"/>
      <text x="${a.x + a.w / 2}" y="${a.y + a.h / 2 - 4}" text-anchor="middle" class="add-plus">+</text>
      ${fitText(t('region.add'), a.x + a.w / 2, a.y + a.h / 2 + 18, a.w - 16, 'add-text', 'middle', 6.6)}
    </g>`);
  }

  // Nodes
  for (const p of geo.nodes) {
    const n = byId[p.id];
    const roleKey = n.role === 'SECONDARY' && n.kind === 'readOnly' ? 'READ_ONLY' : n.role;
    const voting = ev.phase === 'electing' && n.alive && n.kind === 'electable' && n.component === ev.majorityComponent && n.role !== 'STEPPING_DOWN';
    const region = model.regions[n.regionIndex];
    const clickable = !region.outage;
    const tip = t('nodeTip', { name: nodeLabel(t, model, n), p: n.priority, role: t(`role.${roleKey}`), action: n.nodeDown ? t('bringBack') : t('takeDown') });
    const label = t(`role.${roleKey}`);
    const pw = pillWidth(label);
    parts.push(`<g class="node role-${n.role.toLowerCase()} kind-${n.kind}${voting ? ' voting' : ''}${ackSet.has(n.id) ? ' acked' : ''}${clickable ? '' : ' locked'}" data-act="node" data-node="${n.id}" role="button" tabindex="${clickable ? 0 : -1}" aria-label="${esc(tip)}">
      <title>${esc(tip)}</title>
      ${n.role === 'PRIMARY' ? `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r + 6}" class="halo"/>` : ''}
      ${voting ? `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r + 5}" class="vote-ring"/>` : ''}
      <circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" class="body"/>
      ${n.alive ? dbGlyph(p.cx, p.cy) : `<path d="M${p.cx - 7},${p.cy - 7} L${p.cx + 7},${p.cy + 7} M${p.cx + 7},${p.cy - 7} L${p.cx - 7},${p.cy + 7}" class="cross"/>`}
      <rect x="${p.cx - pw / 2}" y="${p.pillY}" width="${pw}" height="18" rx="9" class="pill"/>
      ${fitText(label, p.cx, p.pillY + 12.5, pw - 12, 'pill-text', 'middle', 5.9)}
      ${ackSet.has(n.id) ? `<g class="ack"><circle cx="${p.cx + 19}" cy="${p.cy - 17}" r="8"/><path d="M${p.cx + 15},${p.cy - 17} l3,3 l5,-6"/></g>` : ''}
    </g>`);
  }

  // Arrows (after nodes so heads sit on top)
  const arrows = [];
  const labelDefs = [];
  const wOp = ev.write, rOp = ev.read;
  const wText = `${t('write').toUpperCase()} · w:${wOp.w === 'majority' ? '"majority"' : wOp.w}`;
  const rText = `${t('read').toUpperCase()} · ${rOp.rp}`;
  const drawOp = (kind, op, text) => {
    if (op.outcome === 'APP_DOWN') return;
    if (op.targetId && op.ok !== false) {
      const doomed = (op.risks || []).includes('WILL_ROLL_BACK') || (op.risks || []).includes('READS_DOOMED_WRITES');
      arrows.push(`<path d="${roundedPath(route(geo, op.targetId, kind))}" class="arrow ${kind}${doomed ? ' doomed' : ''}" marker-end="url(#ah-${kind})"/>`);
      labelDefs.push({ kind, text, cls: doomed ? 'doomed' : '' });
    } else if (op.targetId && op.outcome === 'BLOCKS') {
      arrows.push(`<path d="${roundedPath(route(geo, op.targetId, kind))}" class="arrow ${kind} blocked" marker-end="url(#ah-bad)"/>`);
      labelDefs.push({ kind, text: `${text} ⏸`, cls: 'blocked' });
    } else {
      const pts = stub(geo, kind);
      const waiting = op.outcome === 'WAITING';
      arrows.push(`<path d="${roundedPath(pts)}" class="arrow ${kind} ${waiting ? 'waiting' : 'blocked'}"/>`);
      const [ex, ey] = pts[pts.length - 1];
      arrows.push(waiting ? `<circle cx="${ex}" cy="${ey + 2}" r="3" class="wait-dot"/>` : `<path d="M${ex - 5},${ey - 3} l10,10 M${ex + 5},${ey - 3} l-10,10" class="x-mark"/>`);
      labelDefs.push({ kind, text: `${text} ${waiting ? '…' : '✕'}`, cls: waiting ? 'waiting' : 'blocked' });
    }
  };
  drawOp('write', wOp, wText);
  drawOp('read', rOp, rText);
  const boxes = labelDefs.length ? opLabelBoxes(geo, labelDefs.map((l) => l.text)) : [];
  const labels = labelDefs.map((l, i) => {
    const b = boxes[i];
    return `<g class="op-label ${l.kind} ${l.cls}"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="9"/>${fitText(l.text, b.x + b.w / 2, b.y + 13, b.w - 12, 'op-label-text', 'middle', 6.1)}</g>`;
  });
  parts.push(`<g class="arrows">${arrows.join('')}</g>`);

  // Application box
  const appRegion = model.regions.find((r) => r.id === model.app);
  const appSub = ev.app.down ? t('appDown') : appRegion ? t('appIn', { region: appRegion.name }) : t('appExternal');
  const a = geo.app;
  parts.push(`<g class="app${ev.app.down ? ' down' : ''}">
    <rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="10"/>
    <text x="${a.cx}" y="${a.y + 21}" text-anchor="middle" class="app-title">${esc(t('appBox'))}</text>
    ${fitText(appSub, a.cx, a.y + 38, a.w - 16, 'app-sub', 'middle', 6.2)}
  </g>`);
  parts.push(labels.join(''));

  return { svg: `<svg viewBox="0 0 ${geo.width} ${geo.height}" width="${geo.width}" height="${geo.height}" class="canvas" role="group" aria-label="${esc(t('title'))}">${parts.join('')}</svg>`, geo };
}
