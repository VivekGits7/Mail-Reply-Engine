import asyncio
import smtplib
import ssl
from email.message import EmailMessage
from typing import Any, Callable, List

from app.config import settings
from app.error import MailSendException
from app.logger import get_logger

logger = get_logger(__name__)


def _open() -> smtplib.SMTP:
    if settings.SMTP_SECURITY == "ssl":
        server: smtplib.SMTP = smtplib.SMTP_SSL(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            timeout=settings.SMTP_TIMEOUT_SECONDS,
            context=ssl.create_default_context(),
        )
    else:
        server = smtplib.SMTP(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            timeout=settings.SMTP_TIMEOUT_SECONDS,
        )
    try:
        if settings.SMTP_SECURITY == "starttls":
            server.starttls(context=ssl.create_default_context())
        if settings.SMTP_USERNAME:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
    except BaseException:
        server.close()
        raise
    return server


def _send(message: EmailMessage, recipients: List[str]) -> None:
    with _open() as server:
        server.send_message(
            message, from_addr=settings.sender_email, to_addrs=recipients
        )


def _sign_in() -> None:
    with _open() as server:
        server.noop()


async def _run(action: Callable[..., None], *args: Any) -> None:
    if not settings.smtp_configured:
        raise MailSendException("SMTP is not configured")
    try:
        await asyncio.to_thread(action, *args)
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP sign in failed with code {e.smtp_code}")
        raise MailSendException("Could not sign in to the SMTP server") from e
    except smtplib.SMTPRecipientsRefused as e:
        logger.error(f"SMTP refused {len(e.recipients)} recipients")
        raise MailSendException("The SMTP server refused the recipients") from e
    except (smtplib.SMTPException, OSError) as e:
        logger.error(f"SMTP request failed with {type(e).__name__}")
        raise MailSendException() from e


async def send(message: EmailMessage, recipients: List[str]) -> None:
    await _run(_send, message, recipients)


async def check_sign_in() -> None:
    await _run(_sign_in)
