"""Mutable runtime state shared across routers. Set during app lifespan."""

import aio_pika

rmq_channel: aio_pika.abc.AbstractChannel | None = None
