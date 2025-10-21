#!/bin/bash

# Deployment script for Perplexica
# Usage: ./scripts/deploy.sh [staging|production]

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

Deploy Perplexica to specified environment

ENVIRONMENT:
    staging     Deploy to staging environment
    production  Deploy to production environment

EXAMPLES:
    $0 staging
    $0 production

REQUIREMENTS:
    - AWS CLI configured with appropriate credentials
    - EC2 Key Pair '$KEY_NAME' exists
    - Required secrets configured in GitHub Actions
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
    INSTANCE_TYPE="t3.small"
    VOLUME_SIZE="20"
else
    STACK_NAME=$STACK_NAME_PRODUCTION
    DOMAIN_NAME="perplexica.trangvang.ai"
    INSTANCE_TYPE="t3.small"
    VOLUME_SIZE="30"
fi

print_status "Deploying to $ENVIRONMENT environment..."
print_status "Stack name: $STACK_NAME"
print_status "Domain: $DOMAIN_NAME"

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed"
    exit 1
fi

# Check if CloudFormation template exists
TEMPLATE_FILE="cloudformation-templates/perplexica-ec2-stack.yaml"
if [[ ! -f "$TEMPLATE_FILE" ]]; then
    print_error "CloudFormation template not found: $TEMPLATE_FILE"
    exit 1
fi

# Check if key pair exists
print_status "Checking EC2 Key Pair '$KEY_NAME'..."
if ! aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$AWS_REGION" &>/dev/null; then
    print_error "EC2 Key Pair '$KEY_NAME' not found in region '$AWS_REGION'"
    exit 1
fi
print_success "Key pair found"

# Check if stack exists
print_status "Checking if stack '$STACK_NAME' exists..."
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" &>/dev/null; then
    print_status "Stack exists, updating..."
    OPERATION="update"
else
    print_status "Stack does not exist, creating..."
    OPERATION="create"
fi

# Deploy CloudFormation stack
print_status "Deploying CloudFormation stack..."

if [[ "$OPERATION" == "create" ]]; then
    aws cloudformation create-stack \
        --stack-name "$STACK_NAME" \
        --template-body file://"$TEMPLATE_FILE" \
        --parameters \
            ParameterKey=KeyName,ParameterValue="$KEY_NAME" \
            ParameterKey=InstanceType,ParameterValue="$INSTANCE_TYPE" \
            ParameterKey=VolumeSize,ParameterValue="$VOLUME_SIZE" \
            ParameterKey=SSHLocation,ParameterValue="0.0.0.0/0" \
            ParameterKey=AllocateElasticIP,ParameterValue="true" \
            ParameterKey=DomainName,ParameterValue="$DOMAIN_NAME" \
            ParameterKey=EmailAddress,ParameterValue="admin@trangvang.ai" \
        --region "$AWS_REGION" \
        --capabilities CAPABILITY_IAM
else
    aws cloudformation update-stack \
        --stack-name "$STACK_NAME" \
        --template-body file://"$TEMPLATE_FILE" \
        --parameters \
            ParameterKey=KeyName,UsePreviousValue=true \
            ParameterKey=InstanceType,ParameterValue="$INSTANCE_TYPE" \
            ParameterKey=VolumeSize,ParameterValue="$VOLUME_SIZE" \
            ParameterKey=SSHLocation,UsePreviousValue=true \
            ParameterKey=AllocateElasticIP,UsePreviousValue=true \
            ParameterKey=DomainName,ParameterValue="$DOMAIN_NAME" \
            ParameterKey=EmailAddress,ParameterValue="admin@trangvang.ai" \
        --region "$AWS_REGION" \
        --capabilities CAPABILITY_IAM
fi

print_success "Stack deployment initiated"

# Wait for stack completion
print_status "Waiting for stack deployment to complete..."
if [[ "$OPERATION" == "create" ]]; then
    aws cloudformation wait stack-create-complete \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION"
else
    aws cloudformation wait stack-update-complete \
        --stack-name "$STACK_NAME" \
        --region "$AWS_REGION"
fi

print_success "Stack deployment completed!"

# Get stack outputs
print_status "Retrieving deployment information..."
PUBLIC_IP=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`PublicIP`].OutputValue' \
    --output text \
    --region "$AWS_REGION")

APPLICATION_URL="https://$DOMAIN_NAME"

print_success "=== Deployment Complete ==="
echo
echo "Environment: $ENVIRONMENT"
echo "Public IP: $PUBLIC_IP"
echo "Application URL: $APPLICATION_URL"
echo "SSH Command: ssh -i ~/.ssh/$KEY_NAME.pem ubuntu@$PUBLIC_IP"
echo

# Next steps
print_warning "=== Next Steps ==="
echo "1. Verify the application is running:"
echo "   curl -f $APPLICATION_URL/api/config"
echo
echo "2. Check service status:"
echo "   ssh -i ~/.ssh/$KEY_NAME.pem ubuntu@$PUBLIC_IP"
echo "   sudo systemctl status perplexica"
echo
echo "3. View logs if needed:"
echo "   docker compose -f /opt/Perplexica/docker-compose.prod.yaml logs -f"
echo

print_success "Deployment to $ENVIRONMENT completed successfully! 🚀"
