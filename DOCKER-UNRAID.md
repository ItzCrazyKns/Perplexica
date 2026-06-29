# Vane Docker Setup for Unraid

This guide explains how to set up Vane as a Docker container on your Unraid server.

## Quick Start

### Method 1: Using the Pre-built Image (Recommended)

1. **Create appdata directory:**
   ```bash
   mkdir -p /mnt/user/appdata/vane/data
   ```

2. **Create a Docker Compose file** at `/mnt/user/appdata/vane/docker-compose.yaml` with the following content:

   ```yaml
   version: '3.8'
   
   services:
     vane:
       image: itzcrazykns1337/vane:latest
       container_name: vane
       ports:
         - '3000:3000'
         - '8080:8080'
       volumes:
         - /mnt/user/appdata/vane/data:/home/vane/data
       environment:
         - TZ=UTC
       restart: unless-stopped
   ```

3. **Start the container:**
   ```bash
   cd /mnt/user/appdata/vane
   docker compose up -d
   ```

4. **Access Vane:**
   Open your browser and navigate to `http://<your-unraid-ip>:3000`

### Method 2: Building from Source (For Development)

If you want to use your fork with custom changes:

1. **Copy your Vane fork** to your Unraid server (e.g., `/mnt/user/docker/vane`)

2. **Use the provided `docker-compose.unraid.yaml`** file from this repo

3. **Build and start:**
   ```bash
   cd /mnt/user/docker/vane
   docker compose -f docker-compose.unraid.yaml up -d --build
   ```

## Configuration

### Ports
- **3000** - Vane web interface
- **8080** - SearxNG search engine (bundled)

### Volumes
- `/home/vane/data` - Contains:
  - SQLite database (`db.sqlite`)
  - Uploaded files
  - Configuration (after initial setup)
  - Search history

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SEARXNG_API_URL` | Custom SearxNG URL | `http://localhost:8080` |
| `TZ` | Timezone | UTC |

### Using External SearxNG

If you already have SearxNG running elsewhere:

```yaml
services:
  vane:
    image: itzcrazykns1337/vane:slim-latest
    environment:
      - SEARXNG_API_URL=http://your-searxng-ip:8080
    # ... rest of config
```

**Important:** Your SearxNG instance must have:
- JSON format enabled in settings
- Wolfram Alpha search engine enabled

## Unraid GUI Setup

Alternatively, you can use Unraid's web GUI:

1. Go to **Docker** tab
2. Click **Add Container**
3. Configure as follows:
   - **Name:** vane
   - **Repository:** itzcrazykns1337/vane
   - **Tag:** latest
   - **Network Type:** Bridge
   - **Ports:**
     - Container Port: 3000, Host Port: 3000
     - Container Port: 8080, Host Port: 8080
   - **Volume Mappings:**
     - Container: `/home/vane/data`, Host: `/mnt/user/appdata/vane/data`
   - **Environment Variables:**
     - `TZ=UTC` (or your timezone)

## Accessing Vane

After starting the container:
- **Web UI:** `http://<unraid-ip>:3000`
- **Initial Setup:** You'll be guided through configuration on first launch

## Updating

To update to the latest version:

```bash
cd /mnt/user/appdata/vane
# If using pre-built image
docker compose pull
docker compose up -d

# If building from source
docker compose -f docker-compose.unraid.yaml up -d --build
```

## Troubleshooting

### Ollama Connection (for local LLMs)

If using Ollama on the same server:
- **Linux (Unraid):** Use `http://<host-ip>:11434` where `<host-ip>` is your Unraid server's LAN IP
- Ensure Ollama is configured with `OLLAMA_HOST=0.0.0.0:11434`

### Permissions Issues

If you see permission errors with the data volume:
```bash
chmod -R 1000:1000 /mnt/user/appdata/vane/data
```

### Build Failures

If building from source fails:
- Ensure you have enough RAM allocated to Docker (minimum 4GB recommended)
- Check disk space in `/mnt/user/docker/`
- Try `docker system prune` to clean up old images

## Resource Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 2GB | 4GB+ (for building) |
| Storage | 500MB | 2GB+ |
