from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage as SmtpEmailMessage
from typing import Protocol

from app.core.config import Settings


logger = logging.getLogger(__name__)


@dataclass(slots=True)
class EmailMessage:
    to_email: str
    subject: str
    body: str
    from_email: str


class Mailer(Protocol):
    def send(self, message: EmailMessage) -> None:
        """Send an email message."""


class ConsoleMailer:
    def send(self, message: EmailMessage) -> None:
        logger.info(
            "Console mailer sending email from=%s to=%s subject=%s body=%s",
            message.from_email,
            message.to_email,
            message.subject,
            message.body,
        )


@dataclass(slots=True)
class SmtpMailer:
    host: str
    port: int
    username: str | None
    password: str | None
    use_tls: bool
    use_ssl: bool
    timeout_seconds: int

    def __post_init__(self) -> None:
        if self.use_tls and self.use_ssl:
            raise ValueError("SMTP mailer cannot use TLS and SSL at the same time")

    def send(self, message: EmailMessage) -> None:
        smtp_message = SmtpEmailMessage()
        smtp_message["From"] = message.from_email
        smtp_message["To"] = message.to_email
        smtp_message["Subject"] = message.subject
        smtp_message.set_content(message.body)

        smtp_client_factory = smtplib.SMTP_SSL if self.use_ssl else smtplib.SMTP

        with smtp_client_factory(
            host=self.host,
            port=self.port,
            timeout=self.timeout_seconds,
        ) as smtp_client:
            if self.use_tls:
                smtp_client.starttls()

            if self.username:
                smtp_client.login(self.username, self.password or "")

            smtp_client.send_message(smtp_message)

        logger.info(
            "SMTP mailer sent email host=%s port=%s from=%s to=%s subject=%s",
            self.host,
            self.port,
            message.from_email,
            message.to_email,
            message.subject,
        )


def build_mailer(settings: Settings) -> Mailer:
    if settings.mailer_provider == "console":
        return ConsoleMailer()

    if settings.mailer_provider == "smtp":
        return SmtpMailer(
            host=settings.mailer_smtp_host,
            port=settings.mailer_smtp_port,
            username=settings.mailer_smtp_username,
            password=settings.mailer_smtp_password,
            use_tls=settings.mailer_smtp_use_tls,
            use_ssl=settings.mailer_smtp_use_ssl,
            timeout_seconds=settings.mailer_smtp_timeout_seconds,
        )

    raise ValueError(f"Unsupported mailer provider: {settings.mailer_provider}")
