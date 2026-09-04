#!/usr/bin/env bash
# Đổi traffic Nginx sang một slot cụ thể — chỉ phần switch, không backup,
# không migration, không healthcheck slot trước đó. Dùng khi cần đổi
# traffic thủ công (vd: rollback khẩn cấp) mà không muốn chạy lại toàn bộ
# deploy-blue-green.sh.
#
# Dùng: ./scripts/switch-slot.sh <blue|green>
#
# Chạy trong thư mục compose (/opt/blog-api/backend).

set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# shellcheck source=lib/blue-green-common.sh
source "scripts/lib/blue-green-common.sh"

COLOR="${1:?Dùng: switch-slot.sh <blue|green>}"

if [[ "${COLOR}" != "blue" && "${COLOR}" != "green" ]]; then
  echo "Lỗi: color phải là 'blue' hoặc 'green', nhận '${COLOR}'" >&2
  exit 1
fi

switch_nginx "${COLOR}"
log "Đã switch Nginx sang ${COLOR}."
