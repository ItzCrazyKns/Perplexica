#!/bin/bash

# SearXNG EC2 Deployment Script
# This script deploys SearXNG on a t3.small EC2 instance

set -euo pipefail

# Configuration
REGION="ap-southeast-1"
INSTANCE_TYPE="t3.small"
AMI_ID="ami-0c02b9f617c81b357"  # Amazon Linux 2 in ap-southeast-1
KEY_NAME="searxng-key"  # You'll need to create this key pair
SECURITY_GROUP_NAME="searxng-sg"
INSTANCE_NAME="searxng-server"
TAG_NAME="SearXNG-Server"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if AWS credentials are configured
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials are not configured. Please run 'aws configure' first."
    exit 1
fi

print_status "Starting SearXNG deployment on EC2 t3.small..."

# Create security group
print_status "Creating security group..."
SG_ID=$(aws ec2 create-security-group \
    --group-name "$SECURITY_GROUP_NAME" \
    --description "Security group for SearXNG server" \
    --vpc-id $(aws ec2 describe-vpcs --query "Vpcs[?IsDefault].VpcId" --output text) \
    --query "GroupId" \
    --output text \
    --region "$REGION" 2>/dev/null || echo "")

if [ -z "$SG_ID" ]; then
    print_warning "Security group might already exist. Getting existing one..."
    SG_ID=$(aws ec2 describe-security-groups \
        --group-names "$SECURITY_GROUP_NAME" \
        --query "SecurityGroups[0].GroupId" \
        --output text \
        --region "$REGION")
fi

print_status "Security Group ID: $SG_ID"

# Add security group rules
print_status "Configuring security group rules..."
aws ec2 authorize-security-group-ingress \
    --group-id "$SG_ID" \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0 \
    --region "$REGION" 2>/dev/null || print_warning "SSH rule might already exist"

aws ec2 authorize-security-group-ingress \
    --group-id "$SG_ID" \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 \
    --region "$REGION" 2>/dev/null || print_warning "HTTP rule might already exist"

aws ec2 authorize-security-group-ingress \
    --group-id "$SG_ID" \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    --region "$REGION" 2>/dev/null || print_warning "HTTPS rule might already exist"

# Check if key pair exists, if not create one
if ! aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$REGION" &>/dev/null; then
    print_status "Creating key pair: $KEY_NAME"
    aws ec2 create-key-pair \
        --key-name "$KEY_NAME" \
        --query "KeyMaterial" \
        --output text \
        --region "$REGION" > "${KEY_NAME}.pem"
    chmod 400 "${KEY_NAME}.pem"
    print_status "Key pair saved to ${KEY_NAME}.pem"
    print_warning "Please save this key file securely. You'll need it to SSH into the instance."
else
    print_status "Key pair $KEY_NAME already exists"
fi

# Get the latest Amazon Linux 2 AMI for the region
print_status "Getting latest Amazon Linux 2 AMI..."
AMI_ID=$(aws ec2 describe-images \
    --owners amazon \
    --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" "Name=virtualization-type,Values=hvm" \
    --query "sort_by(Images, &CreationDate)[-1].ImageId" \
    --output text \
    --region "$REGION")

print_status "Using AMI: $AMI_ID"

# Launch EC2 instance
print_status "Launching EC2 instance ($INSTANCE_TYPE)..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id "$AMI_ID" \
    --instance-type "$INSTANCE_TYPE" \
    --key-name "$KEY_NAME" \
    --security-group-ids "$SG_ID" \
    --associate-public-ip-address \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$INSTANCE_NAME}]" \
    --user-data file://<(cat << 'EOF'
#!/bin/bash
yum update -y
yum install -y docker git
systemctl start docker
systemctl enable docker
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
systemctl enable docker

# Create searxng directory
mkdir -p /opt/searxng
cd /opt/searxng

# Wait for a moment to ensure all packages are installed
sleep 30

EOF
) \
    --query "Instances[0].InstanceId" \
    --output text \
    --region "$REGION")

print_status "Instance ID: $INSTANCE_ID"

# Wait for instance to be running
print_status "Waiting for instance to be in running state..."
aws ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"

# Get public IP address
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids "$INSTANCE_ID" \
    --query "Reservations[0].Instances[0].PublicIpAddress" \
    --output text \
    --region "$REGION")

print_status "Instance is running at IP: $PUBLIC_IP"

# Wait a bit more for instance to fully initialize
print_status "Waiting for instance to fully initialize..."
sleep 60

# Create deployment files
print_status "Creating deployment configuration files..."

# Generate a new secret key for SearXNG
SEARXNG_SECRET=$(openssl rand -hex 32)

# Create remote deployment script
cat > deploy-remote.sh << EOF
#!/bin/bash
set -euo pipefail

# Install additional dependencies
yum install -y openssl

# Create directories
mkdir -p /opt/searxng/ssl

# Generate self-signed SSL certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\
    -keyout /opt/searxng/ssl/key.pem \\
    -out /opt/searxng/ssl/cert.pem \\
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$PUBLIC_IP"

# Update SearXNG settings with the actual public IP
sed -i "s|http://localhost:8080/|http://$PUBLIC_IP:8080/|g" /opt/searxng/settings.yml

# Create docker-compose.yml
cat > /opt/searxng/docker-compose.yml << 'DOCKER_COMPOSE_EOF'
$(cat docker-compose-searxng.yml)
DOCKER_COMPOSE_EOF

# Create nginx.conf
cat > /opt/searxng/nginx.conf << 'NGINX_EOF'
$(cat nginx.conf)
NGINX_EOF

# Copy settings file
cp searxng/settings.yml /opt/searxng/settings.yml

# Set environment variables
echo "SEARXNG_SECRET=$SEARXNG_SECRET" > /opt/searxng/.env

# Start services
cd /opt/searxng
docker-compose down 2>/dev/null || true
docker-compose up -d

# Wait for services to be ready
sleep 30

# Check if services are running
echo "=== Docker containers status ==="
docker-compose ps

echo "=== SearXNG service status ==="
docker-compose logs searxng | tail -10

echo "=== Nginx service status ==="
docker-compose logs nginx | tail -10

# Setup automatic start on boot
cat > /etc/systemd/system/searxng.service << 'SYSTEMD_EOF'
[Unit]
Description=SearXNG Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/searxng
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
SYSTEMD_EOF

systemctl enable searxng.service

echo "Deployment completed successfully!"
echo "SearXNG should be available at: http://$PUBLIC_IP"
echo "SearXNG (HTTPS) should be available at: https://$PUBLIC_IP"
EOF

chmod +x deploy-remote.sh

# Copy files to remote instance and run deployment
print_status "Copying files to remote instance..."

# Create the searxng directory structure
ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@"$PUBLIC_IP" "mkdir -p /opt/searxng"

# Copy files
scp -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" deploy-remote.sh ec2-user@"$PUBLIC_IP":/tmp/
scp -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" docker-compose-searxng.yml ec2-user@"$PUBLIC_IP":/opt/searxng/
scp -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" nginx.conf ec2-user@"$PUBLIC_IP":/opt/searxng/
scp -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" searxng/settings.yml ec2-user@"$PUBLIC_IP":/opt/searxng/

# Run remote deployment
print_status "Running remote deployment..."
ssh -o StrictHostKeyChecking=no -i "${KEY_NAME}.pem" ec2-user@"$PUBLIC_IP" "sudo bash /tmp/deploy-remote.sh"

# Clean up local files
rm -f deploy-remote.sh

print_status "Deployment completed!"
print_status "==================================="
print_status "SearXNG Server Information:"
print_status "Public IP: $PUBLIC_IP"
print_status "SSH Access: ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP"
print_status "HTTP URL: http://$PUBLIC_IP"
print_status "HTTPS URL: https://$PUBLIC_IP"
print_status "Instance ID: $INSTANCE_ID"
print_status "Region: $REGION"
print_status "==================================="

# Test the deployment
print_status "Testing SearXNG deployment..."
sleep 10

if curl -s -f "http://$PUBLIC_IP/health" > /dev/null; then
    print_status "✅ SearXNG is responding on HTTP"
else
    print_warning "⚠️  SearXNG might not be fully ready yet. Please wait a few minutes and try again."
fi

print_status "To check logs: ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP 'cd /opt/searxng && docker-compose logs -f'"
print_status "To stop services: ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP 'cd /opt/searxng && docker-compose down'"
print_status "To restart services: ssh -i ${KEY_NAME}.pem ec2-user@$PUBLIC_IP 'cd /opt/searxng && docker-compose restart'"