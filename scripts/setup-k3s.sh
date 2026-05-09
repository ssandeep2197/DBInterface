#!/usr/bin/env bash
# Provision a fresh Ubuntu 22.04+ VPS as a single-node Kubernetes cluster
# (k3s) ready to host multiple subdomain-routed projects.
#
# What it installs:
#   - k3s WITHOUT Traefik (we use ingress-nginx instead)
#   - Helm 3
#   - ingress-nginx controller (LoadBalancer, exposes 80/443 via k3s ServiceLB)
#   - cert-manager (auto Let's Encrypt via HTTP-01)
#   - A ClusterIssuer for Let's Encrypt
#   - Docker (so you can build images locally and import into k3s containerd)
#   - ufw allowing 22 / 80 / 443
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ssandeep2197/DBInterface/main/scripts/setup-k3s.sh \
#     | sudo ADMIN_EMAIL=you@example.com bash
#
# Env-var overrides:
#   ADMIN_EMAIL       (recommended) email used for Let's Encrypt registration
#   K3S_VERSION       (default: empty -> latest stable)
#   INGRESS_VERSION   (default: 4.11.3)
#   CERTMANAGER_VERSION (default: v1.16.2)

set -euo pipefail

ADMIN_EMAIL="${ADMIN_EMAIL:-}"
K3S_VERSION="${K3S_VERSION:-}"
INGRESS_VERSION="${INGRESS_VERSION:-4.11.3}"
CERTMANAGER_VERSION="${CERTMANAGER_VERSION:-v1.16.2}"

if [[ "$EUID" -ne 0 ]]; then
  echo "ERROR: must run as root or via sudo." >&2
  exit 1
fi

if [[ -z "$ADMIN_EMAIL" ]]; then
  echo "WARNING: ADMIN_EMAIL not set — Let's Encrypt will register without an email." >&2
  echo "         You'll miss expiry warnings. Recommended to set ADMIN_EMAIL=you@example.com" >&2
fi

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# ─── 1. base packages ──────────────────────────────────────────────────────────
log "updating apt and installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  curl ca-certificates git ufw apt-transport-https gnupg lsb-release

# ─── 2. firewall ──────────────────────────────────────────────────────────────
log "configuring ufw (22, 80, 443; allow k3s flannel + svc cidrs)"
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
# k3s pod-to-pod traffic on the host must be allowed for kube-system to work
ufw allow from 10.42.0.0/16 || true
ufw allow from 10.43.0.0/16 || true
yes | ufw enable || true

# ─── 3. Docker ────────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  log "installing Docker (used to build images, then imported into k3s containerd)"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin
fi

# ─── 4. k3s (without Traefik) ─────────────────────────────────────────────────
if ! command -v k3s >/dev/null 2>&1; then
  log "installing k3s (Traefik disabled — we use ingress-nginx)"
  K3S_INSTALL_ARGS="--disable=traefik --write-kubeconfig-mode=644"
  if [[ -n "$K3S_VERSION" ]]; then
    curl -fsSL https://get.k3s.io | INSTALL_K3S_VERSION="$K3S_VERSION" sh -s - $K3S_INSTALL_ARGS
  else
    curl -fsSL https://get.k3s.io | sh -s - $K3S_INSTALL_ARGS
  fi
else
  log "k3s already installed: $(k3s --version | head -1)"
fi

# Make kubectl + KUBECONFIG ergonomic for root and any future users
ln -sf /usr/local/bin/k3s /usr/local/bin/kubectl
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
mkdir -p /root/.kube
ln -sf /etc/rancher/k3s/k3s.yaml /root/.kube/config

log "waiting for k3s to be ready"
for _ in $(seq 1 60); do
  if kubectl get nodes 2>/dev/null | grep -q ' Ready '; then
    break
  fi
  sleep 2
done
kubectl get nodes

# ─── 5. Helm ──────────────────────────────────────────────────────────────────
if ! command -v helm >/dev/null 2>&1; then
  log "installing Helm 3"
  curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
fi

# ─── 6. ingress-nginx ─────────────────────────────────────────────────────────
log "installing ingress-nginx controller v$INGRESS_VERSION"
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null 2>&1 || true
helm repo update >/dev/null

helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --version "$INGRESS_VERSION" \
  --set controller.service.type=LoadBalancer \
  --set controller.ingressClassResource.default=true \
  --set controller.config.use-forwarded-headers=true \
  --set controller.config.compute-full-forwarded-for=true \
  --set controller.config.proxy-body-size=2m

log "waiting for ingress-nginx to get a LoadBalancer IP"
for _ in $(seq 1 60); do
  IP=$(kubectl -n ingress-nginx get svc ingress-nginx-controller \
        -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || true)
  if [[ -n "$IP" ]]; then
    echo "  LoadBalancer IP: $IP"
    break
  fi
  sleep 2
done

# ─── 7. cert-manager ─────────────────────────────────────────────────────────
log "installing cert-manager $CERTMANAGER_VERSION"
helm repo add jetstack https://charts.jetstack.io >/dev/null 2>&1 || true
helm repo update >/dev/null

helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --version "$CERTMANAGER_VERSION" \
  --set crds.enabled=true

log "waiting for cert-manager webhook to be ready"
kubectl -n cert-manager rollout status deploy/cert-manager-webhook --timeout=180s

# ─── 8. Let's Encrypt ClusterIssuer ───────────────────────────────────────────
log "creating Let's Encrypt ClusterIssuer"
EMAIL_LINE=""
if [[ -n "$ADMIN_EMAIL" ]]; then
  EMAIL_LINE="email: $ADMIN_EMAIL"
fi

cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    $EMAIL_LINE
    privateKeySecretRef:
      name: letsencrypt-prod-account
    solvers:
      - http01:
          ingress:
            class: nginx
---
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    $EMAIL_LINE
    privateKeySecretRef:
      name: letsencrypt-staging-account
    solvers:
      - http01:
          ingress:
            class: nginx
EOF

# ─── done ─────────────────────────────────────────────────────────────────────
PUBLIC_IP=$(curl -fsSL https://api.ipify.org 2>/dev/null || echo "<server-ip>")

cat <<EOF

────────────────────────────────────────────────────────────────────────
✓ k3s cluster ready

  Public IP:              $PUBLIC_IP
  kubectl + KUBECONFIG:   /etc/rancher/k3s/k3s.yaml
  Useful checks:
    kubectl get nodes
    kubectl get pods -A
    kubectl -n ingress-nginx get svc

  ClusterIssuers available:
    letsencrypt-prod      (use this for real certs)
    letsencrypt-staging   (use this while debugging — won't hit rate limits)

  Next: deploy a project.
    DBInterface:
      cd /tmp && git clone https://github.com/ssandeep2197/DBInterface.git
      cd DBInterface
      sudo DOMAIN=dbinterface.helloworlds.co.in scripts/build-and-load.sh
      sudo DOMAIN=dbinterface.helloworlds.co.in scripts/deploy-k8s.sh

  Add another project (template):
      Each project gets its own namespace + ingress with its own host.
      See K8S.md for the per-project layout.
────────────────────────────────────────────────────────────────────────
EOF
