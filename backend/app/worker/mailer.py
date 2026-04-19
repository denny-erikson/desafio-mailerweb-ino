from __future__ import annotations

import logging
from dataclasses import dataclass
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


def build_mailer(settings: Settings) -> Mailer:
    if settings.mailer_provider == "console":
        return ConsoleMailer()

    raise ValueError(f"Unsupported mailer provider: {settings.mailer_provider}")
