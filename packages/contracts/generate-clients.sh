#!/usr/bin/env bash
set -euo pipefail

# Генерирует типизированные клиенты для трёх платформ из openapi.json
# (E01 п. 1.18). Один инструмент (openapi-generator-cli) на все три языка —
# проще поддерживать одну команду, чем три разных тулчейна.
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

echo "== TypeScript (typescript-fetch) — для web и admin =="
openapi-generator generate \
  -i "$SPEC" \
  -g typescript-fetch \
  -o "$OUT_DIR/typescript" \
  --additional-properties=npmName=@posylki/api-client,supportsES6=true \
  --global-property=apiTests=false,modelTests=false,apiDocs=false,modelDocs=false

echo "== Swift (swift6) — для iOS =="
openapi-generator generate \
  -i "$SPEC" \
  -g swift6 \
  -o "$OUT_DIR/swift" \
  --additional-properties=projectName=PosylkiAPIClient \
  --global-property=apiTests=false,modelTests=false,apiDocs=false,modelDocs=false

echo "== Kotlin — для Android =="
openapi-generator generate \
  -i "$SPEC" \
  -g kotlin \
  -o "$OUT_DIR/kotlin" \
  --additional-properties=packageName=ru.posylki.apiclient \
  --global-property=apiTests=false,modelTests=false,apiDocs=false,modelDocs=false

echo "Готово: $OUT_DIR"
