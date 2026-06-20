#!/usr/bin/env bash
# ===========================================================================
# verify-mvp6.1.sh — gate único de validación MVP6.1
# ===========================================================================
# Corre, en orden, las tres puertas que deben pasar antes de commitear cambios
# del modelo de rentabilidades:
#   1. tsc --noEmit            (tipos)
#   2. vitest run              (tests unitarios de lib/returns, taxonomía, FIFO)
#   3. validate-aurum077.mjs   (validación numérica contra el caso de referencia)
#
# Uso:  npm run verify
#
# No falla rápido: corre las tres y al final imprime un resumen. Devuelve
# código != 0 si alguna falla (apto para hooks / CI).
# ===========================================================================

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

bold=$(printf '\033[1m'); green=$(printf '\033[32m'); red=$(printf '\033[31m')
yellow=$(printf '\033[33m'); reset=$(printf '\033[0m')

tsc_ok=0; test_ok=0; val_ok=0

echo "${bold}== 1/3 · TypeScript (tsc --noEmit) ==${reset}"
if npx tsc --noEmit; then tsc_ok=1; echo "${green}tsc OK${reset}"; else echo "${red}tsc FALLA${reset}"; fi
echo

echo "${bold}== 2/3 · Tests unitarios (vitest run) ==${reset}"
if npm run test --silent; then test_ok=1; echo "${green}tests OK${reset}"; else echo "${red}tests FALLAN${reset}"; fi
echo

echo "${bold}== 3/3 · Validación numérica Aurum-077 ==${reset}"
if node scripts/validate-aurum077.mjs; then val_ok=1; echo "${green}validador OK${reset}"; else echo "${red}validador FALLA${reset}"; fi
echo

# SAST informativo (Trail of Bits + OWASP). No bloquea el gate todavía (staged):
# revisa los hallazgos y, cuando el baseline esté limpio, pásalo a bloqueante con
# 'npm run scan -- --error' en pre-push.
echo "${bold}== Extra · Semgrep SAST (Trail of Bits + OWASP, informativo) ==${reset}"
if command -v semgrep >/dev/null 2>&1; then
  bash scripts/semgrep-scan.sh || true
else
  echo "${yellow}semgrep no instalado (pipx install semgrep) — escaneo omitido${reset}"
fi
echo

echo "${bold}==================== RESUMEN ====================${reset}"
status() { [ "$1" -eq 1 ] && echo "${green}OK${reset}" || echo "${red}FALLA${reset}"; }
echo "  tsc        : $(status $tsc_ok)"
echo "  tests      : $(status $test_ok)"
echo "  Aurum-077  : $(status $val_ok)"
echo "${bold}=================================================${reset}"

if [ $tsc_ok -eq 1 ] && [ $test_ok -eq 1 ] && [ $val_ok -eq 1 ]; then
  echo "${green}${bold}Todo verde. Listo para commitear.${reset}"
  exit 0
else
  echo "${yellow}Hay fallos arriba. Revisa antes de commitear.${reset}"
  exit 1
fi
