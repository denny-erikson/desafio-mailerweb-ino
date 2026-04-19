from __future__ import annotations

from datetime import UTC, datetime, timedelta
import logging
import time
from typing import Any

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.enums import OutboxEventStatus, OutboxEventType
from app.db.models import OutboxEvent
from app.db.session import SessionLocal
from app.worker.mailer import Mailer, build_mailer
from app.worker.notifications import (
    BookingNotificationContext,
    build_booking_notification_email,
)


logger = logging.getLogger(__name__)


class OutboxWorker:
    def __init__(self, mailer: Mailer | None = None) -> None:
        self.settings = get_settings()
        self.mailer = mailer or build_mailer(self.settings)

    def run_forever(self) -> None:
        logger.info(
            "Outbox worker started with poll interval %ss",
            self.settings.worker_poll_interval_seconds,
        )
        while True:
            processed = self.run_once()
            logger.debug("Outbox worker cycle completed. pending=%s", processed)
            time.sleep(self.settings.worker_poll_interval_seconds)

    def run_once(self) -> int:
        with SessionLocal() as db:
            pending_events = self._fetch_pending_events(db)
            processed_count = 0
            failed_count = 0

            try:
                for event in pending_events:
                    try:
                        self.process_event(db, event)
                        processed_count += 1
                    except Exception as exc:
                        self._handle_processing_failure(event, exc)
                        failed_count += 1
                db.commit()
            except Exception:
                db.rollback()
                raise

        logger.info(
            "Outbox worker processed %s pending event(s) and failed %s: %s",
            processed_count,
            failed_count,
            [event.id for event in pending_events],
        )
        return processed_count

    def process_event(self, db: Session, event: OutboxEvent) -> None:
        if event.status == OutboxEventStatus.PROCESSED or event.processed_at is not None:
            logger.info(
                "Skipping already processed event id=%s idempotency_key=%s",
                event.id,
                event.idempotency_key,
            )
            return

        logger.info(
            "Outbox worker received event id=%s type=%s aggregate=%s:%s",
            event.id,
            event.event_type.value,
            event.aggregate_type,
            event.aggregate_id,
        )
        if event.aggregate_type != "booking":
            logger.warning(
                "Skipping unsupported aggregate type for event id=%s aggregate=%s",
                event.id,
                event.aggregate_type,
            )
            return

        self._process_booking_event(event)
        event.status = OutboxEventStatus.PROCESSED
        event.processed_at = datetime.now(UTC)
        event.next_retry_at = None
        event.last_error = None
        logger.info("Outbox event id=%s marked as PROCESSED", event.id)

    def _handle_processing_failure(
        self,
        event: OutboxEvent,
        error: Exception,
    ) -> None:
        event.attempts += 1
        event.last_error = str(error)
        event.processed_at = None

        if event.attempts >= self.settings.outbox_max_attempts:
            event.status = OutboxEventStatus.FAILED
            event.next_retry_at = None
            logger.exception(
                "Outbox event id=%s marked as FAILED after %s attempt(s)",
                event.id,
                event.attempts,
                exc_info=error,
            )
            return

        event.status = OutboxEventStatus.PENDING
        event.next_retry_at = datetime.now(UTC) + timedelta(
            seconds=self.settings.outbox_retry_delay_seconds,
        )
        logger.exception(
            "Outbox event id=%s failed on attempt %s; scheduled retry",
            event.id,
            event.attempts,
            exc_info=error,
        )

    def _process_booking_event(self, event: OutboxEvent) -> None:
        payload = self._validate_booking_payload(event.payload)

        if event.event_type not in {
            OutboxEventType.BOOKING_CREATED,
            OutboxEventType.BOOKING_UPDATED,
            OutboxEventType.BOOKING_CANCELED,
        }:
            logger.warning(
                "Skipping unsupported booking event type for event id=%s type=%s",
                event.id,
                event.event_type.value,
            )
            return

        for participant in payload["participants"]:
            message = build_booking_notification_email(
                BookingNotificationContext(
                    to_email=participant["email"],
                    from_email=self.settings.mailer_from_email,
                    event_type=event.event_type,
                    title=payload["title"],
                    room_name=payload["room"]["name"],
                    start_at=payload["start_at"],
                    end_at=payload["end_at"],
                ),
            )
            self.mailer.send(message)

    def _validate_booking_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        if "title" not in payload:
            raise ValueError("Booking outbox payload missing title")
        if "room" not in payload or "name" not in payload["room"]:
            raise ValueError("Booking outbox payload missing room name")
        if "start_at" not in payload or "end_at" not in payload:
            raise ValueError("Booking outbox payload missing schedule")
        if "participants" not in payload or not isinstance(payload["participants"], list):
            raise ValueError("Booking outbox payload missing participants")

        return payload

    def _pending_events_statement(self) -> Select[tuple[OutboxEvent]]:
        return (
            select(OutboxEvent)
            .where(
                OutboxEvent.status == OutboxEventStatus.PENDING,
                OutboxEvent.attempts < self.settings.outbox_max_attempts,
                or_(
                    OutboxEvent.next_retry_at.is_(None),
                    OutboxEvent.next_retry_at <= func.now(),
                ),
            )
            .order_by(OutboxEvent.created_at.asc(), OutboxEvent.id.asc())
            .limit(self.settings.worker_batch_size)
            .with_for_update(skip_locked=True)
        )

    def _fetch_pending_events(self, db: Session) -> list[OutboxEvent]:
        statement = self._pending_events_statement()
        return list(db.scalars(statement).all())
