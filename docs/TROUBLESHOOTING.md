# Troubleshooting Guide cho Perplexica

## 📋 Tổng quan

Tài liệu này cung cấp hướng dẫn troubleshooting cho các vấn đề thường gặp trong quá trình deployment và vận hành Perplexica.

---

## 🚨 Emergency Procedures

### 1. Application Down
**Priority**: Critical
**Response Time**: 5 minutes

#### Immediate Actions
1. **Check Service Status**:
   ```bash
   ssh -i ~/.ssh/perplexica-key.pem ubuntu@<PUBLIC_IP>
   sudo systemctl status perplexica
   ```

2. **Check Docker Containers**:
   ```bash
   docker ps -a
   docker compose -f /opt/Perplexica/docker-compose.prod.yaml ps
   ```

3. **Restart Service**:
   ```bash
   sudo systemctl restart perplexica
   ```

4. **Check Logs**:
   ```bash
   docker compose -f /opt/Perplexica/docker-compose.prod.yaml logs -f
   ```

#### If Service Won't Start
1. **Check Resource Usage**:
   ```bash
   df -h
   free -h
   ```

2. **Check Configuration**:
   ```bash
   cat /opt/Perplexica/config.toml
   ```

3. **Rollback**:
   ```bash
   ./scripts/rollback.sh production
   ```

### 2. Database Corruption
**Priority**: High
**Response Time**: 15 minutes

#### Symptoms
- Database connection errors
- Application crashes on startup
- Data inconsistency

#### Recovery Steps
1. **Stop Application**:
   ```bash
   sudo systemctl stop perplexica
   ```

2. **Backup Current Database**:
   ```bash
   cp /opt/Perplexica/data/db.sqlite /opt/Perplexica/data/db.sqlite.corrupted.$(date +%Y%m%d_%H%M%S)
   ```

3. **Restore from Backup**:
   ```bash
   # Find latest backup
   ls -la /opt/Perplexica/backups/
   
   # Restore database
   cp /opt/Perplexica/backups/latest/db.sqlite /opt/Perplexica/data/db.sqlite
   ```

4. **Restart Application**:
   ```bash
   sudo systemctl start perplexica
   ```

### 3. SSL Certificate Expired
**Priority**: High
**Response Time**: 30 minutes

#### Symptoms
- HTTPS not working
- Browser security warnings
- Certificate errors

#### Recovery Steps
1. **Check Certificate Status**:
   ```bash
   sudo certbot certificates
   ```

2. **Renew Certificate**:
   ```bash
   sudo certbot renew --nginx
   ```

3. **If Renewal Fails**:
   ```bash
   sudo certbot --nginx -d perplexica.trangvang.ai --non-interactive --agree-tos -m admin@trangvang.ai
   ```

4. **Restart Nginx**:
   ```bash
   sudo systemctl restart nginx
   ```

---

## 🔍 Common Issues & Solutions

### 1. CloudFormation Stack Issues

#### Stack Creation Failed
**Error**: `CREATE_FAILED`
**Common Causes**:
- Invalid parameters
- Resource limits exceeded
- Key pair doesn't exist

**Solutions**:
```bash
# Check stack events
aws cloudformation describe-stack-events \
  --stack-name perplexica-prod \
  --region ap-southeast-1

# Check key pair
aws ec2 describe-key-pairs --key-names perplexica-key --region ap-southeast-1

# Delete failed stack
aws cloudformation delete-stack \
  --stack-name perplexica-prod \
  --region ap-southeast-1
```

#### Stack Update Failed
**Error**: `UPDATE_FAILED`
**Common Causes**:
- Resource conflicts
- Invalid parameter changes
- Dependency issues

**Solutions**:
```bash
# Cancel update
aws cloudformation cancel-update-stack \
  --stack-name perplexica-prod \
  --region ap-southeast-1

# Check current state
aws cloudformation describe-stacks \
  --stack-name perplexica-prod \
  --region ap-southeast-1
```

### 2. Docker Issues

#### Container Won't Start
**Symptoms**:
- Container exits immediately
- Application not accessible
- Port binding errors

**Diagnosis**:
```bash
# Check container logs
docker logs <container_id>

# Check container status
docker ps -a

# Check port usage
netstat -tlnp | grep :3000
```

**Solutions**:
```bash
# Restart containers
docker compose -f /opt/Perplexica/docker-compose.prod.yaml restart

# Rebuild containers
docker compose -f /opt/Perplexica/docker-compose.prod.yaml down
docker compose -f /opt/Perplexica/docker-compose.prod.yaml up -d
```

#### Image Pull Failed
**Error**: `pull access denied`
**Solutions**:
```bash
# Login to registry
docker login ghcr.io

# Pull image manually
docker pull ghcr.io/username/perplexica:latest

# Update docker-compose
sed -i 's|image: itzcrazykns1337/perplexica:main|image: ghcr.io/username/perplexica:latest|g' docker-compose.prod.yaml
```

### 3. Application Issues

#### API Not Responding
**Symptoms**:
- 502 Bad Gateway
- 503 Service Unavailable
- Timeout errors

**Diagnosis**:
```bash
# Check application health
curl -f https://perplexica.trangvang.ai/api/config

# Check internal endpoint
curl -f http://localhost:3000/api/config

# Check logs
docker compose -f /opt/Perplexica/docker-compose.prod.yaml logs app
```

**Solutions**:
```bash
# Restart application
sudo systemctl restart perplexica

# Check configuration
cat /opt/Perplexica/config.toml | grep API_KEY

# Verify API keys
curl -H "Authorization: Bearer $API_KEY" https://api.groq.com/v1/models
```

#### Search Not Working
**Symptoms**:
- Search queries return empty results
- SearxNG connection errors
- LLM API errors

**Diagnosis**:
```bash
# Check SearxNG connectivity
curl -f https://searchweb.trangvang.ai/search?q=test

# Check LLM API keys
cat /opt/Perplexica/config.toml | grep -A 5 "MODELS"

# Test LLM API
curl -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/v1/models
```

**Solutions**:
```bash
# Update config.toml
nano /opt/Perplexica/config.toml

# Restart service
sudo systemctl restart perplexica

# Check logs
docker compose -f /opt/Perplexica/docker-compose.prod.yaml logs app | grep -i error
```

### 4. Infrastructure Issues

#### High CPU Usage
**Symptoms**:
- Slow response times
- High load average
- System unresponsive

**Diagnosis**:
```bash
# Check CPU usage
top
htop

# Check load average
uptime

# Check processes
ps aux --sort=-%cpu | head -10
```

**Solutions**:
```bash
# Restart services
sudo systemctl restart perplexica

# Check for runaway processes
docker stats

# Scale up instance (if needed)
aws ec2 modify-instance-attribute \
  --instance-id <instance-id> \
  --instance-type t3.medium
```

#### High Memory Usage
**Symptoms**:
- Out of memory errors
- System swapping
- Application crashes

**Diagnosis**:
```bash
# Check memory usage
free -h
cat /proc/meminfo

# Check swap usage
swapon -s

# Check memory by process
ps aux --sort=-%mem | head -10
```

**Solutions**:
```bash
# Restart services
sudo systemctl restart perplexica

# Clear swap
sudo swapoff -a
sudo swapon -a

# Increase swap (if needed)
sudo fallocate -l 4G /swapfile2
sudo chmod 600 /swapfile2
sudo mkswap /swapfile2
sudo swapon /swapfile2
```

#### Disk Space Issues
**Symptoms**:
- Write failures
- Application errors
- System warnings

**Diagnosis**:
```bash
# Check disk usage
df -h

# Find large files
du -sh /opt/Perplexica/*

# Check Docker space
docker system df
```

**Solutions**:
```bash
# Clean Docker
docker system prune -a

# Clean logs
sudo journalctl --vacuum-time=7d

# Clean old backups
find /opt/Perplexica/backups -name "*.sqlite" -mtime +30 -delete

# Increase volume size (if needed)
aws ec2 modify-volume --volume-id <volume-id> --size 50
```

---

## 🔧 Diagnostic Commands

### System Health Check
```bash
#!/bin/bash
echo "=== System Health Check ==="
echo "Date: $(date)"
echo "Uptime: $(uptime)"
echo "Load Average: $(cat /proc/loadavg)"
echo "Memory Usage:"
free -h
echo "Disk Usage:"
df -h
echo "Docker Status:"
docker ps
echo "Service Status:"
sudo systemctl status perplexica
echo "Network Status:"
netstat -tlnp | grep -E ":(80|443|3000)"
```

### Application Health Check
```bash
#!/bin/bash
echo "=== Application Health Check ==="
echo "API Config:"
curl -s https://perplexica.trangvang.ai/api/config | jq .
echo "API Models:"
curl -s https://perplexica.trangvang.ai/api/models | jq .
echo "Docker Logs (last 50 lines):"
docker compose -f /opt/Perplexica/docker-compose.prod.yaml logs --tail=50
```

### Network Connectivity Check
```bash
#!/bin/bash
echo "=== Network Connectivity Check ==="
echo "DNS Resolution:"
nslookup perplexica.trangvang.ai
echo "HTTPS Connectivity:"
curl -I https://perplexica.trangvang.ai
echo "SearxNG Connectivity:"
curl -I https://searchweb.trangvang.ai
echo "LLM API Connectivity:"
curl -I https://api.groq.com/v1/models
```

---

## 📊 Monitoring & Alerting

### Health Check Script
```bash
#!/bin/bash
# Health check script for monitoring

ENDPOINT="https://perplexica.trangvang.ai/api/config"
TIMEOUT=30

if curl -f -s --max-time $TIMEOUT "$ENDPOINT" > /dev/null; then
    echo "✅ Health check passed"
    exit 0
else
    echo "❌ Health check failed"
    exit 1
fi
```

### Log Monitoring
```bash
# Monitor application logs
tail -f /opt/Perplexica/logs/app.log | grep -i error

# Monitor system logs
sudo journalctl -f -u perplexica

# Monitor Docker logs
docker compose -f /opt/Perplexica/docker-compose.prod.yaml logs -f
```

### Performance Monitoring
```bash
# Monitor resource usage
watch -n 5 'echo "CPU:"; top -bn1 | grep "Cpu(s)"; echo "Memory:"; free -h; echo "Disk:"; df -h'

# Monitor Docker stats
docker stats --no-stream

# Monitor network connections
netstat -tuln | grep -E ":(80|443|3000)"
```

---

## 🚨 Emergency Contacts

### Escalation Matrix
1. **Level 1**: DevOps Team (0-15 minutes)
2. **Level 2**: Development Team (15-30 minutes)
3. **Level 3**: Technical Lead (30+ minutes)

### Communication Channels
- **Slack**: #perplexica-alerts
- **Email**: alerts@trangvang.ai
- **Phone**: Emergency contact list

### Post-Incident Process
1. **Immediate**: Fix the issue
2. **Within 1 hour**: Document the incident
3. **Within 24 hours**: Post-mortem meeting
4. **Within 1 week**: Implement preventive measures

---

## 📝 Incident Response Checklist

### Initial Response (0-5 minutes)
- [ ] Acknowledge the alert
- [ ] Assess the severity
- [ ] Notify the team
- [ ] Start investigation

### Investigation (5-30 minutes)
- [ ] Check system health
- [ ] Review recent changes
- [ ] Check logs
- [ ] Identify root cause

### Resolution (30+ minutes)
- [ ] Implement fix
- [ ] Verify resolution
- [ ] Monitor stability
- [ ] Document incident

### Post-Incident (24+ hours)
- [ ] Conduct post-mortem
- [ ] Update documentation
- [ ] Implement improvements
- [ ] Share lessons learned
