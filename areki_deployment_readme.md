# Areki OSINT Dashboard Deployment Guide

This guide describes how to deploy the Areki OSINT Dashboard (customized Excalidraw fork) and its backend to a Hostinger KVM 2 VPS.

## Prerequisites

- A Hostinger KVM 2 VPS with Ubuntu 22.04 or 24.04 installed.
- Root or sudo access to the VPS.
- A registered domain name pointing to the VPS IP (optional, but recommended).

## Setup Instructions

### 1. Connect to your VPS

Connect via SSH using your terminal:

```bash
ssh root@your_vps_ip
```

### 2. Install Docker and Docker Compose

Update the package index and install Docker dependencies:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install apt-transport-https ca-certificates curl software-properties-common -y
```

Add the official Docker GPG key and repository:

```bash
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
```

Install Docker and Docker Compose:

```bash
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-compose-plugin -y
```

### 3. Clone the Repository

Clone your customized Excalidraw repository to the VPS:

```bash
git clone https://github.com/your-org/areki-dashboard.git
cd areki-dashboard
```

*(Replace the URL with your actual repository URL)*

### 4. Configure Environment Variables

The backend accepts the `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables for the login credentials. You can set these in a `.env` file or export them directly before running docker-compose.

Create a `.env` file in the root directory:

```bash
cat > .env << ENV_VARS
ADMIN_USERNAME=your_admin_user
ADMIN_PASSWORD=your_secure_password
ENV_VARS
```

### 5. Build and Run the Containers

Use Docker Compose to build and start the frontend and backend services:

```bash
docker compose up -d --build
```

This command will:
1. Build the Node.js backend container based on `backend/Dockerfile`.
2. Build the Excalidraw frontend container based on the root `Dockerfile`.
3. Start both services in detached mode (`-d`).

The services will be mapped as follows:
- Frontend: Port 3000
- Backend: Port 3001

### 6. Reverse Proxy with Nginx (Recommended)

To serve the dashboard over standard HTTP/HTTPS ports (80/443), install and configure Nginx.

```bash
sudo apt install nginx -y
```

Create an Nginx configuration file:

```bash
cat << 'NGINX_CONF' | sudo tee /etc/nginx/sites-available/areki
server {
    listen 80;
    server_name your_domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_CONF
```

Enable the configuration and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/areki /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Optional: Secure with Let's Encrypt (HTTPS)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your_domain.com
```

Your Areki OSINT Dashboard should now be fully deployed and accessible at your domain or VPS IP!
