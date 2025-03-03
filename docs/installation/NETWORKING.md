# Exposing Perplexica to a Network

This guide explains how to make Perplexica available over a network using the built-in Nginx reverse proxy.

## Accessing Perplexica Over a Network

### Basic Access

With the Nginx reverse proxy, Perplexica is automatically accessible from any device on your network:

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

### Domain Configuration

If you have a domain name, you can point it to your server:

1. Configure your domain's DNS settings to point to your server IP

2. Access Perplexica via:
   ```
   http://your-domain.com:8080
   ```

## Advanced Configuration

### Custom Port

If you need to use a different port instead of the default 8080:

1. Modify the `docker-compose.yaml` file:
   ```yaml
   nginx:
     ports:
       - "YOUR_CUSTOM_PORT:80"
   ```

2. Restart the containers:
   ```bash
   docker compose down && docker compose up -d
   ```

### SSL/HTTPS Configuration

For secure HTTPS access:

1. Modify the Nginx configuration to include SSL:
   ```nginx
   # In nginx.conf
   server {
     listen 80;
     listen 443 ssl;

     ssl_certificate /path/to/certificate.crt;
     ssl_certificate_key /path/to/private.key;

     # Rest of configuration...
   }
   ```

2. Update the Docker volume to include your certificates:
   ```yaml
   nginx:
     volumes:
       - ./nginx.conf:/etc/nginx/nginx.conf:ro
       - ./ssl:/path/to/ssl:ro
   ```

3. Restart the containers:
   ```bash
   docker compose down && docker compose up -d
   ```

4. Or just use another reverse proxy on top of this one...

## Troubleshooting

If you encounter issues accessing Perplexica over your network:

1. **Firewall Settings**: Ensure port 8080 (or your custom port) is allowed in your firewall

2. **Docker Network**: Check if Docker's network settings allow external connections:
   ```bash
   docker network inspect perplexica_perplexica-network
   ```

3. **Nginx Logs**: Check for any connection issues:
   ```bash
   docker logs perplexica-nginx-1
   ```

4. **Direct Access**: Verify if you can access the services directly:
   - Frontend: http://YOUR_SERVER_IP:3000
   - Backend: http://YOUR_SERVER_IP:3001
