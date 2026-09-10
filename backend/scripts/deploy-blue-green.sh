#!/usr/bin/env bash
# Orchestrator chính của blue-green deploy. Chạy trên VPS, gọi bởi
# .github/workflows/deploy-backend.yml qua SSH (bọc flock ở tầng caller —
# xem DEPLOYMENT.md), hoặc chạy tay lúc bootstrap/debug.
#
# Dùng: ./scripts/deploy-blue-green.sh <sha> [commit_epoch]
#
# Không rollback database tự động. Không migrate lùi. Xem DEPLOYMENT.md
# mục "Chính sách migration expand-contract" và "Không rollback database
# tự động" trước khi đổi logic ở đây.

set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# shellcheck source=lib/blue-green-common.sh
source "scripts/lib/blue-green-common.sh"

SHA="${1:?Dùng: deploy-blue-green.sh <sha> [commit_epoch]}"
# commit_epoch: Unix timestamp của commit (vd `git show -s --format=%ct
# <sha>`), do CI truyền vào để chặn out-of-order deploy — xem
# is_older_commit() trong lib/blue-green-common.sh. Không truyền (chạy
# tay/bootstrap) -> mặc định giờ hiện tại, tức luôn coi là "mới nhất",
# không bao giờ bị guard chặn khi thao tác tay.
COMMIT_EPOCH="${2:-$(date +%s)}"

API_REPO="${API_REPO:-ghcr.io/ngocha3792/quan-ly-blog-api}"
MIGRATION_REPO="${MIGRATION_REPO:-ghcr.io/ngocha3792/quan-ly-blog-migration}"
API_IMAGE="${API_REPO}:${SHA}"
MIGRATION_IMAGE="${MIGRATION_REPO}:${SHA}"

GRACE_SECONDS="${GRACE_SECONDS:-90}"

read -r CURRENT_COLOR CURRENT_SHA CURRENT_EPOCH < <(read_release "current")
TARGET_COLOR="$(other_color "${CURRENT_COLOR}")"

log "=== Deploy ${SHA} (commit_epoch=${COMMIT_EPOCH}) ==="
log "current=${CURRENT_COLOR} (sha=${CURRENT_SHA}, epoch=${CURRENT_EPOCH})  target=${TARGET_COLOR}"

if is_older_commit "${COMMIT_EPOCH}" "${CURRENT_EPOCH}"; then
  log "Bỏ qua deploy: commit ${SHA} (epoch=${COMMIT_EPOCH}) không mới hơn bản đang chạy" \
    "${CURRENT_SHA} (epoch=${CURRENT_EPOCH}) — một job deploy khác đã xử lý một commit mới hơn hoặc bằng rồi."
  exit 0
fi
log "--- Đảm bảo Redis shared đang chạy ---"

docker compose \
  --env-file "${ENV_FILE}" \
  -f compose.shared.yml \
  up -d redis

for i in $(seq 1 20); do
  REDIS_HEALTH="$(
    docker inspect \
      --format '{{.State.Health.Status}}' \
      blog-redis 2>/dev/null || echo "missing"
  )"

  if [[ "${REDIS_HEALTH}" == "healthy" ]]; then
    log "Redis healthy."
    break
  fi

  if [[ "${i}" -eq 20 ]]; then
    log "Redis không healthy sau thời gian chờ — dừng deploy."
    exit 1
  fi

  sleep 2
done
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
if ! SMOKE_TEST_RETRIES=5 \
  SMOKE_TEST_RETRY_DELAY=2 \
  ./scripts/smoke-test.sh "${PUBLIC_URL}"; then
  log "Smoke test công khai THẤT BẠI sau switch — tự động switch ngược lại ${CURRENT_COLOR}."
  switch_nginx "${CURRENT_COLOR}"
  log "Đã switch ngược lại ${CURRENT_COLOR}. Slot ${TARGET_COLOR} vẫn để nguyên (không xoá) để debug."
  exit 1
fi

record_release "deploy" "${CURRENT_COLOR}" "${CURRENT_SHA}" "${CURRENT_EPOCH}" \
  "${TARGET_COLOR}" "${SHA}" "${COMMIT_EPOCH}" "OK"
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
