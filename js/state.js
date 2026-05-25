// ─── GLOBAL STATE ────────────────────────────────────────────────────────────

const S = {
  tab: 'rs',
  rs: {
    nodes: [],            // built dynamically by rsBuildNodes() on init
    electing: false,
    electionInterval: null,
  },
  wc: { w: 'wmaj', j: true, rc: 'majority', rp: 'primary' },
  mr: {
    config: '3r3b',
    nodeHealth: [],            // [si][ri][ni] = bool — filled in window.onload
    primaryRegion: [0, 1, 2], // which region holds each shard's primary (-1 = none)
    shardElecting: [],         // [si] = bool — true while election in progress
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

// Per-shard colour palette: green / blue / pink
const MR_SC = [
  { bright: '#00ED64', dark: '#00684A', border: '#001E2B', line: '#00684A', bg: '#DCFCE7', text: '#15803D' },
  { bright: '#60A5FA', dark: '#1D4ED8', border: '#1E3A8A', line: '#1D4ED8', bg: '#DBEAFE', text: '#1D4ED8' },
  { bright: '#FB7185', dark: '#BE185D', border: '#831843', line: '#BE185D', bg: '#FFE4E6', text: '#BE185D' },
];

const MR_CFGS = {
  '3r3b': {
    label: '3 Regions · 3 Backends',
    desc: 'Each region runs its own Backend connected to its local MongoDB Primary via VPC Peering or Private Endpoint. Writes stay local — zero cross-region latency for owned data. Any single region failure leaves all shards at 2/3 nodes → majority intact → writes continue everywhere.',
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
    desc: 'A single Backend serves all zones via cross-region Private Endpoint. After failover the backend must write cross-region to shards whose Primary is now in another region — latency increases, but data stays safe. Oplog replication across all 3 regions keeps shard majority intact.',
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
    desc: '<strong>2+1 node distribution per shard.</strong> Home region holds 2 nodes; DR holds 1. Simulate killing a region to observe the quorum behavior. See the architecture guidance above for recommended mitigation paths.',
    regions: [
      { name: 'AWS Ohio',    short: 'us-east-2' },
      { name: 'AWS Virginia', short: 'us-east-1' },
    ],
    numShards: 2, shardDist: [[2,1],[1,2]],
    primaryRegion: [0,1], backends: [0,1],
    shardZones: ['region-1','region-2'],
  },
};
