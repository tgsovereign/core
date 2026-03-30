FROM ghcr.io/astral-sh/uv:latest AS uv

FROM python:3.13-slim

COPY --from=uv /uv /usr/local/bin/uv

WORKDIR /workspace

# Install schema package first (changes less often → better caching)
COPY schema/pyproject.toml schema/pyproject.toml
RUN mkdir -p schema/sovereign_schema && touch schema/sovereign_schema/__init__.py
RUN cd schema && uv sync --frozen --no-dev 2>/dev/null || true

COPY schema/ schema/
COPY common/ common/

# Install helper
COPY helper/pyproject.toml helper/uv.lock* helper/
RUN cd helper && uv sync --frozen --no-dev 2>/dev/null || true

COPY helper/ helper/

# Generate lock if needed and sync
RUN cd helper && uv sync --no-dev

WORKDIR /workspace/helper

CMD ["uv", "run", "python", "-m", "helper"]
