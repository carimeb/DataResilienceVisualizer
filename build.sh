#!/usr/bin/env bash
# ─── build.sh ────────────────────────────────────────────────────────────────
# Concatenates all JS modules and inlines them into index.html to produce a
# single-file distributable at dist/mongodb-cap-visualizer.html
# Usage:  ./build.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DIST_DIR="dist"
OUT="$DIST_DIR/mongodb-cap-visualizer.html"

JS_FILES=(
  js/state.js
  js/utils.js
  js/cap.js
  js/tab-rs.js
  js/tab-wc.js
  js/tab-mr.js
  js/main.js
)

mkdir -p "$DIST_DIR"

# Build a single JS string by reading each file in order
INLINED_JS="<script>"$'\n'
for f in "${JS_FILES[@]}"; do
  INLINED_JS+="// ═══ ${f} ═══"$'\n'
  INLINED_JS+="$(cat "${f}")"$'\n\n'
done
INLINED_JS+="</script>"

# Use Python to splice it into index.html (avoids shell quoting hell)
python3 - "$OUT" "$INLINED_JS" <<'PYEOF'
import sys, re

out_path  = sys.argv[1]
js_block  = sys.argv[2]

with open("index.html", encoding="utf-8") as fh:
    html = fh.read()

# Strip all  <script src="js/..."></script>  lines that were in the dev version
html = re.sub(r'\n?[ \t]*<script src="js/[^"]*"></script>', '', html)

# Inject the inlined block just before </body>
html = html.replace("</body>", js_block + "\n</body>", 1)

with open(out_path, "w", encoding="utf-8") as fh:
    fh.write(html)

print(f"✓  Built {out_path}  ({len(html):,} bytes)")
PYEOF
