## Triển khai Perplexica trên EC2 bằng CloudFormation (Infrastructure as Code)

Tài liệu này hướng dẫn triển khai Perplexica trên EC2 bằng CloudFormation template, tự động hóa toàn bộ hạ tầng chỉ với 1 lệnh.

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

**Lưu ý**: CloudFormation sẽ tạo file config.toml mặc định (rỗng), bạn **BẮT BUỘC** phải SSH vào và thay thế bằng config có API key hợp lệ sau khi stack tạo xong.

---

### Ưu điểm của CloudFormation
- **Infrastructure as Code**: toàn bộ hạ tầng trong 1 file YAML, dễ version control
- **Tự động hóa hoàn toàn**: 1 lệnh tạo EC2, Security Group, EIP, cài Docker, deploy app
- **Dễ xóa và tái tạo**: `delete-stack` xóa sạch mọi tài nguyên
- **Tái sử dụng**: deploy nhiều môi trường (dev/staging/prod) với cùng template

### Yêu cầu trước khi bắt đầu

1. **AWS CLI đã cài đặt và cấu hình**:
   ```bash
   aws configure
   ```

2. **Tạo EC2 Key Pair** (nếu chưa có):
   ```bash
   aws ec2 create-key-pair \
     --key-name perplexica-key \
     --query 'KeyMaterial' \
     --output text > ~/.ssh/perplexica-key.pem
   
   chmod 400 ~/.ssh/perplexica-key.pem
   ```

3. **Template CloudFormation** đã có tại `cloudformation-templates/perplexica-ec2-stack.yaml`

---

## Cách 1: Deploy qua AWS CLI (khuyến nghị)

### 1) Deploy stack cơ bản (không domain/HTTPS)

```bash
aws cloudformation create-stack \
  --stack-name perplexica-prod \
  --template-body file://cloudformation-templates/perplexica-ec2-stack.yaml \
  --parameters \
    ParameterKey=KeyName,ParameterValue=perplexica-key \
    ParameterKey=InstanceType,ParameterValue=t3.small \
    ParameterKey=VolumeSize,ParameterValue=30 \
    ParameterKey=SSHLocation,ParameterValue=0.0.0.0/0 \
    ParameterKey=AllocateElasticIP,ParameterValue=true \
  --region ap-southeast-1
```

**Giải thích tham số:**
- `KeyName`: tên key pair SSH (đã tạo ở trên)
- `InstanceType`: `t3.small` (2 vCPU/2GB) hoặc `t3.medium`
- `VolumeSize`: dung lượng EBS (GB), mặc định 30GB
- `SSHLocation`: CIDR cho phép SSH; nên thay bằng IP của bạn (ví dụ `1.2.3.4/32`)
- `AllocateElasticIP`: `true` để có IP cố định

### 2) Theo dõi tiến độ deploy

```bash
# Xem trạng thái stack
aws cloudformation describe-stacks \
  --stack-name perplexica-prod \
  --query 'Stacks[0].StackStatus' \
  --region ap-southeast-1

# Theo dõi sự kiện real-time
aws cloudformation wait stack-create-complete \
  --stack-name perplexica-prod \
  --region ap-southeast-1

echo "Stack created successfully!"
```

### 3) Lấy thông tin output

```bash
# Lấy Public IP
aws cloudformation describe-stacks \
  --stack-name perplexica-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`PublicIP`].OutputValue' \
  --output text \
  --region ap-southeast-1

# Lấy SSH command
aws cloudformation describe-stacks \
  --stack-name perplexica-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`SSHCommand`].OutputValue' \
  --output text \
  --region ap-southeast-1

# Xem tất cả outputs
aws cloudformation describe-stacks \
  --stack-name perplexica-prod \
  --query 'Stacks[0].Outputs' \
  --region ap-southeast-1
```

### 4) SSH vào instance và cấu hình LLM (BẮT BUỘC)

```bash
# Lấy IP
INSTANCE_IP=$(aws cloudformation describe-stacks \
  --stack-name perplexica-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`PublicIP`].OutputValue' \
  --output text \
  --region ap-southeast-1)

# ⚠️ BƯỚC BẮT BUỘC: Copy config.toml đã cấu hình LLM API key
scp -i ~/.ssh/perplexica-key.pem ./config.toml ubuntu@$INSTANCE_IP:/opt/Perplexica/

# Kiểm tra config.toml có API key
ssh -i ~/.ssh/perplexica-key.pem ubuntu@$INSTANCE_IP \
  "cat /opt/Perplexica/config.toml | grep API_KEY"

# Restart để load config mới
ssh -i ~/.ssh/perplexica-key.pem ubuntu@$INSTANCE_IP \
  "sudo systemctl restart perplexica"

# Kiểm tra logs để đảm bảo không có lỗi
ssh -i ~/.ssh/perplexica-key.pem ubuntu@$INSTANCE_IP \
  "docker compose -f /opt/Perplexica/docker-compose.prod.yaml logs app"
```

### 5) Truy cập ứng dụng

```bash
echo "Application URL: http://$INSTANCE_IP"
# Mở trình duyệt: http://<IP>
```

---

## Cách 2: Deploy với domain và HTTPS tự động

Nếu bạn có domain (ví dụ `app.example.com`), đảm bảo DNS đã trỏ về IP của EC2 trước khi deploy.

```bash
aws cloudformation create-stack \
  --stack-name perplexica-prod \
  --template-body file://cloudformation-templates/perplexica-ec2-stack.yaml \
  --parameters \
    ParameterKey=KeyName,ParameterValue=perplexica-key \
    ParameterKey=InstanceType,ParameterValue=t3.small \
    ParameterKey=VolumeSize,ParameterValue=30 \
    ParameterKey=SSHLocation,ParameterValue=0.0.0.0/0 \
    ParameterKey=AllocateElasticIP,ParameterValue=true \
    ParameterKey=DomainName,ParameterValue=app.example.com \
    ParameterKey=EmailAddress,ParameterValue=you@example.com \
  --region ap-southeast-1
```

**Lưu ý**: DNS phải trỏ về Elastic IP trước khi Certbot chạy. Nếu không, HTTPS sẽ thất bại; bạn có thể chạy lại Certbot sau:

```bash
ssh -i ~/.ssh/perplexica-key.pem ubuntu@$INSTANCE_IP
sudo certbot --nginx -d app.example.com --non-interactive --agree-tos -m you@example.com
```

---

## Cách 3: Deploy qua AWS Console (Web UI)

1. Đăng nhập AWS Console → **CloudFormation**
2. Chọn **Create stack** → **With new resources**
3. **Template source**: Upload template file `perplexica-ec2-stack.yaml`
4. **Stack name**: `perplexica-prod`
5. **Parameters**:
   - KeyName: `perplexica-key`
   - InstanceType: `t3.small`
   - VolumeSize: `30`
   - SSHLocation: `0.0.0.0/0` (hoặc IP của bạn)
   - AllocateElasticIP: `true`
   - DomainName: (để trống nếu không dùng)
   - EmailAddress: (để trống nếu không dùng)
6. **Next** → **Next** → **Create stack**
7. Đợi status thành `CREATE_COMPLETE` (khoảng 3-5 phút)
8. Tab **Outputs**: lấy `PublicIP` và `SSHCommand`

---

## Quản lý Stack

### Xem thông tin stack

```bash
# Xem tất cả stacks
aws cloudformation list-stacks --region ap-southeast-1

# Xem chi tiết 1 stack
aws cloudformation describe-stacks --stack-name perplexica-prod --region ap-southeast-1

# Xem resources được tạo
aws cloudformation describe-stack-resources --stack-name perplexica-prod --region ap-southeast-1
```

### Cập nhật stack (thay đổi parameters/template)

```bash
# Ví dụ: tăng dung lượng EBS lên 50GB
aws cloudformation update-stack \
  --stack-name perplexica-prod \
  --template-body file://cloudformation-templates/perplexica-ec2-stack.yaml \
  --parameters \
    ParameterKey=KeyName,UsePreviousValue=true \
    ParameterKey=InstanceType,UsePreviousValue=true \
    ParameterKey=VolumeSize,ParameterValue=50 \
    ParameterKey=SSHLocation,UsePreviousValue=true \
    ParameterKey=AllocateElasticIP,UsePreviousValue=true \
  --region ap-southeast-1

# Đợi update hoàn tất
aws cloudformation wait stack-update-complete \
  --stack-name perplexica-prod \
  --region ap-southeast-1
```

### Xóa stack (xóa toàn bộ tài nguyên)

**Cẩn thận**: lệnh này xóa EC2, EBS, Security Group, EIP → **mất dữ liệu**.

```bash
aws cloudformation delete-stack \
  --stack-name perplexica-prod \
  --region ap-southeast-1

# Đợi xóa hoàn tất
aws cloudformation wait stack-delete-complete \
  --stack-name perplexica-prod \
  --region ap-southeast-1

echo "Stack deleted"
```

---

## Backup và phục hồi

### Backup dữ liệu trước khi xóa

```bash
INSTANCE_IP=$(aws cloudformation describe-stacks \
  --stack-name perplexica-prod \
  --query 'Stacks[0].Outputs[?OutputKey==`PublicIP`].OutputValue' \
  --output text \
  --region ap-southeast-1)

# Backup qua rsync
rsync -avz -e "ssh -i ~/.ssh/perplexica-key.pem" \
  ubuntu@$INSTANCE_IP:/opt/Perplexica/data/ \
  ./backup-perplexica-data/

rsync -avz -e "ssh -i ~/.ssh/perplexica-key.pem" \
  ubuntu@$INSTANCE_IP:/opt/Perplexica/uploads/ \
  ./backup-perplexica-uploads/
```

### Snapshot EBS

```bash
# Lấy Volume ID
VOLUME_ID=$(aws cloudformation describe-stack-resources \
  --stack-name perplexica-prod \
  --query 'StackResources[?ResourceType==`AWS::EC2::Instance`].PhysicalResourceId' \
  --output text \
  --region ap-southeast-1 | xargs -I {} \
  aws ec2 describe-instances --instance-ids {} \
  --query 'Reservations[0].Instances[0].BlockDeviceMappings[0].Ebs.VolumeId' \
  --output text --region ap-southeast-1)

# Tạo snapshot
aws ec2 create-snapshot \
  --volume-id $VOLUME_ID \
  --description "Perplexica backup $(date +%Y-%m-%d)" \
  --tag-specifications "ResourceType=snapshot,Tags=[{Key=Name,Value=perplexica-backup}]" \
  --region ap-southeast-1
```

---

## Troubleshooting

### Stack bị lỗi khi tạo (ROLLBACK_COMPLETE)

```bash
# Xem sự kiện lỗi
aws cloudformation describe-stack-events \
  --stack-name perplexica-prod \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]' \
  --region ap-southeast-1

# Xóa stack lỗi và thử lại
aws cloudformation delete-stack --stack-name perplexica-prod --region ap-southeast-1
```

### Kiểm tra User Data logs trên EC2

```bash
ssh -i ~/.ssh/perplexica-key.pem ubuntu@$INSTANCE_IP

# Xem log User Data
sudo tail -f /var/log/user-data.log

# Kiểm tra Docker
docker ps

# Kiểm tra systemd
sudo systemctl status perplexica
```

### HTTPS/Certbot thất bại

```bash
ssh -i ~/.ssh/perplexica-key.pem ubuntu@$INSTANCE_IP

# Chạy lại Certbot thủ công
sudo certbot --nginx -d app.example.com --non-interactive --agree-tos -m you@example.com

# Nếu vẫn lỗi, kiểm tra DNS
dig app.example.com
```

---

## Deploy nhiều môi trường (dev/staging/prod)

```bash
# Dev
aws cloudformation create-stack \
  --stack-name perplexica-dev \
  --template-body file://cloudformation-templates/perplexica-ec2-stack.yaml \
  --parameters ParameterKey=KeyName,ParameterValue=perplexica-key \
               ParameterKey=InstanceType,ParameterValue=t3.small \
  --region ap-southeast-1

# Staging
aws cloudformation create-stack \
  --stack-name perplexica-staging \
  --template-body file://cloudformation-templates/perplexica-ec2-stack.yaml \
  --parameters ParameterKey=KeyName,ParameterValue=perplexica-key \
               ParameterKey=InstanceType,ParameterValue=t3.small \
  --region ap-southeast-1

# Production
aws cloudformation create-stack \
  --stack-name perplexica-prod \
  --template-body file://cloudformation-templates/perplexica-ec2-stack.yaml \
  --parameters ParameterKey=KeyName,ParameterValue=perplexica-key \
               ParameterKey=InstanceType,ParameterValue=t3.small \
               ParameterKey=DomainName,ParameterValue=app.example.com \
               ParameterKey=EmailAddress,ParameterValue=you@example.com \
  --region ap-southeast-1
```

---

## So sánh: CloudFormation vs AWS CLI

| Tiêu chí | CloudFormation | AWS CLI script |
|----------|----------------|----------------|
| **Tự động hóa** | Cao nhất (1 lệnh) | Cần nhiều lệnh tuần tự |
| **Tái tạo** | Dễ (delete + create) | Phải chạy lại script |
| **Version control** | Dễ (YAML file) | Khó (script phức tạp) |
| **Rollback** | Tự động khi lỗi | Thủ công |
| **Chi phí** | Miễn phí (chỉ tính tài nguyên) | Miễn phí |
| **Dễ debug** | Xem events trên console | Phải đọc log terminal |

**Khuyến nghị**: Dùng CloudFormation cho production và môi trường dài hạn; dùng AWS CLI script cho thử nghiệm nhanh.

---

## Checklist triển khai

- [ ] Tạo EC2 Key Pair
- [ ] **⚠️ Chuẩn bị config.toml với LLM API key hợp lệ**
- [ ] (Nếu dùng domain) Cấu hình DNS trỏ về IP tương lai
- [ ] Chạy `create-stack` với parameters phù hợp
- [ ] Đợi stack `CREATE_COMPLETE`
- [ ] **⚠️ Copy config.toml lên EC2 (BƯỚC BẮT BUỘC)**
- [ ] SSH vào instance và kiểm tra `cat /opt/Perplexica/config.toml | grep API_KEY`
- [ ] Restart: `sudo systemctl restart perplexica`
- [ ] Truy cập URL và test (đảm bảo có thể tìm kiếm và nhận được câu trả lời)
- [ ] (Nếu dùng domain) Xác nhận HTTPS hoạt động
- [ ] Thiết lập backup định kỳ (snapshot hoặc rsync)

