// ─── GLOBAL STATE ────────────────────────────────────────────────────────────

const S = {
  tab: 'rs',
  rs: {
    nodes: [],            // built dynamically by rsBuildNodes() on init
    electing: false,
    electionInterval: null,
  },
  // Educational resilience baseline; the server's general readConcern default is local.
  wc: { w: 'wmaj', j: true, rc: 'majority', rp: 'primary', writeRun: 0, readRun: 0 },
  mr: {
    config: '3r3b',
    nodeHealth: [],            // [si][ri][ni] = bool — filled in window.onload
    primaryRegion: [0, 1, 2], // which region holds each shard's primary (-1 = none)
    primaryNode: [0, 0, 0],   // member index within that region (-1 = none)
    shardElecting: [],         // [si] = bool — true while election in progress
    regionDown: [],            // explicit region outages also take its backend offline
  },
};

// ─── TAB 1 CONSTANTS ─────────────────────────────────────────────────────────

const PROV = {
  aws:   { label: 'AWS',   color: '#FF9900', bg: '#FFF4E6', border: '#FFD08A', text: '#92400E' },
  gcp:   { label: 'GCP',   color: '#4285F4', bg: '#EAF1FF', border: '#93C5FD', text: '#1E3A8A' },
  azure: { label: 'Azure', color: '#0078D4', bg: '#E5F4FF', border: '#79C0EA', text: '#0C4A6E' },
};

const REGION_NAMES = [
  { aws: 'us-east-1',      gcp: 'us-central1',   azure: 'eastus'        },
  { aws: 'eu-west-1',      gcp: 'europe-west1',  azure: 'westeurope'    },
  { aws: 'ap-southeast-1', gcp: 'asia-east1',    azure: 'southeastasia' },
];

const NODE_PROV_DEFAULTS = ['aws', 'aws', 'aws'];

// ─── TAB 3 CONSTANTS ─────────────────────────────────────────────────────────

// Per-shard accents from the Atlas Infinite visualizer palette.
const MR_SC = [
  { bright: '#00ED64', dark: '#00684A', border: '#001E2B', line: '#00684A', bg: '#E3FCF7', text: '#00684A' },
  { bright: '#00D2FF', dark: '#006EFF', border: '#001E2B', line: '#006EFF', bg: '#F9EBFF', text: '#001E2B' },
  { bright: '#E9FF99', dark: '#023430', border: '#001E2B', line: '#023430', bg: '#FAFBFC', text: '#023430' },
];

const MR_CFGS = {
  '3r3b': {
    label: '3 Regions · 3 Backends',
    desc: 'Each region has a backend. Through mongos, writes reach the current primary of the target shard. One region can fail while each shard retains 2 of 3 members; affected shards resume writes after an election.',
    regions: [
      { name: 'AWS Oregon',   short: 'us-west-2' },
      { name: 'AWS Ohio',     short: 'us-east-2' },
      { name: 'AWS Virginia', short: 'us-east-1' },
    ],
    numShards: 3, shardDist: [[1,1,1],[1,1,1],[1,1,1]],
    primaryRegion: [0,1,2], backends: [0,1,2],
    shardZones: ['region-1','region-2','region-3'],
  },
  '3r1b': {
    label: '3 Regions · 1 Backend',
    desc: 'One backend, shown outside the regional failure simulation, uses mongos to reach all three shards. Each shard has one member in each region. A primary can move to a surviving region after failover.',
    regions: [
      { name: 'AWS Oregon',   short: 'us-west-2' },
      { name: 'AWS Ohio',     short: 'us-east-2' },
      { name: 'AWS Virginia', short: 'us-east-1' },
    ],
    numShards: 3, shardDist: [[1,1,1],[1,1,1],[1,1,1]],
    primaryRegion: [0,1,2], backends: [0],
    shardZones: ['region-1','region-2','region-3'],
  },
  '2r2b': {
    label: '2 Regions · 2 Backends',
    desc: '<strong>2+1 members per shard.</strong> Losing the region with two members removes that shard’s majority. The other shard can retain its majority. Compare their separate status labels.',
    regions: [
      { name: 'AWS Ohio',    short: 'us-east-2' },
      { name: 'AWS Virginia', short: 'us-east-1' },
    ],
    numShards: 2, shardDist: [[2,1],[1,2]],
    primaryRegion: [0,1], backends: [0,1],
    shardZones: ['region-1','region-2'],
  },
};
