#!/usr/bin/env bash
# ===========================================================================
# semgrep-scan.sh — SAST automatizado (Trail of Bits + OWASP)
# ===========================================================================
# Implementa el no-negociable "Trail of Bits + OWASP" de ClaudeOS
# (knowledge/guidelines/input-capture-protocol.md). Escaneo estático del
# código con Semgrep (OSS), reglas que se descargan del registry en la 1ª
# corrida (necesita red).
#
# Uso:
#   npm run scan            # informe completo (todas las severidades)
#   npm run scan -- --error # falla (exit!=0) si hay hallazgos ERROR
#
# Instalación de Semgrep (una vez):  pipx install semgrep   (o brew install semgrep)
# ===========================================================================

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

if ! command -v semgrep >/dev/null 2>&1; then
  echo "⚠️  Semgrep no está instalado. Instálalo con:  pipx install semgrep"
  echo "    (o: brew install semgrep). Saltando escaneo."
  exit 0
fi

# Rulesets: Trail of Bits (no-negociable) + OWASP + JS/TS/React + secretos.
# La cobertura TS de ToB es parcial; el peso fuerte lo llevan owasp/js/ts/secrets.
CONFIGS=(
  --config p/trailofbits
  --config p/owasp-top-ten
  --config p/javascript
  --config p/typescript
  --config p/react
  --config p/secrets
)

EXTRA="${1:-}"   # pasar --error para modo bloqueante

echo "== Semgrep — Trail of Bits + OWASP + JS/TS + secretos =="
# shellcheck disable=SC2068
semgrep scan ${CONFIGS[@]} \
  --exclude node_modules --exclude .next --exclude docs \
  --exclude "data" --exclude "*.test.ts" \
  --metrics off \
  $EXTRA \
  .
