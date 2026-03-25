from pydantic import BaseModel


class Chat(BaseModel):
    id: int
    title: str
    type: str  # "user", "group", "supergroup", "channel"
    unread_count: int = 0
    is_pinned: bool = False
    last_message: "Message | None" = None


class Message(BaseModel):
    id: int
    chat_id: int
    sender_id: int | None = None
    sender_name: str = ""
    text: str | None = None
    date: str  # ISO 8601
    reply_to_id: int | None = None
    is_outgoing: bool = False
    edit_date: str | None = None


class SendMessageRequest(BaseModel):
    text: str
    reply_to: int | None = None
