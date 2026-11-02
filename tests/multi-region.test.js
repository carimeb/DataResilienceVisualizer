const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function createHarness(config = '3r3b') {
  let now = 0;
  let nextTimerId = 1;
  const timers = new Map();
  const elements = new Map();

  function element(id) {
    if (!elements.has(id)) {
      const attributes = new Map();
      const classes = new Set();
      elements.set(id, {
        id, value: '', innerHTML: '', textContent: '', style: {}, dataset: {},
        classList: {
          add: (...names) => names.forEach(name => classes.add(name)),
          remove: (...names) => names.forEach(name => classes.delete(name)),
          contains: name => classes.has(name),
          toggle(name, force) {
            const enabled = force === undefined ? !classes.has(name) : force;
            if (enabled) classes.add(name); else classes.delete(name);
            return enabled;
          },
        },
        setAttribute: (name, value) => attributes.set(name, String(value)),
        getAttribute: name => attributes.get(name) ?? null,
        removeAttribute: name => attributes.delete(name),
        addEventListener() {},
        querySelectorAll: () => [],
      });
    }
    return elements.get(id);
  }

  const context = vm.createContext({
    console,
    document: {
      getElementById: element,
      querySelectorAll: () => [],
      createElement: tag => element(`created-${tag}-${elements.size}`),
    },
    $: element,
    log() {},
    updateCAP() {},
    tx: en => en,
    roleLabel: role => role,
    setTimeout(callback, delay = 0) {
      const id = nextTimerId++;
      timers.set(id, { callback, at: now + Number(delay) });
      return id;
    },
    clearTimeout: id => timers.delete(id),
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/state.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/tab-mr.js'), 'utf8'), context);
  const state = vm.runInContext('S', context);
  const configs = vm.runInContext('MR_CFGS', context);
  const api = vm.runInContext(`({
    mrReset, mrReconfigure, mrToggleNode, mrKillRegion, mrReviveRegion,
    mrCompleteElection, mrShardStatus, mrIsNodePrimary, mrLayout, mrRender
  })`, context);

  function advance(ms) {
    const end = now + ms;
    for (;;) {
      const next = [...timers.entries()]
        .filter(([, timer]) => timer.at <= end)
        .sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
    }
    now = end;
  }

  state.mr.config = config;
  element('mr-config').value = config;
  api.mrReset();
  return { api, state, configs, element, advance };
}

function primaryOf(h, si) {
  const primary = h.api.mrShardStatus(si).primary;
  return primary && { si: primary.si, ri: primary.ri, ni: primary.ni };
}

function assertShardInvariant(h, si) {
  const st = h.api.mrShardStatus(si);
  const cfg = h.configs[h.state.mr.config];
  const markedPrimaries = [];
  cfg.shardDist[si].forEach((count, ri) => {
    for (let ni = 0; ni < count; ni++) {
      if (h.api.mrIsNodePrimary(si, ri, ni)) markedPrimaries.push({ si, ri, ni });
    }
  });
  assert.equal(st.hasMajority, st.healthyNodes >= st.majority);
  assert.ok(markedPrimaries.length <= 1, `Shard ${si} has multiple primaries`);
  if (!st.hasMajority || st.down || st.electing) {
    assert.equal(st.writable, false);
    assert.equal(st.primary, null);
    assert.equal(markedPrimaries.length, 0);
  }
  if (st.primary) {
    assert.equal(h.state.mr.nodeHealth[si][st.primary.ri][st.primary.ni], true);
    assert.deepEqual(markedPrimaries, [primaryOf(h, si)]);
  }
  assert.equal(st.writable, st.hasMajority && !st.electing && !!st.primary);
}

function assertAllShardInvariants(h) {
  const cfg = h.configs[h.state.mr.config];
  for (let si = 0; si < cfg.numShards; si++) assertShardInvariant(h, si);
}

function positions(h) {
  return Array.from(h.api.mrLayout().nodes, node => ({
    id: node.id, si: node.si, ri: node.ri, ni: node.ni, x: node.x, y: node.y,
  })).sort((a, b) => a.si - b.si || a.ri - b.ri || a.ni - b.ni);
}

function svgLinks(h) {
  const svg = h.element('mr-svg-container').innerHTML;
  return [...svg.matchAll(/<(?:path|line)\b[^>]*\bdata-link-state="[^"]+"[^>]*>/g)]
    .map(([tag]) => Object.fromEntries([...tag.matchAll(/\b(data-[\w-]+)="([^"]*)"/g)]
      .map(([, name, value]) => [name, value])));
}

test('every deployment starts with one healthy primary and a majority per shard', () => {
  for (const config of ['3r3b', '3r1b', '2r2b']) {
    const h = createHarness(config);
    const cfg = h.configs[config];
    for (let si = 0; si < cfg.numShards; si++) {
      const st = h.api.mrShardStatus(si);
      assert.equal(st.total, 3);
      assert.equal(st.majority, 2);
      assert.equal(st.healthyNodes, 3);
      assert.equal(st.writable, true);
      assert.equal(primaryOf(h, si).ri, cfg.primaryRegion[si]);
    }
    assertAllShardInvariants(h);
  }
});

test('read and write access distinguish a primary, surviving secondaries, and a full outage', () => {
  const h = createHarness();
  const access = () => {
    const st = h.api.mrShardStatus(0);
    return { reads: st.readAccess, writes: st.writable };
  };
  assert.deepEqual(access(), { reads: 'available', writes: true });
  h.api.mrKillRegion(0);
  assert.deepEqual(access(), { reads: 'secondary_only', writes: false }, 'during election, reads can only target eligible secondaries');
  h.advance(3000);
  assert.deepEqual(access(), { reads: 'available', writes: true });
  h.api.mrKillRegion(1);
  assert.deepEqual(access(), { reads: 'secondary_only', writes: false }, 'a lone survivor must not accept writes');
  assert.match(h.element('mr-svg-container').innerHTML, /data-access="writes" data-availability="blocked"/);
  assert.match(h.element('mr-svg-container').innerHTML, /data-access="reads" data-availability="secondary_only"/);
  h.api.mrKillRegion(2);
  assert.deepEqual(access(), { reads: 'unavailable', writes: false });
  h.api.mrReviveRegion(2);
  assert.deepEqual(access(), { reads: 'secondary_only', writes: false });
  h.api.mrReviveRegion(1);
  h.advance(3000);
  assert.deepEqual(access(), { reads: 'available', writes: true });
});

test('one region failure preserves every shard majority in both three-region patterns', () => {
  for (const config of ['3r3b', '3r1b']) {
    for (let ri = 0; ri < 3; ri++) {
      const h = createHarness(config);
      h.api.mrKillRegion(ri);
      assertAllShardInvariants(h);
      h.advance(3000);
      for (let si = 0; si < 3; si++) {
        const st = h.api.mrShardStatus(si);
        assert.equal(st.healthyNodes, 2);
        assert.equal(st.writable, true);
        assert.notEqual(st.primary.ri, ri);
      }
      assertAllShardInvariants(h);
    }
  }
});

test('the two-region pattern only keeps the shard with two surviving votes writable', () => {
  for (let ri = 0; ri < 2; ri++) {
    const h = createHarness('2r2b');
    h.api.mrKillRegion(ri);
    h.advance(3000);
    const lostHome = h.api.mrShardStatus(ri);
    const other = h.api.mrShardStatus(1 - ri);
    assert.equal(lostHome.healthyNodes, 1);
    assert.equal(lostHome.readOnly, true);
    assert.equal(lostHome.writable, false);
    assert.equal(lostHome.primary, null);
    assert.equal(other.healthyNodes, 2);
    assert.equal(other.writable, true);
    assertAllShardInvariants(h);
  }
});

test('losing another region during an election cannot promote a minority primary', () => {
  const h = createHarness();
  h.api.mrKillRegion(0);
  assert.equal(h.api.mrShardStatus(0).electing, true);
  h.advance(1000);
  h.api.mrKillRegion(1);
  assertAllShardInvariants(h);
  h.advance(5000);
  // A late completion must also re-check the current quorum.
  h.api.mrCompleteElection(0);
  for (let si = 0; si < 3; si++) {
    const st = h.api.mrShardStatus(si);
    assert.equal(st.healthyNodes, 1);
    assert.equal(st.primary, null);
    assert.equal(st.writable, false);
  }
  assertAllShardInvariants(h);
});

test('recovery from a full outage requires a majority before writes can resume', () => {
  for (const config of ['3r3b', '3r1b']) {
    const h = createHarness(config);
    for (let ri = 0; ri < 3; ri++) h.api.mrKillRegion(ri);
    h.advance(3000);
    for (let si = 0; si < 3; si++) {
      assert.equal(h.api.mrShardStatus(si).down, true);
      assert.equal(h.api.mrShardStatus(si).primary, null);
    }
    h.api.mrReviveRegion(0);
    h.advance(3000);
    for (let si = 0; si < 3; si++) {
      assert.equal(h.api.mrShardStatus(si).healthyNodes, 1);
      assert.equal(h.api.mrShardStatus(si).writable, false);
    }
    h.api.mrReviveRegion(1);
    assertAllShardInvariants(h);
    h.advance(3000);
    const elected = [0, 1, 2].map(si => primaryOf(h, si));
    for (let si = 0; si < 3; si++) assert.equal(h.api.mrShardStatus(si).writable, true);
    h.api.mrReviveRegion(2);
    h.advance(3000);
    assert.deepEqual([0, 1, 2].map(si => primaryOf(h, si)), elected);
    assertAllShardInvariants(h);
  }
});

test('restoring a member preserves the healthy primary when a region contains multiple members', () => {
  const h = createHarness('2r2b');
  h.api.mrToggleNode(0, 0, 0);
  h.advance(3000);
  const elected = primaryOf(h, 0);
  assert.ok(elected);
  assert.notDeepEqual(elected, { si: 0, ri: 0, ni: 0 });
  h.api.mrToggleNode(0, 0, 0);
  h.advance(3000);
  assert.deepEqual(primaryOf(h, 0), elected);
  assertAllShardInvariants(h);
});

test('restoring the original primary region preserves the elected healthy primary', () => {
  const h = createHarness();
  h.api.mrKillRegion(0);
  h.advance(3000);
  const elected = primaryOf(h, 0);
  assert.notEqual(elected.ri, 0);
  h.api.mrReviveRegion(0);
  h.advance(3000);
  assert.deepEqual(primaryOf(h, 0), elected);
  assert.equal(h.api.mrShardStatus(0).healthyNodes, 3);
  assertAllShardInvariants(h);
});

test('reset cancels the old election instead of completing a new election early', () => {
  const h = createHarness();
  h.api.mrKillRegion(0);
  h.advance(2000);
  h.api.mrReset();
  for (let si = 0; si < 3; si++) {
    assert.equal(h.api.mrShardStatus(si).healthyNodes, 3);
    assert.equal(h.api.mrShardStatus(si).writable, true);
  }
  h.api.mrKillRegion(0);
  h.advance(1000);
  assert.equal(h.api.mrShardStatus(0).electing, true);
  assert.equal(h.api.mrShardStatus(0).primary, null);
  h.advance(2000);
  assert.equal(h.api.mrShardStatus(0).writable, true);
  assertAllShardInvariants(h);
});

test('configuration changes discard elections belonging to the previous topology', () => {
  const h = createHarness();
  h.api.mrKillRegion(2);
  h.advance(2000);
  h.element('mr-config').value = '2r2b';
  h.api.mrReconfigure();
  assert.equal(h.state.mr.config, '2r2b');
  h.api.mrToggleNode(0, 0, 0);
  h.advance(1000);
  assert.equal(h.api.mrShardStatus(0).electing, true);
  h.advance(2000);
  assert.equal(h.state.mr.nodeHealth.length, 2);
  assert.equal(h.state.mr.primaryRegion.length, 2);
  assert.equal(h.state.mr.shardElecting.length, 2);
  assert.equal(h.api.mrShardStatus(0).writable, true);
  assertAllShardInvariants(h);
});

test('elections for different shards complete independently', () => {
  const h = createHarness();
  h.api.mrToggleNode(0, 0, 0);
  h.advance(1000);
  h.api.mrToggleNode(1, 1, 0);
  h.advance(2000);
  assert.equal(h.api.mrShardStatus(0).writable, true);
  assert.equal(h.api.mrShardStatus(1).electing, true);
  assert.equal(h.api.mrShardStatus(1).writable, false);
  h.advance(1000);
  assert.equal(h.api.mrShardStatus(1).writable, true);
  assertAllShardInvariants(h);
});

test('node identities and positions remain stable through outages, elections, and recovery', () => {
  for (const config of ['3r3b', '3r1b', '2r2b']) {
    const h = createHarness(config);
    const initial = positions(h);
    assert.equal(new Set(initial.map(node => node.id)).size, initial.length);
    for (let ri = 0; ri < h.configs[config].regions.length; ri++) {
      h.api.mrKillRegion(ri);
      assert.deepEqual(positions(h), initial);
      h.advance(3000);
      assert.deepEqual(positions(h), initial);
    }
    for (let ri = 0; ri < h.configs[config].regions.length; ri++) {
      h.api.mrReviveRegion(ri);
      h.advance(3000);
      assert.deepEqual(positions(h), initial);
    }
    assertAllShardInvariants(h);
  }
});

test('rendered replication links never connect different shards or show failed members as operating', () => {
  const h = createHarness();

  function verifyRenderedLinks() {
    h.api.mrRender();
    const svg = h.element('mr-svg-container').innerHTML;
    const nodeIds = new Set([...svg.matchAll(/\bdata-node="([^"]+)"/g)].map(match => match[1]));
    assert.equal(nodeIds.size, 9, 'Failed members must remain visible in their fixed locations');
    const links = svgLinks(h);
    assert.ok(links.length > 0, 'Shard member connections must be visible');
    for (const link of links) {
      const sourceId = link['data-source'];
      const targetId = link['data-target'];
      assert.ok(nodeIds.has(sourceId), `Missing source node ${sourceId}`);
      assert.ok(nodeIds.has(targetId), `Missing target node ${targetId}`);
      const [si, ri, ni] = sourceId.split('-').map(Number);
      const [targetSi, targetRi, targetNi] = targetId.split('-').map(Number);
      assert.equal(si, targetSi, 'Replication links must remain inside the same shard');
      const bothHealthy = h.state.mr.nodeHealth[si][ri][ni] &&
        h.state.mr.nodeHealth[targetSi][targetRi][targetNi];
      const linkState = link['data-link-state'];
      assert.ok(['replicating', 'offline', 'waiting'].includes(linkState));
      if (linkState === 'replicating') {
        assert.equal(bothHealthy, true);
        assert.equal(h.api.mrShardStatus(si).writable, true);
      }
      if (linkState === 'offline') assert.equal(bothHealthy, false);
      if (linkState === 'waiting') {
        assert.equal(bothHealthy, true);
      }
    }
    return links;
  }

  assert.ok(verifyRenderedLinks().some(link => link['data-link-state'] === 'replicating'));
  h.api.mrKillRegion(0);
  assert.ok(verifyRenderedLinks().some(link => link['data-link-state'] === 'offline'));
  h.advance(3000);
  verifyRenderedLinks();
  h.api.mrKillRegion(1);
  h.advance(3000);
  assert.ok(verifyRenderedLinks().every(link => link['data-link-state'] !== 'replicating'));
  h.api.mrReviveRegion(0);
  h.advance(3000);
  verifyRenderedLinks();
});
