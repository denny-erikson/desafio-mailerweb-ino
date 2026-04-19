from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.db.enums import BookingStatus
from app.db.models import Booking
from app.db.session import SessionLocal


def test_list_bookings_returns_existing_records(
    client: TestClient,
    auth_headers: dict[str, str],
    room_id: int,
) -> None:
    start_at = datetime.now(UTC).replace(microsecond=0) + timedelta(days=1)
    end_at = start_at + timedelta(hours=1)

    first_response = client.post(
        "/api/v1/bookings",
        json={
            "title": "Alpha Booking",
            "room_id": room_id,
            "start_at": start_at.isoformat(),
            "end_at": end_at.isoformat(),
            "participants": [
                {"email": "alpha@example.com", "full_name": "Alpha"},
            ],
        },
        headers=auth_headers,
    )
    assert first_response.status_code == 201

    second_response = client.post(
        "/api/v1/bookings",
        json={
            "title": "Beta Booking",
            "room_id": room_id,
            "start_at": (end_at + timedelta(minutes=15)).isoformat(),
            "end_at": (end_at + timedelta(hours=1, minutes=15)).isoformat(),
            "participants": [
                {"email": "beta@example.com", "full_name": "Beta"},
            ],
        },
        headers=auth_headers,
    )
    assert second_response.status_code == 201

    list_response = client.get("/api/v1/bookings", headers=auth_headers)

    assert list_response.status_code == 200
    payload = list_response.json()
    assert len(payload) >= 2
    assert [payload[0]["title"], payload[1]["title"]] == [
        "Alpha Booking",
        "Beta Booking",
    ]
    assert payload[0]["participants"][0]["email"] == "alpha@example.com"


def test_create_and_update_booking_participants(
    client: TestClient,
    auth_headers: dict[str, str],
    room_id: int,
) -> None:
    start_at = datetime.now(UTC).replace(microsecond=0) + timedelta(days=1)
    end_at = start_at + timedelta(hours=1)

    create_response = client.post(
        "/api/v1/bookings",
        json={
            "title": "Participant Test",
            "room_id": room_id,
            "start_at": start_at.isoformat(),
            "end_at": end_at.isoformat(),
            "participants": [
                {"email": "alice@example.com", "full_name": "Alice"},
                {"email": "bob@example.com", "full_name": "Bob"},
            ],
        },
        headers=auth_headers,
    )

    assert create_response.status_code == 201
    created_booking = create_response.json()
    assert len(created_booking["participants"]) == 2
    assert {item["email"] for item in created_booking["participants"]} == {
        "alice@example.com",
        "bob@example.com",
    }

    booking_id = created_booking["id"]
    update_response = client.put(
        f"/api/v1/bookings/{booking_id}",
        json={
            "title": "Participant Test Updated",
            "room_id": room_id,
            "start_at": start_at.isoformat(),
            "end_at": (end_at + timedelta(minutes=30)).isoformat(),
            "participants": [
                {"email": "carol@example.com", "full_name": "Carol"},
            ],
        },
        headers=auth_headers,
    )

    assert update_response.status_code == 200
    updated_booking = update_response.json()
    assert len(updated_booking["participants"]) == 1
    assert updated_booking["participants"][0]["email"] == "carol@example.com"
    assert updated_booking["participants"][0]["full_name"] == "Carol"


def test_cancel_booking_is_logical_and_keeps_record(
    client: TestClient,
    auth_headers: dict[str, str],
    room_id: int,
) -> None:
    start_at = datetime.now(UTC).replace(microsecond=0) + timedelta(days=1)
    end_at = start_at + timedelta(hours=1)

    create_response = client.post(
        "/api/v1/bookings",
        json={
            "title": "Logical Cancel Test",
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
    canceled_booking = cancel_response.json()
    assert canceled_booking["status"] == BookingStatus.CANCELED.value
    assert canceled_booking["canceled_at"] is not None

    with SessionLocal() as db:
        persisted_booking = db.scalar(
            select(Booking).where(Booking.id == booking_id),
        )

    assert persisted_booking is not None
    assert persisted_booking.status == BookingStatus.CANCELED
    assert persisted_booking.canceled_at is not None


def test_active_booking_overlap_returns_conflict(
    client: TestClient,
    auth_headers: dict[str, str],
    room_id: int,
) -> None:
    start_at = datetime.now(UTC).replace(microsecond=0) + timedelta(days=1)
    end_at = start_at + timedelta(hours=1)

    first_response = client.post(
        "/api/v1/bookings",
        json={
            "title": "First Booking",
            "room_id": room_id,
            "start_at": start_at.isoformat(),
            "end_at": end_at.isoformat(),
            "participants": [
                {"email": "alice@example.com", "full_name": "Alice"},
            ],
        },
        headers=auth_headers,
    )
    assert first_response.status_code == 201

    overlapping_response = client.post(
        "/api/v1/bookings",
        json={
            "title": "Overlapping Booking",
            "room_id": room_id,
            "start_at": (start_at + timedelta(minutes=30)).isoformat(),
            "end_at": (end_at + timedelta(minutes=30)).isoformat(),
            "participants": [
                {"email": "bob@example.com", "full_name": "Bob"},
            ],
        },
        headers=auth_headers,
    )

    assert overlapping_response.status_code == 409
    assert overlapping_response.json()["detail"] == (
        "Booking time conflicts with an existing booking"
    )


def test_touching_booking_slots_are_allowed(
    client: TestClient,
    auth_headers: dict[str, str],
    room_id: int,
) -> None:
    start_at = datetime.now(UTC).replace(microsecond=0) + timedelta(days=1)
    end_at = start_at + timedelta(hours=1)

    first_response = client.post(
        "/api/v1/bookings",
        json={
            "title": "First Booking",
            "room_id": room_id,
            "start_at": start_at.isoformat(),
            "end_at": end_at.isoformat(),
            "participants": [
                {"email": "alice@example.com", "full_name": "Alice"},
            ],
        },
        headers=auth_headers,
    )
    assert first_response.status_code == 201

    touching_response = client.post(
        "/api/v1/bookings",
        json={
            "title": "Touching Booking",
            "room_id": room_id,
            "start_at": end_at.isoformat(),
            "end_at": (end_at + timedelta(hours=1)).isoformat(),
            "participants": [
                {"email": "bob@example.com", "full_name": "Bob"},
            ],
        },
        headers=auth_headers,
    )

    assert touching_response.status_code == 201


def test_canceled_booking_no_longer_blocks_new_booking(
    client: TestClient,
    auth_headers: dict[str, str],
    room_id: int,
) -> None:
    start_at = datetime.now(UTC).replace(microsecond=0) + timedelta(days=1)
    end_at = start_at + timedelta(hours=1)

    first_response = client.post(
        "/api/v1/bookings",
        json={
            "title": "Cancelable Booking",
            "room_id": room_id,
            "start_at": start_at.isoformat(),
            "end_at": end_at.isoformat(),
            "participants": [
                {"email": "alice@example.com", "full_name": "Alice"},
            ],
        },
        headers=auth_headers,
    )
    assert first_response.status_code == 201
    booking_id = first_response.json()["id"]

    cancel_response = client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        headers=auth_headers,
    )
    assert cancel_response.status_code == 200

    replacement_response = client.post(
        "/api/v1/bookings",
        json={
            "title": "Replacement Booking",
            "room_id": room_id,
            "start_at": start_at.isoformat(),
            "end_at": end_at.isoformat(),
            "participants": [
                {"email": "bob@example.com", "full_name": "Bob"},
            ],
        },
        headers=auth_headers,
    )

    assert replacement_response.status_code == 201
