"""Session tokens (JWT in an httpOnly cookie) and the current-user dependency.

Single user from settings for now; the dependency boundary stays the same when real auth lands.
"""

import hmac
import time
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import Request
from pydantic import BaseModel

from config.settings import get_settings
from core.errors import AppError

ALGORITHM = "HS256"
LOGIN_WINDOW_SECONDS = 600
LOGIN_MAX_FAILURES = 10


class User(BaseModel):
    email: str
    name: str


def verify_credentials(email: str, password: str) -> bool:
    settings = get_settings()
    email_ok = hmac.compare_digest(email.strip().lower().encode(), settings.auth_email.lower().encode())
    password_ok = hmac.compare_digest(password.encode(), settings.auth_password.get_secret_value().encode())
    return email_ok and password_ok


def user_for(email: str) -> User:
    return User(email=email, name=email.split("@")[0].replace(".", " ").title())


def issue_token(email: str) -> tuple[str, datetime]:
    settings = get_settings()
    now = datetime.now(UTC)
    expires = now + timedelta(minutes=settings.jwt_ttl_minutes)
    token = jwt.encode({"sub": email, "iat": now, "exp": expires}, settings.jwt_secret.get_secret_value(), algorithm=ALGORITHM)
    return token, expires


def _decode(token: str) -> str:
    try:
        claims = jwt.decode(token, get_settings().jwt_secret.get_secret_value(), algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise AppError(401, "unauthorized", "Session expired or invalid") from exc
    return str(claims["sub"])


def current_user(request: Request) -> User:
    settings = get_settings()
    token = request.cookies.get(settings.cookie_name)
    if not token:
        header = request.headers.get("authorization", "")
        token = header.removeprefix("Bearer ").strip() if header.startswith("Bearer ") else None
    if not token:
        raise AppError(401, "unauthorized", "Sign in required")
    return user_for(_decode(token))


class LoginRateLimiter:
    """In-memory failure counter per client (per API instance)."""

    def __init__(self) -> None:
        self._failures: dict[str, deque[float]] = defaultdict(deque)

    def _prune(self, key: str) -> deque[float]:
        bucket = self._failures[key]
        cutoff = time.monotonic() - LOGIN_WINDOW_SECONDS
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        return bucket

    def check(self, key: str) -> None:
        if len(self._prune(key)) >= LOGIN_MAX_FAILURES:
            raise AppError(429, "too_many_attempts", "Too many failed sign-ins. Try again in a few minutes.")

    def fail(self, key: str) -> None:
        self._prune(key).append(time.monotonic())

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)


login_limiter = LoginRateLimiter()


def client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
