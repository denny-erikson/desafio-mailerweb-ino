from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.core.security import create_access_token
from app.db.models import User
from app.db.session import get_db
from app.modules.auth.schemas import (
    AuthenticatedUser,
    LoginRequest,
    TokenResponse,
)
from app.modules.auth.service import authenticate_user


router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    user = authenticate_user(db, payload.email, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(
        subject=str(user.id),
        extra_claims={"email": user.email},
    )

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=AuthenticatedUser.model_validate(user),
    )


@router.get("/me", response_model=AuthenticatedUser)
def read_current_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> AuthenticatedUser:
    return AuthenticatedUser.model_validate(current_user)
