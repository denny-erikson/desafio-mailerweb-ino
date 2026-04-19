from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.modules.bookings.schemas import (
    BookingCreateRequest,
    BookingResponse,
    BookingUpdateRequest,
)
from app.modules.bookings.service import (
    BookingConflictError,
    BookingNotFoundError,
    BookingStateError,
    BookingValidationError,
    RoomNotFoundError,
    cancel_booking,
    create_booking,
    list_bookings,
    update_booking,
)


router = APIRouter(prefix="/bookings", tags=["bookings"])
settings = get_settings()


@router.get("", response_model=list[BookingResponse])
def list_bookings_endpoint(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> list[BookingResponse]:
    bookings = list_bookings(db)
    return [BookingResponse.model_validate(booking) for booking in bookings]


@router.post(
    "",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_booking_endpoint(
    payload: BookingCreateRequest,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> BookingResponse:
    try:
        booking = create_booking(db, payload, current_user)
    except RoomNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BookingConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except BookingValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    response.headers["Location"] = f"{settings.api_v1_prefix}/bookings/{booking.id}"
    return BookingResponse.model_validate(booking)


@router.put("/{booking_id}", response_model=BookingResponse)
def update_booking_endpoint(
    booking_id: int,
    payload: BookingUpdateRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> BookingResponse:
    try:
        booking = update_booking(db, booking_id, payload)
    except BookingNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except RoomNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BookingConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except BookingStateError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except BookingValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    return BookingResponse.model_validate(booking)


@router.post("/{booking_id}/cancel", response_model=BookingResponse)
def cancel_booking_endpoint(
    booking_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_user)],
) -> BookingResponse:
    try:
        booking = cancel_booking(db, booking_id)
    except BookingNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except BookingStateError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    return BookingResponse.model_validate(booking)
