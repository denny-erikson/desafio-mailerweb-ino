from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.modules.rooms.schemas import RoomCreateRequest, RoomResponse, RoomUpdateRequest
from app.modules.rooms.service import (
    RoomAlreadyExistsError,
    RoomNotFoundError,
    create_room,
    get_room_by_id,
    list_rooms,
    update_room,
)


router = APIRouter(
    prefix="/rooms",
    tags=["rooms"],
    dependencies=[Depends(get_current_user)],
)
settings = get_settings()


@router.post(
    "",
    response_model=RoomResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_room_endpoint(
    payload: RoomCreateRequest,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
) -> RoomResponse:
    try:
        room = create_room(db, payload)
    except RoomAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    response.headers["Location"] = f"{settings.api_v1_prefix}/rooms/{room.id}"
    return RoomResponse.model_validate(room)


@router.get("", response_model=list[RoomResponse])
def list_rooms_endpoint(
    db: Annotated[Session, Depends(get_db)],
) -> list[RoomResponse]:
    rooms = list_rooms(db)
    return [RoomResponse.model_validate(room) for room in rooms]


@router.get("/{room_id}", response_model=RoomResponse)
def get_room_endpoint(
    room_id: int,
    db: Annotated[Session, Depends(get_db)],
) -> RoomResponse:
    room = get_room_by_id(db, room_id)
    if room is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found",
        )

    return RoomResponse.model_validate(room)


@router.put("/{room_id}", response_model=RoomResponse)
def update_room_endpoint(
    room_id: int,
    payload: RoomUpdateRequest,
    db: Annotated[Session, Depends(get_db)],
) -> RoomResponse:
    try:
        room = update_room(db, room_id, payload)
    except RoomNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except RoomAlreadyExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    return RoomResponse.model_validate(room)
