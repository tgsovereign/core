from pydantic import BaseModel


class SendCodeRequest(BaseModel):
    phone: str


class SendCodeResponse(BaseModel):
    phone_code_hash: str
    next: str = "code"


class VerifyCodeRequest(BaseModel):
    phone: str
    code: str
    phone_code_hash: str


class VerifyCodeResponse(BaseModel):
    token: str | None = None
    next: str | None = None  # "2fa" if 2FA required


class Verify2FARequest(BaseModel):
    phone: str
    password: str


class Verify2FAResponse(BaseModel):
    token: str


class MeResponse(BaseModel):
    id: int
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None
