from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Room
from app.modules.rooms.schemas import RoomCreateRequest


class RoomAlreadyExistsError(Exception):
    """Raised when trying to create a room with a duplicate name."""


def create_room(db: Session, payload: RoomCreateRequest) -> Room:
    existing_room = db.scalar(select(Room).where(Room.name == payload.name))
    if existing_room is not None:
        raise RoomAlreadyExistsError("Room name already exists")

    room = Room(name=payload.name, capacity=payload.capacity)
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def list_rooms(db: Session) -> list[Room]:
    statement = select(Room).order_by(Room.name.asc())
    return list(db.scalars(statement).all())


def get_room_by_id(db: Session, room_id: int) -> Room | None:
    return db.get(Room, room_id)
