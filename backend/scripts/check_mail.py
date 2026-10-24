import argparse
import asyncio
import sys
from pathlib import Path
from typing import Optional

# Lets `guvrun scripts/<name>.py` import app the same way `-m scripts.<name>` does.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import smtp
from app.config import settings
from app.error import AppException
from app.graph import mail as graph_mail
from app.graph.client import close as close_graph
from app.graph.client import mailbox_path, request

TEST_TEXT = "This is a test from the HR email agent. No action is needed."


async def check_graph() -> bool:
    if not settings.graph_configured:
        print(
            "Graph: not configured, fill GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET and GRAPH_MAILBOX"
        )
        return False
    try:
        inbox = (
            await request(
                "GET",
                f"{mailbox_path()}/mailFolders('inbox')",
                params={"$select": "totalItemCount,unreadItemCount"},
                prefer=None,
            )
        ).json()
    except AppException as e:
        print(f"Graph: cannot read {settings.mailbox}, {e.detail}")
        return False
    print(
        f"Graph: reads {settings.mailbox}, {inbox.get('totalItemCount', 0)} emails in the inbox, {inbox.get('unreadItemCount', 0)} unread"
    )
    try:
        await request(
            "GET", f"{mailbox_path()}/calendar", params={"$select": "id"}, prefer=None
        )
        print("Graph: calendar access works, induction invites can be booked")
    except AppException:
        print(
            "Graph: no calendar access, induction booking needs Calendars.ReadWrite on the app"
        )
    return True


async def check_smtp() -> bool:
    if not settings.smtp_configured:
        print("SMTP: not configured, skipped")
        return settings.MAIL_SEND_PROVIDER != "smtp"
    try:
        await smtp.check_sign_in()
    except AppException as e:
        print(f"SMTP: {e.detail}")
        return False
    print(f"SMTP: signed in to {settings.SMTP_HOST}:{settings.SMTP_PORT}")
    return True


async def send_test(address: str) -> bool:
    provider = settings.MAIL_SEND_PROVIDER
    subject = f"{settings.APP_NAME} test email"
    html_body = f"<p>{TEST_TEXT}</p>"
    try:
        if provider == "smtp":
            await smtp.send_mail(
                subject=subject,
                html_body=html_body,
                text_body=TEST_TEXT,
                to=[address],
                cc=[],
            )
        else:
            await graph_mail.send_mail(
                subject=subject, html_body=html_body, to=[address], cc=[]
            )
    except AppException as e:
        print(f"Send: failed through {provider}, {e.detail}")
        return False
    print(f"Send: test email sent to {address} through {provider}")
    return True


async def run(send_to: Optional[str]) -> bool:
    print(f"Sending through {settings.MAIL_SEND_PROVIDER}, reading through Graph")
    try:
        ok = await check_graph()
        ok = await check_smtp() and ok
        if send_to:
            ok = await send_test(send_to) and ok
    finally:
        await close_graph()
    return ok


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Check the mailbox credentials in .env without starting the API"
    )
    parser.add_argument("--send-to", help="Also send one test email to this address")
    args = parser.parse_args()
    if not asyncio.run(run(args.send_to)):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
