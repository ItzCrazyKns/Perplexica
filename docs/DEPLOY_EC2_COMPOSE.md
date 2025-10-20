## Triển khai Perplexica trên EC2 bằng Docker Compose (ổn định, tiết kiệm)

Tài liệu này hướng dẫn triển khai Perplexica trên 1 EC2 duy nhất với Docker Compose, tối ưu chi phí nhưng vẫn ổn định. Mặc định sử dụng `t3.small` (x86) để ổn định và tương thích cao.

---

## ⚠️ QUAN TRỌNG: Cấu hình LLM trong config.toml

**Perplexica KHÔNG THỂ chạy nếu thiếu config.toml hoặc không có API key LLM hợp lệ.**

### Tại sao cần config.toml?
- Perplexica cần **LLM (Large Language Model)** để xử lý tìm kiếm và tạo câu trả lời.
- File `config.toml` chứa API keys cho các provider LLM (OpenAI, Anthropic, Groq, Gemini, DeepSeek, v.v.).
- **Không có API key hợp lệ → ứng dụng không hoạt động.**

### Các bước chuẩn bị config.toml

1. **Copy từ sample**:
   ```bash
   cp sample.config.toml config.toml
   ```

2. **Chọn ít nhất 1 LLM provider và điền API key**:

   Ví dụ với **OpenAI**:
   ```toml
   [MODELS.OPENAI]
   API_KEY = "sk-proj-xxxxxxxxxxxxx"
   ```

   Hoặc **Groq** (miễn phí, nhanh):
   ```toml
   [MODELS.GROQ]
   API_KEY = "gsk_xxxxxxxxxxxxx"
   ```

   Hoặc **Anthropic Claude**:
   ```toml
   [MODELS.ANTHROPIC]
   API_KEY = "sk-ant-xxxxxxxxxxxxx"
   ```

   Hoặc **Custom OpenAI-compatible** (ví dụ: ZhipuAI):
   ```toml
   [MODELS.CUSTOM_OPENAI]
   API_KEY = "your-api-key"
   API_URL = "https://api.provider.com/v1"
   MODEL_NAME = "model-name"
   ```

3. **Cấu hình SearXNG endpoint** (đã tự động nếu dùng docker-compose):
   ```toml
   [API_ENDPOINTS]
   SEARXNG = "http://searxng:8080"
   ```

4. **Kiểm tra file trước khi deploy**:
   ```bash
   cat config.toml | grep API_KEY
   # Đảm bảo có ít nhất 1 dòng API_KEY không rỗng
   ```

### Lấy API key miễn phí/rẻ

- **Groq**: https://console.groq.com/ (miễn phí, nhanh, hỗ trợ Llama/Mixtral)
- **OpenAI**: https://platform.openai.com/api-keys (trả phí theo usage)
- **Anthropic**: https://console.anthropic.com/ (trả phí, Claude models)
- **Google Gemini**: https://aistudio.google.com/apikey (miễn phí tier)
- **DeepSeek**: https://platform.deepseek.com/ (rẻ, chất lượng cao)

**Khuyến nghị**: dùng **Groq** hoặc **Gemini** cho free tier, hoặc **DeepSeek** nếu muốn trả phí rẻ.

---

### 1) Khởi tạo EC2 và mạng

- Instance khuyến nghị:
  - `t3.small` (x86, 2 vCPU, 2GB RAM)
- Hệ điều hành: Ubuntu 22.04 LTS
- EBS: gp3 20–30GB (tăng sau khi cần)
- Security Group: mở TCP 22 (chỉ IP của bạn), 80, 443
- (Tuỳ chọn) Elastic IP để có IP cố định

### 2) Cài Docker/Compose và tối ưu log

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
newgrp docker

# Giới hạn log Docker để tiết kiệm disk
sudo mkdir -p /etc/docker
cat <<'JSON' | sudo tee /etc/docker/daemon.json
{
  "log-driver": "local",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
sudo systemctl restart docker
```

### 3) Bật swap 2GB (tránh OOM)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 4) Chuẩn bị thư mục ứng dụng và cấu hình

```bash
sudo mkdir -p /opt/Perplexica/data /opt/Perplexica/uploads
sudo chown -R $USER:$USER /opt/Perplexica
cd /opt/Perplexica
# Copy mã nguồn repo vào đây (git clone hoặc scp)
```

**⚠️ Bắt buộc**: Copy file `config.toml` đã cấu hình LLM API key vào `/opt/Perplexica/`:
```bash
# Từ máy local
scp -i ~/.ssh/your-key.pem ./config.toml ubuntu@<EC2-IP>:/opt/Perplexica/

# Hoặc tạo trực tiếp trên EC2
nano /opt/Perplexica/config.toml
# Paste nội dung từ sample.config.toml và điền API_KEY
```

Kiểm tra:
```bash
cat /opt/Perplexica/config.toml | grep API_KEY
# Phải có ít nhất 1 API_KEY không rỗng
```

### 5) Tối ưu Compose cho production (không build trên EC2)

Tạo `docker-compose.prod.yaml` sử dụng image có sẵn (pull), ẩn SearXNG khỏi internet, bind mount dữ liệu ra EBS:

```yaml
services:
  searxng:
    image: docker.io/searxng/searxng:latest
    volumes:
      - ./searxng:/etc/searxng:rw
    networks:
      - perplexica-network
    restart: unless-stopped

  app:
    image: itzcrazykns1337/perplexica:main
    environment:
      - SEARXNG_API_URL=http://searxng:8080
      - DATA_DIR=/home/perplexica
    ports:
      - 3000:3000
    networks:
      - perplexica-network
    volumes:
      - /opt/Perplexica/data:/home/perplexica/data
      - /opt/Perplexica/uploads:/home/perplexica/uploads
      - ./config.toml:/home/perplexica/config.toml
    restart: unless-stopped

networks:
  perplexica-network:
```

Lưu ý:
- Không mở port cho `searxng`; chỉ nội bộ qua network Compose.
- Nếu deploy trên x86 (t3.*) nhưng build/push từ Mac ARM: cần build image `linux/amd64` (xem mục 9 nếu phải tự build).

### 6) Khởi chạy ứng dụng

```bash
cd /opt/Perplexica
docker compose -f docker-compose.prod.yaml pull
docker compose -f docker-compose.prod.yaml up -d
docker compose -f docker-compose.prod.yaml ps
```

Kiểm tra nhanh:

```bash
curl -I http://127.0.0.1:3000
```

### 7) Nginx reverse proxy + HTTPS (Let’s Encrypt)

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx

sudo bash -lc 'cat >/etc/nginx/sites-available/perplexica <<EOF
server {
  listen 80;
  server_name app.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
EOF'

sudo ln -s /etc/nginx/sites-available/perplexica /etc/nginx/sites-enabled/perplexica || true
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d app.example.com --non-interactive --agree-tos -m you@example.com
```

Thay `app.example.com` bằng domain của bạn (DNS trỏ về IP EC2).

### 8) Tự khởi động cùng hệ thống (systemd)

```ini
# /etc/systemd/system/perplexica.service
[Unit]
Description=Perplexica Compose
After=docker.service
Requires=docker.service

[Service]
WorkingDirectory=/opt/Perplexica
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yaml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yaml down
Restart=always
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now perplexica
```

### 9) (Tuỳ chọn) Tự build multi-arch nếu image app không có ARM

`app.dockerfile` trong repo dùng base `node:24.5.0-slim` (multi-arch). Có thể build và push multi-arch:

```bash
# Thiết lập builder nếu chưa có
docker buildx create --name multi --use || docker buildx use multi

# Đăng nhập registry (Docker Hub/ECR)
# docker login

# Build và push cả amd64 và arm64
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f app.dockerfile \
  -t <your-registry>/<your-namespace>/perplexica:main \
  --push \
  .

# Cập nhật image trong docker-compose.prod.yaml sang image bạn vừa push
```

Nếu dùng ECR, thay thẻ image bằng `<account>.dkr.ecr.<region>.amazonaws.com/perplexica:main` và login ECR trước khi build/push.

### 10) Backup, cập nhật, bảo trì

- Dữ liệu quan trọng: `/opt/Perplexica/data`, `/opt/Perplexica/uploads`. Tạo backup định kỳ (tar/gzip) hoặc EBS snapshot.
- Cập nhật ứng dụng:

```bash
cd /opt/Perplexica
docker compose -f docker-compose.prod.yaml pull
docker compose -f docker-compose.prod.yaml up -d
```

- Theo dõi disk/log: `df -h`, `docker system df`, và đã bật log rotate Docker.

### 11) Gợi ý tiết kiệm không ảnh hưởng ổn định

- Tránh dùng ALB/NAT Gateway; chỉ EC2 + Nginx là đủ.
- Dùng Cloudflare (free) cho DNS/HTTPS proxy nếu phù hợp.

---

Checklist nhanh:
1) Dùng `t3.small` (x86)
2) Cài Docker/Compose + log rotate + swap 2GB
3) Tạo `/opt/Perplexica` và copy `config.toml`
4) Dùng `docker-compose.prod.yaml` (không build trên EC2)
5) Nginx + Certbot → HTTPS
6) systemd service để tự khởi động
7) Backup định kỳ, `pull` + `up -d` khi cập nhật


