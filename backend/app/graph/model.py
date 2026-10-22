import uuid
from datetime import datetime
from typing import Optional

from app.database import execute_command, execute_command_with_return


class MailboxState:
    def __init__(self, **kwargs):
        self.mailbox_state_id: uuid.UUID = kwargs["mailbox_state_id"]
        self.mailbox: str = kwargs["mailbox"]
        self.delta_link: Optional[str] = kwargs.get("delta_link")
        self.subscription_id: Optional[str] = kwargs.get("subscription_id")
        self.subscription_expires_at: Optional[datetime] = kwargs.get(
            "subscription_expires_at"
        )
        self.last_poll_at: Optional[datetime] = kwargs.get("last_poll_at")
        self.last_email_at: Optional[datetime] = kwargs.get("last_email_at")

    @classmethod
    async def get(cls, mailbox: str) -> "MailboxState":
        row = await execute_command_with_return(
            # SQL
            """
            INSERT INTO mailbox_state (mailbox_state_id, mailbox)
            VALUES ($1, LOWER($2))
            ON CONFLICT (mailbox) DO UPDATE SET mailbox = EXCLUDED.mailbox
            RETURNING *
            """,
            uuid.uuid4(),
            mailbox,
        )
        return cls(**dict(row))

    async def save_delta(self, delta_link: str) -> None:
        self.delta_link = delta_link
        await execute_command(
            "UPDATE mailbox_state SET delta_link = $2, last_poll_at = NOW(), updated_at = NOW() WHERE mailbox_state_id = $1",
            self.mailbox_state_id,
            delta_link,
        )

    async def save_subscription(
        self, subscription_id: Optional[str], expires_at: Optional[datetime]
    ) -> None:
        self.subscription_id = subscription_id
        self.subscription_expires_at = expires_at
        await execute_command(
            # SQL
            """
            UPDATE mailbox_state
            SET subscription_id = $2, subscription_expires_at = $3, updated_at = NOW()
            WHERE mailbox_state_id = $1
            """,
            self.mailbox_state_id,
            subscription_id,
            expires_at,
        )

    @staticmethod
    async def touch_email(mailbox: str) -> None:
        await execute_command(
            "UPDATE mailbox_state SET last_email_at = NOW(), updated_at = NOW() WHERE mailbox = LOWER($1)",
            mailbox,
        )
