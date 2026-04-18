from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum, Index, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.enums import OutboxEventStatus, OutboxEventType


class OutboxEvent(Base):
    __tablename__ = "outbox_events"
    __table_args__ = (
        Index(
            "ix_outbox_events_status_next_retry_at_created_at",
            "status",
            "next_retry_at",
            "created_at",
        ),
        Index(
            "ix_outbox_events_aggregate_type_aggregate_id",
            "aggregate_type",
            "aggregate_id",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    aggregate_type: Mapped[str] = mapped_column(String(100), nullable=False)
    aggregate_id: Mapped[int] = mapped_column(nullable=False)
    event_type: Mapped[OutboxEventType] = mapped_column(
        Enum(OutboxEventType, name="outbox_event_type"),
        nullable=False,
    )
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[OutboxEventStatus] = mapped_column(
        Enum(OutboxEventStatus, name="outbox_event_status"),
        default=OutboxEventStatus.PENDING,
        nullable=False,
    )
    idempotency_key: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
    )
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
