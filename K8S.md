# Kubernetes deploy on a single VPS

Multi-project hosting on one Hostinger VPS using **k3s**, with **ingress-nginx** doing host-based routing and **cert-manager** auto-issuing per-host Let's Encrypt certs.

```
                Internet
                   │
                   ▼  :80 / :443
        ┌──────────────────────────────────┐
        │  ingress-nginx controller         │
        │  (Service: LoadBalancer via       │
        │   k3s ServiceLB on the host)      │
        └────┬─────────────┬─────────────┬──┘
             │             │             │
   portfolio.helloworlds.co.in           dbinterface.helloworlds.co.in
             │             │             │
        ┌────▼────┐   ┌────▼─────┐  ┌────▼──────────────────────┐
        │ ns:     │   │ ns:      │  │ ns: dbinterface           │
        │ portfolio   │ otherapp │  │ ┌─────────┐  ┌──────────┐ │
        │ ┌──────┐│   │ ┌──────┐ │  │ │ dbi-web │  │ dbi-api  │ │
        │ │ web  ││   │ │ ...  │ │  │ │ static  │  │ Node 24  │ │
        │ └──────┘│   │ └──────┘ │  │ └─────────┘  └──────────┘ │
        └─────────┘   └──────────┘  └───────────────────────────┘
```

Each project gets its own namespace + Ingress with its own host. Adding a project = drop in another set of manifests.

## Why this stack

| Choice                     | Why                                                                           |
| -------------------------- | ----------------------------------------------------------------------------- |
| **k3s** (not full kubeadm) | Single-node, ~512 MB overhead, single-binary install. Right-sized for one VPS. |
| **ingress-nginx** (not Traefik that ships with k3s) | Familiar nginx behavior; explicitly disable Traefik in the install command.   |
| **cert-manager**           | Declarative TLS — every Ingress gets `cert-manager.io/cluster-issuer` annotation and a cert appears. |
| **Namespace per project**  | Cleanly scoped `kubectl` calls, future RBAC isolation, ResourceQuotas if needed. |
| **Build images on VPS, import into containerd** | No external registry. `docker save | k3s ctr images import -` and `imagePullPolicy: Never`. Graduate to GHCR later. |

## One-time cluster setup

Point each project's subdomain at the VPS IP first (e.g. `dbinterface.helloworlds.co.in`, `portfolio.helloworlds.co.in` — both `A` records → same VPS IP), wait for `dig +short` to return the right IP, then on the VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/ssandeep2197/DBInterface/main/scripts/setup-k3s.sh \
  | sudo ADMIN_EMAIL=you@example.com bash
```

What it does:

1. apt update + ufw (22, 80, 443, plus k3s pod/svc CIDRs)
2. Install Docker (used for `docker build`, then images are imported into k3s)
3. Install k3s **with Traefik disabled**
4. Install Helm 3
5. Install ingress-nginx via Helm (LoadBalancer Service binds to the VPS IP via k3s ServiceLB)
6. Install cert-manager via Helm
7. Create two ClusterIssuers: `letsencrypt-prod` and `letsencrypt-staging`

Verify:

```bash
sudo kubectl get nodes
sudo kubectl get pods -A
sudo kubectl -n ingress-nginx get svc
```

The ingress-nginx Service should report your VPS public IP under `EXTERNAL-IP`.

## Deploying DBInterface

```bash
# 1. Clone the repo on the VPS (anywhere; you can throw it away after)
cd /tmp
git clone https://github.com/ssandeep2197/DBInterface.git
cd DBInterface

# 2. Build images and import into k3s containerd
sudo IMAGE_TAG=v1 scripts/build-and-load.sh

# 3. Apply manifests with your domain
sudo DOMAIN=dbinterface.helloworlds.co.in IMAGE_TAG=v1 scripts/deploy-k8s.sh
```

`deploy-k8s.sh` will:

- Generate a fresh `SESSION_SECRET` (or reuse the existing one if the Secret already exists — rotating mid-life would log everyone out)
- sed-replace `__DOMAIN__` and `__IMAGE_TAG__` in every YAML
- Apply Namespace → ConfigMap → Secret → Deployments → Services → Ingress
- Wait for both rollouts
- Print the URL plus tail-logs commands

Ingress + cert-manager flow:

1. Ingress is created with `cert-manager.io/cluster-issuer: letsencrypt-prod`
2. cert-manager creates a Certificate resource
3. Certificate creates an Order with Let's Encrypt
4. ACME does an HTTP-01 challenge against `http://your.host/.well-known/acme-challenge/...`
5. ingress-nginx serves the challenge via a temporary Ingress rule
6. Certificate appears as a Secret named `dbi-tls` in the namespace
7. Ingress now serves HTTPS

This usually takes 30–90 seconds after the rollout completes.

## Adding a second project (e.g. portfolio)

Each project gets the same shape — copy the `k8s/` folder of any project as a starting point, change names and image refs:

```
portfolio/k8s/
├── 00-namespace.yaml         metadata.name: portfolio
├── 10-web.yaml               Deployment + Service for portfolio image
└── 20-ingress.yaml           host: portfolio.helloworlds.co.in
```

In your portfolio repo:

```bash
sudo IMAGE_TAG=v1 scripts/build-and-load.sh
sudo DOMAIN=portfolio.helloworlds.co.in scripts/deploy-k8s.sh
```

Both projects share the same ingress-nginx + cert-manager — no extra cluster-level setup.

## Updating a deployed project

After pushing new commits:

```bash
cd /tmp/DBInterface
git pull
sudo IMAGE_TAG=v2 scripts/build-and-load.sh
sudo DOMAIN=dbinterface.helloworlds.co.in IMAGE_TAG=v2 scripts/deploy-k8s.sh
```

Bump the tag (`v2`, then `v3`, …) so k8s sees a different image and rolls. Same tag = no rollout.

## Operations cheatsheet

| Task                                 | Command                                                  |
| ------------------------------------ | -------------------------------------------------------- |
| All resources in the namespace       | `kubectl -n dbinterface get all`                         |
| Tail api logs                        | `kubectl -n dbinterface logs -l app=dbi-api -f`          |
| Tail web logs                        | `kubectl -n dbinterface logs -l app=dbi-web -f`          |
| Restart api                          | `kubectl -n dbinterface rollout restart deploy/dbi-api`  |
| Edit env without redeploy            | `kubectl -n dbinterface edit configmap dbi-config` then restart |
| Inspect ingress / cert state         | `kubectl -n dbinterface describe ingress dbi-ingress`    |
| Watch cert-manager                   | `kubectl -n cert-manager logs -l app=cert-manager -f`    |
| Drop everything in the namespace     | `kubectl delete ns dbinterface` (clean uninstall)        |

## Common issues

**Pod stuck in `ErrImageNeverPull`**
The image isn't in k3s containerd. Rerun `scripts/build-and-load.sh`. Verify with `sudo k3s ctr images list -q | grep dbinterface`.

**Cert stays `Issuing` forever**
Check that DNS actually resolves to the VPS, then `kubectl describe order -n dbinterface` and `kubectl logs -n cert-manager -l app=cert-manager`. If you've hit Let's Encrypt rate limits, redeploy with `STAGING_CERT=true` until you've debugged.

**`502 Bad Gateway` on /api/...**
The api Pod isn't `Ready`. `kubectl -n dbinterface describe pod -l app=dbi-api` shows the readiness probe state and recent events. Check `/health` is reachable inside the cluster: `kubectl -n dbinterface exec -it deploy/dbi-web -- wget -qO- http://dbi-api:8082/health`.

**Login appears to succeed but session doesn't stick**
The cookie is being dropped. In k8s we set `FORCE_HTTPS=true` and the Ingress terminates TLS — make sure the cert was issued and the URL really is `https://`. If you're hitting the bare IP, the cookie won't survive (no HTTPS, `Secure` flag drops it).

**`MountVolume.SetUp failed for volume "kube-api-access-..."`**
Usually a transient k3s issue right after install. `kubectl get pods -A | grep -v Running` to see what's stuck; `kubectl delete pod` will let the controller respawn it.
