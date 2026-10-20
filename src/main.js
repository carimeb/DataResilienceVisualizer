// App controller: holds state, applies user actions to the model, runs the election window, renders.
import { evaluate, normalize, PROVIDERS, LIMITS } from './engine.js';
import { renderCanvas, nodeLabel } from './canvas.js';
import { statusHtml, factsHtml, settingsHtml, outcomeHtml, capHtml, sourcesHtml, logHtml } from './panel.js';
import { PRESETS } from './presets.js';
import { makeT, STRINGS } from './i18n.js';

const ELECTION_MS = 5000;
const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

const state = {
  lang: store.get('drv-lang') === 'pt' ? 'pt' : 'en',
  model: null,
  prevPrimary: null,     // primary before the current election window (or the current primary when steady)
  phase: 'steady',
  electionEnd: 0,
  timer: null,
  log: [],
  start: Date.now(),
  pending: null,         // scenario follow-up timer
  regionSeq: 10,
};
let t = makeT(state.lang);

function stamp() {
  const s = Math.floor((Date.now() - state.start) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function log(key, params = {}) {
  state.log.push({ at: stamp(), key, params });
  if (state.log.length > 60) state.log.shift();
}
const steadyEval = () => evaluate(state.model, { prevPrimaryId: state.prevPrimary });
const currentEval = () => evaluate(state.model, { phase: state.phase, prevPrimaryId: state.prevPrimary });
const nodeName = (ev, id) => nodeLabel(t, state.model, ev.nodes.find((n) => n.id === id));

// ---------- model updates ----------
function apply(next, opts = {}) {
  state.model = normalize(next);
  const steady = steadyEval();
  if (opts.silent) { // scenario load: no election animation
    clearElection();
    state.prevPrimary = steady.steadyPrimaryId;
    render();
    return;
  }
  if (state.phase === 'electing') {
    if (steady.steadyPrimaryId === state.prevPrimary) clearElection(); // change reverted
  } else if (steady.steadyPrimaryId !== state.prevPrimary) {
    const prev = steady.nodes.find((n) => n.id === state.prevPrimary);
    const stepping = prev && prev.alive && prev.kind === 'electable';
    if (steady.steadyPrimaryId || stepping) startElection();
    else settle(steady);
  }
  render();
}

function startElection() {
  state.phase = 'electing';
  state.electionEnd = Date.now() + ELECTION_MS;
  log('election');
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    if (Date.now() >= state.electionEnd) finishElection();
    else renderStatusOnly();
  }, 250);
}
function finishElection() {
  clearInterval(state.timer);
  state.timer = null;
  state.phase = 'steady';
  const prevId = state.prevPrimary;
  const steady = steadyEval();
  const prev = steady.nodes.find((n) => n.id === prevId);
  if (prev && prev.alive && prevId !== steady.steadyPrimaryId) log('stepdown', { node: nodeName(steady, prevId) });
  settle(steady);
  render();
}
function settle(steady) {
  if (steady.steadyPrimaryId) {
    if (steady.steadyPrimaryId !== state.prevPrimary) log('elected', { node: nodeName(steady, steady.steadyPrimaryId) });
  } else if (steady.status === 'ALL_DOWN') log('allDown');
  else log('noMajority');
  state.prevPrimary = steady.steadyPrimaryId;
}
function clearElection() {
  clearInterval(state.timer);
  state.timer = null;
  state.phase = 'steady';
}

const clone = (m) => JSON.parse(JSON.stringify(m));
const regionIdx = (m, id) => m.regions.findIndex((r) => r.id === id);

function onAction(act, regionId, nodeIdAttr) {
  const m = clone(state.model);
  const ri = regionIdx(m, regionId);
  const r = m.regions[ri];
  const ev = currentEval();
  switch (act) {
    case 'node': {
      const node = ev.nodes.find((n) => n.id === nodeIdAttr);
      if (!node || node.regionOutage) return;
      const down = new Set(m.down);
      if (down.has(node.id)) { down.delete(node.id); log('nodeUp', { node: nodeName(ev, node.id) }); }
      else { down.add(node.id); log('nodeDown', { node: nodeName(ev, node.id) }); }
      m.down = [...down];
      break;
    }
    case 'outage':
      r.outage = !r.outage;
      if (r.outage) r.isolated = false;
      log(r.outage ? 'outage' : 'outageEnd', { region: r.name });
      break;
    case 'isolate':
      if (r.outage) return;
      r.isolated = !r.isolated;
      log(r.isolated ? 'isolate' : 'reconnect', { region: r.name });
      break;
    case 'e-plus': r.electable++; log('topo', { desc: `${r.name} +1 ${t('kind.electable')}` }); break;
    case 'e-minus': r.electable--; log('topo', { desc: `${r.name} −1 ${t('kind.electable')}` }); break;
    case 'r-plus': r.readOnly++; log('topo', { desc: `${r.name} +1 ${t('kind.readOnly')}` }); break;
    case 'r-minus': r.readOnly--; log('topo', { desc: `${r.name} −1 ${t('kind.readOnly')}` }); break;
    case 'provider': {
      const order = Object.keys(PROVIDERS);
      r.provider = order[(order.indexOf(r.provider) + 1) % order.length];
      r.name = freeName(m, r.provider, r.id);
      log('topo', { desc: `${r.provider} ${r.name}` });
      break;
    }
    case 'rename': {
      const list = PROVIDERS[r.provider];
      const used = new Set(m.regions.filter((x) => x.id !== r.id).map((x) => x.name));
      for (let k = 1; k <= list.length; k++) {
        const cand = list[(list.indexOf(r.name) + k) % list.length];
        if (!used.has(cand)) { r.name = cand; break; }
      }
      log('topo', { desc: r.name });
      break;
    }
    case 'remove':
      if (m.regions.length <= 1 || ri === 0) return;
      log('topo', { desc: `− ${r.name}` });
      m.regions.splice(ri, 1);
      break;
    case 'up':
      if (ri <= 0) return;
      [m.regions[ri - 1], m.regions[ri]] = [m.regions[ri], m.regions[ri - 1]];
      log('topo', { desc: `${r.name} ▲` });
      break;
    case 'add-region': {
      if (m.regions.length >= LIMITS.regionsMax) return;
      const provider = m.regions[m.regions.length - 1].provider;
      const total = m.regions.reduce((s, x) => s + x.electable, 0);
      const nr = { id: `r${state.regionSeq++}`, provider, name: freeName(m, provider), electable: total < LIMITS.votingMax ? 1 : 0, readOnly: total < LIMITS.votingMax ? 0 : 1, outage: false, isolated: false };
      m.regions.push(nr);
      log('topo', { desc: `+ ${nr.name}` });
      break;
    }
    default: return;
  }
  apply(m);
}

function freeName(m, provider, selfId) {
  const used = new Set(m.regions.filter((x) => x.id !== selfId).map((x) => x.name));
  return PROVIDERS[provider].find((n) => !used.has(n)) || `${provider.toLowerCase()}-${state.regionSeq}`;
}

function onSetting(id, value) {
  const m = clone(state.model);
  const s = m.settings;
  if (id === 'set-app') m.app = value;
  if (id === 'set-w') s.w = value === 'majority' ? 'majority' : Number(value);
  if (id === 'set-j') s.j = value;
  if (id === 'set-rp') s.rp = value;
  if (id === 'set-rc') s.rc = value;
  const desc = id === 'set-app' ? `app → ${value === 'external' ? t('external') : (m.regions.find((r) => r.id === value) || {}).name}` : id === 'set-j' ? `j: ${value}` : id === 'set-w' ? `w: ${s.w}` : `${id === 'set-rp' ? 'readPreference' : 'readConcern'}: ${value}`;
  log('settings', { desc });
  apply(m);
}

function loadPreset(id) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return;
  clearTimeout(state.pending);
  log('scenario', { name: p.name[state.lang] });
  apply(p.base(), { silent: true });
  if (p.then) state.pending = setTimeout(() => apply(p.then(clone(state.model))), 900);
}

function restoreAll() {
  const m = clone(state.model);
  m.down = [];
  m.regions.forEach((r) => { r.outage = false; r.isolated = false; });
  log('restored');
  apply(m);
}

// ---------- rendering ----------
function renderStatusOnly() {
  const ev = currentEval();
  const secs = Math.max(0, Math.ceil((state.electionEnd - Date.now()) / 1000));
  $('status').innerHTML = statusHtml(state.model, ev, t, state.lang, secs, ELECTION_MS / 1000);
}

function render() {
  const ev = currentEval();
  const { svg, geo } = renderCanvas(state.model, ev, t);
  const wrap = $('canvas');
  const scrollLeft = wrap.scrollLeft;
  wrap.innerHTML = svg;
  wrap.scrollLeft = scrollLeft;
  const svgEl = wrap.querySelector('svg');
  svgEl.style.minWidth = `${Math.round(geo.width * 0.72)}px`;
  svgEl.removeAttribute('width');
  svgEl.removeAttribute('height');
  renderStatusOnly();
  $('facts').innerHTML = factsHtml(state.model, ev, t, state.lang);
  const active = document.activeElement && document.activeElement.id;
  $('settings').innerHTML = settingsHtml(state.model, ev, t);
  if (active && $(active)) $(active).focus();
  $('outcome').innerHTML = outcomeHtml(state.model, ev, t, state.lang);
  $('cap').innerHTML = capHtml(state.model, ev, t, state.lang);
  $('sources').innerHTML = sourcesHtml(ev, state.lang, t);
  $('log').innerHTML = logHtml(state.log, t);
}

function renderChrome() {
  document.documentElement.lang = state.lang === 'pt' ? 'pt-BR' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $('quick-list').innerHTML = STRINGS[state.lang].quick.map((q) => `<li>${q}</li>`).join('');
  const sel = $('scenario');
  sel.innerHTML = `<option value="">${t('scenarioPick')}</option>` + PRESETS.map((p) => `<option value="${p.id}">${p.name[state.lang]}</option>`).join('');
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
}

// ---------- wiring ----------
function init() {
  const quickHidden = store.get('drv-quick') === 'hidden';
  $('quick').hidden = quickHidden;
  state.model = normalize(PRESETS[0].base());
  state.prevPrimary = steadyEval().steadyPrimaryId;
  log('scenario', { name: PRESETS[0].name[state.lang] });
  renderChrome();
  render();

  const canvas = $('canvas');
  const fire = (target) => {
    const g = target.closest('[data-act]');
    if (!g || g.classList.contains('disabled')) return;
    onAction(g.dataset.act, g.dataset.region || (g.dataset.node ? g.dataset.node.split(':')[0] : ''), g.dataset.node);
  };
  canvas.addEventListener('click', (e) => fire(e.target));
  canvas.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const focusKey = e.target.closest('[data-act]');
    const sig = focusKey && `${focusKey.dataset.act}|${focusKey.dataset.region}|${focusKey.dataset.node}`;
    fire(e.target);
    if (sig) { // keep keyboard focus on the same control after re-render
      const [act, region, node] = sig.split('|');
      const sel = node && node !== 'undefined' ? `[data-node="${node}"]` : `[data-act="${act}"][data-region="${region}"]`;
      const again = canvas.querySelector(sel);
      if (again) again.focus();
    }
  });
  $('settings').addEventListener('change', (e) => {
    const el = e.target;
    if (!el.id) return;
    onSetting(el.id, el.type === 'checkbox' ? el.checked : el.value);
  });
  $('scenario').addEventListener('change', (e) => { if (e.target.value) loadPreset(e.target.value); e.target.value = ''; });
  $('restore').addEventListener('click', restoreAll);
  $('help').addEventListener('click', () => { const q = $('quick'); q.hidden = !q.hidden; store.set('drv-quick', q.hidden ? 'hidden' : 'shown'); });
  $('quick-hide').addEventListener('click', () => { $('quick').hidden = true; store.set('drv-quick', 'hidden'); });
  document.querySelectorAll('.lang button').forEach((b) => b.addEventListener('click', () => {
    state.lang = b.dataset.lang;
    store.set('drv-lang', state.lang);
    t = makeT(state.lang);
    renderChrome();
    render();
  }));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

// Test hook (used by the e2e suite; harmless in production)
window.__drv = { get state() { return state; }, evaluate: currentEval, loadPreset, apply: (m) => apply(m), finishElection };
