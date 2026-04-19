from __future__ import annotations

from dataclasses import dataclass

from app.db.enums import OutboxEventType
from app.worker.mailer import EmailMessage


EVENT_LABELS = {
    OutboxEventType.BOOKING_CREATED: "created",
    OutboxEventType.BOOKING_UPDATED: "updated",
    OutboxEventType.BOOKING_CANCELED: "canceled",
}


@dataclass(slots=True)
class BookingNotificationContext:
    to_email: str
    from_email: str
    event_type: OutboxEventType
    title: str
    room_name: str
    start_at: str
    end_at: str


def build_booking_notification_email(
    context: BookingNotificationContext,
) -> EmailMessage:
    event_label = EVENT_LABELS[context.event_type]
    subject = f"Meeting room booking {event_label}: {context.title}"
    body = (
        f"Event: {context.event_type.value}\n"
        f"Title: {context.title}\n"
        f"Room: {context.room_name}\n"
        f"Schedule: {context.start_at} to {context.end_at}\n"
    )

    return EmailMessage(
        to_email=context.to_email,
        from_email=context.from_email,
        subject=subject,
        body=body,
    )
