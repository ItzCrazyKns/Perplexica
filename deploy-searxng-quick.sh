#!/bin/bash

# Quick SearXNG EC2 Deployment Script
# Simplified deployment for SearXNG on t3.small

set -euo pipefail

# Configuration
REGION="ap-southeast-1"
INSTANCE_TYPE="t3.small"
KEY_NAME="searxng-key"  # You need to create this key pair first
SECURITY_GROUP_NAME="searxng-sg"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() { echo -e "${GREEN}[INFO]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials are not configured. Please run 'aws configure' first."
    exit 1
fi

print_status "Starting quick SearXNG deployment..."

# Check if key pair exists
if ! aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$REGION" &>/dev/null; then
    print_error "Key pair '$KEY_NAME' does not exist. Please create it first:"
    print_error "aws ec2 create-key-pair --key-name $KEY_NAME --query 'KeyMaterial' --output text --region $REGION > ${KEY_NAME}.pem"
    print_error "chmod 400 ${KEY_NAME}.pem"
    exit 1
fi

# Get or create security group
SG_ID=$(aws ec2 describe-security-groups --group-names "$SECURITY_GROUP_NAME" --query "SecurityGroups[0].GroupId" --output text --region "$REGION" 2>/dev/null || echo "")

if [ -z "$SG_ID" ]; then
    print_status "Creating security group..."
    SG_ID=$(aws ec2 create-security-group \
        --group-name "$SECURITY_GROUP_NAME" \
        --description "Security group for SearXNG" \
        --query "GroupId" \
        --output text \
        --region "$REGION")

    # Add rules
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 22 --cidr 0.0.0.0/0 --region "$REGION"
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0 --region "$REGION"
    aws ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 443 --cidr 0.0.0.0/0 --region "$REGION"
fi

print_status "Using Security Group: $SG_ID"

# Get latest Amazon Linux 2 AMI
AMI_ID=$(aws ec2 describe-images \
    --owners amazon \
    --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" "Name=virtualization-type,Values=hvm" \
    --query "sort_by(Images, &CreationDate)[-1].ImageId" \
    --output text \
    --region "$REGION")

# Launch instance
print_status "Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$SG_ID" \
    --associate-public-ip-address \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=SearXNG-Server}]" \
    --user-data "#!/bin/bash
yum update -y
yum install -y docker git
systemctl start docker
systemctl enable docker
curl -L 'https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)' -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
mkdir -p /opt/searxng
" \
    --query "Instances[0].InstanceId" \
    --output text \
    --region "$REGION")

print_status "Instance ID: $INSTANCE_ID"

# Wait for instance
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --query "Reservations[0].Instances[0].PublicIpAddress" \
    --output text \
    --region "$REGION")

print_status "Instance running at: $PUBLIC_IP"

# Wait for SSH to be available
print_status "Waiting for SSH to be available..."
sleep 30

# Generate deployment script content
SEARXNG_SECRET=$(openssl rand -hex 32)

# Create remote deployment script
DEPLOY_SCRIPT="#!/bin/bash
set -euo pipefail

# Install dependencies
yum install -y openssl

# Create directories
mkdir -p /opt/searxng/ssl

# Generate SSL certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\
    -keyout /opt/searxng/ssl/key.pem \\
    -out /opt/searxng/ssl/cert.pem \\
    -subj \"/C=US/ST=State/L=City/O=Organization/CN=$PUBLIC_IP\"

# Create docker-compose.yml
cat > /opt/searxng/docker-compose.yml << 'EOF'
version: '3.8'

services:
  searxng:
    image: searxng/searxng:latest
    container_name: searxng
    restart: unless-stopped
    ports:
      - \"8080:8080\"
    volumes:
      - ./settings.yml:/etc/searxng/settings.yml:ro
    environment:
      - SEARXNG_SECRET=$SEARXNG_SECRET
    networks:
      - searxng-network

  nginx:
    image: nginx:alpine
    container_name: searxng-nginx
    restart: unless-stopped
    ports:
      - \"80:80\"
      - \"443:443\"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - searxng
    networks:
      - searxng-network

networks:
  searxng-network:
    driver: bridge
EOF

# Create nginx.conf
cat > /opt/searxng/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    server {
        listen 80;
        server_name _;
        location / {
            proxy_pass http://searxng:8080;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }

    upstream searxng {
        server searxng:8080;
    }

    server {
        listen 443 ssl http2;
        server_name _;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        location / {
            proxy_pass http://searxng;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
EOF

# Create settings.yml
cat > /opt/searxng/settings.yml << 'EOF'
use_default_settings: true

general:
  instance_name: 'SearXNG'

search:
  autocomplete: 'google'
  formats:
    - html
    - json

server:
  secret_key: '$SEARXNG_SECRET'
  bind_address: \"0.0.0.0\"
  port: 8080
  base_url: \"http://$PUBLIC_IP:8080/\"
  limiter: true
  image_proxy: true

engines:
  - name: wolframalpha
    disabled: false
EOF

# Start services
cd /opt/searxng
docker-compose down 2>/dev/null || true
docker-compose up -d

sleep 30

echo \"Deployment completed!\"
echo \"SearXNG is available at: http://$PUBLIC_IP\"
"

# Execute deployment on remote instance
print_status "Deploying SearXNG to remote instance..."
echo "$DEPLOY_SCRIPT" | ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@"$PUBLIC_IP" "sudo bash"

print_status "==================================="
print_status "✅ Deployment completed!"
print_status "Public IP: $PUBLIC_IP"
print_status "HTTP URL: http://$PUBLIC_IP"
print_status "SSH: ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP"
print_status "==================================="

# Test deployment
sleep 10
if curl -s -f "http://$PUBLIC_IP" > /dev/null; then
    print_status "✅ SearXNG is accessible!"
else
    print_warning "⚠️  Service might still be starting. Please wait a moment and try accessing http://$PUBLIC_IP"
fi