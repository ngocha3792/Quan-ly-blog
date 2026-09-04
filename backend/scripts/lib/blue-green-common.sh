#!/usr/bin/env bash
# Hàm dùng chung giữa deploy-blue-green.sh, switch-slot.sh, rollback.sh.
# Chỉ định nghĩa hàm — không có side effect khi source, an toàn để
# `source` từ nhiều script khác nhau.
#
# Yêu cầu caller đã `cd` vào thư mục compose (/opt/blog-api/backend) và đã
# `set -Eeuo pipefail` trước khi source file này.

COMPOSE_SLOT_FILE="compose.slot.yml"
ENV_FILE=".env.production"
NGINX_CONTAINER="blog-nginx"
NGINX_BLOGY_DIR="docker/nginx-blogy"
RELEASES_DIR="releases"

log() {
  echo "[$(date -u +%H:%M:%S)] $*"
}

# blue -> green, green -> blue.
other_color() {
  if [[ "$1" == "blue" ]]; then
    echo "green"
  else
    echo "blue"
  fi
}

port_for_color() {
  if [[ "$1" == "blue" ]]; then
    echo "3001"
  else
    echo "3002"
  fi
}

# Đọc releases/current hoặc releases/previous.
# Định dạng file: "<color> <sha>" trên một dòng.
# Không có file -> in "blue -" (coi như blue là slot mặc định ban đầu,
# chưa có SHA nào từng deploy).
read_release() {
  local file="${RELEASES_DIR}/$1"
  if [[ -f "${file}" ]]; then
    cat "${file}"
  else
    echo "blue -"
  fi
}

write_release() {
  local name="$1" color="$2" sha="$3"
  mkdir -p "${RELEASES_DIR}"
  echo "${color} ${sha}" > "${RELEASES_DIR}/${name}"
}

append_audit_log() {
  mkdir -p "${RELEASES_DIR}"
  echo "$(date -u +%FT%TZ) $*" >> "${RELEASES_DIR}/audit.log"
}

# Ghi releases/current, releases/previous, và 1 dòng audit.log theo đúng
# format mà scripts/cleanup-images.sh parse để suy ra danh sách SHA cần
# giữ lại (không dùng SHA nào bị bỏ sót thì cleanup mới không xoá nhầm).
record_release() {
  local event="$1" old_color="$2" old_sha="$3" new_color="$4" new_sha="$5" result="$6"

  write_release "current" "${new_color}" "${new_sha}"
  write_release "previous" "${old_color}" "${old_sha}"

  append_audit_log \
    "event=${event} old_color=${old_color} old_sha=${old_sha} new_color=${new_color} new_sha=${new_sha} result=${result}"
}

# Start (hoặc recreate) service "api" của một slot. Không chạy migrate —
# caller tự quyết định có cần migrate trước hay không (deploy có, rollback
# không — xem nguyên tắc expand-contract trong DEPLOYMENT.md).
start_slot() {
  local color="$1" api_image="$2"
  local port
  port="$(port_for_color "${color}")"

  log "Start slot ${color} (image=${api_image}, port=${port})"

  COLOR="${color}" API_PORT="${port}" API_IMAGE="${api_image}" \
    docker compose -p "blog-api-${color}" -f "${COMPOSE_SLOT_FILE}" \
    --env-file "${ENV_FILE}" up -d api
}

run_migration() {
  local color="$1" migration_image="$2"
  local port
  port="$(port_for_color "${color}")"

  log "Chạy migration một lần (image=${migration_image})"

  COLOR="${color}" API_PORT="${port}" MIGRATION_IMAGE="${migration_image}" \
    docker compose -p "blog-api-${color}" -f "${COMPOSE_SLOT_FILE}" \
    --env-file "${ENV_FILE}" run --rm -T migrate
}

stop_slot() {
  local color="$1"
  local port
  port="$(port_for_color "${color}")"

  log "Dừng slot ${color}"

  COLOR="${color}" API_PORT="${port}" API_IMAGE="" \
    docker compose -p "blog-api-${color}" -f "${COMPOSE_SLOT_FILE}" \
    --env-file "${ENV_FILE}" down
}

# Trả về "healthy" | "unhealthy" | "starting" | "missing".
slot_health_status() {
  local color="$1"
  docker inspect --format '{{.State.Health.Status}}' "api-${color}" 2>/dev/null || echo "missing"
}

# Đợi tối đa (tries * 3s), mặc định 30 lần = 90s — khớp GRACE_SECONDS mặc
# định ở deploy-blue-green.sh, xem DEPLOYMENT.md phần lý do 90s không phải
# 5-15 phút (VPS ~1.9GB RAM).
wait_healthy() {
  local color="$1" tries="${2:-30}"
  local status="starting"

  for ((i = 1; i <= tries; i++)); do
    status="$(slot_health_status "${color}")"
    [[ "${status}" == "healthy" ]] && return 0
    sleep 3
  done

  log "Slot ${color} không healthy sau $((tries * 3))s (status cuối: ${status})"
  docker logs "api-${color}" --tail 80 2>&1 || true
  return 1
}

# Đổi traffic Nginx sang một màu: swap symlink + validate + reload.
# KHÔNG rollback nếu nginx -t/-s reload fail — để caller quyết định (đây
# là lỗi cấu hình nghiêm trọng, không phải lỗi tạm thời nên không tự retry).
switch_nginx() {
  local color="$1"
  local target="upstream-${color}.conf"

  if [[ ! -f "${NGINX_BLOGY_DIR}/${target}" ]]; then
    log "Lỗi: không tìm thấy ${NGINX_BLOGY_DIR}/${target}"
    return 1
  fi

  log "Switch Nginx -> ${color}"
  ln -sfn "${target}" "${NGINX_BLOGY_DIR}/upstream-current.conf"

  docker exec "${NGINX_CONTAINER}" nginx -t
  docker exec "${NGINX_CONTAINER}" nginx -s reload
}
