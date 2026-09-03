#!/usr/bin/env bash
# Restore PostgreSQL từ file backup tạo bởi scripts/backup-postgres.sh.
#
# ĐÂY LÀ THAO TÁC PHÁ HỦY DỮ LIỆU HIỆN TẠI CỦA DATABASE ĐÍCH.
# Chỉ chạy khi chắc chắn, và ưu tiên restore vào database thử nghiệm trước
# khi restore vào production thật.
#
# Dùng:
#   ./scripts/restore-postgres.sh ./backups/blog_20260101T000000Z.dump
#
# Phải set CONFIRM_RESTORE=yes để script thực sự chạy, tránh restore nhầm.

set -euo pipefail

ENV_FILE=".env.production"
COMPOSE_FILE="compose.prod.yml"
PG_CLIENT_IMAGE="postgres:16-alpine"
BACKUP_FILE="${1:-}"

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "Dùng: $0 <đường-dẫn-file-backup.dump>" >&2
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Lỗi: không tìm thấy file backup: ${BACKUP_FILE}" >&2
  exit 1
fi

if [[ -f "${BACKUP_FILE}.sha256" ]]; then
  echo "==> Kiểm tra checksum"
  sha256sum -c "${BACKUP_FILE}.sha256"
fi

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

if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  echo "Lỗi: thao tác này sẽ GHI ĐÈ database đích." >&2
  echo "Set CONFIRM_RESTORE=yes nếu chắc chắn muốn tiếp tục:" >&2
  echo "  CONFIRM_RESTORE=yes $0 ${BACKUP_FILE}" >&2
  exit 1
fi

BACKUP_DIR="$(cd "$(dirname "${BACKUP_FILE}")" && pwd)"
BACKUP_NAME="$(basename "${BACKUP_FILE}")"

# pg_restore không hiểu query parameter kiểu Prisma (?schema=public...) trong
# connection URI — chỉ libpq param mới hợp lệ. Bỏ phần query trước khi dùng.
PG_RESTORE_URL="${DATABASE_URL%%\?*}"

# Hostname trong DATABASE_URL (vd: "postgres") chỉ resolve được bên trong
# network Docker do compose tạo ra — "docker run" trần dùng default bridge,
# không có embedded DNS. Lấy đúng network của container postgres đang chạy.
POSTGRES_CID=$(docker compose -f "${COMPOSE_FILE}" ps -q postgres)
if [[ -z "${POSTGRES_CID}" ]]; then
  echo "Lỗi: không tìm thấy container postgres đang chạy (compose -f ${COMPOSE_FILE})." >&2
  exit 1
fi
PG_NETWORK=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' "${POSTGRES_CID}")

echo "==> Restore ${BACKUP_FILE} vào database đích trong DATABASE_URL"

docker run --rm \
  --network "${PG_NETWORK}" \
  -e DATABASE_URL="${PG_RESTORE_URL}" \
  -v "${BACKUP_DIR}:/backup:ro" \
  "${PG_CLIENT_IMAGE}" \
  sh -c 'pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "/backup/'"${BACKUP_NAME}"'"'

echo "==> Restore hoàn tất. Chạy smoke test và kiểm tra dữ liệu ngay sau đó."
