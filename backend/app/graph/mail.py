import base64
from datetime import datetime
from email import message_from_bytes, policy
from email.message import EmailMessage
from typing import Any, Dict, List, Optional, Tuple

from app.graph.client import IMMUTABLE_IDS, http, mailbox_path, request
from app.graph.schemas import GraphAttachment, GraphMessage, SentMail
from app.logger import get_logger

logger = get_logger(__name__)

MESSAGE_FIELDS = ",".join(
    [
        "id",
        "internetMessageId",
        "conversationId",
        "subject",
        "from",
        "toRecipients",
        "ccRecipients",
        "receivedDateTime",
        "hasAttachments",
        "isDeliveryReceipt",
        "isReadReceipt",
        "internetMessageHeaders",
        "body",
        "uniqueBody",
    ]
)
TEXT_BODY_PREFER = f'{IMMUTABLE_IDS}, outlook.body-content-type="text"'
DELTA_PREFER = f"{IMMUTABLE_IDS}, odata.maxpagesize=50"
SIMPLE_ATTACHMENT_LIMIT = 3 * 1024 * 1024
UPLOAD_CHUNK_BYTES = 4 * 320 * 1024


def _address(node: Optional[Dict[str, Any]]) -> Tuple[str, Optional[str]]:
    email = (node or {}).get("emailAddress") or {}
    return (email.get("address") or "").strip().lower(), email.get("name")


def _addresses(nodes: Optional[List[Dict[str, Any]]]) -> List[str]:
    return [
        address for address, _ in (_address(node) for node in nodes or []) if address
    ]


def _parse_time(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def parse_message(raw: Dict[str, Any]) -> GraphMessage:
    from_email, from_name = _address(raw.get("from"))
    headers = {
        h["name"].lower(): h.get("value", "")
        for h in raw.get("internetMessageHeaders") or []
        if h.get("name")
    }
    return GraphMessage(
        id=raw["id"],
        internet_message_id=raw.get("internetMessageId"),
        conversation_id=raw.get("conversationId"),
        subject=raw.get("subject") or "",
        from_email=from_email,
        from_name=from_name,
        to=_addresses(raw.get("toRecipients")),
        cc=_addresses(raw.get("ccRecipients")),
        received_at=_parse_time(raw.get("receivedDateTime")),
        has_attachments=bool(raw.get("hasAttachments")),
        is_receipt=bool(raw.get("isDeliveryReceipt") or raw.get("isReadReceipt")),
        headers=headers,
        body_text=(raw.get("body") or {}).get("content") or "",
        unique_body_text=(raw.get("uniqueBody") or {}).get("content") or "",
    )


async def get_message(message_id: str) -> GraphMessage:
    response = await request(
        "GET",
        f"{mailbox_path()}/messages/{message_id}",
        params={"$select": MESSAGE_FIELDS},
        prefer=TEXT_BODY_PREFER,
    )
    return parse_message(response.json())


def extract_mime_attachments(raw: bytes) -> List[GraphAttachment]:
    message: EmailMessage = message_from_bytes(raw, policy=policy.default)
    found: List[GraphAttachment] = []
    for index, part in enumerate(message.walk(), start=1):
        if part.is_multipart():
            continue
        file_name = part.get_filename()
        is_file = part.get_content_disposition() == "attachment" or (
            file_name and part.get_content_maintype() not in ("text", "multipart")
        )
        if not is_file:
            continue
        content = part.get_payload(decode=True)
        if not isinstance(content, bytes) or not content:
            continue
        found.append(
            GraphAttachment(
                id=f"mime-{index}",
                name=file_name or f"attachment-{index}",
                content_type=part.get_content_type().lower(),
                size=len(content),
                is_inline=part.get_content_disposition() == "inline",
                kind="file",
                content=content,
            )
        )
    return found


async def _attachment_value(message_id: str, attachment_id: str) -> bytes:
    response = await request(
        "GET",
        f"{mailbox_path()}/messages/{message_id}/attachments/{attachment_id}/$value",
    )
    return response.content


async def list_attachments(message_id: str) -> List[GraphAttachment]:
    response = await request(
        "GET", f"{mailbox_path()}/messages/{message_id}/attachments"
    )
    attachments: List[GraphAttachment] = []
    for item in response.json().get("value", []):
        odata_type = item.get("@odata.type", "")
        if odata_type.endswith("fileAttachment"):
            content = (
                base64.b64decode(item["contentBytes"])
                if item.get("contentBytes")
                else await _attachment_value(message_id, item["id"])
            )
            attachments.append(
                GraphAttachment(
                    id=item["id"],
                    name=item.get("name") or "attachment",
                    content_type=(
                        item.get("contentType") or "application/octet-stream"
                    ).lower(),
                    size=item.get("size") or len(content),
                    is_inline=bool(item.get("isInline")),
                    kind="file",
                    content=content,
                )
            )
        elif odata_type.endswith("itemAttachment"):
            raw = await _attachment_value(message_id, item["id"])
            attachments.extend(extract_mime_attachments(raw))
        else:
            logger.info(
                "Skipping a reference attachment, links to cloud files are not downloaded"
            )
    return attachments


async def delta(delta_link: Optional[str]) -> Tuple[List[str], str]:
    baseline = delta_link is None
    url = delta_link or f"{mailbox_path()}/mailFolders('inbox')/messages/delta"
    params = None if delta_link else {"$select": "id,receivedDateTime"}
    message_ids: List[str] = []
    while True:
        response = await request(
            "GET",
            url,
            params=params,
            prefer=DELTA_PREFER,
            absolute_url=url.startswith("http"),
        )
        body = response.json()
        if not baseline:
            message_ids.extend(
                item["id"] for item in body.get("value", []) if "@removed" not in item
            )
        if body.get("@odata.nextLink"):
            url, params = body["@odata.nextLink"], None
            continue
        return message_ids, body["@odata.deltaLink"]


def _recipients(addresses: List[str]) -> List[Dict[str, Any]]:
    return [{"emailAddress": {"address": address}} for address in addresses]


async def _attach(draft_id: str, name: str, content_type: str, data: bytes) -> None:
    base = f"{mailbox_path()}/messages/{draft_id}/attachments"
    if len(data) <= SIMPLE_ATTACHMENT_LIMIT:
        await request(
            "POST",
            base,
            json={
                "@odata.type": "#microsoft.graph.fileAttachment",
                "name": name,
                "contentType": content_type,
                "contentBytes": base64.b64encode(data).decode(),
            },
        )
        return
    session = await request(
        "POST",
        f"{base}/createUploadSession",
        json={
            "AttachmentItem": {
                "attachmentType": "file",
                "name": name,
                "size": len(data),
                "contentType": content_type,
            }
        },
    )
    upload_url = session.json()["uploadUrl"]
    for start in range(0, len(data), UPLOAD_CHUNK_BYTES):
        chunk = data[start : start + UPLOAD_CHUNK_BYTES]
        end = start + len(chunk) - 1
        await http().put(
            upload_url,
            content=chunk,
            headers={
                "Content-Range": f"bytes {start}-{end}/{len(data)}",
                "Content-Length": str(len(chunk)),
            },
        )


async def send_mail(
    *,
    subject: str,
    html_body: str,
    to: List[str],
    cc: List[str],
    reply_to_message_id: Optional[str] = None,
    attachments: Optional[List[Tuple[str, str, bytes]]] = None,
    subject_prefix: Optional[str] = None,
) -> SentMail:
    if reply_to_message_id:
        draft = (
            await request(
                "POST",
                f"{mailbox_path()}/messages/{reply_to_message_id}/createReply",
                json={},
            )
        ).json()
        quoted = (draft.get("body") or {}).get("content") or ""
        body_html = f"{html_body}<br><hr>{quoted}" if quoted else html_body
        changes: Dict[str, Any] = {
            "body": {"contentType": "HTML", "content": body_html},
            "toRecipients": _recipients(to),
            "ccRecipients": _recipients(cc),
        }
        # Replies keep the thread subject so Gmail and Outlook keep them in one conversation.
        if subject_prefix:
            changes["subject"] = f"{subject_prefix} {draft.get('subject') or subject}"
        await request("PATCH", f"{mailbox_path()}/messages/{draft['id']}", json=changes)
    else:
        draft = (
            await request(
                "POST",
                f"{mailbox_path()}/messages",
                json={
                    "subject": f"{subject_prefix} {subject}"
                    if subject_prefix
                    else subject,
                    "body": {"contentType": "HTML", "content": html_body},
                    "toRecipients": _recipients(to),
                    "ccRecipients": _recipients(cc),
                },
            )
        ).json()
    for name, content_type, data in attachments or []:
        await _attach(draft["id"], name, content_type, data)
    await request("POST", f"{mailbox_path()}/messages/{draft['id']}/send")
    return SentMail(
        graph_message_id=draft["id"],
        internet_message_id=draft.get("internetMessageId"),
        conversation_id=draft.get("conversationId"),
    )
