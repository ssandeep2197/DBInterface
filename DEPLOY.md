# Deploying to a Hostinger / Ubuntu VPS

Single-VPS deployment: nginx serves the React build directly and reverse-proxies `/api`, `/auth`, `/health` to the Node API. Everything is same-origin, so no cross-site cookie complexity. The setup script handles firewall, Node 20, deploy user, build, systemd unit, nginx config, and Let's Encrypt (if you have a domain).

## What you'll end up with

```
ufw → nginx → ┬── /  ……………… static React build
              └── /api, /auth, /health → Node API on 127.0.0.1:8082 (systemd)
```

- Node 20 from NodeSource
- API runs as a non-root `dbi` user under `dbinterface-api.service`
- nginx + (optional) Let's Encrypt TLS
- ufw open on 22 / 80 / 443 only

## 1. Prerequisites

- A fresh Ubuntu 22.04+ VPS (Hostinger, DigitalOcean, Hetzner, etc.)
- SSH access as `root` or a sudo-capable user
- (Optional) A domain pointing at the VPS public IP — required for HTTPS

## 2. Run the setup script

SSH into the VPS, then run **one** of these depending on what you have:

### Option A — domain + HTTPS (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/ssandeep2197/DBInterface/main/scripts/setup-vps.sh \
  | sudo DOMAIN=dbi.example.com ADMIN_EMAIL=you@example.com bash
```

The script will request a Let's Encrypt cert and configure HTTPS automatically.

### Option B — IP-only (no domain, HTTP)

```bash
curl -fsSL https://raw.githubusercontent.com/ssandeep2197/DBInterface/main/scripts/setup-vps.sh \
  | sudo bash
```

Works fine, but logins go over plain HTTP — only use this for personal testing on an IP you don't share.

### Option C — also install MySQL on the VPS

```bash
curl -fsSL https://raw.githubusercontent.com/ssandeep2197/DBInterface/main/scripts/setup-vps.sh \
  | sudo INSTALL_MYSQL=yes BLOCK_PRIVATE_HOSTS=false DOMAIN=dbi.example.com bash
```

`BLOCK_PRIVATE_HOSTS=false` is needed so the app can connect to `127.0.0.1:3306`. Set a root password right after with `sudo mysql_secure_installation`.

### Curl-pipe-bash makes you nervous? Read it first

```bash
ssh user@vps
git clone https://github.com/ssandeep2197/DBInterface.git
cd DBInterface
less scripts/setup-vps.sh
sudo DOMAIN=dbi.example.com bash scripts/setup-vps.sh
```

## 3. What the script does (in order)

1. `apt update` + installs `curl`, `git`, `ufw`, `nginx`, `build-essential`
2. ufw: allow 22 / 80 / 443, then enable
3. Node.js 20 from NodeSource
4. (optional) MySQL 8
5. Creates a `dbi` user; gives them passwordless `sudo` for **only** `systemctl restart dbinterface-api`, `systemctl reload nginx`, and `nginx -t`
6. Clones the repo into `/opt/dbinterface`
7. Generates `.env` with a random `SESSION_SECRET` (via `openssl rand -hex 32`)
8. `npm ci`, builds the API (`tsc` + `tsc-alias`) and the web (`vite build`)
9. Installs `dbinterface-api.service` and starts it
10. Writes the nginx site config, drops the default site, reloads nginx
11. (if `DOMAIN` set) runs `certbot --nginx` for Let's Encrypt + auto HTTP→HTTPS redirect

## 4. Verify

```bash
# API up?
curl -i https://dbi.example.com/health      # or http://<ip>/health

# Service status
sudo systemctl status dbinterface-api

# Tail logs
sudo journalctl -u dbinterface-api -f

# Nginx access / error
sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
```

Open `https://dbi.example.com` (or `http://<ip>`) in a browser and connect to any MySQL — local on the VPS, AWS RDS, PlanetScale, TiDB Cloud, etc.

## 5. Updating the deployment

After pushing new commits to `main`, on the VPS:

```bash
sudo -u dbi /opt/dbinterface/scripts/deploy.sh
```

That pulls, runs `npm ci`, rebuilds, restarts the api, and reloads nginx.

To roll back:

```bash
sudo -u dbi git -C /opt/dbinterface reset --hard <previous-sha>
sudo -u dbi /opt/dbinterface/scripts/deploy.sh
```

## 6. Operations cheatsheet

| Task                    | Command                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| Restart API             | `sudo systemctl restart dbinterface-api`                          |
| Reload nginx            | `sudo systemctl reload nginx`                                     |
| Tail API logs           | `sudo journalctl -u dbinterface-api -f`                           |
| Edit env vars           | `sudo -u dbi nano /opt/dbinterface/.env` then restart the api     |
| Renew TLS cert          | `sudo certbot renew --dry-run` (cron handles real renewals)       |
| Free disk / prune build | `sudo -u dbi git -C /opt/dbinterface clean -fdx -e .env -e dist`  |
| Open MySQL port         | `sudo ufw allow 3306/tcp` (only if you really need external access) |

## 7. Security checklist

- [ ] `BLOCK_PRIVATE_HOSTS=true` if the api is reachable from the public internet (default in the script)
- [ ] `FORCE_HTTPS=true` after Let's Encrypt is set up (default when `DOMAIN` is provided)
- [ ] `SESSION_SECRET` is the random one the script generated, not a default
- [ ] `RATE_LIMIT_MAX` cranked down if you expect very low traffic (default 300/min/IP)
- [ ] SSH key auth only — disable `PasswordAuthentication` in `/etc/ssh/sshd_config`
- [ ] Don't open MySQL's 3306 to the internet; if you must, use TLS + a non-root user
- [ ] If you only want yourself to access the demo, put it behind Cloudflare Access or restrict source IPs in ufw

## 8. Common issues

**`ERR_CONNECTION_REFUSED` after setup**
The API didn't start. `sudo journalctl -u dbinterface-api --no-pager | tail -30` — usually a missing env var or a build error.

**Login appears to succeed but immediately logs me out**
You're on HTTP but `FORCE_HTTPS=true`. The browser drops the `Secure` cookie. Either add a domain + cert, or set `FORCE_HTTPS=false` in `/opt/dbinterface/.env` and restart the api.

**`502 Bad Gateway`**
The API is down or not listening on `127.0.0.1:8082`. Check `sudo systemctl status dbinterface-api` and confirm `API_PORT` in `.env` matches the nginx config.

**Certbot fails: "DNS problem"**
Your domain isn't pointing at the VPS yet. Check `dig +short dbi.example.com` returns the VPS public IP, wait for propagation, then `sudo certbot --nginx -d dbi.example.com`.

**"host resolves to a blocked range" when connecting to local MySQL**
You enabled `BLOCK_PRIVATE_HOSTS=true` (the safe default) but you're trying to connect to `127.0.0.1`. Set it to `false` if you genuinely need to manage MySQL on the same VPS.

**Port 80/443 blocked by Hostinger**
Some VPS providers ship with their own firewall on top of the VPS OS. Check the Hostinger control panel for any inbound network rules and allow 80/443 there too.
