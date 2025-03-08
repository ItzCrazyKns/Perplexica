# Accessing Perplexica over a Network

This guide explains how to access Perplexica over your network using the nginx reverse proxy included in the Docker setup.

## Basic Network Access

Perplexica is automatically accessible from any device on your network:

1. Start Perplexica using Docker Compose:
   ```bash
   docker compose up -d
   ```

2. Find your server's IP address:
   - **Windows**: `ipconfig` in Command Prompt
   - **macOS**: `ifconfig | grep "inet "` in Terminal
   - **Linux**: `ip addr show | grep "inet "` in Terminal

3. Access Perplexica from any device on your network:
   ```
   http://YOUR_SERVER_IP:8080
   ```

## Custom Port Configuration

If you need to use a different port instead of the default 8080:

1. Modify the `docker-compose.yaml` file:
   ```yaml
   perplexica:
     ports:
       - "YOUR_CUSTOM_PORT:8080"
   ```

2. Restart the containers:
   ```bash
   docker compose down && docker compose up -d
   ```

## Troubleshooting

If you encounter issues accessing Perplexica over your network:

1. **Firewall Settings**: Ensure port 8080 (or your custom port) is allowed in your firewall
2. **Docker Logs**: Check for any connection issues with `docker logs perplexica`
3. **Network Access**: Make sure your devices are on the same network and can reach the server
