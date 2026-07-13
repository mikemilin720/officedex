#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OFFICEDEX_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${OFFICEDEX_DIR}/.." && pwd)"
OFFICECLI_INTERNAL_DIR="${REPO_ROOT}/officecli-internal"
OFFICECLI_STAGE_BIN="${OFFICEDEX_DIR}/build/officecli/officecli"
APP_PATH="${OFFICEDEX_DIR}/build/bin/OfficeDex.app"
APP_NAME="OfficeDex"

export HTTP_PROXY="${HTTP_PROXY:-http://127.0.0.1:7890}"
export HTTPS_PROXY="${HTTPS_PROXY:-http://127.0.0.1:7890}"

if [[ ! -d "${OFFICECLI_INTERNAL_DIR}" ]]; then
  echo "[build-local-app] missing officecli-internal at ${OFFICECLI_INTERNAL_DIR}" >&2
  exit 1
fi

app_is_running() {
  pgrep -x "${APP_NAME}" >/dev/null 2>&1 || pgrep -x "officedex" >/dev/null 2>&1
}

verify_app_executable() {
  (
    cd "${OFFICEDEX_DIR}"
    node scripts/verify-wails-app.mjs "${APP_PATH}"
  )
}

restart_app() {
  if [[ "${OSTYPE}" != darwin* ]]; then
    echo "[build-local-app] not on macOS, skipping app restart"
    return
  fi

  if app_is_running; then
    echo "[build-local-app] asking running ${APP_NAME} to quit"
    osascript -e "tell application \"${APP_NAME}\" to quit" >/dev/null 2>&1 || true
    for _ in {1..20}; do
      if ! app_is_running; then
        break
      fi
      sleep 0.25
    done
  fi

  if app_is_running; then
    echo "[build-local-app] force stopping lingering ${APP_NAME} process"
    pkill -x "${APP_NAME}" >/dev/null 2>&1 || true
    pkill -x "officedex" >/dev/null 2>&1 || true
    for _ in {1..20}; do
      if ! app_is_running; then
        break
      fi
      sleep 0.25
    done
  fi

  echo "[build-local-app] opening ${APP_PATH}"
  open "${APP_PATH}"
}

echo "[build-local-app] prefetching staged officecli layout"
(
  cd "${OFFICEDEX_DIR}"
  npm run prefetch:officecli
)

echo "[build-local-app] building local officecli-internal"
mkdir -p "$(dirname "${OFFICECLI_STAGE_BIN}")"
(
  cd "${OFFICECLI_INTERNAL_DIR}"
  env -u GOROOT go build -o "${OFFICECLI_STAGE_BIN}" ./cmd/officecli
)

echo "[build-local-app] building embedded PPTist bundle"
PPTIST_DIR="${REPO_ROOT}/PPTist"
if [[ ! -d "${PPTIST_DIR}" ]]; then
  echo "[build-local-app] missing PPTist at ${PPTIST_DIR}" >&2
  exit 1
fi
(
  cd "${PPTIST_DIR}"
  npm run build-only
)
echo "[build-local-app] syncing PPTist dist into officedex/public/pptist"
# wails build below copies public/ into the app, so refresh the embedded PPTist
# bundle here (otherwise the iframe runs a stale build).
rsync -a --delete "${PPTIST_DIR}/dist/" "${OFFICEDEX_DIR}/public/pptist/"
cat > "${OFFICEDEX_DIR}/public/pptist/officedex-embed.css" <<'CSS'
.pptist-editor.is-embed-readonly-mode .layout-content-left-offscreen {
  position: relative !important;
  left: auto !important;
  top: auto !important;
  width: 160px !important;
  height: 100% !important;
  flex: 0 0 160px !important;
  pointer-events: auto !important;
  z-index: auto !important;
  overflow: hidden !important;
  background: #fff !important;
  border-right: 1px solid #e5e7eb !important;
}

.pptist-editor.is-embed-readonly-mode .layout-content-center {
  width: calc(100% - 160px) !important;
  min-width: 0 !important;
  flex: 1 1 auto !important;
}

.pptist-editor.is-embed-editable-mode .layout-content-left {
  width: 128px !important;
  flex: 0 0 128px !important;
}

.pptist-editor.is-embed-editable-mode .layout-content-center {
  width: calc(100% - 128px - 260px) !important;
  min-width: 0 !important;
}

.pptist-editor.is-embed-editable-mode .layout-content-left .thumbnail-slide {
  width: 94px !important;
  height: 52.875px !important;
}

.pptist-editor.is-embed-editable-mode .layout-content-left .thumbnail-slide .elements {
  transform: scale(0.094) !important;
}

.pptist-editor.is-embed-editable-mode .layout-content-left .thumbnail-item {
  padding: 6px 0 !important;
}

.pptist-editor.is-embed-readonly-mode .layout-content-left-offscreen .thumbnails {
  width: 100% !important;
  height: 100% !important;
}

.pptist-editor.is-embed-readonly-mode .layout-content-left-offscreen.thumbnails {
  width: 160px !important;
  height: 100% !important;
}

.pptist-editor.is-embed-readonly-mode .layout-content-left-offscreen .thumbnail-slide {
  width: 118px !important;
  height: 66.375px !important;
  cursor: pointer !important;
  pointer-events: none !important;
}

.pptist-editor.is-embed-readonly-mode .layout-content-left-offscreen .thumbnail-slide * {
  cursor: pointer !important;
  pointer-events: none !important;
}

.pptist-editor.is-embed-readonly-mode .layout-content-left-offscreen .thumbnail-slide .elements {
  transform: scale(0.118) !important;
}

.pptist-editor.is-embed-readonly-mode .layout-content-left-offscreen .thumbnail-item {
  padding: 8px 0 !important;
  cursor: pointer !important;
  pointer-events: auto !important;
}
CSS
node - "${OFFICEDEX_DIR}/public/pptist/index.html" <<'NODE'
const fs = require("node:fs");
const indexPath = process.argv[2];
let html = fs.readFileSync(indexPath, "utf8");
if (!html.includes("officedex-embed.css")) {
  const scriptMatch = html.match(/    <script type="module" crossorigin src="\.\/assets\/index-[^"]+\.js"><\/script>/);
  if (!scriptMatch) throw new Error("PPTist index module script not found");
  html = html.replace(scriptMatch[0], `    <link rel="stylesheet" crossorigin href="./officedex-embed.css">\n${scriptMatch[0]}`);
  fs.writeFileSync(indexPath, html);
}
NODE

echo "[build-local-app] building OfficeDex.app"
(
  cd "${OFFICEDEX_DIR}"
  APP_VERSION="$(node -p 'require(`./package.json`).version')"
  env -u GOROOT wails build -ldflags "-X main.appVersion=${APP_VERSION}"
)
verify_app_executable

echo "[build-local-app] bundling local officecli into app"
(
  cd "${OFFICEDEX_DIR}"
  npm run bundle:officecli:mac
)
verify_app_executable

echo "[build-local-app] verifying codesign"
codesign --verify --deep --strict --verbose=4 "${APP_PATH}"
verify_app_executable

restart_app

echo "[build-local-app] done: ${APP_PATH}"
