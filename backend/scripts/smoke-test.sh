#!/usr/bin/env bash
#
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
RETRIES="${SMOKE_TEST_RETRIES:-1}"
RETRY_DELAY="${SMOKE_TEST_RETRY_DELAY:-2}"

check() {
  local path="$1" label="$2"
  local url="${BASE_URL}${path}"
  local attempt

  echo "==> ${label}: ${url}"

  for ((attempt = 1; attempt <= RETRIES; attempt++)); do
    if curl \
      --fail \
      --silent \
      --show-error \
      --max-time "${MAX_TIME}" \
      "${url}" \
      >/dev/null; then

      if (( attempt > 1 )); then
        echo "==> ${label}: OK ở lần ${attempt}/${RETRIES}"
      fi

      return 0
    fi

    if (( attempt < RETRIES )); then
      echo "!! ${label}: lần ${attempt}/${RETRIES} thất bại, thử lại sau ${RETRY_DELAY}s..." >&2
      sleep "${RETRY_DELAY}"
    fi
  done

  echo "!! Smoke test thất bại sau ${RETRIES} lần: ${label} (${url})" >&2
  return 1
}

check "/health/live" "Health live"
check "/health/ready" "Health ready (DB)"
check "/posts?limit=1" "Public posts"

echo "==> Smoke test OK: ${BASE_URL}"
