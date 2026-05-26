# Vane Project

Local AI search engine running through a custom DeepSeek shim. Four pieces:

| Path | Role |
|---|---|
| `/Users/office.host/Projects/vane` | Vane Next.js app (this repo, `itzcrazykns1337/vane:latest` Docker image) |
| `/Users/office.host/Projects/vane/searxng-overrides/settings.yml` | SearxNG config bind-mounted into container (engine list, limiter off) — edit here, not `docker cp` |
| `/Users/office.host/Projects/deepseek-shim` | FastAPI proxy translating json_schema → json_object, filtering reasoning_content, injecting `thinking:{type:disabled}` |
| `/Users/office.host/Applications/Vane.app` | macOS dock launcher (AppleScript, opens `http://localhost:3000` in Firefox) |

## Endpoints exposed on host

| Port | Service | Use |
|---|---|---|
| `:3000` | Vane Next.js | LLM-synthesized search UI |
| `:8081` | SearxNG raw | Multi-engine search, no LLM, no refusals |
| `:18000` | deepseek-shim | OpenAI-compat proxy (Vane → here → DeepSeek) |

## Architecture

```
Firefox ──┬─► Vane :3000 ──► host.docker.internal:18000 (shim) ──► api.deepseek.com
          │              ▲
          │        SearxNG :8080 inside vane-vane-1 (Vane talks to it)
          │
          └─► SearxNG :8081 directly (raw search, bypass LLM)
```

Embeddings via local Transformers (Xenova/all-MiniLM-L6-v2 default; nomic-embed-text-v1 available). No API calls for embedding.

## Restart commands

```bash
docker compose -f /Users/office.host/Projects/deepseek-shim/docker-compose.yaml up -d
docker compose -f /Users/office.host/Projects/vane/docker-compose.yaml up -d
```

Both have `restart: unless-stopped`; auto-recover on Docker Desktop start.

## Hard rules — do not break

- **Do not** revert `apiKey` in container's `/home/vane/data/config.json` — must be the DeepSeek key. The "Custom Chat Model key" must be the literal string `deepseek-v4-pro` or `deepseek-v4-flash` (NOT another API key — pasting a key there leaks it to DeepSeek logs as the model name).
- **Do not** point Vane's `baseURL` directly at `https://api.deepseek.com`. Must go through the shim at `http://host.docker.internal:18000` or the classifier breaks (DeepSeek V4 rejects `response_format: json_schema`).
- **Do not** revert SearxNG `limiter: false` or `public_instance: false` — the `botdetection` middleware blocks Vane's internal HTTP calls (no X-Forwarded-For).
- **Do not** revert the `use_default_settings.engines.remove` block in `searxng-overrides/settings.yml`. Removed: `ahmia`, `torch`, `wikidata` (init crashes), `braveapi`, `brave`, `brave.images/videos/news` (rate-limit IPs), `karmasearch` and variants (auth required).
- **SearxNG settings live on host now** at `searxng-overrides/settings.yml`, bind-mounted read-only into the container at `/etc/searxng/settings.yml`. Edit on host, then `docker compose restart vane`. Do not `docker cp` to the in-container path — it'll be overwritten by the bind-mount on next restart.
- **This is a forked image.** `itzcrazykns1337/vane:latest` on this Mac is built locally from this repo, not pulled from Docker Hub. The patch is `src/lib/agents/search/researcher/actions/search/webSearch.ts:7` (`type: z.literal('web_search').optional()`) so Groq/Llama models don't get rejected by strict tool-call validators. Do **not** `docker compose pull` — it would replace this fork with upstream and break Groq again. To pick up upstream Vane updates: `git pull` here, manually re-apply the patch if it was overwritten, `docker compose up -d --build`.

## Toggles

- Shim env `THINKING_DEFAULT`: `disabled` (default — kills DeepSeek's reasoning entirely, ~10× faster, fixes citation grounding), `enabled`, `adaptive`, or `passthrough` (don't touch requests).
- Shim env `REASONING_MODE`: `show` (rewrites reasoning_content as visible content with `*Thinking:*` prefix) or `drop` (silent). Now mostly moot since reasoning is off by default.
- Available chat models: `deepseek-v4-pro` (smarter), `deepseek-v4-flash` (faster, default). Both routed through the shim.
- SearxNG engine shortcuts (in either UI): `!margin <q>` (Marginalia), `!sb <q>` (ScienceBase / USGS), `!edgar <q>` (SEC EDGAR), `!moj <q>` (Mojeek), `!ya <q>` (Yandex). Full enabled list in `searxng-overrides/settings.yml`.

## When something breaks

- `docker logs vane-vane-1 --tail 50` — Vane app + bundled SearxNG
- `docker logs deepseek-shim --tail 50` — shim transcode logs
- Shim test: `curl http://localhost:18000/_health` → 401 is expected (catch-all forwards to DeepSeek; main `/v1/chat/completions` route works fine)
- Vane health: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000` → 200

## Key rotation

If the DeepSeek key leaks (or you rotate it), edit Vane's `config.json` inside the container:

```bash
docker cp vane-vane-1:/home/vane/data/config.json /tmp/c.json
# edit apiKey, recompute hash with node:
#   crypto.createHash('sha256').update(JSON.stringify(cfg, Object.keys(cfg).sort())).digest('hex')
docker cp /tmp/c.json vane-vane-1:/home/vane/data/config.json
docker compose -f /Users/office.host/Projects/vane/docker-compose.yaml restart vane
```
