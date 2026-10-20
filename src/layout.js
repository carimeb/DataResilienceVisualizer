// Pure layout: positions every shape from the model, so the drawing always fits and arrows always land on a node.
// Returns geometry only (no SVG strings). The canvas viewBox is computed from content; nothing is hard-coded per scenario.
//
// Region card anatomy (top → bottom):  header | node grid (COLS columns, rows grow) | footer controls
// Arrow routing: app box → horizontal bus above the regions → the region's left lane (kept free of text and nodes)
//                → the free gutter just above the target's row → straight down onto the node's top edge.

export const G = Object.freeze({
  PAD: 24,
  APP_W: 184,
  APP_H: 50,
  APP_LANE: 140,      // from canvas top to region top (app box, op labels, arrow buses)
  LANE_W: 22,         // free vertical lane on the left of each region, for arrows only
  COLS: 3,
  CELL_W: 84,
  CELL_H: 94,
  NODE_DY: 40,        // node center offset inside its cell
  R: 24,              // node radius
  HEADER_H: 56,
  FOOTER_H: 78,
  GAP: 28,
  ADD_W: 112,
  ARROW_DX: 7,        // write arrow lands left of center, read arrow right of center
});

export const regionWidth = () => G.LANE_W + G.COLS * G.CELL_W + 10;

export function layout(model) {
  const RW = regionWidth();
  const counts = model.regions.map((r) => r.electable + r.readOnly);
  const rows = Math.max(1, ...counts.map((n) => Math.ceil(n / G.COLS)));
  const regionY = G.PAD + G.APP_LANE;
  const gridH = rows * G.CELL_H;
  const regionH = G.HEADER_H + gridH + G.FOOTER_H;
  const canAdd = model.regions.length < 4;

  const regions = model.regions.map((r, ri) => {
    const x = G.PAD + ri * (RW + G.GAP);
    return {
      id: r.id, index: ri, x, y: regionY, w: RW, h: regionH,
      gridX: x + G.LANE_W, gridY: regionY + G.HEADER_H,
      footerY: regionY + G.HEADER_H + gridH,
      lane: { write: x + 7, read: x + 15 },
    };
  });

  const nodes = [];
  model.regions.forEach((r, ri) => {
    const reg = regions[ri];
    const list = [
      ...Array.from({ length: r.electable }, (_, i) => ({ kind: 'electable', i })),
      ...Array.from({ length: r.readOnly }, (_, i) => ({ kind: 'readOnly', i })),
    ];
    list.forEach((it, k) => {
      const row = Math.floor(k / G.COLS);
      const col = k % G.COLS;
      const inRow = Math.min(G.COLS, list.length - row * G.COLS);
      const cellX = reg.gridX + (col + (G.COLS - inRow) / 2) * G.CELL_W;
      const cellY = reg.gridY + row * G.CELL_H;
      nodes.push({
        id: `${r.id}:${it.kind === 'electable' ? 'e' : 'r'}${it.i}`,
        regionId: r.id, kind: it.kind, row, col,
        cx: cellX + G.CELL_W / 2, cy: cellY + G.NODE_DY, r: G.R,
        cellY,
        pillY: cellY + G.NODE_DY + G.R + 5,   // top of the role pill
      });
    });
  });

  const contentW = model.regions.length * RW + (model.regions.length - 1) * G.GAP;
  const addCard = canAdd ? { x: G.PAD + contentW + G.GAP, y: regionY, w: G.ADD_W, h: regionH } : null;
  const width = G.PAD * 2 + contentW + (canAdd ? G.GAP + G.ADD_W : 0);
  const height = regionY + regionH + G.PAD;

  // Application box: above its region, or centered over all regions when it runs outside them.
  const appRegion = regions.find((r) => r.id === model.app);
  const appCx = appRegion ? appRegion.x + RW / 2 : G.PAD + contentW / 2;
  const app = { x: appCx - G.APP_W / 2, y: G.PAD, w: G.APP_W, h: G.APP_H, cx: appCx };

  return { width, height, rows, regions, nodes, app, addCard, regionY, busY: { write: regionY - 32, read: regionY - 20 } };
}

/**
 * Orthogonal route from the app to a node, as a list of points (first = start, last = on the node border).
 * kind: 'write' | 'read'
 */
export function route(geo, nodeId, kind) {
  const n = geo.nodes.find((x) => x.id === nodeId);
  if (!n) return null;
  const reg = geo.regions.find((r) => r.id === n.regionId);
  const sx = geo.app.cx + (kind === 'write' ? -14 : 14);
  const sy = geo.app.y + geo.app.h;
  const busY = geo.busY[kind];
  const laneX = reg.lane[kind];
  const gutterY = n.cellY + (kind === 'write' ? 4 : 10);
  const dx = kind === 'write' ? -G.ARROW_DX : G.ARROW_DX;
  const ex = n.cx + dx;
  const ey = n.cy - Math.sqrt(n.r * n.r - dx * dx); // exactly on the circle
  return [[sx, sy], [sx, busY], [laneX, busY], [laneX, gutterY], [ex, gutterY], [ex, ey]];
}

/** Short stub for an operation that has nowhere to go (no primary reachable, app down...). */
export function stub(geo, kind) {
  const sx = geo.app.cx + (kind === 'write' ? -14 : 14);
  const sy = geo.app.y + geo.app.h;
  return [[sx, sy], [sx, geo.busY[kind] - 2]];
}

/** SVG path with rounded corners for an orthogonal polyline. */
export function roundedPath(pts, radius = 6) {
  if (!pts || pts.length < 2) return '';
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(x - px, y - py), l2 = Math.hypot(nx - x, ny - y);
    const rr = Math.min(radius, l1 / 2, l2 / 2);
    if (rr < 0.5) { d += ` L${f(x)},${f(y)}`; continue; }
    const ax = x - ((x - px) / l1) * rr, ay = y - ((y - py) / l1) * rr;
    const bx = x + ((nx - x) / l2) * rr, by = y + ((ny - y) / l2) * rr;
    d += ` L${f(ax)},${f(ay)} Q${f(x)},${f(y)} ${f(bx)},${f(by)}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${f(last[0])},${f(last[1])}`;
}
const f = (v) => Math.round(v * 10) / 10;

/**
 * Operation labels (WRITE / READ pills) stacked beside the app box's arrow stubs.
 * Prefer the right of the read arrow; fall back to the left of the write arrow if that would leave the canvas.
 */
export const LABEL_CHAR_W = 6.1;
export function opLabelBoxes(geo, texts) {
  const widths = texts.map((s) => Math.round(s.length * LABEL_CHAR_W + 16));
  const maxW = Math.max(...widths);
  const top = geo.app.y + geo.app.h + 6;
  const rightX = geo.app.cx + 14 + 8;
  const leftEdge = geo.app.cx - 14 - 8;
  const useRight = rightX + maxW <= geo.width - 4;
  return widths.map((w, i) => ({
    x: useRight ? rightX : Math.max(4, leftEdge - w),
    y: top + i * 22,
    w,
    h: 18,
  }));
}
