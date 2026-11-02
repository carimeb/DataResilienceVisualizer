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
    { x: 290, y: 160, role: 'PRIMARY',   id: 'rs0' },
    { x: 140, y: 270, role: 'SECONDARY', id: 'rs1' },
    { x: 440, y: 270, role: 'SECONDARY', id: 'rs2' },
  ];
  const readTarget = rp === 'secondary' || rp === 'secondaryPreferred' ? 1
                   : rp === 'nearest' ? 2 : 0;

  let svg = `<svg viewBox="0 0 580 345" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:720px;display:block;margin:0 auto">`;
  svg += `<defs>
    <pattern id="dots2" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="rgba(0,30,43,.12)"/></pattern>
    <marker id="arrWW" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="#00684A"/></marker>
    <marker id="arrAK" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="#00684A"/></marker>
    <marker id="arrW0" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="rgba(0,30,43,.54)"/></marker>
    <marker id="arrRR" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="#006EFF"/></marker>
    <marker id="arrOL" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="rgba(0,104,74,0.65)"/></marker>
  </defs>`;
  svg += `<rect width="580" height="345" fill="url(#dots2)" rx="8"/>`;

  // CLIENT APP
  svg += `<rect x="200" y="10" width="180" height="30" rx="8" fill="#fff" stroke="rgba(0,30,43,.22)" stroke-width="1.5"/>
    <text x="290" y="29" text-anchor="middle" font-size="10" fill="rgba(0,30,43,.74)" font-family="Lexend Deca,sans-serif">CLIENT APPLICATION</text>`;

  // ── WRITE PATH: App → Primary ──
  const pri = npos[0];
  // Three separate lanes above the Primary: READ left, WRITE center, ACK right.
  const topY = 43, nodeTop = pri.y - 28;

  if (acksNeeded === 0) {
    // w:0 sends the write but does not wait for an ACK.
    svg += `<line x1="286" y1="${topY}" x2="286" y2="${nodeTop}" stroke="rgba(0,30,43,.54)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#arrW0)"/>`;
    svg += `<rect x="291" y="85" width="53" height="14" rx="4" fill="#FAFBFC" stroke="rgba(0,30,43,.22)"/>`;
    svg += `<text x="317.5" y="95" text-anchor="middle" font-size="8" fill="rgba(0,30,43,.65)" font-family="Lexend Deca,sans-serif">WRITE (w:0)</text>`;
    svg += `<text x="350" y="112" font-size="8" fill="rgba(0,30,43,.54)" font-family="Lexend Deca,sans-serif">no ACK</text>`;
  } else {
    svg += `<line x1="286" y1="${topY}" x2="286" y2="${nodeTop}" stroke="#00684A" stroke-width="2" stroke-dasharray="6 3" class="repl" marker-end="url(#arrWW)"/>`;
    svg += `<rect x="292" y="84" width="39" height="14" rx="4" fill="#E3FCF7"/>`;
    svg += `<text x="311.5" y="94" text-anchor="middle" font-size="8" font-weight="700" fill="#00684A" font-family="Lexend Deca,sans-serif">WRITE</text>`;
    // ACK travels back in its own right-hand lane.
    svg += `<line x1="316" y1="${nodeTop}" x2="344" y2="${topY}" stroke="#00684A" stroke-width="1.5" stroke-dasharray="5 3" marker-end="url(#arrAK)"/>`;
    svg += `<rect x="346" y="94" width="32" height="14" rx="4" fill="#E3FCF7"/>`;
    svg += `<text x="362" y="104" text-anchor="middle" font-size="8" font-weight="700" fill="#00684A" font-family="Lexend Deca,sans-serif">ACK</text>`;
  }

  // ── REPLICATION LINES: Primary → Secondaries ──
  for (let i = 1; i <= 2; i++) {
    const sec = npos[i];
    const needsAck = acksNeeded > i;
    const color = needsAck ? 'rgba(0,104,74,0.6)' : 'rgba(0,30,43,.22)';
    const sw    = needsAck ? 2 : 1.5;
    const cls   = needsAck ? 'class="repl"' : 'stroke-dasharray="4 4"';
    svg += `<line x1="${pri.x}" y1="${pri.y}" x2="${sec.x}" y2="${sec.y - 28}" stroke="${color}" stroke-width="${sw}" ${cls} ${needsAck ? 'marker-end="url(#arrOL)"' : ''}/>`;
    const mx = (pri.x + sec.x) / 2 + (i === 1 ? -14 : 8);
    const my = (pri.y + sec.y - 28) / 2 - 4;
    if (needsAck) {
      svg += `<rect x="${mx - 16}" y="${my - 8}" width="32" height="13" rx="3" fill="#E3FCF7"/>`;
      svg += `<text x="${mx}" y="${my + 1}" text-anchor="middle" font-size="8" fill="#00684A" font-family="Lexend Deca,sans-serif">oplog</text>`;
    }
  }

  // ── READ PATH ──
  const rt   = npos[readTarget];
  const readStartX = readTarget === 2 ? 348 : 232;
  const readEndX = readTarget === 0 ? 262 : rt.x + (readTarget === 1 ? 12 : -12);
  const readLabelX = readTarget === 0 ? 176 : readTarget === 1 ? 133 : 380;
  const readLabelY = readTarget === 0 ? 84 : 108;
  svg += `<line x1="${readStartX}" y1="${topY}" x2="${readEndX}" y2="${rt.y - 28}" stroke="#006EFF" stroke-width="1.8" stroke-dasharray="8 4" marker-end="url(#arrRR)"/>`;
  svg += `<rect x="${readLabelX}" y="${readLabelY}" width="66" height="14" rx="4" fill="#EEF4FF" stroke="rgba(0,110,255,.35)"/>`;
  svg += `<text x="${readLabelX + 33}" y="${readLabelY + 10}" text-anchor="middle" font-size="8" fill="#0057CC" font-family="Lexend Deca,sans-serif">READ → ${rt.id}</text>`;

  // ── NODES ──
  npos.forEach((pos, i) => {
    const isPri    = i === 0;
    const isReadTgt = i === readTarget;
    const hasAck   = (isPri && acksNeeded >= 1) || (!isPri && acksNeeded > i);
    svg += `<g>`;
    if (isPri) svg += `<circle cx="${pos.x}" cy="${pos.y}" r="36" fill="none" stroke="rgba(0,237,100,0.3)" stroke-width="1.5" class="pring"/>`;
    svg += mdbNodeIcon(pos.x, pos.y, 54, null, pos.role);
    svg += `<text x="${pos.x}" y="${pos.y + 42}" text-anchor="middle" font-size="9" fill="rgba(0,30,43,.74)" font-family="Lexend Deca,sans-serif">${pos.id}:27017</text>`;
    const bc = isPri ? '#E3FCF7' : '#F9EBFF', tc = isPri ? '#00684A' : '#001E2B';
    svg += `<rect x="${pos.x - 28}" y="${pos.y + 49}" width="56" height="16" rx="8" fill="${bc}"/>`;
    svg += `<text x="${pos.x}" y="${pos.y + 60}" text-anchor="middle" font-size="9" font-weight="700" fill="${tc}" font-family="Lexend Deca,sans-serif">${pos.role}</text>`;
    if (hasAck) {
      svg += `<circle cx="${pos.x + 25}" cy="${pos.y - 25}" r="10" fill="#00684A" stroke="#fff" stroke-width="2"/>`;
      svg += `<text x="${pos.x + 25}" y="${pos.y - 20}" text-anchor="middle" font-size="11" fill="#fff" font-weight="700">✓</text>`;
    }
    if (isReadTgt) {
      svg += `<circle cx="${pos.x - 25}" cy="${pos.y - 25}" r="10" fill="#006EFF" stroke="#fff" stroke-width="2"/>`;
      svg += `<text x="${pos.x - 25}" y="${pos.y - 20}" text-anchor="middle" font-size="10" fill="#fff" font-weight="700">R</text>`;
    }
    svg += `</g>`;
  });

  // ── CORNER PILLS: journal + readConcern ──
  svg += `<rect x="6" y="6" width="86" height="28" rx="6" fill="${j ? '#E3FCF7' : '#FAFBFC'}" stroke="${j ? 'rgba(0,104,74,.3)' : 'rgba(0,30,43,.12)'}" stroke-width="1"/>`;
  svg += `<text x="49" y="17" text-anchor="middle" font-size="8.5" font-weight="700" fill="${j ? '#00684A' : 'rgba(0,30,43,.54)'}" font-family="Lexend Deca,sans-serif">j: ${j ? 'true' : 'false'}</text>`;
  svg += `<text x="49" y="28" text-anchor="middle" font-size="7.5" fill="${j ? '#00684A' : 'rgba(0,30,43,.54)'}" font-family="Lexend Deca,sans-serif">${j ? 'disk journal ✓' : 'memory only'}</text>`;

  const rcColor = rc === 'linearizable' ? '#001E2B' : rc === 'majority' ? '#00684A' : rc === 'snapshot' ? '#006EFF' : '#001E2B';
  const rcBg    = rc === 'linearizable' ? '#F9EBFF' : rc === 'majority' ? '#E3FCF7' : rc === 'snapshot' ? '#F9EBFF' : '#FAFBFC';
  const rcBdr   = rc === 'linearizable' ? 'rgba(0,30,43,.22)' : rc === 'majority' ? 'rgba(0,104,74,.3)' : rc === 'snapshot' ? 'rgba(0,30,43,.22)' : 'rgba(0,30,43,.22)';
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

function wcReset() {
  // Invalidate any pending simulation steps before restoring the controls.
  S.wc.writeRun++;
  S.wc.readRun++;
  $('btn-sim-write').disabled = false;
  $('btn-sim-read').disabled = false;
  $('wc-w').value = S.wc.w;
  $('wc-j').value = String(S.wc.j);
  $('wc-rc').value = S.wc.rc;
  $('wc-rp').value = S.wc.rp;
  wcUpdate();
  log('SUCCESS', 'CONCERNS', 'Reset to resilience baseline · w:"majority" · j:true · readConcern:majority · readPreference:primary');
}

async function wcSimWrite() {
  const btn = $('btn-sim-write'); btn.disabled = true;
  const run = ++S.wc.writeRun;
  const wc  = $('wc-w')?.value || 'wmaj';
  const j   = $('wc-j')?.value === 'true';
  const acks = wc === 'w0' ? 0 : wc === 'w1' ? 1 : wc === 'wmaj' ? 2 : 3;
  log('INFO', 'WRITE', 'Driver sending write operation to Primary...');
  await sleep(250);
  if (run !== S.wc.writeRun) return;
  if (j) { log('INFO', 'WRITE', 'Primary applying write to oplog + journal (disk flush)...'); await sleep(300); }
  else   { log('INFO', 'WRITE', 'Primary applying write to memory buffer (no journal flush)...'); await sleep(150); }
  if (run !== S.wc.writeRun) return;
  if (acks === 0) {
    log('WARN', 'WRITE', 'w:0 — driver returned immediately. No acknowledgment sent by server.');
  } else {
    log('SUCCESS', 'WRITE', 'Primary applied write → ACK (w:1)');
    if (acks >= 2) { await sleep(480); if (run !== S.wc.writeRun) return; log('SUCCESS', 'WRITE', 'Secondary rs1 applied via oplog replication → majority (2/3) reached'); }
    if (acks === 3){ await sleep(320); if (run !== S.wc.writeRun) return; log('SUCCESS', 'WRITE', 'Secondary rs2 applied → all nodes confirmed (w:all)'); }
    log('SUCCESS', 'WRITE', `✓ Write committed — ${acks} node${acks > 1 ? 's' : ''} acknowledged. Driver unblocked.`);
  }
  await sleep(300); if (run === S.wc.writeRun) btn.disabled = false;
}

async function wcSimRead() {
  const btn = $('btn-sim-read'); btn.disabled = true;
  const run = ++S.wc.readRun;
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
  if (run !== S.wc.readRun) return;
  log('INFO', 'READ', `Routing to ${targets[rp]}`);
  await sleep(350);
  if (run !== S.wc.readRun) return;
  if (rc === 'linearizable') {
    log('WARN', 'READ', 'readConcern:linearizable — coordinating with majority to confirm no later writes exist...');
    await sleep(700);
    if (run !== S.wc.readRun) return;
  }
  const freshness = (rc === 'local' || rc === 'available')
    ? 'local node snapshot (may be slightly stale)'
    : rc === 'majority' ? 'majority-committed data'
    : rc === 'linearizable' ? 'linearizable — reflects all prior writes'
    : 'snapshot-consistent (transaction)';
  log('SUCCESS', 'READ', `Document returned. Freshness: ${freshness}`);
  await sleep(300); if (run === S.wc.readRun) btn.disabled = false;
}
