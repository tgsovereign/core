# Development Setup

This guide walks you through setting up a local development environment for
Sovereign.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [Node.js](https://nodejs.org/) 20+ & npm
- A Telegram API ID & hash from <https://my.telegram.org>
- An OpenAI API key

## 1. Start Postgres & RabbitMQ

```bash
docker compose up postgres rabbitmq -d
```

This runs Postgres 17 on `localhost:5432` and RabbitMQ on `localhost:5672`
(management UI at `localhost:15672`, guest/guest).

## 2. Backend

```bash
cd backend
cp .env.example .env   # then fill in your secrets
```

Required `.env` values:

| Variable                 | Description                                                                 |
| ------------------------ | --------------------------------------------------------------------------- |
| `TELEGRAM_API_ID`        | From <https://my.telegram.org>                                              |
| `TELEGRAM_API_HASH`      | From <https://my.telegram.org>                                              |
| `OPENAI_API_KEY`         | OpenAI API key                                                              |
| `JWT_SECRET`             | Any random string                                                           |
| `SESSION_ENCRYPTION_KEY` | Generate with the command in `.env.example`                                 |
| `DATABASE_URL`           | Defaults to local Postgres (`sovereign:sovereign@localhost:5432/sovereign`) |
| `RABBITMQ_URL`           | Defaults to local RabbitMQ (`amqp://guest:guest@localhost:5672/`)           |

Run database migrations and start the server:

```bash
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```

The API is available at <http://localhost:8000>.

## 3. Helper

The helper service processes agent tasks (AI calls + Telegram tool execution)
via a RabbitMQ work queue. In a separate terminal:

```bash
cd backend
uv run python -m app.helper
```

The helper shares the same `.env` as the backend. You can run multiple helpers
in parallel — they compete for tasks from the same queue.

## 4. Frontend

```bash
cd frontend
npm install
npm run dev
```

The UI is available at <http://localhost:3000>.

The frontend expects two environment variables (both default to `localhost`
during development):

| Variable              | Description               | Default                 |
| --------------------- | ------------------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL` | Backend REST API base URL | `http://localhost:8000` |
| `NEXT_PUBLIC_WS_URL`  | Backend WebSocket URL     | `ws://localhost:8000`   |

## Production Migrations

To run Alembic migrations against a production database, set `DATABASE_URL` to
point at the production Postgres instance and run from the `backend/` directory:

```bash
cd backend
DATABASE_URL="postgresql+asyncpg://user:pass@prod-host:5432/sovereign" \
  uv run alembic upgrade head
```

Alternatively, if you keep a `.env.prod` file with production secrets:

```bash
cd backend
env $(grep -v '^#' .env.prod | xargs) uv run alembic upgrade head
```

To check the current migration revision without applying changes:

```bash
DATABASE_URL="..." uv run alembic current
```
