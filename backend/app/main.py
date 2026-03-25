import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, chats, agent, conversations, ws
from app.services.telegram import telegram_manager

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await telegram_manager.disconnect_all()


app = FastAPI(title="Sovereign", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chats.router)
app.include_router(agent.router)
app.include_router(conversations.router)
app.include_router(ws.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}
