// ─── UTILITIES ───────────────────────────────────────────────────────────────

function $(id) { return document.getElementById(id); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

const logEntries = [];
function renderLogEntry(entry) {
  const labels = {
    WARN: ['WARN', 'AVISO', 'AVISO'], ERROR: ['ERROR', 'ERRO', 'ERROR'],
    SUCCESS: ['SUCCESS', 'SUCESSO', 'ÉXITO'], INFO: ['INFO', 'INFO', 'INFO'],
    SYSTEM: ['SYSTEM', 'SISTEMA', 'SISTEMA'], ELECTION: ['ELECTION', 'ELEIÇÃO', 'ELECCIÓN'],
    CONCERNS: ['CONCERNS', 'GARANTIAS', 'GARANTÍAS'],
    WRITE: ['WRITE', 'ESCRITA', 'ESCRITURA'], READ: ['READ', 'LEITURA', 'LECTURA'],
  };
  const label = key => labels[key] ? tx(...labels[key]) : key;
  const cls = { INFO: 'li', WARN: 'lw', ERROR: 'le', SUCCESS: 'ls' }[entry.level] || 'li';
  const message = entry.choices ? tx(...entry.choices) : entry.msg;
  entry.row.innerHTML = `<span class="lt">${entry.ts}</span><span class="${cls}">${label(entry.level)}</span><span class="lc">${label(entry.comp)}</span><span class="lm">${message}</span>`;
}
function renderLogs() { logEntries.forEach(renderLogEntry); }
function log(level, comp, msg) {
  const el = document.getElementById('log');
  const now = new Date();
  const ts = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(n => String(n).padStart(2, '0')).join(':');
  const row = document.createElement('div');
  row.className = 'lr';
  const entry = { level, comp, msg, ts, row, choices: translatedMessages.get(msg) };
  renderLogEntry(entry);
  logEntries.unshift(entry);
  el.insertBefore(row, el.firstChild);
  while (logEntries.length > 80) logEntries.pop().row.remove();
}

// ─── MongoDB Node Icon SVG ────────────────────────────────────────────────────
// Rounded rect with concave sides + green circle + { } monogram
function mdbNodeIcon(cx, cy, size, state, role) {
  const s  = size || 44;
  const w  = s * 0.92;
  const h  = s * 0.92;
  const r  = s * 0.18;   // rounded corners
  const cr = s * 0.30;   // circle radius

  let stroke, circleFill, textFill, bgFill, sw;
  if (state === 'DOWN') {
    stroke = '#C0392B'; circleFill = '#FEE2E2'; textFill = '#C0392B'; bgFill = '#FFF5F5'; sw = 2.5;
  } else if (role === 'PRIMARY') {
    stroke = '#001E2B'; circleFill = '#00ED64'; textFill = '#001E2B'; bgFill = '#FFFFFF'; sw = 3;
  } else {
    stroke = '#001E2B'; circleFill = '#00684A'; textFill = '#FFFFFF'; bgFill = '#FFFFFF'; sw = 2;
  }

  return `
    <rect x="${cx - w/2}" y="${cy - h/2}" width="${w}" height="${h}" rx="${r}" ry="${r}"
      fill="${bgFill}" stroke="${stroke}" stroke-width="${sw}"/>
    <circle cx="${cx}" cy="${cy}" r="${cr}" fill="${circleFill}"/>
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle"
      font-size="${s * 0.20}" font-weight="700" fill="${textFill}"
      font-family="'SF Mono','Consolas','Courier New',monospace">{ }</text>
    ${state === 'DOWN' ? `
      <line x1="${cx - cr*0.65}" y1="${cy - cr*0.65}" x2="${cx + cr*0.65}" y2="${cy + cr*0.65}" stroke="#C0392B" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="${cx + cr*0.65}" y1="${cy - cr*0.65}" x2="${cx - cr*0.65}" y2="${cy + cr*0.65}" stroke="#C0392B" stroke-width="2.5" stroke-linecap="round"/>` : ''}
  `;
}
