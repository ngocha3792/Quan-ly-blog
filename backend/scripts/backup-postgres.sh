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

mkdir -p "${BACKUP_DIR}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_FILE="${BACKUP_DIR}/blog_${TIMESTAMP}.dump"

echo "==> Backup database vào ${OUT_FILE}"

docker run --rm \
  -e DATABASE_URL="${DATABASE_URL}" \
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
