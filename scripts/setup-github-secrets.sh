#!/bin/bash

# Setup GitHub Secrets for CI/CD
# Usage: ./scripts/setup-github-secrets.sh

set -e

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

print_status "Setting up GitHub Secrets for Perplexica CI/CD..."

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    print_error "GitHub CLI (gh) is not installed. Please install it first:"
    echo "  macOS: brew install gh"
    echo "  Ubuntu: sudo apt install gh"
    echo "  Or visit: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    print_error "Not authenticated with GitHub. Please run: gh auth login"
    exit 1
fi

# Get repository info
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
print_status "Repository: $REPO"

# Function to set secret
set_secret() {
    local secret_name=$1
    local secret_description=$2
    local is_required=$3
    
    print_status "Setting up secret: $secret_name"
    echo "Description: $secret_description"
    
    if [[ "$is_required" == "true" ]]; then
        echo -n "Enter $secret_name (required): "
    else
        echo -n "Enter $secret_name (optional, press Enter to skip): "
    fi
    
    read -s secret_value
    echo
    
    if [[ -n "$secret_value" ]]; then
        echo "$secret_value" | gh secret set "$secret_name" --repo "$REPO"
        print_success "Secret $secret_name set successfully"
    elif [[ "$is_required" == "true" ]]; then
        print_error "Secret $secret_name is required but not provided"
        exit 1
    else
        print_warning "Secret $secret_name skipped"
    fi
    echo
}

print_status "=== Setting up GitHub Secrets ==="
echo

# AWS Credentials
print_status "--- AWS Credentials ---"
set_secret "AWS_ACCESS_KEY_ID" "AWS Access Key ID for EC2 deployment" "true"
set_secret "AWS_SECRET_ACCESS_KEY" "AWS Secret Access Key for EC2 deployment" "true"

# LLM API Keys
print_status "--- LLM API Keys ---"
set_secret "GEMINI_API_KEY" "Google Gemini API Key" "true"
set_secret "GROQ_API_KEY" "Groq API Key (optional)" "false"
set_secret "CUSTOM_OPENAI_API_KEY" "Custom OpenAI API Key (Z.AI)" "true"

# Optional Secrets
print_status "--- Optional Secrets ---"
set_secret "SLACK_WEBHOOK_URL" "Slack Webhook URL for notifications (optional)" "false"
set_secret "DISCORD_WEBHOOK_URL" "Discord Webhook URL for notifications (optional)" "false"

# Additional API Keys (if needed)
print_status "--- Additional API Keys ---"
set_secret "ANTHROPIC_API_KEY" "Anthropic API Key (optional)" "false"
set_secret "DEEPSEEK_API_KEY" "DeepSeek API Key (optional)" "false"
set_secret "AIMLAPI_API_KEY" "AI/ML API Key (optional)" "false"

print_success "=== GitHub Secrets Setup Complete ==="
echo

# List all secrets
print_status "Current secrets in repository:"
gh secret list --repo "$REPO"

echo
print_success "Next steps:"
echo "1. Verify all required secrets are set"
echo "2. Test the CI/CD pipeline by pushing to develop branch"
echo "3. Monitor the Actions tab for deployment status"
echo
print_warning "Important: Make sure your EC2 key pair 'perplexica-key' exists in AWS"
print_warning "Important: Ensure your domain DNS is pointing to the EC2 instance"
echo
print_success "GitHub Secrets setup completed! 🚀"
