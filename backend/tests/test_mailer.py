import logging

import pytest

from app.core.config import Settings
from app.worker.mailer import ConsoleMailer, EmailMessage, build_mailer


def test_build_mailer_returns_console_mailer() -> None:
    settings = Settings()

    mailer = build_mailer(settings)

    assert isinstance(mailer, ConsoleMailer)


def test_console_mailer_logs_message(caplog: pytest.LogCaptureFixture) -> None:
    mailer = ConsoleMailer()
    message = EmailMessage(
        from_email="no-reply@example.com",
        to_email="alice@example.com",
        subject="Test subject",
        body="Test body",
    )

    with caplog.at_level(logging.INFO):
        mailer.send(message)

    assert "Console mailer sending email" in caplog.text
    assert "alice@example.com" in caplog.text
    assert "Test subject" in caplog.text
