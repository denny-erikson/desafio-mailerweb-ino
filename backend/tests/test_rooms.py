from fastapi.testclient import TestClient


def test_update_room_returns_updated_payload(
    client: TestClient,
    auth_headers: dict[str, str],
    room_id: int,
) -> None:
    response = client.put(
        f"/api/v1/rooms/{room_id}",
        json={"name": "Sala Polaris", "capacity": 14},
        headers=auth_headers,
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == room_id
    assert payload["name"] == "Sala Polaris"
    assert payload["capacity"] == 14
    assert "created_at" in payload
    assert "updated_at" in payload


def test_update_room_blocks_duplicate_name(
    client: TestClient,
    auth_headers: dict[str, str],
    room_id: int,
) -> None:
    first_response = client.post(
        "/api/v1/rooms",
        json={"name": "Sala Aurora", "capacity": 8},
        headers=auth_headers,
    )
    assert first_response.status_code == 201

    response = client.put(
        f"/api/v1/rooms/{room_id}",
        json={"name": "Sala Aurora", "capacity": 10},
        headers=auth_headers,
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Room name already exists"


def test_update_room_validates_capacity(
    client: TestClient,
    auth_headers: dict[str, str],
    room_id: int,
) -> None:
    response = client.put(
        f"/api/v1/rooms/{room_id}",
        json={"name": "Sala Vega", "capacity": 0},
        headers=auth_headers,
    )

    assert response.status_code == 422
