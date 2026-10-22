#!/usr/bin/env bash
# Roda todos os testes de tela (Playwright + Chromium, com o banco e o Olist SIMULADOS — não toca em dados reais).
# Uso: bash testes/rodar_tela.sh            (todos)
#      bash testes/rodar_tela.sh teste_nf   (só um)
# Cada teste imprime "ERROS JS: []" quando não há erro de JavaScript. Fotos das telas vão para /tmp/cdp-fotos.
set -u
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
FOTOS=/tmp/cdp-fotos; mkdir -p "$FOTOS/shotsB" "$FOTOS/shotsT" "$FOTOS/shotsN"
# servidor local do site na porta 8766 (os testes abrem http://localhost:8766/)
if ! curl -s localhost:8766 >/dev/null; then (cd "$RAIZ" && setsid nohup python3 -m http.server 8766 >/dev/null 2>&1 < /dev/null &); sleep 1; fi
cd "$FOTOS"
LISTA=${1:-}
for t in "$RAIZ"/testes/tela/teste_*.py; do
  n=$(basename "$t" .py); [ -n "$LISTA" ] && [ "$n" != "$LISTA" ] && continue
  out=$(timeout 180 python3 "$t" "$FOTOS/shotsN" 2>&1)
  r="$(echo "$out" | grep 'ERROS JS' | tail -1)"; tb=$(echo "$out" | grep -c Traceback)
  if [ "$r" = "ERROS JS: []" ] && [ "$tb" = 0 ]; then echo "ok    $n"; else echo "FALHA $n | $r | tracebacks=$tb"; [ -n "$LISTA" ] && echo "$out"; fi
done
