#!/usr/bin/env bash
# Rebuild vane-custom podman image and reload the systemd service.
# Run on nexus as j_kro (podman storage is shared via sudo).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Vane custom image rebuild"
echo "    Branch: $(git branch --show-current)"
echo "    Last upstream merge: $(git log -1 --format='%h %s' upstream/master 2>/dev/null || echo 'never')"
echo ""

# Ensure we're on the custom branch
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "custom-reverb" ]; then
    echo "ERROR: Not on custom-reverb branch (current: $BRANCH)"
    exit 1
fi

# Build
echo "==> Building image (this takes ~10 minutes)..."
sudo podman build \
    -f Dockerfile.slim \
    -t vane-custom:latest \
    -t "vane-custom:v$(grep '"version"' package.json | head -1 | grep -oP '[\d.]+')-reverb" \
    . 2>&1 | tee /tmp/vane-build.log

if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo "ERROR: Build failed. Check /tmp/vane-build.log"
    exit 1
fi

echo ""
echo "==> Build successful. Restarting vane.service..."
sudo systemctl restart vane.service

sleep 3

# Verify
IMAGE=$(sudo podman inspect vane --format '{{.Config.Image}}' 2>/dev/null)
STATUS=$(sudo systemctl is-active vane.service)

echo ""
echo "==> Done."
echo "    Image: $IMAGE"
echo "    Service: $STATUS"
