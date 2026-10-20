// Guided scenarios. `base` is applied first; `then` (optional) is applied a moment later so the election animates.
const R = (id, provider, name, electable, readOnly = 0) => ({ id, provider, name, electable, readOnly, outage: false, isolated: false });
const T221 = () => [R('r0', 'AWS', 'us-east-1', 2), R('r1', 'AWS', 'us-east-2', 2), R('r2', 'AWS', 'us-west-2', 1)];
const DEFAULT_SETTINGS = { w: 'majority', j: true, rp: 'primary', rc: 'majority' };
const m = (regions, extra = {}) => ({ regions, down: [], app: 'r0', settings: { ...DEFAULT_SETTINGS }, ...extra });
const withRegion = (model, idx, patch) => ({ ...model, regions: model.regions.map((r, i) => (i === idx ? { ...r, ...patch } : r)) });

export const PRESETS = [
  {
    id: 'recommended',
    name: { en: 'Recommended: 5 nodes across 3 regions (2-2-1)', pt: 'Recomendado: 5 nós em 3 regiões (2-2-1)' },
    base: () => m(T221()),
  },
  {
    id: 'primary-fails',
    name: { en: 'The primary node fails', pt: 'O nó primário cai' },
    base: () => m(T221()),
    then: (x) => ({ ...x, down: ['r0:e0'] }),
  },
  {
    id: 'region-outage',
    name: { en: 'The highest-priority region goes down', pt: 'A região de maior prioridade cai' },
    base: () => m(T221(), { app: 'external' }),
    then: (x) => withRegion(x, 0, { outage: true }),
  },
  {
    id: 'two-regions',
    name: { en: 'Two regions (3+2): lose the larger one', pt: 'Duas regiões (3+2): perder a maior' },
    base: () => m([R('r0', 'AWS', 'us-east-1', 3), R('r1', 'AWS', 'us-west-2', 2)], { app: 'r1' }),
    then: (x) => withRegion(x, 0, { outage: true }),
  },
  {
    id: 'partition',
    name: { en: 'Partition: the primary’s region is cut off (w:1)', pt: 'Partição: a região do primário fica isolada (w:1)' },
    base: () => m(T221(), { settings: { ...DEFAULT_SETTINGS, w: 1, rc: 'local' } }),
    then: (x) => withRegion(x, 0, { isolated: true }),
  },
  {
    id: 'partition-reads',
    name: { en: 'Partition: keep reading locally with nearest', pt: 'Partição: continuar lendo localmente com nearest' },
    base: () => m(T221(), { app: 'r2', settings: { ...DEFAULT_SETTINGS, rp: 'nearest' } }),
    then: (x) => withRegion(x, 2, { isolated: true }),
  },
  {
    id: 'two-regions-lost',
    name: { en: 'Two of three regions go down', pt: 'Duas de três regiões caem' },
    base: () => m(T221(), { app: 'r2', settings: { ...DEFAULT_SETTINGS, rp: 'primaryPreferred' } }),
    then: (x) => withRegion(withRegion(x, 0, { outage: true }), 1, { outage: true }),
  },
  {
    id: 'read-only-nodes',
    name: { en: 'Read-only nodes for local reads in a third region', pt: 'Nós read-only para leitura local numa terceira região' },
    base: () => m([R('r0', 'AWS', 'us-east-1', 3), R('r1', 'AWS', 'us-east-2', 2), R('r2', 'AWS', 'sa-east-1', 0, 2)], { app: 'r2', settings: { ...DEFAULT_SETTINGS, rp: 'nearest' } }),
  },
  {
    id: 'multi-cloud',
    name: { en: 'Multi-cloud: AWS, GCP and Azure (2-2-1)', pt: 'Multi-cloud: AWS, GCP e Azure (2-2-1)' },
    base: () => m([R('r0', 'AWS', 'us-east-1', 2), R('r1', 'GCP', 'us-east4', 2), R('r2', 'AZURE', 'eastus2', 1)]),
  },
  {
    id: 'single-region',
    name: { en: 'Single region, 3 nodes', pt: 'Uma região, 3 nós' },
    base: () => m([R('r0', 'AWS', 'us-east-1', 3)], { app: 'external' }),
  },
];
