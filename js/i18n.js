// Full phrases are translated explicitly; API values and product names remain unchanged.
const STATIC_TRANSLATIONS = [
  [
    "MongoDB Distributed Architecture & CAP Theorem Visualizer",
    "Visualizador MongoDB de arquitetura distribuída e teorema CAP",
    "Visualizador MongoDB de arquitectura distribuida y teorema CAP"
  ],
  [
    "Distributed Architecture & Read/Write Concerns Visualizer",
    "Visualizador de arquitetura distribuída e garantias de leitura/escrita",
    "Visualizador de arquitectura distribuida y garantías de lectura/escritura"
  ],
  [
    "· For educational purposes only — not a substitute for official MongoDB documentation.",
    "· Material educativo — não substitui a documentação oficial da MongoDB.",
    "· Material educativo — no sustituye la documentación oficial de MongoDB."
  ],
  [
    "Interactive",
    "Interativo",
    "Interactivo"
  ],
  [
    "⬡ CAP Positioning",
    "⬡ Posição CAP",
    "⬡ Posición CAP"
  ],
  [
    "Show/hide CAP Theorem positioning panel",
    "Mostrar/ocultar painel de posição no teorema CAP",
    "Mostrar/ocultar panel de posición en el teorema CAP"
  ],
  [
    "① Replica Set & Failover",
    "① Replica set e failover",
    "① Replica set y failover"
  ],
  [
    "② Write / Read Concerns",
    "② Garantias de escrita / leitura",
    "② Garantías de escritura / lectura"
  ],
  [
    "③ Multi-Region Active-Active",
    "③ Múltiplas regiões ativo-ativo",
    "③ Múltiples regiones activo-activo"
  ],
  [
    "Click any node",
    "Clique em qualquer nó",
    "Haz clic en cualquier nodo"
  ],
  [
    "to simulate a failure. If the Primary goes down, an election starts automatically.",
    "para simular uma falha. Se o primário cair, uma eleição começa automaticamente.",
    "para simular una falla. Si el primario cae, una elección comienza automáticamente."
  ],
  [
    "Click a failed node",
    "Clique em um nó que caiu",
    "Haz clic en un nodo caído"
  ],
  [
    "to bring it back online.",
    "para recuperá-lo.",
    "para recuperarlo."
  ],
  [
    "⏳ Election in progress",
    "⏳ Eleição em andamento",
    "⏳ Elección en curso"
  ],
  [
    "🔴 Complete outage — all nodes are DOWN",
    "🔴 Indisponibilidade total — todos os nós CAÍRAM",
    "🔴 Interrupción total — todos los nodos están CAÍDOS"
  ],
  [
    "Every node in the replica set is unreachable.",
    "Todos os nós do replica set estão inacessíveis.",
    "Todos los nodos del replica set están inaccesibles."
  ],
  [
    "No reads or writes can be served.",
    "Nenhuma leitura ou escrita pode ser atendida.",
    "No se puede atender ninguna lectura ni escritura."
  ],
  [
    "Replica Set Topology",
    "Topologia do replica set",
    "Topología del replica set"
  ],
  [
    "Primary",
    "Primário",
    "Primario"
  ],
  [
    "Secondary",
    "Secundário",
    "Secundario"
  ],
  [
    "Down",
    "Fora do ar",
    "Fuera de servicio"
  ],
  [
    "RS Configuration",
    "Configuração do replica set",
    "Configuración del replica set"
  ],
  [
    "↺ Reset",
    "↺ Reiniciar",
    "↺ Reiniciar"
  ],
  [
    "Number of Nodes",
    "Número de nós",
    "Número de nodos"
  ],
  [
    "3 nodes (minimum)",
    "3 nós (mínimo)",
    "3 nodos (mínimo)"
  ],
  [
    "5 nodes",
    "5 nós",
    "5 nodos"
  ],
  [
    "7 nodes",
    "7 nós",
    "7 nodos"
  ],
  [
    "Region Distribution",
    "Distribuição entre regiões",
    "Distribución entre regiones"
  ],
  [
    "Single region",
    "Uma região",
    "Una región"
  ],
  [
    "2 regions",
    "2 regiões",
    "2 regiones"
  ],
  [
    "3 regions",
    "3 regiões",
    "3 regiones"
  ],
  [
    "Restore 3 healthy AWS nodes in one region and the initial concern settings",
    "Restaurar 3 nós saudáveis na AWS, em uma região, e as garantias iniciais",
    "Restaurar 3 nodos sanos en AWS, en una región, y las garantías iniciales"
  ],
  [
    "Reset replica set to initial configuration",
    "Restaurar a configuração inicial do replica set",
    "Restaurar la configuración inicial del replica set"
  ],
  [
    "Write & Read Concerns",
    "Garantias de escrita e leitura",
    "Garantías de escritura y lectura"
  ],
  [
    "Write Concern",
    "Garantia de escrita (Write Concern)",
    "Garantía de escritura (Write Concern)"
  ],
  [
    "Read Concern",
    "Garantia de leitura (Read Concern)",
    "Garantía de lectura (Read Concern)"
  ],
  [
    "Read Preference",
    "Preferência de leitura",
    "Preferencia de lectura"
  ],
  [
    "w: 1 — Primary only",
    "w: 1 — somente primário",
    "w: 1 — solo primario"
  ],
  [
    "w: \"majority\" (recommended)",
    "w: \"majority\" (recomendado)",
    "w: \"majority\" (recomendado)"
  ],
  [
    "w: all nodes",
    "w: todos os nós",
    "w: todos los nodos"
  ],
  [
    "w: 0 — Unacknowledged",
    "w: 0 — sem confirmação",
    "w: 0 — sin confirmación"
  ],
  [
    "controls",
    "controla",
    "controla"
  ],
  [
    "durability",
    "durabilidade",
    "durabilidad"
  ],
  [
    "— how many replica set nodes must confirm a write before the driver returns success.",
    "— quantos nós do replica set devem confirmar uma escrita antes de o driver retornar sucesso.",
    "— cuántos nodos del replica set deben confirmar una escritura antes de que el driver devuelva éxito."
  ],
  [
    "data freshness",
    "atualidade dos dados",
    "actualidad de los datos"
  ],
  [
    "— whether you see only majority-committed data or also in-flight writes.",
    "— se você vê apenas dados confirmados pela maioria ou também escritas ainda em andamento.",
    "— si ves solo datos confirmados por la mayoría o también escrituras aún en curso."
  ],
  [
    "which node",
    "qual nó",
    "qué nodo"
  ],
  [
    "serves the read. Adjust any setting to see how MongoDB's CAP position shifts.",
    "atende a leitura. Ajuste as configurações para ver como a posição CAP do MongoDB muda.",
    "atiende la lectura. Ajusta la configuración para ver cómo cambia la posición CAP de MongoDB."
  ],
  [
    "Acknowledgment Path",
    "Caminho da confirmação",
    "Ruta de confirmación"
  ],
  [
    "Restore w: majority, j: true, readConcern: majority, readPreference: primary",
    "Restaurar w: majority, j: true, readConcern: majority, readPreference: primary",
    "Restaurar w: majority, j: true, readConcern: majority, readPreference: primary"
  ],
  [
    "Reset read and write concerns to resilience baseline",
    "Restaurar garantias de leitura e escrita para a configuração de resiliência",
    "Restaurar garantías de lectura y escritura a la configuración de resiliencia"
  ],
  [
    "w (acknowledgment)",
    "w (confirmação)",
    "w (confirmación)"
  ],
  [
    "false (memory only)",
    "false (somente memória)",
    "false (solo memoria)"
  ],
  [
    "true (disk flush)",
    "true (gravação em disco)",
    "true (escritura en disco)"
  ],
  [
    "Read Settings",
    "Configurações de leitura",
    "Configuración de lectura"
  ],
  [
    "local (MongoDB default)",
    "local (padrão MongoDB)",
    "local (predeterminado MongoDB)"
  ],
  [
    "available (fastest)",
    "available (mais rápido)",
    "available (más rápido)"
  ],
  [
    "linearizable (strongest)",
    "linearizable (mais forte)",
    "linearizable (más fuerte)"
  ],
  [
    "snapshot (transactions)",
    "snapshot (transações)",
    "snapshot (transacciones)"
  ],
  [
    "▶ Simulate Write",
    "▶ Simular escrita",
    "▶ Simular escritura"
  ],
  [
    "▶ Simulate Read",
    "▶ Simular leitura",
    "▶ Simular lectura"
  ],
  [
    "⚠ 2-Region topology — quorum limitation",
    "⚠ Topologia com 2 regiões — limitação de quórum",
    "⚠ Topología de 2 regiones — limitación de quórum"
  ],
  [
    "With",
    "Com",
    "Con"
  ],
  [
    "2+1 members per shard",
    "2+1 membros por shard",
    "2+1 miembros por shard"
  ],
  [
    ", losing the region with two members leaves only",
    ", perder a região com dois membros deixa apenas",
    ", perder la región con dos miembros deja solo"
  ],
  [
    "1 of 3 votes",
    "1 de 3 votos",
    "1 de 3 votos"
  ],
  [
    ". That shard cannot elect a primary or accept writes. With one member in each of three regions, a single-region failure leaves a majority.",
    ". Esse shard não pode eleger um primário nem aceitar escritas. Com um membro em cada uma de três regiões, a falha de uma região preserva a maioria.",
    ". Ese shard no puede elegir un primario ni aceptar escrituras. Con un miembro en cada una de tres regiones, la falla de una región conserva la mayoría."
  ],
  [
    "Each row is one shard’s replica set; each column is a region.",
    "Cada linha é o replica set de um shard; cada coluna é uma região.",
    "Cada fila es el replica set de un shard; cada columna es una región."
  ],
  [
    "Dashed arrows show oplog replication from the current primary. Fail a region or click a node, then restore it to follow the recovery.",
    "As setas tracejadas mostram a replicação do oplog a partir do primário atual. Derrube uma região ou clique em um nó, depois restaure-o para acompanhar a recuperação.",
    "Las flechas discontinuas muestran la replicación del oplog desde el primario actual. Desactiva una región o haz clic en un nodo y luego restáuralo para seguir la recuperación."
  ],
  [
    "Global Cluster Topology",
    "Topologia do cluster global",
    "Topología del clúster global"
  ],
  [
    "Replication: primary → secondary",
    "Replicação: primário → secundário",
    "Replicación: primario → secundario"
  ],
  [
    "Connected; election in progress",
    "Conectados; eleição em andamento",
    "Conectados; elección en curso"
  ],
  [
    "Connection unavailable",
    "Conexão indisponível",
    "Conexión indisponible"
  ],
  [
    "A restored member rejoins as a secondary. If there is no primary, restoring a majority starts an election. Synchronization time and automatic return to a preferred region are not simulated.",
    "Um membro recuperado volta como secundário. Se não houver primário, restaurar a maioria inicia uma eleição. O tempo de sincronização e o retorno automático à região preferida não são simulados.",
    "Un miembro recuperado vuelve como secundario. Si no hay primario, restaurar la mayoría inicia una elección. El tiempo de sincronización y el regreso automático a la región preferida no se simulan."
  ],
  [
    "* Reads from a surviving secondary require a read preference that allows secondaries and a compatible read concern. Data may be stale. Reads that require a primary cannot run.",
    "* Leituras no secundário sobrevivente exigem uma preferência de leitura que aceite secundários e um read concern compatível. Os dados podem estar desatualizados. Leituras que exigem um primário ficam bloqueadas.",
    "* Las lecturas en el secundario sobreviviente requieren una preferencia de lectura que permita secundarios y un read concern compatible. Los datos pueden estar desactualizados. Las lecturas que exigen un primario quedan bloqueadas."
  ],
  [
    "Deployment Pattern",
    "Padrão de implantação",
    "Patrón de despliegue"
  ],
  [
    "Configuration",
    "Configuração",
    "Configuración"
  ],
  [
    "3 Regions · 3 Backends",
    "3 regiões · 3 backends",
    "3 regiones · 3 backends"
  ],
  [
    "3 Regions · 1 Backend",
    "3 regiões · 1 backend",
    "3 regiones · 1 backend"
  ],
  [
    "2 Regions · 2 Backends ⚠",
    "2 regiões · 2 backends ⚠",
    "2 regiones · 2 backends ⚠"
  ],
  [
    "Simulate Failure",
    "Simular falha",
    "Simular falla"
  ],
  [
    "↺ Restore All",
    "↺ Restaurar tudo",
    "↺ Restaurar todo"
  ],
  [
    "Restore All returns this pattern to its initial primaries and cancels any election.",
    "Restaurar tudo recupera os primários iniciais deste padrão e cancela qualquer eleição.",
    "Restaurar todo recupera los primarios iniciales de este patrón y cancela cualquier elección."
  ],
  [
    "CAP Theorem Position",
    "Posição no teorema CAP",
    "Posición en el teorema CAP"
  ],
  [
    "📌 Simplified model — for illustration only",
    "📌 Modelo simplificado — apenas ilustrativo",
    "📌 Modelo simplificado — solo ilustrativo"
  ],
  [
    "This panel is a directional compass, not a formal proof. It shows how write concern, read concern, and read preference collectively shift the durability/availability trade-off. MongoDB's actual behavior under network partition depends on topology, failure mode, and driver version. Use as a conversation anchor, not a specification.",
    "Este painel oferece uma orientação, não uma prova formal. Ele mostra como write concern, read concern e read preference alteram juntos o equilíbrio entre durabilidade e disponibilidade. O comportamento real do MongoDB em uma partição de rede depende da topologia, do tipo de falha e da versão do driver. Use como apoio à conversa, não como especificação.",
    "Este panel ofrece orientación, no una prueba formal. Muestra cómo write concern, read concern y read preference cambian en conjunto el equilibrio entre durabilidad y disponibilidad. El comportamiento real de MongoDB ante una partición de red depende de la topología, del tipo de falla y de la versión del driver. Úsalo como apoyo para conversar, no como especificación."
  ],
  [
    "Consistency",
    "Consistência",
    "Consistencia"
  ],
  [
    "Availability",
    "Disponibilidade",
    "Disponibilidad"
  ],
  [
    "Partition",
    "Partição",
    "Partición"
  ],
  [
    "Operating Zone",
    "Zona de operação",
    "Zona de operación"
  ],
  [
    "CP — Consistency Priority",
    "CP — Prioridade à consistência",
    "CP — Prioridad a la consistencia"
  ],
  [
    "C ↔ A Trade-off",
    "Equilíbrio C ↔ A",
    "Equilibrio C ↔ A"
  ],
  [
    "← Availability",
    "← Disponibilidade",
    "← Disponibilidad"
  ],
  [
    "Consistency →",
    "Consistência →",
    "Consistencia →"
  ],
  [
    "Impact Metrics",
    "Métricas de impacto",
    "Métricas de impacto"
  ],
  [
    "High",
    "Alta",
    "Alta"
  ],
  [
    "Medium",
    "Média",
    "Media"
  ],
  [
    "Write Latency",
    "Latência de escrita",
    "Latencia de escritura"
  ],
  [
    "Durability",
    "Durabilidade",
    "Durabilidad"
  ],
  [
    "Explanation",
    "Explicação",
    "Explicación"
  ],
  [
    "Active Settings",
    "Configurações ativas",
    "Configuración activa"
  ],
  [
    "SYSTEM",
    "SISTEMA",
    "SISTEMA"
  ],
  [
    "MongoDB CAP Visualizer — click any node or control to begin",
    "MongoDB CAP Visualizer — clique em um nó ou controle para começar",
    "MongoDB CAP Visualizer — haz clic en un nodo o control para comenzar"
  ],
  [
    "Language",
    "Idioma",
    "Idioma"
  ],
  [
    "The MongoDB driver may",
    "O driver MongoDB pode",
    "El driver MongoDB puede"
  ],
  [
    "retry eligible operations automatically",
    "repetir automaticamente operações elegíveis",
    "reintentar automáticamente operaciones elegibles"
  ],
  [
    ". Retries depend on driver options and timeouts. Once a primary is elected, operations can resume; durability depends on the write concern used.",
    ". As tentativas dependem das opções e dos limites de espera do driver. Após a eleição de um primário, as operações podem voltar; a durabilidade depende do write concern usado.",
    ". Los reintentos dependen de las opciones y los tiempos de espera del driver. Tras elegir un primario, las operaciones pueden reanudarse; la durabilidad depende del write concern utilizado."
  ],
  [
    "📖 No majority — writes blocked",
    "📖 Sem maioria — escritas bloqueadas",
    "📖 Sin mayoría — escrituras bloqueadas"
  ],
  [
    "The replica set has lost its voting majority.",
    "O replica set perdeu a maioria dos votos.",
    "El replica set perdió la mayoría de los votos."
  ],
  [
    "Surviving secondaries may still serve reads",
    "Secundários sobreviventes ainda podem atender leituras",
    "Los secundarios sobrevivientes aún pueden atender lecturas"
  ],
  [
    "if the read preference allows secondaries and the read concern can be satisfied. Data may be stale. Reads requiring a primary are blocked. Writes resume after a primary and a majority are available.",
    "se a preferência de leitura permitir secundários e o read concern puder ser atendido. Os dados podem estar desatualizados. Leituras que exigem primário ficam bloqueadas. As escritas voltam quando há um primário e uma maioria disponível.",
    "si la preferencia de lectura permite secundarios y se puede satisfacer el read concern. Los datos pueden estar desactualizados. Las lecturas que exigen primario quedan bloqueadas. Las escrituras vuelven cuando hay un primario y una mayoría disponible."
  ],
  [
    "This is a full database outage. Restore a majority and elect a primary to resume writes; reads from a recovered secondary depend on the read settings.",
    "O banco está totalmente indisponível. Restaure a maioria e eleja um primário para retomar escritas; leituras em um secundário recuperado dependem das configurações de leitura.",
    "La base de datos está totalmente indisponible. Restaura la mayoría y elige un primario para reanudar escrituras; las lecturas en un secundario recuperado dependen de la configuración de lectura."
  ]
];

const LANGUAGES = ['en', 'pt', 'es'];
const translatedMessages = new Map();
const staticBindings = [];
function tx(en, pt, es) {
  const choices = [en, pt, es];
  // A log keeps the complete message so existing entries can change language too.
  for (const value of choices) translatedMessages.set(value, choices);
  return choices[LANGUAGES.indexOf(S.lang)] ?? en;
}
function roleLabel(role) {
  const roles = {
    PRIMARY: ['PRIMARY', 'PRIMÁRIO', 'PRIMARIO'],
    SECONDARY: ['SECONDARY', 'SECUNDÁRIO', 'SECUNDARIO'],
    DOWN: ['DOWN', 'FORA DO AR', 'CAÍDO'],
    'VOTING…': ['VOTING…', 'VOTANDO…', 'VOTANDO…'],
    'READ-ONLY': ['READ-ONLY', 'SÓ LEITURA', 'SOLO LECTURA'],
    OFFLINE: ['OFFLINE', 'FORA DO AR', 'CAÍDO'],
    ELECTING: ['ELECTING', 'EM ELEIÇÃO', 'EN ELECCIÓN'],
  };
  return roles[role] ? tx(...roles[role]) : role;
}
function registerStaticTranslations() {
  const catalog = new Map(STATIC_TRANSLATIONS.map(entry => [entry[0], entry]));
  const normalize = text => text.replace(/\s+/g, ' ').trim();
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest('script, style, noscript')) continue;
    const choices = catalog.get(normalize(node.nodeValue));
    if (choices) staticBindings.push({ node, choices,
      prefix: node.nodeValue.match(/^\s*/)[0], suffix: node.nodeValue.match(/\s*$/)[0] });
  }
  document.querySelectorAll('[title], [aria-label]').forEach(el => {
    for (const attr of ['title', 'aria-label']) {
      const choices = catalog.get(normalize(el.getAttribute(attr) || ''));
      if (choices) staticBindings.push({ el, attr, choices });
    }
  });
}
function applyStaticTranslations() {
  staticBindings.forEach(binding => {
    if (binding.node?.isConnected) binding.node.nodeValue = binding.prefix + tx(...binding.choices) + binding.suffix;
    else if (binding.el?.isConnected) binding.el.setAttribute(binding.attr, tx(...binding.choices));
  });
}
function setLang(lang, render = true, updateUrl = true) {
  if (!LANGUAGES.includes(lang)) return;
  S.lang = lang;
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
  applyStaticTranslations();
  document.querySelectorAll('[data-lang]').forEach(btn => {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', lang);
    window.history.replaceState(null, '', url);
  }
  if (!render) return;
  const focusedId = document.activeElement?.id;
  // Repaint descriptions/diagrams only. No reset, reconfigure, or timer is invoked.
  rsRenderProviderSelectors();
  rsRender();
  wcUpdate(false);
  mrRender();
  mrUpdateInfo();
  updateCAP();
  const capButton = document.getElementById('cap-toggle-btn');
  if (capButton) capButton.textContent = document.getElementById('main').classList.contains('cap-visible')
    ? tx('✕ Hide CAP', '✕ Ocultar CAP', '✕ Ocultar CAP')
    : tx('⬡ CAP Positioning', '⬡ Posição CAP', '⬡ Posición CAP');
  renderLogs();
  if (focusedId) document.getElementById(focusedId)?.focus();
}
function initLang() {
  registerStaticTranslations();
  const requested = new URLSearchParams(window.location.search).get('lang');
  setLang(LANGUAGES.includes(requested) ? requested : 'en', false, false);
}
