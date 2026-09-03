#!/usr/bin/env bash
# Deploy script starter — chạy trên VPS, trong /opt/blog (xem docs kế hoạch Docker).
#
# Yêu cầu trước khi chạy:
#   - APP_VERSION đặt sẵn (vd: git sha) hoặc export trước khi gọi script.
#   - .env.production và .env.deploy đã có tại thư mục hiện tại, quyền 600.
#   - Đã `docker login` vào registry.
#   - scripts/backup-postgres.sh chạy được với cùng .env.production.
#
# Không tự rollback khi có lỗi — script dừng ngay (set -e) để người vận hành
# tự quyết định roll forward hay rollback theo runbook.

set -euo pipefail

COMPOSE_FILE="compose.prod.yml"
ENV_FILE=".env.production"
HEALTH_URL="${HEALTH_URL:-http://localhost:8080/api/v1/health/live}"
READY_URL="${READY_URL:-http://localhost:8080/api/v1/health/ready}"

if [[ -z "${APP_VERSION:-}" ]]; then
  echo "Lỗi: chưa set APP_VERSION (vd: export APP_VERSION=<git-sha>)" >&2
  exit 1
fi

echo "==> Deploy blog-api version ${APP_VERSION}"

echo "==> [1/6] Pull image"
API_IMAGE="registry.example.com/blog-api-runtime:${APP_VERSION}" \
MIGRATION_IMAGE="registry.example.com/blog-api-migration:${APP_VERSION}" \
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" pull

echo "==> [2/6] Backup database trước khi migrate"
./scripts/backup-postgres.sh

echo "==> [3/6] Chạy migration một lần"
API_IMAGE="registry.example.com/blog-api-runtime:${APP_VERSION}" \
MIGRATION_IMAGE="registry.example.com/blog-api-migration:${APP_VERSION}" \
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" run --rm -T migrate

echo "==> [4/6] Cập nhật API container"
API_IMAGE="registry.example.com/blog-api-runtime:${APP_VERSION}" \
MIGRATION_IMAGE="registry.example.com/blog-api-migration:${APP_VERSION}" \
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d

echo "==> [5/6] Chờ health check"
for i in $(seq 1 30); do
  if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1 && curl -fsS "${READY_URL}" >/dev/null 2>&1; then
    echo "    OK sau ${i} lần thử."
    break
  fi
  if [[ "${i}" -eq 30 ]]; then
    echo "Lỗi: health check không pass sau 30 lần thử. Kiểm tra log rồi cân nhắc rollback." >&2
    exit 1
  fi
  sleep 2
done

echo "==> [6/6] Trạng thái container"
docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" ps

echo "==> Deploy ${APP_VERSION} hoàn tất. Chạy smoke test thủ công trước khi coi là xong."
