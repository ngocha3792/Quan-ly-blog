#!/usr/bin/env bash
# One-command rollback — không cần nhớ SHA nào đang chạy. Chạy được độc
# lập qua SSH kể cả khi GitHub Actions không dùng được ("operational
# escape hatch"):
#
#   cd /opt/blog-api/backend && flock -n .deploy.lock ./scripts/rollback.sh
#
# KHÔNG chạy migration, KHÔNG đụng tới Postgres — chỉ đổi lại container +
# traffic. Chỉ an toàn khi migration đã tuân thủ nguyên tắc expand-contract
# (app cũ vẫn đọc/ghi được schema hiện tại) — xem DEPLOYMENT.md.

set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# shellcheck source=lib/blue-green-common.sh
source "scripts/lib/blue-green-common.sh"

read -r CURRENT_COLOR CURRENT_SHA < <(read_release "current")
read -r PREVIOUS_COLOR PREVIOUS_SHA < <(read_release "previous")

if [[ "${PREVIOUS_SHA}" == "-" ]]; then
  log "Không có bản trước đó để rollback về (releases/previous trống)."
  exit 1
fi

log "=== Rollback ${CURRENT_COLOR} (sha=${CURRENT_SHA}) -> ${PREVIOUS_COLOR} (sha=${PREVIOUS_SHA}) ==="

API_REPO="${API_REPO:-ghcr.io/ngocha3792/quan-ly-blog-api}"
PREVIOUS_IMAGE="${API_REPO}:${PREVIOUS_SHA}"
previous_port="$(port_for_color "${PREVIOUS_COLOR}")"

status="$(slot_health_status "${PREVIOUS_COLOR}")"
if [[ "${status}" != "healthy" ]]; then
  log "Slot ${PREVIOUS_COLOR} không chạy/không healthy (status=${status}) — tự dựng lại từ ${PREVIOUS_IMAGE}."

  if ! docker image inspect "${PREVIOUS_IMAGE}" >/dev/null 2>&1; then
    log "Lỗi: không tìm thấy image ${PREVIOUS_IMAGE} trên máy này — thử 'docker pull ${PREVIOUS_IMAGE}' trước, hoặc rollback thủ công bằng SHA khác."
    exit 1
  fi

  start_slot "${PREVIOUS_COLOR}" "${PREVIOUS_IMAGE}"

  if ! wait_healthy "${PREVIOUS_COLOR}"; then
    log "Slot ${PREVIOUS_COLOR} vẫn không healthy sau khi dựng lại — dừng rollback."
    exit 1
  fi
else
  log "Slot ${PREVIOUS_COLOR} đang chạy sẵn và healthy — dùng luôn, không recreate."
fi

log "Smoke test trực tiếp slot ${PREVIOUS_COLOR} trước khi switch..."
if ! ./scripts/smoke-test.sh "http://127.0.0.1:${previous_port}/api/v1"; then
  log "Smoke test slot ${PREVIOUS_COLOR} thất bại — dừng rollback, KHÔNG switch traffic."
  exit 1
fi

switch_nginx "${PREVIOUS_COLOR}"

PUBLIC_URL="${PUBLIC_SMOKE_URL:-https://blogy.id.vn/api/v1}"
if ! ./scripts/smoke-test.sh "${PUBLIC_URL}"; then
  log "!! Smoke test công khai sau rollback THẤT BẠI. Traffic hiện đang ở ${PREVIOUS_COLOR} — kiểm tra tay ngay, không tự động switch lần nữa để tránh dao động qua lại."
  exit 1
fi

record_release "rollback" "${CURRENT_COLOR}" "${CURRENT_SHA}" "${PREVIOUS_COLOR}" "${PREVIOUS_SHA}" "OK"

log "=== Rollback OK: traffic đang ở ${PREVIOUS_COLOR} (sha=${PREVIOUS_SHA}) ==="
log "Slot ${CURRENT_COLOR} (sha=${CURRENT_SHA}) vẫn để nguyên, chưa dừng — tự dừng tay bằng:"
log "  docker compose -p blog-api-${CURRENT_COLOR} -f compose.slot.yml down"
