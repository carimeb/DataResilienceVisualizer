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
    primaryRegion: [0, 1, 2],  // runtime primary region index per shard (-1 = none)
    shardElecting: [],          // [si] = bool — guards re-entrant elections
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

### 6.1 Purpose
Demonstrates MongoDB Atlas Global Clusters with zone sharding. Each region has a dedicated shard whose primary is pinned to that region. Users kill individual nodes or entire regions and observe per-shard quorum behavior.

### 6.2 Zone Sharding Concept

- Each "Backend" maps to a shard zone. Data for a region is pinned to its zone via range-based shard keys.
- Every shard is an independent 3-node replica set.
- The shard's PRIMARY is in its "home region" under normal operation.
- Cross-region replication is via oplog, not synchronous writes.
- Each Backend writes to its local Primary → true Active-Active with intra-region latency.

**Oplog lines:** Cross-node replication arrows are intentionally hidden in this tab. The diagram only renders Backend→Primary connection arrows. This keeps the visual focused on availability semantics rather than replication topology.

### 6.3 Cluster Configurations (`MR_CFGS`)

**`3r3b` — 3 Regions · 3 Backends (recommended)**

| | us-west-2 | us-east-2 | us-east-1 |
|---|---|---|---|
| Shard 0 | 1 node | 1 node | 1 node |
| Shard 1 | 1 node | 1 node | 1 node |
| Shard 2 | 1 node | 1 node | 1 node |

- 3 shards, 3 nodes each, 1 per region
- Any single region can fail: surviving 2 nodes = majority → writes continue automatically
- Home PRIMARY regions: Shard 0 → us-west-2, Shard 1 → us-east-2, Shard 2 → us-east-1

**`3r1b` — 3 Regions · 1 Backend**

Same 3-region topology, single shard. Suitable when data does not require regional partitioning.

**`2r2b` — 2 Regions · 2 Backends ⚠ (not recommended)**

| | us-east-2 | us-east-1 |
|---|---|---|
| Shard 0 | 2 nodes | 1 node |
| Shard 1 | 1 node | 2 nodes |

- Home region holds 2 of 3 nodes per shard
- If home region fails: 1/3 votes survive → below majority → **READ-ONLY automatically**
- This is deterministic; no concern setting changes it within 2 regions
- See §6.9 for recommended mitigation paths

### 6.4 Shard Status (three states)

```javascript
function mrShardStatus(si) {
  // Returns: { total, majority, healthyNodes, readOnly, down }
  // readOnly: healthyNodes > 0 && healthyNodes < majority
  // down:     healthyNodes === 0
}
```

The three visual states of a shard:

| State | Condition | Visual indicator |
|---|---|---|
| `✓ Writable` | majority satisfied AND primary exists | Green badge |
| `⚠ READ-ONLY` | some nodes up, but < majority | Blue banner |
| `⊘ Unavailable` | 0 nodes up | Red badge |

### 6.4a Backend→Primary Arrow Helpers

**`mrArrow(ax1, ay1, ax2, ay2, si, curved)`**

Draws a dashed arrow from a backend to a primary node. Appearance is driven by `mrShardStatus(si)`:

- **WRITES** (orange `#FF9900`) — shard is writable (majority intact)
- **READ-ONLY** (blue `#3B82F6`) — shard is below majority but has surviving nodes
- **No line drawn** — shard is fully DOWN (`st.down === true`)

Straight lines are used for regional backends (`curved=false`); bezier curves are used for the 3r1b external backend (`curved=true`). Labels are rendered as small pill badges mid-arrow.

**`mrBestTarget(si, preferRi)`**

Finds the best node to draw an arrow to for shard `si`. Used only for `3r1b` (single backend). Search order:
1. PRIMARY in `preferRi` (if provided)
2. PRIMARY in any other region
3. Any healthy secondary in any region (fallback for READ-ONLY display)

Returns `null` if the shard is fully down (no line drawn).

### 6.4b Backend Rendering Rules (per config)

**`3r3b` and `2r2b` — Local-only rule:**

Each regional backend only connects to its home shard's PRIMARY **in the same region column**. No fallback to secondaries or other regions. If the local PRIMARY does not exist (region down or mid-election), no line is drawn for that backend.

```javascript
const homeSi = cfg.primaryRegion.indexOf(ri);     // which shard "belongs to" this region
const localPri = nodePos[ri].find(
  n => n.si === homeSi && n.role === 'PRIMARY' && S.mr.nodeHealth[n.si][n.ri][n.ni]
);
if (localPri) mrArrow(cx, backY+backH, cx, localPri.y - ns*0.57, homeSi, false);
```

**`3r1b` — External backend + shard loop:**

The single backend box is rendered **outside and above** the region cards (`topOffset = 90px`), labeled "Application Backend (via mongos)". This communicates that the driver routes through a `mongos` to reach each shard's primary — rather than being co-located in one region.

Arrows loop by shard (not by region). A spread offset prevents overlap when two shards share the same column after a failover election:

```javascript
// spread multiple arrows that target the same x-column
const colCount = {}, colIdx = {};
for (let si = 0; si < numS; si++) {
  const t = mrBestTarget(si, null);
  if (t) colCount[t.x] = (colCount[t.x] || 0) + 1;
}
for (let si = 0; si < numS; si++) {
  const t = mrBestTarget(si, null); if (!t) continue;
  const total = colCount[t.x] || 1, idx = colIdx[t.x] || 0; colIdx[t.x] = idx + 1;
  const spread = total > 1 ? (idx - (total-1)/2) * 16 : 0;
  mrArrow(srcX, srcY, t.x + spread, t.y - ns*0.57, si, true);
}
```

### 6.5 Election Flow (per shard)

**Trigger:** `mrToggleNode(si, ri, ni)` — node killed, AND that node was the PRIMARY for shard `si`.

**Guard:** `S.mr.shardElecting[si] === true` → all clicks for that shard are ignored until election completes.

```
mrStartElection(si):
  S.mr.shardElecting[si] = true
  mrShowElexBanner(si)         ← amber banner with countdown
  S.mr.primaryRegion[si] = -1 ← no primary during election
  all healthy nodes in shard si → rendered with amber VOTING pill + pulsing ring
  countdown ~8s via setInterval
  → mrCompleteElection(si):
      S.mr.shardElecting[si] = false
      pick new primary: home region preferred (cfg.primaryRegion[si])
      → if no healthy node in home region, pick from any other region
      → if no healthy nodes at all, shard stays DOWN
      mrHideElexBanner()
      mrUpdateBanners()
      mrRender()
```

**Home-region invariant:** `cfg.primaryRegion[si]` is the permanent zone home (config-level). `S.mr.primaryRegion[si]` is the runtime elected location. After election, if the home region has a healthy node, the primary returns there. This prevents the corner case of all primaries migrating to one region over time.

### 6.6 Banner States (Tab 3)

| Banner | Trigger |
|---|---|
| `#mr-elex-banner` | At least one shard is electing. Shows shard name + countdown. |
| `#mr-ro-banner` | At least one shard is in READ-ONLY state (below majority, not electing). |
| `#mr-2r-banner` | Config `2r2b` is selected (architecture guidance — always visible with that config). |

Banners can coexist: `#mr-2r-banner` is a persistent architecture warning, while `#mr-elex-banner` and `#mr-ro-banner` are reactive to simulation state.

### 6.7 Node Visual States

| State | Circle fill | Pill label | Animation |
|---|---|---|---|
| PRIMARY, healthy | `#00684A` (green) | PRIMARY | Glow pulse ring |
| SECONDARY, healthy | `#334E68` (slate) | SECONDARY | None |
| VOTING (mid-election) | `#FCD34D` (amber) | VOTING… | Pulsing amber ring |
| DOWN | `#C0392B` (red) with × | DOWN | None |

Shard colors (used for region boxes and node accents):
- Shard 0: Green (`#00ED64` / `#00684A`)
- Shard 1: Blue (`#60A5FA` / `#1D4ED8`)
- Shard 2: Pink/Rose (`#FB7185` / `#BE185D`)

### 6.8 Failure Simulation Controls

- **Kill [region]** buttons — set all nodes in a region to DOWN across all shards. Triggers elections for any shard that loses its primary.
- **Revive [region]** button — appears once all nodes in a region are DOWN; restores all nodes to HEALTHY.
- **↺ Restore All** — `mrReset()`: restores all nodes, resets all elections and banners.
- **Individual node click** — `mrToggleNode(si, ri, ni)`: toggle one node. Ignored if that shard is mid-election.

### 6.9 2-Region Architecture Guidance

When `2r2b` is selected, a persistent amber banner appears explaining the quorum limitation:

> **⚠ 2-Region topology — quorum limitation**  
> Each shard distributes as 2 nodes in the home region + 1 in the DR region. If the home region fails, only 1 of 3 votes survive — below majority — and the shard enters READ-ONLY automatically.  
> ✦ MongoDB recommendation: always deploy across **3 or more regions** to ensure each shard can maintain quorum after any single region failure.

No specific mitigation paths (Atlas Tiebreaker, arbiters, etc.) are shown. This is intentional:

> **Atlas constraint:** MongoDB Atlas does NOT expose arbiter, hidden node, or delayed secondary configuration. These are self-managed deployment concepts only. The topology is managed automatically by Atlas infrastructure. When discussing 2-region deployments on Atlas, the correct recommendation is to upgrade to 3 regions — not to configure an arbiter or tiebreaker manually.

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
