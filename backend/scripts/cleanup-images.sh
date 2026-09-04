#!/usr/bin/env bash
# Giữ lại image current + previous + 1 bản cũ hơn nữa ("emergency") cho cả
# api và migration, xoá phần còn lại. KHÔNG dùng "docker image prune -f"
# mù — nó không phân biệt được image nào còn cần cho rollback.
#
# Chạy sau khi đã switch + dọn slot cũ thành công. Best-effort: image đang
# được container nào đó dùng sẽ tự bị Docker từ chối xoá (in cảnh báo,
# không dừng script).

set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# shellcheck source=lib/blue-green-common.sh
source "scripts/lib/blue-green-common.sh"

API_REPO="${API_REPO:-ghcr.io/ngocha3792/quan-ly-blog-api}"
MIGRATION_REPO="${MIGRATION_REPO:-ghcr.io/ngocha3792/quan-ly-blog-migration}"

if [[ ! -f "${RELEASES_DIR}/audit.log" ]]; then
  log "Chưa có audit.log — chưa từng deploy, không có gì để dọn."
  exit 0
fi

# Union: SHA trong current/previous + 3 SHA mới nhất xuất hiện trong
# audit.log (new_sha=...) — dư một chút còn hơn xoá nhầm.
read -r _ cur_sha < <(read_release "current")
read -r _ prev_sha < <(read_release "previous")
recent_shas="$(grep -oE 'new_sha=[^ ]+' "${RELEASES_DIR}/audit.log" | cut -d= -f2 | tail -3)"

mapfile -t keep_shas < <(
  printf '%s\n%s\n%s\n' "${cur_sha}" "${prev_sha}" "${recent_shas}" \
    | grep -v '^-$' | grep -v '^$' | sort -u
)

if [[ ${#keep_shas[@]} -eq 0 ]]; then
  log "Không xác định được SHA nào cần giữ — bỏ qua cleanup để an toàn."
  exit 0
fi

log "Giữ lại các SHA: ${keep_shas[*]}"

cleanup_repo() {
  local repo="$1"

  local existing_tags
  existing_tags="$(docker images --format '{{.Repository}}:{{.Tag}}' "${repo}" || true)"
  [[ -z "${existing_tags}" ]] && return 0

  while IFS= read -r image_ref; do
    [[ -z "${image_ref}" ]] && continue
    local tag="${image_ref##*:}"

    local should_keep=0
    for sha in "${keep_shas[@]}"; do
      [[ "${tag}" == "${sha}" ]] && should_keep=1 && break
    done

    if [[ "${should_keep}" -eq 0 ]]; then
      log "Xoá image cũ: ${image_ref}"
      docker rmi "${image_ref}" 2>&1 | sed 's/^/    /' || log "  (bỏ qua — có thể image đang được dùng)"
    fi
  done <<< "${existing_tags}"
}

cleanup_repo "${API_REPO}"
cleanup_repo "${MIGRATION_REPO}"

log "Cleanup image xong."
