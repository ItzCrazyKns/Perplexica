#!/bin/bash

# Rollback script for Perplexica
# Usage: ./scripts/rollback.sh [staging|production] [previous-version]

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
Usage: $0 [ENVIRONMENT] [PREVIOUS_VERSION]

Rollback Perplexica deployment to previous version

ENVIRONMENT:
    staging     Rollback staging environment
    production  Rollback production environment

PREVIOUS_VERSION:
    Git commit hash or tag to rollback to (optional)

EXAMPLES:
    $0 staging
    $0 production abc1234
    $0 production v1.2.0

REQUIREMENTS:
    - AWS CLI configured with appropriate credentials
    - EC2 Key Pair '$KEY_NAME' exists
    - Git repository with commit history
EOF
}

# Validate environment parameter
if [[ $# -lt 1 || $# -gt 2 ]]; then
    print_error "Environment parameter is required"
    usage
    exit 1
fi

ENVIRONMENT=$1
PREVIOUS_VERSION=${2:-""}

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

print_status "Rolling back $ENVIRONMENT environment..."
print_status "Stack name: $STACK_NAME"
print_status "Domain: $DOMAIN_NAME"

if [[ -n "$PREVIOUS_VERSION" ]]; then
    print_status "Target version: $PREVIOUS_VERSION"
else
    print_warning "No specific version provided, will rollback to previous CloudFormation stack state"
fi

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed"
    exit 1
fi

# Get current stack information
print_status "Retrieving current stack information..."
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

print_success "Found current public IP: $PUBLIC_IP"

# Backup current state
print_status "Creating backup of current state..."
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)_${ENVIRONMENT}"
mkdir -p "$BACKUP_DIR"

# Backup config.toml
print_status "Backing up config.toml..."
scp -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no \
    ubuntu@"$PUBLIC_IP":/opt/Perplexica/config.toml \
    "$BACKUP_DIR/config.toml" 2>/dev/null || print_warning "Could not backup config.toml"

# Backup database
print_status "Backing up database..."
scp -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no \
    ubuntu@"$PUBLIC_IP":/opt/Perplexica/data/db.sqlite \
    "$BACKUP_DIR/db.sqlite" 2>/dev/null || print_warning "Could not backup database"

# Backup uploads
print_status "Backing up uploads..."
rsync -avz -e "ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no" \
    ubuntu@"$PUBLIC_IP":/opt/Perplexica/uploads/ \
    "$BACKUP_DIR/uploads/" 2>/dev/null || print_warning "Could not backup uploads"

print_success "Backup created in: $BACKUP_DIR"

# Rollback methods
rollback_cloudformation_stack() {
    print_status "Rolling back CloudFormation stack..."
    
    # Get stack events to find previous successful deployment
    local stack_events=$(aws cloudformation describe-stack-events \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION" \
        --query 'StackEvents[?ResourceStatus==`UPDATE_COMPLETE` || ResourceStatus==`CREATE_COMPLETE`] | [0]' \
        --output json 2>/dev/null || echo "{}")
    
    if [[ "$stack_events" != "{}" ]]; then
        print_status "Found previous successful deployment, rolling back..."
        
        # Update stack with previous parameters
        aws cloudformation update-stack \
            --stack-name "$STACK_NAME" \
            --template-body file://cloudformation-templates/perplexica-ec2-stack.yaml \
            --parameters \
                ParameterKey=KeyName,UsePreviousValue=true \
                ParameterKey=InstanceType,UsePreviousValue=true \
                ParameterKey=VolumeSize,UsePreviousValue=true \
                ParameterKey=SSHLocation,UsePreviousValue=true \
                ParameterKey=AllocateElasticIP,UsePreviousValue=true \
                ParameterKey=DomainName,UsePreviousValue=true \
                ParameterKey=EmailAddress,UsePreviousValue=true \
            --region "$AWS_REGION" \
            --capabilities CAPABILITY_IAM
        
        print_status "Waiting for rollback to complete..."
        aws cloudformation wait stack-update-complete \
            --stack-name "$STACK_NAME" \
            --region "$AWS_REGION"
        
        print_success "CloudFormation stack rollback completed"
    else
        print_warning "No previous successful deployment found for CloudFormation rollback"
        return 1
    fi
}

rollback_docker_image() {
    print_status "Rolling back Docker image..."
    
    if [[ -n "$PREVIOUS_VERSION" ]]; then
        # Checkout to previous version
        print_status "Checking out to version: $PREVIOUS_VERSION"
        git checkout "$PREVIOUS_VERSION" || {
            print_error "Could not checkout to version: $PREVIOUS_VERSION"
            return 1
        }
        
        # Build and deploy previous image
        print_status "Building previous Docker image..."
        docker build -f app.dockerfile -t perplexica-rollback .
        
        # Save and transfer image to EC2
        print_status "Transferring Docker image to EC2..."
        docker save perplexica-rollback | ssh -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no ubuntu@"$PUBLIC_IP" "docker load"
        
        # Update docker-compose to use local image
        ssh -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no ubuntu@"$PUBLIC_IP" \
            "cd /opt/Perplexica && sed -i 's|image: itzcrazykns1337/perplexica:main|image: perplexica-rollback|g' docker-compose.prod.yaml"
        
        # Restart services
        print_status "Restarting services with previous image..."
        ssh -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no ubuntu@"$PUBLIC_IP" \
            "sudo systemctl restart perplexica"
        
        # Restore git state
        git checkout -
        
        print_success "Docker image rollback completed"
    else
        print_warning "No specific version provided for Docker image rollback"
        return 1
    fi
}

rollback_application_config() {
    print_status "Rolling back application configuration..."
    
    # Restore config.toml from backup
    if [[ -f "$BACKUP_DIR/config.toml" ]]; then
        print_status "Restoring config.toml from backup..."
        scp -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no \
            "$BACKUP_DIR/config.toml" \
            ubuntu@"$PUBLIC_IP":/opt/Perplexica/config.toml
        
        # Restart service
        ssh -i ~/.ssh/"$KEY_NAME".pem -o StrictHostKeyChecking=no ubuntu@"$PUBLIC_IP" \
            "sudo systemctl restart perplexica"
        
        print_success "Application configuration rollback completed"
    else
        print_warning "No config.toml backup found"
        return 1
    fi
}

# Perform rollback
print_status "Starting rollback process..."

ROLLBACK_SUCCESS=false

# Try different rollback methods
if rollback_cloudformation_stack; then
    ROLLBACK_SUCCESS=true
elif rollback_docker_image; then
    ROLLBACK_SUCCESS=true
elif rollback_application_config; then
    ROLLBACK_SUCCESS=true
else
    print_error "All rollback methods failed"
fi

# Wait for service to be ready
if [[ "$ROLLBACK_SUCCESS" == true ]]; then
    print_status "Waiting for service to be ready..."
    sleep 30
    
    # Health check
    print_status "Performing health check..."
    if curl -f -s --max-time 30 "https://$DOMAIN_NAME/api/config" > /dev/null; then
        print_success "Service is responding after rollback"
    else
        print_warning "Service may not be fully ready yet"
    fi
fi

# Summary
echo
if [[ "$ROLLBACK_SUCCESS" == true ]]; then
    print_success "=== Rollback Summary ==="
    print_success "Rollback completed successfully! ✅"
    print_success "Environment: $ENVIRONMENT"
    print_success "URL: https://$DOMAIN_NAME"
    print_success "Backup location: $BACKUP_DIR"
    print_warning "Please verify the application is working correctly"
else
    print_error "=== Rollback Summary ==="
    print_error "Rollback failed! ❌"
    print_error "Environment: $ENVIRONMENT"
    print_error "Backup location: $BACKUP_DIR"
    print_error "Manual intervention may be required"
    exit 1
fi
