// ─── TAB 3: MULTI-REGION GLOBAL CLUSTER ──────────────────────────────────────

// Build fresh nodeHealth[si][ri][ni]=true for a given config
function mrInitNodeHealth(cfg) {
  return cfg.shardDist.map(dist =>
    dist.map(cnt => Array.from({ length: cnt }, () => true))
  );
}

// True when every node in region ri (across all shards) is down
function mrRegionAllDown(ri) {
  const cfg = MR_CFGS[S.mr.config];
  for (let si = 0; si < cfg.numShards; si++)
    for (let ni = 0; ni < cfg.shardDist[si][ri]; ni++)
      if (S.mr.nodeHealth[si][ri][ni]) return false;
  return true;
}

// True when node (si,ri,ni) is the current PRIMARY of its shard
function mrIsNodePrimary(si, ri, ni) {
  if (S.mr.primaryRegion[si] !== ri) return false;
  const cfg = MR_CFGS[S.mr.config];
  for (let n = 0; n < cfg.shardDist[si][ri]; n++) {
    if (S.mr.nodeHealth[si][ri][n]) return n === ni;
  }
  return false;
}

function mrShardStatus(si) {
  const cfg  = MR_CFGS[S.mr.config];
  const dist = cfg.shardDist[si];
  const total = dist.reduce((a, b) => a + b, 0);
  const majority = Math.floor(total / 2) + 1;
  let healthyNodes = 0;
  for (let ri = 0; ri < cfg.regions.length; ri++)
    for (let ni = 0; ni < dist[ri]; ni++)
      if (S.mr.nodeHealth[si][ri][ni]) healthyNodes++;
  return {
    total, majority, healthyNodes,
    readOnly: healthyNodes > 0 && healthyNodes < majority,
    down:     healthyNodes === 0,
  };
}

// Index of first healthy node for shard si in region r, or -1 if none
function mrFirstHealthyNodeIn(si, r) {
  const cfg = MR_CFGS[S.mr.config];
  if (r < 0 || r >= cfg.regions.length) return -1;
  for (let n = 0; n < cfg.shardDist[si][r]; n++)
    if (S.mr.nodeHealth[si][r][n]) return n;
  return -1;
}

// ── Election banner helpers ───────────────────────────────────────────────────

function mrShowElexBanner(si) {
  const cfg = MR_CFGS[S.mr.config];
  const el = $('mr-elex-banner'), lbl = $('mr-elex-label');
  if (el) el.style.display = 'block';
  if (lbl) lbl.textContent = `Shard ${si + 1} (${cfg.shardZones[si]})`;
  const ro = $('mr-ro-banner');
  if (ro) ro.style.display = 'none';
}

function mrHideElexBanner() {
  const el = $('mr-elex-banner'); if (el) el.style.display = 'none';
}

function mrShowROBanner() {
  const cfg = MR_CFGS[S.mr.config];
  const anyElecting = S.mr.shardElecting.some(Boolean);
  if (anyElecting) return;
  const anyRO = [...Array(cfg.numShards).keys()].some(si => {
    const st = mrShardStatus(si); return st.readOnly || st.down;
  });
  const el = $('mr-ro-banner'); if (!el) return;
  el.style.display = anyRO ? 'block' : 'none';
  if (anyRO) {
    const roShards = [...Array(cfg.numShards).keys()].filter(si => {
      const st = mrShardStatus(si); return st.readOnly || st.down;
    });
    $('mr-ro-title').textContent = `📖 Shard${roShards.length > 1 ? 's' : ''} ${roShards.map(i => `${i + 1}`).join(', ')} in READ-ONLY mode`;
  }
}

function mrHideROBanner() {
  const el = $('mr-ro-banner'); if (el) el.style.display = 'none';
}

function mrUpdateBanners() {
  const anyElecting = S.mr.shardElecting.some(Boolean);
  if (anyElecting) return; // elex banner already shown by mrStartElection
  mrHideElexBanner();
  mrShowROBanner();
}

// ── Election engine (per shard) ───────────────────────────────────────────────

async function mrStartElection(si) {
  if (S.mr.shardElecting[si]) return;
  S.mr.shardElecting[si] = true;
  log('WARN', 'DRIVER', `Shard ${si + 1}: retryable writes active — driver holding all operations`);
  mrShowElexBanner(si);
  mrRender(); mrUpdateInfo(); updateCAP();

  let count = 8;
  $('mr-elex-count').textContent = count;
  await new Promise(resolve => {
    const iv = setInterval(() => {
      if (!S.mr.shardElecting[si]) { clearInterval(iv); resolve(); return; }
      $('mr-elex-count').textContent = --count;
      if (count <= 0) { clearInterval(iv); resolve(); }
    }, 400);
  });
  if (S.mr.shardElecting[si]) mrCompleteElection(si);
}

function mrCompleteElection(si) {
  S.mr.shardElecting[si] = false;
  const cfg    = MR_CFGS[S.mr.config];
  const homeRI = cfg.primaryRegion[si];
  let targetRI = mrFirstHealthyNodeIn(si, homeRI) >= 0 ? homeRI : -1;
  if (targetRI < 0) {
    for (let r = 0; r < cfg.regions.length; r++)
      if (mrFirstHealthyNodeIn(si, r) >= 0) { targetRI = r; break; }
  }
  if (targetRI >= 0) {
    S.mr.primaryRegion[si] = targetRI;
    log('SUCCESS', 'ELECTION', `Shard ${si + 1}: NEW PRIMARY elected in ${cfg.regions[targetRI].name}${targetRI !== homeRI ? ' (temporary — home unavailable)' : ''}`);
    log('SUCCESS', 'DRIVER',   `Shard ${si + 1}: retryable writes resumed — zero data loss`);
  } else {
    S.mr.primaryRegion[si] = -1;
    log('ERROR', 'RS', `Shard ${si + 1}: election failed — no candidates (READ-ONLY)`);
  }
  mrHideElexBanner();
  mrShowROBanner();
  mrRender(); mrUpdateInfo(); updateCAP();
}

// ── SVG helpers (extracted from mrRender) ────────────────────────────────────

// Draw backend→node arrow with WRITES/READ-ONLY label; returns SVG string
function mrArrow(ax1, ay1, ax2, ay2, si, curved) {
  const st     = mrShardStatus(si);
  const ro     = st.readOnly || st.down;
  const stroke = ro ? '#3B82F6' : '#FF9900';
  const marker = ro ? 'url(#arrMRRO)' : 'url(#arrMRO)';
  const lbl    = st.down ? null : ro ? 'READ-ONLY' : 'WRITES';
  const lbg    = ro ? '#EFF6FF'  : '#FFF4E6';
  const ltx    = ro ? '#1E3A8A'  : '#C2410C';

  let out = '';
  if (curved) {
    out += `<path d="M${ax1},${ay1} C${ax1},${ay1 + 28} ${ax2},${ay2 - 28} ${ax2},${ay2}" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-dasharray="5 3" marker-end="${marker}"/>`;
  } else {
    out += `<line x1="${ax1}" y1="${ay1}" x2="${ax2}" y2="${ay2}" stroke="${stroke}" stroke-width="1.8" stroke-dasharray="5 3" marker-end="${marker}"/>`;
  }
  if (lbl) {
    const lx = (ax1 + ax2) / 2, ly = (ay1 + ay2) / 2;
    const lw = ro ? 60 : 42;
    out += `<rect x="${lx - lw/2}" y="${ly - 8}" width="${lw}" height="14" rx="4" fill="${lbg}"/>`;
    out += `<text x="${lx}" y="${ly + 2}" text-anchor="middle" font-size="8" font-weight="700" fill="${ltx}" font-family="Lexend Deca,sans-serif">${lbl}</text>`;
  }
  return out;
}

// Find best target node for a shard to draw an arrow to (PRIMARY first, then any healthy)
// nodePos: the per-column position map built in mrRender; numR: region count
function mrBestTarget(si, preferRi, nodePos, numR) {
  for (const tryRi of [preferRi, ...Array.from({ length: numR }, (_, i) => i)].filter(v => v != null)) {
    const nd = nodePos[tryRi]?.find(n => n.si === si && n.role === 'PRIMARY' && S.mr.nodeHealth[n.si][n.ri][n.ni]);
    if (nd) return nd;
  }
  for (let ri2 = 0; ri2 < numR; ri2++) {
    const nd = nodePos[ri2].find(n => n.si === si && S.mr.nodeHealth[n.si][n.ri][n.ni]);
    if (nd) return nd;
  }
  return null;
}

// Node icon for Tab 3 (shard-coloured, different from Tab 1 mdbNodeIcon)
function mrNodeSVG(cx, cy, si, role, dn, voting) {
  const s = 44, w = s * 0.92, h = s * 0.92, rv = s * 0.18, cr = s * 0.30;
  const sc = MR_SC[si % MR_SC.length];
  let stroke, circleFill, textFill, bgFill, sw;
  if (dn) {
    stroke = '#C0392B'; circleFill = '#FEE2E2'; textFill = '#C0392B'; bgFill = '#FFF5F5'; sw = 2.5;
  } else if (voting) {
    stroke = '#D97706'; circleFill = '#FCD34D'; textFill = '#92400E'; bgFill = '#FFFBEB'; sw = 2;
  } else if (role === 'PRIMARY') {
    stroke = sc.border; circleFill = sc.bright; textFill = '#001E2B'; bgFill = '#FFFFFF'; sw = 3;
  } else {
    stroke = sc.border; circleFill = sc.dark;   textFill = '#FFFFFF'; bgFill = '#FFFFFF'; sw = 2;
  }
  const cross = dn ? `
    <line x1="${cx - cr*0.65}" y1="${cy - cr*0.65}" x2="${cx + cr*0.65}" y2="${cy + cr*0.65}" stroke="#C0392B" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="${cx + cr*0.65}" y1="${cy - cr*0.65}" x2="${cx - cr*0.65}" y2="${cy + cr*0.65}" stroke="#C0392B" stroke-width="2.5" stroke-linecap="round"/>` : '';
  return `<rect x="${cx - w/2}" y="${cy - h/2}" width="${w}" height="${h}" rx="${rv}" ry="${rv}" fill="${bgFill}" stroke="${stroke}" stroke-width="${sw}"/>
    <circle cx="${cx}" cy="${cy}" r="${cr}" fill="${circleFill}"/>
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="${s * 0.20}" font-weight="700" fill="${textFill}" font-family="'SF Mono','Consolas','Courier New',monospace">{ }</text>
    ${cross}`;
}

// ── Main render ───────────────────────────────────────────────────────────────

function mrRender() {
  const c = $('mr-svg-container'); if (!c) return;
  const cfg  = MR_CFGS[S.mr.config];
  const numR = cfg.regions.length, numS = cfg.numShards;

  const SVG_W  = 700, lm = 10, colGap = 12;
  const colW   = Math.floor((SVG_W - lm * 2 - colGap * (numR - 1)) / numR);
  const cX     = ri => lm + ri * (colW + colGap);
  const cCX    = ri => cX(ri) + colW / 2;
  const is1B   = S.mr.config === '3r1b';
  const topOffset   = is1B ? 90 : 0;
  const hdrH   = 32, backY = topOffset + hdrH + 8, backH = 44;
  const ns     = 44, nodeStartY = backY + backH + 28, nodeSpacing = 96;
  const legendH = 42;

  // Build per-column node list: primaries first
  const ownedByRegion = Array.from({ length: numR }, () => []);
  for (let si = 0; si < numS; si++)
    if (S.mr.primaryRegion[si] >= 0 && !S.mr.shardElecting[si])
      ownedByRegion[S.mr.primaryRegion[si]].push(si);

  const colNodes = [];
  for (let ri = 0; ri < numR; ri++) {
    const list = [];
    ownedByRegion[ri].forEach(si => {
      const cnt = cfg.shardDist[si][ri];
      for (let ni = 0; ni < cnt; ni++)
        list.push({ si, ri, ni, role: mrIsNodePrimary(si, ri, ni) ? 'PRIMARY' : 'SECONDARY' });
    });
    for (let si = 0; si < numS; si++) {
      if (ownedByRegion[ri].includes(si)) continue;
      const cnt = cfg.shardDist[si][ri];
      for (let ni = 0; ni < cnt; ni++) list.push({ si, ri, ni, role: 'SECONDARY' });
    }
    colNodes.push(list);
  }

  const maxNodes = Math.max(...colNodes.map(l => l.length));
  const SVG_H   = nodeStartY + maxNodes * nodeSpacing + legendH + 10;
  const nodePos = colNodes.map((list, ri) =>
    list.map((n, i) => ({ ...n, x: cCX(ri), y: nodeStartY + i * nodeSpacing }))
  );

  let svg = `<svg viewBox="0 0 ${SVG_W} ${SVG_H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">
  <defs>
    <pattern id="dotsMR" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#E2E8F0"/></pattern>
    <marker id="arrMRO"  markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="#FF9900"/></marker>
    <marker id="arrMRRO" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="#3B82F6"/></marker>
  </defs>
  <rect width="${SVG_W}" height="${SVG_H}" fill="url(#dotsMR)" rx="8"/>`;

  // ── Region column backgrounds ──────────────────────────────────────────────
  cfg.regions.forEach((reg, ri) => {
    const x = cX(ri), w = colW, allDn = mrRegionAllDown(ri);
    svg += `<rect x="${x}" y="${topOffset}" width="${w}" height="${SVG_H - legendH - 6 - topOffset}" rx="10" fill="${allDn ? '#FEF2F2' : '#FFFDF7'}" stroke="${allDn ? '#FCA5A5' : '#FFD08A'}" stroke-width="${allDn ? 2 : 1.5}"/>`;
    svg += `<rect x="${x}" y="${topOffset}" width="${w}" height="${hdrH}" rx="10" fill="${allDn ? '#EF4444' : '#FF9900'}"/>`;
    svg += `<rect x="${x}" y="${topOffset + hdrH - 8}" width="${w}" height="8" fill="${allDn ? '#EF4444' : '#FF9900'}"/>`;
    svg += `<text x="${cCX(ri)}" y="${topOffset + 15}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff" font-family="Lexend Deca,sans-serif">${reg.name}</text>`;
    svg += `<text x="${cCX(ri)}" y="${topOffset + 27}" text-anchor="middle" font-size="8.5" fill="rgba(255,255,255,0.9)" font-family="Lexend Deca,sans-serif">${reg.short}</text>`;
    if (allDn) {
      const midY = topOffset + (SVG_H - legendH - topOffset) / 2;
      svg += `<text x="${cCX(ri)}" y="${midY}"      text-anchor="middle" font-size="56" fill="rgba(239,83,80,0.09)">&#x2298;</text>`;
      svg += `<text x="${cCX(ri)}" y="${midY + 26}" text-anchor="middle" font-size="11" font-weight="700" fill="#DC2626" font-family="Lexend Deca,sans-serif">REGION DOWN</text>`;
    }
  });

  // ── Backend boxes + arrows ──────────────────────────────────────────────────
  if (is1B) {
    // External backend above the region cards — communicates mongos routing
    const ebW = 220, ebX = SVG_W / 2 - 110, ebY = 8, ebH = 58;
    svg += `<rect x="${ebX}" y="${ebY}" width="${ebW}" height="${ebH}" rx="8" fill="#fff" stroke="#FFD08A" stroke-width="1.5"/>`;
    svg += `<text x="${SVG_W / 2}" y="${ebY + 13}" text-anchor="middle" font-size="8" fill="#94A3B8" font-family="Lexend Deca,sans-serif">APPLICATION BACKEND</text>`;
    svg += `<text x="${SVG_W / 2}" y="${ebY + 27}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#D4801A" font-family="Lexend Deca,sans-serif">MongoDB Driver</text>`;
    svg += `<text x="${SVG_W / 2}" y="${ebY + 42}" text-anchor="middle" font-size="8" fill="#92400E" font-family="Lexend Deca,sans-serif">mongos routes writes → each shard's Primary</text>`;

    const srcX = SVG_W / 2, srcY = ebY + ebH;
    // Count targets per x-column for spread offset when 2 shards land on same column post-failover
    const colCount = {}, colIdx = {};
    for (let si = 0; si < numS; si++) {
      const t = mrBestTarget(si, null, nodePos, numR);
      if (t) colCount[t.x] = (colCount[t.x] || 0) + 1;
    }
    for (let si = 0; si < numS; si++) {
      const t = mrBestTarget(si, null, nodePos, numR); if (!t) continue;
      const total = colCount[t.x] || 1, idx = colIdx[t.x] || 0; colIdx[t.x] = idx + 1;
      const spread = total > 1 ? (idx - (total - 1) / 2) * 16 : 0;
      svg += mrArrow(srcX, srcY, t.x + spread, t.y - ns * 0.57, si, true);
    }
  } else {
    // 3r3b / 2r2b: each regional backend connects only to its home shard's local PRIMARY
    cfg.regions.forEach((reg, ri) => {
      if (mrRegionAllDown(ri)) return;
      if (!cfg.backends.includes(ri)) return;
      const cx = cCX(ri), bw = Math.min(colW - 18, 110), bx = cx - bw / 2;
      svg += `<rect x="${bx}" y="${backY}" width="${bw}" height="${backH}" rx="7" fill="#fff" stroke="#FFD08A" stroke-width="1.3"/>`;
      svg += `<text x="${cx}" y="${backY + 12}" text-anchor="middle" font-size="8" fill="#94A3B8" font-family="Lexend Deca,sans-serif">BACKEND</text>`;
      svg += `<text x="${cx}" y="${backY + 24}" text-anchor="middle" font-size="9" font-weight="600" fill="#D4801A" font-family="Lexend Deca,sans-serif">MongoDB Driver</text>`;
      svg += `<text x="${cx}" y="${backY + 36}" text-anchor="middle" font-size="7.5" fill="#92400E" font-family="Lexend Deca,sans-serif">local reads &amp; writes</text>`;
      // Only draw arrow when this region's home shard has a live PRIMARY here (no fallback)
      const homeSi   = cfg.primaryRegion.indexOf(ri);
      if (homeSi < 0) return;
      const localPri = nodePos[ri].find(n =>
        n.si === homeSi && n.role === 'PRIMARY' && S.mr.nodeHealth[n.si][n.ri][n.ni]
      );
      if (localPri) svg += mrArrow(cx, backY + backH, cx, localPri.y - ns * 0.57, homeSi, false);
    });
  }

  // ── Nodes ──────────────────────────────────────────────────────────────────
  for (let ri = 0; ri < numR; ri++) {
    nodePos[ri].forEach(n => {
      const { x, y, si, ri: r, ni, role } = n;
      const sc     = MR_SC[si % MR_SC.length];
      const isPri  = role === 'PRIMARY';
      const dn     = !S.mr.nodeHealth[si][r][ni];
      const voting = !dn && S.mr.shardElecting[si];
      svg += `<g onclick="mrToggleNode(${si},${r},${ni})" style="cursor:pointer">`;
      if (isPri  && !dn) svg += `<circle cx="${x}" cy="${y}" r="${ns * 0.75}" fill="none" stroke="${sc.bright}" stroke-width="1.5" class="pring" opacity="0.4"/>`;
      if (voting)        svg += `<circle cx="${x}" cy="${y}" r="${ns * 0.75}" fill="none" stroke="#F59E0B"   stroke-width="1.5" class="pring" opacity="0.5"/>`;
      svg += mrNodeSVG(x, y, si, role, dn, voting);
      const lblY    = y + ns * 0.50;
      const pillBg  = dn ? '#EF4444' : voting ? '#F59E0B' : isPri ? sc.border : '#E2E8F0';
      const pillTx  = dn || voting || isPri ? '#fff' : sc.text;
      const pillTxt = dn ? 'DOWN' : voting ? 'VOTING…' : role;
      svg += `<rect x="${x - 30}" y="${lblY}" width="60" height="14" rx="6" fill="${pillBg}"/>`;
      svg += `<text x="${x}" y="${lblY + 10}" text-anchor="middle" font-size="8" font-weight="700" fill="${pillTx}" font-family="Lexend Deca,sans-serif">${pillTxt}</text>`;
      svg += `<text x="${x}" y="${lblY + 24}" text-anchor="middle" font-size="7.5" fill="${dn ? '#EF4444' : voting ? '#D97706' : sc.text}" font-family="Lexend Deca,sans-serif">${cfg.shardZones[si]}</text>`;
      svg += `</g>`;
    });
  }

  // ── Legend bar ──────────────────────────────────────────────────────────────
  const legY  = SVG_H - legendH + 4;
  const slotW = (SVG_W - lm * 2) / numS;
  svg += `<rect x="${lm}" y="${legY}" width="${SVG_W - lm * 2}" height="${legendH - 4}" rx="6" fill="rgba(255,255,255,0.78)"/>`;
  for (let si = 0; si < numS; si++) {
    const sc       = MR_SC[si % MR_SC.length];
    const st       = mrShardStatus(si);
    const electing = S.mr.shardElecting[si];
    const ox = lm + si * slotW + 8;
    const dotFill   = electing ? '#FCD34D' : sc.bright;
    const dotBorder = electing ? '#D97706' : sc.border;
    const nameColor = electing ? '#92400E' : sc.border;
    const stC = electing ? '#D97706' : st.down ? '#6B7280' : st.readOnly ? '#DC2626' : '#16A34A';
    const stT = electing ? '⚡ Electing…' : st.down ? '⊘ Unavailable' : st.readOnly ? '⚠ READ-ONLY' : '✓ Writable';
    svg += `<circle cx="${ox + 5}" cy="${legY + 13}" r="5" fill="${dotFill}" stroke="${dotBorder}" stroke-width="1.2"/>`;
    svg += `<text x="${ox + 14}" y="${legY + 17}" font-size="9" font-weight="600" fill="${nameColor}" font-family="Lexend Deca,sans-serif">Shard ${si + 1}</text>`;
    svg += `<text x="${ox + 14}" y="${legY + 31}" font-size="8.5" font-weight="700" fill="${stC}" font-family="Lexend Deca,sans-serif">${stT}${!electing ? ' (' + st.healthyNodes + '/' + st.total + ')' : ''}</text>`;
  }

  svg += `</svg>`;
  c.innerHTML = svg;
}

function mrUpdateInfo() {
  const cfg = MR_CFGS[S.mr.config];
  const lbl = $('mr-config-label'); if (lbl) lbl.textContent = cfg.label;
  const desc = $('mr-pattern-desc'); if (desc) desc.innerHTML = cfg.desc;
  const b2r = $('mr-2r-banner'); if (b2r) b2r.style.display = S.mr.config === '2r2b' ? 'block' : 'none';

  const kb = $('mr-kill-btns');
  if (kb) {
    let html = '<div class="btn-row" style="flex-wrap:wrap;gap:6px">';
    cfg.regions.forEach((r, ri) => {
      html += mrRegionAllDown(ri)
        ? `<button class="btn btn-g" onclick="mrReviveRegion(${ri})">↑ Revive ${r.short}</button>`
        : `<button class="btn btn-r" onclick="mrKillRegion(${ri})">✕ Kill ${r.short}</button>`;
    });
    html += '</div><p style="font-size:13px;color:var(--text);font-weight:500;margin:8px 0 0">👆 Or click any node in the diagram to toggle it individually.</p>';
    kb.innerHTML = html;
  }
}

// ── Toggle individual node ────────────────────────────────────────────────────

async function mrToggleNode(si, ri, ni) {
  if (S.mr.shardElecting[si]) return;
  const cfg   = MR_CFGS[S.mr.config];
  const rName = cfg.regions[ri].name;
  const wasHealthy = S.mr.nodeHealth[si][ri][ni];
  const wasPrimary = mrIsNodePrimary(si, ri, ni);

  if (wasHealthy) {
    // Node going DOWN
    S.mr.nodeHealth[si][ri][ni] = false;
    log('ERROR', 'RS', `Shard ${si + 1}: node in ${rName} went DOWN`);
    const st = mrShardStatus(si);
    if (wasPrimary) {
      S.mr.primaryRegion[si] = -1;
      if (st.down) {
        log('ERROR', 'RS', `Shard ${si + 1}: all nodes down — complete outage`);
        mrHideElexBanner(); mrShowROBanner();
        mrRender(); mrUpdateInfo(); updateCAP();
      } else if (st.readOnly) {
        log('ERROR', 'RS', `Shard ${si + 1}: majority lost (${st.healthyNodes}/${st.total}) — READ-ONLY`);
        mrHideElexBanner(); mrShowROBanner();
        mrRender(); mrUpdateInfo(); updateCAP();
      } else {
        mrStartElection(si);
      }
    } else {
      if (st.down) {
        S.mr.primaryRegion[si] = -1;
        log('ERROR', 'RS', `Shard ${si + 1}: all nodes down — complete outage`);
        mrHideElexBanner(); mrShowROBanner();
      } else if (st.readOnly) {
        S.mr.primaryRegion[si] = -1;
        log('ERROR', 'RS', `Shard ${si + 1}: primary lost majority (${st.healthyNodes}/${st.total}) — stepping down`);
        log('INFO',  'RS', `Shard ${si + 1}: entering READ-ONLY mode. Writes resume when majority is restored.`);
        mrShowROBanner();
      } else {
        log('WARN', 'RS', `Shard ${si + 1}: secondary down — ${st.healthyNodes}/${st.total} healthy, writes continue`);
        mrHideElexBanner(); mrHideROBanner();
      }
      mrRender(); mrUpdateInfo(); updateCAP();
    }
  } else {
    // Node coming back UP
    S.mr.nodeHealth[si][ri][ni] = true;
    log('SUCCESS', 'RS', `Shard ${si + 1}: node in ${rName} back ONLINE — syncing oplog`);
    const st     = mrShardStatus(si);
    const homeRI = cfg.primaryRegion[si];
    if (!st.readOnly && !st.down) {
      if (S.mr.primaryRegion[si] === -1) {
        const targetRI = mrFirstHealthyNodeIn(si, homeRI) >= 0 ? homeRI : ri;
        S.mr.primaryRegion[si] = targetRI;
        log('SUCCESS', 'RS', `Shard ${si + 1}: PRIMARY recovered in ${cfg.regions[targetRI].name}${targetRI !== homeRI ? ' (home not yet available)' : ''}`);
      } else if (homeRI === ri && S.mr.primaryRegion[si] !== ri) {
        log('INFO', 'RS', `Shard ${si + 1}: PRIMARY stepping back to home region ${rName}`);
        S.mr.primaryRegion[si] = ri;
      }
    }
    mrUpdateBanners();
    mrRender(); mrUpdateInfo(); updateCAP();
  }
}

// ── Kill / revive entire region ───────────────────────────────────────────────

async function mrKillRegion(ri) {
  const cfg = MR_CFGS[S.mr.config];
  log('ERROR', 'ATLAS', `Simulating region failure: ${cfg.regions[ri].name}`);
  for (let si = 0; si < cfg.numShards; si++)
    for (let ni = 0; ni < cfg.shardDist[si][ri]; ni++)
      S.mr.nodeHealth[si][ri][ni] = false;

  for (let si = 0; si < cfg.numShards; si++) {
    if (S.mr.shardElecting[si]) continue;
    const st         = mrShardStatus(si);
    const wasPrimary = S.mr.primaryRegion[si] === ri;
    if (wasPrimary) S.mr.primaryRegion[si] = -1;
    if (st.down) {
      log('ERROR', 'RS', `Shard ${si + 1}: all nodes down`);
    } else if (st.readOnly) {
      if (wasPrimary) log('ERROR', 'RS', `Shard ${si + 1}: majority lost — READ-ONLY`);
      else { S.mr.primaryRegion[si] = -1; log('ERROR', 'RS', `Shard ${si + 1}: majority lost — primary stepping down, READ-ONLY`); }
    } else if (wasPrimary) {
      mrStartElection(si);
    }
  }
  mrShowROBanner();
  mrRender(); mrUpdateInfo(); updateCAP();
}

function mrReviveRegion(ri) {
  const cfg = MR_CFGS[S.mr.config];
  for (let si = 0; si < cfg.numShards; si++)
    for (let ni = 0; ni < cfg.shardDist[si][ri]; ni++)
      S.mr.nodeHealth[si][ri][ni] = true;
  log('SUCCESS', 'ATLAS', `Region ${cfg.regions[ri].name} restored`);
  for (let si = 0; si < cfg.numShards; si++) {
    if (S.mr.shardElecting[si]) continue;
    const st     = mrShardStatus(si);
    if (st.down) continue;
    const homeRI = cfg.primaryRegion[si];
    if (S.mr.primaryRegion[si] === -1 && !st.readOnly) {
      const targetRI = mrFirstHealthyNodeIn(si, homeRI) >= 0 ? homeRI : ri;
      S.mr.primaryRegion[si] = targetRI;
      log('SUCCESS', 'RS', `Shard ${si + 1}: PRIMARY recovered in ${cfg.regions[targetRI].name}${targetRI !== homeRI ? ' (home not yet available)' : ''}`);
    } else if (homeRI === ri && S.mr.primaryRegion[si] !== -1 && S.mr.primaryRegion[si] !== ri) {
      log('INFO', 'RS', `Shard ${si + 1}: PRIMARY stepping back to home region ${cfg.regions[ri].name}`);
      S.mr.primaryRegion[si] = ri;
    }
  }
  mrUpdateBanners();
  mrRender(); mrUpdateInfo(); updateCAP();
}

function mrReconfigure() {
  const sel = $('mr-config'); if (!sel) return;
  S.mr.config = sel.value;
  const cfg = MR_CFGS[S.mr.config];
  S.mr.nodeHealth    = mrInitNodeHealth(cfg);
  S.mr.primaryRegion = [...cfg.primaryRegion];
  S.mr.shardElecting = Array(cfg.numShards).fill(false);
  mrHideElexBanner(); mrHideROBanner();
  log('INFO', 'ATLAS', `Pattern: ${cfg.label}`);
  mrRender(); mrUpdateInfo(); updateCAP();
}

function mrReset() {
  const cfg = MR_CFGS[S.mr.config];
  S.mr.nodeHealth    = mrInitNodeHealth(cfg);
  S.mr.primaryRegion = [...cfg.primaryRegion];
  S.mr.shardElecting = Array(cfg.numShards).fill(false);
  mrHideElexBanner(); mrHideROBanner();
  log('SUCCESS', 'ATLAS', `Reset — ${cfg.label} fully healthy`);
  mrRender(); mrUpdateInfo(); updateCAP();
}
