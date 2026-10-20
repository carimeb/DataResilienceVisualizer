// Single source of truth for every behavior the simulator shows.
// Each rule = one statement from MongoDB's public documentation, with a verbatim quote and its URL.
// The engine tags every outcome with rule IDs; the UI renders the summary + link; RULES.md is generated from this file.
// Quotes were collected from mongodb.com/docs on 2026-10-20.

const D = 'https://www.mongodb.com/docs/manual';
const A = 'https://www.mongodb.com/docs/atlas';

export const RULES = {
  'ELEC-MAJORITY': {
    url: `${D}/core/replica-set-elections/`,
    quote: 'Independently, a member in the partition that can communicate with a majority of the voting nodes (including itself) holds an election to become the new primary.',
    en: 'A primary can only be elected by a group that reaches a majority of all voting members.',
    pt: 'Um primário só pode ser eleito por um grupo que alcança a maioria de todos os membros votantes.',
  },
  'ELEC-STEPDOWN': {
    url: `${D}/core/replica-set-elections/`,
    quote: 'When the primary detects that it can only see a minority of voting nodes in the replica set, the primary steps down and becomes a secondary.',
    en: 'A primary that can only see a minority of voting members steps down to secondary.',
    pt: 'Um primário que só enxerga uma minoria dos membros votantes rebaixa a si mesmo para secundário.',
  },
  'ELEC-TIMING': {
    url: `${D}/core/replica-set-elections/`,
    quote: 'The median time before a cluster elects a new primary should not typically exceed 12 seconds, assuming default replica configuration settings.',
    en: 'Secondaries call an election after losing the primary for 10 s (default); median time to a new primary should not typically exceed 12 s.',
    pt: 'Secundários convocam eleição após perder o primário por 10 s (padrão); o tempo mediano até um novo primário normalmente não passa de 12 s.',
  },
  'ELEC-PRIORITY': {
    url: `${D}/core/replica-set-elections/`,
    quote: 'Replica set members continue to call elections until the highest priority member available becomes primary.',
    en: 'The highest-priority available member ends up as primary (a lower-priority one may hold it briefly).',
    pt: 'O membro disponível de maior prioridade acaba virando primário (um de prioridade menor pode assumir por pouco tempo).',
  },
  'ATLAS-PRIORITY-REGION': {
    url: `${A}/cluster-config/multi-cloud-distribution/`,
    quote: 'Atlas sets the node in the first row of the Electable nodes table as the Highest Priority region. Atlas prioritizes nodes in this region for primary eligibility. Other nodes rank in the order that they appear.',
    en: 'Atlas gives the first region the highest priority for primary; other regions rank in the order listed.',
    pt: 'O Atlas dá à primeira região a maior prioridade para primário; as demais seguem a ordem da lista.',
  },
  'ATLAS-PRIORITY-VALUES': {
    url: `${A}/architecture/current/high-availability/`,
    quote: 'The priority fields must be defined in descending order and must consist of values between 7 and 1.',
    en: 'Region priorities run from 7 (highest) down to 1.',
    pt: 'As prioridades das regiões vão de 7 (maior) até 1.',
  },
  'ELEC-NO-WRITES': {
    url: `${D}/core/replica-set-elections/`,
    quote: 'The replica set cannot process write operations until the election completes successfully. The replica set can continue to serve read queries if such queries are configured to run on secondaries.',
    en: 'No primary means no writes; reads continue only if they are allowed to run on secondaries.',
    pt: 'Sem primário não há escrita; leituras continuam só se puderem ir para secundários.',
  },
  'VOTE-LIMIT': {
    url: `${D}/core/replica-set-architectures/`,
    quote: 'A replica set can have up to 50 members, but only 7 voting members.',
    en: 'Up to 50 members, but at most 7 voting members.',
    pt: 'Até 50 membros, mas no máximo 7 votantes.',
  },
  'ATLAS-ELECTABLE-COUNT': {
    url: `${A}/cluster-config/multi-cloud-distribution/`,
    quote: 'The total number of electable nodes across all providers and regions in the cluster must equal 3, 5, or 7.',
    en: 'Atlas requires 3, 5 or 7 electable nodes in total.',
    pt: 'O Atlas exige 3, 5 ou 7 nós elegíveis no total.',
  },
  'FAULT-TOLERANCE': {
    url: `${D}/core/replica-set-architectures/`,
    quote: 'Adding a member to the replica set does not always increase the fault tolerance.',
    en: 'Fault tolerance = members that can fail while a majority remains (3→1, 4→1, 5→2, 6→2). Even counts add no tolerance.',
    pt: 'Tolerância a falhas = membros que podem cair mantendo a maioria (3→1, 4→1, 5→2, 6→2). Número par não aumenta a tolerância.',
  },
  'ATLAS-READONLY': {
    url: `${A}/cluster-config/multi-cloud-distribution/`,
    quote: "Read-only nodes don't provide high availability because they don't participate in elections. They can't become the primary for their cluster.",
    en: 'Atlas read-only nodes do not vote and can never become primary; they serve secondary reads.',
    pt: 'Nós read-only do Atlas não votam e nunca viram primário; atendem leituras em secundário.',
  },
  'DC-TWO': {
    url: `${D}/core/replica-set-architecture-geographically-distributed/`,
    quote: 'If Data Center 1 goes down, the replica set becomes read-only. If Data Center 2 goes down, the replica set remains writable as the members in Data Center 1 can hold an election.',
    en: 'With two locations, losing the one that holds the majority makes the replica set read-only.',
    pt: 'Com duas localidades, perder a que tem a maioria deixa o replica set somente leitura.',
  },
  'DC-THREE': {
    url: `${D}/core/replica-set-architecture-geographically-distributed/`,
    quote: 'If any Data Center goes down, the replica set remains writable as the remaining members can hold an election.',
    en: 'Spread so no single location holds a majority (e.g. 1-1-1, 2-2-1) and any one location can fail while staying writable.',
    pt: 'Distribuindo para que nenhuma localidade tenha a maioria (ex.: 1-1-1, 2-2-1), qualquer uma pode cair e o cluster segue gravável.',
  },
  'ATLAS-REGION-HA': {
    url: `${A}/cluster-config/multi-cloud-distribution/`,
    quote: 'Region: Minimum of one node set in three or more different regions. More than one node per region.',
    en: 'To survive a region failure, Atlas recommends nodes in three or more regions.',
    pt: 'Para sobreviver à queda de uma região, o Atlas recomenda nós em três ou mais regiões.',
  },
  'ATLAS-SIM-OUTAGE': {
    url: `${A}/tutorial/test-resilience/simulate-regional-outage/`,
    quote: 'During a simulated outage, Atlas: Removes network connectivity to nodes in the selected regions.',
    en: 'You can rehearse this on a real cluster: Atlas can simulate a regional outage.',
    pt: 'Dá para ensaiar isso num cluster real: o Atlas simula queda de região.',
  },
  'WC-0': {
    url: `${D}/reference/write-concern/`,
    quote: 'Requests no acknowledgment of the write operation. [...] Data can be rolled back if the primary steps down before the write operations replicate to any of the secondaries.',
    en: 'w:0 requests no acknowledgment; the write can be lost or rolled back and is not retryable.',
    pt: 'w:0 não pede confirmação; a escrita pode se perder ou sofrer rollback e não é retentada.',
  },
  'WC-1': {
    url: `${D}/reference/write-concern/`,
    quote: 'Requests acknowledgment that the write operation has propagated to the standalone mongod or the primary in a replica set. Data can be rolled back if the primary steps down before the write operations replicate to any of the secondaries.',
    en: 'w:1 is acknowledged by the primary alone; it can be rolled back if the primary fails before replicating.',
    pt: 'w:1 é confirmado só pelo primário; pode sofrer rollback se o primário cair antes de replicar.',
  },
  'WC-MAJORITY': {
    url: `${D}/reference/write-concern/`,
    quote: 'Requests acknowledgment that the calculated majority of data-bearing voting members have durably written the change to their local oplog.',
    en: 'w:"majority" waits for a majority of voting, data-bearing members. It is the default.',
    pt: 'w:"majority" espera a maioria dos membros votantes com dados. É o padrão.',
  },
  'ATLAS-WC-ADJUSTS': {
    url: `${A}/architecture/current/high-availability/`,
    quote: 'Using majority instead of a definite number value like 2 allows Atlas to automatically adjust to requiring replication across fewer nodes if you experience a temporary node outage, allowing writes to continue after automatic failover.',
    en: '"majority" keeps writes flowing after failover; a fixed number may not.',
    pt: '"majority" mantém as escritas após o failover; um número fixo pode não manter.',
  },
  'WC-N': {
    url: `${D}/reference/write-concern/`,
    quote: 'Secondaries do not need to be voting members to meet the write concern threshold. [...] If you do not specify the wtimeout option and the level of write concern is unachievable, the write operation will block indefinitely. [...] MongoDB does not undo successful data modifications performed before the write concern exceeded the wtimeout time limit.',
    en: 'w:<n> needs n members (non-voting count). If fewer are reachable it blocks; with wtimeout it errors, but the write is not undone.',
    pt: 'w:<n> precisa de n membros (não votantes contam). Se houver menos, trava; com wtimeout retorna erro, mas a escrita não é desfeita.',
  },
  'WC-J': {
    url: `${D}/reference/write-concern/`,
    quote: 'If journaling is enabled, w: "majority" may imply j: true. The writeConcernMajorityJournalDefault replica set configuration setting determines the behavior.',
    en: 'j:true waits for the on-disk journal. "majority" implies it by default; without it, majority writes could roll back only if a majority crashes and restarts.',
    pt: 'j:true espera o journal em disco. "majority" já implica isso por padrão; sem ele, só haveria rollback se a maioria caísse e reiniciasse junta.',
  },
  'ROLLBACK': {
    url: `${D}/core/replica-set-rollbacks/`,
    quote: 'To prevent rollbacks of data that have been acknowledged to the client, run all voting members with journaling enabled and use { w: "majority" } write concern.',
    en: 'Rollback reverts writes the old primary accepted but never replicated. w:"majority" + journaling prevents rollback of acknowledged writes.',
    pt: 'Rollback desfaz escritas que o primário antigo aceitou e não replicou. w:"majority" + journal evita rollback de escritas confirmadas.',
  },
  'PARTITION-TWO-PRIMARIES': {
    url: `${D}/core/causal-consistency-read-write-concerns/`,
    quote: 'Writes with { w: 1 } write concern can complete on either P old or P new. However, the writes to P old (as well as the writes replicated to S 1) roll back once these members regain communication with the rest of the replica set.',
    en: 'During a partition, the old primary may briefly still accept w:1 writes. Those writes roll back when the partition heals; "majority" writes cannot complete there.',
    pt: 'Numa partição, o primário antigo pode aceitar escritas w:1 por alguns instantes. Elas sofrem rollback quando a rede volta; escritas "majority" não completam ali.',
  },
  'RP-PRIMARY': {
    url: `${D}/core/read-preference/`,
    quote: 'If the primary is unavailable, read operations produce an error or throw an exception.',
    en: 'primary: reads only from the primary; error if there is none.',
    pt: 'primary: lê só do primário; erro se não houver.',
  },
  'RP-PRIMARY-PREFERRED': {
    url: `${D}/core/read-preference/`,
    quote: 'In most situations, operations read from the primary member of the set. However, if the primary is unavailable, as is the case during failover situations, operations read from secondary members.',
    en: 'primaryPreferred: primary when it exists, otherwise a secondary.',
    pt: 'primaryPreferred: primário quando existe; senão, um secundário.',
  },
  'RP-SECONDARY': {
    url: `${D}/core/read-preference/`,
    quote: 'Operations read only from the secondary members of the set. If no secondaries are available, then this read operation produces an error or exception.',
    en: 'secondary: reads only from secondaries; error if none is reachable.',
    pt: 'secondary: lê só de secundários; erro se nenhum estiver acessível.',
  },
  'RP-SECONDARY-PREFERRED': {
    url: `${D}/core/read-preference/`,
    quote: 'Operations typically read data from secondary members of the replica set.',
    en: 'secondaryPreferred: a secondary when available, otherwise the primary.',
    pt: 'secondaryPreferred: um secundário quando possível; senão, o primário.',
  },
  'RP-NEAREST': {
    url: `${D}/core/read-preference/`,
    quote: 'Reads in the nearest mode do not consider whether a member is a primary or secondary when routing read operations: primaries and secondaries are treated equivalently.',
    en: 'nearest: the lowest-latency member, primary or secondary.',
    pt: 'nearest: o membro de menor latência, primário ou secundário.',
  },
  'RP-STALE': {
    url: `${D}/core/read-preference/`,
    quote: 'All read preference modes except primary may return stale data because secondaries replicate operations from the primary in an asynchronous process.',
    en: 'Any read served by a secondary may be stale.',
    pt: 'Qualquer leitura atendida por secundário pode estar desatualizada.',
  },
  'RC-LOCAL': {
    url: `${D}/reference/read-concern/`,
    quote: 'The query returns data from the instance with no guarantee that the data has been written to a majority of the replica set members. Data may be rolled back.',
    en: 'local / available: newest data on that node, which may later be rolled back.',
    pt: 'local / available: dado mais novo daquele nó, que pode sofrer rollback depois.',
  },
  'RC-MAJORITY': {
    url: `${D}/reference/read-concern/`,
    quote: 'The query returns the data acknowledged by a majority of the replica set members. Returned documents are durable, even if a failure occurs.',
    en: 'majority: only majority-acknowledged data, which is never rolled back.',
    pt: 'majority: só dado confirmado pela maioria, que nunca sofre rollback.',
  },
  'RC-LINEARIZABLE': {
    url: `${D}/reference/read-concern/`,
    quote: 'You can only specify linearizable read concern for read operations on the primary. [...] Always use maxTimeMS with linearizable read concern if a majority of data-bearing members are unavailable.',
    en: 'linearizable: reflects every majority-acknowledged write before the read. Primary only; use maxTimeMS.',
    pt: 'linearizable: reflete toda escrita confirmada pela maioria antes da leitura. Só no primário; use maxTimeMS.',
  },
  'RC-SNAPSHOT': {
    url: `${D}/reference/read-concern/`,
    quote: 'A query with read concern "snapshot" returns majority-committed data as it appears across shards from a specific single point in time in the recent past.',
    en: 'snapshot: majority-committed data at one point in time (transactions, find, aggregate, distinct).',
    pt: 'snapshot: dado confirmado pela maioria em um ponto no tempo (transações, find, aggregate, distinct).',
  },
  'RETRYABLE-WRITES': {
    url: `${D}/core/retryable-writes/`,
    quote: 'Drivers wait serverSelectionTimeoutMS to find a new primary before retrying. Retryable writes fail if failover takes longer than this timeout.',
    en: 'Drivers retry a write once, after waiting up to serverSelectionTimeoutMS for a new primary. w:0 writes are not retried.',
    pt: 'O driver retenta a escrita uma vez, após esperar até serverSelectionTimeoutMS por um novo primário. Escritas w:0 não são retentadas.',
  },
  'CAUSAL': {
    url: `${D}/core/causal-consistency-read-write-concerns/`,
    quote: 'If you want causal consistency with data durability, then, as seen from the table, only read operations with "majority" read concern and write operations with "majority" write concern can guarantee all four causal consistency guarantees.',
    en: 'Only "majority" reads + "majority" writes keep read-your-writes and monotonic reads, even across a partition.',
    pt: 'Só leituras "majority" + escritas "majority" garantem ler suas próprias escritas e leituras monotônicas, mesmo numa partição.',
  },
};

export const ruleIds = Object.keys(RULES);
