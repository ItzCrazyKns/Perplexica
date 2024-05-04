FROM searxng/searxng

COPY searxng-settings.yml /etc/searxng/settings.yml
COPY searxng-limiter.toml /etc/searxng/limiter.toml