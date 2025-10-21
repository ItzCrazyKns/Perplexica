# Git Flow và CI/CD Pipeline cho Perplexica

## 📋 Tổng quan môi trường hiện tại

### Cấu trúc hệ thống
- **Production Domain**: `perplexica.trangvang.ai`
- **SearxNG Service**: `https://searchweb.trangvang.ai`
- **Infrastructure**: AWS EC2 t3.small + CloudFormation
- **Container**: Docker Compose với Nginx reverse proxy
- **LLM APIs**: Gemini, Custom OpenAI (Z.AI), Groq

### Các file deployment hiện có
- `cloudformation-templates/perplexica-ec2-stack.yaml` - Infrastructure as Code
- `docker-compose.prod.yaml` - Production container setup
- `deploy-ec2-quick.sh` - Manual deployment script
- `config.toml` - LLM API configuration

---

## 🌿 Git Flow Strategy

### Branch Structure
```
main (production)
├── develop (integration)
├── feature/* (new features)
├── hotfix/* (urgent fixes)
└── release/* (release preparation)
```

### Branch Naming Convention
- `feature/TICKET-123-description` - Feature development
- `hotfix/TICKET-456-critical-fix` - Urgent production fixes
- `release/v1.2.0` - Release preparation
- `develop` - Integration branch
- `main` - Production-ready code

### Workflow Process
1. **Feature Development**:
   - Tạo branch từ `develop`
   - Develop và test locally
   - Push và tạo Pull Request
   - Code review và merge vào `develop`

2. **Release Process**:
   - Tạo `release/vX.X.X` từ `develop`
   - Final testing và bug fixes
   - Merge vào `main` và tag version
   - Deploy to production

3. **Hotfix Process**:
   - Tạo `hotfix/TICKET-XXX` từ `main`
   - Fix và test
   - Merge vào `main` và `develop`
   - Immediate production deployment

---

## 🔄 CI/CD Pipeline Design

### Pipeline Stages

#### 1. **Build Stage**
- Install dependencies
- Run linting và type checking
- Build Docker image
- Run unit tests

#### 2. **Test Stage**
- Integration tests
- Security scanning
- Performance tests

#### 3. **Deploy Stage**
- **Staging**: Auto-deploy từ `develop` branch
- **Production**: Manual approval từ `main` branch

### Environment Strategy

#### Development Environment
- **Branch**: `develop`
- **URL**: `dev.perplexica.trangvang.ai`
- **Purpose**: Integration testing, feature testing
- **Auto-deploy**: Yes (on push to develop)

#### Staging Environment
- **Branch**: `release/*`
- **URL**: `staging.perplexica.trangvang.ai`
- **Purpose**: Pre-production testing
- **Auto-deploy**: Yes (on release branch creation)

#### Production Environment
- **Branch**: `main`
- **URL**: `perplexica.trangvang.ai`
- **Purpose**: Live production
- **Auto-deploy**: Manual approval required

---

## 🛠 Implementation Plan

### Phase 1: GitHub Actions Setup
1. Create `.github/workflows/` directory
2. Setup CI pipeline for testing và building
3. Configure environment secrets
4. Setup branch protection rules

### Phase 2: Environment Configuration
1. Setup staging environment
2. Configure domain routing
3. Setup SSL certificates
4. Configure monitoring

### Phase 3: Deployment Automation
1. Automated staging deployment
2. Production deployment with approval
3. Rollback mechanisms
4. Health checks

### Phase 4: Monitoring & Alerting
1. Application monitoring
2. Infrastructure monitoring
3. Error tracking
4. Performance metrics

---

## 📁 File Structure cho CI/CD

```
.github/
├── workflows/
│   ├── ci.yml              # Continuous Integration
│   ├── deploy-staging.yml  # Staging deployment
│   ├── deploy-production.yml # Production deployment
│   └── security-scan.yml   # Security scanning
├── ISSUE_TEMPLATE/
│   ├── bug_report.md
│   └── feature_request.md
└── PULL_REQUEST_TEMPLATE.md

docs/
├── GIT_FLOW_CI_CD.md       # This document
├── DEPLOYMENT_GUIDE.md     # Deployment procedures
└── TROUBLESHOOTING.md      # Common issues

scripts/
├── deploy.sh              # Deployment script
├── rollback.sh            # Rollback script
└── health-check.sh        # Health monitoring
```

---

## 🔐 Security Considerations

### Secrets Management
- AWS credentials
- LLM API keys
- Database credentials
- SSL certificates

### Access Control
- Branch protection rules
- Required reviews
- Status checks
- Deployment permissions

### Security Scanning
- Dependency vulnerability scanning
- Container image scanning
- Code security analysis
- Infrastructure security checks

---

## 📊 Monitoring & Observability

### Application Metrics
- Response time
- Error rates
- User activity
- Search performance

### Infrastructure Metrics
- CPU/Memory usage
- Disk space
- Network traffic
- Container health

### Alerting
- Slack notifications
- Email alerts
- SMS for critical issues
- Dashboard monitoring

---

## 🚀 Next Steps

1. **Setup GitHub Actions workflows**
2. **Configure environment secrets**
3. **Create staging environment**
4. **Setup monitoring tools**
5. **Document deployment procedures**
6. **Train team on Git Flow process**

---

## 📞 Support & Maintenance

### Regular Tasks
- Weekly dependency updates
- Monthly security patches
- Quarterly infrastructure review
- Annual disaster recovery testing

### Emergency Procedures
- Incident response plan
- Rollback procedures
- Communication protocols
- Post-mortem process
