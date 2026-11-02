# MongoDB Data Resilience Visualizer

An interactive, browser-based tool for exploring MongoDB's distributed architecture concepts — replica set failover, write/read concerns, and multi-region active-active deployments — mapped live to the CAP theorem.

Built for MongoDB Atlas 8.3. No server required — runs entirely in the browser via `file://`.

---

## Quick Start

### Option A — Modular (development)

Open `index.html` directly in Chrome or Firefox. The page loads the JS files from the `js/` directory automatically.

```
open index.html          # macOS
start index.html         # Windows
```

### Option B — Single file (sharing / presenting)

Run the build script once to bundle everything:

```bash
./build.sh
```

Then open the output file:

```
open dist/mongodb-cap-visualizer.html
```

Share `dist/mongodb-cap-visualizer.html` as a standalone file — it has no external dependencies.

---

## The Three Tabs

### ① Replica Set & Failover

Simulates a 3, 5, or 7-node Atlas replica set across cloud regions.

- **Click any node** to toggle it between Healthy and Down.
- **Trigger Election** simulates a primary failover when the current primary is down.
- **Change Cloud Provider / Region** per node to explore cross-region topologies.
- **Write Concern / Read Preference** selectors show how the quorum requirement changes.
- **Reset** restores three healthy AWS nodes in one region, plus the initial concern settings, even during an election.
- The panel on the right shows quorum status, write acknowledgment path, and whether the set can elect a new primary.

### ② Write / Read Concerns

Illustrates the full lifecycle of a write operation: client → primary → secondaries → acknowledgment → read.

- **Write Concern** (`w:0`, `w:1`, `w:majority`, `w:all`) controls how many nodes must confirm a write before the client receives an ACK.
- **Journal** (`j:true/false`) controls whether the write must be flushed to disk before acknowledgment.
- **Read Preference** (`primary`, `primaryPreferred`, `secondary`, etc.) controls which node serves reads.
- **Read Concern** (`local`, `majority`, `linearizable`, `snapshot`, `available`) controls the consistency guarantee on reads.
- **Reset** restores the educational resilience baseline: `w:"majority"`, `j:true`, `readConcern:"majority"`, `readPreference:"primary"`. MongoDB's general default read concern is `local`; the visualizer uses `majority` here to illustrate reads of majority-acknowledged writes.
- The SVG diagram animates the WRITE → ACK → READ arrows so you can see exactly where each operation lands.
- Use **Simulate Write** and **Simulate Read** to step through the flow in the activity log.

### ③ Multi-Region Active-Active

Shows independent shard replica sets across two or three regions. Rows stay assigned to the same shard and columns to the same region, so members keep their positions during failures and recovery.

- **Configuration** selects three regions with **three shards and three backends**, three regions with **the same three shards and one backend**, or two regions with **two shards and two backends**. Every shard has three voting members.
- **Dashed arrows** show oplog replication from the current primary to its secondaries. Amber connections indicate an election; gray connections with a break mark indicate an offline member. Shard colors and member IDs remain visible throughout.
- **Per-shard status** distinguishes `WRITES READY`, `ELECTING PRIMARY`, `NO MAJORITY`, and `UNAVAILABLE`, with the number of online members and the required quorum. Without a primary, secondary reads depend on read preference and read concern.
- **Fail region**, **Restore**, and individual node clicks let you combine outages and recoveries, including during elections. **Restore All** returns the selected configuration to its initial healthy topology and cancels pending elections.
- **Backend → mongos** route summaries follow the current primary even when it moves to another region. A regional outage also takes its regional backend offline; the single external backend in the one-backend pattern is outside the simulated regional failures.
- Restored members rejoin as secondaries while a healthy primary remains in place. When majority returns to a shard without a primary, a new election runs. The model treats restored members as caught up; synchronization time, priority-based failback, replication chaining, and config server availability are not simulated.

See [SPEC.md §6](SPEC.md#6-tab-3--multi-region-global-cluster) for state rules and links to the MongoDB documentation.

---

## CAP Theorem Panel

Click **⬡ CAP Positioning** (top-right) to open the live CAP panel.

The panel updates automatically as you change settings across any tab. It shows:

- **Triangle position** — where the current configuration sits between Consistency (CP) and Availability (AP).
- **Mode badge** — `CP`, `AP`, or `Balanced (PA/EC)`.
- **Metric bars** — qualitative ratings for Consistency, Availability, Durability, and Write Latency.
- **Narrative** — a plain-English explanation of the current trade-off.
- **Active Settings table** — the exact writeConcern, readPreference, readConcern, and node count driving the score.

---

## File Structure

```
DataResilienceVisualizer/
├── index.html                      # HTML + CSS shell (loads js/ modules)
├── js/
│   ├── state.js                    # Global state object S, constants, config tables
│   ├── utils.js                    # $(), log(), clamp(), mdbNodeIcon()
│   ├── cap.js                      # getCAPScores(), updateCAP()
│   ├── tab-rs.js                   # Tab 1 — Replica Set & Failover
│   ├── tab-wc.js                   # Tab 2 — Write / Read Concerns
│   ├── tab-mr.js                   # Tab 3 — Multi-Region Active-Active
│   └── main.js                     # toggleCAPPanel(), switchTab(), window.onload
├── build.sh                        # Bundles js/ into a single-file distributable
├── dist/
│   └── mongodb-cap-visualizer.html # Single-file output of build.sh
├── mongodb-cap-visualizer.html     # Original monolithic version (reference)
└── SPEC.md                         # Full feature specification
```

Script load order (important for globals): `state → utils → cap → tab-rs → tab-wc → tab-mr → main`

---

## Rebuilding After Changes

Any time you edit a file in `js/` or `index.html`, regenerate the distributable:

```bash
./build.sh
```

The output overwrites `dist/mongodb-cap-visualizer.html`.

Run the automated regression tests before publishing:

```bash
node --test tests/*.test.js
```

The multi-region tests cover quorum, overlapping failures, election cancellation, recovery, and stable diagram positions.

---

## Atlas Version

Targets **MongoDB Atlas 8.3**. Features specific to self-managed deployments (arbiters, hidden nodes, delayed secondaries) are intentionally excluded — they are not available in Atlas.
