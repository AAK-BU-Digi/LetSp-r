#!/usr/bin/env bash
# package.sh – bygger en ren zip-fil til Chrome Web Store.
#
# Kun filerne i FILES kommer med. README, privatlivspolitik, eksempel-JSON, start-CSV,
# CHROMEWEBSTORE.md og andre filer i repoet bliver udeladt.
# Tilføjer du en ny fil, som udvidelsen bruger, skal den på listen herunder.
#
# Kør fra repoets rod:  ./package.sh
# Virker i Git Bash (Windows), macOS, Linux og Google Cloud Shell. Kræver "zip".

set -euo pipefail
cd "$(dirname "$0")"

FILES=(
  manifest.json
  schema.json
  background.js
  debug.js
  education-list.js
  content_analyzer.js
  content_analyzer_main.js
  ai-mode-block.js
  report.js
  blocked.html
  blocked.js
  popup.html
  popup.js
  icons/icon-16.png
  icons/icon-32.png
  icons/icon-48.png
  icons/icon-128.png
)

# 1. Alle filer på listen skal findes
missing=0
for f in "${FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "FEJL: $f findes ikke" >&2
    missing=1
  fi
done

# 2. Alle filer, manifestet henviser til, skal være på listen
refs=$(grep -oE '"[A-Za-z0-9_./-]+\.(js|html|json|png)"' manifest.json | tr -d '"' | grep -v '^https\?:' | sort -u)
for r in $refs; do
  if [[ ! " ${FILES[*]} " == *" $r "* ]]; then
    echo "FEJL: manifest.json henviser til $r, men den er ikke med i pakken" >&2
    missing=1
  fi
done
[[ $missing -eq 0 ]] || exit 1

# 3. Advarsel om kodefiler i roden, der ikke er med (glemt at tilføje dem?)
for f in *.js *.html; do
  if [[ ! " ${FILES[*]} " == *" $f "* ]]; then
    echo "ADVARSEL: $f ligger i repoet, men kommer ikke med i pakken" >&2
  fi
done

VERSION=$(grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]+"' manifest.json | grep -oE '[0-9][0-9.]*')
OUTPUT="LetSpaer-v${VERSION}.zip"
rm -f "$OUTPUT"
zip -q -X "$OUTPUT" "${FILES[@]}"
echo "Pakket: $OUTPUT ($(du -h "$OUTPUT" | cut -f1), ${#FILES[@]} filer)"
