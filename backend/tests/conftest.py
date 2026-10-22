from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env.test", override=True)

import base64
import itertools
import json
import re
from contextlib import asynccontextmanager
from datetime import timedelta
from types import SimpleNamespace
from typing import Any, Callable, Dict, List, Optional

import asyncpg
import httpx
import pytest
import pytest_asyncio
import respx
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient

import app.database as db_module
from app import runtime
from app.ai import schemas as ai_schemas
from app.auth.enums import UserRole
from app.auth.model import User
from app.auth.service import create_access_token, hash_password
from app.common.enums import EmailCategory
from app.config import settings
from app.engine import seed_defaults, setup_engine
from app.llm import client as llm_client
from app.main import app as fastapi_app
from app.storage import service as storage_service

SCHEMA_DIR = Path(__file__).resolve().parents[1] / "database"
GRAPH = settings.GRAPH_BASE_URL
MAILBOX = settings.GRAPH_MAILBOX

TEST_CONTACTS = {
    "it_team": "it@tcgdigital.com",
    "onboarding_group": "onboarding@tcgdigital.com",
    "offboarding_group": "offboarding@tcgdigital.com",
    "hr_onboarding_team": "hr-onboarding@tcgdigital.com",
    "hr_onboarding_owner": "hr-owner@tcgdigital.com",
    "recruitment_team": "recruitment@tcgdigital.com",
    "finance_team": "finance@tcgdigital.com",
    "admin_team": "admin@tcgdigital.com",
    "hr_owner": "hr@tcgdigital.com",
    "complaints_owner": "complaints@tcgdigital.com",
    "performance_team": "performance@tcgdigital.com",
    "training_team": "training@tcgdigital.com",
}


@pytest_asyncio.fixture(scope="session")
async def db_pool():
    if "test" not in settings.POSTGRES_DB_NAME.lower():
        raise RuntimeError(
            f"Refusing to run tests against {settings.POSTGRES_DB_NAME}, the name must contain test"
        )
    pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=1,
        max_size=4,
        init=db_module.init_connection,
    )
    async with pool.acquire() as conn:
        await conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        for name in (SCHEMA_DIR / "schema_order.txt").read_text().split():
            await conn.execute((SCHEMA_DIR / name).read_text())
    try:
        yield pool
    finally:
        await pool.close()


@pytest_asyncio.fixture
async def db_conn(db_pool):
    async with db_pool.acquire() as conn:
        transaction = conn.transaction()
        await transaction.start()

        class FakePool:
            @asynccontextmanager
            async def acquire(self):
                yield conn

            async def close(self) -> None:
                return None

        original = db_module._pool
        db_module._pool = FakePool()
        runtime.invalidate()
        try:
            yield conn
        finally:
            db_module._pool = original
            runtime.invalidate()
            await transaction.rollback()


class FakeStorage:
    def __init__(self) -> None:
        self.files: Dict[str, tuple[bytes, str]] = {}

    def preload(self, key: str, data: bytes, content_type: str) -> str:
        self.files[key] = (data, content_type)
        return key

    async def put_bytes(self, key: str, data: bytes, content_type: str) -> str:
        self.files[key] = (data, content_type)
        return key

    async def get_bytes(self, key: str) -> bytes:
        return self.files[key][0]

    async def head(self, key: str) -> Optional[Dict[str, Any]]:
        if key not in self.files:
            return None
        return {"size": len(self.files[key][0]), "content_type": self.files[key][1]}

    async def delete(self, key: str) -> None:
        self.files.pop(key, None)

    async def presigned_get(self, key: str, file_name: str) -> str:
        return f"https://files.test/{key}?signature=fake"

    async def presigned_post(
        self, key: str, content_type: str, max_bytes: int
    ) -> Dict[str, Any]:
        return {
            "url": "https://files.test/test-bucket",
            "fields": {"key": key, "Content-Type": content_type, "policy": "fake"},
        }


@pytest.fixture
def storage(monkeypatch) -> FakeStorage:
    fake = FakeStorage()
    for name in (
        "put_bytes",
        "get_bytes",
        "head",
        "delete",
        "presigned_get",
        "presigned_post",
    ):
        monkeypatch.setattr(storage_service, name, getattr(fake, name))
    return fake


class FakeLLM:
    def __init__(self) -> None:
        self.handlers: Dict[str, Callable[[str], Any]] = {}
        self.requests: List[Dict[str, str]] = []
        self.responses = SimpleNamespace(parse=self._parse)
        self.on(
            ai_schemas.ClassifyResult,
            lambda text: ai_schemas.ClassifyResult(
                category=EmailCategory.UNRELATED,
                confidence=0.2,
                case_id=None,
                summary="Unrelated email",
                documents_mentioned=[],
                clearance_team=None,
            ),
        )
        self.on(
            ai_schemas.IdentifyResult,
            lambda text: ai_schemas.IdentifyResult(
                document_type="other", confidence=0.2, issues=[]
            ),
        )
        self.on(
            ai_schemas.ItSetupResult,
            lambda text: ai_schemas.ItSetupResult(
                email_created=False,
                d365_created=False,
                credentials_sent_to_joiner=False,
                confidence=0.2,
            ),
        )
        self.on(
            ai_schemas.DraftReply,
            lambda text: ai_schemas.DraftReply(
                subject="Re: Question",
                body="Hi {{ recipient_name }},\n\nHR will confirm shortly.\n\nHR Team",
                confidence=0.7,
            ),
        )
        self.on(
            ai_schemas.FeedbackAnalysis,
            lambda text: ai_schemas.FeedbackAnalysis(
                summary="Joiners settle in well.",
                themes=["Onboarding"],
                working_well=["Buddy system"],
                not_working=["Laptop delays"],
                suggested_actions=["Order laptops earlier"],
            ),
        )

    def on(self, model: type, handler: Callable[[str], Any]) -> None:
        self.handlers[model.__name__] = handler

    def classify_as(
        self,
        category: EmailCategory,
        confidence: float = 0.95,
        case_id: Optional[str] = None,
        team: Optional[str] = None,
    ) -> None:
        self.on(
            ai_schemas.ClassifyResult,
            lambda text: ai_schemas.ClassifyResult(
                category=category,
                confidence=confidence,
                case_id=case_id,
                summary=f"{category.value} email",
                documents_mentioned=[],
                clearance_team=team,
            ),
        )

    async def _parse(self, **kwargs: Any) -> SimpleNamespace:
        model = kwargs["text_format"]
        content = kwargs["input"][0]["content"]
        self.requests.append({"helper": model.__name__, "content": content})
        return SimpleNamespace(output_parsed=self.handlers[model.__name__](content))


@pytest.fixture
def llm() -> FakeLLM:
    fake = FakeLLM()
    llm_client.set_client(fake)
    yield fake
    llm_client.set_client(None)


class FakeGraph:
    def __init__(self) -> None:
        self.messages: Dict[str, Dict[str, Any]] = {}
        self.attachments: Dict[str, List[Dict[str, Any]]] = {}
        self.drafts: Dict[str, Dict[str, Any]] = {}
        self.sent: List[Dict[str, Any]] = []
        self.events: List[Dict[str, Any]] = []
        self.busy: Dict[str, List[Dict[str, Any]]] = {}
        self.delta_ids: List[str] = []
        self.counter = itertools.count(1)

    def add_message(
        self,
        *,
        from_email: str,
        subject: str,
        body: str,
        from_name: Optional[str] = None,
        conversation_id: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        unique_body: Optional[str] = None,
        message_id: Optional[str] = None,
    ) -> str:
        number = next(self.counter)
        message_id = message_id or f"in-{number}"
        self.messages[message_id] = {
            "id": message_id,
            "internetMessageId": f"<in-{number}@sender.test>",
            "conversationId": conversation_id or f"conv-in-{number}",
            "subject": subject,
            "from": {
                "emailAddress": {
                    "address": from_email,
                    "name": from_name or from_email.split("@")[0],
                }
            },
            "toRecipients": [{"emailAddress": {"address": MAILBOX}}],
            "ccRecipients": [],
            "receivedDateTime": "2026-10-20T05:30:00Z",
            "hasAttachments": bool(attachments),
            "isDeliveryReceipt": False,
            "isReadReceipt": False,
            "internetMessageHeaders": [
                {"name": key, "value": value} for key, value in (headers or {}).items()
            ],
            "body": {"contentType": "text", "content": body},
            "uniqueBody": {
                "contentType": "text",
                "content": unique_body if unique_body is not None else body,
            },
        }
        self.attachments[message_id] = [
            {
                "@odata.type": "#microsoft.graph.fileAttachment",
                "id": f"att-{number}-{index}",
                "name": item["name"],
                "contentType": item.get("content_type", "application/octet-stream"),
                "size": len(item["data"]),
                "isInline": item.get("inline", False),
                "contentBytes": base64.b64encode(item["data"]).decode(),
            }
            for index, item in enumerate(attachments or [])
        ]
        return message_id

    def to(self, address: str) -> List[Dict[str, Any]]:
        return [mail for mail in self.sent if address in mail["to"]]

    def last_to(self, address: str) -> Dict[str, Any]:
        matches = self.to(address)
        assert matches, f"No email was sent to {address}"
        return matches[-1]

    def _draft(
        self, reply_to: Optional[str], payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        number = next(self.counter)
        original = self.messages.get(reply_to or "") or next(
            (d for d in self.drafts.values() if d["id"] == reply_to), None
        )
        conversation = original["conversationId"] if original else f"conv-out-{number}"
        draft = {
            "id": f"draft-{number}",
            "internetMessageId": f"<out-{number}@hr.test>",
            "conversationId": conversation,
            "subject": payload.get("subject")
            or (f"RE: {original['subject']}" if original else ""),
            "to": [
                r["emailAddress"]["address"] for r in payload.get("toRecipients", [])
            ],
            "cc": [
                r["emailAddress"]["address"] for r in payload.get("ccRecipients", [])
            ],
            "body": (payload.get("body") or {}).get(
                "content", "<p>quoted earlier mail</p>" if reply_to else ""
            ),
            "reply_to": reply_to,
            "attachments": [],
        }
        self.drafts[draft["id"]] = draft
        return draft

    def install(self, router: respx.Router) -> None:
        base = re.escape(GRAPH)
        box = re.escape(f"/users/{MAILBOX}")
        router.post(url__regex=r"https://login\.microsoftonline\.com/.+/token").mock(
            return_value=httpx.Response(
                200, json={"access_token": "fake", "expires_in": 3600}
            )
        )

        def get_message(request, message_id):
            message = self.messages.get(message_id)
            return (
                httpx.Response(200, json=message)
                if message
                else httpx.Response(404, json={})
            )

        def list_attachments(request, message_id):
            return httpx.Response(
                200, json={"value": self.attachments.get(message_id, [])}
            )

        def create_reply(request, message_id):
            draft = self._draft(message_id, {})
            return httpx.Response(
                201,
                json={
                    "id": draft["id"],
                    "subject": draft["subject"],
                    "conversationId": draft["conversationId"],
                    "internetMessageId": draft["internetMessageId"],
                    "body": {"content": draft["body"]},
                },
            )

        def create_message(request):
            draft = self._draft(None, json.loads(request.content))
            return httpx.Response(
                201,
                json={
                    "id": draft["id"],
                    "conversationId": draft["conversationId"],
                    "internetMessageId": draft["internetMessageId"],
                },
            )

        def patch_message(request, message_id):
            payload = json.loads(request.content)
            draft = self.drafts[message_id]
            draft["to"] = [
                r["emailAddress"]["address"] for r in payload.get("toRecipients", [])
            ]
            draft["cc"] = [
                r["emailAddress"]["address"] for r in payload.get("ccRecipients", [])
            ]
            draft["body"] = payload["body"]["content"]
            draft["subject"] = payload.get("subject", draft["subject"])
            return httpx.Response(200, json={"id": message_id})

        def add_attachment(request, message_id):
            payload = json.loads(request.content)
            self.drafts[message_id]["attachments"].append(
                {
                    "name": payload["name"],
                    "content_type": payload["contentType"],
                    "data": base64.b64decode(payload["contentBytes"]),
                }
            )
            return httpx.Response(201, json={})

        def send(request, message_id):
            self.sent.append(self.drafts[message_id])
            return httpx.Response(202)

        def schedule(request):
            payload = json.loads(request.content)
            value = [
                {"scheduleId": email, "scheduleItems": self.busy.get(email, [])}
                for email in payload["schedules"]
            ]
            return httpx.Response(200, json={"value": value})

        def create_event(request):
            payload = json.loads(request.content)
            event_id = f"event-{next(self.counter)}"
            self.events.append({"id": event_id, **payload})
            return httpx.Response(201, json={"id": event_id})

        def delta(request):
            ids, self.delta_ids = self.delta_ids, []
            return httpx.Response(
                200,
                json={
                    "value": [{"id": message_id} for message_id in ids],
                    "@odata.deltaLink": f"{GRAPH}/delta-next",
                },
            )

        router.get(url__regex=rf"{base}{box}/messages/(?P<message_id>[^/?]+)$").mock(
            side_effect=get_message
        )
        router.get(url__regex=rf"{base}{box}/messages/(?P<message_id>[^/?]+)\?.*").mock(
            side_effect=get_message
        )
        router.get(
            url__regex=rf"{base}{box}/messages/(?P<message_id>[^/]+)/attachments$"
        ).mock(side_effect=list_attachments)
        router.post(
            url__regex=rf"{base}{box}/messages/(?P<message_id>[^/]+)/createReply$"
        ).mock(side_effect=create_reply)
        router.post(url__regex=rf"{base}{box}/messages$").mock(
            side_effect=create_message
        )
        router.patch(url__regex=rf"{base}{box}/messages/(?P<message_id>[^/]+)$").mock(
            side_effect=patch_message
        )
        router.post(
            url__regex=rf"{base}{box}/messages/(?P<message_id>[^/]+)/attachments$"
        ).mock(side_effect=add_attachment)
        router.post(
            url__regex=rf"{base}{box}/messages/(?P<message_id>[^/]+)/send$"
        ).mock(side_effect=send)
        router.post(url__regex=rf"{base}{box}/calendar/getSchedule$").mock(
            side_effect=schedule
        )
        router.post(url__regex=rf"{base}{box}/events$").mock(side_effect=create_event)
        router.get(
            url__regex=rf"({base}{box}/mailFolders.+delta.*|{base}/delta-next.*)"
        ).mock(side_effect=delta)
        router.post(f"{GRAPH}/subscriptions").mock(
            return_value=httpx.Response(
                201, json={"id": "sub-1", "expirationDateTime": "2026-10-23T05:30:00Z"}
            )
        )
        router.patch(url__regex=rf"{base}/subscriptions/.+").mock(
            return_value=httpx.Response(
                200, json={"id": "sub-1", "expirationDateTime": "2026-10-23T05:30:00Z"}
            )
        )


@pytest.fixture
def graph():
    fake = FakeGraph()
    with respx.mock(assert_all_called=False, assert_all_mocked=True) as router:
        fake.install(router)
        yield fake


async def configure_runtime(**overrides: Any) -> None:
    await runtime.update(
        {
            "sending_days": [0, 1, 2, 3, 4, 5, 6],
            "sending_start": "00:00",
            "sending_end": "23:59",
            "dry_run": False,
            "test_inbox": "hr-test@tcgdigital.com",
            "document_reading_enabled": True,
            "max_auto_emails_per_person_per_day": 50,
            "contacts": TEST_CONTACTS,
            "survey_form_links": {
                "campus": "https://forms.test/campus",
                "lateral": "https://forms.test/lateral",
            },
            **overrides,
        },
        None,
    )


@pytest.fixture
def blank_ocr(monkeypatch):
    from app.documents import service as documents_service

    monkeypatch.setattr(documents_service, "_ocr_available", lambda: True)
    monkeypatch.setattr(documents_service, "_ocr_image", lambda image: ("", 0.0))


@pytest_asyncio.fixture
async def env(db_conn, storage, llm, graph):
    setup_engine()
    await seed_defaults()
    await configure_runtime()
    return SimpleNamespace(conn=db_conn, storage=storage, llm=llm, graph=graph)


@pytest_asyncio.fixture
async def client(env) -> AsyncClient:
    async with LifespanManager(fastapi_app, startup_timeout=30, shutdown_timeout=10):
        async with AsyncClient(
            transport=ASGITransport(app=fastapi_app), base_url="http://test"
        ) as http:
            yield http
    fastapi_app.dependency_overrides.clear()


async def make_user(
    email: str,
    role: UserRole,
    complaints_access: bool = False,
    password: str = "Str0ngPass!",
) -> User:
    return await User.create(
        "TCG User", email, hash_password(password), role, complaints_access
    )


def bearer(user: User) -> Dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user)[0]}"}


@pytest_asyncio.fixture
async def admin(env) -> User:
    return await make_user("tcg@tcgdigital.com", UserRole.HR_ADMIN)


@pytest_asyncio.fixture
async def admin_headers(admin) -> Dict[str, str]:
    return bearer(admin)


@pytest_asyncio.fixture
async def viewer_headers(env) -> Dict[str, str]:
    return bearer(await make_user("viewer@tcgdigital.com", UserRole.HR_VIEWER))


@pytest_asyncio.fixture
async def restricted_headers(env) -> Dict[str, str]:
    return bearer(
        await make_user(
            "restricted@tcgdigital.com", UserRole.HR_VIEWER, complaints_access=True
        )
    )


async def advance_jobs(
    conn: asyncpg.Connection, by: timedelta = timedelta(days=30)
) -> int:
    from app.engine.jobs import run_due_jobs

    await conn.execute(
        "UPDATE scheduled_jobs SET run_at = NOW() - INTERVAL '1 second' WHERE status = 'pending' AND run_at <= NOW() + $1::interval",
        by,
    )
    return await run_due_jobs()


def make_pdf(text: str) -> bytes:
    import fitz

    document = fitz.open()
    page = document.new_page()
    page.insert_text((50, 72), text, fontsize=11)
    return document.tobytes()


def make_png() -> bytes:
    import io

    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (60, 80), color=(200, 180, 160)).save(buffer, format="PNG")
    return buffer.getvalue()
