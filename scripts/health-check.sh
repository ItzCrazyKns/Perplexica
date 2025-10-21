#!/bin/bash

# Health check script for Perplexica
# Usage: ./scripts/health-check.sh [staging|production]

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
Usage: $0 [ENVIRONMENT]

Perform health check on Perplexica deployment

ENVIRONMENT:
    staging     Check staging environment
    production  Check production environment

EXAMPLES:
    $0 staging
    $0 production

REQUIREMENTS:
    - AWS CLI configured with appropriate credentials
    - EC2 Key Pair '$KEY_NAME' exists
EOF
}

# Validate environment parameter
if [[ $# -ne 1 ]]; then
    print_error "Environment parameter is required"
    usage
    exit 1
fi

ENVIRONMENT=$1

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
print_status "Stack name: $STACK_NAME"
print_status "Domain: $DOMAIN_NAME"

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed"
    exit 1
fi

# Get stack information
print_status "Retrieving stack information..."
PUBLIC_IP=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`PublicIP`].OutputValue' \
    --output text \
    --region "$AWS_REGION" 2>/dev/null || echo "")

if [[ -z "$PUBLIC_IP" ]]; then
    print_error "Could not retrieve public IP for stack '$STACK_NAME'"
    print_error "Stack may not exist or may be in an error state"
    exit 1
fi

print_success "Found public IP: $PUBLIC_IP"

# Health check functions
check_http_endpoint() {
    local url=$1
    local description=$2
    
    print_status "Checking $description..."
    
    if curl -f -s --max-time 30 "$url" > /dev/null; then
        print_success "$description is healthy"
        return 0
    else
        print_error "$description is not responding"
        return 1
    fi
}

check_ssh_connection() {
    print_status "Checking SSH connection..."
    
    if ssh -i ~/.ssh/"$KEY_NAME".pem -o ConnectTimeout=10 -o StrictHostKeyChecking=no ubuntu@"$PUBLIC_IP" "echo 'SSH connection successful'" > /dev/null 2>&1; then
        print_success "SSH connection is healthy"
        return 0
    else
        print_error "SSH connection failed"
        return 1
    fi
}

check_docker_services() {
    print_status "Checking Docker services..."
    
    local docker_status=$(ssh -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no ubuntu@"$PUBLIC_IP" \
        "docker compose -f /opt/Perplexica/docker-compose.prod.yaml ps --format json" 2>/dev/null || echo "")
    
    if [[ -n "$docker_status" ]]; then
        local running_services=$(echo "$docker_status" | jq -r '.[] | select(.State == "running") | .Name' 2>/dev/null || echo "")
        local total_services=$(echo "$docker_status" | jq -r '.[] | .Name' 2>/dev/null | wc -l)
        
        if [[ -n "$running_services" ]]; then
            print_success "Docker services are running ($(echo "$running_services" | wc -l)/$total_services)"
            return 0
        else
            print_error "No Docker services are running"
            return 1
        fi
    else
        print_error "Could not check Docker services"
        return 1
    fi
}

check_systemd_service() {
    print_status "Checking systemd service..."
    
    local service_status=$(ssh -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no ubuntu@"$PUBLIC_IP" \
        "sudo systemctl is-active perplexica" 2>/dev/null || echo "inactive")
    
    if [[ "$service_status" == "active" ]]; then
        print_success "Perplexica systemd service is active"
        return 0
    else
        print_error "Perplexica systemd service is not active (status: $service_status)"
        return 1
    fi
}

check_disk_space() {
    print_status "Checking disk space..."
    
    local disk_usage=$(ssh -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no ubuntu@"$PUBLIC_IP" \
        "df -h / | tail -1 | awk '{print \$5}' | sed 's/%//'" 2>/dev/null || echo "100")
    
    if [[ "$disk_usage" -lt 80 ]]; then
        print_success "Disk space is healthy (${disk_usage}% used)"
        return 0
    elif [[ "$disk_usage" -lt 90 ]]; then
        print_warning "Disk space is getting low (${disk_usage}% used)"
        return 0
    else
        print_error "Disk space is critically low (${disk_usage}% used)"
        return 1
    fi
}

check_memory_usage() {
    print_status "Checking memory usage..."
    
    local memory_info=$(ssh -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no ubuntu@"$PUBLIC_IP" \
        "free -m | grep Mem | awk '{print int(\$3/\$2*100)}'" 2>/dev/null || echo "100")
    
    if [[ "$memory_info" -lt 80 ]]; then
        print_success "Memory usage is healthy (${memory_info}% used)"
        return 0
    elif [[ "$memory_info" -lt 90 ]]; then
        print_warning "Memory usage is high (${memory_info}% used)"
        return 0
    else
        print_error "Memory usage is critically high (${memory_info}% used)"
        return 1
    fi
}

# Perform all health checks
print_status "Starting comprehensive health check..."

FAILED_CHECKS=0

# HTTP endpoint checks
check_http_endpoint "https://$DOMAIN_NAME" "HTTPS endpoint" || ((FAILED_CHECKS++))
check_http_endpoint "https://$DOMAIN_NAME/api/config" "API config endpoint" || ((FAILED_CHECKS++))

# Infrastructure checks
check_ssh_connection || ((FAILED_CHECKS++))
check_docker_services || ((FAILED_CHECKS++))
check_systemd_service || ((FAILED_CHECKS++))
check_disk_space || ((FAILED_CHECKS++))
check_memory_usage || ((FAILED_CHECKS++))

# Summary
echo
if [[ $FAILED_CHECKS -eq 0 ]]; then
    print_success "=== Health Check Summary ==="
    print_success "All health checks passed! ✅"
    print_success "Environment: $ENVIRONMENT"
    print_success "URL: https://$DOMAIN_NAME"
    print_success "Public IP: $PUBLIC_IP"
    exit 0
else
    print_error "=== Health Check Summary ==="
    print_error "$FAILED_CHECKS health check(s) failed! ❌"
    print_error "Environment: $ENVIRONMENT"
    print_error "URL: https://$DOMAIN_NAME"
    print_error "Public IP: $PUBLIC_IP"
    print_error "Please investigate the failed checks above"
    exit 1
fi
