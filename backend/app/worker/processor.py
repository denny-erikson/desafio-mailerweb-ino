from __future__ import annotations

import logging
import time

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.enums import OutboxEventStatus
from app.db.models import OutboxEvent
from app.db.session import SessionLocal
from app.worker.mailer import build_mailer


logger = logging.getLogger(__name__)


class OutboxWorker:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.mailer = build_mailer(self.settings)

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

            try:
                for event in pending_events:
                    self.process_event(db, event)
                    processed_count += 1
                db.commit()
            except Exception:
                db.rollback()
                raise

        logger.info(
            "Outbox worker processed %s pending event(s): %s",
            processed_count,
            [event.id for event in pending_events],
        )
        return processed_count

    def process_event(self, db: Session, event: OutboxEvent) -> None:
        logger.info(
            "Outbox worker received event id=%s type=%s aggregate=%s:%s",
            event.id,
            event.event_type.value,
            event.aggregate_type,
            event.aggregate_id,
        )

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
