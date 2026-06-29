# Running Vane Spaces on Unraid

This guide explains how to run your Vane Spaces fork alongside the original Vane instance for testing.

## Quick Start

Your fork will run on **port 3001** (instead of 3000) to avoid conflicts with the original Vane.

### 1. Copy your fork to Unraid

```bash
# On your local machine, clone your fork
git clone https://github.com/your-username/Vane.git vane-spaces

# Copy to Unraid (via SCP, rsync, or shared folder)
# Place it at: /mnt/user/docker/vane-spaces/
```

### 2. Create appdata directory

```bash
mkdir -p /mnt/user/appdata/vane-spaces/data
```

### 3. Start vane-spaces

```bash
cd /mnt/user/docker/vane-spaces
docker compose -f docker-compose.spaces.yaml up -d --build
```

### 4. Access vane-spaces

Open your browser and navigate to: `http://<unraid-ip>:3001`

## Usage

### Accessing both instances
- **Original Vane:** `http://<unraid-ip>:3000`
- **Vane Spaces:** `http://<unraid-ip>:3001`

### Updating vane-spaces

When you make changes to your fork:

```bash
cd /mnt/user/docker/vane-spaces

# Pull the latest changes from your fork
git pull origin feature/spaces  # or your branch

# Rebuild and restart
docker compose -f docker-compose.spaces.yaml up -d --build
```

### Stopping vane-spaces

```bash
cd /mnt/user/docker/vane-spaces
docker compose -f docker-compose.spaces.yaml down
```

### Starting again

```bash
cd /mnt/user/docker/vane-spaces
docker compose -f docker-compose.spaces.yaml up -d
```

## Configuration

### Ports
- **3001** → Vane web interface (container port 3000)
- **8081** → SearxNG search engine (container port 8080)

### Volumes
- `/mnt/user/appdata/vane-spaces/data` → `/home/vane/data`
  - Contains SQLite database, uploads, search history
  - Separate from original Vane's data

### Using external SearxNG

If you want vane-spaces to use the original Vane's SearxNG (port 8080):

Edit `docker-compose.spaces.yaml` and uncomment:
```yaml
environment:
  - SEARXNG_API_URL=http://<unraid-ip>:8080
```

Or use the original container name as hostname:
```yaml
environment:
  - SEARXNG_API_URL=http://vane:8080
```

(Requires both containers on the same Docker network)

## Docker Compose File

The `docker-compose.spaces.yaml` uses:
- Container name: `vane-spaces` (distinct from `vane`)
- Different ports to avoid conflicts
- Separate data volume
- Builds from source in the current directory

## Tips

1. **Quick rebuild:** After code changes, run:
   ```bash
   docker compose -f docker-compose.spaces.yaml up -d --build --no-cache
   ```

2. **View logs:**
   ```bash
   docker logs -f vane-spaces
   ```

3. **Shell access:**
   ```bash
   docker exec -it vane-spaces bash
   ```

4. **If SearxNG fails to start:** The container includes its own SearxNG. Ensure port 8081 is free.
