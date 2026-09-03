# Build LibreTranslate bản CPU-only, chỉ en+vi

Image chính thức `libretranslate/libretranslate` nặng **~8.68GB đĩa** vì
`pip install torch` mặc định kéo theo CUDA/nvidia (`nvidia-*` + `triton`,
~4.7GB) dù chạy CPU. `Dockerfile.cpu-slim` trong thư mục này build lại,
ép `torch` về bản CPU-only rồi gỡ nvidia/triton — còn **~2.25GB**.

Test thật (2026-09-03, 1 worker `LT_THREADS=1`): dịch đúng cả hai chiều
en↔vi, RAM idle ~110MB, peak lúc dịch ~335MB.

## Build

Cần source đầy đủ của LibreTranslate làm build context — Dockerfile này
không tự đứng một mình được.

```bash
git clone --depth 1 https://github.com/LibreTranslate/LibreTranslate.git libretranslate-src

# Nếu build trên Windows với core.autocrlf=true, entrypoint.sh sẽ bị dính
# CRLF và exec lỗi "no such file or directory" — xóa \r trước khi build:
find libretranslate-src/scripts -name "*.sh" -exec sed -i 's/\r$//' {} \;

cp backend/docker/libretranslate/Dockerfile.cpu-slim libretranslate-src/docker/

cd libretranslate-src
docker build -f docker/Dockerfile.cpu-slim \
  --build-arg with_models=true --build-arg models=en,vi \
  -t libretranslate-cpu-slim:en-vi .
```

`--build-arg models=...` bake model thẳng vào image lúc build (không tải
lúc container start) — đổi danh sách ngôn ngữ ở đây nếu cần thêm/bớt.
Xem mã ngôn ngữ hỗ trợ tại
[LibreTranslate/argos-models](https://github.com/argosopentech/argospm-index).

## Ship xuống VPS

Không build trên VPS (máy yếu). Build ở máy có tài nguyên rồi chuyển
image đã build sẵn qua `docker save`/`docker load`, giống hệt cách deploy
`api` và `frontend`:

```bash
docker save libretranslate-cpu-slim:en-vi | gzip | \
  ssh root@<vps-ip> "gunzip | docker load"
```

## Test nhanh sau khi build/deploy

```bash
curl -X POST http://localhost:5000/translate \
  -H "Content-Type: application/json" \
  -d '{"q":"Hello","source":"en","target":"vi","format":"text"}'
```

## Thêm ngôn ngữ sau này

Phải build lại image với `models=en,vi,<thêm>` rồi ship lại — không có cơ
chế tải thêm model lúc runtime trong setup này (đã bỏ volume model để
đơn giản, vì bake sẵn lúc build đã đủ nhanh và không cần internet trên
VPS lúc container khởi động). Mỗi ngôn ngữ thêm vào sẽ tăng RAM idle/peak
đáng kể — đo lại bằng `docker stats` sau khi thêm trước khi deploy thật.
