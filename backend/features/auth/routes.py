"""/api/auth — sign in (single user from settings), sign out, current user."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from config.settings import get_settings
from core.errors import AppError
from core.security import User, client_key, current_user, issue_token, login_limiter, user_for, verify_credentials

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=200)


@router.post("/login")
async def login(body: LoginRequest, request: Request) -> JSONResponse:
    settings = get_settings()
    key = client_key(request)
    login_limiter.check(key)
    if not verify_credentials(body.email, body.password):
        login_limiter.fail(key)
        raise AppError(401, "invalid_credentials", "Wrong email or password")
    login_limiter.reset(key)
    token, expires = issue_token(settings.auth_email)
    user = user_for(settings.auth_email)
    response = JSONResponse({"user": user.model_dump(), "expires_at": expires.isoformat()})
    response.set_cookie(
        settings.cookie_name,
        token,
        max_age=settings.jwt_ttl_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )
    return response


@router.post("/logout", status_code=204)
async def logout() -> Response:
    response = Response(status_code=204)
    response.delete_cookie(get_settings().cookie_name, path="/")
    return response


@router.get("/me")
async def me(user: Annotated[User, Depends(current_user)]) -> dict:
    return {"user": user.model_dump()}
