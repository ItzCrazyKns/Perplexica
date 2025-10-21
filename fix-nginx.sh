#!/bin/bash
# Fix nginx configuration for Perplexica
sudo apt-get update -y
sudo apt-get install -y nginx

# Create nginx config to proxy to port 3000
sudo tee /etc/nginx/sites-available/perplexica << 'EOF'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF

# Enable the site
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -s /etc/nginx/sites-available/perplexica /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo "Nginx configuration updated for Perplexica"