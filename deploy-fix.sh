#!/bin/bash
# Deployment script for fixing nginx and updating Perplexica

echo "Starting deployment fix..."

# Download and run nginx fix
echo "Downloading nginx fix..."
aws s3 cp s3://perplexica-deployment-scripts/fix-nginx.sh /tmp/fix-nginx.sh --region ap-southeast-1
chmod +x /tmp/fix-nginx.sh
sudo bash /tmp/fix-nginx.sh

# Check if Perplexica is running on port 3000
echo "Checking Perplexica application..."
if curl -s http://localhost:3000/api/models > /dev/null; then
    echo "✅ Perplexica is running on port 3000"
else
    echo "❌ Perplexica is not running on port 3000"
    echo "Starting Perplexica with docker-compose..."
    cd /opt/perplexica
    sudo docker-compose down
    sudo docker-compose up -d --build
fi

# Test nginx proxy
echo "Testing nginx proxy..."
if curl -s http://localhost/api/models > /dev/null; then
    echo "✅ Nginx proxy is working"
else
    echo "❌ Nginx proxy failed"
fi

echo "Deployment fix completed!"