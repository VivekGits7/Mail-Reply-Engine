from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class GraphMessage(BaseModel):
    id: str = Field(..., description="Immutable Graph message id")
    internet_message_id: Optional[str] = Field(
        default=None, description="Message-ID header"
    )
    conversation_id: Optional[str] = Field(
        default=None, description="Thread id shared by every reply"
    )
    subject: str = Field(default="", description="Subject line")
    from_email: str = Field(default="", description="Sender address, lowercased")
    from_name: Optional[str] = Field(default=None, description="Sender display name")
    to: List[str] = Field(default_factory=list, description="To addresses")
    cc: List[str] = Field(default_factory=list, description="CC addresses")
    received_at: Optional[datetime] = Field(default=None, description="Received time")
    has_attachments: bool = Field(
        default=False, description="Whether files are attached"
    )
    is_receipt: bool = Field(default=False, description="Delivery or read receipt")
    headers: Dict[str, str] = Field(
        default_factory=dict, description="Internet headers, lowercased names"
    )
    body_text: str = Field(default="", description="Full body as text")
    unique_body_text: str = Field(
        default="", description="Only the new part of a reply"
    )


class GraphAttachment(BaseModel):
    id: str = Field(..., description="Attachment id")
    name: str = Field(default="attachment", description="File name")
    content_type: str = Field(
        default="application/octet-stream", description="MIME type"
    )
    size: int = Field(default=0, description="Size in bytes")
    is_inline: bool = Field(
        default=False, description="Inline image such as a signature logo"
    )
    kind: str = Field(default="file", description="file, item or reference")
    content: Optional[bytes] = Field(default=None, description="File bytes")


class SentMail(BaseModel):
    graph_message_id: Optional[str] = Field(
        default=None,
        description="Immutable id of the sent message, empty until Graph sees it",
    )
    internet_message_id: Optional[str] = Field(
        default=None, description="Message-ID header"
    )
    conversation_id: Optional[str] = Field(default=None, description="Thread id")


class BusySlot(BaseModel):
    start: datetime = Field(..., description="Busy from")
    end: datetime = Field(..., description="Busy until")
