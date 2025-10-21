# Quick Start: Deploy Perplexica to EC2 Singapore

Cách nhanh nhất để deploy Perplexica lên EC2 t3.small ở Singapore region.

## 🚀 One-Command Deployment

### 1. Chuẩn bị

```bash
# Clone repo
git clone https://github.com/ItzCrazyKns/Perplexica.git
cd Perplexica

# Tạo EC2 Key Pair ở Singapore region
aws ec2 create-key-pair \
  --key-name perplexica-sg-key \
  --region ap-southeast-1 \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/perplexica-sg-key.pem

chmod 400 ~/.ssh/perplexica-sg-key.pem
```

### 2. Cấu hình LLM API Keys

```bash
# Copy sample config và điền API key
cp sample.config.toml config.toml
nano config.toml
```

**Quan trọng: Phải có ít nhất 1 LLM provider**

```toml
[GENERAL]
SIMILARITY_MEASURE = "cosine"

[MODELS.GROQ]
API_KEY = "gsk_xxxxxxxxxxxxx"  # Lấy từ https://console.groq.com/

[API_ENDPOINTS]
SEARXNG = "http://searxng:8080"
```

### 3. Deploy

```bash
# Chạy script deployment
./deploy-ec2-quick.sh -k perplexica-sg-key
```

Script sẽ:
- Tạo EC2 t3.small ở Singapore
- Cài Docker, Nginx, SSL
- Deploy Perplexica
- Trả lại thông tin access

### 4. Hoàn thiện

```bash
# Lấy thông tin từ output của script
# Ví dụ: Public IP: 3.1.2.3.4

# Copy config file có API key lên server
scp -i ~/.ssh/perplexica-sg-key.pem \
  ./config.toml ubuntu@3.1.2.3.4:/opt/Perplexica/

# SSH và restart service
ssh -i ~/.ssh/perplexica-sg-key.pem ubuntu@3.1.2.3.4
sudo systemctl restart perplexica

# Kiểm tra status
sudo systemctl status perplexica
```

### 5. Truy cập

Mở trình duyệt: `http://<PUBLIC_IP>`

## 📋 Chi phí

- **EC2 t3.small**: ~$0.0104/giờ (~$7.50/tháng)
- **EBS 30GB**: ~$2.50/tháng
- **Data transfer**: Theo usage
- **Tổng**: ~$10-15/tháng cho usage vừa phải

## 🔧 Các tùy chọn khác

### Instance lớn hơn

```bash
./deploy-ec2-quick.sh -k perplexica-sg-key -t t3.medium -s 50
```

### Với custom domain

```bash
./deploy-ec2-quick.sh \
  -k perplexica-sg-key \
  -d perplexica.example.com \
  -e admin@example.com
```

### Restrict SSH access

```bash
./deploy-ec2-quick.sh \
  -k perplexica-sg-key \
  -i 1.2.3.4/32  # Thay bằng IP của bạn
```

## 🛠️ Troubleshooting

### Stack bị lỗi

```bash
# Xem lỗi
aws cloudformation describe-stack-events \
  --stack-name perplexica-ec2 \
  --region ap-southeast-1

# Xóa và thử lại
aws cloudformation delete-stack \
  --stack-name perplexica-ec2 \
  --region ap-southeast-1
```

### Kiểm tra service

```bash
ssh -i ~/.ssh/perplexica-sg-key.pem ubuntu@<IP>
sudo systemctl status perplexica
docker compose -f /opt/Perplexica/docker-compose.prod.yaml logs -f
```

### Xóa hoàn toàn

```bash
aws cloudformation delete-stack \
  --stack-name perplexica-ec2 \
  --region ap-southeast-1
```

## 📚 Tài liệu đầy đủ

Xem [DEPLOY_EC2_CLOUDFORMATION.md](DEPLOY_EC2_CLOUDFORMATION.md) để biết thêm chi tiết.