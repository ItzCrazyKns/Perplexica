#!/bin/bash

# Perplexica EC2 Deployment Script
# This script deploys Perplexica to EC2 using CloudFormation

set -e

# Configuration
STACK_NAME="perplexica-ec2"
REGION="ap-southeast-1"  # Singapore region
TEMPLATE_FILE="cloudformation-templates/perplexica-ec2-stack.yaml"
KEY_NAME=""
INSTANCE_TYPE="t3.small"
VOLUME_SIZE="30"
SSH_LOCATION="0.0.0.0/0"
DOMAIN_NAME=""
EMAIL_ADDRESS=""
ALLOCATE_EIP="true"

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
Usage: $0 [OPTIONS]

Deploy Perplexica to EC2 using CloudFormation

OPTIONS:
    -k, --key-name TEXT       EC2 Key Pair name (required)
    -r, --region TEXT         AWS region (default: ap-southeast-1 - Singapore)
    -t, --instance-type TEXT  EC2 instance type (default: t3.small)
    -s, --volume-size NUMBER  EBS volume size in GB (default: 30)
    -i, --ssh-ip TEXT         SSH access CIDR (default: 0.0.0.0/0)
    -d, --domain TEXT         Custom domain name (optional)
    -e, --email TEXT          Email for Let's Encrypt (required if domain provided)
    --no-eip                  Don't allocate Elastic IP
    -h, --help                Show this help message

EXAMPLES:
    # Basic deployment
    $0 -k my-key-pair

    # With domain and HTTPS
    $0 -k my-key-pair -d perplexica.example.com -e admin@example.com

    # Larger instance for production
    $0 -k my-key-pair -t t3.medium -s 50

IMPORTANT:
    1. You must have a config.toml file with LLM API keys ready
    2. After deployment, you MUST copy your config.toml to the EC2 instance
    3. Get free API keys from: https://console.groq.com/
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -k|--key-name)
            KEY_NAME="$2"
            shift 2
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -t|--instance-type)
            INSTANCE_TYPE="$2"
            shift 2
            ;;
        -s|--volume-size)
            VOLUME_SIZE="$2"
            shift 2
            ;;
        -i|--ssh-ip)
            SSH_LOCATION="$2"
            shift 2
            ;;
        -d|--domain)
            DOMAIN_NAME="$2"
            shift 2
            ;;
        -e|--email)
            EMAIL_ADDRESS="$2"
            shift 2
            ;;
        --no-eip)
            ALLOCATE_EIP="false"
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$KEY_NAME" ]]; then
    print_error "Key name is required. Use -k or --key-name"
    usage
    exit 1
fi

if [[ -n "$DOMAIN_NAME" && -z "$EMAIL_ADDRESS" ]]; then
    print_error "Email address is required when domain name is provided"
    usage
    exit 1
fi

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install it first."
    exit 1
fi

# Check if template file exists
if [[ ! -f "$TEMPLATE_FILE" ]]; then
    print_error "Template file not found: $TEMPLATE_FILE"
    exit 1
fi

# Check if key pair exists
print_status "Checking if EC2 Key Pair '$KEY_NAME' exists..."
if ! aws ec2 describe-key-pairs --key-names "$KEY_NAME" --region "$REGION" &>/dev/null; then
    print_error "EC2 Key Pair '$KEY_NAME' not found in region '$REGION'"
    print_status "You can create one with:"
    echo "aws ec2 create-key-pair --key-name $KEY_NAME --query 'KeyMaterial' --output text > ~/.ssh/$KEY_NAME.pem"
    echo "chmod 400 ~/.ssh/$KEY_NAME.pem"
    exit 1
fi
print_success "Key pair found"

# Check if stack already exists
print_status "Checking if stack '$STACK_NAME' already exists..."
if aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &>/dev/null; then
    print_warning "Stack '$STACK_NAME' already exists"
    read -p "Do you want to update it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Deployment cancelled"
        exit 0
    fi

    # Update existing stack
    print_status "Updating existing stack..."
    CF_COMMAND="update-stack"
else
    # Create new stack
    print_status "Creating new stack..."
    CF_COMMAND="create-stack"
fi

# Prepare CloudFormation parameters
PARAMETERS="ParameterKey=KeyName,ParameterValue=$KEY_NAME ParameterKey=InstanceType,ParameterValue=$INSTANCE_TYPE ParameterKey=VolumeSize,ParameterValue=$VOLUME_SIZE ParameterKey=SSHLocation,ParameterValue=$SSH_LOCATION ParameterKey=AllocateElasticIP,ParameterValue=$ALLOCATE_EIP"

if [[ -n "$DOMAIN_NAME" ]]; then
    PARAMETERS="$PARAMETERS ParameterKey=DomainName,ParameterValue=$DOMAIN_NAME ParameterKey=EmailAddress,ParameterValue=$EMAIL_ADDRESS"
fi

# Deploy stack
print_status "Deploying CloudFormation stack..."
print_status "Stack name: $STACK_NAME"
print_status "Region: $REGION"
print_status "Instance type: $INSTANCE_TYPE"
print_status "Volume size: ${VOLUME_SIZE}GB"
if [[ -n "$DOMAIN_NAME" ]]; then
    print_status "Domain: $DOMAIN_NAME"
fi

CF_COMMAND_FULL="aws cloudformation $CF_COMMAND \
  --stack-name $STACK_NAME \
  --template-body file://$TEMPLATE_FILE \
  --parameters $PARAMETERS \
  --region $REGION \
  --capabilities CAPABILITY_IAM"

if [[ "$CF_COMMAND" == "create-stack" ]]; then
    $CF_COMMAND_FULL
else
    $CF_COMMAND_FULL || {
        if [[ $? -eq 255 ]]; then
            print_warning "No updates to be performed"
            exit 0
        else
            exit 1
        fi
    }
fi

print_success "Stack deployment initiated"

# Wait for stack completion
print_status "Waiting for stack deployment to complete..."
aws cloudformation wait stack-${CF_COMMAND/create-stack/create}-complete \
    --stack-name "$STACK_NAME" \
    --region "$REGION"

print_success "Stack deployment completed!"

# Get stack outputs
print_status "Retrieving deployment information..."
PUBLIC_IP=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`PublicIP`].OutputValue' \
    --output text \
    --region "$REGION")

SSH_COMMAND=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`SSHCommand`].OutputValue' \
    --output text \
    --region "$REGION")

APPLICATION_URL=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`ApplicationURL`].OutputValue' \
    --output text \
    --region "$REGION")

# Display results
echo
print_success "=== Deployment Complete ==="
echo
echo "Public IP: $PUBLIC_IP"
echo "Application URL: $APPLICATION_URL"
echo "SSH Command: $SSH_COMMAND"
echo

# Next steps
print_warning "=== IMPORTANT: Next Steps ==="
echo
echo "1. ⚠️  YOU MUST CONFIGURE LLM API KEYS:"
echo "   Perplexica will NOT work without valid LLM API keys."
echo "   Get free keys from: https://console.groq.com/"
echo
echo "2. Copy your config.toml with API keys to the instance:"
echo "   scp -i ~/.ssh/$KEY_NAME.pem ./config.toml ubuntu@$PUBLIC_IP:/opt/Perplexica/"
echo
echo "3. SSH into the instance and restart the service:"
echo "   $SSH_COMMAND"
echo "   sudo systemctl restart perplexica"
echo
echo "4. Check service status:"
echo "   sudo systemctl status perplexica"
echo "   docker compose -f /opt/Perplexica/docker-compose.prod.yaml logs -f"
echo
echo "5. Access your Perplexica instance:"
echo "   $APPLICATION_URL"
echo

if [[ -n "$DOMAIN_NAME" ]]; then
    print_status "HTTPS Setup:"
    echo "   SSL certificate will be automatically configured."
    echo "   Make sure your domain DNS points to: $PUBLIC_IP"
    echo
fi

print_status "For troubleshooting and management commands, see:"
echo "   docs/DEPLOY_EC2_CLOUDFORMATION.md"
echo
print_success "Happy searching with Perplexica! 🚀"