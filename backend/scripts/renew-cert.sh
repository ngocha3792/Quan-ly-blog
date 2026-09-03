#!/usr/bin/env bash
# Gia hạn cert Let's Encrypt (certbot chỉ renew thật khi còn <30 ngày tới hạn,
# gọi thường xuyên không sao). Reload Nginx sau nếu renew thành công.
#
# Đăng ký cron (2 lần/ngày, khuyến nghị của certbot):
#   (crontab -l 2>/dev/null; echo '17 3,15 * * * /opt/blog-api/backend/scripts/renew-cert.sh >> /var/log/certbot-renew.log 2>&1') | crontab -
set -e
cd /opt/blog-api/backend

API_IMAGE=blog-api-runtime:local MIGRATION_IMAGE=blog-api-migration:local \
FRONTEND_IMAGE=blog-frontend-runtime:local TRANSLATE_IMAGE=libretranslate-cpu-slim:4lang \
  docker compose -f compose.prod.yml run --rm certbot renew --quiet

docker exec blog-backend-prod-nginx-1 nginx -s reload
