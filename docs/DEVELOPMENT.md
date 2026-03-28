# Development Setup

This guide walks you through setting up a local development environment for
Sovereign.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- [Node.js](https://nodejs.org/) 20+ & npm
- A Telegram API ID & hash from <https://my.telegram.org>

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
| `JWT_SECRET`             | Any random string                                                           |
| `SESSION_ENCRYPTION_KEY` | Generate with the command in `.env.example`                                 |
| `DATABASE_URL`           | Defaults to local Postgres (`sovereign:sovereign@localhost:5432/sovereign`) |
| `RABBITMQ_URL`           | Defaults to local RabbitMQ (`amqp://guest:guest@localhost:5672/`)           |

Install dependencies, run database migrations, and start the server:

```bash
uv sync
cd ../schema && uv run alembic upgrade head && cd ../backend
uv run uvicorn app.main:app --reload --port 8000
```

The API is available at <http://localhost:8000>.

## 3. Helper

The helper service processes agent tasks (AI calls + Telegram tool execution)
via a RabbitMQ work queue. In a separate terminal:

```bash
cd helper
cp ../backend/.env .env   # shares the same secrets as the backend
uv sync
uv run python -m helper
```

Each helper processes up to `PREFETCH_COUNT` tasks concurrently (default `8`).
You can run multiple helpers in parallel — they compete for tasks from the same
queue.

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

## Project Structure

The repo is split into three independent packages that share a common database
schema:

```
core/
├── schema/      — shared DB models & Alembic migrations (sovereign-schema)
├── backend/     — FastAPI REST/WebSocket API
├── helper/      — RabbitMQ worker for agent task execution
└── frontend/    — Next.js UI
```

Both `backend` and `helper` depend on `sovereign-schema` as a local path
dependency. Other repos can install it via:

```toml
[tool.uv.sources]
sovereign-schema = { git = "https://github.com/org/sovereign", subdirectory = "schema" }
```

## Production Migrations

Alembic migrations live in the `schema/` package. To run against a production
database, set `DATABASE_URL` and run from the `schema/` directory:

```bash
cd schema
DATABASE_URL="postgresql+asyncpg://user:pass@prod-host:5432/sovereign" \
  uv run alembic upgrade head
```

Alternatively, if you keep a `.env.prod` file with production secrets:

```bash
cd schema
env $(grep -v '^#' .env.prod | xargs) uv run alembic upgrade head
```

To check the current migration revision without applying changes:

```bash
cd schema
DATABASE_URL="..." uv run alembic current
```
