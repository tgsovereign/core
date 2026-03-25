import uuid
from collections import defaultdict

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self):
        self._connections: dict[uuid.UUID, list[WebSocket]] = defaultdict(list)

    async def connect(self, user_id: uuid.UUID, ws: WebSocket):
        await ws.accept()
        self._connections[user_id].append(ws)

    def disconnect(self, user_id: uuid.UUID, ws: WebSocket):
        conns = self._connections.get(user_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self._connections.pop(user_id, None)

    async def broadcast(self, user_id: uuid.UUID, message: str):
        dead = []
        for ws in self._connections.get(user_id, []):
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)

    async def send(self, user_id: uuid.UUID, message: str):
        await self.broadcast(user_id, message)


# Singleton
ws_manager = WebSocketManager()
