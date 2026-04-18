from pathlib import Path
import sys
from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import get_settings
from app.db.models import Booking, BookingParticipant, OutboxEvent, Room
from app.db.session import SessionLocal
from app.main import app
from scripts.seed_initial_user import seed_initial_user


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def auth_headers(client: TestClient) -> dict[str, str]:
    seed_initial_user()
    settings = get_settings()
    response = client.post(
        "/api/v1/auth/login",
        json={
            "email": settings.initial_user_email,
            "password": settings.initial_user_password,
        },
    )
    assert response.status_code == 200
    access_token = response.json()["access_token"]
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def room_id() -> Generator[int, None, None]:
    room_name = f"Test Room {uuid4().hex[:8]}"
    with SessionLocal() as db:
        room = Room(name=room_name, capacity=10)
        db.add(room)
        db.commit()
        db.refresh(room)
        created_room_id = room.id

    try:
        yield created_room_id
    finally:
        with SessionLocal() as db:
            booking_ids = list(
                db.scalars(
                    select(Booking.id).where(Booking.room_id == created_room_id),
                ).all(),
            )
            if booking_ids:
                db.execute(
                    delete(OutboxEvent).where(
                        OutboxEvent.aggregate_type == "booking",
                        OutboxEvent.aggregate_id.in_(booking_ids),
                    ),
                )
                db.execute(
                    delete(BookingParticipant).where(
                        BookingParticipant.booking_id.in_(booking_ids),
                    ),
                )
                db.execute(delete(Booking).where(Booking.id.in_(booking_ids)))
            db.execute(delete(Room).where(Room.id == created_room_id))
            db.commit()


@pytest.fixture(autouse=True)
def cleanup_booking_entities() -> Generator[None, None, None]:
    yield

    with SessionLocal() as db:
        db.execute(
            delete(OutboxEvent).where(OutboxEvent.aggregate_type == "booking"),
        )
        db.execute(delete(BookingParticipant))
        db.execute(delete(Booking))
        db.commit()
