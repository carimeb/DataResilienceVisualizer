"""
End-to-end checks in headless Chromium, against the built single-file page.
  python3 test/e2e.py [--shots DIR]

1. Every scenario, EN and PT-BR, light and dark: no JS errors, nothing drawn outside the canvas, no text
   overflowing its pill/button, no overlapping nodes, every arrowhead on its node, DOM roles == engine roles.
2. Monkey test: hundreds of random clicks on nodes, region buttons, steppers and settings, with the same
   checks after every step (this replaces clicking through scenarios by hand).
3. Phone width: the page never scrolls sideways.
"""
import os, sys, random, json
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = 'file://' + os.path.join(ROOT, 'dist', 'data-resilience-visualizer.html')
SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else None

CHECK_JS = r"""
() => {
  const P = [];
  const svg = document.querySelector('#canvas svg');
  const vb = svg.viewBox.baseVal;
  const inVB = (b) => b.x >= -0.5 && b.y >= -0.5 && b.x + b.width <= vb.width + 0.5 && b.y + b.height <= vb.height + 0.5;
  svg.querySelectorAll('rect, circle, text, path, ellipse, line').forEach((el) => {
    if (el.closest('defs')) return;
    const b = el.getBBox();
    if (!inVB(b)) P.push(`outside canvas: <${el.tagName} class="${el.getAttribute('class')}"> ${el.textContent || ''}`);
  });
  // text must fit inside the rect it sits on (pills, buttons, labels, ribbons, app box)
  svg.querySelectorAll('.node, .sbtn, .op-label, .ribbon, .app').forEach((g) => {
    const rects = [...g.querySelectorAll('rect')].map((r) => r.getBBox());
    g.querySelectorAll('text').forEach((tx) => {
      const tb = tx.getBBox();
      const cx = tb.x + tb.width / 2, cy = tb.y + tb.height / 2;
      const host = rects.find((rb) => cx >= rb.x && cx <= rb.x + rb.width && cy >= rb.y && cy <= rb.y + rb.height);
      if (host && (tb.x < host.x - 0.5 || tb.x + tb.width > host.x + host.width + 0.5)) P.push(`text overflow: "${tx.textContent}" (${tb.width.toFixed(1)} > ${host.width.toFixed(1)})`);
    });
  });
  // region names stay clear of the remove button
  svg.querySelectorAll('.region').forEach((g) => {
    const card = g.querySelector('.region-card').getBBox();
    const name = g.querySelector('.region-name').getBBox();
    if (name.x + name.width > card.x + card.width - 34) P.push(`region name too long: ${g.querySelector('.region-name').textContent}`);
  });
  // nodes never overlap
  const bodies = [...svg.querySelectorAll('.node .body')].map((c) => ({ x: +c.getAttribute('cx'), y: +c.getAttribute('cy'), r: +c.getAttribute('r'), id: c.closest('.node').dataset.node }));
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j];
    if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r) P.push(`nodes overlap ${a.id} ${b.id}`);
  }
  // arrowheads end exactly on a node border, and on the node the engine says
  const ev = window.__drv.evaluate();
  svg.querySelectorAll('.arrow[marker-end]').forEach((p) => {
    const m = p.getAttribute('d').match(/L([\d.]+),([\d.]+)\s*$/);
    const [x, y] = [+m[1], +m[2]];
    const hit = bodies.find((b) => Math.abs(Math.hypot(x - b.x, y - b.y) - b.r) < 0.6);
    const kind = p.classList.contains('write') ? 'write' : 'read';
    const want = ev[kind].targetId;
    if (!hit) P.push(`${kind} arrow does not end on a node`);
    else if (hit.id !== want) P.push(`${kind} arrow ends on ${hit.id}, engine says ${want}`);
  });
  // DOM roles == engine roles
  for (const n of ev.nodes) {
    const g = svg.querySelector(`[data-node="${n.id}"]`);
    if (!g) { P.push(`missing node ${n.id}`); continue; }
    if (!g.classList.contains('role-' + n.role.toLowerCase())) P.push(`role mismatch ${n.id}: ${n.role}`);
  }
  if (svg.querySelectorAll('.node').length !== ev.nodes.length) P.push('extra nodes in DOM');
  if (document.documentElement.scrollWidth > window.innerWidth + 1) P.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${window.innerWidth})`);
  return P;
}
"""

def run():
    failures = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        for scheme in ['light', 'dark']:
            ctx = b.new_context(viewport={'width': 1440, 'height': 1000}, color_scheme=scheme)
            pg = ctx.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'fonts' not in m.text else None)
            pg.goto(PAGE)
            pg.wait_for_function('window.__drv')
            presets = pg.evaluate("[...document.querySelectorAll('#scenario option')].map(o => o.value).filter(Boolean)")
            for lang in ['en', 'pt']:
                pg.click(f'.lang button[data-lang="{lang}"]')
                for pid in presets:
                    pg.select_option('#scenario', pid)
                    pg.wait_for_timeout(1000)          # scenario follow-up fires at 900 ms
                    probs = pg.evaluate(CHECK_JS)       # mid-election state
                    if probs: failures.append((scheme, lang, pid, 'electing', probs))
                    pg.evaluate('window.__drv.state.phase === "electing" && window.__drv.finishElection()')
                    pg.wait_for_timeout(150)
                    probs = pg.evaluate(CHECK_JS)
                    if probs: failures.append((scheme, lang, pid, 'steady', probs))
                    if SHOTS and (scheme == 'light' or pid in ('partition', 'two-regions')):
                        pg.screenshot(path=os.path.join(SHOTS, f'{scheme}-{lang}-{pid}.png'), full_page=True)
            if errs: failures.append((scheme, '-', '-', 'js errors', errs))
            ctx.close()

        # Monkey test
        ctx = b.new_context(viewport={'width': 1440, 'height': 1000})
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(PAGE)
        pg.wait_for_function('window.__drv')
        rnd = random.Random(7)
        steps = 400
        for step in range(steps):
            r = rnd.random()
            if r < 0.70:
                handles = pg.query_selector_all('#canvas [data-act]:not(.disabled):not(.locked)')
                h = rnd.choice(handles)
                act = h.get_attribute('data-act')
                if act == 'remove' and rnd.random() < 0.7: continue   # keep topologies interesting
                h.dispatch_event('click')
            elif r < 0.90:
                sid = rnd.choice(['#set-w', '#set-rp', '#set-rc', '#set-app'])
                opts = pg.evaluate(f"[...document.querySelectorAll('{sid} option')].map(o => o.value)")
                pg.select_option(sid, rnd.choice(opts))
            elif r < 0.95:
                pg.click('#set-j')
            else:
                pg.click('#restore')
            if rnd.random() < 0.5:
                pg.evaluate('window.__drv.state.phase === "electing" && window.__drv.finishElection()')
            probs = pg.evaluate(CHECK_JS)
            if probs:
                failures.append(('monkey', '-', f'step {step}', json.dumps(pg.evaluate('window.__drv.state.model')), probs))
                break
        if errs: failures.append(('monkey', '-', '-', 'js errors', errs))

        # Phone width
        pg.set_viewport_size({'width': 400, 'height': 900})
        pg.wait_for_timeout(200)
        probs = [x for x in pg.evaluate(CHECK_JS) if 'sideways' in x]
        if probs: failures.append(('phone', '-', '-', '400px', probs))
        if SHOTS: pg.screenshot(path=os.path.join(SHOTS, 'phone.png'), full_page=False)
        b.close()

    if failures:
        for f in failures[:20]:
            print('FAIL', f[:4]); [print('   ', x) for x in f[4][:8]]
        sys.exit(1)
    print(f'e2e OK: {len(presets)} scenarios x 2 languages x 2 themes (electing + steady), {steps} monkey steps, phone width')

if __name__ == '__main__':
    run()
