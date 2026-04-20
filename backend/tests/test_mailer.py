import logging

import pytest

from app.core.config import Settings
from app.worker.mailer import ConsoleMailer, EmailMessage, SmtpMailer, build_mailer


def test_build_mailer_returns_console_mailer() -> None:
    settings = Settings()

    mailer = build_mailer(settings)

    assert isinstance(mailer, ConsoleMailer)


def test_build_mailer_returns_smtp_mailer(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MAILER_PROVIDER", "smtp")
    monkeypatch.setenv("MAILER_SMTP_HOST", "mailhog")
    monkeypatch.setenv("MAILER_SMTP_PORT", "1025")

    settings = Settings()

    mailer = build_mailer(settings)

    assert isinstance(mailer, SmtpMailer)
    assert mailer.host == "mailhog"
    assert mailer.port == 1025


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


def test_smtp_mailer_sends_message(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    class FakeSMTP:
        def __init__(self, host: str, port: int, timeout: int) -> None:
            captured["connection"] = {
                "host": host,
                "port": port,
                "timeout": timeout,
            }
            captured["starttls_called"] = False
            captured["login_called"] = False

        def __enter__(self) -> "FakeSMTP":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            return None

        def starttls(self) -> None:
            captured["starttls_called"] = True

        def login(self, username: str, password: str) -> None:
            captured["login_called"] = True
            captured["credentials"] = {
                "username": username,
                "password": password,
            }

        def send_message(self, smtp_message) -> None:
            captured["message"] = {
                "from": smtp_message["From"],
                "to": smtp_message["To"],
                "subject": smtp_message["Subject"],
                "body": smtp_message.get_content(),
            }

    monkeypatch.setattr("app.worker.mailer.smtplib.SMTP", FakeSMTP)

    mailer = SmtpMailer(
        host="mailhog",
        port=1025,
        username="user",
        password="secret",
        use_tls=True,
        use_ssl=False,
        timeout_seconds=15,
    )
    message = EmailMessage(
        from_email="no-reply@example.com",
        to_email="alice@example.com",
        subject="Reserva criada",
        body="Sua reserva foi criada com sucesso.",
    )

    mailer.send(message)

    assert captured["connection"] == {
        "host": "mailhog",
        "port": 1025,
        "timeout": 15,
    }
    assert captured["starttls_called"] is True
    assert captured["login_called"] is True
    assert captured["credentials"] == {
        "username": "user",
        "password": "secret",
    }
    assert captured["message"] == {
        "from": "no-reply@example.com",
        "to": "alice@example.com",
        "subject": "Reserva criada",
        "body": "Sua reserva foi criada com sucesso.\n",
    }
