#!/usr/bin/env bash
# Deploy the DBInterface manifests to a k3s cluster.
#
# Usage:
#   sudo DOMAIN=dbinterface.helloworlds.co.in scripts/deploy-k8s.sh
#   sudo DOMAIN=... IMAGE_TAG=v1 scripts/deploy-k8s.sh
#   sudo DOMAIN=... STAGING_CERT=true scripts/deploy-k8s.sh   # use LE staging
#
# What it does:
#   - Renders manifests by sed-replacing __DOMAIN__, __IMAGE_TAG__, etc.
#   - Generates a Secret with a random SESSION_SECRET (preserves existing one
#     if the Secret already exists)
#   - kubectl apply -f the rendered manifests
#   - Waits for the rollout

set -euo pipefail

DOMAIN="${DOMAIN:-}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
NAMESPACE="${NAMESPACE:-dbinterface}"
STAGING_CERT="${STAGING_CERT:-false}"
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"

if [[ -z "$DOMAIN" ]]; then
  echo "ERROR: DOMAIN required, e.g. DOMAIN=dbinterface.helloworlds.co.in" >&2
  exit 1
fi

if [[ "$EUID" -ne 0 ]]; then
  echo "ERROR: must run as root or via sudo (needs kubeconfig at /etc/rancher)." >&2
  exit 1
fi

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
KUBECTL="${KUBECTL:-kubectl}"

if ! command -v "$KUBECTL" >/dev/null 2>&1; then
  echo "ERROR: kubectl not found. Run setup-k3s.sh first." >&2
  exit 1
fi

cd "$APP_DIR"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

ISSUER="letsencrypt-prod"
[[ "$STAGING_CERT" == "true" ]] && ISSUER="letsencrypt-staging"

# Reuse the existing SESSION_SECRET if the Secret is already there — rotating
# it on every deploy would invalidate every active session.
EXISTING_SECRET=$($KUBECTL -n "$NAMESPACE" get secret dbi-secret \
  -o jsonpath='{.data.SESSION_SECRET}' 2>/dev/null | base64 -d 2>/dev/null || true)
if [[ -n "$EXISTING_SECRET" ]]; then
  log "reusing existing SESSION_SECRET"
  SESSION_SECRET="$EXISTING_SECRET"
else
  log "generating new SESSION_SECRET"
  SESSION_SECRET=$(openssl rand -hex 32)
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

log "rendering manifests for $DOMAIN (tag=$IMAGE_TAG, issuer=$ISSUER)"
for f in k8s/*.yaml; do
  out="$TMPDIR/$(basename "$f")"
  sed \
    -e "s|__DOMAIN__|$DOMAIN|g" \
    -e "s|__IMAGE_TAG__|$IMAGE_TAG|g" \
    -e "s|__SESSION_SECRET__|$SESSION_SECRET|g" \
    -e "s|letsencrypt-prod|$ISSUER|g" \
    "$f" >"$out"
done

log "applying manifests"
$KUBECTL apply -f "$TMPDIR/00-namespace.yaml"
$KUBECTL apply -f "$TMPDIR/10-config.yaml"

# Apply the secret separately so it can keep stringData populated cleanly
$KUBECTL apply -f "$TMPDIR/15-secret.template.yaml"

$KUBECTL apply -f "$TMPDIR/20-api.yaml"
$KUBECTL apply -f "$TMPDIR/30-web.yaml"
$KUBECTL apply -f "$TMPDIR/40-ingress.yaml"

log "waiting for rollouts"
$KUBECTL -n "$NAMESPACE" rollout status deploy/dbi-api --timeout=180s
$KUBECTL -n "$NAMESPACE" rollout status deploy/dbi-web --timeout=180s

log "ingress status"
$KUBECTL -n "$NAMESPACE" get ingress dbi-ingress

log "certificate status (cert-manager may take a minute to issue)"
$KUBECTL -n "$NAMESPACE" get certificate dbi-tls 2>/dev/null || echo "  (no cert resource yet)"

cat <<EOF

────────────────────────────────────────────────────────────────────────
✓ DBInterface deployed to https://$DOMAIN

Tail logs:
  kubectl -n $NAMESPACE logs -l app=dbi-api -f
  kubectl -n $NAMESPACE logs -l app=dbi-web -f

Inspect:
  kubectl -n $NAMESPACE get all
  kubectl -n $NAMESPACE describe ingress dbi-ingress
  kubectl -n $NAMESPACE get certificate

If the cert hasn't issued yet, watch the order:
  kubectl -n $NAMESPACE describe order
  kubectl -n cert-manager logs -l app=cert-manager -f
────────────────────────────────────────────────────────────────────────
EOF
