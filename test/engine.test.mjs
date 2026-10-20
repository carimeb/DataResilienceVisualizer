// Engine tests. Two layers:
// 1) Doc examples: scenarios MongoDB's public docs spell out, asserted literally (rule id in the test name).
// 2) Exhaustive invariants: every topology within limits x every failure combination, checked against rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, normalize, analyzeTopology, buildNodes, READ_PREFS, READ_CONCERNS, LIMITS } from '../src/engine.js';
import { RULES } from '../src/rules.js';

// mk([[electable, readOnly], ...], { outage:[ri], isolated:[ri], down:[ids], app, settings })
function mk(dist, o = {}) {
  return normalize({
    regions: dist.map(([e, ro = 0], i) => ({ id: `r${i}`, name: `region-${i}`, provider: 'AWS', electable: e, readOnly: ro, outage: (o.outage || []).includes(i), isolated: (o.isolated || []).includes(i) })),
    down: o.down || [],
    app: o.app ?? 'r0',
    settings: { w: 'majority', j: true, rp: 'primary', rc: 'majority', ...(o.settings || {}) },
  });
}
const ev = (m, opts) => evaluate(m, opts);

test('every rule id referenced by the engine exists in rules.js', () => {
  const src = [
    ...JSON.stringify(ev(mk([[2], [2], [1]]))).matchAll(/"([A-Z]+(?:-[A-Z0-9]+)+)"/g),
  ].map((m) => m[1]);
  for (const id of src) if (/^(ELEC|WC|RC|RP|ATLAS|DC|VOTE|FAULT|ROLLBACK|PARTITION|RETRYABLE|CAUSAL)/.test(id)) assert.ok(RULES[id], `missing rule ${id}`);
});

// ---------- Doc examples (DC-TWO / DC-THREE) ----------
test('DC-TWO: 3 members 2+1, losing the majority location → read-only', () => {
  assert.equal(ev(mk([[2], [1]], { outage: [0], app: 'external' })).status, 'NO_MAJORITY');
});
test('DC-TWO: 3 members 2+1, losing the minority location → writable', () => {
  assert.equal(ev(mk([[2], [1]], { outage: [1] })).status, 'WRITABLE');
});
test('DC-TWO: 5 members 3+2, losing location 1 → read-only; losing location 2 → writable', () => {
  assert.equal(ev(mk([[3], [2]], { outage: [0], app: 'external' })).status, 'NO_MAJORITY');
  assert.equal(ev(mk([[3], [2]], { outage: [1] })).status, 'WRITABLE');
});
test('DC-THREE: 1-1-1 and 2-2-1 stay writable when any one location fails', () => {
  for (const dist of [[[1], [1], [1]], [[2], [2], [1]]]) {
    for (let ri = 0; ri < 3; ri++) assert.equal(ev(mk(dist, { outage: [ri], app: 'external' })).status, 'WRITABLE', `${JSON.stringify(dist)} lose ${ri}`);
  }
});
test('FAULT-TOLERANCE table: 3→1, 4→1, 5→2, 6→2, 7→3 (by brute force)', () => {
  const expected = { 3: 1, 4: 1, 5: 2, 6: 2, 7: 3 };
  for (const [V, ft] of Object.entries(expected)) {
    const base = mk([[+V]]);
    const ids = buildNodes(base).map((n) => n.id);
    let maxK = 0;
    for (let k = 0; k <= ids.length; k++) {
      const ok = subsets(ids, k).every((down) => ev({ ...base, down }).status === 'WRITABLE');
      if (ok) maxK = k; else break;
    }
    assert.equal(maxK, ft, `V=${V}`);
    assert.equal(analyzeTopology(base).FT, ft);
  }
});
test('ATLAS-ELECTABLE-COUNT: warning when total electable is not 3, 5 or 7', () => {
  assert.ok(analyzeTopology(mk([[2], [2]])).warnings.some((w) => w.code === 'ATLAS_ELECTABLE_COUNT'));
  assert.ok(!analyzeTopology(mk([[2], [2], [1]])).warnings.some((w) => w.code === 'ATLAS_ELECTABLE_COUNT'));
});

// ---------- Elections & priority ----------
test('ELEC-PRIORITY / ATLAS-PRIORITY-REGION: primary sits in the first region; returns there after recovery', () => {
  const m = mk([[2], [2], [1]]);
  assert.equal(ev(m).primaryId, 'r0:e0');
  const lost = ev(mk([[2], [2], [1]], { outage: [0], app: 'r1' }));
  assert.equal(lost.primaryId, 'r1:e0');
  assert.equal(ev(m, { prevPrimaryId: 'r1:e0' }).primaryId, 'r0:e0');
});
test('ELEC-PRIORITY: same-priority choice keeps the current primary (no needless flapping)', () => {
  assert.equal(ev(mk([[3], [2]]), { prevPrimaryId: 'r0:e2' }).primaryId, 'r0:e2');
});
test('ATLAS-READONLY: read-only nodes never become primary and do not count toward the majority', () => {
  const m = mk([[1, 3], [2]], { outage: [1], app: 'r0' });
  const r = ev(m);
  assert.equal(r.status, 'NO_MAJORITY');
  assert.ok(r.nodes.filter((n) => n.kind === 'readOnly').every((n) => n.role !== 'PRIMARY'));
});

// ---------- Partition (CAP) ----------
test('ELEC-STEPDOWN + PARTITION-TWO-PRIMARIES: isolated old primary accepts w:1 that will roll back; majority blocks', () => {
  const iso = (settings) => mk([[2], [2], [1]], { isolated: [0], app: 'r0', settings });
  const w1 = ev(iso({ w: 1 }), { phase: 'electing', prevPrimaryId: 'r0:e0' });
  assert.equal(w1.steppingDownId, 'r0:e0');
  assert.equal(w1.steadyPrimaryId, 'r1:e0');
  assert.equal(w1.write.outcome, 'ACK');
  assert.deepEqual(w1.write.risks, ['WILL_ROLL_BACK']);
  const wm = ev(iso({ w: 'majority' }), { phase: 'electing', prevPrimaryId: 'r0:e0' });
  assert.equal(wm.write.outcome, 'BLOCKS');
  // w:2 can be satisfied inside the isolated region (2 nodes) but still rolls back
  const w2 = ev(iso({ w: 2 }), { phase: 'electing', prevPrimaryId: 'r0:e0' });
  assert.equal(w2.write.outcome, 'ACK');
  assert.deepEqual(w2.write.risks, ['WILL_ROLL_BACK']);
});
test('After step-down: app inside the isolated region cannot write; nearest/secondary reads continue (stale)', () => {
  const s = (settings) => ev(mk([[2], [2], [1]], { isolated: [0], app: 'r0', settings }), { prevPrimaryId: 'r0:e0' });
  assert.equal(s({}).write.outcome, 'PRIMARY_UNREACHABLE');
  assert.equal(s({}).read.outcome, 'NO_PRIMARY');
  const near = s({ rp: 'nearest', rc: 'majority' }).read;
  assert.equal(near.outcome, 'OK');
  assert.ok(near.targetId.startsWith('r0:'));
  assert.ok(near.risks.includes('STALE'));
});
test('App outside the isolated region keeps writing to the new primary', () => {
  const r = ev(mk([[2], [2], [1]], { isolated: [0], app: 'r1' }), { prevPrimaryId: 'r0:e0' });
  assert.equal(r.write.outcome, 'ACK');
  assert.equal(r.write.targetId, 'r1:e0');
});

// ---------- Write concern ----------
test('ATLAS-WC-ADJUSTS / WC-N: one node down, w:majority still acks, w:3 (all) blocks', () => {
  const base = { down: ['r0:e2'] };
  assert.equal(ev(mk([[3]], { ...base, settings: { w: 'majority' } })).write.outcome, 'ACK');
  assert.equal(ev(mk([[3]], { ...base, settings: { w: 3 } })).write.outcome, 'BLOCKS');
});
test('WC-N: non-voting members count toward w:<n>, so w:2 with read-only nodes is not rollback-safe', () => {
  const r = ev(mk([[3, 2]], { settings: { w: 2 } }));
  assert.equal(r.write.outcome, 'ACK');
  assert.ok(r.write.risks.includes('ROLLBACK_POSSIBLE'));
  assert.equal(r.checks.C.find((c) => c.id === 'ACK_DURABLE').pass, false);
});
test('WC-1 / WC-0 carry rollback / no-ack risks', () => {
  assert.ok(ev(mk([[3]], { settings: { w: 1 } })).write.risks.includes('ROLLBACK_POSSIBLE'));
  assert.ok(ev(mk([[3]], { settings: { w: 0 } })).write.risks.includes('NO_ACK'));
});
test('w:majority in 2-2-1 needs a cross-region acknowledgment; in 3-1-1 it does not', () => {
  assert.equal(ev(mk([[2], [2], [1]])).write.crossRegion, true);
  assert.equal(ev(mk([[3], [1], [1]])).write.crossRegion, false);
});

// ---------- Read preference / concern ----------
test('RC-LINEARIZABLE: only valid with readPreference primary', () => {
  for (const rp of READ_PREFS.filter((x) => x !== 'primary')) assert.equal(ev(mk([[3]], { settings: { rp, rc: 'linearizable' } })).read.outcome, 'INVALID');
});
test('RP-*: no primary → primary errors, primaryPreferred/secondary/nearest read a secondary', () => {
  const m = (rp) => ev(mk([[1], [1], [1]], { outage: [1, 2], settings: { rp } })).read;
  assert.equal(m('primary').outcome, 'NO_PRIMARY');
  for (const rp of ['primaryPreferred', 'secondary', 'secondaryPreferred', 'nearest']) assert.equal(m(rp).outcome, 'OK', rp);
});
test('RP-SECONDARY: secondary errors when only the primary is reachable; secondaryPreferred falls back', () => {
  const m = (rp) => ev(mk([[1], [1], [1]], { isolated: [], down: ['r1:e0'], settings: { rp } }));
  // 2 of 3 up: primary + 1 secondary → secondary works
  assert.equal(m('secondary').read.outcome, 'OK');
  const solo = (rp) => ev(mk([[1]], { settings: { rp } })).read;
  assert.equal(solo('secondary').outcome, 'NO_SECONDARY');
  assert.equal(solo('secondaryPreferred').outcome, 'OK');
});
test('APP_DOWN when the application region is down', () => {
  const r = ev(mk([[2], [2], [1]], { outage: [0], app: 'r0' }));
  assert.equal(r.write.outcome, 'APP_DOWN');
  assert.equal(r.read.outcome, 'APP_DOWN');
});
test('ALL_DOWN when every node is down', () => {
  assert.equal(ev(mk([[2], [2], [1]], { outage: [0, 1, 2], app: 'external' })).status, 'ALL_DOWN');
});

// ---------- CAP compass ----------
test('CAP compass: defaults sit on the consistency side; secondary + local + w:1 on the availability side', () => {
  assert.equal(ev(mk([[2], [2], [1]])).cap.mode, 'CP');
  assert.equal(ev(mk([[2], [2], [1]], { settings: { w: 1, rp: 'secondary', rc: 'local' } })).cap.mode, 'AP');
});

// ---------- Normalization ----------
test('normalize: never more than 7 voting members, first region keeps ≥1 electable, stale failures dropped', () => {
  const m = normalize({ regions: [{ id: 'a', electable: 0 }, { id: 'b', electable: 6 }, { id: 'c', electable: 6 }], down: ['zz:e0', 'b:e0'], app: 'nope', settings: {} });
  assert.equal(m.regions.reduce((s, r) => s + r.electable, 0), LIMITS.votingMax);
  assert.equal(m.regions[0].electable, 1);
  assert.deepEqual(m.down, ['b:e0']);
  assert.equal(m.app, 'a');
});

// ---------- Exhaustive invariants ----------
function* topologies() {
  // regions 1..4, electable per region with total 1..7 (first region ≥1), read-only 0..1 per region
  for (let R = 1; R <= 4; R++) {
    for (const e of compositions(R, 7)) {
      if (e[0] < 1) continue;
      for (let mask = 0; mask < 1 << R; mask++) yield e.map((x, i) => [x, (mask >> i) & 1]);
    }
  }
}
function compositions(R, maxTotal) {
  const out = [];
  const rec = (i, acc, sum) => {
    if (i === R) { if (sum >= 1) out.push(acc.slice()); return; }
    for (let x = 0; x + sum <= maxTotal; x++) { acc.push(x); rec(i + 1, acc, sum + x); acc.pop(); }
  };
  rec(0, [], 0);
  return out;
}
function subsets(arr, k) {
  const res = [];
  const rec = (i, acc) => {
    if (acc.length === k) { res.push(acc.slice()); return; }
    for (let j = i; j < arr.length; j++) { acc.push(arr[j]); rec(j + 1, acc); acc.pop(); }
  };
  rec(0, []);
  return res;
}
let seed = 42;
const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
const W_VALUES = [0, 1, 2, 3, 'majority'];

function checkInvariants(m, r, label) {
  const { V, M } = r.topo;
  const prim = r.nodes.filter((n) => n.role === 'PRIMARY');
  assert.ok(prim.length <= 1, `${label}: >1 primary`);
  if (r.phase === 'electing') assert.equal(prim.length, 0, `${label}: primary during election`);
  for (const n of r.nodes) {
    assert.equal(n.role === 'DOWN', !n.alive, `${label}: role/alive mismatch ${n.id}`);
    if (n.kind === 'readOnly') assert.ok(n.role !== 'PRIMARY' && n.role !== 'STEPPING_DOWN', `${label}: read-only primary`);
  }
  // ELEC-MAJORITY: steady primary exists iff some connected group holds a majority of ALL voters
  const groups = {};
  for (const n of r.nodes) if (n.alive && n.kind === 'electable') groups[n.component] = (groups[n.component] || 0) + 1;
  const hasMajority = Object.values(groups).some((c) => c >= M);
  assert.equal(!!r.steadyPrimaryId, hasMajority, `${label}: majority/primary mismatch`);
  if (r.phase === 'steady') {
    assert.equal(!!r.primaryId, hasMajority, `${label}: steady primary`);
    if (r.primaryId) {
      const p = r.nodes.find((n) => n.id === r.primaryId);
      const peers = r.nodes.filter((n) => n.alive && n.kind === 'electable' && n.component === p.component);
      assert.equal(p.priority, Math.max(...peers.map((n) => n.priority)), `${label}: not highest priority`);
    }
  }
  const reach = new Set(r.app.reachableIds);
  // Writes
  const wr = r.write;
  if (wr.ok === true) {
    assert.ok(reach.has(wr.targetId), `${label}: write target unreachable`);
    const t = r.nodes.find((n) => n.id === wr.targetId);
    assert.ok(t.role === 'PRIMARY' || t.role === 'STEPPING_DOWN', `${label}: write to non-primary`);
    if (t.role === 'STEPPING_DOWN') assert.ok(wr.risks.includes('WILL_ROLL_BACK'), `${label}: stepping write without rollback risk`);
    if (m.settings.w !== 0) {
      assert.equal(wr.ackIds.length, wr.acksNeeded, `${label}: ack count`);
      assert.equal(new Set(wr.ackIds).size, wr.ackIds.length, `${label}: dup acks`);
      for (const id of wr.ackIds) {
        const a = r.nodes.find((n) => n.id === id);
        assert.ok(a.alive && a.component === t.component, `${label}: ack from unreachable ${id}`);
        if (m.settings.w === 'majority') assert.equal(a.kind, 'electable', `${label}: non-voter in majority ack`);
      }
    }
  }
  if (r.phase === 'steady' && m.settings.w === 'majority' && !r.app.down) {
    assert.equal(wr.outcome === 'ACK', !!r.primaryId && reach.has(r.primaryId), `${label}: majority ack iff primary reachable`);
  }
  // Reads
  const rd = r.read;
  if (m.settings.rc === 'linearizable' && m.settings.rp !== 'primary' && !r.app.down) assert.equal(rd.outcome, 'INVALID');
  if (rd.ok === true) {
    assert.ok(reach.has(rd.targetId), `${label}: read target unreachable`);
    const t = r.nodes.find((n) => n.id === rd.targetId);
    assert.equal(rd.risks.includes('STALE'), t.role !== 'PRIMARY', `${label}: stale flag`);
    if (m.settings.rp === 'primary') assert.ok(t.role === 'PRIMARY' || t.role === 'STEPPING_DOWN', `${label}: rp primary read from secondary`);
    if (m.settings.rp === 'secondary') assert.ok(t.role !== 'PRIMARY' && t.role !== 'STEPPING_DOWN', `${label}: rp secondary read from primary`);
  }
  if (!r.app.down && m.settings.rp !== 'primary' && m.settings.rc !== 'linearizable') {
    // ELEC-NO-WRITES: non-primary modes keep reading while any eligible member is reachable
    const eligible = m.settings.rp === 'secondary' ? r.nodes.filter((n) => reach.has(n.id) && n.role !== 'PRIMARY' && n.role !== 'STEPPING_DOWN') : r.nodes.filter((n) => reach.has(n.id));
    assert.equal(rd.ok === true, eligible.length > 0, `${label}: read availability`);
  }
  for (const id of [...wr.rules, ...rd.rules, ...r.statusRules]) assert.ok(RULES[id], `${label}: unknown rule ${id}`);
}

test('exhaustive: every topology × every single-node failure set (≤ 9 nodes) × region states', () => {
  let count = 0;
  for (const dist of topologies()) {
    const base = mk(dist);
    const ids = buildNodes(base).map((n) => n.id);
    const R = dist.length;
    const topo = analyzeTopology(base);
    // static region-loss analysis must agree with dynamic evaluation
    if (R > 1) {
      for (let ri = 0; ri < R; ri++) {
        const dyn = ev(mk(dist, { outage: [ri], app: 'external' })).status === 'WRITABLE';
        assert.equal(topo.regionLoss[ri].survives, dyn, `${JSON.stringify(dist)} region ${ri}`);
      }
    }
    // all node-down subsets for small clusters; sampled otherwise
    const nSub = ids.length <= 9 ? 1 << ids.length : 512;
    for (let k = 0; k < nSub; k++) {
      const mask = ids.length <= 9 ? k : rnd(1 << ids.length);
      const down = ids.filter((_, i) => (mask >> i) & 1);
      const settings = { w: W_VALUES[rnd(5)], j: rnd(2) === 0, rp: READ_PREFS[rnd(5)], rc: READ_CONCERNS[rnd(5)] };
      const regionState = Array.from({ length: R }, () => rnd(4)); // 0 normal,1 normal,2 outage,3 isolated
      const appIdx = rnd(R + 1);
      const m = mk(dist, {
        down,
        outage: regionState.map((s, i) => (s === 2 ? i : -1)).filter((i) => i >= 0),
        isolated: regionState.map((s, i) => (s === 3 ? i : -1)).filter((i) => i >= 0),
        app: appIdx === R ? 'external' : `r${appIdx}`,
        settings,
      });
      const steady = ev(m, { prevPrimaryId: ids[rnd(ids.length)] });
      checkInvariants(m, steady, `${JSON.stringify(dist)} down=${down} ${JSON.stringify(settings)}`);
      const prev = ids[rnd(ids.length)];
      checkInvariants(m, ev(m, { phase: 'electing', prevPrimaryId: prev }), `electing ${JSON.stringify(dist)} down=${down} prev=${prev}`);
      count += 2;
    }
  }
  assert.ok(count > 100000, `ran ${count}`);
});

test('exhaustive settings sweep on the recommended 2-2-1 topology, every region state', () => {
  const R = 3;
  for (let s = 0; s < 3 ** R; s++) {
    const st = [0, 1, 2].map((i) => Math.floor(s / 3 ** i) % 3);
    for (const w of [0, 1, 2, 3, 4, 5, 'majority']) for (const j of [true, false]) for (const rp of READ_PREFS) for (const rc of READ_CONCERNS) for (const app of ['r0', 'r1', 'r2', 'external']) {
      const m = mk([[2], [2], [1]], { outage: st.map((x, i) => (x === 1 ? i : -1)).filter((i) => i >= 0), isolated: st.map((x, i) => (x === 2 ? i : -1)).filter((i) => i >= 0), app, settings: { w, j, rp, rc } });
      checkInvariants(m, ev(m, { prevPrimaryId: 'r0:e0' }), `sweep ${st} ${w} ${rp} ${rc} ${app}`);
      checkInvariants(m, ev(m, { phase: 'electing', prevPrimaryId: 'r0:e0' }), `sweep-e ${st} ${w} ${rp} ${rc} ${app}`);
    }
  }
});
