// ─── TAB 1: REPLICA SET & FAILOVER ───────────────────────────────────────────

function rsGetDistribution(size, numRegions) {
  // Spread nodes as evenly as possible; front regions get the extra node
  const base  = Math.floor(size / numRegions);
  const extra = size % numRegions;
  return Array.from({ length: numRegions }, (_, i) => base + (i < extra ? 1 : 0));
}

function rsNodeProvDefault(globalIdx) {
  return NODE_PROV_DEFAULTS[globalIdx % NODE_PROV_DEFAULTS.length];
}

function rsBuildNodes() {
  const size       = parseInt($('rs-size')?.value || 3);
  const numRegions = parseInt($('rs-dist')?.value || 2);
  const counts     = rsGetDistribution(size, numRegions);
  const nodes = [];
  let idx = 0;
  counts.forEach((count, ri) => {
    for (let ni = 0; ni < count; ni++, idx++) {
      const provider   = $('rs-nprov-rs' + idx)?.value || rsNodeProvDefault(idx);
      const regionName = REGION_NAMES[ri][provider];
      nodes.push({
        id: `rs${idx}`, host: `rs${idx}.${regionName}`,
        role: idx === 0 ? 'PRIMARY' : 'SECONDARY', state: 'HEALTHY',
        votes: 1, priority: idx === 0 ? 2 : 1,
        dc: regionName, region: ri, provider,
      });
    }
  });
  return nodes;
}

function rsRenderProviderSelectors() {
  const numRegions = parseInt($('rs-dist')?.value || 2);
  const size       = parseInt($('rs-size')?.value  || 3);
  const counts     = rsGetDistribution(size, numRegions);
  const el = $('rs-region-providers'); if (!el) return;

  let html = '', globalIdx = 0;
  for (let ri = 0; ri < numRegions; ri++) {
    html += `<div style="margin:7px 0 3px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3)">Region ${ri + 1}</div>`;
    for (let ni = 0; ni < counts[ri]; ni++, globalIdx++) {
      const nodeId = `rs${globalIdx}`;
      const cur  = $('rs-nprov-' + nodeId)?.value || rsNodeProvDefault(globalIdx);
      const role = globalIdx === 0 ? 'PRIMARY' : 'SECONDARY';
      html += `<label class="fld" style="flex-direction:row;align-items:center;gap:8px;margin-bottom:4px">
        <span style="font-size:10px;color:var(--text2);min-width:90px">${nodeId} <span style="color:var(--text3)">(${role})</span></span>
        <select id="rs-nprov-${nodeId}" onchange="rsReconfigure()" style="flex:1;padding:4px 6px;font-size:11px">
          <option value="aws"   ${cur === 'aws'   ? 'selected' : ''}>AWS</option>
          <option value="gcp"   ${cur === 'gcp'   ? 'selected' : ''}>GCP</option>
          <option value="azure" ${cur === 'azure' ? 'selected' : ''}>Azure</option>
        </select>
      </label>`;
    }
  }
  el.innerHTML = html;
}

function rsShowBanner(state) {
  // state: 'none' | 'election' | 'readonly' | 'down'
  $('ro-banner')  ?.classList.toggle('show', state === 'readonly');
  $('down-banner')?.classList.toggle('show', state === 'down');
  // elex-banner managed separately by rsStartElection / rsCompleteElection
}

function rsUpdateQuorumInfo() {
  const el = $('rs-quorum-info'); if (!el) return;
  const total    = S.rs.nodes.length;
  const healthy  = S.rs.nodes.filter(n => n.state === 'HEALTHY').length;
  const majority = Math.floor(total / 2) + 1;
  const canFail  = majority - 1;
  el.innerHTML = `Majority: <strong>${majority}/${total}</strong> nodes · Can tolerate <strong>${canFail}</strong> failure${canFail !== 1 ? 's' : ''} · ${healthy} currently healthy`;
}

function rsReconfigure() {
  clearInterval(S.rs.electionInterval);
  S.rs.electing = false;
  $('elex-banner').classList.remove('show');
  rsShowBanner('none');
  rsRenderProviderSelectors();
  S.rs.nodes = rsBuildNodes();
  rsUpdateQuorumInfo();
  rsRender();
  updateCAP();
}

function rsComputeLayout() {
  const nodes      = S.rs.nodes;
  const numRegions = parseInt($('rs-dist')?.value || 2);
  const counts     = rsGetDistribution(nodes.length, numRegions);

  const nodeSize   = nodes.length <= 3 ? 54 : nodes.length <= 5 ? 48 : 42;
  const hPitch     = nodeSize + 58;
  const vPitch     = nodeSize + 54;
  const W          = 660;
  const maxPerRow  = Math.max(1, Math.floor(620 / hPitch));
  const clientH    = 60;
  const regHeaderH = 30;
  const regPadTop  = 18;
  const regPadBot  = 38;
  const regGap     = 10;

  // Build visual boxes: one per (geographic-region × cloud-provider) combination
  const visualBoxDefs = [];
  let nodeIdx = 0;
  for (let ri = 0; ri < numRegions; ri++) {
    const regionNodes = nodes.slice(nodeIdx, nodeIdx + counts[ri]);
    const provOrder = [], provMap = {};
    regionNodes.forEach(n => {
      const p = n.provider || 'aws';
      if (!provMap[p]) { provMap[p] = []; provOrder.push(p); }
      provMap[p].push(n);
    });
    provOrder.forEach(p => visualBoxDefs.push({ ri, provider: p, boxNodes: provMap[p] }));
    nodeIdx += counts[ri];
  }

  const positions = {}, regionBoxes = [];
  let curY = clientH + 10;

  visualBoxDefs.forEach(vb => {
    const { ri, provider, boxNodes } = vb;
    const count = boxNodes.length;
    const rows  = Math.ceil(count / maxPerRow);
    const boxH  = regHeaderH + regPadTop + rows * vPitch + regPadBot;

    regionBoxes.push({ x: 8, y: curY, w: W - 16, h: boxH, ri, provider, count });

    boxNodes.forEach((n, ni) => {
      const row        = Math.floor(ni / maxPerRow);
      const col        = ni % maxPerRow;
      const nodesInRow = Math.min(maxPerRow, count - row * maxPerRow);
      const rowW       = nodesInRow * hPitch - (hPitch - nodeSize);
      const startX     = (W - rowW) / 2 + nodeSize / 2;
      positions[n.id]  = {
        x: startX + col * hPitch,
        y: curY + regHeaderH + regPadTop + nodeSize * 0.6 + row * vPitch,
      };
    });
    curY += boxH + regGap;
  });

  const H = curY + 10;
  return { positions, regionBoxes, H, nodeSize };
}

function rsRender() {
  const c = $('rs-svg-container'); if (!c) return;
  const nodes = S.rs.nodes;
  const { positions, regionBoxes, H, nodeSize } = rsComputeLayout();
  const primary     = nodes.find(n => n.role === 'PRIMARY' && n.state === 'HEALTHY');
  const majority    = Math.floor(nodes.length / 2) + 1;
  const healthy     = nodes.filter(n => n.state === 'HEALTHY').length;
  const quorumCount = nodes.filter(n => n.state === 'HEALTHY' || n.state === 'VOTING').length;

  let svg = `<svg viewBox="0 0 660 ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:660px;display:block;margin:0 auto">
  <defs>
    <pattern id="dotsRS" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#E2E8F0"/></pattern>
    <marker id="arrRS" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="#FF6B35"/></marker>
    <marker id="arrRO" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="#D4801A"/></marker>
  </defs>
  <rect width="660" height="${H}" fill="url(#dotsRS)" rx="8"/>`;

  // HA/DR labels: only when exactly 2 regions selected
  const numRegions2 = parseInt($('rs-dist')?.value || 1);
  const totalByRi = {};
  regionBoxes.forEach(b => { totalByRi[b.ri] = (totalByRi[b.ri] || 0) + b.count; });
  const riCounts    = Object.values(totalByRi);
  const maxRiCount  = Math.max(...riCounts);
  const minRiCount  = Math.min(...riCounts);
  const hadrTag = (ri) => {
    if (numRegions2 !== 2 || maxRiCount === minRiCount) return '';
    return totalByRi[ri] === maxRiCount ? ' (for High Availability)' : ' (for Disaster Recovery)';
  };

  regionBoxes.forEach(box => {
    const p     = PROV[box.provider];
    const rname = REGION_NAMES[box.ri][box.provider];
    const tag   = hadrTag(box.ri);
    svg += `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="10" fill="${p.bg}" stroke="${p.border}" stroke-width="1.5"/>`;
    svg += `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="26" rx="10" fill="${p.color}"/>`;
    svg += `<rect x="${box.x}" y="${box.y + 16}" width="${box.w}" height="10" fill="${p.color}"/>`;
    svg += `<text x="${box.x + box.w/2}" y="${box.y + 17}" text-anchor="middle" font-size="10" font-weight="700" fill="#fff" font-family="Lexend Deca,sans-serif">${p.label} · ${rname} · ${box.count} node${box.count > 1 ? 's' : ''}${tag}</text>`;
  });

  // Client Application box
  svg += `<rect x="240" y="8" width="180" height="26" rx="8" fill="#fff" stroke="#CBD5E1" stroke-width="1.5"/>
  <text x="330" y="24" text-anchor="middle" font-size="10" fill="#64748B" font-family="Lexend Deca,sans-serif">CLIENT APPLICATION</text>`;

  // Arrow client → primary (WRITES) or → surviving nodes (READ-ONLY)
  const readOnly = quorumCount < majority;
  let arrowLabelSvg = '';

  if (primary && !readOnly) {
    const pp = positions[primary.id];
    if (pp) {
      const ax1 = 330, ay1 = 48, ax2 = pp.x, ay2 = pp.y - nodeSize * 0.6;
      const lx = ax1 + (ax2 - ax1) * 0.25, ly = ay1 + (ay2 - ay1) * 0.25;
      svg += `<line x1="${ax1}" y1="${ay1}" x2="${ax2}" y2="${ay2}" stroke="#FF6B35" stroke-width="1.8" stroke-dasharray="5 3" marker-end="url(#arrRS)"/>`;
      svg += `<circle cx="${ax2}" cy="${ay2}" r="4" fill="#FF6B35"/>`;
      arrowLabelSvg += `<rect x="${lx - 20}" y="${ly - 9}" width="40" height="14" rx="4" fill="#FFF4E6"/>`;
      arrowLabelSvg += `<text x="${lx}" y="${ly + 1}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#C2410C" font-family="Lexend Deca,sans-serif">WRITE</text>`;
    }
  } else if (readOnly) {
    nodes.filter(n => n.state === 'HEALTHY').forEach(n => {
      const pp = positions[n.id]; if (!pp) return;
      const ax1 = 330, ay1 = 48, ax2 = pp.x, ay2 = pp.y - nodeSize * 0.6;
      const lx = ax1 + (ax2 - ax1) * 0.25, ly = ay1 + (ay2 - ay1) * 0.25;
      svg += `<line x1="${ax1}" y1="${ay1}" x2="${ax2}" y2="${ay2}" stroke="#D4801A" stroke-width="1.5" stroke-dasharray="5 3" class="hb" marker-end="url(#arrRO)"/>`;
      svg += `<circle cx="${ax2}" cy="${ay2}" r="4" fill="#D4801A"/>`;
      arrowLabelSvg += `<rect x="${lx - 24}" y="${ly - 9}" width="48" height="14" rx="4" fill="#FEF3E2"/>`;
      arrowLabelSvg += `<text x="${lx}" y="${ly + 1}" text-anchor="middle" font-size="8" font-weight="700" fill="#92400E" font-family="Lexend Deca,sans-serif">READ-ONLY</text>`;
    });
  }

  // Replication & heartbeat lines (drawn before nodes so they appear underneath)
  if (primary) {
    const pp = positions[primary.id];
    nodes.filter(n => n.id !== primary.id).forEach(n => {
      const np = positions[n.id]; if (!pp || !np) return;
      svg += `<line x1="${pp.x}" y1="${pp.y}" x2="${np.x}" y2="${np.y}" stroke="${n.state === 'HEALTHY' ? '#CBD5E1' : '#FCA5A5'}" stroke-width="1.5"/>`;
      if (n.state === 'HEALTHY')
        svg += `<line x1="${pp.x}" y1="${pp.y}" x2="${np.x}" y2="${np.y}" stroke="rgba(0,104,74,0.5)" stroke-width="2" class="repl"/>`;
    });
  }
  // Cross-secondary heartbeat
  const secs = nodes.filter(n => n.role === 'SECONDARY' && n.state === 'HEALTHY');
  for (let i = 0; i < secs.length - 1; i++) {
    const p1 = positions[secs[i].id], p2 = positions[secs[i + 1].id];
    if (p1 && p2)
      svg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="4 4" class="hb"/>`;
  }

  // Nodes
  nodes.forEach(n => {
    const pos = positions[n.id]; if (!pos) return;
    const isPri = n.role === 'PRIMARY', isDead = n.state === 'DOWN', isVoting = n.state === 'VOTING';
    svg += `<g id="rsn-${n.id}" style="cursor:pointer">`;
    if (isPri && !isDead) svg += `<circle cx="${pos.x}" cy="${pos.y}" r="${nodeSize * 0.75}" fill="none" stroke="rgba(0,237,100,0.3)" stroke-width="1.5" class="pring"/>`;
    svg += mdbNodeIcon(pos.x, pos.y, nodeSize, n.state, n.role);
    const lblY = pos.y + nodeSize * 0.83;
    svg += `<text x="${pos.x}" y="${lblY}" text-anchor="middle" font-size="8.5" fill="#64748B" font-family="Lexend Deca,sans-serif">${n.host}</text>`;
    const isRO = readOnly && !isDead && !isPri;
    const bc = isDead ? '#FEE2E2' : isPri ? '#DCFCE7' : isRO ? '#FEF3C7' : '#DBEAFE';
    const tc = isDead ? '#991B1B' : isPri ? '#166534' : isRO ? '#92400E' : '#1E40AF';
    const lbl = isDead ? 'DOWN' : isVoting ? 'VOTING…' : isRO ? 'READ-ONLY' : n.role;
    svg += `<rect x="${pos.x - 26}" y="${lblY + 5}" width="52" height="15" rx="7" fill="${bc}"/>`;
    svg += `<text x="${pos.x}" y="${lblY + 15}" text-anchor="middle" font-size="8.5" font-weight="700" fill="${tc}" font-family="Lexend Deca,sans-serif">${lbl}</text>`;
    if (n.provider && !isDead) {
      const pv = PROV[n.provider];
      svg += `<rect x="${pos.x - 18}" y="${lblY + 23}" width="36" height="11" rx="4" fill="${pv.color}22" stroke="${pv.color}" stroke-width="0.8"/>`;
      svg += `<text x="${pos.x}" y="${lblY + 31}" text-anchor="middle" font-size="7.5" font-weight="700" fill="${pv.color}" font-family="Lexend Deca,sans-serif">${pv.label}</text>`;
    }
    svg += `</g>`;
  });

  // Arrow labels on top of nodes
  svg += arrowLabelSvg;

  // Quorum status bar
  const electing = S.rs.electing;
  const quorumOk = quorumCount >= majority;
  const stColor  = healthy === 0 ? '#7F1D1D' : quorumOk ? '#166534' : '#92400E';
  const stBg     = healthy === 0 ? '#FEE2E2' : quorumOk ? '#DCFCE7' : '#FEF3C7';
  const stMsg    = electing
    ? `⚡ Election in progress — ${quorumCount}/${nodes.length} nodes voting · ${majority} required · driver holding writes`
    : healthy === 0
      ? `🔴 Complete outage — 0/${nodes.length} nodes healthy · No reads or writes possible`
      : quorumOk
        ? `✓ Quorum: ${quorumCount}/${nodes.length} healthy · ${majority} required · Writes operational`
        : `⚠ Quorum: ${healthy}/${nodes.length} healthy · ${majority} required · Below majority — READ-ONLY mode`;
  svg += `<rect x="8" y="${H - 16}" width="644" height="14" rx="4" fill="${stBg}"/>`;
  svg += `<text x="330" y="${H - 6}" text-anchor="middle" font-size="9" font-weight="600" fill="${stColor}" font-family="Lexend Deca,sans-serif">${stMsg}</text>`;

  svg += `</svg>`;
  c.innerHTML = svg;

  // Attach click handlers
  nodes.forEach(n => {
    const el = c.querySelector('#rsn-' + n.id);
    if (el) el.addEventListener('click', () => rsToggleNode(n.id));
  });
  rsUpdateQuorumInfo();
}

async function rsToggleNode(id) {
  if (S.rs.electing) return;
  const n = S.rs.nodes.find(nd => nd.id === id); if (!n) return;
  const majority = Math.floor(S.rs.nodes.length / 2) + 1;

  // ── RECOVERY ────────────────────────────────────────────────────────────────
  if (n.state === 'DOWN') {
    n.state = 'HEALTHY'; n.role = 'SECONDARY';
    log('SUCCESS', 'RS', `${n.host} recovered — rejoining as SECONDARY, syncing oplog`);
    const healthy   = S.rs.nodes.filter(nd => nd.state === 'HEALTHY').length;
    const hasPrimary = S.rs.nodes.some(nd => nd.role === 'PRIMARY' && nd.state === 'HEALTHY');
    if (healthy >= majority) {
      rsShowBanner('none');
      if (!hasPrimary) {
        log('SUCCESS', 'RS', `Majority restored (${healthy}/${S.rs.nodes.length}) — triggering election to elect new Primary`);
        log('WARN', 'DRIVER', 'Retryable writes active — driver holding operations until Primary is elected. No data will be lost.');
        rsStartElection();
      } else {
        log('SUCCESS', 'RS', `Majority restored (${healthy}/${S.rs.nodes.length}) — writes fully operational again`);
        rsRender(); updateCAP();
      }
    } else {
      log('INFO', 'RS', `Node recovered but majority not yet reached (${healthy}/${S.rs.nodes.length}) — remaining in READ-ONLY mode`);
      rsShowBanner('readonly');
      rsRender(); updateCAP();
    }
    return;
  }

  // ── FAILURE ──────────────────────────────────────────────────────────────────
  const wasPrimary = n.role === 'PRIMARY';
  n.state = 'DOWN';
  const healthy = S.rs.nodes.filter(nd => nd.state === 'HEALTHY').length;

  const rsBannerState = () => {
    if (healthy === 0) return 'down';
    if (healthy < majority) return 'readonly';
    return 'none';
  };

  if (wasPrimary) {
    log('ERROR', 'RS', `Primary ${n.host} is UNREACHABLE`);
    if (healthy >= majority) {
      log('WARN', 'DRIVER', 'Retryable writes active — driver is holding all incoming operations. No data will be lost.');
      rsStartElection();
    } else if (healthy === 0) {
      log('ERROR', 'RS', 'All nodes are DOWN — complete outage');
      rsShowBanner('down');
      rsRender(); updateCAP();
    } else {
      log('WARN', 'RS', `Only ${healthy}/${S.rs.nodes.length} nodes healthy — majority (${majority}) cannot be reached`);
      log('INFO', 'RS', 'No downtime — replica set enters READ-ONLY mode. Reads are still served normally.');
      rsShowBanner('readonly');
      rsRender(); updateCAP();
    }
  } else {
    log('WARN', 'RS', `Secondary ${n.host} went DOWN`);
    if (healthy === 0) {
      log('ERROR', 'RS', 'All nodes are DOWN — complete outage. No reads or writes possible.');
      rsShowBanner('down');
    } else if (healthy < majority) {
      log('WARN', 'RS', `Below majority (${healthy}/${S.rs.nodes.length}) — writes suspended`);
      log('INFO', 'RS', 'No downtime — reads continue normally. Writes resume automatically when majority is restored.');
      rsShowBanner('readonly');
    } else {
      rsShowBanner('none');
      log('INFO', 'RS', `${healthy} nodes healthy — majority (${majority}) maintained. Fully operational.`);
    }
    rsRender(); updateCAP();
  }
}

async function rsStartElection() {
  S.rs.electing = true;
  $('elex-banner').classList.add('show');
  S.rs.nodes.filter(n => n.state === 'HEALTHY').forEach(n => n.state = 'VOTING');
  rsRender();
  let count = 10;
  $('elex-count').textContent = count;
  S.rs.electionInterval = setInterval(() => {
    $('elex-count').textContent = --count;
    if (count <= 0) { clearInterval(S.rs.electionInterval); rsCompleteElection(); }
  }, 1000);
}

function rsCompleteElection() {
  $('elex-banner').classList.remove('show');
  S.rs.electing = false;
  const candidates = S.rs.nodes.filter(n => n.state === 'VOTING');
  if (!candidates.length) {
    S.rs.nodes.filter(n => n.state === 'VOTING').forEach(n => n.state = 'HEALTHY');
    rsRender(); return;
  }
  candidates.sort((a, b) => b.priority - a.priority);
  candidates.forEach(n => { n.state = 'HEALTHY'; n.role = 'SECONDARY'; });
  candidates[0].role = 'PRIMARY';
  log('SUCCESS', 'ELECTION', `${candidates[0].host} elected new PRIMARY (priority:${candidates[0].priority})`);
  log('SUCCESS', 'DRIVER', 'Operations resumed — driver transparently retried all held writes. Zero data loss.');
  rsRender(); updateCAP();
}

function rsReset() {
  clearInterval(S.rs.electionInterval);
  S.rs.electing = false;
  $('elex-banner').classList.remove('show');
  rsShowBanner('none');
  const wc = $('rs-wc'); if (wc) wc.value = 'wmaj';
  const rp = $('rs-rp'); if (rp) rp.value = 'primary';
  S.rs.nodes = rsBuildNodes();
  log('SUCCESS', 'RS', 'Replica set reset to healthy state · writeConcern: w:"majority" · readPreference: primary');
  rsRender(); updateCAP();
}

function updateConcerns() { updateCAP(); }
