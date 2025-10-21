#!/bin/bash

# Non-Docker Deployment script for Perplexica
# Usage: ./scripts/deploy-nodejs.sh [staging|production] [EC2_IP]

set -e

# Configuration
AWS_REGION="ap-southeast-1"
STACK_NAME_STAGING="perplexica-staging"
STACK_NAME_PRODUCTION="perplexica-prod"
KEY_NAME="perplexica-key"
APP_DIR="/opt/Perplexica"
SERVICE_USER="ubuntu"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show usage
usage() {
    cat << EOF
Usage: $0 [ENVIRONMENT] [EC2_IP]

Deploy Perplexica to EC2 without Docker

ENVIRONMENT:
    staging     Deploy to staging environment
    production  Deploy to production environment

EC2_IP:
    IP address of the EC2 instance (optional, will be retrieved from CloudFormation if not provided)

EXAMPLES:
    $0 staging
    $0 production
    $0 staging 1.2.3.4

REQUIREMENTS:
    - AWS CLI configured with appropriate credentials
    - EC2 Key Pair '$KEY_NAME' exists
    - Required secrets configured in GitHub Actions
EOF
}

# Validate environment parameter
if [[ $# -lt 1 ]]; then
    print_error "Environment parameter is required"
    usage
    exit 1
fi

ENVIRONMENT=$1
EC2_IP=$2

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    print_error "Invalid environment: $ENVIRONMENT"
    usage
    exit 1
fi

# Set environment-specific variables
if [[ "$ENVIRONMENT" == "staging" ]]; then
    STACK_NAME=$STACK_NAME_STAGING
    DOMAIN_NAME="staging.perplexica.trangvang.ai"
    INSTANCE_TYPE="t3.small"
    VOLUME_SIZE="20"
else
    STACK_NAME=$STACK_NAME_PRODUCTION
    DOMAIN_NAME="perplexica.trangvang.ai"
    INSTANCE_TYPE="t3.small"
    VOLUME_SIZE="30"
fi

print_status "Deploying to $ENVIRONMENT environment..."

# Get EC2 IP if not provided
if [[ -z "$EC2_IP" ]]; then
    print_status "Retrieving EC2 IP from CloudFormation stack..."
    EC2_IP=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query 'Stacks[0].Outputs[?OutputKey==`PublicIP`].OutputValue' \
        --output text \
        --region "$AWS_REGION")
    
    if [[ -z "$EC2_IP" || "$EC2_IP" == "None" ]]; then
        print_error "Could not retrieve EC2 IP from CloudFormation stack"
        exit 1
    fi
fi

print_status "EC2 IP: $EC2_IP"
print_status "Domain: $DOMAIN_NAME"

# Check if EC2 instance is reachable
print_status "Checking EC2 connectivity..."
if ! ssh -i ~/.ssh/$KEY_NAME.pem -o ConnectTimeout=10 -o StrictHostKeyChecking=no ubuntu@$EC2_IP "echo 'Connection successful'" &>/dev/null; then
    print_error "Cannot connect to EC2 instance at $EC2_IP"
    exit 1
fi
print_success "EC2 connection successful"

# Create deployment package
print_status "Creating deployment package..."
TEMP_DIR=$(mktemp -d)
DEPLOY_PACKAGE="$TEMP_DIR/perplexica-deploy.tar.gz"

# Copy necessary files
cp -r . "$TEMP_DIR/perplexica/"
cd "$TEMP_DIR/perplexica"

# Remove unnecessary files
rm -rf node_modules .git .github .next dist
rm -f *.log

# Create tar.gz
tar -czf "$DEPLOY_PACKAGE" .

print_success "Deployment package created: $DEPLOY_PACKAGE"

# Upload to EC2
print_status "Uploading deployment package to EC2..."
scp -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no "$DEPLOY_PACKAGE" ubuntu@$EC2_IP:/tmp/

# Deploy on EC2
print_status "Deploying on EC2 instance..."
ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no ubuntu@$EC2_IP << EOF
set -e

# Create app directory if it doesn't exist
sudo mkdir -p $APP_DIR
sudo chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR

# Stop existing service
if pm2 list | grep -q perplexica; then
    echo "Stopping existing Perplexica service..."
    pm2 stop perplexica
    pm2 delete perplexica
fi

# Backup existing deployment
if [ -d "$APP_DIR" ] && [ "\$(ls -A $APP_DIR)" ]; then
    echo "Backing up existing deployment..."
    sudo mv $APP_DIR $APP_DIR.backup.\$(date +%Y%m%d_%H%M%S)
    sudo mkdir -p $APP_DIR
    sudo chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR
fi

# Extract new deployment
echo "Extracting new deployment..."
cd $APP_DIR
tar -xzf /tmp/perplexica-deploy.tar.gz
rm /tmp/perplexica-deploy.tar.gz

# Install dependencies
echo "Installing dependencies..."
npm ci --production

# Run database migration
echo "Running database migration..."
npm run db:migrate

# Build application
echo "Building application..."
npm run build

# Create log directory
sudo mkdir -p /var/log/perplexica
sudo chown -R $SERVICE_USER:$SERVICE_USER /var/log/perplexica

# Start service with PM2
echo "Starting Perplexica service..."
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup systemd -u $SERVICE_USER --hp /home/$SERVICE_USER

echo "Deployment completed successfully!"
EOF

# Health check
print_status "Performing health check..."
sleep 10

for i in {1..30}; do
    if curl -f -s "https://$DOMAIN_NAME/api/config" > /dev/null; then
        print_success "✅ Health check passed - Application is running!"
        break
    fi
    print_warning "⏳ Waiting for application to be ready... ($i/30)"
    sleep 10
done

# Final status check
print_status "Checking service status..."
ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no ubuntu@$EC2_IP "pm2 status perplexica"

# Cleanup
rm -rf "$TEMP_DIR"

print_success "=== Deployment Complete ==="
echo
echo "Environment: $ENVIRONMENT"
echo "EC2 IP: $EC2_IP"
echo "Application URL: https://$DOMAIN_NAME"
echo "SSH Command: ssh -i ~/.ssh/$KEY_NAME.pem ubuntu@$EC2_IP"
echo

print_success "Deployment to $ENVIRONMENT completed successfully! 🚀"
