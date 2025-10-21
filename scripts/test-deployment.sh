#!/bin/bash

# Test deployment pipeline
# Usage: ./scripts/test-deployment.sh [staging|production]

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

Test deployment pipeline

ENVIRONMENT:
    staging     Test staging environment
    production  Test production environment

EXAMPLES:
    $0 staging
    $0 production

REQUIREMENTS:
    - AWS CLI configured with appropriate credentials
    - EC2 Key Pair '$KEY_NAME' exists
    - GitHub CLI (gh) installed and authenticated
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
    BRANCH="develop"
else
    STACK_NAME=$STACK_NAME_PRODUCTION
    DOMAIN_NAME="perplexica.trangvang.ai"
    BRANCH="main"
fi

print_status "Testing deployment pipeline for $ENVIRONMENT environment..."

# Check prerequisites
print_status "Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed"
    exit 1
fi
print_success "AWS CLI found"

# Check GitHub CLI
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI (gh) is not installed"
    exit 1
fi
print_success "GitHub CLI found"

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured"
    exit 1
fi
print_success "AWS credentials configured"

# Check GitHub authentication
if ! gh auth status &> /dev/null; then
    print_error "Not authenticated with GitHub"
    exit 1
fi
print_success "GitHub authenticated"

# Check if key pair exists
print_status "Checking EC2 Key Pair '$KEY_NAME'..."
if ! aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$AWS_REGION" &>/dev/null; then
    print_error "EC2 Key Pair '$KEY_NAME' not found in region '$AWS_REGION'"
    print_status "Creating key pair..."
    aws ec2 create-key-pair --key-name "$KEY_NAME" --query 'KeyMaterial' --output text --region "$AWS_REGION" > ~/.ssh/$KEY_NAME.pem
    chmod 400 ~/.ssh/$KEY_NAME.pem
    print_success "Key pair created"
else
    print_success "Key pair found"
fi

# Check if CloudFormation stack exists
print_status "Checking CloudFormation stack '$STACK_NAME'..."
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$AWS_REGION" &>/dev/null; then
    print_success "CloudFormation stack exists"
    
    # Get EC2 IP
    EC2_IP=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query 'Stacks[0].Outputs[?OutputKey==`PublicIP`].OutputValue' \
        --output text \
        --region "$AWS_REGION")
    
    if [[ -n "$EC2_IP" && "$EC2_IP" != "None" ]]; then
        print_success "EC2 IP: $EC2_IP"
        
        # Test EC2 connectivity
        print_status "Testing EC2 connectivity..."
        if ssh -i ~/.ssh/$KEY_NAME.pem -o ConnectTimeout=10 -o StrictHostKeyChecking=no ubuntu@$EC2_IP "echo 'Connection successful'" &>/dev/null; then
            print_success "EC2 connection successful"
        else
            print_warning "Cannot connect to EC2 instance"
        fi
    else
        print_warning "Could not retrieve EC2 IP"
    fi
else
    print_warning "CloudFormation stack does not exist"
fi

# Check GitHub secrets
print_status "Checking GitHub secrets..."
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
SECRETS=$(gh secret list --repo "$REPO" --json name -q '.[].name')

required_secrets=("AWS_ACCESS_KEY_ID" "AWS_SECRET_ACCESS_KEY" "GEMINI_API_KEY" "CUSTOM_OPENAI_API_KEY")
missing_secrets=()

for secret in "${required_secrets[@]}"; do
    if echo "$SECRETS" | grep -q "^$secret$"; then
        print_success "Secret $secret found"
    else
        missing_secrets+=("$secret")
        print_error "Secret $secret missing"
    fi
done

if [[ ${#missing_secrets[@]} -gt 0 ]]; then
    print_error "Missing required secrets: ${missing_secrets[*]}"
    print_status "Run ./scripts/setup-github-secrets.sh to configure secrets"
fi

# Test local build
print_status "Testing local build..."
if npm ci &>/dev/null; then
    print_success "Dependencies installed"
else
    print_error "Failed to install dependencies"
    exit 1
fi

if npm run build &>/dev/null; then
    print_success "Application built successfully"
else
    print_error "Build failed"
    exit 1
fi

# Test deployment script
print_status "Testing deployment script..."
if [[ -f "./scripts/deploy-nodejs.sh" ]]; then
    print_success "Deployment script found"
else
    print_error "Deployment script not found"
    exit 1
fi

if [[ -x "./scripts/deploy-nodejs.sh" ]]; then
    print_success "Deployment script is executable"
else
    print_error "Deployment script is not executable"
    exit 1
fi

# Test health check script
print_status "Testing health check script..."
if [[ -f "./scripts/health-check-nodejs.sh" ]]; then
    print_success "Health check script found"
else
    print_error "Health check script not found"
    exit 1
fi

if [[ -x "./scripts/health-check-nodejs.sh" ]]; then
    print_success "Health check script is executable"
else
    print_error "Health check script is not executable"
    exit 1
fi

# Test GitHub Actions workflow
print_status "Testing GitHub Actions workflow..."
if [[ -f ".github/workflows/deploy-nodejs.yml" ]]; then
    print_success "GitHub Actions workflow found"
else
    print_error "GitHub Actions workflow not found"
    exit 1
fi

# Check if we're on the correct branch
current_branch=$(git branch --show-current)
if [[ "$current_branch" == "$BRANCH" ]]; then
    print_success "On correct branch: $current_branch"
else
    print_warning "Not on expected branch. Current: $current_branch, Expected: $BRANCH"
fi

# Test domain resolution
print_status "Testing domain resolution..."
if nslookup "$DOMAIN_NAME" &>/dev/null; then
    print_success "Domain resolves: $DOMAIN_NAME"
else
    print_warning "Domain does not resolve: $DOMAIN_NAME"
fi

# Test HTTPS endpoint (if available)
print_status "Testing HTTPS endpoint..."
if curl -f -s "https://$DOMAIN_NAME/api/config" &>/dev/null; then
    print_success "HTTPS endpoint is accessible"
else
    print_warning "HTTPS endpoint is not accessible (this is normal for new deployments)"
fi

# Summary
print_success "=== Test Summary ==="
echo
echo "Environment: $ENVIRONMENT"
echo "Branch: $current_branch"
echo "Domain: $DOMAIN_NAME"
echo "Stack: $STACK_NAME"
if [[ -n "$EC2_IP" && "$EC2_IP" != "None" ]]; then
    echo "EC2 IP: $EC2_IP"
fi
echo

if [[ ${#missing_secrets[@]} -eq 0 ]]; then
    print_success "All prerequisites are met! Ready for deployment."
    echo
    print_status "To deploy:"
    echo "  ./scripts/deploy-nodejs.sh $ENVIRONMENT"
    echo
    print_status "To test health:"
    echo "  ./scripts/health-check-nodejs.sh $ENVIRONMENT"
    echo
    print_status "To trigger GitHub Actions:"
    echo "  git push origin $current_branch"
else
    print_error "Some prerequisites are missing. Please fix them before deploying."
    echo
    print_status "Missing secrets: ${missing_secrets[*]}"
    print_status "Run: ./scripts/setup-github-secrets.sh"
fi

print_success "Test completed! 🚀"
