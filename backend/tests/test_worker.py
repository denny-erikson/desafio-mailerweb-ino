from datetime import UTC, datetime, timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.db.enums import OutboxEventStatus, OutboxEventType
from app.db.models import OutboxEvent
from app.db.session import SessionLocal
from app.worker.processor import OutboxWorker


class RecordingWorker(OutboxWorker):
    def __init__(self) -> None:
        super().__init__()
        self.processed_event_ids: list[int] = []

    def process_event(self, db: Session, event: OutboxEvent) -> None:
        self.processed_event_ids.append(event.id)


def test_worker_fetches_only_eligible_pending_events() -> None:
    worker = OutboxWorker()
    created_ids: list[int] = []

    with SessionLocal() as db:
        eligible_event = OutboxEvent(
            aggregate_type="booking",
            aggregate_id=101,
            event_type=OutboxEventType.BOOKING_CREATED,
            payload={"title": "Eligible"},
            status=OutboxEventStatus.PENDING,
            idempotency_key="worker-test-eligible",
        )
        future_retry_event = OutboxEvent(
            aggregate_type="booking",
            aggregate_id=102,
            event_type=OutboxEventType.BOOKING_UPDATED,
            payload={"title": "Future"},
            status=OutboxEventStatus.PENDING,
            idempotency_key="worker-test-future",
            next_retry_at=datetime.now(UTC) + timedelta(minutes=5),
        )
        processed_event = OutboxEvent(
            aggregate_type="booking",
            aggregate_id=103,
            event_type=OutboxEventType.BOOKING_CANCELED,
            payload={"title": "Processed"},
            status=OutboxEventStatus.PROCESSED,
            idempotency_key="worker-test-processed",
        )

        db.add_all([eligible_event, future_retry_event, processed_event])
        db.commit()
        created_ids.extend(
            [eligible_event.id, future_retry_event.id, processed_event.id],
        )

        fetched_events = worker._fetch_pending_events(db)
        fetched_ids = [event.id for event in fetched_events]

    try:
        assert eligible_event.id in fetched_ids
        assert future_retry_event.id not in fetched_ids
        assert processed_event.id not in fetched_ids
    finally:
        with SessionLocal() as db:
            db.execute(delete(OutboxEvent).where(OutboxEvent.id.in_(created_ids)))
            db.commit()


def test_worker_respects_batch_size_ordering() -> None:
    worker = OutboxWorker()
    worker.settings.worker_batch_size = 2
    created_ids: list[int] = []

    with SessionLocal() as db:
        events = [
            OutboxEvent(
                aggregate_type="booking",
                aggregate_id=201 + offset,
                event_type=OutboxEventType.BOOKING_CREATED,
                payload={"index": offset},
                status=OutboxEventStatus.PENDING,
                idempotency_key=f"worker-batch-{offset}",
            )
            for offset in range(3)
        ]
        db.add_all(events)
        db.commit()
        created_ids.extend(event.id for event in events)

        fetched_events = worker._fetch_pending_events(db)
        fetched_ids = [event.id for event in fetched_events]

    try:
        assert len(fetched_ids) == 2
        assert fetched_ids == created_ids[:2]
    finally:
        with SessionLocal() as db:
            db.execute(delete(OutboxEvent).where(OutboxEvent.id.in_(created_ids)))
            db.commit()


def test_run_once_processes_events_in_stable_batch_order() -> None:
    worker = RecordingWorker()
    worker.settings.worker_batch_size = 2
    created_ids: list[int] = []

    with SessionLocal() as db:
        events = [
            OutboxEvent(
                aggregate_type="booking",
                aggregate_id=301 + offset,
                event_type=OutboxEventType.BOOKING_CREATED,
                payload={"index": offset},
                status=OutboxEventStatus.PENDING,
                idempotency_key=f"worker-run-once-{offset}",
            )
            for offset in range(3)
        ]
        db.add_all(events)
        db.commit()
        created_ids.extend(event.id for event in events)

    try:
        processed_count = worker.run_once()

        assert processed_count == 2
        assert worker.processed_event_ids == created_ids[:2]
    finally:
        with SessionLocal() as db:
            db.execute(delete(OutboxEvent).where(OutboxEvent.id.in_(created_ids)))
            db.commit()
