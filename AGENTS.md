# Vane — Self-Hosted AI Search Engine

**Fork of:** [ItzCrazyKns/Vane](https://github.com/ItzCrazyKns/Vane) (Perplexica rebrand)
**Our fork:** [reverb256/Vane](https://github.com/reverb256/Vane)
**Branch:** `custom-reverb`

## What This Is

Vane provides Perplexity-style AI search with citations, using SearXNG for web search and an LLM for synthesis. We run it as a podman container on nexus (port 30900) behind Caddy (search.lan).

## Why We Forked

Upstream has several known bugs with open PRs that aren't being merged. We cherry-picked and consolidated the fixes into our `custom-reverb` branch:

| Commit | Source | Fix |
|--------|--------|-----|
| PR #1094 | octo-patch | `content: null` instead of `content: ''` for assistant tool-call messages |
| PR #1099 | octo-patch | Error handling in APISearchAgent (prevents hanging requests) |
| PR #1091 | octo-patch | Null coalescing guards on `.slice()` / `.map()` in search actions |
| PR #1039 | VibhorGautam | Broad robustness across model providers + SearXNG error handling |
| Custom | reverb256 | Filter string "undefined" queries from malformed tool calls |
| Custom | reverb256 | `content ?? ""` null safety in ollama/openai providers |
| Custom | reverb256 | Type cast for `responses.stream` input (upstream type mismatch) |

## Infrastructure

- **Host:** nexus (podman, host networking)
- **Port:** 30900 (LAN: search.lan, TLS via Caddy)
- **Image:** `localhost/vane-custom:latest` (built on nexus from Dockerfile.slim)
- **SearXNG:** K8s ClusterIP `10.4.98.141:8080`
- **Data volume:** `/var/lib/vane:/home/vane/data`
- **NixOS module:** `/etc/nixos/modules/services/vane.nix`

## Build & Deploy

```bash
# On nexus:
cd /data/projects/own/vane
git checkout custom-reverb

# Build the image (~10 min)
sudo podman build -f Dockerfile.slim -t vane-custom:latest -t vane-custom:v1.12.2-reverb .

# Transfer to root podman storage (systemd runs as root)
sudo podman save vane-custom:latest | sudo podman load

# Restart
sudo systemctl restart vane.service
```

Or use the rebuild script:
```bash
./rebuild.sh
```

## Updating from Upstream

```bash
cd /data/projects/own/vane
git fetch upstream
git checkout custom-reverb
git rebase upstream/master
# Resolve conflicts if any, then:
./rebuild.sh
```

## NixOS Integration

The NixOS vane module at `/etc/nixos/modules/services/vane.nix` accepts an `image` option.
Currently set to `"localhost/vane-custom:latest"` in `hosts/nexus/services.nix`.
