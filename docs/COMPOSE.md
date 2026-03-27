# Self-Hosting with Docker Compose

This guide covers deploying Sovereign on a VPS (any Linux server) with Docker
Compose, a custom domain, automatic HTTPS via Let's Encrypt, and Caddy as a
reverse proxy.

## Prerequisites

- A Linux VPS (Ubuntu 22.04+ recommended) with at least 2 GB RAM
- A domain name with DNS pointed at your server's IP (e.g. `sovereign.example.com`)
- [Docker](https://docs.docker.com/engine/install/) & Docker Compose installed
- A Telegram API ID & hash from <https://my.telegram.org>

## 1. Clone the Repository

```bash
git clone https://github.com/tgsovereign/core.git sovereign
cd sovereign
```

## 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp backend/.env.example .env
```

Edit `.env` and fill in **all** required values:

```dotenv
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
JWT_SECRET=some-long-random-string
SESSION_ENCRYPTION_KEY=generate-with-command-below
DATABASE_URL=postgresql+asyncpg://sovereign:sovereign@postgres:5432/sovereign
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
```

Generate the session encryption key:

```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

> If you don't have Python locally, you can generate it after the containers
> start: `docker compose exec backend python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

## 3. Set Up Caddy as a Reverse Proxy

[Caddy](https://caddyserver.com/) is the simplest way to get automatic HTTPS —
it obtains and renews Let's Encrypt certificates with zero configuration. No
manual certbot or nginx setup required.

Create a `Caddyfile` in the project root:

```caddyfile
sovereign.example.com {
    # Frontend
    handle /* {
        reverse_proxy frontend:3000
    }

    # Backend API & WebSocket
    handle /api/* {
        reverse_proxy backend:8000
    }

    handle /ws/* {
        reverse_proxy backend:8000
    }
}
```

Replace `sovereign.example.com` with your actual domain.

## 4. Add Caddy to Docker Compose

Create a `docker-compose.prod.yml` override file:

```yaml
services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - default

  backend:
    env_file: .env
    environment:
      DATABASE_URL: postgresql+asyncpg://sovereign:sovereign@postgres:5432/sovereign
      RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672/

  helper:
    env_file: .env
    environment:
      DATABASE_URL: postgresql+asyncpg://sovereign:sovereign@postgres:5432/sovereign
      RABBITMQ_URL: amqp://guest:guest@rabbitmq:5672/

  frontend:
    environment:
      NEXT_PUBLIC_API_URL: https://sovereign.example.com
      NEXT_PUBLIC_WS_URL: wss://sovereign.example.com

volumes:
  caddy_data:
  caddy_config:
```

Replace `sovereign.example.com` with your domain in the frontend environment
variables.

## 5. Open Firewall Ports

Make sure ports **80** and **443** are open on your server:

```bash
# Ubuntu/Debian with ufw
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## 6. Deploy

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Caddy will automatically obtain a TLS certificate for your domain on first
request. Your app will be available at `https://sovereign.example.com`.

## Updating

Pull the latest code and rebuild:

```bash
git pull
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Database migrations run automatically on backend startup.

## Scaling Helpers

Agent tasks (AI processing + Telegram tool calls) are handled by the **helper**
service via a RabbitMQ work queue. By default one helper runs, but you can scale
horizontally to handle more concurrent requests:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale helper=3
```

Each helper competes for tasks from the same queue, so work is distributed
automatically. Within a single helper, concurrency is controlled by the
`PREFETCH_COUNT` environment variable (default `8`). Lower it on
memory-constrained hosts or raise it if the helper is mostly waiting on API
calls.

## Monitoring

Check service health:

```bash
# All services
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Backend logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend

# Helper logs
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f helper

# Health check
curl https://sovereign.example.com/api/health
```

RabbitMQ exposes a management UI on port **15672** (guest/guest) for inspecting
queues and message throughput. In production you should either restrict access to
this port via your firewall or change the default credentials.

## Troubleshooting

**Caddy can't obtain a certificate:**

- Verify your domain's DNS A record points to the server IP.
- Ensure ports 80 and 443 are not blocked by a firewall or used by another
  process (e.g. Apache or nginx).

**Backend can't connect to Postgres:**

- Make sure the `DATABASE_URL` uses `postgres` (the Docker service name) as the
  host, not `localhost`.

**WebSocket connections fail:**

- Caddy handles WebSocket upgrades automatically. If you're behind a cloud
  load balancer, make sure it supports WebSocket pass-through.
