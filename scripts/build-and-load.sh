#!/usr/bin/env bash
# Build the api and web Docker images and import them into k3s's containerd.
# Run this on the VPS after setup-k3s.sh.
#
# Usage:
#   sudo DOMAIN=dbinterface.helloworlds.co.in scripts/build-and-load.sh
#   sudo IMAGE_TAG=v1 scripts/build-and-load.sh         # custom tag
#
# Why this exists:
#   k3s uses containerd, not Docker. Without a registry, the only way k3s can
#   start a Pod from a locally-built image is if we import the image tarball
#   into containerd's image store directly. That's what `k3s ctr images import`
#   does. Manifests reference `imagePullPolicy: Never` so containerd never
#   tries to pull from a remote.

set -euo pipefail

DOMAIN="${DOMAIN:-}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"

if [[ "$EUID" -ne 0 ]]; then
  echo "ERROR: must run as root or via sudo (needs k3s ctr access)." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker not installed. Run setup-k3s.sh first." >&2
  exit 1
fi

if ! command -v k3s >/dev/null 2>&1; then
  echo "ERROR: k3s not installed. Run setup-k3s.sh first." >&2
  exit 1
fi

cd "$APP_DIR"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

API_IMAGE="dbinterface-api:$IMAGE_TAG"
WEB_IMAGE="dbinterface-web:$IMAGE_TAG"

# In k8s the SPA is same-origin (Ingress fronts both web and api), so the
# bundled API URL must be empty/relative.
VITE_API_URL=""

log "building $API_IMAGE"
docker build -f docker/api.Dockerfile -t "$API_IMAGE" .

log "building $WEB_IMAGE (VITE_API_URL='$VITE_API_URL')"
docker build -f docker/web.k8s.Dockerfile \
  --build-arg "VITE_API_URL=$VITE_API_URL" \
  -t "$WEB_IMAGE" .

log "importing images into k3s containerd"
docker image save "$API_IMAGE" | k3s ctr images import -
docker image save "$WEB_IMAGE" | k3s ctr images import -

log "verifying images visible to k3s"
k3s ctr images list -q | grep -E "dbinterface-(api|web):$IMAGE_TAG" || {
  echo "ERROR: images not found in k3s containerd after import" >&2
  exit 1
}

echo
echo "✓ images built and loaded:"
echo "    $API_IMAGE"
echo "    $WEB_IMAGE"
echo
echo "next: sudo DOMAIN=${DOMAIN:-<your-domain>} IMAGE_TAG=$IMAGE_TAG scripts/deploy-k8s.sh"
