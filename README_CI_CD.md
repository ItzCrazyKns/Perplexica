# Perplexica CI/CD Setup

## 🚀 Tổng quan

Repository này đã được cấu hình với Git Flow và CI/CD pipeline hoàn chỉnh để deploy Perplexica lên AWS EC2.

---

## 📁 Cấu trúc CI/CD

```
.github/
├── workflows/
│   ├── ci.yml              # Continuous Integration
│   ├── deploy.yml          # Deployment workflows
│   └── security-scan.yml   # Security scanning
├── ISSUE_TEMPLATE/
│   ├── bug_report.md
│   └── feature_request.md
└── pull_request_template.md

scripts/
├── deploy.sh              # Deployment script
├── health-check.sh        # Health monitoring
└── rollback.sh            # Rollback procedures

docs/
├── GIT_FLOW_CI_CD.md      # Git Flow & CI/CD strategy
├── DEPLOYMENT_GUIDE.md    # Deployment procedures
└── TROUBLESHOOTING.md     # Troubleshooting guide
```

---

## 🌿 Git Flow Strategy

### Branch Structure
- `main` - Production-ready code
- `develop` - Integration branch
- `feature/*` - Feature development
- `hotfix/*` - Urgent fixes
- `release/*` - Release preparation

### Workflow
1. **Feature Development**: `feature/TICKET-123-description`
2. **Code Review**: Pull Request to `develop`
3. **Staging Deploy**: Auto-deploy from `develop`
4. **Release**: Create `release/vX.X.X` branch
5. **Production Deploy**: Manual approval from `main`

---

## 🔄 CI/CD Pipeline

### Continuous Integration
- **Linting & Type Checking**: ESLint, TypeScript, Prettier
- **Testing**: Unit tests with coverage
- **Security Scanning**: Trivy, npm audit, Snyk
- **Docker Build**: Multi-stage build with caching

### Continuous Deployment
- **Staging**: Auto-deploy on `develop` branch push
- **Production**: Manual approval required
- **Health Checks**: Automated verification
- **Rollback**: Automated rollback procedures

---

## 🌍 Environments

### Staging
- **URL**: `https://staging.perplexica.trangvang.ai`
- **Stack**: `perplexica-staging`
- **Instance**: `t3.small` (20GB)
- **Auto-deploy**: Yes

### Production
- **URL**: `https://perplexica.trangvang.ai`
- **Stack**: `perplexica-prod`
- **Instance**: `t3.small` (30GB)
- **Auto-deploy**: Manual approval

---

## 🛠 Quick Start

### 1. Setup GitHub Secrets
Cấu hình các secrets sau trong GitHub repository:

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
GROQ_API_KEY
GEMINI_API_KEY
CUSTOM_OPENAI_API_KEY
SLACK_WEBHOOK_URL (optional)
```

### 2. Deploy Staging
```bash
# Push to develop branch
git checkout develop
git push origin develop

# Or manual deployment
./scripts/deploy.sh staging
```

### 3. Deploy Production
```bash
# Via GitHub Actions (recommended)
# Go to Actions > Deploy to Production > Run workflow

# Or manual deployment
./scripts/deploy.sh production
```

### 4. Health Check
```bash
# Check staging
./scripts/health-check.sh staging

# Check production
./scripts/health-check.sh production
```

---

## 🔧 Manual Operations

### Deployment
```bash
# Deploy to specific environment
./scripts/deploy.sh [staging|production]

# Deploy with specific version
git checkout <version>
./scripts/deploy.sh production
```

### Health Monitoring
```bash
# Comprehensive health check
./scripts/health-check.sh [staging|production]

# Quick status check
curl -f https://perplexica.trangvang.ai/api/config
```

### Rollback
```bash
# Rollback to previous state
./scripts/rollback.sh [staging|production]

# Rollback to specific version
./scripts/rollback.sh production abc1234
```

---

## 📊 Monitoring & Alerting

### Health Checks
- **Application**: `/api/config`, `/api/models`
- **Infrastructure**: CPU, Memory, Disk, Network
- **Services**: Docker containers, systemd services

### Alerting
- **Slack**: Deployment notifications, error alerts
- **GitHub**: Security alerts, dependency updates
- **AWS**: CloudWatch alarms, CloudFormation events

### Logs
- **Application**: Docker container logs
- **System**: systemd journal, user-data logs
- **Infrastructure**: CloudFormation events, CloudWatch logs

---

## 🔒 Security

### Secrets Management
- All sensitive data in GitHub Secrets
- No hardcoded credentials
- Regular key rotation

### Security Scanning
- **Code**: TruffleHog for secrets detection
- **Dependencies**: npm audit, Snyk
- **Containers**: Trivy vulnerability scanning
- **Infrastructure**: AWS security best practices

### Access Control
- SSH key-based authentication
- Limited network access
- Branch protection rules
- Required code reviews

---

## 📚 Documentation

### Deployment Guides
- [Git Flow & CI/CD Strategy](docs/GIT_FLOW_CI_CD.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md)

### API Documentation
- [Search API](docs/API/SEARCH.md)
- [Architecture Overview](docs/architecture/README.md)

---

## 🚨 Emergency Procedures

### Application Down
1. Check service status: `sudo systemctl status perplexica`
2. Restart service: `sudo systemctl restart perplexica`
3. Check logs: `docker compose logs -f`
4. Rollback if needed: `./scripts/rollback.sh production`

### Database Issues
1. Stop application: `sudo systemctl stop perplexica`
2. Backup database: `cp /opt/Perplexica/data/db.sqlite /opt/Perplexica/data/db.sqlite.backup`
3. Restore from backup: `cp /opt/Perplexica/backups/latest/db.sqlite /opt/Perplexica/data/db.sqlite`
4. Restart application: `sudo systemctl start perplexica`

### SSL Certificate Issues
1. Check certificate: `sudo certbot certificates`
2. Renew certificate: `sudo certbot renew --nginx`
3. Restart nginx: `sudo systemctl restart nginx`

---

## 📞 Support

### Team Contacts
- **DevOps**: devops@trangvang.ai
- **Development**: dev@trangvang.ai
- **Emergency**: +84-xxx-xxx-xxxx

### Communication Channels
- **Slack**: #perplexica-deployments
- **GitHub**: Issues & Discussions
- **Email**: alerts@trangvang.ai

---

## 🔄 Maintenance

### Daily Tasks
- [ ] Monitor application health
- [ ] Check error rates
- [ ] Review deployment logs

### Weekly Tasks
- [ ] Security updates
- [ ] Dependency updates
- [ ] Backup verification

### Monthly Tasks
- [ ] Infrastructure review
- [ ] Cost optimization
- [ ] Security audit

---

## 📈 Performance Optimization

### Current Configuration
- **Instance**: t3.small (2 vCPU, 2GB RAM)
- **Storage**: 30GB GP3 EBS
- **Network**: Elastic IP with HTTPS
- **Caching**: Docker layer caching, npm cache

### Scaling Options
- **Vertical**: Upgrade to t3.medium/t3.large
- **Horizontal**: Load balancer with multiple instances
- **Storage**: Increase EBS volume size
- **CDN**: CloudFront for static assets

---

## 🎯 Future Improvements

### Planned Enhancements
- [ ] Blue-green deployments
- [ ] Canary releases
- [ ] Automated testing in staging
- [ ] Performance monitoring dashboard
- [ ] Cost optimization automation

### Technology Updates
- [ ] Container orchestration (ECS/EKS)
- [ ] Infrastructure as Code improvements
- [ ] Advanced monitoring (Prometheus/Grafana)
- [ ] Automated security scanning

---

## 📝 Changelog

### v1.0.0 - Initial CI/CD Setup
- ✅ Git Flow implementation
- ✅ GitHub Actions workflows
- ✅ Automated deployment scripts
- ✅ Health monitoring
- ✅ Rollback procedures
- ✅ Security scanning
- ✅ Documentation

---

## 🤝 Contributing

### Development Process
1. Create feature branch from `develop`
2. Implement changes with tests
3. Create Pull Request
4. Code review and approval
5. Merge to `develop`
6. Deploy to staging
7. Create release branch
8. Deploy to production

### Code Standards
- ESLint configuration
- TypeScript strict mode
- Prettier formatting
- Unit test coverage
- Security best practices

---

**Happy Deploying! 🚀**
