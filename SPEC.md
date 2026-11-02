# Distributed Architecture & Read/Write Concerns Visualizer — Specification

**File:** `mongodb-cap-visualizer.html`  
**Version:** Atlas 8.3  
**Audience:** MongoDB Solutions Architects presenting to enterprise/FSI technical architects  
**Format:** Single self-contained HTML file (no external dependencies beyond Google Fonts)

---

## 1. Purpose

An interactive demo tool that teaches three progressive layers of MongoDB distributed architecture:

1. How a replica set elects a new primary and what happens to clients during failover
2. How write concern, read concern, and read preference trade off durability, freshness, and latency — and how these settings move MongoDB's CAP position
3. How a Global Cluster uses zone sharding for Active-Active multi-region writes, and what each region failure pattern means for quorum and availability

---

## 2. Layout

```
┌─ #hdr ─────────────────────────────────────────────────────────────────────┐
│ MongoDB logo | "Distributed Architecture & Read/Write Concerns Visualizer" │
│              |  · For educational purposes only (disclaimer, 10px, dimmed) │
│              | Interactive badge | ⬡ CAP Positioning button               │
└────────────────────────────────────────────────────────────────────────────┘
┌─ #tab-nav ──────────────────────────────────────────────┐
│ ① Replica Set & Failover │ ② Write/Read Concerns │ ③ …  │
└─────────────────────────────────────────────────────────┘
┌─ #main (CSS grid) ──────────────────────────────────────┐
│  #viz (flex:1)             │  #cap (300px, opt-in)       │
│  ┌─ .tc.active ─────────┐  │  CAP Theorem Position panel │
│  │  active tab content   │  │  (hidden by default)        │
│  └───────────────────────┘  │                             │
└─────────────────────────────────────────────────────────┘
┌─ #log ──────────────────────────────────────────────────┐
│ Activity log (90px, monospace, newest-first)             │
└─────────────────────────────────────────────────────────┘
```

**Header subtitle color:** `.hdr-sub` uses `color: var(--green-light)` — same green as the MongoDB logo mark and the CAP Positioning button.

**Educational disclaimer:** A short inline disclaimer sits to the right of the subtitle text at 10px, 55% opacity: `"· For educational purposes only — not a substitute for official MongoDB documentation."` This is intentionally brief; it is not a legal notice.

**CAP panel toggle:** A button `#cap-toggle-btn` in the header opens/closes `#cap`. Hidden by default for commercial conversations; opens with a 0.3s CSS transition. When opened, `updateCAP()` is called to refresh values.

---

## 3. Global State Object

```javascript
const S = {
  tab: 'rs',                    // active tab: 'rs' | 'wc' | 'mr'
  rs: {
    nodes: [],                  // Node[] built by rsBuildNodes()
    electing: false,            // true while election timer is running
    electionInterval: null,     // setInterval handle for countdown
  },
  wc: {
    w: 'wmaj', j: true,
    rc: 'majority', rp: 'primary'
  },
  mr: {
    config: '3r3b',             // active MR_CFGS key
    nodeHealth: [],             // [si][ri][ni] = bool
    primaryRegion: [0, 1, 2],   // runtime primary region per shard (-1 = none)
    primaryNode: [0, 0, 0],     // primary member index within that region (-1 = none)
    shardElecting: [],          // [si] = bool — election in progress
    regionDown: [],             // explicit regional outage also takes its backend offline
  }
};
```

---

## 4. Tab 1 — Replica Set & Failover

### 4.1 Purpose
Demonstrates the MongoDB election protocol. Users click nodes to kill/revive them and observe what happens to client connectivity, quorum, and write availability.

### 4.2 Configuration Controls

| Control | Options | Default |
|---|---|---|
| Number of Nodes | 3 / 5 / 7 | 3 |
| Region Distribution | 1 / 2 / 3 regions | 1 |
| Per-node Cloud Provider | AWS / GCP / Azure | AWS |
| Write Concern | w:0 / w:1 / w:majority / w:all | w:majority |
| Read Preference | primary / primaryPreferred / secondary / secondaryPreferred / nearest | primary |

Changing any control calls `rsReconfigure()`, which resets election state, rebuilds nodes, and re-renders.
The **Reset** button restores the complete initial topology and settings: three healthy AWS nodes in one region, `w:"majority"`, and `readPreference:"primary"`. It also cancels an election in progress.

### 4.3 Node Model

Each node has:
- `id` — unique identifier (`rs0`, `rs1`, …)
- `host` — FQDN derived from region and provider (e.g., `rs0.us-east-1`)
- `role` — `PRIMARY` | `SECONDARY`
- `state` — `HEALTHY` | `DOWN` | `VOTING`
- `votes`, `priority` — standard replica set fields
- `region` — integer region index
- `provider` — `aws` | `gcp` | `azure`

### 4.4 Region Distribution

Nodes are spread as evenly as possible across regions (`rsGetDistribution`). With 3 nodes / 2 regions: region 0 gets 2, region 1 gets 1. Each (region × provider) combination is rendered as a distinct colored box in the SVG.

**HA/DR labels (2-region only):** When exactly 2 regions are selected, each region box header gets an inline tag:
- Region with the **majority** of nodes → `(for High Availability)`
- Region with the **minority** of nodes → `(for Disaster Recovery)`

These labels are suppressed when both regions have equal node counts, and are absent for 1- or 3-region configurations.

### 4.5 Quorum Logic

```
majority = floor(total / 2) + 1
quorumCount = HEALTHY + VOTING nodes   ← includes nodes mid-election
readOnly = quorumCount < majority
```

The quorum status bar at the bottom of the SVG reflects this in real time.

### 4.6 Election Flow

**Trigger:** PRIMARY node is clicked and set to DOWN.

```
mrToggleNode → node.state = 'DOWN'
             → S.rs.electing = true
             → show #elex-banner with countdown
             → all HEALTHY nodes set to state='VOTING' (amber pill)
             → setInterval ticks every 1s for ~10s
             → at t=0: rsCompleteElection()
               - S.rs.electing = false
               - pick first HEALTHY secondary → promote to PRIMARY
               - all others → SECONDARY
               - hide #elex-banner
               - show #ro-banner if still below majority
```

**Guard:** Clicks on any node while `S.rs.electing === true` are ignored.

### 4.7 Banner States (Tab 1)

| Banner | Trigger condition |
|---|---|
| `#elex-banner` | Election in progress (PRIMARY just died, majority intact) |
| `#ro-banner` | `quorumCount < majority` AND at least 1 node healthy |
| `#down-banner` | All nodes DOWN (0 healthy) |

Banners are mutually exclusive. The election banner has a large countdown timer (`#elex-count`) and explains retryable writes.

### 4.8 SVG Visual Elements

- **Cloud provider boxes:** Colored rectangles per (region × provider), labeled with provider name and region FQDN. In 2-region mode, each box header shows an HA/DR annotation (see §4.4).
- **SVG viewport:** `viewBox="0 0 660 {H}"` with `max-width: 660px; display:block; margin:0 auto` — prevents the diagram from expanding beyond its intended bounds on wide screens.
- **Client Application box:** Top center; connected to PRIMARY via orange dashed arrow (WRITE label) or to all survivors via amber arrows (READ-ONLY label)
- **Oplog replication lines:** Animated flowing dashes PRIMARY→SECONDARY (green, class `repl`)
- **Heartbeat lines:** Dim dashed lines between secondaries (class `hb`, opacity pulse)
- **PRIMARY glow ring:** Animated pulse ring around the primary node (class `pring`)
- **VOTING nodes:** Amber circle fill `#FCD34D`, `VOTING…` pill
- **Node icon:** MongoDB leaf shape built by `mdbNodeIcon()`
- **Role pill:** Color-coded badge below node — green=PRIMARY, blue=SECONDARY, amber=READ-ONLY, red=DOWN
- **Cloud provider badge:** Small colored badge below the role pill

---

## 5. Tab 2 — Write / Read Concerns

### 5.1 Purpose
An interactive reference for MongoDB's durability and data freshness controls. Every combination moves a dot on the CAP triangle in the side panel.

### 5.2 Controls

The initial configuration and **Reset** use an educational resilience baseline: `w:"majority"`, `j:true`, `readConcern:"majority"`, and `readPreference:"primary"`. MongoDB's general default read concern is `local`; `majority` is selected here for the [documented combination to read majority-acknowledged writes on the primary](https://www.mongodb.com/docs/manual/reference/write-concern/#read-and-write-concern-recommendations). See also the [read concern](https://www.mongodb.com/docs/manual/reference/read-concern/) and [read preference](https://www.mongodb.com/docs/manual/core/read-preference/) references. Reset cancels pending write/read simulation steps.

**Write Concern (`w`)**

| Value | Meaning |
|---|---|
| `w:0` | Unacknowledged. Driver returns immediately; no server response. Zero durability. |
| `w:1` | Primary acknowledged. Primary applies the write (to memory + journal if j:true), returns ACK. Vulnerable to rollback if primary crashes before replicating. |
| `w:"majority"` | **Recommended for financial data.** A majority of voting nodes must apply and ACK. Survives any single-node failure including immediate primary crash. |
| `w:all` | Every node must ACK. Maximum durability; highest latency; any one node failure blocks writes. |

**Journal (`j`)**

| Value | Meaning |
|---|---|
| `false` | Write applied to memory only. Fast; data survives crash only if it was replicated. |
| `true` | Write flushed to WiredTiger journal on disk before ACK. Survives ungraceful shutdown. |

**Read Concern (`readConcern`)**

| Value | Meaning |
|---|---|
| `local` | Default. Returns most recent data on the node (may include uncommitted writes). |
| `available` | Fastest; may return orphaned documents in sharded clusters (not for strong consistency). |
| `majority` | Returns only majority-committed data. Prevents dirty reads. Recommended for FSI. |
| `linearizable` | Strongest. Read reflects all prior majority-acknowledged writes. Requires primary, higher latency. |
| `snapshot` | For multi-document transactions. Returns consistent point-in-time snapshot. |

**Read Preference (`readPreference`)**

| Value | Meaning |
|---|---|
| `primary` | All reads go to the primary. Guarantees freshness. |
| `primaryPreferred` | Primary if available; falls back to secondary. |
| `secondary` | All reads from secondaries. Possible stale data; horizontal read scaling. |
| `secondaryPreferred` | Secondaries if available; falls back to primary. |
| `nearest` | Lowest network latency, regardless of role. Can be primary or secondary. |

### 5.3 Simulation

Two buttons sit below the Read Settings card in the right column:

- **▶ Simulate Write:** Logs a multi-step write flow (driver → primary → secondaries → ACK) in `#log` with appropriate latency notes
- **▶ Simulate Read:** Logs a read flow resolving the target node based on current readPreference

> The **Trade-off Summary** card (Durability / Write Latency / Read Freshness / Read Target rows) was intentionally removed. The SVG diagram and the per-control description texts already communicate the same information inline.

### 5.4 SVG: Acknowledgment Path

An SVG diagram (`viewBox="0 0 580 400"`) renders the in-flight write path: client → primary → secondaries, with visual feedback showing which ACKs are required for the selected `w` value.

**Label overlap fix — `sameTarget` branch:** When `readPreference = primary`, both the WRITE arrow and the READ arrow target the same primary node. Without correction all three labels (WRITE, ACK, READ → rs0) land at ~y=90, overlapping. The fix fans them apart:
- WRITE + ACK arrows shift right (`wX1 = 300`, primary offset `+8/+14`)
- WRITE label → x=330, y=80; ACK label → x=336, y=100
- READ arrow shifts left (`rdX1 = 270`, target x = `pri.x − 10`)
- READ label → x=245, y=88

When `readPreference` targets a secondary, `sameTarget === false` and original coordinates apply unchanged.

---

## 6. Tab 3 — Multi-Region Global Cluster

### 6.1 Purpose and Model

Demonstrates independent replica sets in a zone-sharded cluster. Every shard has three voting members spread across two or three regions. Users fail individual members or entire regions and observe each shard's primary, quorum, replication connections, and write availability.

A shard's zone identifies the data assigned to that shard; it does not pin the runtime primary to one region. Applications access shards through `mongos`. The initial primary regions are configured in `MR_CFGS`; failover may move a primary to another region.

### 6.2 Deployment Patterns (`MR_CFGS`)

**`3r3b` — 3 Regions · 3 Backends**

| | AWS Oregon (`us-west-2`) | AWS Ohio (`us-east-2`) | AWS Virginia (`us-east-1`) |
|---|---|---|---|
| Shard 1 | 1 member, initial primary | 1 member | 1 member |
| Shard 2 | 1 member | 1 member, initial primary | 1 member |
| Shard 3 | 1 member | 1 member | 1 member, initial primary |

Each region has a backend. Losing one region leaves two of three members in every shard, enough to elect a primary. Shards that lose their primary pause writes during an election; a failed region's backend remains offline until restored.

**`3r1b` — 3 Regions · 1 Backend**

Uses the same three shards and nine members as `3r3b`. One application backend accesses all shards through `mongos`. This backend is shown outside the regional failure model, so region controls do not fail it.

**`2r2b` — 2 Regions · 2 Backends**

| | AWS Ohio (`us-east-2`) | AWS Virginia (`us-east-1`) |
|---|---|---|
| Shard 1 | 2 members, including initial primary | 1 member |
| Shard 2 | 1 member | 2 members, including initial primary |

A failure of the region with two members removes that shard's majority. The other shard retains two members and can remain writable or elect a primary. The configuration banner explains that spreading three voting members across three regions lets a shard retain two votes after any single simulated regional outage.

### 6.3 State and Quorum

`S.mr.nodeHealth[si][ri][ni]` records whether a member is online. The primary is identified by both `primaryRegion[si]` and `primaryNode[si]`, so restoring a lower-index member cannot silently change the primary's identity. Both values are `-1` when there is no primary.

`mrShardStatus(si)` derives:

```javascript
{
  total, majority, healthyNodes, hasMajority,
  electing,
  primary,     // { si, ri, ni } or null
  down,        // no members online
  readOnly,    // legacy CAP field: some members online, but no majority
  writable     // majority plus a healthy primary, with no election in progress
}
```

`majority = floor(total / 2) + 1`. The UI deliberately does not label the legacy `readOnly` condition as guaranteed read availability.

| Shard label | Condition | Meaning |
|---|---|---|
| `WRITES READY` | Majority and healthy primary | The shard can accept writes in this model. |
| `ELECTING PRIMARY` | Majority, election in progress | Writes pause while a primary is selected. |
| `NO MAJORITY` | Some members online, fewer than the majority | No primary and no writes. Secondary reads depend on read preference and read concern. |
| `UNAVAILABLE` | Zero members online | No member can serve operations. |

Every row shows the online count and required quorum. `#mr-status-summary` counts shards ready for writes, while `#mr-status-detail` lists unavailable shards, shards without majority, and concurrent elections. These messages are derived from all shards together and announced through an accessible live region.

### 6.4 Fixed Diagram Layout

`mrLayout()` places each shard in a permanent horizontal row and each region in a permanent column. Members are ordered by configuration, never by current role. In the two-region pattern, two members share a cell side by side. A member keeps its coordinates throughout failover and recovery.

Each member has a visible `S1 · N1` style identifier and a stable `data-node="si-ri-ni"` identifier. Region headers show the number of online database members, or `REGION OFFLINE` for an explicit regional outage. Dashed region boundaries remain visible during outages.

Member labels distinguish `PRIMARY`, `SECONDARY`, `ELECTING`, and `OFFLINE`. Primaries have a static ring and prominent role badge; offline members have a red cross. Text and shapes supplement the shard colors, so role and availability are not conveyed by color alone. Nodes can be toggled with a click, Enter, or Space; focus is retained after rerendering.

### 6.5 Replication Connections and Application Routes

`mrReplicationLinks(si, nodes, status)` draws connections only between members of the same shard:

- With a primary, colored dashed arrows run from that primary to the secondaries. A longer connection arcs around any intervening member to avoid implying that replication passes through it.
- An offline endpoint produces a gray dashed connection with a break mark and no arrowhead. Its tooltip explains that a member is offline.
- Without a primary, member pairs remain visible. Connections between online members are amber while an election is in progress; they have no replication arrowhead.
- Each SVG path records its shard, source, target, and `replicating`, `offline`, or `waiting` state for inspection and regression tests.

The legend explains active replication, election connections, and unavailable connections. Node positions and shard colors remain stable as these connection states change.

Application routing is summarized above the replica sets rather than drawn across the replication rows. For regional backends, `Backend → mongos` displays the associated shard's current primary region, `writes paused`, or `Backend offline`. The route follows the elected primary across regions. The single-backend pattern states that `mongos` routes to the current primary of each shard.

### 6.6 Election and Recovery Rules

Every node or region change runs `mrReconcileShard(si)` for the affected shards:

1. If a shard has no majority, cancel its pending election and clear its primary.
2. If a healthy primary and majority remain, preserve the primary.
3. If majority exists but there is no primary or election, start an election.

`mrStartElection(si)` clears the primary and schedules a simulated election with `MR_ELECTION_MS = 3000`. This delay is for visualization; it is not a prediction of real MongoDB election timing. The UI shows the election state without a countdown.

`mrElectionTimers` stores a timer and a unique pending object per shard. Cancellation clears the timeout and removes that object; the callback also verifies object identity. Reset or reconfiguration therefore prevents old callbacks from changing a new simulation. Shards can elect independently, and further failures or restores remain available during an election.

`mrCompleteElection(si)` rechecks majority before choosing a healthy candidate. The deterministic selection first checks the configured initial primary region, then other regions. This selection order is a simulator rule, not a simulation of MongoDB member priorities or election timing.

On recovery, a member joins the current replica set without displacing a healthy primary. If its return restores majority to a shard with no primary, an election starts. The simulator does not perform automatic failback to the original primary or region.

### 6.7 Failure Controls and Reset

- **Fail region** sets every member in that region offline and records an explicit regional outage in `S.mr.regionDown`, which also marks the regional backend offline.
- **Restore** is available whenever a region has offline members. It restores all members in the region, clears the regional outage, and reconciles all affected shards.
- **Individual node interaction** toggles that member even during an election. Restoring a member in a region clears the region-outage flag, allowing partial recovery to be represented.
- **Restore All** calls `mrInitialize()` for the selected configuration: cancels all pending elections, restores all members, and reinstates the initial primary identities. It does not change the selected deployment pattern.
- **Configuration change** initializes the newly selected pattern with the same cancellation guarantees.

### 6.8 Educational Simplifications and Boundaries

- Restored members are treated as caught up immediately. Synchronization time, replication lag, rollback, and initial sync are not simulated.
- All modeled members vote and can become primary. Member priorities, priority-based failback, and detailed election protocol timing are not simulated.
- Arrows show direct primary-to-secondary oplog replication. Replication chaining and sync-source selection are not simulated.
- `mongos` routing is summarized. Config server replica set availability, router failures, application retries, and backend failover are not simulated; the one-backend pattern's backend is outside the region failure controls.
- The model tracks availability rather than individual writes or acknowledgments. It makes no blanket promise of zero data loss or guaranteed secondary reads during an outage.

### 6.9 Official MongoDB References

- [Replica Set Elections](https://www.mongodb.com/docs/manual/core/replica-set-elections/): majority votes, primary stepdown, member priorities, and retry limitations.
- [Replica Set Primary](https://www.mongodb.com/docs/manual/core/replica-set-primary/): writes go to the primary; secondaries replicate the oplog.
- [Rollbacks During Replica Set Failover](https://www.mongodb.com/docs/manual/core/replica-set-rollbacks/): a former primary rejoins as a secondary; durability depends on acknowledgment and failure conditions.
- [Read Preference](https://www.mongodb.com/docs/manual/core/read-preference/): primary-only reads require a primary; secondary selection depends on the chosen mode and eligibility.
- [Read Concern majority](https://www.mongodb.com/docs/manual/reference/read-concern-majority/): reads use the majority-committed view.
- [Routing with mongos](https://www.mongodb.com/docs/manual/core/sharded-cluster-query-router/): applications access shards through routers.

---

## 7. CAP Theorem Panel

### 7.1 Visibility
Hidden by default. Opened via the `⬡ CAP Positioning` button in the header. The grid smoothly expands from `1fr` to `1fr 300px` over 0.3s. Intended for technical conversations with architects who want to see the trade-off positioning.

### 7.2 Components

- **Disclaimer banner:** A yellow `#FEF9C3` banner at the top of the panel reads: *"📌 Simplified model — for illustration only. This panel is a directional compass, not a formal proof. Real-world CAP trade-offs depend on workload patterns, network topology, and application logic."* This is always visible when the panel is open.
- **CAP Triangle SVG:** Gradient polygon with C (Consistency) at top, A (Availability) at bottom-left, P (Partition Tolerance) at bottom-right. A moving dot shows current position.
- **CAP mode badge:** One of three states:
  - `CP — Consistency Priority` (green) — ratio > 0.65
  - `PA/EC — Balanced` (amber) — 0.38 ≤ ratio ≤ 0.65
  - `AP — Availability Priority` (blue) — ratio < 0.38
- **A↔C slider:** Visual 0–100% bar with dot position derived from `ratio = c / (c + a)`
- **Metric bars:** Qualitative labels (High / Medium / Low) for Consistency, Availability, Durability. Write Latency shown as `< 1ms` / `~1–5ms` / `~10–30ms` / `~50–150ms`.
- **Narrative description:** One-paragraph explanation of the current configuration's CAP position.
- **Configuration summary table:** writeConcern, readPreference, readConcern, nodes up.

### 7.3 Scoring Algorithm (`getCAPScores`)

Baseline: `c = 0.5, a = 0.5`

**Write Concern deltas:**

| w | Δc | Δa |
|---|---|---|
| w:0 | −0.40 | +0.35 |
| w:1 | −0.15 | +0.15 |
| w:majority | +0.20 | −0.05 |
| w:all | +0.35 | −0.30 |

**Journal:** `j=true` → c +0.05

**Read Preference deltas:**

| rp | Δc | Δa |
|---|---|---|
| primary | +0.20 | — |
| primaryPreferred | +0.10 | +0.05 |
| nearest | — | +0.10 |
| secondaryPreferred | −0.15 | +0.15 |
| secondary | −0.25 | +0.28 |

**Read Concern deltas:**

| rc | Δc | Δa |
|---|---|---|
| linearizable | +0.15 | −0.08 |
| majority | +0.08 | — |
| available | −0.10 | +0.12 |
| snapshot | +0.12 | −0.05 |

**Dead nodes (Tab 1):** each DOWN node → a −0.12

**Multi-region adjustments (Tab 3):** each shard that is DOWN → a −0.30; each shard READ-ONLY → a −0.18

All values clamped to [0.05, 0.95].

---

## 8. Activity Log

Persistent 90px console at the bottom. Columns: `timestamp | level | component | message`. Max 80 rows (oldest discarded). Levels:

| Level | Color | CSS class |
|---|---|---|
| INFO | Blue | `.li` |
| WARN | Amber | `.lw` |
| ERROR | Red | `.le` |
| SUCCESS | Green | `.ls` |

Every state change (node kill/revive, election start/complete, concern change, simulation) appends a log entry.

---

## 9. Key MongoDB Concepts Embedded

**Retryable writes:** During an election, the MongoDB driver automatically holds and retries all incoming write operations. No application code change is required. No writes are lost. This is explained in every election banner.

**Majority quorum:** `floor(n/2) + 1` nodes must be available for writes to proceed. This is enforced per shard in a Global Cluster.

**Automatic primary election:** When a primary fails and majority quorum is intact, a new primary is elected automatically within ~10 seconds. The driver's retryable write mechanism absorbs the window.

**READ-ONLY mode:** Not a hard outage. When quorum is lost, the replica set/shard accepts reads but suspends writes. This is preferable to returning incorrect data.

**Zone sharding:** Shard keys include a zone prefix (e.g., `region-1`). The zone → chunk range → shard mapping ensures writes for a given region are always routed to the shard whose primary is in that region.

**w:majority for FSI:** Guarantees a write survives any single-node failure including an immediate primary crash followed by election. The newly elected primary always has the write. Required for financial data integrity.

**Atlas constraint on topology:** Atlas manages replica set membership automatically. There is **no user-facing option** to add arbiters, hidden nodes, or delayed secondaries. These are self-managed deployment concepts only. For 2-region deployments on Atlas, the correct recommendation is to add a third region — not to configure any tiebreaker node manually.

---

## 10. Shared Utilities

```javascript
$(id)               // document.getElementById shorthand
sleep(ms)           // Promise-based setTimeout
clamp(v, a, b)      // numeric clamp
log(level, comp, msg) // append row to #log
mdbNodeIcon(cx, cy, size, state, role) // renders MongoDB leaf SVG node
```

---

## 11. Extension Points

To add a new cluster configuration to Tab 3, add an entry to `MR_CFGS`:

```javascript
'key': {
  label: 'Display Label',
  desc: 'HTML description shown in mr-pattern-desc',
  regions: [{ name: 'Full Name', short: 'short-id' }, ...],
  numShards: N,
  shardDist: [[n0r0, n0r1, ...], [n1r0, n1r1, ...], ...],  // nodes per region per shard
  primaryRegion: [0, 1, ...],   // home region index per shard
  backends: [0, 1, ...],        // which regions have app backends
  shardZones: ['zone-id', ...], // zone names for informational display
}
```

To add a new tab:
1. Add a `.tab-btn` in `#tab-nav`
2. Add a `<div id="tab-X" class="tc">` in `#viz`
3. Add the `if(name==='X')` branch in `switchTab()`
4. Implement a render function and call `updateCAP()` from it
