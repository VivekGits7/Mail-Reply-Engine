from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ReplyContext(BaseModel):
    message_id: Optional[str] = Field(
        default=None, description="Message-ID of the email being answered"
    )
    references: List[str] = Field(
        default_factory=list, description="Earlier Message-IDs in the same thread"
    )
    subject: str = Field(default="", description="Subject of the email being answered")
    sender: str = Field(default="", description="Who wrote the email being answered")
    sent_at: Optional[datetime] = Field(
        default=None, description="When the email being answered was sent"
    )
    quoted_text: str = Field(default="", description="Text quoted under the reply")
