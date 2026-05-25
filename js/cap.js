// ─── CAP THEOREM ENGINE ──────────────────────────────────────────────────────

function getCAPScores() {
  let c = 0.5, a = 0.5;
  const tab = S.tab;
  let wc, rp, rc, j;

  if (tab === 'rs') {
    wc = $('rs-wc')?.value || 'wmaj';
    rp = $('rs-rp')?.value || 'primary';
    rc = 'majority'; j = true;
  } else if (tab === 'wc') {
    wc = $('wc-w')?.value  || 'wmaj';
    rp = $('wc-rp')?.value || 'primary';
    rc = $('wc-rc')?.value || 'majority';
    j  = $('wc-j')?.value === 'true';
  } else if (tab === 'mr') {
    wc = 'wmaj'; rp = 'primaryPreferred'; rc = 'majority'; j = true;
    const cfg = MR_CFGS[S.mr.config];
    for (let si = 0; si < cfg.numShards; si++) {
      const st = mrShardStatus(si);
      if (st.down)     a -= 0.30;
      else if (st.readOnly) a -= 0.18;
    }
  } else {
    wc = 'wmaj'; rp = 'primary'; rc = 'majority'; j = true;
  }

  // Write concern deltas
  if      (wc === 'w0')   { c -= 0.40; a += 0.35; }
  else if (wc === 'w1')   { c -= 0.15; a += 0.15; }
  else if (wc === 'wmaj') { c += 0.20; a -= 0.05; }
  else if (wc === 'wall') { c += 0.35; a -= 0.30; }

  // Journal
  if (j) c += 0.05;

  // Read preference deltas
  if      (rp === 'primary')           { c += 0.20; }
  else if (rp === 'primaryPreferred')  { c += 0.10; a += 0.05; }
  else if (rp === 'nearest')           { a += 0.10; }
  else if (rp === 'secondaryPreferred'){ a += 0.15; c -= 0.15; }
  else if (rp === 'secondary')         { a += 0.28; c -= 0.25; }

  // Read concern deltas
  if      (rc === 'linearizable') { c += 0.15; a -= 0.08; }
  else if (rc === 'majority')     { c += 0.08; }
  else if (rc === 'available')    { a += 0.12; c -= 0.10; }
  else if (rc === 'snapshot')     { c += 0.12; a -= 0.05; }

  // Dead nodes in Tab 1 reduce availability
  const dead = S.rs.nodes.filter(n => n.state === 'DOWN').length;
  if (dead > 0) a -= dead * 0.12;

  return { c: clamp(c, 0.05, 0.95), a: clamp(a, 0.05, 0.95) };
}

function updateCAP() {
  const { c, a } = getCAPScores();
  const ratio = c / (c + a);

  // Move dot on triangle
  const ax = 82, ay = 150, cpx = 208, cpy = 68;
  const dx = ax + ratio * (cpx - ax);
  const dy = ay + ratio * (cpy - ay);
  ['cap-dot', 'cap-dot-ring'].forEach(id => {
    const el = $(id);
    if (el) { el.setAttribute('cx', dx); el.setAttribute('cy', dy); }
  });
  const lbl = $('cap-dot-lbl');
  if (lbl) { lbl.setAttribute('x', dx + 10); lbl.setAttribute('y', dy + 4); }

  // Slider dot
  $('cap-slider-dot').style.left = (ratio * 100) + '%';

  // Mode badge
  const badge = $('cap-mode-badge');
  let mode, cls, dotTxt;
  if      (ratio > 0.65) { mode = 'CP — Consistency Priority'; cls = 'cm-cp';  dotTxt = 'CP'; }
  else if (ratio < 0.38) { mode = 'AP — Availability Priority'; cls = 'cm-ap'; dotTxt = 'AP'; }
  else                   { mode = 'Balanced (PA/EC)';            cls = 'cm-bal'; dotTxt = '~'; }
  if (badge) { badge.textContent = mode; badge.className = 'cap-mode ' + cls; }
  if (lbl) lbl.textContent = dotTxt;

  // Qualitative metric labels
  const cLabel   = c > 0.65 ? 'High' : c > 0.4 ? 'Medium' : 'Low';
  const aLabel   = a > 0.65 ? 'High' : a > 0.4 ? 'Medium' : 'Low';
  const durLabel = c > 0.65 ? 'High' : c > 0.4 ? 'Medium' : 'Low';

  // Write latency label — order-of-magnitude based on active write concern
  let _wc = 'wmaj';
  if (S.tab === 'rs') _wc = $('rs-wc')?.value || 'wmaj';
  else if (S.tab === 'wc') _wc = $('wc-w')?.value || 'wmaj';
  const latLabel = _wc === 'w0' ? '< 1ms' : _wc === 'w1' ? '~1–5ms' : _wc === 'wmaj' ? '~10–30ms' : '~50–150ms';
  const latPct   = _wc === 'w0' ? 10      : _wc === 'w1' ? 25       : _wc === 'wmaj' ? 50          : 80;

  const qualPct = { High: 85, Medium: 50, Low: 20 };
  [
    ['consistency', qualPct[cLabel], cLabel,   'var(--green)'],
    ['availability', qualPct[aLabel], aLabel,  'var(--gcp)'],
    ['latency',      latPct,         latLabel, 'var(--warn)'],
  ].forEach(([id, pct, label, color]) => {
    const f = $('m-' + id), v = $('mv-' + id);
    if (f) { f.style.width = pct + '%'; f.style.background = color; }
    if (v) v.textContent = label;
  });
  $('m-durability').style.width  = qualPct[durLabel] + '%';
  $('mv-durability').textContent = durLabel;

  // Narrative description
  const desc = $('cap-desc-text');
  if (desc) {
    if      (ratio > 0.7)  desc.innerHTML = `MongoDB is configured for <span class="cap-hl">strong consistency (CP)</span>. Every read returns the most recently majority-committed write. During a network partition, the minority side will stop accepting writes to preserve data integrity.`;
    else if (ratio > 0.5)  desc.innerHTML = `MongoDB leans <span class="cap-hl">CP with good availability</span>. Majority write acknowledgment ensures durability. Reads from the primary guarantee freshness.`;
    else if (ratio > 0.35) desc.innerHTML = `<span class="cap-hl">Balanced configuration</span>. Reads spread across nodes for throughput. Some staleness is possible on secondary reads.`;
    else                   desc.innerHTML = `MongoDB is configured for <span class="cap-hl">high availability (AP)</span>. Every node can serve reads. Stale reads are possible — data is <em>eventually consistent</em>.`;
  }

  // Active settings table
  const cfg = $('cap-config-tbl');
  if (cfg) {
    const tab = S.tab;
    let wc = '—', rp = '—', rc = '—';
    if (tab === 'rs') {
      wc = $('rs-wc')?.options[$('rs-wc')?.selectedIndex]?.text || '—';
      rp = $('rs-rp')?.value || '—';
      rc = 'majority';
    }
    if (tab === 'wc') {
      wc = $('wc-w')?.options[$('wc-w')?.selectedIndex]?.text || '—';
      rp = $('wc-rp')?.value || '—';
      rc = $('wc-rc')?.value || '—';
    }
    const healthy = S.rs.nodes.filter(n => n.state === 'HEALTHY').length;
    cfg.innerHTML = `
      <div class="irow"><span class="ik">writeConcern</span><span class="iv">${wc.split('(')[0].trim()}</span></div>
      <div class="irow"><span class="ik">readPreference</span><span class="iv">${rp}</span></div>
      <div class="irow"><span class="ik">readConcern</span><span class="iv">${rc}</span></div>
      <div class="irow"><span class="ik">Nodes Up</span><span class="iv">${healthy}/${S.rs.nodes.length}</span></div>`;
  }
}
