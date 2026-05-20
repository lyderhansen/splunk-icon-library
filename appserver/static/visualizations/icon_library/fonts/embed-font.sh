#!/bin/bash
# Generate visualization.css with base64-embedded Material Symbols woff2 font.
# This avoids CORS issues in Dashboard Studio's srcdoc iframe.
set -euo pipefail
cd "$(dirname "$0")"

OUTFILE="../visualization.css"
FONTFILE="material_symbols_outlined.woff2"

if [ ! -f "$FONTFILE" ]; then
  echo "ERROR: $FONTFILE not found in $(pwd)" >&2
  exit 1
fi

B64=$(base64 < "$FONTFILE" | tr -d '\n')

cat > "$OUTFILE" << CSSBLOCK
/* Material Symbols Outlined — base64 embedded (no CORS issues)
 * Regenerate with: fonts/embed-font.sh
 */

@font-face {
  font-family: 'Material Symbols Outlined';
  src: url(data:font/woff2;base64,${B64}) format('woff2');
  font-weight: 100 700;
  font-display: swap;
}

/* ── Viz container ─────────────────────────────────────────── */

.icon-library-viz {
  background: transparent;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
CSSBLOCK

echo "Done. Generated $OUTFILE"
echo "Size: $(wc -c < "$OUTFILE" | tr -d ' ') bytes"
