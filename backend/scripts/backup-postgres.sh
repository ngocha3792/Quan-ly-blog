#!/usr/bin/env bash
# Backup PostgreSQL bằng pg_dump --format=custom (custom format cho phép
# pg_restore chọn lọc bảng/song song hóa khi restore).
#
# Đọc DATABASE_URL từ .env.production (hoặc biến môi trường đã export sẵn).
# Dùng image postgres:16-alpine làm client tạm để không phải cài pg_dump
# trên host.
#
# Dùng:
#   ./scripts/backup-postgres.sh
#   ./scripts/backup-postgres.sh /custom/backup/dir

set -euo pipefail

ENV_FILE=".env.production"
COMPOSE_FILE="compose.prod.yml"
BACKUP_DIR="${1:-./backups}"
PG_CLIENT_IMAGE="postgres:16-alpine"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Lỗi: DATABASE_URL chưa được set (kiểm tra ${ENV_FILE})." >&2
  exit 1
fi

# pg_dump không hiểu query parameter kiểu Prisma (?schema=public...) trong
# connection URI — chỉ libpq param mới hợp lệ. Bỏ phần query trước khi dùng.
PG_DUMP_URL="${DATABASE_URL%%\?*}"

# Hostname trong DATABASE_URL (vd: "postgres") chỉ resolve được bên trong
# network Docker do compose tạo ra — "docker run" trần dùng default bridge,
# không có embedded DNS. Lấy đúng network của container postgres đang chạy.
POSTGRES_CID=$(docker compose -f "${COMPOSE_FILE}" ps -q postgres)
if [[ -z "${POSTGRES_CID}" ]]; then
  echo "Lỗi: không tìm thấy container postgres đang chạy (compose -f ${COMPOSE_FILE})." >&2
  exit 1
fi
PG_NETWORK=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' "${POSTGRES_CID}")

mkdir -p "${BACKUP_DIR}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${BACKUP_DIR}/blog_${TIMESTAMP}.dump"

echo "==> Backup database vào ${OUT_FILE}"

docker run --rm \
  --network "${PG_NETWORK}" \
  -e DATABASE_URL="${PG_DUMP_URL}" \
  -v "$(pwd)/${BACKUP_DIR}:/backup" \
  "${PG_CLIENT_IMAGE}" \
  sh -c 'pg_dump --format=custom --dbname="$DATABASE_URL" --file="/backup/'"$(basename "${OUT_FILE}")"'"'

echo "==> Backup xong: ${OUT_FILE}"
echo "==> Checksum:"
sha256sum "${OUT_FILE}" | tee "${OUT_FILE}.sha256"

# Retention cơ bản: chỉ giữ lại 14 backup gần nhất trong thư mục này.
# Chính sách retention thật (daily/weekly/offsite) nên xử lý ở nơi lưu trữ backup.
ls -1t "${BACKUP_DIR}"/blog_*.dump 2>/dev/null | tail -n +15 | while read -r old; do
  echo "==> Xóa backup cũ: ${old}"
  rm -f "${old}" "${old}.sha256"
done
