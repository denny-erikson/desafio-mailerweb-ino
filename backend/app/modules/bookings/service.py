from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import Select, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.db.enums import BookingStatus, OutboxEventType
from app.db.models import Booking, BookingParticipant, OutboxEvent, Room, User
from app.modules.bookings.constants import MAX_BOOKING_DURATION, MIN_BOOKING_DURATION
from app.modules.bookings.schemas import (
    BookingCreateRequest,
    BookingParticipantInput,
    BookingUpdateRequest,
)

BOOKING_AGGREGATE_TYPE = "booking"
BOOKING_OVERLAP_CONSTRAINT_NAME = "exclude_active_room_booking_overlap"


class RoomNotFoundError(Exception):
    """Raised when a room cannot be found."""


class BookingNotFoundError(Exception):
    """Raised when a booking cannot be found."""


class BookingConflictError(Exception):
    """Raised when a booking overlaps another active booking."""


class BookingValidationError(Exception):
    """Raised when a booking request violates business rules."""


class BookingStateError(Exception):
    """Raised when the booking current state blocks the requested action."""


def _is_overlap_integrity_error(error: IntegrityError) -> bool:
    constraint_name = getattr(
        getattr(error.orig, "diag", None),
        "constraint_name",
        None,
    )
    return constraint_name == BOOKING_OVERLAP_CONSTRAINT_NAME


def _base_booking_query() -> Select[tuple[Booking]]:
    return select(Booking).options(selectinload(Booking.participants))


def _get_room_or_raise(db: Session, room_id: int) -> Room:
    room = db.get(Room, room_id)
    if room is None:
        raise RoomNotFoundError("Room not found")

    return room


def _get_booking_or_raise(db: Session, booking_id: int) -> Booking:
    booking = db.scalar(
        _base_booking_query().where(Booking.id == booking_id),
    )
    if booking is None:
        raise BookingNotFoundError("Booking not found")

    return booking


def _validate_timezone(value: datetime, field_name: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise BookingValidationError(f"{field_name} must include timezone")


def _validate_booking_window(start_at: datetime, end_at: datetime) -> None:
    _validate_timezone(start_at, "start_at")
    _validate_timezone(end_at, "end_at")

    if start_at >= end_at:
        raise BookingValidationError("start_at must be before end_at")

    duration = end_at - start_at
    if duration < MIN_BOOKING_DURATION:
        raise BookingValidationError("Booking duration must be at least 15 minutes")
    if duration > MAX_BOOKING_DURATION:
        raise BookingValidationError("Booking duration must be at most 8 hours")


def _conflicting_booking_query(
    room_id: int,
    start_at: datetime,
    end_at: datetime,
    *,
    exclude_booking_id: int | None = None,
) -> Select[tuple[Booking]]:
    statement = select(Booking).where(
        Booking.room_id == room_id,
        Booking.status == BookingStatus.ACTIVE,
        Booking.start_at < end_at,
        Booking.end_at > start_at,
    )

    if exclude_booking_id is not None:
        statement = statement.where(Booking.id != exclude_booking_id)

    return statement


def _ensure_no_conflict(
    db: Session,
    room_id: int,
    start_at: datetime,
    end_at: datetime,
    *,
    exclude_booking_id: int | None = None,
) -> None:
    conflicting_booking = db.scalar(
        _conflicting_booking_query(
            room_id,
            start_at,
            end_at,
            exclude_booking_id=exclude_booking_id,
        ),
    )
    if conflicting_booking is not None:
        raise BookingConflictError("Booking time conflicts with an existing booking")


def _build_participants(
    participants: list[BookingParticipantInput],
) -> list[BookingParticipant]:
    return [
        BookingParticipant(
            email=participant.email,
            full_name=participant.full_name,
        )
        for participant in participants
    ]


def _build_outbox_payload(booking: Booking, room: Room) -> dict:
    return {
        "booking_id": booking.id,
        "title": booking.title,
        "room": {
            "id": room.id,
            "name": room.name,
        },
        "created_by_user_id": booking.created_by_user_id,
        "status": booking.status.value,
        "start_at": booking.start_at.isoformat(),
        "end_at": booking.end_at.isoformat(),
        "canceled_at": booking.canceled_at.isoformat() if booking.canceled_at else None,
        "participants": [
            {
                "email": participant.email,
                "full_name": participant.full_name,
            }
            for participant in booking.participants
        ],
    }


def _add_outbox_event(
    db: Session,
    *,
    booking: Booking,
    room: Room,
    event_type: OutboxEventType,
) -> None:
    db.add(
        OutboxEvent(
            aggregate_type=BOOKING_AGGREGATE_TYPE,
            aggregate_id=booking.id,
            event_type=event_type,
            payload=_build_outbox_payload(booking, room),
            idempotency_key=f"{event_type.value}:{booking.id}:{uuid4()}",
        ),
    )


def create_booking(
    db: Session,
    payload: BookingCreateRequest,
    current_user: User,
) -> Booking:
    _validate_booking_window(payload.start_at, payload.end_at)
    room = _get_room_or_raise(db, payload.room_id)
    _ensure_no_conflict(db, payload.room_id, payload.start_at, payload.end_at)

    booking = Booking(
        title=payload.title,
        room_id=payload.room_id,
        created_by_user_id=current_user.id,
        start_at=payload.start_at,
        end_at=payload.end_at,
        status=BookingStatus.ACTIVE,
        participants=_build_participants(payload.participants),
    )

    try:
        db.add(booking)
        db.flush()
        _add_outbox_event(
            db,
            booking=booking,
            room=room,
            event_type=OutboxEventType.BOOKING_CREATED,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if _is_overlap_integrity_error(exc):
            raise BookingConflictError(
                "Booking time conflicts with an existing booking",
            ) from exc
        raise
    except Exception:
        db.rollback()
        raise

    return _get_booking_or_raise(db, booking.id)


def update_booking(
    db: Session,
    booking_id: int,
    payload: BookingUpdateRequest,
) -> Booking:
    booking = _get_booking_or_raise(db, booking_id)
    if booking.status == BookingStatus.CANCELED:
        raise BookingStateError("Canceled bookings cannot be edited")

    _validate_booking_window(payload.start_at, payload.end_at)
    room = _get_room_or_raise(db, payload.room_id)
    _ensure_no_conflict(
        db,
        payload.room_id,
        payload.start_at,
        payload.end_at,
        exclude_booking_id=booking.id,
    )

    booking.title = payload.title
    booking.room_id = payload.room_id
    booking.start_at = payload.start_at
    booking.end_at = payload.end_at

    try:
        booking.participants.clear()
        db.flush()
        booking.participants = _build_participants(payload.participants)
        db.flush()
        _add_outbox_event(
            db,
            booking=booking,
            room=room,
            event_type=OutboxEventType.BOOKING_UPDATED,
        )
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        if _is_overlap_integrity_error(exc):
            raise BookingConflictError(
                "Booking time conflicts with an existing booking",
            ) from exc
        raise
    except Exception:
        db.rollback()
        raise

    return _get_booking_or_raise(db, booking.id)


def cancel_booking(db: Session, booking_id: int) -> Booking:
    booking = _get_booking_or_raise(db, booking_id)
    if booking.status == BookingStatus.CANCELED:
        raise BookingStateError("Booking is already canceled")

    room = _get_room_or_raise(db, booking.room_id)
    booking.status = BookingStatus.CANCELED
    booking.canceled_at = datetime.now(UTC)

    try:
        db.flush()
        _add_outbox_event(
            db,
            booking=booking,
            room=room,
            event_type=OutboxEventType.BOOKING_CANCELED,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return _get_booking_or_raise(db, booking.id)
