// ─── TAB 3: MULTI-REGION GLOBAL CLUSTER ──────────────────────────────────────
// A fixed row is one replica set; a fixed column is one region.
const MR_ELECTION_MS = 3000;
const mrElectionTimers = new Map();

function mrInitNodeHealth(cfg) {
  return cfg.shardDist.map(dist => dist.map(cnt => Array(cnt).fill(true)));
}

function mrRegionHealth(ri) {
  const cfg = MR_CFGS[S.mr.config];
  let total = 0, healthy = 0;
  cfg.shardDist.forEach((dist, si) => {
    total += dist[ri];
    healthy += S.mr.nodeHealth[si][ri].filter(Boolean).length;
  });
  return { total, healthy };
}

function mrRegionAllDown(ri) { return mrRegionHealth(ri).healthy === 0; }

function mrFirstHealthyNodeIn(si, ri) {
  return S.mr.nodeHealth[si]?.[ri]?.findIndex(Boolean) ?? -1;
}

function mrIsNodePrimary(si, ri, ni) {
  return !S.mr.shardElecting[si] && S.mr.primaryRegion[si] === ri &&
    S.mr.primaryNode[si] === ni && !!S.mr.nodeHealth[si]?.[ri]?.[ni];
}

function mrShardStatus(si) {
  const dist = MR_CFGS[S.mr.config].shardDist[si];
  const total = dist.reduce((a, b) => a + b, 0);
  const majority = Math.floor(total / 2) + 1;
  const healthyNodes = S.mr.nodeHealth[si].flat().filter(Boolean).length;
  const hasMajority = healthyNodes >= majority;
  const electing = !!S.mr.shardElecting[si];
  const ri = S.mr.primaryRegion[si], ni = S.mr.primaryNode[si];
  const primary = hasMajority && mrIsNodePrimary(si, ri, ni) ? { si, ri, ni } : null;
  return {
    total, majority, healthyNodes, hasMajority, electing, primary,
    down: healthyNodes === 0,
    // Retained for the existing CAP display; UI says NO MAJORITY, not guaranteed reads.
    readOnly: healthyNodes > 0 && !hasMajority,
    writable: !!primary && !electing,
  };
}

function mrClearPrimary(si) {
  S.mr.primaryRegion[si] = -1;
  S.mr.primaryNode[si] = -1;
}

function mrCancelElection(si) {
  const pending = mrElectionTimers.get(si);
  if (pending) clearTimeout(pending.timer);
  mrElectionTimers.delete(si);
  S.mr.shardElecting[si] = false;
}

function mrStartElection(si) {
  if (S.mr.shardElecting[si] || !mrShardStatus(si).hasMajority) return;
  mrClearPrimary(si);
  S.mr.shardElecting[si] = true;
  // Identity guards against a callback from an earlier reset or configuration.
  const pending = {};
  pending.timer = setTimeout(() => {
    if (mrElectionTimers.get(si) === pending) mrCompleteElection(si);
  }, MR_ELECTION_MS);
  mrElectionTimers.set(si, pending);
  log('WARN', 'ELECTION', `Shard ${si + 1}: electing a primary — writes paused`);
}

function mrCompleteElection(si) {
  if (!S.mr.shardElecting[si]) return;
  mrCancelElection(si);
  mrClearPrimary(si);
  const cfg = MR_CFGS[S.mr.config];
  if (mrShardStatus(si).hasMajority) {
    const preferred = cfg.primaryRegion[si];
    const order = [preferred, ...cfg.regions.map((_, ri) => ri).filter(ri => ri !== preferred)];
    const ri = order.find(r => mrFirstHealthyNodeIn(si, r) >= 0);
    S.mr.primaryRegion[si] = ri;
    S.mr.primaryNode[si] = mrFirstHealthyNodeIn(si, ri);
    log('SUCCESS', 'ELECTION', `Shard ${si + 1}: primary elected in ${cfg.regions[ri].name} — writes available`);
  } else {
    log('WARN', 'ELECTION', `Shard ${si + 1}: no majority — cannot elect a primary`);
  }
  mrRefresh();
}

// Every topology change goes through the same quorum checks, including mid-election.
function mrReconcileShard(si) {
  const st = mrShardStatus(si);
  if (!st.hasMajority) {
    mrCancelElection(si);
    mrClearPrimary(si);
  } else if (!st.primary && !st.electing) {
    mrStartElection(si);
  }
}

function mrRefresh() {
  mrRender();
  mrUpdateInfo();
  updateCAP();
}

// ─── Stable diagram geometry ────────────────────────────────────────────────
function mrLayout() {
  const cfg = MR_CFGS[S.mr.config];
  const width = 880, left = 170, gap = 12, rowTop = 138, rowHeight = 108;
  const colWidth = (width - left - 10 - gap * (cfg.regions.length - 1)) / cfg.regions.length;
  const regionX = ri => left + ri * (colWidth + gap);
  const nodes = [];
  for (let si = 0; si < cfg.numShards; si++) {
    let ordinal = 0;
    for (let ri = 0; ri < cfg.regions.length; ri++) {
      const count = cfg.shardDist[si][ri];
      for (let ni = 0; ni < count; ni++) {
        nodes.push({ si, ri, ni, id: `${si}-${ri}-${ni}`, ordinal: ++ordinal,
          x: regionX(ri) + colWidth / 2 + (ni - (count - 1) / 2) * 104,
          y: rowTop + si * rowHeight + 46 });
      }
    }
  }
  return { width, height: rowTop + cfg.numShards * rowHeight + 10,
    left, gap, rowTop, rowHeight, colWidth, regionX, nodes };
}

function mrStatusLabel(st) {
  if (st.down) return { label: 'UNAVAILABLE', color: '#A52A21', bg: '#FDF0EE' };
  if (!st.hasMajority) return { label: 'NO MAJORITY', color: '#92400E', bg: '#FEF3C7' };
  if (st.electing || !st.primary) return { label: 'ELECTING PRIMARY', color: '#92400E', bg: '#FEF3C7' };
  return { label: 'WRITES READY', color: '#00684A', bg: '#E3FCF7' };
}

function mrNodeSVG(n, st) {
  const { x, y, si, ri, ni, id, ordinal } = n;
  const sc = MR_SC[si % MR_SC.length];
  const down = !S.mr.nodeHealth[si][ri][ni];
  const primary = mrIsNodePrimary(si, ri, ni);
  const voting = !down && st.electing;
  const role = down ? 'OFFLINE' : voting ? 'ELECTING' : primary ? 'PRIMARY' : 'SECONDARY';
  const border = down ? '#C0392B' : voting ? '#B26D00' : sc.border;
  const fill = down ? '#FDF0EE' : voting ? '#FEF3C7' : '#FFFFFF';
  const disk = down ? '#FEE2E2' : voting ? '#FCD34D' : primary ? sc.bright : sc.dark;
  const pill = down ? '#FDF0EE' : voting ? '#FEF3C7' : primary ? '#001E2B' : '#FFFFFF';
  const text = down ? '#A52A21' : voting ? '#92400E' : primary ? '#FFFFFF' : '#001E2B';
  const title = `Shard ${si + 1}, node ${ordinal}, ${MR_CFGS[S.mr.config].regions[ri].name}: ${role}. ${down ? 'Restore' : 'Fail'} this node`;
  return `<g data-node="${id}" data-shard="${si}" role="button" tabindex="0" aria-label="${title}"
      onclick="mrToggleNode(${si},${ri},${ni})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();mrToggleNode(${si},${ri},${ni})}" class="mr-node">
    <title>${title}</title>
    <rect x="${x-45}" y="${y-29}" width="90" height="79" rx="8" fill="transparent" class="mr-node-hit"/>
    ${primary ? `<circle cx="${x}" cy="${y}" r="27" fill="${sc.bg}" stroke="${sc.line}" stroke-width="1.4"/>` : ''}
    <rect x="${x-21}" y="${y-21}" width="42" height="42" rx="8" fill="${fill}" stroke="${border}" stroke-width="${primary ? 2.8 : 1.8}"/>
    <circle cx="${x}" cy="${y}" r="14" fill="${disk}"/>
    <text x="${x}" y="${y+4}" text-anchor="middle" font-size="12" font-weight="700" fill="${down ? '#A52A21' : primary || voting ? '#001E2B' : '#FFFFFF'}">${down ? '×' : '{ }'}</text>
    <rect x="${x-42}" y="${y+25}" width="84" height="18" rx="7" fill="${pill}" stroke="${primary ? '#001E2B' : 'none'}"/>
    <text x="${x}" y="${y+38}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${text}">${role}</text>
    <text x="${x}" y="${y+57}" text-anchor="middle" font-size="10.5" fill="#536873">S${si+1} · N${ordinal}</text>
  </g>`;
}

function mrReplicationLinks(si, nodes, st) {
  const sc = MR_SC[si % MR_SC.length];
  const primary = nodes.find(n => st.primary && n.ri === st.primary.ri && n.ni === st.primary.ni);
  const pairs = primary ? nodes.filter(n => n !== primary).map(n => [primary, n]) :
    nodes.flatMap((n, i) => nodes.slice(i + 1).map(other => [n, other]));
  return pairs.map(([source, target]) => {
    const online = S.mr.nodeHealth[si][source.ri][source.ni] && S.mr.nodeHealth[si][target.ri][target.ni];
    const state = !online ? 'offline' : primary ? 'replicating' : 'waiting';
    const color = state === 'offline' ? '#AAB5BA' : state === 'waiting' ? '#B26D00' : sc.line;
    const direction = Math.sign(target.x - source.x);
    const x1 = source.x + direction * 27, x2 = target.x - direction * 28;
    const between = nodes.some(n => n !== source && n !== target && n.x > Math.min(source.x, target.x) && n.x < Math.max(source.x, target.x));
    const y = source.y - (between ? 8 : 0);
    const d = between ? `M${x1},${y} C${x1},${y-48} ${x2},${y-48} ${x2},${y}` : `M${x1},${y} L${x2},${y}`;
    const midX = (x1+x2)/2, midY = y - (between ? 36 : 0);
    const title = state === 'replicating' ? `Shard ${si+1}: oplog replication from N${source.ordinal} to N${target.ordinal}` :
      state === 'offline' ? `Shard ${si+1}: connection unavailable — a member is offline` : `Shard ${si+1}: members connected; election in progress`;
    return `<g class="mr-link"><title>${title}</title>
      <path data-shard="${si}" data-source="${source.id}" data-target="${target.id}" data-link-state="${state}"
        d="${d}" fill="none" stroke="${color}" stroke-width="${state === 'offline' ? 1.6 : 2}"
        stroke-dasharray="${state === 'offline' ? '3 6' : '6 4'}" ${state === 'replicating' ? `marker-end="url(#mr-arrow-${si})"` : ''}/>
      ${state === 'offline' ? `<circle cx="${midX}" cy="${midY}" r="6" fill="#FFFFFF"/><path d="M${midX-3},${midY-3} l6,6 m0,-6 l-6,6" stroke="#83939B" stroke-width="1.5"/>` : ''}
    </g>`;
  }).join('');
}

function mrRender() {
  const container = $('mr-svg-container');
  if (!container) return;
  const cfg = MR_CFGS[S.mr.config];
  const g = mrLayout();
  const statuses = cfg.shardDist.map((_, si) => mrShardStatus(si));
  let svg = `<svg viewBox="0 0 ${g.width} ${g.height}" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Shards in fixed rows and regions in fixed columns" style="font-family:'Lexend Deca',sans-serif;width:100%;display:block"><defs>`;
  cfg.shardDist.forEach((_, si) => {
    svg += `<marker id="mr-arrow-${si}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${MR_SC[si].line}"/></marker>`;
  });
  svg += '</defs>';

  cfg.regions.forEach((reg, ri) => {
    const { healthy, total } = mrRegionHealth(ri);
    const down = S.mr.regionDown[ri], offline = healthy === 0;
    const label = down ? 'REGION OFFLINE' : `${healthy}/${total} nodes online`;
    const x = g.regionX(ri), cx = x + g.colWidth/2;
    svg += `<g data-region="${ri}"><rect x="${x}" y="8" width="${g.colWidth}" height="${g.height-12}" rx="10" fill="${offline ? '#FFF7F6' : '#FAFBFC'}" stroke="${offline ? '#DFACA7' : '#D5DDE0'}" stroke-dasharray="5 4"/>
      <text x="${cx}" y="28" text-anchor="middle" font-size="14" font-weight="700" fill="#001E2B">${reg.name}</text>
      <text x="${cx}" y="46" text-anchor="middle" font-size="10.5" fill="${down ? '#A52A21' : '#536873'}">${reg.short} · ${label}</text>`;
    if (S.mr.config !== '3r1b') {
      const si = cfg.primaryRegion.indexOf(ri), st = statuses[si];
      const route = down ? 'Backend offline' : st.writable ? `S${si+1} → ${cfg.regions[st.primary.ri].short}` : `S${si+1} · writes paused`;
      svg += `<rect x="${x+9}" y="65" width="${g.colWidth-18}" height="47" rx="7" fill="#FFFFFF" stroke="${down ? '#DFACA7' : '#B9C6CC'}"/>
        <text x="${cx}" y="83" text-anchor="middle" font-size="11" font-weight="600" fill="${down ? '#A52A21' : '#001E2B'}">Backend → mongos</text>
        <text x="${cx}" y="101" text-anchor="middle" font-size="11" fill="${down ? '#A52A21' : st.writable ? '#00684A' : '#92400E'}">${route}</text>`;
    }
    svg += '</g>';
  });
  if (S.mr.config === '3r1b') {
    svg += `<rect x="${g.left+9}" y="65" width="${g.width-g.left-28}" height="47" rx="7" fill="#FFFFFF" stroke="#B9C6CC"/>
      <text x="${(g.left+g.width-10)/2}" y="83" text-anchor="middle" font-size="12" font-weight="600" fill="#001E2B">One application backend → mongos</text>
      <text x="${(g.left+g.width-10)/2}" y="101" text-anchor="middle" font-size="11" fill="#536873">Routes writes to the current primary of each shard</text>`;
  }
  svg += `<text x="12" y="28" font-size="12" font-weight="700" fill="#536873">SHARD / QUORUM</text>
    <text x="12" y="48" font-size="11" fill="#536873">One row = one replica set</text>
    <text x="${g.left+8}" y="130" font-size="10.5" fill="#536873">Dashed arrows below show replication within each shard</text>`;

  statuses.forEach((st, si) => {
    const top = g.rowTop + si*g.rowHeight, sc = MR_SC[si], state = mrStatusLabel(st);
    svg += `<g data-shard-row="${si}">
      <line x1="8" y1="${top}" x2="${g.width-10}" y2="${top}" stroke="#D5DDE0"/>
      <rect x="9" y="${top+14}" width="4" height="78" rx="2" fill="${sc.line}"/>
      <text x="23" y="${top+30}" font-size="16" font-weight="700" fill="#001E2B">Shard ${si+1}</text>
      <text x="23" y="${top+47}" font-size="11" fill="#536873">Zone: ${cfg.shardZones[si]}</text>
      <rect x="20" y="${top+57}" width="143" height="21" rx="6" fill="${state.bg}"/>
      <text x="91.5" y="${top+71}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${state.color}">${state.label}</text>
      <text x="23" y="${top+94}" font-size="10.5" fill="#536873">${st.healthyNodes}/${st.total} online · quorum ${st.majority}</text>`;
    const nodes = g.nodes.filter(n => n.si === si);
    svg += mrReplicationLinks(si, nodes, st);
    nodes.forEach(n => { svg += mrNodeSVG(n, st); });
    svg += '</g>';
  });
  svg += '</svg>';
  const focusId = document.activeElement?.getAttribute?.('data-node');
  container.innerHTML = svg;
  if (focusId) container.querySelector?.(`[data-node="${focusId}"]`)?.focus();
}

function mrUpdateInfo() {
  const cfg = MR_CFGS[S.mr.config];
  const lbl = $('mr-config-label'); if (lbl) lbl.textContent = cfg.label;
  const desc = $('mr-pattern-desc'); if (desc) desc.innerHTML = cfg.desc;
  const b2r = $('mr-2r-banner'); if (b2r) b2r.style.display = S.mr.config === '2r2b' ? 'block' : 'none';
  const statuses = cfg.shardDist.map((_, si) => mrShardStatus(si));
  const ready = statuses.filter(st => st.writable).length;
  const summary = $('mr-status-summary');
  if (summary) summary.textContent = `${ready}/${cfg.numShards} shards ready for writes`;
  const messages = [];
  const list = test => statuses.map((st, si) => test(st) ? si+1 : null).filter(Boolean).join(', ');
  const unavailable = list(st => st.down), noMajority = list(st => st.readOnly), electing = list(st => st.electing);
  if (unavailable) messages.push(`Shard ${unavailable}: no members online.`);
  if (noMajority) messages.push(`Shard ${noMajority}: no majority; no writes. Secondary reads depend on read preference and read concern.`);
  if (electing) messages.push(`Shard ${electing}: electing a primary; writes paused.`);
  const info = $('mr-status-detail');
  if (info) info.textContent = messages.join(' ') || 'Each shard has a primary and a majority. Follow its arrows to the secondaries.';
  const kb = $('mr-kill-btns');
  if (kb) {
    const focusRegion = document.activeElement?.getAttribute?.('data-region-control');
    const focusAction = document.activeElement?.getAttribute?.('data-action');
    kb.innerHTML = cfg.regions.map((reg, ri) => {
      const h = mrRegionHealth(ri);
      return `<div class="mr-region-control"><div><strong>${reg.short}</strong><span>${h.healthy}/${h.total} nodes online</span></div>
        <div class="btn-row">${h.healthy > 0 ? `<button type="button" class="btn btn-d" data-region-control="${ri}" data-action="fail" onclick="mrKillRegion(${ri})" aria-label="Fail region ${reg.short}">↓ Fail region</button>` : ''}
        ${h.healthy < h.total ? `<button type="button" class="btn btn-g" data-region-control="${ri}" data-action="restore" onclick="mrReviveRegion(${ri})" aria-label="Restore region ${reg.short}">↑ Restore</button>` : ''}</div></div>`;
    }).join('');
    if (focusRegion != null) {
      const next = kb.querySelector?.(`[data-region-control="${focusRegion}"][data-action="${focusAction}"]`) ||
        kb.querySelector?.(`[data-region-control="${focusRegion}"]`);
      next?.focus();
    }
  }
}

function mrToggleNode(si, ri, ni) {
  const cfg = MR_CFGS[S.mr.config];
  const healthy = !S.mr.nodeHealth[si][ri][ni];
  S.mr.nodeHealth[si][ri][ni] = healthy;
  if (healthy) S.mr.regionDown[ri] = false;
  log(healthy ? 'SUCCESS' : 'ERROR', 'RS', `Shard ${si+1}: member in ${cfg.regions[ri].name} ${healthy ? 'restored' : 'offline'}`);
  mrReconcileShard(si);
  mrRefresh();
}

function mrKillRegion(ri) {
  const cfg = MR_CFGS[S.mr.config];
  S.mr.regionDown[ri] = true;
  for (let si = 0; si < cfg.numShards; si++) S.mr.nodeHealth[si][ri].fill(false);
  log('ERROR', 'ATLAS', `Region ${cfg.regions[ri].name} offline`);
  for (let si = 0; si < cfg.numShards; si++) mrReconcileShard(si);
  mrRefresh();
}

function mrReviveRegion(ri) {
  const cfg = MR_CFGS[S.mr.config];
  S.mr.regionDown[ri] = false;
  for (let si = 0; si < cfg.numShards; si++) S.mr.nodeHealth[si][ri].fill(true);
  log('SUCCESS', 'ATLAS', `Region ${cfg.regions[ri].name} restored — members rejoin their replica sets`);
  for (let si = 0; si < cfg.numShards; si++) mrReconcileShard(si);
  mrRefresh();
}

function mrInitialize() {
  for (const si of mrElectionTimers.keys()) mrCancelElection(si);
  const cfg = MR_CFGS[S.mr.config];
  S.mr.nodeHealth = mrInitNodeHealth(cfg);
  S.mr.primaryRegion = [...cfg.primaryRegion];
  S.mr.primaryNode = Array(cfg.numShards).fill(0);
  S.mr.shardElecting = Array(cfg.numShards).fill(false);
  S.mr.regionDown = Array(cfg.regions.length).fill(false);
}

function mrReconfigure() {
  const sel = $('mr-config'); if (!sel) return;
  S.mr.config = sel.value;
  mrInitialize();
  log('INFO', 'ATLAS', `Pattern: ${MR_CFGS[S.mr.config].label}`);
  mrRefresh();
}

function mrReset() {
  mrInitialize();
  log('SUCCESS', 'ATLAS', 'All members restored to the initial topology');
  mrRefresh();
}
