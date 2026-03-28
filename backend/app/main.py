import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine
from app.routers import agent_tasks, auth, chats, conversations, ws
from app.routers import _state as router_state
from app.services.rabbitmq import get_connection, declare_infrastructure
from app.services.telegram import telegram_manager
from app.services.ws_manager import ws_manager
from app.services.ws_relay import start_ws_relay

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start RabbitMQ connections
    rmq_conn = await get_connection()
    channel = await rmq_conn.channel()
    await declare_infrastructure(channel)
    router_state.rmq_channel = channel

    relay_conn = await start_ws_relay()

    yield

    # Shutdown
    router_state.rmq_channel = None
    await ws_manager.close_all()
    await channel.close()
    await rmq_conn.close()
    await relay_conn.close()
    await telegram_manager.disconnect_all()
    await engine.dispose()


app = FastAPI(title="Sovereign", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agent_tasks.router)
app.include_router(auth.router)
app.include_router(chats.router)
app.include_router(conversations.router)
app.include_router(ws.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
