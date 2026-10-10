# Areki OSINT Dashboard Deployment Guide

This guide describes how to deploy the Areki OSINT Dashboard (customized Excalidraw fork) and its backend to a Hostinger KVM 2 VPS.

## Architecture

```
Internet ──443──> host nginx (TLS, certbot)
                     │
                     └──> 127.0.0.1:3000  excalidraw container (nginx)
                                             ├── /        static app (SPA)
                                             └── /api/*   ──> backend:3001 (docker network only)
```

- The frontend and the API share the same origin, so the session cookie is `HttpOnly`, `Secure` and `SameSite=Strict`.
- The backend has **no published port**: it is only reachable through `/api/` on the frontend container.
- The frontend container only listens on `127.0.0.1`, so it can't be reached by bypassing the host nginx (Docker ignores `ufw` rules for published ports).

## Current production deployment (Traefik)

`srv1995398.hstgr.cloud` already runs **Traefik** on ports 80/443 for other projects (devlex), with the `letsencrypt` resolver and http → https redirection. **Do not install nginx/certbot on the host there** (steps 6–8 below): they would conflict with Traefik.

The app lives in `/home/areki-wr/areki-dashboard` (owned by `areki-wr`) and has a server-only `docker-compose.override.yml` (not in git) that removes the published port and registers the frontend with Traefik:

```yaml
services:
  excalidraw:
    ports: !reset []
    labels:
      - traefik.enable=true
      - traefik.http.routers.areki-dashboard.rule=Host(`dashboard.areki.mx`)
      - traefik.http.routers.areki-dashboard.entrypoints=websecure
      - traefik.http.routers.areki-dashboard.tls.certresolver=letsencrypt
      - traefik.http.services.areki-dashboard.loadbalancer.server.port=80
```

Update it with:

```bash
ssh root@srv1995398.hstgr.cloud
cd /home/areki-wr/areki-dashboard
sudo -u areki-wr git pull
sudo -u areki-wr docker compose up -d --build
```

The generic steps below apply to a fresh VPS without a reverse proxy.

## Case diagrams (`/api/escenas`)

The whiteboard menu has a **Diagramas del caso** item that lists and opens Excalidraw scenes served by the backend behind `requireSession`. The scenes are **not in git** (the repository is public): they live in `./escenas/` on the server (`index.json` + `<id>.excalidraw`), mounted read-only into the backend container.

Upload or update them from your machine:

```bash
scp -r ./escenas/* root@srv1995398.hstgr.cloud:/home/areki-wr/areki-dashboard/escenas/
ssh root@srv1995398.hstgr.cloud chown -R areki-wr:areki-wr /home/areki-wr/areki-dashboard/escenas
```

No rebuild or restart is needed: each request reads the files. If `./escenas` doesn't exist the list is simply empty.

## Prerequisites

- A Hostinger KVM 2 VPS with Ubuntu 22.04 or 24.04 installed.
- Root or sudo access to the VPS.
- A domain name pointing to the VPS IP. **HTTPS is required**: the session cookie is `Secure`, and Excalidraw's encryption, clipboard and PWA features only work in a secure context.

## Setup Instructions

### 1. Connect to your VPS

```bash
ssh root@srv1995398.hstgr.cloud
```

### 2. Install Docker and Docker Compose

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install ca-certificates curl -y

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y
```

### 3. Clone the Repository

```bash
git clone https://github.com/your-org/areki-dashboard.git
cd areki-dashboard
```

*(Replace the URL with your actual repository URL)*

### 4. Configure Environment Variables

The backend **refuses to start** unless these are set:

| Variable | Description |
|---|---|
| `ADMIN_USERNAME` | Login user |
| `ADMIN_PASSWORD` | Login password (use a long, random one) |
| `SESSION_SECRET` | Key used to sign session cookies, at least 32 characters |
| `SESSION_TTL_HOURS` | Optional, session lifetime (default `12`) |
| `COOKIE_SECURE` | Optional, default `true`. Set to `false` **only** to test over plain http |

```bash
cp .env.example .env
sed -i "s/^SESSION_SECRET=.*/SESSION_SECRET=$(openssl rand -hex 32)/" .env
nano .env   # set ADMIN_USERNAME and ADMIN_PASSWORD
chmod 600 .env
```

`.env` is git-ignored; never commit it. Changing `SESSION_SECRET` logs out every active session.

> Frontend settings (`VITE_APP_*` in `.env.production`) are baked in at **build** time. After changing them, rebuild with `docker compose up -d --build`.

### 5. Build and Run the Containers

```bash
docker compose up -d --build
docker compose ps
```

The first build takes a few minutes (it compiles the whole Excalidraw monorepo). The KVM 2 (8 GB RAM) handles it fine.

### 6. Reverse Proxy with Nginx

The frontend container already routes `/api/` to the backend, so the host nginx only needs a single `location`:

```bash
sudo apt install nginx -y

cat << 'NGINX_CONF' | sudo tee /etc/nginx/sites-available/areki
server {
    listen 80;
    server_name dashboard.areki.mx;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_CONF

sudo ln -s /etc/nginx/sites-available/areki /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Secure with Let's Encrypt (HTTPS) — required

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d dashboard.areki.mx
```

Certbot adds the HTTPS server block and the http → https redirect, and renews the certificate automatically.

### 8. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

Your Areki OSINT Dashboard is now available at `https://dashboard.areki.mx`.

## Updating

```bash
git pull
docker compose up -d --build
```

## Troubleshooting

- **Login always fails with no error / cookie not kept**: you're on plain http. Set up HTTPS (step 7), or set `COOKIE_SECURE=false` temporarily for testing.
- **Backend container keeps restarting**: run `docker compose logs backend`; a missing `ADMIN_*` / `SESSION_SECRET` variable is the usual cause.
- **"Too many failed attempts"**: after 10 failed logins from one IP, logins are blocked for 15 minutes (or until the backend restarts).

## Security notes

- The session protects the routes in the app and every backend endpoint that uses the `requireSession` middleware (`backend/index.js`). The app's JavaScript bundle itself is public, so **any sensitive data (e.g. Archify maps) must be served by the backend behind `requireSession`**, never embedded in the frontend build.
- Drawings are stored in each user's browser (localStorage/IndexedDB), not on the server.
- Collaboration, shareable links, libraries and AI still use the public excalidraw.com services configured in `.env.production`. Drawings shared that way leave your server (end-to-end encrypted). To keep everything in-house, self-host [excalidraw-room](https://github.com/excalidraw/excalidraw-room) and a storage backend and point those variables at them.

## Local development

```bash
# terminal 1 — backend
cd backend && npm install
ADMIN_USERNAME=admin ADMIN_PASSWORD=admin SESSION_SECRET=$(openssl rand -hex 32) COOKIE_SECURE=false npm start

# terminal 2 — frontend (Vite proxies /api to http://localhost:3001)
yarn start
```
