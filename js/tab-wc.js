// ─── TAB 2: WRITE / READ CONCERNS ────────────────────────────────────────────

function wcRender() {
  const c = $('wc-svg-container'); if (!c) return;
  const wc = $('wc-w')?.value  || 'wmaj';
  const rp = $('wc-rp')?.value || 'primary';
  const rc = $('wc-rc')?.value || 'majority';
  const j  = $('wc-j')?.value === 'true';

  // How many nodes ACK for a 3-node RS
  const acksNeeded = wc === 'w0' ? 0 : wc === 'w1' ? 1 : wc === 'wmaj' ? 2 : 3;

  // Node layout: PRIMARY top-center, two secondaries bottom
  const npos = [
    { x: 290, y: 170, role: 'PRIMARY',   id: 'rs0' },
    { x: 100, y: 320, role: 'SECONDARY', id: 'rs1' },
    { x: 480, y: 320, role: 'SECONDARY', id: 'rs2' },
  ];
  const readTarget = rp === 'secondary' || rp === 'secondaryPreferred' ? 1
                   : rp === 'nearest' ? 2 : 0;

  let svg = `<svg viewBox="0 0 580 400" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">`;
  svg += `<defs>
    <pattern id="dots2" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#E2E8F0"/></pattern>
    <marker id="arrWW" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="#FF6B35"/></marker>
    <marker id="arrAK" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="#22C55E"/></marker>
    <marker id="arrRR" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="#3B82F6"/></marker>
    <marker id="arrOL" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="rgba(0,104,74,0.65)"/></marker>
  </defs>`;
  svg += `<rect width="580" height="400" fill="url(#dots2)" rx="8"/>`;

  // CLIENT APP
  svg += `<rect x="200" y="12" width="180" height="28" rx="8" fill="#fff" stroke="#CBD5E1" stroke-width="1.5"/>
    <text x="290" y="28" text-anchor="middle" font-size="10" fill="#64748B" font-family="Lexend Deca,sans-serif">CLIENT APPLICATION</text>`;

  // ── WRITE PATH: App → Primary ──
  // When read also targets primary (readTarget===0), fan arrows apart to avoid label overlap
  const pri = npos[0];
  const sameTarget = readTarget === 0;
  const wX1 = sameTarget ? 300 : 290;
  const wLineY1 = 56, wLineY2 = pri.y - 28;

  if (acksNeeded === 0) {
    // w:0 fire-and-forget — grey dashed, no ACK back
    svg += `<line x1="${wX1}" y1="${wLineY1}" x2="${pri.x}" y2="${wLineY2}" stroke="#94A3B8" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    svg += `<rect x="297" y="84" width="56" height="14" rx="4" fill="#F1F5F9" stroke="#CBD5E1"/>`;
    svg += `<text x="325" y="94" text-anchor="middle" font-size="8" fill="#94A3B8" font-family="Lexend Deca,sans-serif">w:0 no ACK</text>`;
  } else {
    svg += `<line x1="${wX1}" y1="${wLineY1}" x2="${pri.x + (sameTarget ? 8 : 0)}" y2="${wLineY2}" stroke="#FF6B35" stroke-width="2" stroke-dasharray="6 3" class="repl" marker-end="url(#arrWW)"/>`;
    const wLabelX = sameTarget ? 330 : 315;
    const wLabelY = sameTarget ? 80 : 88;
    svg += `<rect x="${wLabelX - 18}" y="${wLabelY}" width="36" height="14" rx="4" fill="#FFF4E6"/>`;
    svg += `<text x="${wLabelX}" y="${wLabelY + 10}" text-anchor="middle" font-size="8" font-weight="700" fill="#C2410C" font-family="Lexend Deca,sans-serif">WRITE</text>`;
    // ACK back from Primary to App
    const ackEndX  = sameTarget ? wX1 + 4 : wX1 - 12;
    svg += `<line x1="${pri.x + (sameTarget ? 14 : -6)}" y1="${wLineY2}" x2="${ackEndX}" y2="${wLineY1}" stroke="#22C55E" stroke-width="1.5" stroke-dasharray="5 3" marker-end="url(#arrAK)"/>`;
    const ackLabelX = sameTarget ? 336 : 262;
    const ackLabelY = sameTarget ? 100 : 87;
    svg += `<rect x="${ackLabelX - 16}" y="${ackLabelY}" width="32" height="14" rx="4" fill="#F0FDF4"/>`;
    svg += `<text x="${ackLabelX}" y="${ackLabelY + 10}" text-anchor="middle" font-size="8" font-weight="700" fill="#166534" font-family="Lexend Deca,sans-serif">ACK</text>`;
  }

  // ── REPLICATION LINES: Primary → Secondaries ──
  for (let i = 1; i <= 2; i++) {
    const sec = npos[i];
    const needsAck = acksNeeded > i;
    const color = needsAck ? 'rgba(0,104,74,0.6)' : '#CBD5E1';
    const sw    = needsAck ? 2 : 1.5;
    const cls   = needsAck ? 'class="repl"' : 'stroke-dasharray="4 4"';
    svg += `<line x1="${pri.x}" y1="${pri.y}" x2="${sec.x}" y2="${sec.y - 28}" stroke="${color}" stroke-width="${sw}" ${cls} ${needsAck ? 'marker-end="url(#arrOL)"' : ''}/>`;
    const mx = (pri.x + sec.x) / 2 + (i === 1 ? -14 : 8);
    const my = (pri.y + sec.y - 28) / 2 - 4;
    if (needsAck) {
      svg += `<rect x="${mx - 16}" y="${my - 8}" width="32" height="13" rx="3" fill="#F0FDF4"/>`;
      svg += `<text x="${mx}" y="${my + 1}" text-anchor="middle" font-size="8" fill="#166534" font-family="Lexend Deca,sans-serif">oplog</text>`;
    }
  }

  // ── READ PATH ──
  // When targeting primary and write also goes primary, shift read arrow left
  const rt   = npos[readTarget];
  const rdX1 = sameTarget ? 270 : 278;
  const rdX2 = sameTarget ? (pri.x - 10) : rt.x + (readTarget === 1 ? 12 : (readTarget === 2 ? -12 : 3));
  svg += `<line x1="${rdX1}" y1="56" x2="${rdX2}" y2="${rt.y - 28}" stroke="#3B82F6" stroke-width="1.8" stroke-dasharray="8 4" marker-end="url(#arrRR)"/>`;
  const rlx = sameTarget ? 245 : ((rdX1 + rdX2) / 2 + (readTarget === 1 ? -18 : readTarget === 2 ? 12 : 8));
  const rly = sameTarget ? 88  : (56 + rt.y - 28) / 2;
  svg += `<rect x="${rlx - 26}" y="${rly - 8}" width="52" height="14" rx="4" fill="#EFF6FF" stroke="#BFDBFE"/>`;
  svg += `<text x="${rlx}" y="${rly + 2}" text-anchor="middle" font-size="8" fill="#1D4ED8" font-family="Lexend Deca,sans-serif">READ → ${rt.id}</text>`;

  // ── NODES ──
  npos.forEach((pos, i) => {
    const isPri    = i === 0;
    const isReadTgt = i === readTarget;
    const hasAck   = (isPri && acksNeeded >= 1) || (!isPri && acksNeeded > i);
    svg += `<g>`;
    if (isPri) svg += `<circle cx="${pos.x}" cy="${pos.y}" r="36" fill="none" stroke="rgba(0,237,100,0.3)" stroke-width="1.5" class="pring"/>`;
    svg += mdbNodeIcon(pos.x, pos.y, 54, null, pos.role);
    svg += `<text x="${pos.x}" y="${pos.y + 42}" text-anchor="middle" font-size="9" fill="#64748B" font-family="Lexend Deca,sans-serif">${pos.id}:27017</text>`;
    const bc = isPri ? '#DCFCE7' : '#DBEAFE', tc = isPri ? '#166534' : '#1E40AF';
    svg += `<rect x="${pos.x - 28}" y="${pos.y + 49}" width="56" height="16" rx="8" fill="${bc}"/>`;
    svg += `<text x="${pos.x}" y="${pos.y + 60}" text-anchor="middle" font-size="9" font-weight="700" fill="${tc}" font-family="Lexend Deca,sans-serif">${pos.role}</text>`;
    if (hasAck) {
      svg += `<circle cx="${pos.x + 25}" cy="${pos.y - 25}" r="10" fill="#22C55E" stroke="#fff" stroke-width="2"/>`;
      svg += `<text x="${pos.x + 25}" y="${pos.y - 20}" text-anchor="middle" font-size="11" fill="#fff" font-weight="700">✓</text>`;
    }
    if (isReadTgt) {
      svg += `<circle cx="${pos.x - 25}" cy="${pos.y - 25}" r="10" fill="#3B82F6" stroke="#fff" stroke-width="2"/>`;
      svg += `<text x="${pos.x - 25}" y="${pos.y - 20}" text-anchor="middle" font-size="10" fill="#fff" font-weight="700">R</text>`;
    }
    svg += `</g>`;
  });

  // ── CORNER PILLS: journal + readConcern ──
  svg += `<rect x="6" y="6" width="86" height="28" rx="6" fill="${j ? '#F0FDF4' : '#F8FAFC'}" stroke="${j ? '#86EFAC' : '#E2E8F0'}" stroke-width="1"/>`;
  svg += `<text x="49" y="17" text-anchor="middle" font-size="8.5" font-weight="700" fill="${j ? '#166534' : '#94A3B8'}" font-family="Lexend Deca,sans-serif">j: ${j ? 'true' : 'false'}</text>`;
  svg += `<text x="49" y="28" text-anchor="middle" font-size="7.5" fill="${j ? '#166534' : '#94A3B8'}" font-family="Lexend Deca,sans-serif">${j ? 'disk journal ✓' : 'memory only'}</text>`;

  const rcColor = rc === 'linearizable' ? '#7C3AED' : rc === 'majority' ? '#166534' : rc === 'snapshot' ? '#0369A1' : '#92400E';
  const rcBg    = rc === 'linearizable' ? '#EDE9FE' : rc === 'majority' ? '#F0FDF4' : rc === 'snapshot' ? '#E0F2FE' : '#FFF7ED';
  const rcBdr   = rc === 'linearizable' ? '#C4B5FD' : rc === 'majority' ? '#86EFAC' : rc === 'snapshot' ? '#7DD3FC' : '#FED7AA';
  svg += `<rect x="488" y="6" width="86" height="28" rx="6" fill="${rcBg}" stroke="${rcBdr}" stroke-width="1"/>`;
  svg += `<text x="531" y="17" text-anchor="middle" font-size="8.5" font-weight="700" fill="${rcColor}" font-family="Lexend Deca,sans-serif">rc: ${rc}</text>`;
  svg += `<text x="531" y="28" text-anchor="middle" font-size="7.5" fill="${rcColor}" font-family="Lexend Deca,sans-serif">${rc === 'majority' ? 'committed ✓' : rc === 'linearizable' ? 'linearizable' : rc === 'snapshot' ? 'snapshot' : 'local state'}</text>`;

  svg += `</svg>`;
  c.innerHTML = svg;
}

function wcUpdate() {
  const wc = $('wc-w')?.value  || 'wmaj';
  const j  = $('wc-j')?.value === 'true';
  const rc = $('wc-rc')?.value || 'majority';
  const rp = $('wc-rp')?.value || 'primary';

  // Explanatory header
  const wcExplTexts = {
    w0:   '<strong>w:0 — Fire &amp; forget.</strong> The driver sends the write and returns immediately without waiting for any server response. Zero latency overhead, zero durability guarantee. A server crash before applying the write loses that data silently. Only appropriate for non-critical telemetry or metrics.',
    w1:   '<strong>w:1 — Primary acknowledged.</strong> MongoDB waits for the Primary to apply the write (to memory and journal if j:true), then sends ACK to the driver. Fast, but if the Primary crashes before replicating to any Secondary, the write can be lost during failover.',
    wmaj: '<strong>w:&quot;majority&quot; — Recommended for financial data.</strong> A majority of voting nodes (2 of 3 here) must apply and acknowledge the write. This guarantees the write survives any single-node failure, including an immediate Primary crash followed by election. The new Primary will always have the write.',
    wall: '<strong>w:&quot;all&quot; — Maximum durability.</strong> Every node in the replica set must confirm the write. Safest option, but writes fail (or hang) if any node is down or slow. Use only when absolute durability is more important than availability.',
  };
  const expl = $('wc-explanation');
  if (expl) expl.innerHTML = wcExplTexts[wc] || '';

  // Per-setting descriptions
  const wcDescs = {
    w0:   'No ACK. Driver returns as soon as the request is sent over the network.',
    w1:   'ACK from the Primary node only. Replication to secondaries is asynchronous.',
    wmaj: 'ACK required from majority of voting nodes (2 of 3). Survives any single-node failure.',
    wall: 'ACK from all 3 nodes required. Highest durability; writes fail if any node is unreachable.',
  };
  const jDescs = {
    true:  'Server writes to on-disk WAL (journal) before sending ACK — survives power failure or process crash.',
    false: 'ACK sent once write is in memory. A server crash before journal flush may lose an acknowledged write.',
  };
  const rcDescs = {
    local:        "Returns the node's local snapshot — may include writes not yet replicated to majority. Risk of dirty reads during failover.",
    available:    'Fastest, weakest: may read orphaned documents in sharded clusters. Avoid for financial reads.',
    majority:     'Only returns data committed by a majority — prevents dirty reads. Recommended for financial data.',
    linearizable: 'Strongest: guarantees reads reflect all prior majority-committed writes. Reads always go to Primary and coordinate with majority — adds round-trip latency.',
    snapshot:     'Consistent point-in-time snapshot across the transaction. Required for multi-document ACID transactions.',
  };
  const rpDescs = {
    primary:           'Reads always go to the Primary — guarantees zero replication lag.',
    primaryPreferred:  'Prefer Primary; automatically fall back to Secondary if Primary is unreachable.',
    secondary:         'Always read from a Secondary — may see stale data, but reduces load on Primary.',
    secondaryPreferred:'Prefer Secondary for read scaling; falls back to Primary if none available.',
    nearest:           'Read from geographically closest node (lowest ping). Best latency, may be stale.',
  };

  const set = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
  set('wc-w-desc',  wcDescs[wc] || '');
  set('wc-j-desc',  jDescs[j ? 'true' : 'false'] || '');
  set('wc-rc-desc', rcDescs[rc] || '');
  set('wc-rp-desc', rpDescs[rp] || '');

  // Mode label
  const labels = { w0: '⚡ Max Throughput', w1: 'Durable (Primary)', wmaj: '✅ Recommended', wall: '🔒 Max Durability' };
  const el = $('wc-mode-label'); if (el) el.textContent = labels[wc] || '';

  wcRender();
  updateCAP();
  log('INFO', 'CONCERNS', `w:${wc} j:${j} readPreference:${rp} readConcern:${rc}`);
}

async function wcSimWrite() {
  const btn = $('btn-sim-write'); btn.disabled = true;
  const wc  = $('wc-w')?.value || 'wmaj';
  const j   = $('wc-j')?.value === 'true';
  const acks = wc === 'w0' ? 0 : wc === 'w1' ? 1 : wc === 'wmaj' ? 2 : 3;
  log('INFO', 'WRITE', 'Driver sending write operation to Primary...');
  await sleep(250);
  if (j) { log('INFO', 'WRITE', 'Primary applying write to oplog + journal (disk flush)...'); await sleep(300); }
  else   { log('INFO', 'WRITE', 'Primary applying write to memory buffer (no journal flush)...'); await sleep(150); }
  if (acks === 0) {
    log('WARN', 'WRITE', 'w:0 — driver returned immediately. No acknowledgment sent by server.');
  } else {
    log('SUCCESS', 'WRITE', 'Primary applied write → ACK (w:1)');
    if (acks >= 2) { await sleep(480); log('SUCCESS', 'WRITE', 'Secondary rs1 applied via oplog replication → majority (2/3) reached'); }
    if (acks === 3){ await sleep(320); log('SUCCESS', 'WRITE', 'Secondary rs2 applied → all nodes confirmed (w:all)'); }
    log('SUCCESS', 'WRITE', `✓ Write committed — ${acks} node${acks > 1 ? 's' : ''} acknowledged. Driver unblocked.`);
  }
  await sleep(300); btn.disabled = false;
}

async function wcSimRead() {
  const btn = $('btn-sim-read'); btn.disabled = true;
  const rp  = $('wc-rp')?.value || 'primary';
  const rc  = $('wc-rc')?.value || 'majority';
  const targets = {
    primary:           'rs0 (PRIMARY)',
    primaryPreferred:  'rs0 (PRIMARY, preferred)',
    secondary:         'rs1 (SECONDARY)',
    secondaryPreferred:'rs1 (SECONDARY, preferred)',
    nearest:           'rs2 (nearest)',
  };
  log('INFO', 'READ', `Read request → driver resolving target node (readPreference: ${rp})`);
  await sleep(300);
  log('INFO', 'READ', `Routing to ${targets[rp]}`);
  await sleep(350);
  if (rc === 'linearizable') {
    log('WARN', 'READ', 'readConcern:linearizable — coordinating with majority to confirm no later writes exist...');
    await sleep(700);
  }
  const freshness = (rc === 'local' || rc === 'available')
    ? 'local node snapshot (may be slightly stale)'
    : rc === 'majority' ? 'majority-committed data'
    : rc === 'linearizable' ? 'linearizable — reflects all prior writes'
    : 'snapshot-consistent (transaction)';
  log('SUCCESS', 'READ', `Document returned. Freshness: ${freshness}`);
  await sleep(300); btn.disabled = false;
}
