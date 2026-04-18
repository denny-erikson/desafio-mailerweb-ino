from enum import StrEnum


class BookingStatus(StrEnum):
    ACTIVE = "ACTIVE"
    CANCELED = "CANCELED"


class OutboxEventType(StrEnum):
    BOOKING_CREATED = "BOOKING_CREATED"
    BOOKING_UPDATED = "BOOKING_UPDATED"
    BOOKING_CANCELED = "BOOKING_CANCELED"


class OutboxEventStatus(StrEnum):
    PENDING = "PENDING"
    PROCESSED = "PROCESSED"
    FAILED = "FAILED"
