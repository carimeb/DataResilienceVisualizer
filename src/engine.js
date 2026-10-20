// Pure simulation engine: no DOM, no timers, no language. Deterministic.
// Input: a model (topology + failures + settings). Output: roles, cluster status, what the app sees, rule IDs.
// Every outcome carries the RULES ids that justify it (see rules.js).

export const LIMITS = Object.freeze({
  regionsMin: 1,
  regionsMax: 4,
  votingMin: 1,
  votingMax: 7,            // VOTE-LIMIT
  electablePerRegionMax: 7,
  readOnlyPerRegionMax: 3, // visual cap; Atlas allows more members (up to 50)
});

export const READ_PREFS = ['primary', 'primaryPreferred', 'secondary', 'secondaryPreferred', 'nearest'];
export const READ_CONCERNS = ['local', 'available', 'majority', 'linearizable', 'snapshot'];

export const PROVIDERS = {
  AWS: ['us-east-1', 'us-east-2', 'us-west-2', 'sa-east-1', 'eu-west-1'],
  GCP: ['us-east4', 'us-central1', 'southamerica-east1', 'europe-west1', 'us-west1'],
  AZURE: ['eastus', 'eastus2', 'westus2', 'brazilsouth', 'westeurope'],
};

export const nodeId = (regionId, kind, i) => `${regionId}:${kind === 'electable' ? 'e' : 'r'}${i}`;

/** Atlas priority by region order: first region 7, then 6, 5... (ATLAS-PRIORITY-REGION). Read-only nodes: 0. */
export const regionPriority = (regionIndex) => Math.max(1, 7 - regionIndex);

export function buildNodes(model) {
  const nodes = [];
  model.regions.forEach((r, ri) => {
    for (let i = 0; i < r.electable; i++) {
      nodes.push({ id: nodeId(r.id, 'electable', i), regionId: r.id, regionIndex: ri, kind: 'electable', index: i, votes: 1, priority: regionPriority(ri) });
    }
    for (let i = 0; i < r.readOnly; i++) {
      nodes.push({ id: nodeId(r.id, 'readOnly', i), regionId: r.id, regionIndex: ri, kind: 'readOnly', index: i, votes: 0, priority: 0 });
    }
  });
  return nodes;
}

/** Clamp counts to limits, drop failures that point at removed nodes, keep app location valid. Returns a new model. */
export function normalize(model) {
  const regions = model.regions.slice(0, LIMITS.regionsMax).map((r, ri) => ({
    ...r,
    electable: clampInt(r.electable, ri === 0 ? 1 : 0, LIMITS.electablePerRegionMax),
    readOnly: clampInt(r.readOnly, 0, LIMITS.readOnlyPerRegionMax),
    outage: !!r.outage,
    isolated: !!r.isolated,
  }));
  // Enforce the voting limit by trimming from the last region backwards.
  let excess = regions.reduce((s, r) => s + r.electable, 0) - LIMITS.votingMax;
  for (let ri = regions.length - 1; excess > 0 && ri >= 0; ri--) {
    const min = ri === 0 ? 1 : 0;
    const cut = Math.min(excess, regions[ri].electable - min);
    regions[ri].electable -= cut;
    excess -= cut;
  }
  const ids = new Set(buildNodes({ regions }).map((n) => n.id));
  const down = [...new Set(model.down || [])].filter((id) => ids.has(id));
  const app = model.app === 'external' || regions.some((r) => r.id === model.app) ? model.app : regions[0].id;
  const s = model.settings || {};
  const total = ids.size;
  let w = s.w ?? 'majority';
  if (typeof w === 'number') w = clampInt(w, 0, Math.max(1, total));
  return {
    regions,
    down,
    app,
    settings: {
      w,
      j: s.j ?? true,
      rp: READ_PREFS.includes(s.rp) ? s.rp : 'primary',
      rc: READ_CONCERNS.includes(s.rc) ? s.rc : 'majority',
    },
  };
}

function clampInt(v, lo, hi) {
  const n = Number.isFinite(+v) ? Math.round(+v) : lo;
  return Math.min(hi, Math.max(lo, n));
}

/** Static facts about the topology, independent of failures. */
export function analyzeTopology(model) {
  const V = model.regions.reduce((s, r) => s + r.electable, 0);
  const readOnlyTotal = model.regions.reduce((s, r) => s + r.readOnly, 0);
  const M = Math.floor(V / 2) + 1;
  const FT = V - M;
  const regionLoss = model.regions.map((r) => ({ regionId: r.id, survives: V - r.electable >= M }));
  const multiRegion = model.regions.length > 1;
  const survivesAnyRegionLoss = multiRegion && regionLoss.every((x) => x.survives);
  const warnings = [];
  if (![3, 5, 7].includes(V)) warnings.push({ code: 'ATLAS_ELECTABLE_COUNT', params: { V }, rules: ['ATLAS-ELECTABLE-COUNT'] });
  if (V % 2 === 0) warnings.push({ code: 'EVEN_VOTERS', params: { V, FT }, rules: ['FAULT-TOLERANCE'] });
  if (!multiRegion) warnings.push({ code: 'SINGLE_REGION', params: {}, rules: ['ATLAS-REGION-HA'] });
  model.regions.forEach((r) => {
    if (multiRegion && r.electable >= M) warnings.push({ code: 'MAJORITY_IN_REGION', params: { regionId: r.id, n: r.electable, M }, rules: model.regions.length === 2 ? ['DC-TWO'] : ['DC-THREE'] });
  });
  if (model.regions.length === 2) warnings.push({ code: 'TWO_REGIONS', params: {}, rules: ['DC-TWO', 'ATLAS-REGION-HA'] });
  return { V, M, FT, readOnlyTotal, totalMembers: V + readOnlyTotal, regionLoss, survivesAnyRegionLoss, warnings };
}

/**
 * Evaluate the model.
 * opts.phase: 'steady' (after elections settle) | 'electing' (transition window: no new primary yet)
 * opts.prevPrimaryId: primary before the latest change (keeps the same node when several are equally eligible,
 *                     and identifies an old primary that is still alive on the minority side of a partition).
 */
export function evaluate(model, opts = {}) {
  const phase = opts.phase === 'electing' ? 'electing' : 'steady';
  const prevPrimaryId = opts.prevPrimaryId ?? null;
  const topo = analyzeTopology(model);
  const { V, M } = topo;
  const downSet = new Set(model.down);

  const nodes = buildNodes(model).map((n) => {
    const region = model.regions[n.regionIndex];
    const alive = !downSet.has(n.id) && !region.outage;
    const component = region.isolated ? `iso:${region.id}` : 'main';
    return { ...n, alive, component, nodeDown: downSet.has(n.id), regionOutage: region.outage, isolated: region.isolated };
  });
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));

  // Connectivity groups (each isolated region is its own island; the rest stay connected).
  const comps = {};
  for (const n of nodes) {
    if (!n.alive) continue;
    const c = (comps[n.component] ||= { key: n.component, aliveElectable: 0, alive: 0 });
    c.alive++;
    if (n.kind === 'electable') c.aliveElectable++;
  }
  const majorityComp = Object.values(comps).find((c) => c.aliveElectable >= M) || null; // ELEC-MAJORITY (at most one)

  // Steady-state primary: highest priority alive electable member in the majority group (ELEC-PRIORITY).
  let steadyPrimary = null;
  if (majorityComp) {
    const cands = nodes.filter((n) => n.alive && n.kind === 'electable' && n.component === majorityComp.key);
    const maxP = Math.max(...cands.map((n) => n.priority));
    const top = cands.filter((n) => n.priority === maxP);
    steadyPrimary = top.find((n) => n.id === prevPrimaryId) || top[0];
  }

  const prev = prevPrimaryId ? byId[prevPrimaryId] : null;
  // An old primary that is alive but cut off in a minority group keeps acting as primary until it notices (ELEC-STEPDOWN).
  const stepping = phase === 'electing' && prev && prev.alive && prev.kind === 'electable' && (!majorityComp || prev.component !== majorityComp.key) ? prev : null;
  const primary = phase === 'steady' ? steadyPrimary : null;

  for (const n of nodes) {
    n.role = !n.alive ? 'DOWN' : primary && n.id === primary.id ? 'PRIMARY' : stepping && n.id === stepping.id ? 'STEPPING_DOWN' : 'SECONDARY';
  }

  const anyAlive = nodes.some((n) => n.alive);
  let status;
  if (!anyAlive) status = 'ALL_DOWN';
  else if (primary) status = 'WRITABLE';
  else if (phase === 'electing' && steadyPrimary) status = 'ELECTING';
  else status = 'NO_MAJORITY';

  const statusRules = {
    ALL_DOWN: ['ELEC-MAJORITY'],
    WRITABLE: ['ELEC-MAJORITY', 'ELEC-PRIORITY', 'ATLAS-PRIORITY-REGION'],
    ELECTING: ['ELEC-TIMING', 'ELEC-NO-WRITES'],
    NO_MAJORITY: ['ELEC-MAJORITY', 'ELEC-NO-WRITES'],
  }[status].slice();
  if (stepping) statusRules.push('ELEC-STEPDOWN');
  if (model.regions.some((r) => r.outage || r.isolated)) statusRules.push('ATLAS-SIM-OUTAGE');

  // Application placement.
  const appRegion = model.app === 'external' ? null : model.regions.find((r) => r.id === model.app);
  const appDown = !!(appRegion && appRegion.outage);
  const appComponent = appRegion && appRegion.isolated ? `iso:${appRegion.id}` : 'main';
  const reachable = appDown ? [] : nodes.filter((n) => n.alive && n.component === appComponent);
  const ctx = { model, nodes, byId, topo, phase, primary, steadyPrimary, stepping, appRegion, appDown, appComponent, reachable };

  const write = evalWrite(ctx);
  const read = evalRead(ctx);
  const checks = capChecks(model, topo);

  return {
    phase,
    nodes,
    topo,
    status,
    statusRules,
    primaryId: primary ? primary.id : null,
    steadyPrimaryId: steadyPrimary ? steadyPrimary.id : null,
    steppingDownId: stepping ? stepping.id : null,
    majorityComponent: majorityComp ? majorityComp.key : null,
    components: Object.values(comps),
    app: { location: model.app, down: appDown, component: appComponent, reachableIds: reachable.map((n) => n.id) },
    write,
    read,
    checks,
    cap: capPosition(checks),
  };
}

// Order members the way a driver's latency-based selection would: same region as the app first, then region order.
function byProximity(appRegion) {
  return (a, b) =>
    (appRegion ? (a.regionId === appRegion.id ? 0 : 1) - (b.regionId === appRegion.id ? 0 : 1) : 0) ||
    a.regionIndex - b.regionIndex ||
    (a.kind === b.kind ? 0 : a.kind === 'electable' ? -1 : 1) ||
    a.index - b.index;
}

function evalWrite(ctx) {
  const { model, nodes, topo, phase, primary, steadyPrimary, stepping, appDown, appComponent, reachable } = ctx;
  const { w, j } = model.settings;
  const base = { w, j, acksNeeded: 0, ackIds: [], targetId: null, crossRegion: false, risks: [] };
  if (appDown) return { ...base, ok: false, outcome: 'APP_DOWN', rules: [] };

  const canReach = (n) => n && reachable.some((r) => r.id === n.id);
  const target = canReach(primary) ? primary : canReach(stepping) ? stepping : null;

  if (!target) {
    if (phase === 'electing' && steadyPrimary && steadyPrimary.component === appComponent) {
      return { ...base, ok: null, outcome: 'WAITING', rules: w === 0 ? ['ELEC-NO-WRITES', 'ELEC-TIMING', 'WC-0'] : ['ELEC-NO-WRITES', 'ELEC-TIMING', 'RETRYABLE-WRITES'] };
    }
    if (steadyPrimary && steadyPrimary.component !== appComponent) {
      return { ...base, ok: false, outcome: 'PRIMARY_UNREACHABLE', rules: ['ELEC-NO-WRITES', 'RETRYABLE-WRITES'] };
    }
    return { ...base, ok: false, outcome: 'NO_PRIMARY', rules: ['ELEC-MAJORITY', 'ELEC-NO-WRITES', 'RETRYABLE-WRITES'] };
  }

  const group = nodes.filter((n) => n.alive && n.component === target.component);
  const others = group.filter((n) => n.id !== target.id).sort((a, b) =>
    (a.regionId === target.regionId ? 0 : 1) - (b.regionId === target.regionId ? 0 : 1) || byProximity(null)(a, b));
  const votingAvail = group.filter((n) => n.kind === 'electable').length;
  const isStepping = stepping && target.id === stepping.id;
  let acksNeeded, ackPool;
  if (w === 'majority') {
    acksNeeded = topo.M; // calculated majority = min(majority of voters, data-bearing voters); Atlas has no arbiters → M
    ackPool = others.filter((n) => n.kind === 'electable');
  } else {
    acksNeeded = w;
    ackPool = others; // non-voting members count toward w:<n> (WC-N)
  }
  const reachableAcks = w === 0 ? 0 : 1 + ackPool.length;
  const achievable = w === 0 || reachableAcks >= acksNeeded;
  const ackIds = w === 0 ? [] : [target.id, ...ackPool.slice(0, Math.max(0, acksNeeded - 1)).map((n) => n.id)];
  const crossRegion = achievable && ackIds.some((id) => !id.startsWith(`${target.regionId}:`));
  const out = { ...base, acksNeeded: w === 0 ? 0 : acksNeeded, targetId: target.id, ackIds: achievable ? ackIds : [], crossRegion, votingAvail };

  if (isStepping) {
    // Old primary isolated with a minority: may still acknowledge, but anything it accepts rolls back (PARTITION-TWO-PRIMARIES).
    if (!achievable) return { ...out, ok: false, outcome: 'BLOCKS', risks: [], rules: ['PARTITION-TWO-PRIMARIES', 'ELEC-STEPDOWN', w === 'majority' ? 'WC-MAJORITY' : 'WC-N'] };
    return { ...out, ok: true, outcome: w === 0 ? 'SENT' : 'ACK', risks: ['WILL_ROLL_BACK'], rules: ['PARTITION-TWO-PRIMARIES', 'ELEC-STEPDOWN', 'ROLLBACK'] };
  }

  if (w === 0) return { ...out, ok: true, outcome: 'SENT', risks: ['NO_ACK'], rules: ['WC-0', 'ROLLBACK'] };
  if (w === 1) return { ...out, ok: true, outcome: 'ACK', risks: ['ROLLBACK_POSSIBLE'], rules: ['WC-1', 'ROLLBACK'] };
  if (!achievable) return { ...out, ok: false, outcome: 'BLOCKS', risks: [], rules: ['WC-N', 'ATLAS-WC-ADJUSTS'] };

  const rules = [w === 'majority' ? 'WC-MAJORITY' : 'WC-N', 'ROLLBACK'];
  const risks = [];
  if (w === 'majority') {
    if (!j) { risks.push('MAJORITY_CRASH_ROLLBACK'); rules.push('WC-J'); }
    if (nodes.some((n) => n.kind === 'electable' && !n.alive)) rules.push('ATLAS-WC-ADJUSTS');
  } else {
    const roInGroup = group.filter((n) => n.kind === 'readOnly').length;
    const votingGuaranteed = Math.max(1, w - roInGroup);
    if (votingGuaranteed < topo.M) risks.push('ROLLBACK_POSSIBLE');
    else if (!j) { risks.push('MAJORITY_CRASH_ROLLBACK'); rules.push('WC-J'); }
  }
  return { ...out, ok: true, outcome: 'ACK', risks, rules };
}

function evalRead(ctx) {
  const { model, phase, primary, steadyPrimary, stepping, appRegion, appDown, appComponent, reachable } = ctx;
  const { rp, rc } = model.settings;
  const base = { rp, rc, targetId: null, risks: [] };
  const rpRule = { primary: 'RP-PRIMARY', primaryPreferred: 'RP-PRIMARY-PREFERRED', secondary: 'RP-SECONDARY', secondaryPreferred: 'RP-SECONDARY-PREFERRED', nearest: 'RP-NEAREST' }[rp];
  const rcRule = { local: 'RC-LOCAL', available: 'RC-LOCAL', majority: 'RC-MAJORITY', linearizable: 'RC-LINEARIZABLE', snapshot: 'RC-SNAPSHOT' }[rc];
  if (appDown) return { ...base, ok: false, outcome: 'APP_DOWN', rules: [] };
  if (rc === 'linearizable' && rp !== 'primary') return { ...base, ok: false, outcome: 'INVALID', rules: ['RC-LINEARIZABLE'] };

  const has = (n) => n && reachable.some((r) => r.id === n.id);
  const primaryVisible = has(primary) ? primary : has(stepping) ? stepping : null;
  const sorted = reachable.slice().sort(byProximity(appRegion));
  const secondaries = sorted.filter((n) => !primaryVisible || n.id !== primaryVisible.id);
  let target = null;
  if (rp === 'primary') target = primaryVisible;
  else if (rp === 'primaryPreferred') target = primaryVisible || secondaries[0] || null;
  else if (rp === 'secondary') target = secondaries[0] || null;
  else if (rp === 'secondaryPreferred') target = secondaries[0] || primaryVisible || null;
  else target = sorted[0] || null;

  const rules = [rpRule, rcRule];
  if (!target) {
    if (rp === 'primary' && phase === 'electing' && steadyPrimary && steadyPrimary.component === appComponent) {
      return { ...base, ok: null, outcome: 'WAITING', rules: [rpRule, 'ELEC-TIMING'] };
    }
    const outcome = rp === 'primary' ? 'NO_PRIMARY' : rp === 'secondary' ? 'NO_SECONDARY' : 'NO_MEMBER';
    return { ...base, ok: false, outcome, rules: rp === 'primary' ? [rpRule, 'ELEC-NO-WRITES'] : [rpRule] };
  }

  const isStepping = stepping && target.id === stepping.id;
  if (rc === 'linearizable' && isStepping) {
    // Must confirm with a majority before returning; the isolated old primary cannot.
    return { ...base, ok: false, outcome: 'BLOCKS', targetId: target.id, rules: ['RC-LINEARIZABLE', 'ELEC-STEPDOWN'] };
  }
  const risks = [];
  if (target.role !== 'PRIMARY') { risks.push('STALE'); rules.push('RP-STALE'); }
  if (rc === 'local' || rc === 'available') {
    risks.push(isStepping ? 'READS_DOOMED_WRITES' : 'MAY_ROLL_BACK');
    if (isStepping) rules.push('PARTITION-TWO-PRIMARIES');
  }
  return { ...base, ok: true, outcome: 'OK', targetId: target.id, targetRole: target.role, local: !!appRegion && target.regionId === appRegion.id, risks, rules };
}

/** Settings-level guarantees used by the CAP compass. Each check is a yes/no backed by rules. */
export function capChecks(model, topo) {
  const { w, j, rp, rc } = model.settings;
  const votingGuaranteed = typeof w === 'number' ? Math.max(1, w - topo.readOnlyTotal) : 0;
  const ackDurable = j && (w === 'majority' || (typeof w === 'number' && w >= 1 && votingGuaranteed >= topo.M));
  return {
    C: [
      { id: 'ACK_DURABLE', pass: ackDurable, rules: ['ROLLBACK', 'WC-MAJORITY'] },
      { id: 'READS_NO_ROLLBACK', pass: ['majority', 'linearizable', 'snapshot'].includes(rc), rules: ['RC-MAJORITY', 'RC-LOCAL'] },
      { id: 'READS_FRESH', pass: rp === 'primary', rules: ['RP-STALE'] },
    ],
    A: [
      { id: 'WRITES_SURVIVE_MINORITY', pass: typeof w !== 'number' || w <= 1 || w <= topo.totalMembers - topo.FT, rules: ['ATLAS-WC-ADJUSTS', 'WC-N'] },
      { id: 'READS_WITHOUT_PRIMARY', pass: rp !== 'primary' && rc !== 'linearizable', rules: ['ELEC-NO-WRITES', 'RP-PRIMARY'] },
      { id: 'FAST_ACK', pass: w === 0 || w === 1, rules: ['WC-1'] },
    ],
  };
}

export function capPosition(checks) {
  const c = checks.C.filter((x) => x.pass).length / checks.C.length;
  const a = checks.A.filter((x) => x.pass).length / checks.A.length;
  const t = c + a === 0 ? 0.5 : a / (c + a); // 0 = consistency side, 1 = availability side
  const mode = t <= 0.4 ? 'CP' : t >= 0.6 ? 'AP' : 'BALANCED';
  return { c, a, t, mode };
}

/** Did the primary change between two steady states? Used by the UI to run the election window. */
export function transition(prevPrimaryId, nextSteady) {
  return prevPrimaryId !== nextSteady.steadyPrimaryId;
}
