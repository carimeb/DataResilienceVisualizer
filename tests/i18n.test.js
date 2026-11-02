const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
function harness(search = '') {
  const elements = new Map(), timers = new Map();
  let timerId = 0;
  const document = { activeElement: null, documentElement: { lang: 'en' } };
  function element(id) {
    if (elements.has(id)) return elements.get(id);
    const attrs = new Map(), classes = new Set();
    const el = {
      id, value: '', textContent: '', innerHTML: '', style: {}, dataset: {},
      options: [{ text: 'w: "majority"' }], selectedIndex: 0,
      disabled: false, isConnected: true, children: [],
      classList: {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        contains: name => classes.has(name),
        toggle(name, force) {
          const enabled = force === undefined ? !classes.has(name) : force;
          if (enabled) classes.add(name); else classes.delete(name);
          return enabled;
        },
      },
      get firstChild() { return this.children[0] || null; },
      insertBefore(child) { this.children.unshift(child); child.parentElement = this; },
      remove() { this.isConnected = false; if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); },
      setAttribute: (name, value) => attrs.set(name, String(value)),
      getAttribute: name => attrs.get(name) ?? null,
      addEventListener() {}, querySelectorAll: () => [], querySelector: () => null,
      focus() { document.activeElement = this; },
    };
    elements.set(id, el);
    return el;
  }
  const staticText = [
    '  Replica Set Topology ', '▶ Simulate Write', 'Show/hide CAP Theorem positioning panel',
    ' 10 ', 'w: "majority"',
  ].map(nodeValue => ({ nodeValue, isConnected: true, parentElement: { closest: () => null } }));
  const languageButtons = ['en', 'pt', 'es'].map(lang => {
    const el = element('lang-' + lang); el.dataset.lang = lang; return el;
  });
  const reset = element('reset'); reset.setAttribute('aria-label', 'Reset replica set to initial configuration');
  Object.assign(document, {
    getElementById: element,
    createElement: tag => element(`new-${tag}-${elements.size}`),
    createTreeWalker() { let i = 0; return { nextNode: () => staticText[i++] || null }; },
    querySelectorAll(selector) {
      if (selector === '[data-lang]') return languageButtons;
      if (selector === '[title], [aria-label]') return [reset];
      return [];
    },
  });
  let currentURL = new URL('https://example.com/DataResilienceVisualizer/' + search);
  const location = { get href() { return currentURL.href; }, get search() { return currentURL.search; } };
  const context = vm.createContext({
    console, document, NodeFilter: { SHOW_TEXT: 4 }, URL, URLSearchParams,
    window: { location, history: { replaceState(_state, _title, url) { currentURL = new URL(url); } } },
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    clearTimeout: id => timers.delete(id),
    setInterval(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    clearInterval: id => timers.delete(id),
  });
  for (const file of ['state', 'i18n', 'utils', 'cap', 'tab-rs', 'tab-wc', 'tab-mr', 'main']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', `${file}.js`), 'utf8'), context);
  }
  const run = code => vm.runInContext(code, context);
  for (const [id, value] of Object.entries({
    'rs-size': '3', 'rs-dist': '1', 'rs-wc': 'wmaj', 'rs-rp': 'primary',
    'wc-w': 'wmaj', 'wc-j': 'true', 'wc-rc': 'majority', 'wc-rp': 'primary', 'mr-config': '3r3b',
  })) element(id).value = value;
  run('initLang(); S.rs.nodes = rsBuildNodes(); mrInitialize();');
  return { run, element, document, staticText, languageButtons, timers, location };
}

test('language defaults to English and honors only supported explicit URL languages', () => {
  assert.equal(harness().run('S.lang'), 'en');
  assert.equal(harness('?lang=fr').run('S.lang'), 'en');
  for (const lang of ['en', 'pt', 'es']) {
    const h = harness(`?lang=${lang}&example=kept`);
    assert.equal(h.run('S.lang'), lang);
    assert.equal(h.document.documentElement.lang, lang === 'pt' ? 'pt-BR' : lang);
    assert.equal(h.languageButtons.find(button => button.dataset.lang === lang).getAttribute('aria-pressed'), 'true');
    h.run("setLang('es')");
    assert.equal(new URL(h.location.href).searchParams.get('example'), 'kept');
    assert.equal(new URL(h.location.href).searchParams.get('lang'), 'es');
  }
});

test('switching language preserves failures, elections, selections and active simulation state', () => {
  const h = harness();
  h.element('wc-w').value = 'w1';
  h.element('wc-rc').value = 'local';
  h.element('wc-rp').value = 'secondary';
  h.element('btn-sim-write').disabled = true;
  h.element('main').classList.add('cap-visible');
  h.run("S.tab = 'mr'; S.rs.nodes[2].state = 'DOWN'; S.wc.writeRun = 7; S.wc.readRun = 4; mrKillRegion(0)");
  const before = h.run('JSON.stringify(S)'), timers = [...h.timers.entries()];
  for (const lang of ['pt', 'es', 'en']) {
    h.run(`setLang('${lang}')`);
    const current = JSON.parse(h.run('JSON.stringify(S)'));
    current.lang = 'en';
    assert.equal(JSON.stringify(current), before);
    assert.deepEqual([...h.timers.entries()], timers);
    assert.equal(h.element('wc-w').value, 'w1');
    assert.equal(h.element('wc-rc').value, 'local');
    assert.equal(h.element('wc-rp').value, 'secondary');
    assert.equal(h.element('btn-sim-write').disabled, true);
    assert.equal(h.element('main').classList.contains('cap-visible'), true);
  }
  assert.match(h.element('mr-svg-container').innerHTML, /Writes: BLOCKED/);
});

test('static translations preserve the same text nodes, values, timer and control references', () => {
  const h = harness();
  const original = h.staticText[0], reset = h.element('reset');
  h.run("setLang('pt')");
  assert.equal(h.staticText[0], original);
  assert.equal(original.nodeValue, '  Topologia do replica set ');
  assert.equal(h.staticText[1].nodeValue, '▶ Simular escrita');
  assert.equal(h.staticText[3].nodeValue, ' 10 ');
  assert.equal(h.staticText[4].nodeValue, 'w: "majority"');
  assert.equal(h.element('reset'), reset);
  assert.match(reset.getAttribute('aria-label'), /Restaurar/);
  h.run("setLang('en')");
  assert.equal(original.nodeValue, '  Replica Set Topology ');
  assert.equal(reset.getAttribute('aria-label'), 'Reset replica set to initial configuration');
});

test('historical logs created in Spanish return to English and Portuguese without losing timestamps', () => {
  const h = harness('?lang=es');
  h.run("log('INFO', 'WRITE', tx('Primary applied write → ACK (w:1)', 'Primário aplicou a escrita → ACK (w:1)', 'Primario aplicó la escritura → ACK (w:1)'))");
  const row = h.element('log').children[0];
  const timestamp = row.innerHTML.match(/<span class="lt">([^<]+)<\/span>/)[1];
  assert.match(row.innerHTML, /ESCRITURA.*Primario aplicó/);
  h.run("setLang('en')");
  assert.match(row.innerHTML, /WRITE.*Primary applied/);
  h.run("setLang('pt')");
  assert.match(row.innerHTML, /ESCRITA.*Primário aplicou/);
  assert.equal(row.innerHTML.match(/<span class="lt">([^<]+)<\/span>/)[1], timestamp);
  assert.equal(h.element('log').children.length, 1, 'language changes do not add concern log entries');
});

test('every static human-facing phrase is covered while product names and API tokens are retained', () => {
  const h = harness();
  const keys = new Set(h.run('STATIC_TRANSLATIONS.map(entry => entry[0])'));
  const intentional = new Set([
    'EN', 'PT', 'ES', '10', 's', 'w: "majority"', 'j (journal)',
    'primary', 'primaryPreferred', 'secondary', 'secondaryPreferred', 'nearest',
    'readConcern', 'readPreference', 'majority', 'C', 'A', 'P', 'MongoDB', 'CP',
    '~10–30ms', '00:00:00', 'INFO',
  ]);
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const missing = [...html.matchAll(/>([^<>]+)</g)].map(match => match[1]
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim())
    .filter(text => text && !keys.has(text) && !intentional.has(text));
  assert.deepEqual(missing, []);
});
