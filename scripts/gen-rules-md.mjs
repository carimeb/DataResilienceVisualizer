// Generates RULES.md from src/rules.js so the human-readable table never drifts from what the code uses.
import { writeFileSync } from 'node:fs';
import { RULES } from '../src/rules.js';
const rows = Object.entries(RULES).map(([id, r]) => `| \`${id}\` | ${r.en} | “${r.quote.replace(/\|/g, '\\|')}” | [doc](${r.url}) |`);
writeFileSync('RULES.md', `# Rules the simulator follows

Generated from \`src/rules.js\` (\`npm run rules\`). Every outcome in the UI is tagged with one or more of these IDs,
and every ID links to the MongoDB public documentation page its quote comes from. Quotes collected 2026-10-20.

To audit the simulator, review this table and the doc-example tests in \`test/engine.test.mjs\`
(test names start with the rule ID they check).

| ID | What the simulator does | Quote from the docs | Source |
|---|---|---|---|
${rows.join('\n')}

## Modeling choices (not documentation claims)

- **Election window.** The UI compresses an election to 5 s; the docs give a median of 12 s or less (\`ELEC-TIMING\`).
- **Steady-state primary.** After an election settles, the primary is the highest-priority available electable node in the group that holds a majority (\`ELEC-PRIORITY\`). Among equal priorities, the current primary is kept.
- **Atlas priorities by region order.** First region = priority 7, then 6, 5… (\`ATLAS-PRIORITY-REGION\`, \`ATLAS-PRIORITY-VALUES\`).
- **Partition.** "Isolate" cuts a region off from all other regions. Applications in that region reach only that region's nodes. During the election window the old primary, if isolated with a minority, still acknowledges w:1 writes that will roll back (\`PARTITION-TWO-PRIMARIES\`).
- **Driver routing.** For nearest/secondary modes the simulator picks a member in the application's region first, then follows region order. Real drivers use a latency window; the simulator approximates "same region = lowest latency".
- **Read-only nodes** are treated as secondaries eligible for secondary reads (they hold data and do not vote). Atlas also lets you target them with replica set tags (\`ATLAS-READONLY\`).
- **CAP compass.** The dot is the share of six yes/no checks passed (3 consistency, 3 availability/latency). It is a teaching aid, not a measurement.
- **Not modeled (yet):** sharded/Global Clusters, analytics nodes, tag sets, maxStalenessSeconds, replication lag, wtimeout values, causal sessions.
`);
console.log('RULES.md written,', Object.keys(RULES).length, 'rules');
