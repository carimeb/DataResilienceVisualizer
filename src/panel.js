// Side panel + status + facts: HTML strings built from the evaluation. Language-aware, no state.
import { RULES } from './rules.js';
import { READ_PREFS, READ_CONCERNS } from './engine.js';
import { nodeLabel } from './canvas.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uniq = (a) => [...new Set(a)];

export function ruleChips(ids, lang) {
  return uniq(ids).map((id) => {
    const r = RULES[id];
    return `<a class="rule" href="${r.url}" target="_blank" rel="noopener" title="${esc(r[lang] || r.en)}">${id}</a>`;
  }).join('');
}

const regionName = (model, id) => (model.regions.find((r) => r.id === id) || {}).name || '';
const nodeById = (ev, id) => ev.nodes.find((n) => n.id === id);

export function statusHtml(model, ev, t, lang, secondsLeft, electionSeconds = 5) {
  const sev = { WRITABLE: 'ok', ELECTING: 'warn', NO_MAJORITY: 'info', ALL_DOWN: 'bad' }[ev.status];
  const prim = ev.primaryId ? nodeById(ev, ev.primaryId) : null;
  const have = Math.max(0, ...ev.components.map((c) => c.aliveElectable));
  const text = t(`status.${ev.status}`, { region: prim ? regionName(model, prim.regionId) : '', s: secondsLeft, have, V: ev.topo.V, M: ev.topo.M });
  const extra = [];
  if (ev.steppingDownId) extra.push(t('stepping', { region: regionName(model, nodeById(ev, ev.steppingDownId).regionId) }));
  if (ev.phase === 'electing') extra.push(t('electNote', { s: electionSeconds }));
  return `<div class="status sev-${sev}" role="status" aria-live="polite">
    <div class="status-main"><span class="status-dot" aria-hidden="true"></span><strong>${esc(text)}</strong></div>
    ${extra.length ? `<div class="status-extra">${extra.map(esc).join(' ')}</div>` : ''}
    <div class="chips">${ruleChips(ev.statusRules, lang)}</div>
  </div>`;
}

export function factsHtml(model, ev, t, lang) {
  const { V, M, FT, totalMembers, survivesAnyRegionLoss, warnings } = ev.topo;
  const multi = model.regions.length > 1;
  const fact = (label, value, cls = '') => `<div class="fact ${cls}"><span class="fact-label">${esc(label)}</span><span class="fact-value">${esc(value)}</span></div>`;
  const warnText = (w) => t(`warn.${w.code}`, { ...w.params, Vm1: (w.params.V || 1) - 1, region: w.params.regionId ? regionName(model, w.params.regionId) : '' });
  return `<div class="facts">
    ${fact(t('facts.voting'), V)}
    ${fact(t('facts.majority'), M)}
    ${fact(t('facts.nodeFT'), FT, FT === 0 ? 'bad' : '')}
    ${fact(t('facts.regionFT'), multi && survivesAnyRegionLoss ? t('facts.yes') : t('facts.no'), multi && survivesAnyRegionLoss ? 'good' : 'bad')}
    ${fact(t('facts.members'), totalMembers)}
  </div>
  ${warnings.length ? `<ul class="warnings">${warnings.map((w) => `<li><span>${esc(warnText(w))}</span> ${ruleChips(w.rules, lang)}</li>`).join('')}</ul>` : ''}`;
}

export function settingsHtml(model, ev, t) {
  const s = model.settings;
  const total = ev.topo.totalMembers;
  const wOpts = [0, 1, 'majority', ...Array.from({ length: Math.max(0, total - 1) }, (_, i) => i + 2)];
  const wLabel = (w) => (w === 0 || w === 1 || w === 'majority' ? t(`wLabel.${w}`) : w === total ? t('wLabel.all', { n: w }) : t('wLabel.n', { n: w }));
  const opt = (v, label, cur) => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${esc(label)}</option>`;
  return `<div class="form">
    <label class="field"><span>${esc(t('appLocation'))}</span>
      <select id="set-app">${model.regions.map((r) => opt(r.id, r.name, model.app)).join('')}${opt('external', t('external'), model.app)}</select></label>
    <label class="field"><span>${esc(t('writeConcern'))}</span>
      <select id="set-w">${wOpts.map((w) => opt(w, wLabel(w), s.w)).join('')}</select></label>
    <label class="check"><input type="checkbox" id="set-j"${s.j ? ' checked' : ''}/> <span>${esc(t('journal'))}</span></label>
    <div class="field-row">
      <label class="field"><span>${esc(t('readPref'))}</span>
        <select id="set-rp">${READ_PREFS.map((v) => opt(v, v, s.rp)).join('')}</select></label>
      <label class="field"><span>${esc(t('readConcern'))}</span>
        <select id="set-rc">${READ_CONCERNS.map((v) => opt(v, v, s.rc)).join('')}</select></label>
    </div>
  </div>`;
}

function riskChips(risks, t) {
  const tone = { ROLLBACK_POSSIBLE: 'warn', NO_ACK: 'warn', WILL_ROLL_BACK: 'bad', MAJORITY_CRASH_ROLLBACK: 'warn', STALE: 'warn', MAY_ROLL_BACK: 'warn', READS_DOOMED_WRITES: 'bad', SAFE_WRITE: 'good', SAFE_READ: 'good', DURABLE_READ: 'good' };
  return risks.map((r) => `<span class="risk ${tone[r]}">${esc(t(`risk.${r}`))}</span>`).join('');
}

export function outcomeHtml(model, ev, t, lang) {
  const w = ev.write, r = ev.read;
  const where = (ids) => {
    const counts = {};
    ids.forEach((id) => { const n = nodeById(ev, id); const name = regionName(model, n.regionId); counts[name] = (counts[name] || 0) + 1; });
    return Object.entries(counts).map(([k, v]) => `${k} ×${v}`).join(', ');
  };
  const target = w.targetId ? nodeById(ev, w.targetId) : null;
  let wText;
  if (w.outcome === 'ACK') wText = w.w === 1 ? t('wOut.ACK1', { region: regionName(model, target.regionId) }) : t('wOut.ACK', { n: w.ackIds.length, where: where(w.ackIds) });
  else if (w.outcome === 'SENT') wText = t('wOut.SENT', { region: regionName(model, target.regionId) });
  else if (w.outcome === 'WAITING') wText = w.w === 0 ? t('wOut.WAITING0') : t('wOut.WAITING');
  else if (w.outcome === 'BLOCKS') wText = t('wOut.BLOCKS', { need: w.acksNeeded, have: w.targetId ? 1 + ev.nodes.filter((n) => n.alive && n.id !== w.targetId && n.component === target.component && (w.w !== 'majority' || n.kind === 'electable')).length : 0 });
  else wText = t(`wOut.${w.outcome}`);
  const wRisks = w.ok === true && w.risks.length === 0 ? ['SAFE_WRITE'] : w.ok === true ? w.risks : [];
  const crossNote = w.ok === true && w.crossRegion && w.w !== 0 && w.w !== 1 ? `<p class="note">${esc(t('wOut.cross'))}</p>` : '';

  let rText;
  if (r.outcome === 'OK') {
    const n = nodeById(ev, r.targetId);
    const roleKey = n.role === 'SECONDARY' && n.kind === 'readOnly' ? 'READ_ONLY' : n.role;
    rText = t('rOut.OK', { role: t(`role.${roleKey}`), region: regionName(model, n.regionId), local: r.local ? t('rOut.local') : '' });
  } else rText = t(`rOut.${r.outcome}`);
  let rRisks = r.ok === true ? r.risks.slice() : [];
  if (r.ok === true && !rRisks.includes('MAY_ROLL_BACK') && !rRisks.includes('READS_DOOMED_WRITES')) rRisks.push(rRisks.includes('STALE') ? 'DURABLE_READ' : 'SAFE_READ');

  const row = (label, ok, text, chips, rules, extra = '', doomed = false) => {
    const cls = doomed ? 'wait' : ok === true ? 'ok' : ok === null ? 'wait' : 'fail';
    const mark = doomed ? '!' : ok === true ? '✓' : ok === null ? '…' : '✕';
    return `<div class="op ${cls}">
    <div class="op-head"><span class="op-kind">${esc(label)}</span><span class="op-state" aria-hidden="true">${mark}</span></div>
    <p class="op-text">${esc(text)}</p>${extra}
    <div class="chips">${chips}</div>
    <div class="chips rules">${ruleChips(rules, lang)}</div>
  </div>`;
  };
  const doomed = (risks) => risks.includes('WILL_ROLL_BACK') || risks.includes('READS_DOOMED_WRITES');
  return row(t('write'), w.ok, wText, riskChips(wRisks, t), w.rules, crossNote, doomed(wRisks)) + row(t('read'), r.ok, rText, riskChips(rRisks, t), r.rules, '', doomed(rRisks));
}

export function capHtml(model, ev, t, lang) {
  const { cap, checks } = ev;
  // Triangle: C top, A bottom-left, P bottom-right. P is always present (partitions happen), so the dot travels
  // between the CP edge midpoint and the AP edge midpoint.
  const C = [130, 18], A = [20, 186], P = [240, 186];
  const mid = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2];
  const cp = mid(C, P), ap = mid(A, P);
  const dx = cp[0] + (ap[0] - cp[0]) * cap.t, dy = cp[1] + (ap[1] - cp[1]) * cap.t;
  const tri = `<svg viewBox="0 0 260 210" class="cap-svg" role="img" aria-label="${esc(t('cap.title'))}: ${esc(t(`cap.mode.${cap.mode}`))}">
    <defs><linearGradient id="cap-grad" gradientUnits="userSpaceOnUse" x1="${cp[0]}" y1="${cp[1]}" x2="${ap[0]}" y2="${ap[1]}"><stop offset="0" class="stop-cp"/><stop offset="1" class="stop-ap"/></linearGradient></defs>
    <polygon points="${C} ${A} ${P}" class="tri"/>
    <line x1="${cp[0]}" y1="${cp[1]}" x2="${ap[0]}" y2="${ap[1]}" class="tri-track"/>
    <text x="${C[0]}" y="${C[1] - 4}" text-anchor="middle" class="tri-label">C</text>
    <text x="${A[0] - 4}" y="${A[1] + 16}" text-anchor="start" class="tri-label">A</text>
    <text x="${P[0] + 4}" y="${P[1] + 16}" text-anchor="end" class="tri-label">P</text>
    <text x="${cp[0] + 8}" y="${cp[1] + 2}" class="tri-end cp">CP</text>
    <text x="${ap[0]}" y="${ap[1] + 16}" text-anchor="middle" class="tri-end ap">AP</text>
    <g class="tri-dot" style="transform: translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)"><circle r="9" class="dot-halo"/><circle r="5.5" class="dot"/></g>
  </svg>`;
  const checkList = (group, items) => `<div class="checks"><div class="checks-title">${esc(group)}</div><ul>${items.map((c) => `<li class="${c.pass ? 'pass' : 'miss'}"><span class="mark" aria-hidden="true">${c.pass ? '✓' : '–'}</span><span>${esc(t(`cap.check.${c.id}`))}</span>${ruleChips(c.rules.slice(0, 1), lang)}</li>`).join('')}</ul></div>`;
  const s = model.settings;
  const causalOk = s.w === 'majority' && s.rc === 'majority';
  return `<div class="cap-top">${tri}<div class="cap-mode mode-${cap.mode.toLowerCase()}">${esc(t(`cap.mode.${cap.mode}`))}</div></div>
    ${checkList(t('cap.groupC'), checks.C)}
    ${checkList(t('cap.groupA'), checks.A)}
    <p class="explain">${esc(t('cap.explain'))} ${ruleChips(['ELEC-MAJORITY', 'ELEC-NO-WRITES'], lang)}</p>
    <p class="explain">${esc(t('cap.pacelc'))} ${esc(ev.write.crossRegion ? t('cap.pacelcCross') : t('cap.pacelcLocal'))}</p>
    <p class="explain ${causalOk ? 'good' : ''}">${esc(t('cap.causal'))} ${ruleChips(['CAUSAL'], lang)}</p>
    <p class="fine">${esc(t('cap.note'))}</p>`;
}

export function sourcesHtml(ev, lang, t) {
  const ids = uniq([...ev.statusRules, ...ev.write.rules, ...ev.read.rules, ...ev.topo.warnings.flatMap((w) => w.rules)]);
  return `<ul class="sources">${ids.map((id) => {
    const r = RULES[id];
    return `<li><div class="src-head"><code>${id}</code> <span>${esc(r[lang] || r.en)}</span></div><blockquote>“${esc(r.quote)}”</blockquote><a href="${r.url}" target="_blank" rel="noopener">${esc(t('openDoc'))} ↗</a></li>`;
  }).join('')}</ul>`;
}

export function logHtml(entries, t) {
  return entries.slice().reverse().map((e) => `<li><time>${e.at}</time><span>${esc(t(`ev.${e.key}`, e.params))}</span></li>`).join('');
}

export { nodeLabel };
