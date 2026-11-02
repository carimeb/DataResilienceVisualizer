// ─── TAB 2: WRITE / READ CONCERNS ────────────────────────────────────────────

function wcRender() {
  const c = $('wc-svg-container'); if (!c) return;
  const wc = $('wc-w')?.value  || 'wmaj';
  const rp = $('wc-rp')?.value || 'primary';
  const rc = $('wc-rc')?.value || 'majority';
  const j  = $('wc-j')?.value === 'true';

  // How many nodes ACK for a 3-node RS
  const acksNeeded = wc === 'w0' ? 0 : wc === 'w1' ? 1 : wc === 'wmaj' ? 2 : 3;

  // Node layout: PRIMARY top-center, two secondaries bottom
  const npos = [
    { x: 290, y: 160, role: 'PRIMARY',   id: 'rs0' },
    { x: 140, y: 270, role: 'SECONDARY', id: 'rs1' },
    { x: 440, y: 270, role: 'SECONDARY', id: 'rs2' },
  ];
  const readTarget = rp === 'secondary' || rp === 'secondaryPreferred' ? 1
                   : rp === 'nearest' ? 2 : 0;

  let svg = `<svg viewBox="0 0 580 345" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:720px;display:block;margin:0 auto">`;
  svg += `<defs>
    <pattern id="dots2" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="rgba(0,30,43,.12)"/></pattern>
    <marker id="arrWW" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="#00684A"/></marker>
    <marker id="arrAK" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="#00684A"/></marker>
    <marker id="arrW0" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="rgba(0,30,43,.54)"/></marker>
    <marker id="arrRR" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="#006EFF"/></marker>
    <marker id="arrOL" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 Z" fill="rgba(0,104,74,0.65)"/></marker>
  </defs>`;
  svg += `<rect width="580" height="345" fill="url(#dots2)" rx="8"/>`;

  // CLIENT APP
  svg += `<rect x="200" y="10" width="180" height="30" rx="8" fill="#fff" stroke="rgba(0,30,43,.22)" stroke-width="1.5"/>
    <text x="290" y="29" text-anchor="middle" font-size="10" fill="rgba(0,30,43,.74)" font-family="Lexend Deca,sans-serif">${tx("CLIENT APPLICATION", "APLICAÇÃO CLIENTE", "APLICACIÓN CLIENTE")}</text>`;

  // ── WRITE PATH: App → Primary ──
  const pri = npos[0];
  // Three separate lanes above the Primary: READ left, WRITE center, ACK right.
  const topY = 43, nodeTop = pri.y - 28;

  if (acksNeeded === 0) {
    // w:0 sends the write but does not wait for an ACK.
    svg += `<line x1="286" y1="${topY}" x2="286" y2="${nodeTop}" stroke="rgba(0,30,43,.54)" stroke-width="1.5" stroke-dasharray="5 4" marker-end="url(#arrW0)"/>`;
    svg += `<rect x="291" y="85" width="65" height="14" rx="4" fill="#FAFBFC" stroke="rgba(0,30,43,.22)"/>`;
    svg += `<text x="323.5" y="95" text-anchor="middle" font-size="8" fill="rgba(0,30,43,.65)" font-family="Lexend Deca,sans-serif">${tx("WRITE (w:0)", "ESCRITA (w:0)", "ESCRITURA (w:0)")}</text>`;
    svg += `<text x="350" y="112" font-size="8" fill="rgba(0,30,43,.54)" font-family="Lexend Deca,sans-serif">${tx("no ACK", "sem ACK", "sin ACK")}</text>`;
  } else {
    svg += `<line x1="286" y1="${topY}" x2="286" y2="${nodeTop}" stroke="#00684A" stroke-width="2" stroke-dasharray="6 3" class="repl" marker-end="url(#arrWW)"/>`;
    svg += `<rect x="292" y="84" width="48" height="14" rx="4" fill="#E3FCF7"/>`;
    svg += `<text x="316" y="94" text-anchor="middle" font-size="8" font-weight="700" fill="#00684A" font-family="Lexend Deca,sans-serif">${tx("WRITE", "ESCRITA", "ESCRITURA")}</text>`;
    // ACK travels back in its own right-hand lane.
    svg += `<line x1="316" y1="${nodeTop}" x2="344" y2="${topY}" stroke="#00684A" stroke-width="1.5" stroke-dasharray="5 3" marker-end="url(#arrAK)"/>`;
    svg += `<rect x="346" y="94" width="32" height="14" rx="4" fill="#E3FCF7"/>`;
    svg += `<text x="362" y="104" text-anchor="middle" font-size="8" font-weight="700" fill="#00684A" font-family="Lexend Deca,sans-serif">ACK</text>`;
  }

  // ── REPLICATION LINES: Primary → Secondaries ──
  for (let i = 1; i <= 2; i++) {
    const sec = npos[i];
    const needsAck = acksNeeded > i;
    const color = needsAck ? 'rgba(0,104,74,0.6)' : 'rgba(0,30,43,.22)';
    const sw    = needsAck ? 2 : 1.5;
    const cls   = needsAck ? 'class="repl"' : 'stroke-dasharray="4 4"';
    svg += `<line x1="${pri.x}" y1="${pri.y}" x2="${sec.x}" y2="${sec.y - 28}" stroke="${color}" stroke-width="${sw}" ${cls} ${needsAck ? 'marker-end="url(#arrOL)"' : ''}/>`;
    const mx = (pri.x + sec.x) / 2 + (i === 1 ? -14 : 8);
    const my = (pri.y + sec.y - 28) / 2 - 4;
    if (needsAck) {
      svg += `<rect x="${mx - 16}" y="${my - 8}" width="32" height="13" rx="3" fill="#E3FCF7"/>`;
      svg += `<text x="${mx}" y="${my + 1}" text-anchor="middle" font-size="8" fill="#00684A" font-family="Lexend Deca,sans-serif">oplog</text>`;
    }
  }

  // ── READ PATH ──
  const rt   = npos[readTarget];
  const readStartX = readTarget === 2 ? 348 : 232;
  const readEndX = readTarget === 0 ? 262 : rt.x + (readTarget === 1 ? 12 : -12);
  const readLabelX = readTarget === 0 ? 176 : readTarget === 1 ? 133 : 380;
  const readLabelY = readTarget === 0 ? 84 : 108;
  svg += `<line x1="${readStartX}" y1="${topY}" x2="${readEndX}" y2="${rt.y - 28}" stroke="#006EFF" stroke-width="1.8" stroke-dasharray="8 4" marker-end="url(#arrRR)"/>`;
  svg += `<rect x="${readLabelX}" y="${readLabelY}" width="79" height="14" rx="4" fill="#EEF4FF" stroke="rgba(0,110,255,.35)"/>`;
  svg += `<text x="${readLabelX + 39.5}" y="${readLabelY + 10}" text-anchor="middle" font-size="8" fill="#0057CC" font-family="Lexend Deca,sans-serif">${tx('READ', 'LEITURA', 'LECTURA')} → ${rt.id}</text>`;

  // ── NODES ──
  npos.forEach((pos, i) => {
    const isPri    = i === 0;
    const isReadTgt = i === readTarget;
    const hasAck   = (isPri && acksNeeded >= 1) || (!isPri && acksNeeded > i);
    svg += `<g>`;
    if (isPri) svg += `<circle cx="${pos.x}" cy="${pos.y}" r="36" fill="none" stroke="rgba(0,237,100,0.3)" stroke-width="1.5" class="pring"/>`;
    svg += mdbNodeIcon(pos.x, pos.y, 54, null, pos.role);
    svg += `<text x="${pos.x}" y="${pos.y + 42}" text-anchor="middle" font-size="9" fill="rgba(0,30,43,.74)" font-family="Lexend Deca,sans-serif">${pos.id}:27017</text>`;
    const bc = isPri ? '#E3FCF7' : '#F9EBFF', tc = isPri ? '#00684A' : '#001E2B';
    svg += `<rect x="${pos.x - 34}" y="${pos.y + 49}" width="68" height="16" rx="8" fill="${bc}"/>`;
    svg += `<text x="${pos.x}" y="${pos.y + 60}" text-anchor="middle" font-size="9" font-weight="700" fill="${tc}" font-family="Lexend Deca,sans-serif">${roleLabel(pos.role)}</text>`;
    if (hasAck) {
      svg += `<circle cx="${pos.x + 25}" cy="${pos.y - 25}" r="10" fill="#00684A" stroke="#fff" stroke-width="2"/>`;
      svg += `<text x="${pos.x + 25}" y="${pos.y - 20}" text-anchor="middle" font-size="11" fill="#fff" font-weight="700">✓</text>`;
    }
    if (isReadTgt) {
      svg += `<circle cx="${pos.x - 25}" cy="${pos.y - 25}" r="10" fill="#006EFF" stroke="#fff" stroke-width="2"/>`;
      svg += `<text x="${pos.x - 25}" y="${pos.y - 20}" text-anchor="middle" font-size="10" fill="#fff" font-weight="700">R</text>`;
    }
    svg += `</g>`;
  });

  // ── CORNER PILLS: journal + readConcern ──
  svg += `<rect x="6" y="6" width="86" height="28" rx="6" fill="${j ? '#E3FCF7' : '#FAFBFC'}" stroke="${j ? 'rgba(0,104,74,.3)' : 'rgba(0,30,43,.12)'}" stroke-width="1"/>`;
  svg += `<text x="49" y="17" text-anchor="middle" font-size="8.5" font-weight="700" fill="${j ? '#00684A' : 'rgba(0,30,43,.54)'}" font-family="Lexend Deca,sans-serif">j: ${j ? 'true' : 'false'}</text>`;
  svg += `<text x="49" y="28" text-anchor="middle" font-size="7.5" fill="${j ? '#00684A' : 'rgba(0,30,43,.54)'}" font-family="Lexend Deca,sans-serif">${j ? tx("disk journal ✓", "journal em disco ✓", "journal en disco ✓") : tx("memory only", "só memória", "solo memoria")}</text>`;

  const rcColor = rc === 'linearizable' ? '#001E2B' : rc === 'majority' ? '#00684A' : rc === 'snapshot' ? '#006EFF' : '#001E2B';
  const rcBg    = rc === 'linearizable' ? '#F9EBFF' : rc === 'majority' ? '#E3FCF7' : rc === 'snapshot' ? '#F9EBFF' : '#FAFBFC';
  const rcBdr   = rc === 'linearizable' ? 'rgba(0,30,43,.22)' : rc === 'majority' ? 'rgba(0,104,74,.3)' : rc === 'snapshot' ? 'rgba(0,30,43,.22)' : 'rgba(0,30,43,.22)';
  svg += `<rect x="488" y="6" width="86" height="28" rx="6" fill="${rcBg}" stroke="${rcBdr}" stroke-width="1"/>`;
  svg += `<text x="531" y="17" text-anchor="middle" font-size="8.5" font-weight="700" fill="${rcColor}" font-family="Lexend Deca,sans-serif">rc: ${rc}</text>`;
  svg += `<text x="531" y="28" text-anchor="middle" font-size="7.5" fill="${rcColor}" font-family="Lexend Deca,sans-serif">${rc === 'majority' ? tx("committed ✓", "confirmado ✓", "confirmado ✓") : rc === 'linearizable' ? 'linearizable' : rc === 'snapshot' ? 'snapshot' : tx("local state", "estado local", "estado local")}</text>`;

  svg += `</svg>`;
  c.innerHTML = svg;
}

function wcUpdate(recordLog = true) {
  const wc = $('wc-w')?.value  || 'wmaj';
  const j  = $('wc-j')?.value === 'true';
  const rc = $('wc-rc')?.value || 'majority';
  const rp = $('wc-rp')?.value || 'primary';

  // Explanatory header
  const wcExplTexts = {
    w0:   tx("<strong>w:0 — Fire &amp; forget.</strong> The driver sends the write and returns immediately without waiting for any server response. Zero latency overhead, zero durability guarantee. A server crash before applying the write loses that data silently. Only appropriate for non-critical telemetry or metrics.", "<strong>w:0 — Envia sem esperar confirmação.</strong> O driver envia a escrita e retorna imediatamente, sem aguardar uma resposta do servidor. Não há espera por confirmação nem garantia de durabilidade. Se o servidor cair antes de aplicar a escrita, o dado pode ser perdido sem aviso. Adequado apenas para telemetria ou métricas não críticas.", "<strong>w:0 — Envía sin esperar confirmación.</strong> El driver envía la escritura y retorna de inmediato, sin esperar respuesta del servidor. No se espera confirmación ni se garantiza durabilidad. Si el servidor cae antes de aplicar la escritura, el dato puede perderse sin aviso. Solo es apropiado para telemetría o métricas no críticas."),
    w1:   tx("<strong>w:1 — Primary acknowledged.</strong> MongoDB waits for the Primary to apply the write (to memory and journal if j:true), then sends ACK to the driver. Fast, but if the Primary crashes before replicating to any Secondary, the write can be lost during failover.", "<strong>w:1 — Confirmação do primário.</strong> O MongoDB espera o primário aplicar a escrita (na memória e no journal, se j:true) e envia um ACK ao driver. É rápido, mas se o primário cair antes de replicar para um secundário, a escrita pode ser perdida no failover.", "<strong>w:1 — Confirmación del primario.</strong> MongoDB espera que el primario aplique la escritura (en memoria y en el journal si j:true) y envía un ACK al driver. Es rápido, pero si el primario cae antes de replicar a un secundario, la escritura puede perderse durante el failover."),
    wmaj: tx("<strong>w:&quot;majority&quot; — Recommended for financial data.</strong> A majority of voting nodes (2 of 3 here) must apply and acknowledge the write. This guarantees the write survives any single-node failure, including an immediate Primary crash followed by election. The new Primary will always have the write.", "<strong>w:&quot;majority&quot; — Recomendado para dados financeiros.</strong> Uma maioria dos nós votantes (2 de 3 aqui) deve aplicar e confirmar a escrita. Isso protege a escrita contra a falha de um nó, inclusive a queda do primário seguida de eleição. O novo primário terá a escrita confirmada.", "<strong>w:&quot;majority&quot; — Recomendado para datos financieros.</strong> Una mayoría de los nodos votantes (2 de 3 aquí) debe aplicar y confirmar la escritura. Esto protege la escritura ante la falla de un nodo, incluida la caída del primario seguida de una elección. El nuevo primario tendrá la escritura confirmada."),
    wall: tx("<strong>w:&quot;all&quot; — Maximum durability.</strong> Every node in the replica set must confirm the write. Safest option, but writes fail (or hang) if any node is down or slow. Use only when absolute durability is more important than availability.", "<strong>w:&quot;all&quot; — Durabilidade máxima.</strong> Cada nó do replica set deve confirmar a escrita. Essa espera aumenta a proteção, mas as escritas falham ou ficam aguardando se um nó estiver fora do ar ou lento. Use apenas quando a durabilidade for mais importante que a disponibilidade.", "<strong>w:&quot;all&quot; — Durabilidad máxima.</strong> Cada nodo del replica set debe confirmar la escritura. Esta espera aumenta la protección, pero las escrituras fallan o quedan esperando si un nodo está caído o lento. Úsalo solo cuando la durabilidad sea más importante que la disponibilidad."),
  };
  const expl = $('wc-explanation');
  if (expl) expl.innerHTML = wcExplTexts[wc] || '';

  // Per-setting descriptions
  const wcDescs = {
    w0:   tx("No ACK. Driver returns as soon as the request is sent over the network.", "Sem ACK. O driver retorna assim que a solicitação é enviada pela rede.", "Sin ACK. El driver retorna en cuanto se envía la solicitud por la red."),
    w1:   tx("ACK from the Primary node only. Replication to secondaries is asynchronous.", "ACK apenas do nó primário. A replicação para os secundários é assíncrona.", "ACK solo del nodo primario. La replicación a los secundarios es asíncrona."),
    wmaj: tx("ACK required from majority of voting nodes (2 of 3). Survives any single-node failure.", "Exige ACK da maioria dos nós votantes (2 de 3). Resiste à falha de um nó.", "Exige ACK de la mayoría de los nodos votantes (2 de 3). Resiste la falla de un nodo."),
    wall: tx("ACK from all 3 nodes required. Highest durability; writes fail if any node is unreachable.", "Exige ACK dos 3 nós. Maior durabilidade; escritas falham se algum nó estiver inacessível.", "Exige ACK de los 3 nodos. Mayor durabilidad; las escrituras fallan si algún nodo está inaccesible."),
  };
  const jDescs = {
    true:  tx("Server writes to on-disk WAL (journal) before sending ACK — survives power failure or process crash.", "O servidor grava no WAL (journal) em disco antes do ACK — resiste à falta de energia ou queda do processo.", "El servidor escribe en el WAL (journal) en disco antes del ACK — resiste cortes de energía o caídas del proceso."),
    false: tx("ACK sent once write is in memory. A server crash before journal flush may lose an acknowledged write.", "O ACK é enviado quando a escrita está na memória. Uma queda antes da gravação do journal pode perder uma escrita já confirmada.", "El ACK se envía cuando la escritura está en memoria. Una caída antes de guardar el journal puede perder una escritura ya confirmada."),
  };
  const rcDescs = {
    local:        tx("Returns the node's local snapshot — may include writes not yet replicated to majority. Risk of dirty reads during failover.", "Retorna os dados locais do nó — pode incluir escritas ainda não replicadas para a maioria. Há risco de ler dados que serão revertidos durante o failover.", "Devuelve los datos locales del nodo — puede incluir escrituras aún no replicadas a la mayoría. Existe riesgo de leer datos que se revertirán durante el failover."),
    available:    tx("Fastest, weakest: may read orphaned documents in sharded clusters. Avoid for financial reads.", "Mais rápido, com menos garantias: pode ler documentos órfãos em clusters com shards. Evite para leituras financeiras.", "Más rápido, con menos garantías: puede leer documentos huérfanos en clústeres con shards. Evítalo para lecturas financieras."),
    majority:     tx("Only returns data committed by a majority — prevents dirty reads. Recommended for financial data.", "Retorna apenas dados confirmados pela maioria — evita ler dados não confirmados. Recomendado para dados financeiros.", "Devuelve solo datos confirmados por la mayoría — evita leer datos sin confirmar. Recomendado para datos financieros."),
    linearizable: tx("Strongest: guarantees reads reflect all prior majority-committed writes. Reads always go to Primary and coordinate with majority — adds round-trip latency.", "Mais forte: garante que leituras reflitam escritas anteriores confirmadas pela maioria. As leituras vão ao primário e coordenam com a maioria — adiciona latência de ida e volta.", "Más fuerte: garantiza que las lecturas reflejen escrituras anteriores confirmadas por la mayoría. Las lecturas van al primario y se coordinan con la mayoría — añade latencia de ida y vuelta."),
    snapshot:     tx("Consistent point-in-time snapshot across the transaction. Provides a consistent view for multi-document ACID transactions.", "Visão consistente de um instante durante a transação. Usado para uma visão consistente em transações ACID com vários documentos.", "Vista consistente de un instante durante la transacción. Se usa para una vista consistente en transacciones ACID con varios documentos."),
  };
  const rpDescs = {
    primary:           tx("Reads always go to the Primary — guarantees zero replication lag.", "As leituras sempre vão ao primário — não há atraso de replicação de um secundário.", "Las lecturas siempre van al primario — no hay retraso de replicación de un secundario."),
    primaryPreferred:  tx("Prefer Primary; automatically fall back to Secondary if Primary is unreachable.", "Prefere o primário; usa um secundário automaticamente se o primário estiver inacessível.", "Prefiere el primario; usa un secundario automáticamente si el primario está inaccesible."),
    secondary:         tx("Always read from a Secondary — may see stale data, but reduces load on Primary.", "Sempre lê de um secundário — pode retornar dados desatualizados, mas reduz a carga no primário.", "Siempre lee de un secundario — puede devolver datos desactualizados, pero reduce la carga del primario."),
    secondaryPreferred:tx("Prefer Secondary for read scaling; falls back to Primary if none available.", "Prefere um secundário para distribuir leituras; usa o primário se nenhum estiver disponível.", "Prefiere un secundario para distribuir lecturas; usa el primario si no hay ninguno disponible."),
    nearest:           tx("Read from an eligible node among those with the lowest network latency. Data may be stale.", "Lê de um nó elegível entre os de menor latência de rede. Os dados podem estar desatualizados.", "Lee de un nodo elegible entre los de menor latencia de red. Los datos pueden estar desactualizados."),
  };

  const set = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
  set('wc-w-desc',  wcDescs[wc] || '');
  set('wc-j-desc',  jDescs[j ? 'true' : 'false'] || '');
  set('wc-rc-desc', rcDescs[rc] || '');
  set('wc-rp-desc', rpDescs[rp] || '');

  // Mode label
  const labels = { w0: tx("⚡ Max Throughput", "⚡ Máxima vazão", "⚡ Máximo rendimiento"), w1: tx("Durable (Primary)", "Durável (primário)", "Durable (primario)"), wmaj: tx("✅ Recommended", "✅ Recomendado", "✅ Recomendado"), wall: tx("🔒 Max Durability", "🔒 Máxima durabilidade", "🔒 Máxima durabilidad") };
  const el = $('wc-mode-label'); if (el) el.textContent = labels[wc] || '';

  wcRender();
  updateCAP();
  if (recordLog) log('INFO', 'CONCERNS', `w:${wc} j:${j} readPreference:${rp} readConcern:${rc}`);
}

function wcReset() {
  // Invalidate any pending simulation steps before restoring the controls.
  S.wc.writeRun++;
  S.wc.readRun++;
  $('btn-sim-write').disabled = false;
  $('btn-sim-read').disabled = false;
  $('wc-w').value = S.wc.w;
  $('wc-j').value = String(S.wc.j);
  $('wc-rc').value = S.wc.rc;
  $('wc-rp').value = S.wc.rp;
  wcUpdate();
  log('SUCCESS', 'CONCERNS', tx("Reset to resilience baseline · w:\"majority\" · j:true · readConcern:majority · readPreference:primary", "Configuração de resiliência restaurada · w:\"majority\" · j:true · readConcern:majority · readPreference:primary", "Configuración de resiliencia restaurada · w:\"majority\" · j:true · readConcern:majority · readPreference:primary"));
}

async function wcSimWrite() {
  const btn = $('btn-sim-write'); btn.disabled = true;
  const run = ++S.wc.writeRun;
  const wc  = $('wc-w')?.value || 'wmaj';
  const j   = $('wc-j')?.value === 'true';
  const acks = wc === 'w0' ? 0 : wc === 'w1' ? 1 : wc === 'wmaj' ? 2 : 3;
  log('INFO', 'WRITE', tx("Driver sending write operation to Primary...", "Driver enviando escrita ao primário...", "Driver enviando escritura al primario..."));
  await sleep(250);
  if (run !== S.wc.writeRun) return;
  if (j) { log('INFO', 'WRITE', tx("Primary applying write to oplog + journal (disk flush)...", "Primário aplicando escrita ao oplog + journal (gravação em disco)...", "Primario aplicando escritura al oplog + journal (escritura en disco)...")); await sleep(300); }
  else   { log('INFO', 'WRITE', tx("Primary applying write to memory buffer (no journal flush)...", "Primário aplicando escrita à memória (sem gravar journal em disco)...", "Primario aplicando escritura en memoria (sin guardar el journal en disco)...")); await sleep(150); }
  if (run !== S.wc.writeRun) return;
  if (acks === 0) {
    log('WARN', 'WRITE', tx("w:0 — driver returned immediately. No acknowledgment sent by server.", "w:0 — o driver retornou imediatamente. O servidor não enviou confirmação.", "w:0 — el driver retornó de inmediato. El servidor no envió confirmación."));
  } else {
    log('SUCCESS', 'WRITE', tx("Primary applied write → ACK (w:1)", "Primário aplicou a escrita → ACK (w:1)", "Primario aplicó la escritura → ACK (w:1)"));
    if (acks >= 2) { await sleep(480); if (run !== S.wc.writeRun) return; log('SUCCESS', 'WRITE', tx("Secondary rs1 applied via oplog replication → majority (2/3) reached", "Secundário rs1 aplicou via replicação do oplog → maioria (2/3) alcançada", "Secundario rs1 aplicó vía replicación del oplog → mayoría (2/3) alcanzada")); }
    if (acks === 3){ await sleep(320); if (run !== S.wc.writeRun) return; log('SUCCESS', 'WRITE', tx("Secondary rs2 applied → all nodes confirmed (w:all)", "Secundário rs2 aplicou → todos os nós confirmaram (w:all)", "Secundario rs2 aplicó → todos los nodos confirmaron (w:all)")); }
    log('SUCCESS', 'WRITE', tx(`✓ Write committed — ${acks} node${acks > 1 ? 's' : ''} acknowledged. Driver unblocked.`, `✓ Escrita confirmada — ${acks} nó(s) confirmou(aram). Driver liberado.`, `✓ Escritura confirmada — ${acks} nodo(s) confirmó(aron). Driver liberado.`));
  }
  await sleep(300); if (run === S.wc.writeRun) btn.disabled = false;
}

async function wcSimRead() {
  const btn = $('btn-sim-read'); btn.disabled = true;
  const run = ++S.wc.readRun;
  const rp  = $('wc-rp')?.value || 'primary';
  const rc  = $('wc-rc')?.value || 'majority';
  const targets = {
    primary:           ['rs0 (PRIMARY)', 'rs0 (PRIMÁRIO)', 'rs0 (PRIMARIO)'],
    primaryPreferred:  ['rs0 (PRIMARY, preferred)', 'rs0 (PRIMÁRIO, preferido)', 'rs0 (PRIMARIO, preferido)'],
    secondary:         ['rs1 (SECONDARY)', 'rs1 (SECUNDÁRIO)', 'rs1 (SECUNDARIO)'],
    secondaryPreferred:['rs1 (SECONDARY, preferred)', 'rs1 (SECUNDÁRIO, preferido)', 'rs1 (SECUNDARIO, preferido)'],
    nearest:           ['rs2 (nearest)', 'rs2 (baixa latência)', 'rs2 (baja latencia)'],
  };
  log('INFO', 'READ', tx(`Read request → driver resolving target node (readPreference: ${rp})`, `Leitura → driver escolhendo o nó de destino (readPreference: ${rp})`, `Lectura → driver eligiendo el nodo de destino (readPreference: ${rp})`));
  await sleep(300);
  if (run !== S.wc.readRun) return;
  log('INFO', 'READ', tx(`Routing to ${targets[rp][0]}`, `Encaminhando para ${targets[rp][1]}`, `Enrutando a ${targets[rp][2]}`));
  await sleep(350);
  if (run !== S.wc.readRun) return;
  if (rc === 'linearizable') {
    log('WARN', 'READ', tx("readConcern:linearizable — coordinating with majority to confirm no later writes exist...", "readConcern:linearizable — coordenando com a maioria para confirmar que não há escritas posteriores...", "readConcern:linearizable — coordinando con la mayoría para confirmar que no hay escrituras posteriores..."));
    await sleep(700);
    if (run !== S.wc.readRun) return;
  }
  const freshness = (rc === 'local' || rc === 'available')
    ? ['local node snapshot (may be slightly stale)', 'dados locais do nó (podem estar desatualizados)', 'datos locales del nodo (pueden estar desactualizados)']
    : rc === 'majority' ? ['majority-committed data', 'dados confirmados pela maioria', 'datos confirmados por la mayoría']
    : rc === 'linearizable' ? ['linearizable — reflects all prior writes', 'linearizable — reflete as escritas anteriores', 'linearizable — refleja las escrituras anteriores']
    : ['snapshot-consistent (transaction)', 'snapshot consistente (transação)', 'snapshot consistente (transacción)'];
  log('SUCCESS', 'READ', tx(`Document returned. Freshness: ${freshness[0]}`, `Documento retornado. Atualidade: ${freshness[1]}`, `Documento devuelto. Actualidad: ${freshness[2]}`));
  await sleep(300); if (run === S.wc.readRun) btn.disabled = false;
}
