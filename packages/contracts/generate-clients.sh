#!/usr/bin/env bash
set -euo pipefail

# Генерирует TypeScript-клиент из openapi.json (E01 п. 1.18).
# Один клиент для web, admin и мобильного приложения (React Native).
#
# Установка: brew install openapi-generator

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SPEC="$ROOT_DIR/packages/contracts/openapi.json"
OUT_DIR="$ROOT_DIR/packages/contracts/generated"

if [ ! -f "$SPEC" ]; then
  echo "Спецификация не найдена: $SPEC" >&2
  echo "Сначала выполните: pnpm --filter @posylki/api run contracts:generate" >&2
  exit 1
fi

if ! command -v openapi-generator >/dev/null 2>&1; then
  echo "openapi-generator не найден в PATH. Установите: brew install openapi-generator" >&2
  exit 1
fi

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

echo "== TypeScript (typescript-fetch) — для web, admin и мобильного приложения =="
openapi-generator generate \
  -i "$SPEC" \
  -g typescript-fetch \
  -o "$OUT_DIR/typescript" \
  --additional-properties=npmName=@posylki/api-client,supportsES6=true \
  --global-property=apiTests=false,modelTests=false,apiDocs=false,modelDocs=false

echo "Готово: $OUT_DIR"
