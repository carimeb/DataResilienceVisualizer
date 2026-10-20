// Layout tests: geometric guarantees for every topology the UI allows.
// These replace "click around and look": nodes fit, nothing overlaps, every arrow ends on its node and crosses no other node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layout, route, G, regionWidth, opLabelBoxes } from '../src/layout.js';
import { normalize } from '../src/engine.js';

const PILL_MAX_W = 76; // widest role pill text ("OLD PRIMARY" / "EX-PRIMÁRIO") at 9px — enforced in ui.js too
const PILL_H = 18;

function* models() {
  for (let R = 1; R <= 4; R++) {
    const rec = function* (i, acc, sum) {
      if (i === R) { if (acc[0][0] >= 1) yield acc.slice(); return; }
      for (let e = 0; e + sum <= 7; e++) for (const ro of [0, 1, 3]) { acc.push([e, ro]); yield* rec(i + 1, acc, sum + e); acc.pop(); }
    };
    for (const dist of rec(0, [], 0)) {
      for (const app of ['external', ...dist.map((_, i) => `r${i}`)]) {
        yield normalize({ regions: dist.map(([e, ro], i) => ({ id: `r${i}`, name: 'x', provider: 'AWS', electable: e, readOnly: ro })), down: [], app, settings: {} });
      }
    }
  }
}

function segDist(px, py, [x1, y1], [x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1;
  const L = dx * dx + dy * dy;
  const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function segHitsRect(a, b, r, pad = 1) {
  // orthogonal segments only
  const [x1, y1] = a, [x2, y2] = b;
  const minX = Math.min(x1, x2), maxX = Math.max(x1, x2), minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
  return maxX >= r.x - pad && minX <= r.x + r.w + pad && maxY >= r.y - pad && minY <= r.y + r.h + pad;
}

test('layout: every allowed topology fits, without overlaps, and every arrow lands cleanly', () => {
  let checked = 0;
  for (const m of models()) {
    const g = layout(m);
    const label = JSON.stringify(m.regions.map((r) => [r.electable, r.readOnly])) + ' app=' + m.app;
    // canvas bounds
    const inside = (x, y, w = 0, h = 0) => x >= 0 && y >= 0 && x + w <= g.width && y + h <= g.height;
    assert.ok(inside(g.app.x, g.app.y, g.app.w, g.app.h), `${label}: app outside`);
    for (const reg of g.regions) assert.ok(inside(reg.x, reg.y, reg.w, reg.h), `${label}: region outside`);
    // nodes inside their region grid, pills inside region above footer
    const pills = [];
    for (const n of g.nodes) {
      const reg = g.regions.find((r) => r.id === n.regionId);
      assert.ok(n.cx - n.r >= reg.gridX && n.cx + n.r <= reg.x + reg.w, `${label}: node x outside region`);
      assert.ok(n.cy - n.r >= reg.gridY && n.pillY + PILL_H <= reg.footerY, `${label}: node y outside grid`);
      const pill = { x: n.cx - PILL_MAX_W / 2, y: n.pillY, w: PILL_MAX_W, h: PILL_H };
      assert.ok(pill.x >= reg.x + G.LANE_W - 2 && pill.x + pill.w <= reg.x + reg.w, `${label}: pill outside region`);
      pills.push({ ...pill, id: n.id });
    }
    // no overlaps
    for (let i = 0; i < g.nodes.length; i++) for (let j = i + 1; j < g.nodes.length; j++) {
      const a = g.nodes[i], b = g.nodes[j];
      assert.ok(Math.hypot(a.cx - b.cx, a.cy - b.cy) >= a.r + b.r + 8, `${label}: nodes overlap`);
      const p = pills[i], q = pills[j];
      const overlap = p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
      assert.ok(!overlap, `${label}: pills overlap ${p.id} ${q.id}`);
    }
    // arrows
    for (const n of g.nodes) for (const kind of ['write', 'read']) {
      const pts = route(g, n.id, kind);
      const [ex, ey] = pts[pts.length - 1];
      assert.ok(Math.abs(Math.hypot(ex - n.cx, ey - n.cy) - n.r) < 0.01, `${label}: arrow not on border`);
      for (const [x, y] of pts) assert.ok(inside(x, y), `${label}: arrow leaves canvas`);
      for (let s = 0; s < pts.length - 1; s++) {
        for (const o of g.nodes) {
          if (o.id === n.id) continue;
          assert.ok(segDist(o.cx, o.cy, pts[s], pts[s + 1]) > o.r + 2, `${label}: ${kind} arrow to ${n.id} crosses node ${o.id}`);
        }
        for (const p of pills) assert.ok(!segHitsRect(pts[s], pts[s + 1], p), `${label}: ${kind} arrow to ${n.id} crosses pill ${p.id}`);
        // never crosses the app box except where it starts
        if (s > 0) assert.ok(!segHitsRect(pts[s], pts[s + 1], g.app, -1), `${label}: arrow crosses app box`);
        // header text area starts after the lane
        const reg = g.regions.find((r) => r.id === n.regionId);
        const header = { x: reg.x + G.LANE_W, y: reg.y + 4, w: reg.w - G.LANE_W - 4, h: G.HEADER_H - 8 };
        assert.ok(!segHitsRect(pts[s], pts[s + 1], header, -0.5), `${label}: arrow crosses header text`);
      }
      checked++;
    }
  }
  assert.ok(checked > 10000, `checked ${checked}`);
});

test('layout: canvas width grows with regions and stays proportional', () => {
  const m = (R) => normalize({ regions: Array.from({ length: R }, (_, i) => ({ id: `r${i}`, electable: 1, readOnly: 0 })), down: [], app: 'r0', settings: {} });
  const w1 = layout(m(1)).width, w4 = layout(m(4)).width;
  assert.ok(w4 > w1);
  assert.equal(layout(m(4)).addCard, null);
  assert.ok(layout(m(3)).addCard);
  assert.equal(regionWidth(), G.LANE_W + G.COLS * G.CELL_W + 10);
});

test('layout: WRITE/READ labels stay on canvas, clear of the app box, the arrow stubs and the buses', () => {
  // longest label texts the UI can produce (EN and PT)
  const texts = ['ESCRITA · w:"majority" ⏸', 'LEITURA · secondaryPreferred ✕'];
  for (const m of models()) {
    const g = layout(m);
    const boxes = opLabelBoxes(g, texts);
    for (const b of boxes) {
      assert.ok(b.x >= 0 && b.x + b.w <= g.width, `label off canvas (app=${m.app}, regions=${m.regions.length})`);
      assert.ok(b.y >= g.app.y + g.app.h + 2, 'label overlaps app box');
      assert.ok(b.y + b.h <= g.busY.write - 4, 'label overlaps arrow bus');
      for (const sx of [g.app.cx - 14, g.app.cx + 14]) assert.ok(sx < b.x - 2 || sx > b.x + b.w + 2, 'label crosses an arrow stub');
    }
    assert.ok(boxes[0].y + boxes[0].h <= boxes[1].y, 'labels overlap each other');
  }
});
