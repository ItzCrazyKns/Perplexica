# Quick Start: Perplexica with Google Custom Search (Docker)

## TL;DR - Get Running in 5 Minutes

```bash
# 1. Configure
cp sample.config.toml config.toml
# Edit config.toml - add your API keys

# 2. Build and run
docker compose up -d

# 3. Access
open http://localhost:3000
```

## Detailed Steps

### Step 1: Prepare config.toml

```bash
cp sample.config.toml config.toml
```

Edit `config.toml` and set:

```toml
[SEARCH]
PROVIDER = "google_custom_search"

[SEARCH.GOOGLE_CUSTOM_SEARCH]
API_KEY = "YOUR_GOOGLE_CUSTOM_SEARCH_API_KEY"
CX = "YOUR_SEARCH_ENGINE_ID"

[MODELS.GEMINI]
API_KEY = "YOUR_GEMINI_API_KEY"
```

### Step 2: Build Docker Image

```bash
# Using docker compose (builds automatically)
docker compose build

# Or build manually
docker build -t perplexica-google-search -f app.dockerfile .
```

### Step 3: Run

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f app

# Check status
docker compose ps
```

### Step 4: Use

- **Web UI**: http://localhost:3000
- **API**: http://localhost:3000/api/search

## What Gets Built

The Docker image includes:
- ✅ Node.js application with all dependencies
- ✅ Google Custom Search provider
- ✅ Gemini AI integration
- ✅ Database migrations
- ✅ All search agents (web, image, video)

## Container Structure

```
/home/perplexica/
├── config.toml          # Your configuration (mounted)
├── data/                # SQLite database (volume)
├── uploads/             # User uploaded files (volume)
└── [app files]          # Built Next.js app
```

## Common Commands

```bash
# Stop services
docker compose stop

# Start services
docker compose start

# Restart after config changes
docker compose restart app

# Remove everything (fresh start)
docker compose down
docker volume prune  # Remove data (optional)

# View logs (follow mode)
docker compose logs -f app

# View last 100 lines
docker compose logs --tail=100 app

# Execute commands inside container
docker compose exec app sh

# Rebuild without cache
docker compose build --no-cache app
```

## Environment Variables Alternative

Instead of editing `config.toml`, you can set environment variables in `docker-compose.yaml`:

```yaml
services:
  app:
    environment:
      - SEARCH_PROVIDER=google_custom_search
      - GOOGLE_SEARCH_API_KEY=your_key_here
      - GOOGLE_SEARCH_CX=your_cx_here
      - GEMINI_API_KEY=your_key_here
```

**But**: Using `config.toml` is recommended as it's the standard Perplexica configuration method.

## Production Deployment

### Remove SearxNG (Not Needed)

Since you're using Google Custom Search, you can remove the SearxNG service:

Edit `docker-compose.yaml`:
```yaml
# Comment out or delete the searxng service
# searxng:
#   image: docker.io/searxng/searxng:latest
#   ...
```

### Minimal docker-compose.yaml

Create `docker-compose.prod.yaml`:

```yaml
services:
  app:
    image: perplexica-google-search
    build:
      context: .
      dockerfile: app.dockerfile
    ports:
      - "3000:3000"
    volumes:
      - backend-data:/home/perplexica/data
      - uploads:/home/perplexica/uploads
      - ./config.toml:/home/perplexica/config.toml:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/config"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  backend-data:
  uploads:
```

Run production:
```bash
docker compose -f docker-compose.prod.yaml up -d
```

### Behind a Reverse Proxy

Example with nginx:

```nginx
server {
    listen 80;
    server_name search.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Troubleshooting

### Port 3000 already in use
```bash
# Check what's using the port
lsof -ti:3000

# Kill by port (Mac/Linux)
lsof -ti:3000 | xargs kill -9

# Or change port in docker-compose.yaml
ports:
  - "8080:3000"  # Access via http://localhost:8080
```

### Container won't start
```bash
# Check logs
docker compose logs app

# Common issues:
# 1. config.toml missing - create it
# 2. Invalid API keys - check config.toml
# 3. Port conflict - change port or kill process
```

### Config changes not applied
```bash
# Restart container
docker compose restart app

# Or rebuild
docker compose down
docker compose up -d
```

### Can't access from other machines
```bash
# The app binds to 0.0.0.0 inside container
# Make sure your firewall allows port 3000
# Or use nginx/reverse proxy
```

## File Locations

### On Host
```
/path/to/Perplexica/
├── config.toml              # Configuration
├── docker-compose.yaml      # Docker setup
├── app.dockerfile           # Build instructions
└── [source code]
```

### In Container
```
/home/perplexica/
├── config.toml              # Mounted from host
├── data/                    # Volume: backend-dbstore
│   └── perplexica.db       # SQLite database
└── uploads/                 # Volume: uploads
    └── [user files]
```

## Health Checks

```bash
# Check if container is healthy
docker compose ps

# Manual health check
curl http://localhost:3000/api/config

# Check logs for errors
docker compose logs app | grep -i error
```

## Backup

```bash
# Backup database and uploads
docker run --rm \
  -v perplexica_backend-dbstore:/data \
  -v perplexica_uploads:/uploads \
  -v $(pwd):/backup \
  alpine tar czf /backup/perplexica-backup.tar.gz /data /uploads

# Restore
docker run --rm \
  -v perplexica_backend-dbstore:/data \
  -v perplexica_uploads:/uploads \
  -v $(pwd):/backup \
  alpine tar xzf /backup/perplexica-backup.tar.gz
```

## Updating

```bash
# Pull latest code
git pull origin master

# Rebuild image
docker compose build --no-cache app

# Restart
docker compose up -d

# Check logs
docker compose logs -f app
```

## Resource Limits

Add to `docker-compose.yaml` if needed:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

## Complete Example

Here's a complete working setup:

1. **config.toml**:
   ```toml
   [GENERAL]
   SIMILARITY_MEASURE = "cosine"
   KEEP_ALIVE = "5m"

   [SEARCH]
   PROVIDER = "google_custom_search"

   [SEARCH.GOOGLE_CUSTOM_SEARCH]
   API_KEY = "AIzaSy..."
   CX = "36d084..."

   [MODELS.GEMINI]
   API_KEY = "AIzaSy..."
   ```

2. **Build & Run**:
   ```bash
   docker compose up -d
   ```

3. **Access**:
   - Open http://localhost:3000
   - Ask: "What is machine learning?"
   - Get AI-powered answer with sources!

That's it! 🎉
