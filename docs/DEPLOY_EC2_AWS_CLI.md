## Triển khai Perplexica trên EC2 bằng AWS CLI (tự động hóa)

Tài liệu này hướng dẫn triển khai Perplexica trên EC2 `t3.small` hoàn toàn bằng AWS CLI, tự động hóa tạo instance, security group, và cài đặt Docker Compose.

---

## ⚠️ QUAN TRỌNG: Cấu hình LLM trong config.toml

**Perplexica KHÔNG THỂ chạy nếu thiếu config.toml hoặc không có API key LLM hợp lệ.**

### Tại sao cần config.toml?
- Perplexica cần **LLM (Large Language Model)** để xử lý tìm kiếm và tạo câu trả lời.
- File `config.toml` chứa API keys cho các provider LLM (OpenAI, Anthropic, Groq, Gemini, DeepSeek, v.v.).
- **Không có API key hợp lệ → ứng dụng không hoạt động.**

### Chuẩn bị config.toml TRƯỚC KHI deploy

1. **Copy từ sample và điền API key**:
   ```bash
   cp sample.config.toml config.toml
   nano config.toml
   ```

2. **Chọn ít nhất 1 LLM provider**:
   - **Groq** (miễn phí, nhanh): https://console.groq.com/
   - **Google Gemini** (miễn phí tier): https://aistudio.google.com/apikey
   - **OpenAI** (trả phí): https://platform.openai.com/api-keys
   - **DeepSeek** (rẻ): https://platform.deepseek.com/

3. **Ví dụ config.toml tối thiểu**:
   ```toml
   [GENERAL]
   SIMILARITY_MEASURE = "cosine"

   [MODELS.GROQ]
   API_KEY = "gsk_xxxxxxxxxxxxx"

   [API_ENDPOINTS]
   SEARXNG = "http://searxng:8080"
   ```

**Bạn SẼ copy file này lên EC2 ở bước 8 sau khi instance đã chạy.**

---

### Yêu cầu trước khi bắt đầu

1. **Cài đặt AWS CLI v2**:
   ```bash
   # macOS
   brew install awscli
   
   # Linux
   curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
   unzip awscliv2.zip
   sudo ./aws/install
   ```

2. **Cấu hình AWS credentials**:
   ```bash
   aws configure
   # Nhập AWS Access Key ID
   # Nhập AWS Secret Access Key
   # Chọn region (ví dụ: us-east-1)
   # Chọn output format: json
   ```

3. **Tạo hoặc có sẵn SSH key pair**:
   ```bash
   # Tạo key pair mới
   aws ec2 create-key-pair \
     --key-name perplexica-key \
     --query 'KeyMaterial' \
     --output text > ~/.ssh/perplexica-key.pem
   
   chmod 400 ~/.ssh/perplexica-key.pem
   ```

### 1) Thiết lập biến môi trường

```bash
# Region và tên key
export AWS_REGION="us-east-1"
export KEY_NAME="perplexica-key"
export INSTANCE_NAME="perplexica-prod"

# Lấy VPC mặc định
export VPC_ID=$(aws ec2 describe-vpcs \
  --region $AWS_REGION \
  --filters "Name=isDefault,Values=true" \
  --query 'Vpcs[0].VpcId' \
  --output text)

echo "VPC ID: $VPC_ID"
```

### 2) Tạo Security Group

```bash
# Tạo security group
export SG_ID=$(aws ec2 create-security-group \
  --region $AWS_REGION \
  --group-name perplexica-sg \
  --description "Security group for Perplexica app" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

echo "Security Group ID: $SG_ID"

# Lấy IP công khai của bạn
export MY_IP=$(curl -s https://checkip.amazonaws.com)

# Mở port SSH (chỉ từ IP của bạn)
aws ec2 authorize-security-group-ingress \
  --region $AWS_REGION \
  --group-id $SG_ID \
  --protocol tcp \
  --port 22 \
  --cidr ${MY_IP}/32

# Mở port HTTP
aws ec2 authorize-security-group-ingress \
  --region $AWS_REGION \
  --group-id $SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0

# Mở port HTTPS
aws ec2 authorize-security-group-ingress \
  --region $AWS_REGION \
  --group-id $SG_ID \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0

echo "Security group configured"
```

### 3) Tìm AMI Ubuntu 22.04 mới nhất

```bash
export AMI_ID=$(aws ec2 describe-images \
  --region $AWS_REGION \
  --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
            "Name=state,Values=available" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --output text)

echo "Ubuntu 22.04 AMI: $AMI_ID"
```

### 4) Tạo User Data script (cài Docker tự động)

```bash
cat > /tmp/user-data.sh <<'EOF'
#!/bin/bash
set -e

# Cập nhật hệ thống
apt-get update
apt-get upgrade -y

# Cài Docker
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Thêm ubuntu user vào docker group
usermod -aG docker ubuntu

# Cấu hình log rotation
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'DOCKERJSON'
{
  "log-driver": "local",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
DOCKERJSON
systemctl restart docker

# Tạo swap 2GB
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Tạo thư mục ứng dụng
mkdir -p /opt/Perplexica/data /opt/Perplexica/uploads
chown -R ubuntu:ubuntu /opt/Perplexica

# Cài Nginx và Certbot
apt-get install -y nginx certbot python3-certbot-nginx

# Hoàn tất
echo "EC2 setup completed" > /var/log/user-data-complete.log
EOF
```

### 5) Khởi chạy EC2 instance

```bash
export INSTANCE_ID=$(aws ec2 run-instances \
  --region $AWS_REGION \
  --image-id $AMI_ID \
  --instance-type t3.small \
  --key-name $KEY_NAME \
  --security-group-ids $SG_ID \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3","DeleteOnTermination":true}}]' \
  --user-data file:///tmp/user-data.sh \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]" \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "Instance ID: $INSTANCE_ID"
echo "Đợi instance khởi động..."

# Chờ instance chạy
aws ec2 wait instance-running --region $AWS_REGION --instance-ids $INSTANCE_ID
echo "Instance đang chạy"

# Lấy public IP
export INSTANCE_IP=$(aws ec2 describe-instances \
  --region $AWS_REGION \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo "Public IP: $INSTANCE_IP"
```

### 6) (Tuỳ chọn) Gắn Elastic IP

```bash
# Tạo Elastic IP
export EIP_ALLOC=$(aws ec2 allocate-address \
  --region $AWS_REGION \
  --domain vpc \
  --query 'AllocationId' \
  --output text)

# Gắn vào instance
aws ec2 associate-address \
  --region $AWS_REGION \
  --instance-id $INSTANCE_ID \
  --allocation-id $EIP_ALLOC

# Lấy IP mới
export INSTANCE_IP=$(aws ec2 describe-addresses \
  --region $AWS_REGION \
  --allocation-ids $EIP_ALLOC \
  --query 'Addresses[0].PublicIp' \
  --output text)

echo "Elastic IP: $INSTANCE_IP"
```

### 7) Đợi User Data hoàn tất

```bash
echo "Đợi User Data script cài Docker (khoảng 2-3 phút)..."
sleep 180

# SSH vào kiểm tra
ssh -i ~/.ssh/${KEY_NAME}.pem ubuntu@$INSTANCE_IP "tail /var/log/user-data-complete.log"
```

### 8) Deploy ứng dụng qua SSH

```bash
# Tạo docker-compose.prod.yaml trên local
cat > /tmp/docker-compose.prod.yaml <<'EOF'
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
EOF

# Copy compose file lên EC2
scp -i ~/.ssh/${KEY_NAME}.pem /tmp/docker-compose.prod.yaml ubuntu@$INSTANCE_IP:/opt/Perplexica/

# ⚠️ BƯỚC QUAN TRỌNG: Copy config.toml (đã cấu hình LLM API key)
scp -i ~/.ssh/${KEY_NAME}.pem ./config.toml ubuntu@$INSTANCE_IP:/opt/Perplexica/

# Kiểm tra config.toml đã có API key
ssh -i ~/.ssh/${KEY_NAME}.pem ubuntu@$INSTANCE_IP "cat /opt/Perplexica/config.toml | grep API_KEY"

# Copy thư mục searxng config (nếu có)
scp -i ~/.ssh/${KEY_NAME}.pem -r ./searxng ubuntu@$INSTANCE_IP:/opt/Perplexica/

# SSH và khởi chạy ứng dụng
ssh -i ~/.ssh/${KEY_NAME}.pem ubuntu@$INSTANCE_IP <<'REMOTE'
cd /opt/Perplexica
docker compose -f docker-compose.prod.yaml pull
docker compose -f docker-compose.prod.yaml up -d
docker compose -f docker-compose.prod.yaml ps
REMOTE

echo "Ứng dụng đã chạy tại http://$INSTANCE_IP:3000"
```

### 9) Cấu hình Nginx reverse proxy + HTTPS

Thay `app.example.com` bằng domain của bạn (và đảm bảo DNS đã trỏ về `$INSTANCE_IP`).

```bash
export DOMAIN="app.example.com"
export EMAIL="you@example.com"

ssh -i ~/.ssh/${KEY_NAME}.pem ubuntu@$INSTANCE_IP <<REMOTE
sudo bash -lc 'cat >/etc/nginx/sites-available/perplexica <<EOF
server {
  listen 80;
  server_name ${DOMAIN};

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host \\\$host;
    proxy_set_header X-Real-IP \\\$remote_addr;
    proxy_set_header X-Forwarded-For \\\$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \\\$scheme;
  }
}
EOF'

sudo ln -sf /etc/nginx/sites-available/perplexica /etc/nginx/sites-enabled/perplexica
sudo nginx -t && sudo systemctl reload nginx

# Cài chứng chỉ SSL
sudo certbot --nginx -d ${DOMAIN} --non-interactive --agree-tos -m ${EMAIL}
REMOTE

echo "HTTPS đã cấu hình xong tại https://$DOMAIN"
```

### 10) Thiết lập systemd tự khởi động

```bash
ssh -i ~/.ssh/${KEY_NAME}.pem ubuntu@$INSTANCE_IP <<'REMOTE'
sudo bash -lc 'cat >/etc/systemd/system/perplexica.service <<EOF
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
EOF'

sudo systemctl daemon-reload
sudo systemctl enable perplexica
sudo systemctl start perplexica
REMOTE

echo "Systemd service đã kích hoạt"
```

### 11) Quản lý instance

**Dừng instance** (không tính phí compute, vẫn tính phí EBS):
```bash
aws ec2 stop-instances --region $AWS_REGION --instance-ids $INSTANCE_ID
```

**Khởi động lại**:
```bash
aws ec2 start-instances --region $AWS_REGION --instance-ids $INSTANCE_ID
```

**Xóa hoàn toàn** (cẩn thận, mất dữ liệu):
```bash
# Xóa instance
aws ec2 terminate-instances --region $AWS_REGION --instance-ids $INSTANCE_ID

# Xóa EIP (nếu có)
aws ec2 release-address --region $AWS_REGION --allocation-id $EIP_ALLOC

# Xóa security group (sau khi instance terminated)
aws ec2 wait instance-terminated --region $AWS_REGION --instance-ids $INSTANCE_ID
aws ec2 delete-security-group --region $AWS_REGION --group-id $SG_ID
```

**Xem log**:
```bash
ssh -i ~/.ssh/${KEY_NAME}.pem ubuntu@$INSTANCE_IP "docker compose -f /opt/Perplexica/docker-compose.prod.yaml logs -f"
```

**Cập nhật ứng dụng**:
```bash
ssh -i ~/.ssh/${KEY_NAME}.pem ubuntu@$INSTANCE_IP <<'REMOTE'
cd /opt/Perplexica
docker compose -f docker-compose.prod.yaml pull
docker compose -f docker-compose.prod.yaml up -d
REMOTE
```

### 12) Backup dữ liệu

**Tạo EBS snapshot**:
```bash
# Lấy volume ID
export VOLUME_ID=$(aws ec2 describe-instances \
  --region $AWS_REGION \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].BlockDeviceMappings[0].Ebs.VolumeId' \
  --output text)

# Tạo snapshot
aws ec2 create-snapshot \
  --region $AWS_REGION \
  --volume-id $VOLUME_ID \
  --description "Perplexica backup $(date +%Y-%m-%d)" \
  --tag-specifications "ResourceType=snapshot,Tags=[{Key=Name,Value=perplexica-backup}]"
```

**Backup qua rsync** (thay thế):
```bash
rsync -avz -e "ssh -i ~/.ssh/${KEY_NAME}.pem" \
  ubuntu@$INSTANCE_IP:/opt/Perplexica/data/ \
  ./backup-perplexica-data/
```

---

## Tóm tắt script đầy đủ (chạy 1 lần)

Lưu vào `deploy.sh` và chạy:

```bash
#!/bin/bash
set -e

export AWS_REGION="us-east-1"
export KEY_NAME="perplexica-key"
export INSTANCE_NAME="perplexica-prod"
export DOMAIN="app.example.com"
export EMAIL="you@example.com"

# 1. Tạo key pair nếu chưa có
if [ ! -f ~/.ssh/${KEY_NAME}.pem ]; then
  aws ec2 create-key-pair \
    --key-name $KEY_NAME \
    --query 'KeyMaterial' \
    --output text > ~/.ssh/${KEY_NAME}.pem
  chmod 400 ~/.ssh/${KEY_NAME}.pem
fi

# 2. Lấy VPC
export VPC_ID=$(aws ec2 describe-vpcs \
  --region $AWS_REGION \
  --filters "Name=isDefault,Values=true" \
  --query 'Vpcs[0].VpcId' \
  --output text)

# 3. Tạo Security Group
export SG_ID=$(aws ec2 create-security-group \
  --region $AWS_REGION \
  --group-name perplexica-sg \
  --description "Security group for Perplexica" \
  --vpc-id $VPC_ID \
  --query 'GroupId' \
  --output text)

export MY_IP=$(curl -s https://checkip.amazonaws.com)
aws ec2 authorize-security-group-ingress --region $AWS_REGION --group-id $SG_ID --protocol tcp --port 22 --cidr ${MY_IP}/32
aws ec2 authorize-security-group-ingress --region $AWS_REGION --group-id $SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --region $AWS_REGION --group-id $SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0

# 4. Tìm AMI Ubuntu 22.04
export AMI_ID=$(aws ec2 describe-images \
  --region $AWS_REGION \
  --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" "Name=state,Values=available" \
  --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
  --output text)

# 5. Tạo User Data
cat > /tmp/user-data.sh <<'EOF'
#!/bin/bash
set -e
apt-get update && apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker ubuntu
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'DOCKERJSON'
{"log-driver":"local","log-opts":{"max-size":"10m","max-file":"3"}}
DOCKERJSON
systemctl restart docker
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
mkdir -p /opt/Perplexica/data /opt/Perplexica/uploads
chown -R ubuntu:ubuntu /opt/Perplexica
apt-get install -y nginx certbot python3-certbot-nginx
echo "Setup complete" > /var/log/user-data-complete.log
EOF

# 6. Khởi chạy instance
export INSTANCE_ID=$(aws ec2 run-instances \
  --region $AWS_REGION \
  --image-id $AMI_ID \
  --instance-type t3.small \
  --key-name $KEY_NAME \
  --security-group-ids $SG_ID \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
  --user-data file:///tmp/user-data.sh \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]" \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "Instance ID: $INSTANCE_ID"
aws ec2 wait instance-running --region $AWS_REGION --instance-ids $INSTANCE_ID

export INSTANCE_IP=$(aws ec2 describe-instances \
  --region $AWS_REGION \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo "Instance IP: $INSTANCE_IP"
echo "Đợi User Data hoàn tất (3 phút)..."
sleep 180

echo "Triển khai hoàn tất! SSH: ssh -i ~/.ssh/${KEY_NAME}.pem ubuntu@$INSTANCE_IP"
```

Sau đó SSH vào và deploy ứng dụng theo mục 8–10.

