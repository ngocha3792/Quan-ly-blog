# Build LibreTranslate bản CPU-only

Image chính thức `libretranslate/libretranslate` nặng **~8.68GB đĩa** vì
`pip install torch` mặc định kéo theo CUDA/nvidia (`nvidia-*` + `triton`,
~4.7GB) dù chạy CPU. `Dockerfile.cpu-slim` trong thư mục này build lại,
ép `torch` về bản CPU-only rồi gỡ nvidia/triton.

## Số liệu đo thật (2026-09-03, 1 worker `LT_THREADS=1`)

Model không tự giải phóng khỏi RAM sau khi dùng — cột "peak" là mức RAM
sau khi **toàn bộ** cặp ngôn ngữ đã được dùng ít nhất 1 lần, tức mức cần
tính cho lâu dài, không phải trường hợp hiếm.

| Ngôn ngữ | Model | Đĩa image | RAM idle | RAM peak (đã dùng hết) |
|---|---|---|---|---|
| en, vi | 2 | 2.25GB | ~110MB | ~335MB |
| en, vi, zh, ja | 6 | 3.07GB | ~278MB | **~1.074GB** |
| en, vi, zh, ja, ko, fr | 10 | 3.88GB | ~198MB | **~1.465GB** (gần chạm giới hạn 1.5GB test) |

**Đang deploy production: `en, vi, zh, ja` (4 ngôn ngữ, 6 model)** — mức
6 ngôn ngữ (10 model) tốn RAM gần hết ngân sách thực tế của VPS
(~1.4GB dư sau khi trừ postgres/api/frontend/nginx + OS), không còn margin
an toàn cho traffic thật nên đã loại. Model tiếng Nhật/Hàn nặng hơn hẳn
model gốc Latin/Trung (~129MB so với ~77-83MB mỗi model) — tính margin
kỹ hơn nếu thêm ngôn ngữ CJK khác.

`compose.prod.yml` đặt `TRANSLATE_MEM_LIMIT=1300M` khớp với con số 4 ngôn
ngữ ở trên — **phải cập nhật giá trị này** nếu đổi sang bộ ngôn ngữ khác.

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
  --build-arg with_models=true --build-arg models=en,vi,zh,ja \
  -t libretranslate-cpu-slim:4lang .
```

`--build-arg models=...` bake model thẳng vào image lúc build (không tải
lúc container start) — đổi danh sách ngôn ngữ ở đây nếu cần thêm/bớt.
Xem mã ngôn ngữ hỗ trợ tại
[LibreTranslate/argos-models](https://github.com/argosopentech/argospm-index).

## Ship xuống VPS

Không build trên VPS (máy yếu — một lần build 6 ngôn ngữ trên VPS suýt
làm đầy đĩa, xem DEPLOYMENT.md). Build ở máy có tài nguyên rồi chuyển
image đã build sẵn qua `docker save`/`docker load`, giống hệt cách deploy
`api` và `frontend`:

```bash
docker save libretranslate-cpu-slim:4lang | gzip | \
  ssh root@<vps-ip> "gunzip | docker load"
```

**Lưu ý**: không chạy lệnh này đồng thời lúc site đang có traffic thật —
`docker load` giải nén vài GB dữ liệu, chiếm CPU/disk I/O đáng kể trên
VPS yếu, từng gây 504 timeout cho request thật của người dùng khi build
+ ship chạy song song với giờ cao điểm test.

## Test nhanh sau khi build/deploy

```bash
curl -X POST http://localhost:5000/translate \
  -H "Content-Type: application/json" \
  -d '{"q":"Hello","source":"en","target":"vi","format":"text"}'
```

Câu quá ngắn (1-2 từ) đôi khi bị model dịch thiếu/sai — test bằng câu
đầy đủ để đánh giá chất lượng thật.

## Thêm/bớt ngôn ngữ sau này

Phải build lại image với `models=en,vi,...` rồi ship lại — không có cơ
chế tải thêm model lúc runtime trong setup này (đã bỏ volume model để
đơn giản, vì bake sẵn lúc build đã đủ nhanh và không cần internet trên
VPS lúc container khởi động).

Trước khi deploy thật, đo lại RAM bằng cách chạy container local, gọi
`/translate` qua **tất cả** các cặp ngôn ngữ theo cả 2 chiều (không chỉ
một vài cặp — model chỉ load lúc dùng lần đầu), rồi xem
`docker stats`. Cập nhật `TRANSLATE_MEM_LIMIT` trong `compose.prod.yml`
khớp với con số đo được, có dư khoảng 200-300MB margin.
