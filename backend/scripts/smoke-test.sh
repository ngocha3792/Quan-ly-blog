#!/usr/bin/env bash
# Smoke test tối thiểu cho một base URL — dùng cho cả:
#   - test trực tiếp một slot trước khi switch Nginx:
#       ./scripts/smoke-test.sh http://127.0.0.1:3002/api/v1
#   - test lại qua domain công khai SAU khi đã switch:
#       ./scripts/smoke-test.sh https://blogy.id.vn/api/v1
#
# Chỉ test critical path (health + một endpoint nghiệp vụ thật), không
# test hết API — mục đích là bắt "app chết"/"proxy sai", không phải thay
# thế test suite.

set -Eeuo pipefail

BASE_URL="${1:?Cần truyền base URL, vd: http://127.0.0.1:3002/api/v1}"
MAX_TIME="${SMOKE_TEST_MAX_TIME:-10}"

check() {
  local path="$1" label="$2"
  echo "==> ${label}: ${BASE_URL}${path}"
  if ! curl --fail --silent --show-error --max-time "${MAX_TIME}" "${BASE_URL}${path}" >/dev/null; then
    echo "!! Smoke test thất bại: ${label} (${BASE_URL}${path})" >&2
    return 1
  fi
}

check "/health/live" "Health live"
check "/health/ready" "Health ready (DB)"
check "/posts?limit=1" "Public posts"

echo "==> Smoke test OK: ${BASE_URL}"
