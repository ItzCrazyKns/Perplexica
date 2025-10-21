# Deployment Guide cho Perplexica

## 📋 Tổng quan

Tài liệu này hướng dẫn chi tiết quy trình deployment cho Perplexica trên môi trường production và staging.

---

## 🌍 Môi trường

### Production Environment
- **URL**: `https://perplexica.trangvang.ai`
- **Stack Name**: `perplexica-prod`
- **Instance Type**: `t3.small`
- **Volume Size**: `30GB`
- **Domain**: `perplexica.trangvang.ai`

### Staging Environment
- **URL**: `https://staging.perplexica.trangvang.ai`
- **Stack Name**: `perplexica-staging`
- **Instance Type**: `t3.small`
- **Volume Size**: `20GB`
- **Domain**: `staging.perplexica.trangvang.ai`

---

## 🚀 Deployment Methods

### 1. Automated Deployment (GitHub Actions)

#### Staging Deployment
- **Trigger**: Push to `develop` branch
- **Workflow**: `.github/workflows/deploy.yml`
- **Approval**: Automatic

#### Production Deployment
- **Trigger**: Manual workflow dispatch
- **Workflow**: `.github/workflows/deploy.yml`
- **Approval**: Required (GitHub Environment protection)

### 2. Manual Deployment

#### Sử dụng script deployment
```bash
# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production
./scripts/deploy.sh production
```

#### Sử dụng CloudFormation trực tiếp
```bash
# Staging
aws cloudformation create-stack \
  --stack-name perplexica-staging \
  --template-body file://cloudformation-templates/perplexica-ec2-stack.yaml \
  --parameters \
    ParameterKey=KeyName,ParameterValue=perplexica-key \
    ParameterKey=InstanceType,ParameterValue=t3.small \
    ParameterKey=VolumeSize,ParameterValue=20 \
    ParameterKey=SSHLocation,ParameterValue=0.0.0.0/0 \
    ParameterKey=AllocateElasticIP,ParameterValue=true \
    ParameterKey=DomainName,ParameterValue=staging.perplexica.trangvang.ai \
    ParameterKey=EmailAddress,ParameterValue=admin@trangvang.ai \
  --region ap-southeast-1 \
  --capabilities CAPABILITY_IAM

# Production
aws cloudformation create-stack \
  --stack-name perplexica-prod \
  --template-body file://cloudformation-templates/perplexica-ec2-stack.yaml \
  --parameters \
    ParameterKey=KeyName,ParameterValue=perplexica-key \
    ParameterKey=InstanceType,ParameterValue=t3.small \
    ParameterKey=VolumeSize,ParameterValue=30 \
    ParameterKey=SSHLocation,ParameterValue=0.0.0.0/0 \
    ParameterKey=AllocateElasticIP,ParameterValue=true \
    ParameterKey=DomainName,ParameterValue=perplexica.trangvang.ai \
    ParameterKey=EmailAddress,ParameterValue=admin@trangvang.ai \
  --region ap-southeast-1 \
  --capabilities CAPABILITY_IAM
```

---

## 🔧 Pre-deployment Checklist

### Required Secrets
Đảm bảo các secrets sau đã được cấu hình trong GitHub:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `CUSTOM_OPENAI_API_KEY`
- `SLACK_WEBHOOK_URL` (optional)

### Infrastructure Requirements
- [ ] EC2 Key Pair `perplexica-key` exists in AWS
- [ ] Domain DNS records point to correct IP
- [ ] SSL certificates are valid
- [ ] Security groups allow required traffic

### Application Requirements
- [ ] LLM API keys are valid and have sufficient quota
- [ ] SearxNG service is accessible
- [ ] Database migrations are tested
- [ ] Configuration files are updated

---

## 📋 Deployment Process

### Step 1: Code Preparation
1. **Feature Development**:
   - Create feature branch from `develop`
   - Implement changes with tests
   - Create Pull Request to `develop`

2. **Code Review**:
   - Review code changes
   - Run automated tests
   - Approve and merge to `develop`

3. **Staging Deployment**:
   - Automatic deployment to staging
   - Run integration tests
   - Verify functionality

### Step 2: Release Preparation
1. **Create Release Branch**:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b release/v1.2.0
   git push origin release/v1.2.0
   ```

2. **Final Testing**:
   - Test on staging environment
   - Fix any issues
   - Update version numbers

3. **Merge to Main**:
   ```bash
   git checkout main
   git pull origin main
   git merge release/v1.2.0
   git tag v1.2.0
   git push origin main --tags
   ```

### Step 3: Production Deployment
1. **Manual Trigger**:
   - Go to GitHub Actions
   - Select "Deploy to Production" workflow
   - Click "Run workflow"
   - Select production environment

2. **Monitor Deployment**:
   - Watch CloudFormation stack events
   - Monitor application logs
   - Verify health checks

3. **Post-deployment Verification**:
   - Test critical functionality
   - Monitor error rates
   - Check performance metrics

---

## 🔍 Health Checks

### Automated Health Checks
```bash
# Check staging
./scripts/health-check.sh staging

# Check production
./scripts/health-check.sh production
```

### Manual Health Checks
1. **HTTP Endpoints**:
   ```bash
   curl -f https://perplexica.trangvang.ai/api/config
   curl -f https://perplexica.trangvang.ai/api/models
   ```

2. **Service Status**:
   ```bash
   ssh -i ~/.ssh/perplexica-key.pem ubuntu@<PUBLIC_IP>
   sudo systemctl status perplexica
   docker compose -f /opt/Perplexica/docker-compose.prod.yaml ps
   ```

3. **Resource Usage**:
   ```bash
   df -h
   free -h
   docker stats
   ```

---

## 🚨 Rollback Procedures

### Automated Rollback
```bash
# Rollback staging
./scripts/rollback.sh staging

# Rollback production
./scripts/rollback.sh production abc1234
```

### Manual Rollback
1. **CloudFormation Rollback**:
   ```bash
   aws cloudformation cancel-update-stack \
     --stack-name perplexica-prod \
     --region ap-southeast-1
   ```

2. **Docker Image Rollback**:
   ```bash
   ssh -i ~/.ssh/perplexica-key.pem ubuntu@<PUBLIC_IP>
   cd /opt/Perplexica
   git checkout <previous-commit>
   docker compose -f docker-compose.prod.yaml down
   docker compose -f docker-compose.prod.yaml up -d
   ```

---

## 📊 Monitoring & Alerting

### Application Monitoring
- **Health Endpoints**: `/api/config`, `/api/models`
- **Error Tracking**: Application logs
- **Performance**: Response times, throughput

### Infrastructure Monitoring
- **AWS CloudWatch**: EC2 metrics, CloudFormation events
- **System Metrics**: CPU, Memory, Disk usage
- **Docker Metrics**: Container health, resource usage

### Alerting Channels
- **Slack**: Deployment notifications, error alerts
- **Email**: Critical issues, security alerts
- **SMS**: Emergency situations (if configured)

---

## 🔒 Security Considerations

### Secrets Management
- All API keys stored in GitHub Secrets
- No hardcoded credentials in code
- Regular rotation of access keys

### Access Control
- SSH key-based authentication
- Limited SSH access (specific IP ranges)
- Regular security updates

### Network Security
- HTTPS enforced for all traffic
- Security groups restrict access
- Regular security scanning

---

## 📚 Troubleshooting

### Common Issues

#### 1. Deployment Fails
**Symptoms**: CloudFormation stack fails to create/update
**Solutions**:
- Check AWS credentials
- Verify key pair exists
- Check resource limits
- Review CloudFormation events

#### 2. Application Not Responding
**Symptoms**: Health checks fail, 502/503 errors
**Solutions**:
- Check Docker containers: `docker ps`
- Check service status: `sudo systemctl status perplexica`
- Check logs: `docker compose logs -f`
- Restart service: `sudo systemctl restart perplexica`

#### 3. SSL Certificate Issues
**Symptoms**: HTTPS not working, certificate errors
**Solutions**:
- Check DNS records
- Verify domain ownership
- Run Certbot manually: `sudo certbot --nginx -d domain.com`
- Check certificate expiry

#### 4. Database Issues
**Symptoms**: Database connection errors
**Solutions**:
- Check database file permissions
- Verify database migrations
- Check disk space
- Restore from backup if needed

### Log Locations
- **Application Logs**: `docker compose logs -f`
- **System Logs**: `/var/log/syslog`
- **CloudFormation Logs**: AWS Console
- **User Data Logs**: `/var/log/user-data.log`

---

## 📞 Support Contacts

### Emergency Contacts
- **Primary**: DevOps Team
- **Secondary**: Development Team
- **Escalation**: Technical Lead

### Communication Channels
- **Slack**: #perplexica-deployments
- **Email**: devops@trangvang.ai
- **Phone**: Emergency contact list

---

## 📝 Maintenance Tasks

### Daily
- [ ] Check application health
- [ ] Monitor error rates
- [ ] Review deployment logs

### Weekly
- [ ] Security updates
- [ ] Dependency updates
- [ ] Backup verification
- [ ] Performance review

### Monthly
- [ ] Infrastructure review
- [ ] Cost optimization
- [ ] Security audit
- [ ] Disaster recovery test

### Quarterly
- [ ] Architecture review
- [ ] Technology stack update
- [ ] Capacity planning
- [ ] Documentation update
