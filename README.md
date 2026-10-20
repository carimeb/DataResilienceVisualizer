# MongoDB Data Resilience Visualizer (v2)

Interactive simulator of a MongoDB Atlas replica set across regions and clouds. Take nodes down, lose a whole
region, cut a region's network (partition), add or remove nodes and regions, and change the application's
write concern, read preference and read concern. The page shows what the application sees (does the write
succeed? where does the read go? can it be stale or rolled back?) and where the settings sit on a CAP compass.

Every result is tagged with the MongoDB documentation rule it follows (see [RULES.md](RULES.md)).
Interface in English (default) or Portuguese (PT-BR).

## Use it

Open `dist/data-resilience-visualizer.html` in a browser. It is a single file with no server and no build
needed; share that file as is. Fonts load from Google Fonts when online and fall back to system fonts offline.

- Click a node to take it down or bring it back.
- **Outage** loses the whole region. **Isolate** cuts its network from the other regions (a partition).
- **− / +** change electable and read-only nodes per region (max 7 voting members). The last card adds a region (max 4).
- Click the provider badge (AWS / GCP / Azure) or the region name to change them; ▲ raises a region's priority.
- The **Scenario** menu loads guided cases (primary failure, region outage, 2-region trap, partition with w:1, local reads…).

## Why it doesn't hallucinate anymore

v1 implemented the MongoDB rules three times (once per tab), mixed with hard-coded SVG coordinates, and was
validated by clicking. v2 splits the problem:

| Layer | File | Guarantee |
|---|---|---|
| Rules | `src/rules.js` → `RULES.md` | Each behavior is one documented rule with a verbatim quote and URL |
| Engine | `src/engine.js` | Pure function: model in, outcome + rule IDs out. No DOM, no language |
| Layout | `src/layout.js` | Pure geometry: canvas size comes from content; arrows are routed through lanes kept free of nodes and text |
| UI | `src/canvas.js`, `src/panel.js`, `src/main.js`, `src/i18n.js` | Renders what the engine and layout return |

Tests (`npm test`, ~30 s):

- `test/engine.test.mjs`: the scenarios the docs spell out (2+1, 3+2, 1-1-1, 2-2-1, fault-tolerance table,
  partition behavior…) plus invariants checked on **every topology within limits × every node-failure combination**
  (over 100k evaluations), and mutation-checked (deliberately broken engines fail the suite).
- `test/layout.test.mjs`: for every allowed topology, nodes fit, nothing overlaps, every arrow ends exactly on its
  node and crosses no other node, pill or header text.
- `test/i18n.test.mjs`: EN and PT-BR have the same keys; every engine code has a label.
- `test/e2e.py` (`npm run e2e`, needs Python Playwright): headless Chromium on the built file. All scenarios in
  both languages and both themes, plus 400 random clicks, checking real rendered text widths, arrow endpoints,
  DOM roles vs engine roles, JS errors and horizontal scroll at phone width.

## Develop

```bash
npm install          # esbuild only
npm test             # engine, layout, i18n
npm run build        # → dist/data-resilience-visualizer.html (+ dist/artifact.html for hosted publishing)
npm run e2e          # browser checks on the build
npm run rules        # regenerate RULES.md from src/rules.js
```

Adding behavior: add the rule (with quote and URL) to `src/rules.js`, implement it in `src/engine.js` tagging the
rule ID, add a doc-example test named after the rule, then add strings to both languages in `src/i18n.js`.

## Scope

Modeled: replica set elections, priorities by region order, node / region / full-cluster loss, partitions with
the transient old-primary window, read-only nodes, w:0/1/n/"majority", j, all read preferences and read concerns,
retryable-write behavior, Atlas 3/5/7 electable rule.

Not modeled yet: sharded / Global Clusters (zones), analytics nodes, tag sets, maxStalenessSeconds, replication
lag, wtimeout values. The previous version, including the Global Cluster tab, is kept in `legacy/`.
