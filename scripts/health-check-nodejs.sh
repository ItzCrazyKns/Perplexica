#!/bin/bash

# Health check script for Node.js deployment
# Usage: ./scripts/health-check-nodejs.sh [staging|production] [EC2_IP]

set -e

# Configuration
AWS_REGION="ap-southeast-1"
STACK_NAME_STAGING="perplexica-staging"
STACK_NAME_PRODUCTION="perplexica-prod"
KEY_NAME="perplexica-key"

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

Perform health check on Node.js deployment

ENVIRONMENT:
    staging     Check staging environment
    production  Check production environment

EC2_IP:
    IP address of the EC2 instance (optional, will be retrieved from CloudFormation if not provided)

EXAMPLES:
    $0 staging
    $0 production
    $0 staging 1.2.3.4

REQUIREMENTS:
    - AWS CLI configured with appropriate credentials
    - EC2 Key Pair '$KEY_NAME' exists
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
else
    STACK_NAME=$STACK_NAME_PRODUCTION
    DOMAIN_NAME="perplexica.trangvang.ai"
fi

print_status "Performing health check on $ENVIRONMENT environment..."

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

# Check PM2 process status
print_status "Checking PM2 process status..."
PM2_STATUS=$(ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no ubuntu@$EC2_IP "pm2 jlist" | jq -r '.[] | select(.name=="perplexica") | .pm2_env.status' 2>/dev/null || echo "not_found")

if [[ "$PM2_STATUS" == "online" ]]; then
    print_success "PM2 process is online"
elif [[ "$PM2_STATUS" == "not_found" ]]; then
    print_error "PM2 process 'perplexica' not found"
    exit 1
else
    print_error "PM2 process is not online (status: $PM2_STATUS)"
    exit 1
fi

# Check application health endpoint
print_status "Checking application health endpoint..."
HEALTH_CHECK_PASSED=false

for i in {1..10}; do
    if curl -f -s "https://$DOMAIN_NAME/api/config" > /dev/null; then
        print_success "Application health check passed"
        HEALTH_CHECK_PASSED=true
        break
    else
        print_warning "Health check attempt $i/10 failed, retrying in 5 seconds..."
        sleep 5
    fi
done

if [[ "$HEALTH_CHECK_PASSED" == "false" ]]; then
    print_error "Application health check failed after 10 attempts"
    exit 1
fi

# Check system resources
print_status "Checking system resources..."
ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no ubuntu@$EC2_IP << 'EOF'
echo "=== System Resources ==="
echo "Memory usage:"
free -h
echo
echo "Disk usage:"
df -h
echo
echo "CPU usage:"
top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print "CPU Usage: " 100 - $1 "%"}'
echo
echo "=== PM2 Process Info ==="
pm2 show perplexica
echo
echo "=== Recent Logs ==="
pm2 logs perplexica --lines 20 --nostream
EOF

# Check Nginx status
print_status "Checking Nginx status..."
NGINX_STATUS=$(ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no ubuntu@$EC2_IP "sudo systemctl is-active nginx" 2>/dev/null || echo "inactive")

if [[ "$NGINX_STATUS" == "active" ]]; then
    print_success "Nginx is running"
else
    print_error "Nginx is not running (status: $NGINX_STATUS)"
    exit 1
fi

# Check SSL certificate
print_status "Checking SSL certificate..."
SSL_EXPIRY=$(ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no ubuntu@$EC2_IP "sudo certbot certificates 2>/dev/null | grep -A 2 'perplexica.trangvang.ai' | grep 'Expiry Date' | awk '{print \$3, \$4}'" 2>/dev/null || echo "not_found")

if [[ "$SSL_EXPIRY" != "not_found" ]]; then
    print_success "SSL certificate found, expires: $SSL_EXPIRY"
else
    print_warning "SSL certificate not found or not configured"
fi

# Performance test
print_status "Running performance test..."
RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' "https://$DOMAIN_NAME/api/config" 2>/dev/null || echo "failed")

if [[ "$RESPONSE_TIME" != "failed" ]]; then
    print_success "Response time: ${RESPONSE_TIME}s"
else
    print_warning "Could not measure response time"
fi

# Final summary
print_success "=== Health Check Summary ==="
echo
echo "Environment: $ENVIRONMENT"
echo "EC2 IP: $EC2_IP"
echo "Domain: $DOMAIN_NAME"
echo "PM2 Status: $PM2_STATUS"
echo "Nginx Status: $NGINX_STATUS"
echo "Health Endpoint: ✅ Passed"
if [[ "$RESPONSE_TIME" != "failed" ]]; then
    echo "Response Time: ${RESPONSE_TIME}s"
fi
echo

print_success "Health check completed successfully! ✅"
