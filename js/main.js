// ─── MAIN — UI WIRING & INITIALISATION ───────────────────────────────────────

function toggleCAPPanel() {
  const main = document.getElementById('main');
  const cap  = document.getElementById('cap');
  const btn  = document.getElementById('cap-toggle-btn');
  const open = main.classList.toggle('cap-visible');
  cap.classList.toggle('cap-visible', open);
  btn.classList.toggle('active', open);
  btn.textContent = open ? '✕ Hide CAP' : '⬡ CAP Positioning';
  if (open) updateCAP();
}

function switchTab(name) {
  S.tab = name;
  document.querySelectorAll('.tc').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  $('tab-' + name).classList.add('active');
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('onclick').includes("'" + name + "'")) btn.classList.add('active');
  });
  if (name === 'rs') { rsRender(); updateConcerns(); }
  if (name === 'wc') { wcRender(); wcUpdate(); }
  if (name === 'mr') { mrRender(); mrUpdateInfo(); }
  updateCAP();
}

window.onload = function () {
  rsRenderProviderSelectors();
  S.rs.nodes = rsBuildNodes();
  rsRender();
  rsUpdateQuorumInfo();
  updateConcerns();

  wcRender();
  wcUpdate();

  S.mr.nodeHealth    = mrInitNodeHealth(MR_CFGS[S.mr.config]);
  S.mr.shardElecting = Array(MR_CFGS[S.mr.config].numShards).fill(false);
  mrRender();
  mrUpdateInfo();

  updateCAP();

  setInterval(() => {
    if (S.tab === 'rs' && !S.rs.electing) {
      const h = S.rs.nodes.filter(n => n.state === 'HEALTHY').length;
      if (h > 0 && Math.random() > 0.7)
        log('INFO', 'HEARTBEAT', `RS heartbeat OK — ${h} nodes healthy`);
    }
  }, 9000);
};
