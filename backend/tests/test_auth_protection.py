from fastapi.testclient import TestClient


def test_health_and_login_are_public(client: TestClient) -> None:
    health_response = client.get("/health")
    assert health_response.status_code == 200

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "invalid@example.com", "password": "wrong-password"},
    )
    assert login_response.status_code == 401


def test_rooms_endpoints_require_authentication(client: TestClient) -> None:
    list_response = client.get("/api/v1/rooms")
    assert list_response.status_code == 401

    detail_response = client.get("/api/v1/rooms/1")
    assert detail_response.status_code == 401

    create_response = client.post(
        "/api/v1/rooms",
        json={"name": "Unauthorized Room", "capacity": 5},
    )
    assert create_response.status_code == 401


def test_bookings_endpoints_require_authentication(
    client: TestClient,
    room_id: int,
) -> None:
    list_response = client.get("/api/v1/bookings")
    assert list_response.status_code == 401

    create_response = client.post(
        "/api/v1/bookings",
        json={
            "title": "Unauthorized Booking",
            "room_id": room_id,
            "start_at": "2026-04-20T10:00:00+00:00",
            "end_at": "2026-04-20T11:00:00+00:00",
            "participants": [
                {"email": "alice@example.com", "full_name": "Alice"},
            ],
        },
    )
    assert create_response.status_code == 401

    update_response = client.put(
        "/api/v1/bookings/1",
        json={
            "title": "Unauthorized Booking Update",
            "room_id": room_id,
            "start_at": "2026-04-20T10:00:00+00:00",
            "end_at": "2026-04-20T11:00:00+00:00",
            "participants": [
                {"email": "alice@example.com", "full_name": "Alice"},
            ],
        },
    )
    assert update_response.status_code == 401

    cancel_response = client.post("/api/v1/bookings/1/cancel")
    assert cancel_response.status_code == 401
