#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PPTIST="${ROOT}/third_party/pptist"

if [[ ! -f "${PPTIST}/package-lock.json" ]]; then
  echo "[build-embedded-pptist] missing vendored PPTist source at ${PPTIST}" >&2
  exit 1
fi

echo "[build-embedded-pptist] installing vendored dependencies"
(
  cd "${PPTIST}"
  HUSKY=0 npm ci
)

echo "[build-embedded-pptist] running vendored source tests"
(
  cd "${PPTIST}"
  npx tsx --test tests/*.test.ts
)

echo "[build-embedded-pptist] type-checking vendored source"
(
  cd "${PPTIST}"
  npm run type-check
)

echo "[build-embedded-pptist] building vendored source"
(
  cd "${PPTIST}"
  npm run build-only
)

cd "${ROOT}"
node scripts/verify-font-licenses.mjs third_party/pptist/src/assets/fonts
node scripts/sync-embedded-pptist.mjs \
  --dist third_party/pptist/dist \
  --public public/pptist \
  --css scripts/assets/officedex-embed.css

echo "[build-embedded-pptist] synchronized public/pptist"
