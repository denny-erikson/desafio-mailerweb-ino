from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Room
from app.modules.rooms.schemas import RoomCreateRequest, RoomUpdateRequest


class RoomAlreadyExistsError(Exception):
    """Raised when trying to create a room with a duplicate name."""


class RoomNotFoundError(Exception):
    """Raised when a room cannot be found."""


def _find_room_by_normalized_name(db: Session, normalized_name: str) -> Room | None:
    return db.scalar(
        select(Room).where(func.lower(Room.name) == normalized_name.lower()),
    )


def create_room(db: Session, payload: RoomCreateRequest) -> Room:
    normalized_name = payload.name.strip()
    existing_room = _find_room_by_normalized_name(db, normalized_name)
    if existing_room is not None:
        raise RoomAlreadyExistsError("Room name already exists")

    room = Room(name=normalized_name, capacity=payload.capacity)
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def list_rooms(db: Session) -> list[Room]:
    statement = select(Room).order_by(Room.name.asc())
    return list(db.scalars(statement).all())


def get_room_by_id(db: Session, room_id: int) -> Room | None:
    return db.get(Room, room_id)


def update_room(db: Session, room_id: int, payload: RoomUpdateRequest) -> Room:
    room = get_room_by_id(db, room_id)
    if room is None:
        raise RoomNotFoundError("Room not found")

    normalized_name = payload.name.strip()
    existing_room = _find_room_by_normalized_name(db, normalized_name)
    if existing_room is not None and existing_room.id != room.id:
        raise RoomAlreadyExistsError("Room name already exists")

    room.name = normalized_name
    room.capacity = payload.capacity
    db.commit()
    db.refresh(room)
    return room
