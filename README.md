# Sovereign

Agentic Telegram client.

## Quick Start

The fastest way to run Sovereign locally:

```bash
docker compose up --build
```

This starts Postgres, the backend, and the frontend. The app is available at
<http://localhost:3000>.

## Documentation

| Guide                                            | Description                                            |
| ------------------------------------------------ | ------------------------------------------------------ |
| [Development Setup](docs/DEVELOPMENT.md)         | Local dev environment, running tests, and contributing |
| [Self-Host with Docker Compose](docs/COMPOSE.md) | Deploy on any VPS with automatic HTTPS via Caddy       |

## Prerequisites

- A Telegram API ID & hash from <https://my.telegram.org>

See the individual guides above for full requirements.
