# 🚀 Perplexica CI/CD Deployment Guide

Hướng dẫn deploy Perplexica lên AWS EC2 sử dụng Node.js thay vì Docker.

## 📋 Tổng quan

### Kiến trúc mới
- **Runtime**: Node.js 18 + PM2
- **Web Server**: Nginx (reverse proxy)
- **SSL**: Let's Encrypt (Certbot)
- **CI/CD**: GitHub Actions
- **Infrastructure**: AWS EC2 + CloudFormation

### Các file mới được tạo
```
ecosystem.config.js                    # PM2 configuration
scripts/
├── deploy-nodejs.sh                   # Main deployment script
├── setup-ec2-nodejs.sh               # EC2 setup script
├── health-check-nodejs.sh            # Health check script
├── setup-github-secrets.sh           # GitHub secrets setup
└── test-deployment.sh                # Test deployment pipeline
.github/workflows/
└── deploy-nodejs.yml                 # GitHub Actions workflow
docs/
└── NODEJS_CI_CD_SETUP.md            # Detailed setup guide
```

---

## 🚀 Quick Start (5 phút)

### 1. Cấu hình GitHub Secrets
```bash
./scripts/setup-github-secrets.sh
```

### 2. Test deployment pipeline
```bash
./scripts/test-deployment.sh staging
```

### 3. Deploy lần đầu
```bash
# Staging
./scripts/deploy-nodejs.sh staging

# Production
./scripts/deploy-nodejs.sh production
```

### 4. Kiểm tra health
```bash
./scripts/health-check-nodejs.sh staging
```

---

## 📝 Chi tiết Setup

### Bước 1: Cấu hình GitHub Secrets

Chạy script để setup secrets:
```bash
./scripts/setup-github-secrets.sh
```

**Required Secrets:**
- `AWS_ACCESS_KEY_ID` - AWS Access Key
- `AWS_SECRET_ACCESS_KEY` - AWS Secret Key  
- `GEMINI_API_KEY` - Google Gemini API Key
- `CUSTOM_OPENAI_API_KEY` - Z.AI API Key

**Optional Secrets:**
- `GROQ_API_KEY` - Groq API Key
- `SLACK_WEBHOOK_URL` - Slack notifications
- `ANTHROPIC_API_KEY` - Anthropic API Key

### Bước 2: Tạo EC2 Key Pair

```bash
# Tạo key pair trên AWS
aws ec2 create-key-pair --key-name perplexica-key --query 'KeyMaterial' --output text > ~/.ssh/perplexica-key.pem
chmod 400 ~/.ssh/perplexica-key.pem
```

### Bước 3: Setup EC2 Instance

```bash
# Setup EC2 cho Node.js (chạy một lần)
./scripts/setup-ec2-nodejs.sh EC2_IP
```

Script này sẽ cài đặt:
- Node.js 18
- PM2 process manager
- Nginx web server
- SSL certificates (Let's Encrypt)
- Build tools

### Bước 4: Deploy Application

```bash
# Deploy staging
./scripts/deploy-nodejs.sh staging

# Deploy production  
./scripts/deploy-nodejs.sh production
```

---

## 🔄 CI/CD Pipeline

### Automatic Deployment

**Staging**: Tự động deploy khi push vào `develop` branch
**Production**: Tự động deploy khi push vào `main` branch

### Manual Deployment

```bash
# Trigger GitHub Actions
gh workflow run deploy-nodejs.yml -f environment=staging
gh workflow run deploy-nodejs.yml -f environment=production
```

### Pipeline Steps

1. **Checkout code**
2. **Setup Node.js 18**
3. **Install dependencies** (`npm ci`)
4. **Run linting & type checking**
5. **Build application** (`npm run build`)
6. **Deploy to EC2** (upload + install + start)
7. **Health check**
8. **Slack notification**

---

## 📊 Monitoring & Maintenance

### Health Check
```bash
# Check staging
./scripts/health-check-nodejs.sh staging

# Check production
./scripts/health-check-nodejs.sh production
```

### PM2 Management
```bash
# SSH vào EC2
ssh -i ~/.ssh/perplexica-key.pem ubuntu@EC2_IP

# PM2 commands
pm2 status                    # Xem status
pm2 logs perplexica          # Xem logs
pm2 restart perplexica       # Restart app
pm2 monit                    # Monitor resources
```

### Nginx Management
```bash
# Check Nginx status
sudo systemctl status nginx

# Restart Nginx
sudo systemctl restart nginx

# Check logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### SSL Certificate
```bash
# Setup SSL
sudo certbot --nginx -d your-domain.com

# Renew SSL
sudo certbot renew

# Check SSL status
sudo certbot certificates
```

---

## 🚨 Troubleshooting

### Common Issues

#### 1. EC2 Connection Failed
```bash
# Check key permissions
chmod 400 ~/.ssh/perplexica-key.pem

# Test connection
ssh -i ~/.ssh/perplexica-key.pem ubuntu@EC2_IP
```

#### 2. PM2 Process Not Starting
```bash
# Check logs
pm2 logs perplexica

# Check config
pm2 show perplexica

# Restart
pm2 restart perplexica
```

#### 3. Nginx 502 Bad Gateway
```bash
# Check if app is running
pm2 status

# Check Nginx config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

#### 4. Build Failed
```bash
# Check Node.js version
node --version

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Log Locations

- **Application logs**: `/var/log/perplexica/`
- **PM2 logs**: `pm2 logs perplexica`
- **Nginx logs**: `/var/log/nginx/`
- **System logs**: `journalctl -u nginx`

---

## 🔐 Security

### SSL Certificate
```bash
# Setup SSL cho domain
sudo certbot --nginx -d perplexica.trangvang.ai

# Auto-renewal
sudo crontab -e
# Thêm: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Firewall
```bash
# Check status
sudo ufw status

# Allow ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
```

### PM2 Security
```bash
# Setup PM2 key
pm2 link <secret_key> <public_key>

# Disable PM2 web interface
pm2 set pm2:autodump false
```

---

## 📈 Performance Optimization

### PM2 Clustering
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'perplexica',
    script: 'npm',
    args: 'start',
    instances: 'max', // Sử dụng tất cả CPU cores
    exec_mode: 'cluster'
  }]
}
```

### Nginx Optimization
```nginx
# Enable gzip
gzip on;
gzip_types text/plain text/css application/json application/javascript;

# Caching
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

---

## 🔄 Backup & Recovery

### Backup Script
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf "perplexica_backup_$DATE.tar.gz" /opt/Perplexica
aws s3 cp "perplexica_backup_$DATE.tar.gz" s3://your-backup-bucket/
```

### Recovery
```bash
# Download backup
aws s3 cp s3://your-backup-bucket/perplexica_backup_20240101_120000.tar.gz ./

# Extract and restore
tar -xzf perplexica_backup_20240101_120000.tar.gz
sudo cp -r opt/Perplexica /opt/
sudo chown -R ubuntu:ubuntu /opt/Perplexica
pm2 restart perplexica
```

---

## 📞 Support Commands

### Useful Commands
```bash
# Check service status
sudo systemctl status nginx
pm2 status

# View logs
pm2 logs perplexica --lines 100
sudo journalctl -u nginx -f

# Restart services
pm2 restart perplexica
sudo systemctl restart nginx

# Check resources
df -h
free -h
pm2 monit
```

### Emergency Procedures
1. **Service Down**: `pm2 restart perplexica`
2. **Nginx Down**: `sudo systemctl restart nginx`
3. **SSL Issues**: `sudo certbot renew`
4. **Disk Full**: Clean logs và old backups
5. **Memory Issues**: Restart PM2 processes

---

## 🎯 Next Steps

1. **Setup monitoring**: CloudWatch, DataDog, hoặc New Relic
2. **Implement logging**: Winston, Morgan
3. **Add alerting**: Slack, PagerDuty
4. **Performance monitoring**: APM tools
5. **Security scanning**: OWASP ZAP, Snyk
6. **Load testing**: Artillery, k6
7. **Backup automation**: Scheduled backups
8. **Disaster recovery**: Multi-region setup

---

## 📚 Documentation

- [Detailed Setup Guide](docs/NODEJS_CI_CD_SETUP.md)
- [Git Flow & CI/CD](docs/GIT_FLOW_CI_CD.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

---

**Lưu ý**: Đảm bảo thay thế các placeholder values (API keys, domains, IPs) bằng giá trị thực tế của bạn.

**Happy Deploying! 🚀**
