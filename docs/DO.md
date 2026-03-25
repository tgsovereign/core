# Self-Hosting on DigitalOcean

This guide walks through deploying Sovereign on DigitalOcean using a Managed
Postgres cluster, App Platform for the backend, and Vercel for the frontend.

## Prerequisites

- A [DigitalOcean](https://www.digitalocean.com/) account
- A [Vercel](https://vercel.com/) account
- A Telegram API ID & hash from <https://my.telegram.org>
- An OpenAI API key
- A RabbitMQ instance (see step 3)

## 1. Create a DigitalOcean Project

1. Log in to the [DigitalOcean dashboard](https://cloud.digitalocean.com/).
2. Click **New Project**, give it a name (e.g. "Sovereign"), and create it.

This keeps all your Sovereign resources organized in one place.

## 2. Create a Managed Postgres Cluster

1. In your project, go to **Databases → Create Database Cluster**.
2. Choose **PostgreSQL 17**.
3. Pick the smallest plan that fits your needs (the $15/mo single-node plan
   works for personal use).
4. Select a datacenter region close to you.
5. Click **Create Database Cluster** and wait for provisioning.

Once the cluster is ready:

1. Open the cluster and go to the **Connection Details** tab.
2. Select **Connection string** from the dropdown and copy it. It will look
   like:
   ```
   postgresql://doadmin:PASSWORD@db-host:25060/defaultdb?sslmode=require
   ```
3. **Important:** Replace the scheme with `postgresql+asyncpg://` so
   SQLAlchemy can use it:
   ```
   postgresql+asyncpg://doadmin:PASSWORD@db-host:25060/defaultdb?ssl=true
   ```
   Note: also change `sslmode=require` to `ssl=true` for asyncpg compatibility.

Save this connection string — you'll need it in the next steps.

## 3. Set Up RabbitMQ

Sovereign uses RabbitMQ to distribute agent tasks to helper workers.
DigitalOcean does not offer a managed RabbitMQ service, so you have two options:

**Option A — Managed RabbitMQ (recommended):**
Use [CloudAMQP](https://www.cloudamqp.com/) which has a free tier (Little
Lemur). Create an instance and copy the AMQP connection URL.

**Option B — Self-hosted on a Droplet:**
Run RabbitMQ on a small Droplet (1 GB RAM is enough) in the same datacenter
region as your database and App Platform app:

```bash
docker run -d --name rabbitmq \
  -p 5672:5672 -p 15672:15672 \
  --restart unless-stopped \
  rabbitmq:3-management-alpine
```

Save the AMQP URL (e.g. `amqp://guest:guest@YOUR_DROPLET_IP:5672/`). For
production, change the default guest credentials.

## 4. Deploy the Backend on App Platform

1. Go to **Apps → Create App**.
2. Choose **GitHub** as the source and connect your fork of the Sovereign
   repository.
3. Configure the app:
   - **Source directory:** `/backend`
   - **Type:** Web Service
   - **Build command:** _(leave blank — the Dockerfile handles it)_
   - **Dockerfile path:** `backend/Dockerfile`
   - **HTTP port:** `8000`
   - **Run command:**
     ```
     uv run alembic upgrade head && uv run uvicorn app.main:app --host 0.0.0.0 --port 8000
     ```
4. Set **environment variables**:

   | Variable                 | Value                                                                                                       |
   | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
   | `DATABASE_URL`           | The `postgresql+asyncpg://...` connection string from step 2                                                |
   | `RABBITMQ_URL`           | The AMQP connection URL from step 3                                                                         |
   | `TELEGRAM_API_ID`        | Your Telegram API ID                                                                                        |
   | `TELEGRAM_API_HASH`      | Your Telegram API hash                                                                                      |
   | `OPENAI_API_KEY`         | Your OpenAI API key                                                                                         |
   | `JWT_SECRET`             | A random string (e.g. `openssl rand -hex 32`)                                                               |
   | `SESSION_ENCRYPTION_KEY` | Generate with: `python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |

5. Pick the Basic plan ($5/mo works to start).
6. Click **Create Resources** and wait for the build to complete.

Once deployed, note the app URL (e.g. `https://sovereign-backend-xxxxx.ondigitalocean.app`).
Verify it works:

```bash
curl https://sovereign-backend-xxxxx.ondigitalocean.app/api/health
# → {"status":"ok"}
```

## 5. Deploy the Helper Worker

The helper service processes agent tasks (AI calls + Telegram tool execution).
It connects to the same Postgres and RabbitMQ as the backend.

In your App Platform app, add a **Worker** component:

1. Click **Add Resource → Worker** in the app settings.
2. Use the same GitHub source and Dockerfile as the backend.
3. Set the **Run command** to:
   ```
   uv run python -m app.helper
   ```
4. Set the same environment variables as the backend (`DATABASE_URL`,
   `RABBITMQ_URL`, `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `OPENAI_API_KEY`,
   `SESSION_ENCRYPTION_KEY`).
5. Pick the Basic plan ($5/mo).

Each helper processes up to `PREFETCH_COUNT` tasks concurrently (default `8`).
You can add multiple worker instances to handle even more load — they compete
for tasks from the same RabbitMQ queue.

## 6. Deploy the Frontend on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import your fork of the
   Sovereign repository.
2. Configure the project:
   - **Root directory:** `frontend`
   - **Framework preset:** Next.js (auto-detected)
3. Set **environment variables**:

   | Variable              | Value                                                                                    |
   | --------------------- | ---------------------------------------------------------------------------------------- |
   | `NEXT_PUBLIC_API_URL` | Your backend URL from step 3 (e.g. `https://sovereign-backend-xxxxx.ondigitalocean.app`) |
   | `NEXT_PUBLIC_WS_URL`  | Same URL but with `wss://` (e.g. `wss://sovereign-backend-xxxxx.ondigitalocean.app`)     |

4. Click **Deploy**.

Once the deployment is complete, your frontend will be live at your Vercel URL
(e.g. `https://sovereign-xxxxx.vercel.app`).

## 7. Update Backend CORS (Important)

By default the backend allows all origins. For production, you should restrict
CORS to your frontend domain. Set an additional environment variable on the
App Platform backend:

| Variable          | Value                                                       |
| ----------------- | ----------------------------------------------------------- |
| `ALLOWED_ORIGINS` | Your Vercel URL (e.g. `https://sovereign-xxxxx.vercel.app`) |

> **Note:** This requires the backend to read `ALLOWED_ORIGINS` from the
> environment. If this is not yet implemented, the app will still work with the
> default permissive CORS policy, but you should restrict it for production use.

## Custom Domain (Optional)

**For the frontend (Vercel):**

1. In Vercel, go to your project → **Settings → Domains**.
2. Add your domain (e.g. `sovereign.example.com`) and follow the DNS
   instructions.

**For the backend (App Platform):**

1. In DigitalOcean, go to your app → **Settings → Domains**.
2. Add your domain (e.g. `api.sovereign.example.com`) and update your DNS.
3. Update the frontend environment variables to point to the new backend domain.

## Costs

Rough monthly costs for a minimal setup:

| Service                        | Cost        |
| ------------------------------ | ----------- |
| DO Managed Postgres            | ~$15/mo     |
| DO App Platform — Backend      | ~$5/mo      |
| DO App Platform — Helper       | ~$5/mo      |
| RabbitMQ (CloudAMQP free tier) | Free        |
| Vercel (Hobby)                 | Free        |
| **Total**                      | **~$25/mo** |

## Updating

**Backend:** Push to your main branch — App Platform will auto-deploy.
Migrations run automatically on startup.

**Frontend:** Push to your main branch — Vercel will auto-deploy.
