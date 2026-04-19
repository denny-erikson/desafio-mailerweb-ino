from datetime import UTC, datetime, timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.db.enums import OutboxEventStatus, OutboxEventType
from app.db.models import OutboxEvent
from app.db.session import SessionLocal
from app.worker.mailer import EmailMessage
from app.worker.processor import OutboxWorker


class RecordingMailer:
    def __init__(self) -> None:
        self.messages: list[EmailMessage] = []

    def send(self, message: EmailMessage) -> None:
        self.messages.append(message)


class FailingMailer:
    def __init__(self, error_message: str = "mailer failure") -> None:
        self.error_message = error_message

    def send(self, message: EmailMessage) -> None:
        raise RuntimeError(self.error_message)


class RecordingWorker(OutboxWorker):
    def __init__(self, mailer: RecordingMailer | None = None) -> None:
        super().__init__(mailer=mailer)
        self.processed_event_ids: list[int] = []

    def process_event(self, db: Session, event: OutboxEvent) -> None:
        self.processed_event_ids.append(event.id)


def build_booking_payload(title: str) -> dict:
    return {
        "booking_id": 1,
        "title": title,
        "room": {"id": 10, "name": "Sala Azul"},
        "created_by_user_id": 3,
        "status": "ACTIVE",
        "start_at": "2026-04-20T10:00:00+00:00",
        "end_at": "2026-04-20T11:00:00+00:00",
        "canceled_at": None,
        "participants": [
            {"email": "alice@example.com", "full_name": "Alice"},
            {"email": "bob@example.com", "full_name": "Bob"},
        ],
    }


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


def test_worker_processes_booking_created_event() -> None:
    mailer = RecordingMailer()
    worker = OutboxWorker(mailer=mailer)
    event = OutboxEvent(
        aggregate_type="booking",
        aggregate_id=401,
        event_type=OutboxEventType.BOOKING_CREATED,
        payload=build_booking_payload("Planning"),
        status=OutboxEventStatus.PENDING,
        idempotency_key="process-created",
    )

    with SessionLocal() as db:
        worker.process_event(db, event)

    assert len(mailer.messages) == 2
    assert mailer.messages[0].subject == "Meeting room booking created: Planning"
    assert mailer.messages[0].to_email == "alice@example.com"
    assert event.status == OutboxEventStatus.PROCESSED
    assert event.processed_at is not None


def test_worker_processes_booking_updated_event() -> None:
    mailer = RecordingMailer()
    worker = OutboxWorker(mailer=mailer)
    event = OutboxEvent(
        aggregate_type="booking",
        aggregate_id=402,
        event_type=OutboxEventType.BOOKING_UPDATED,
        payload=build_booking_payload("Planning Updated"),
        status=OutboxEventStatus.PENDING,
        idempotency_key="process-updated",
    )

    with SessionLocal() as db:
        worker.process_event(db, event)

    assert len(mailer.messages) == 2
    assert mailer.messages[0].subject == (
        "Meeting room booking updated: Planning Updated"
    )
    assert event.status == OutboxEventStatus.PROCESSED
    assert event.processed_at is not None


def test_worker_processes_booking_canceled_event() -> None:
    mailer = RecordingMailer()
    worker = OutboxWorker(mailer=mailer)
    payload = build_booking_payload("Planning Canceled")
    payload["canceled_at"] = "2026-04-20T09:00:00+00:00"
    event = OutboxEvent(
        aggregate_type="booking",
        aggregate_id=403,
        event_type=OutboxEventType.BOOKING_CANCELED,
        payload=payload,
        status=OutboxEventStatus.PENDING,
        idempotency_key="process-canceled",
    )

    with SessionLocal() as db:
        worker.process_event(db, event)

    assert len(mailer.messages) == 2
    assert mailer.messages[0].subject == (
        "Meeting room booking canceled: Planning Canceled"
    )
    assert event.status == OutboxEventStatus.PROCESSED
    assert event.processed_at is not None


def test_worker_skips_already_processed_event_idempotently() -> None:
    mailer = RecordingMailer()
    worker = OutboxWorker(mailer=mailer)
    event = OutboxEvent(
        aggregate_type="booking",
        aggregate_id=404,
        event_type=OutboxEventType.BOOKING_CREATED,
        payload=build_booking_payload("Idempotent Booking"),
        status=OutboxEventStatus.PENDING,
        idempotency_key="idempotent-event",
    )

    with SessionLocal() as db:
        worker.process_event(db, event)
        first_processed_at = event.processed_at
        worker.process_event(db, event)

    assert len(mailer.messages) == 2
    assert event.status == OutboxEventStatus.PROCESSED
    assert event.processed_at == first_processed_at


def test_worker_retries_failed_event_and_persists_error_state() -> None:
    worker = OutboxWorker(mailer=FailingMailer("temporary mailer error"))
    created_ids: list[int] = []

    with SessionLocal() as db:
        event = OutboxEvent(
            aggregate_type="booking",
            aggregate_id=501,
            event_type=OutboxEventType.BOOKING_CREATED,
            payload=build_booking_payload("Retry Booking"),
            status=OutboxEventStatus.PENDING,
            idempotency_key="retry-event",
        )
        db.add(event)
        db.commit()
        created_ids.append(event.id)

    try:
        processed_count = worker.run_once()
        assert processed_count == 0

        with SessionLocal() as db:
            refreshed_event = db.get(OutboxEvent, event.id)

        assert refreshed_event is not None
        assert refreshed_event.status == OutboxEventStatus.PENDING
        assert refreshed_event.attempts == 1
        assert refreshed_event.last_error == "temporary mailer error"
        assert refreshed_event.processed_at is None
        assert refreshed_event.next_retry_at is not None
    finally:
        with SessionLocal() as db:
            db.execute(delete(OutboxEvent).where(OutboxEvent.id.in_(created_ids)))
            db.commit()


def test_worker_marks_event_failed_after_max_attempts() -> None:
    worker = OutboxWorker(mailer=FailingMailer("permanent mailer error"))
    created_ids: list[int] = []

    with SessionLocal() as db:
        event = OutboxEvent(
            aggregate_type="booking",
            aggregate_id=502,
            event_type=OutboxEventType.BOOKING_CREATED,
            payload=build_booking_payload("Fail Booking"),
            status=OutboxEventStatus.PENDING,
            attempts=worker.settings.outbox_max_attempts - 1,
            idempotency_key="failed-event",
        )
        db.add(event)
        db.commit()
        created_ids.append(event.id)

    try:
        processed_count = worker.run_once()
        assert processed_count == 0

        with SessionLocal() as db:
            refreshed_event = db.get(OutboxEvent, event.id)

        assert refreshed_event is not None
        assert refreshed_event.status == OutboxEventStatus.FAILED
        assert refreshed_event.attempts == worker.settings.outbox_max_attempts
        assert refreshed_event.last_error == "permanent mailer error"
        assert refreshed_event.processed_at is None
        assert refreshed_event.next_retry_at is None
    finally:
        with SessionLocal() as db:
            db.execute(delete(OutboxEvent).where(OutboxEvent.id.in_(created_ids)))
            db.commit()
