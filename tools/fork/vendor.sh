#!/usr/bin/env bash
# Rebuilds the overlay's vendored libraries (offline ES modules for the APK).
# Usage: tools/fork/vendor.sh   (needs Node.js; writes android/app/src/main/assets/www/overlay/vendor)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/android/app/src/main/assets/www/overlay/vendor"
ICONS="$ROOT/tools/fork/icons.list"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

cd "$WORK"
npm init -y >/dev/null
npm install --silent --no-audit --no-fund number-flow@0.5.3 lucide@0.460.0 geist@1.3.1 esbuild@0.24.0

pascal() { awk -F- '{ for (i = 1; i <= NF; i++) printf toupper(substr($i, 1, 1)) substr($i, 2); print "" }'; }
{
  echo "export { NumberFlowLite, define, formatToData } from 'number-flow';"
  echo "export { createElement } from 'lucide';"
  printf "export { %s } from 'lucide';\n" "$(grep -v '^#' "$ICONS" | pascal | paste -sd, -)"
} > entry.js

mkdir -p "$OUT/fonts"
npx esbuild entry.js --bundle --format=esm --minify --legal-comments=eof --outfile="$OUT/libs.js"
cp node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2 "$OUT/fonts/"
cp node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2 "$OUT/fonts/"
cp node_modules/geist/LICENSE.TXT "$OUT/fonts/LICENSE-Geist"
echo "vendor written to $OUT"
