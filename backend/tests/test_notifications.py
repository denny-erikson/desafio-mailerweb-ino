from app.db.enums import OutboxEventType
from app.worker.notifications import (
    BookingNotificationContext,
    build_booking_notification_email,
)


def test_build_booking_created_notification_email() -> None:
    message = build_booking_notification_email(
        BookingNotificationContext(
            to_email="alice@example.com",
            from_email="no-reply@example.com",
            event_type=OutboxEventType.BOOKING_CREATED,
            title="Planning Session",
            room_name="Sala Azul",
            start_at="2026-04-20T10:00:00+00:00",
            end_at="2026-04-20T11:00:00+00:00",
        ),
    )

    assert message.to_email == "alice@example.com"
    assert message.from_email == "no-reply@example.com"
    assert message.subject == "Meeting room booking created: Planning Session"
    assert "Event: BOOKING_CREATED" in message.body
    assert "Title: Planning Session" in message.body
    assert "Room: Sala Azul" in message.body
    assert "Schedule: 2026-04-20T10:00:00+00:00 to 2026-04-20T11:00:00+00:00" in message.body


def test_build_booking_canceled_notification_email() -> None:
    message = build_booking_notification_email(
        BookingNotificationContext(
            to_email="bob@example.com",
            from_email="no-reply@example.com",
            event_type=OutboxEventType.BOOKING_CANCELED,
            title="Retro",
            room_name="Sala Verde",
            start_at="2026-04-21T14:00:00+00:00",
            end_at="2026-04-21T15:00:00+00:00",
        ),
    )

    assert message.subject == "Meeting room booking canceled: Retro"
    assert "Event: BOOKING_CANCELED" in message.body
    assert "Room: Sala Verde" in message.body
