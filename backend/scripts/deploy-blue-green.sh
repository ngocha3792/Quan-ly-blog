#!/usr/bin/env bash
# Orchestrator chính của blue-green deploy. Chạy trên VPS, gọi bởi
# .github/workflows/deploy-backend.yml qua SSH (bọc flock ở tầng caller —
# xem DEPLOYMENT.md), hoặc chạy tay lúc bootstrap/debug.
#
# Dùng: ./scripts/deploy-blue-green.sh <sha>
#
# Không rollback database tự động. Không migrate lùi. Xem DEPLOYMENT.md
# mục "Chính sách migration expand-contract" và "Không rollback database
# tự động" trước khi đổi logic ở đây.

set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# shellcheck source=lib/blue-green-common.sh
source "scripts/lib/blue-green-common.sh"

SHA="${1:?Dùng: deploy-blue-green.sh <sha>}"

API_REPO="${API_REPO:-ghcr.io/ngocha3792/quan-ly-blog-api}"
MIGRATION_REPO="${MIGRATION_REPO:-ghcr.io/ngocha3792/quan-ly-blog-migration}"
API_IMAGE="${API_REPO}:${SHA}"
MIGRATION_IMAGE="${MIGRATION_REPO}:${SHA}"

GRACE_SECONDS="${GRACE_SECONDS:-90}"

read -r CURRENT_COLOR CURRENT_SHA < <(read_release "current")
TARGET_COLOR="$(other_color "${CURRENT_COLOR}")"

log "=== Deploy ${SHA} ==="
log "current=${CURRENT_COLOR} (sha=${CURRENT_SHA})  target=${TARGET_COLOR}"

log "--- [1/8] Pull image ---"
docker pull "${API_IMAGE}"
docker pull "${MIGRATION_IMAGE}"

log "--- [2/8] Backup database trước khi migrate ---"
if ! ./scripts/backup-postgres.sh; then
  log "BACKUP THẤT BẠI — dừng deploy. ${CURRENT_COLOR} (sha=${CURRENT_SHA}) không hề bị đụng tới."
  exit 1
fi

log "--- [3/8] Chạy migration một lần (chưa đụng tới ${CURRENT_COLOR}) ---"
if ! run_migration "${TARGET_COLOR}" "${MIGRATION_IMAGE}" "${API_IMAGE}"; then
  log "MIGRATION THẤT BẠI — dừng deploy. ${CURRENT_COLOR} (sha=${CURRENT_SHA}) vẫn đang phục vụ traffic bình thường."
  exit 1
fi

log "--- [4/8] Start slot ${TARGET_COLOR} ---"
start_slot "${TARGET_COLOR}" "${API_IMAGE}"

log "--- [5/8] Chờ ${TARGET_COLOR} healthy ---"
if ! wait_healthy "${TARGET_COLOR}"; then
  log "Slot ${TARGET_COLOR} không healthy — dừng deploy, KHÔNG switch traffic."
  exit 1
fi

log "--- [6/8] Smoke test trực tiếp slot ${TARGET_COLOR} ---"
target_port="$(port_for_color "${TARGET_COLOR}")"
if ! ./scripts/smoke-test.sh "http://127.0.0.1:${target_port}/api/v1"; then
  log "Smoke test slot ${TARGET_COLOR} thất bại — dừng deploy, KHÔNG switch traffic."
  exit 1
fi

log "--- [7/8] Switch Nginx -> ${TARGET_COLOR} ---"
switch_nginx "${TARGET_COLOR}"

log "--- [8/8] Smoke test qua domain công khai sau switch ---"
PUBLIC_URL="${PUBLIC_SMOKE_URL:-https://blogy.id.vn/api/v1}"
if ! ./scripts/smoke-test.sh "${PUBLIC_URL}"; then
  log "Smoke test công khai THẤT BẠI sau switch — tự động switch ngược lại ${CURRENT_COLOR}."
  switch_nginx "${CURRENT_COLOR}"
  log "Đã switch ngược lại ${CURRENT_COLOR}. Slot ${TARGET_COLOR} vẫn để nguyên (không xoá) để debug."
  exit 1
fi

record_release "deploy" "${CURRENT_COLOR}" "${CURRENT_SHA}" "${TARGET_COLOR}" "${SHA}" "OK"
log "Deploy OK: traffic đang ở ${TARGET_COLOR} (sha=${SHA})."

log "Giữ ${CURRENT_COLOR} sống thêm ${GRACE_SECONDS}s trước khi dừng..."
sleep "${GRACE_SECONDS}"

if [[ "${CURRENT_SHA}" != "-" ]]; then
  stop_slot "${CURRENT_COLOR}" "${API_REPO}:${CURRENT_SHA}" || log "!! Dừng slot ${CURRENT_COLOR} thất bại — dọn tay sau, không chặn deploy (traffic đã an toàn ở ${TARGET_COLOR})."
else
  log "Lần deploy đầu tiên — không có slot ${CURRENT_COLOR} thật nào để dừng."
fi

./scripts/cleanup-images.sh || log "!! cleanup-images.sh thất bại — không chặn deploy, dọn tay sau."

log "=== Hoàn tất ==="
