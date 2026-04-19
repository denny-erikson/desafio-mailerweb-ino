from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.enums import OutboxEventType
from app.db.models import OutboxEvent
from app.db.session import SessionLocal


def test_create_booking_persists_created_outbox_event(
    client: TestClient,
    auth_headers: dict[str, str],
    room_id: int,
) -> None:
    start_at = datetime.now(UTC).replace(microsecond=0) + timedelta(days=1)
    end_at = start_at + timedelta(hours=1)

    create_response = client.post(
        "/api/v1/bookings",
        json={
            "title": "Outbox Create Test",
            "room_id": room_id,
            "start_at": start_at.isoformat(),
            "end_at": end_at.isoformat(),
            "participants": [
                {"email": "alice@example.com", "full_name": "Alice"},
            ],
        },
        headers=auth_headers,
    )

    assert create_response.status_code == 201
    booking_id = create_response.json()["id"]

    with SessionLocal() as db:
        outbox_event = db.scalar(
            select(OutboxEvent).where(
                OutboxEvent.aggregate_type == "booking",
                OutboxEvent.aggregate_id == booking_id,
                OutboxEvent.event_type == OutboxEventType.BOOKING_CREATED,
            ),
        )

    assert outbox_event is not None
    assert outbox_event.payload["title"] == "Outbox Create Test"
    assert outbox_event.payload["room"]["id"] == room_id


def test_update_booking_persists_updated_outbox_event(
    client: TestClient,
    auth_headers: dict[str, str],
    room_id: int,
) -> None:
    start_at = datetime.now(UTC).replace(microsecond=0) + timedelta(days=1)
    end_at = start_at + timedelta(hours=1)

    create_response = client.post(
        "/api/v1/bookings",
        json={
            "title": "Outbox Update Test",
            "room_id": room_id,
            "start_at": start_at.isoformat(),
            "end_at": end_at.isoformat(),
            "participants": [
                {"email": "alice@example.com", "full_name": "Alice"},
            ],
        },
        headers=auth_headers,
    )
    assert create_response.status_code == 201
    booking_id = create_response.json()["id"]

    update_response = client.put(
        f"/api/v1/bookings/{booking_id}",
        json={
            "title": "Outbox Update Test Updated",
            "room_id": room_id,
            "start_at": start_at.isoformat(),
            "end_at": (end_at + timedelta(minutes=30)).isoformat(),
            "participants": [
                {"email": "bob@example.com", "full_name": "Bob"},
            ],
        },
        headers=auth_headers,
    )
    assert update_response.status_code == 200

    with SessionLocal() as db:
        outbox_event = db.scalar(
            select(OutboxEvent).where(
                OutboxEvent.aggregate_type == "booking",
                OutboxEvent.aggregate_id == booking_id,
                OutboxEvent.event_type == OutboxEventType.BOOKING_UPDATED,
            ),
        )

    assert outbox_event is not None
    assert outbox_event.payload["title"] == "Outbox Update Test Updated"
    assert outbox_event.payload["participants"][0]["email"] == "bob@example.com"


def test_cancel_booking_persists_canceled_outbox_event(
    client: TestClient,
    auth_headers: dict[str, str],
    room_id: int,
) -> None:
    start_at = datetime.now(UTC).replace(microsecond=0) + timedelta(days=1)
    end_at = start_at + timedelta(hours=1)

    create_response = client.post(
        "/api/v1/bookings",
        json={
            "title": "Outbox Cancel Test",
            "room_id": room_id,
            "start_at": start_at.isoformat(),
            "end_at": end_at.isoformat(),
            "participants": [
                {"email": "alice@example.com", "full_name": "Alice"},
            ],
        },
        headers=auth_headers,
    )
    assert create_response.status_code == 201
    booking_id = create_response.json()["id"]

    cancel_response = client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        headers=auth_headers,
    )
    assert cancel_response.status_code == 200

    with SessionLocal() as db:
        outbox_event = db.scalar(
            select(OutboxEvent).where(
                OutboxEvent.aggregate_type == "booking",
                OutboxEvent.aggregate_id == booking_id,
                OutboxEvent.event_type == OutboxEventType.BOOKING_CANCELED,
            ),
        )

    assert outbox_event is not None
    assert outbox_event.payload["title"] == "Outbox Cancel Test"
    assert outbox_event.payload["canceled_at"] is not None
