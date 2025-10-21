#!/bin/bash

# Setup EC2 instance for Node.js deployment
# Usage: ./scripts/setup-ec2-nodejs.sh [EC2_IP]

set -e

# Configuration
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
Usage: $0 [EC2_IP]

Setup EC2 instance for Node.js deployment

EC2_IP:
    IP address of the EC2 instance

EXAMPLES:
    $0 1.2.3.4

REQUIREMENTS:
    - EC2 Key Pair '$KEY_NAME' exists
    - SSH access to EC2 instance
EOF
}

# Validate parameters
if [[ $# -ne 1 ]]; then
    print_error "EC2 IP parameter is required"
    usage
    exit 1
fi

EC2_IP=$1

print_status "Setting up EC2 instance at $EC2_IP for Node.js deployment..."

# Check if EC2 instance is reachable
print_status "Checking EC2 connectivity..."
if ! ssh -i ~/.ssh/$KEY_NAME.pem -o ConnectTimeout=10 -o StrictHostKeyChecking=no ubuntu@$EC2_IP "echo 'Connection successful'" &>/dev/null; then
    print_error "Cannot connect to EC2 instance at $EC2_IP"
    exit 1
fi
print_success "EC2 connection successful"

# Setup EC2 instance
print_status "Setting up Node.js environment on EC2..."
ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no ubuntu@$EC2_IP << 'EOF'
set -e

# Update system packages
echo "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install essential packages
echo "Installing essential packages..."
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Install Node.js 18
echo "Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node.js installation
node --version
npm --version

# Install PM2 globally
echo "Installing PM2 process manager..."
sudo npm install -g pm2

# Install build tools for native modules
echo "Installing build tools..."
sudo apt install -y build-essential python3 python3-pip

# Install Nginx
echo "Installing Nginx..."
sudo apt install -y nginx

# Configure Nginx for Perplexica
echo "Configuring Nginx..."
sudo tee /etc/nginx/sites-available/perplexica << 'NGINX_EOF'
server {
    listen 80;
    server_name _;

    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name _;

    # SSL configuration (will be updated by Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/perplexica.trangvang.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/perplexica.trangvang.ai/privkey.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript;

    # Proxy to Perplexica
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/perplexica /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Create app directory
echo "Creating application directory..."
sudo mkdir -p $APP_DIR
sudo chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR

# Create log directory
echo "Creating log directory..."
sudo mkdir -p /var/log/perplexica
sudo chown -R $SERVICE_USER:$SERVICE_USER /var/log/perplexica

# Install Certbot for SSL
echo "Installing Certbot for SSL certificates..."
sudo apt install -y certbot python3-certbot-nginx

# Setup firewall
echo "Configuring firewall..."
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

# Setup log rotation for PM2
echo "Setting up log rotation..."
sudo tee /etc/logrotate.d/pm2 << 'LOGROTATE_EOF'
/var/log/perplexica/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
    postrotate
        pm2 reloadLogs
    endscript
}
LOGROTATE_EOF

# Create PM2 startup script
echo "Setting up PM2 startup script..."
pm2 startup systemd -u $SERVICE_USER --hp /home/$SERVICE_USER

echo "EC2 setup completed successfully!"
EOF

print_success "EC2 instance setup completed!"

# Test the setup
print_status "Testing the setup..."
ssh -i ~/.ssh/$KEY_NAME.pem -o StrictHostKeyChecking=no ubuntu@$EC2_IP << 'EOF'
echo "Node.js version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "PM2 version: $(pm2 --version)"
echo "Nginx status: $(sudo systemctl is-active nginx)"
echo "App directory: $(ls -la /opt/Perplexica)"
EOF

print_success "=== EC2 Setup Complete ==="
echo
echo "EC2 IP: $EC2_IP"
echo "App Directory: $APP_DIR"
echo "SSH Command: ssh -i ~/.ssh/$KEY_NAME.pem ubuntu@$EC2_IP"
echo
echo "Next steps:"
echo "1. Deploy your application using: ./scripts/deploy-nodejs.sh staging $EC2_IP"
echo "2. Setup SSL certificate with: sudo certbot --nginx -d your-domain.com"
echo "3. Monitor logs with: pm2 logs perplexica"
echo

print_success "EC2 setup completed successfully! 🚀"
