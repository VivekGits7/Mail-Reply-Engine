import base64
import binascii
from typing import Dict, List, Literal, Optional
from urllib.parse import quote

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_JWT_SECRET = "change-me"
AES_KEY_BYTES = 32


def _decode_key(name: str, value: str) -> bytes:
    try:
        key = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError):
        raise ValueError(f"{name} must be base64") from None
    if len(key) != AES_KEY_BYTES:
        raise ValueError(f"{name} must decode to {AES_KEY_BYTES} bytes")
    return key


class Settings(BaseSettings):
    # SERVER
    APP_NAME: str = Field(default="Mail Reply Engine", description="Application name")
    APP_VERSION: str = Field(default="2.0.0", description="Application version")
    HOST: str = Field(default="0.0.0.0", description="Server host")
    PORT: int = Field(default=8000, description="Server port")
    ENVIRONMENT: str = Field(default="development", description="Runtime environment")
    LOG_LEVEL: str = Field(default="INFO", description="Root log level")
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000"], description="Allowed origins in production"
    )
    FRONTEND_URL: str = Field(
        default="http://localhost:3000",
        description="Dashboard URL used in alert emails",
    )
    TIMEZONE: str = Field(
        default="Asia/Kolkata", description="Timezone for sending windows and schedules"
    )
    COMPANY_NAME: str = Field(
        default="TCG Digital", description="Company name used in emails"
    )

    # DATABASE
    POSTGRES_DB_HOST: str = Field(default="localhost", description="Database host")
    POSTGRES_DB_PORT: int = Field(default=5432, description="Database port")
    POSTGRES_DB_NAME: str = Field(
        default="mail_reply_engine", description="Database name"
    )
    POSTGRES_DB_USER: str = Field(default="postgres", description="Database user")
    POSTGRES_DB_PASSWORD: str = Field(default="", description="Database password")
    DB_POOL_MIN_SIZE: int = Field(default=2, description="Minimum pool connections")
    DB_POOL_MAX_SIZE: int = Field(default=10, description="Maximum pool connections")

    # JWT
    JWT_SECRET_KEY: str = Field(
        default=DEFAULT_JWT_SECRET, description="JWT signing secret"
    )
    JWT_ALGORITHM: str = Field(default="HS256", description="JWT signing algorithm")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(
        default=1440, description="Access token lifetime in minutes"
    )

    # QUEUE
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Celery broker and result backend",
    )
    EVENT_DISPATCH_MODE: Literal["celery", "inline"] = Field(
        default="celery",
        description="Run events through Celery or inline in the same process",
    )
    EVENT_MAX_ATTEMPTS: int = Field(
        default=5, description="Attempts before an event is marked failed"
    )
    EVENT_STUCK_MINUTES: int = Field(
        default=10, description="Minutes before a queued event is requeued"
    )

    # MICROSOFT GRAPH
    GRAPH_TENANT_ID: str = Field(default="", description="Entra directory tenant id")
    GRAPH_CLIENT_ID: str = Field(default="", description="App registration client id")
    GRAPH_CLIENT_SECRET: str = Field(
        default="", description="App registration client secret"
    )
    GRAPH_MAILBOX: str = Field(
        default="",
        description="Dedicated mailbox address the agent reads and sends from",
    )
    GRAPH_WEBHOOK_BASE_URL: str = Field(
        default="",
        description="Public HTTPS base URL Microsoft calls for notifications",
    )
    GRAPH_CLIENT_STATE: str = Field(
        default="", description="Shared secret echoed back on every notification"
    )
    GRAPH_BASE_URL: str = Field(
        default="https://graph.microsoft.com/v1.0", description="Graph API base URL"
    )
    GRAPH_AUTHORITY: str = Field(
        default="https://login.microsoftonline.com", description="Token authority"
    )
    GRAPH_TIMEOUT_SECONDS: float = Field(
        default=30.0, description="Graph request timeout"
    )
    GRAPH_MAX_RETRIES: int = Field(
        default=4, description="Retries on throttling and server errors"
    )
    GRAPH_SUBSCRIPTION_MINUTES: int = Field(
        default=4200, description="Requested mail subscription lifetime"
    )

    # MAIL SENDING
    MAIL_SEND_PROVIDER: Literal["graph", "smtp"] = Field(
        default="graph",
        description="Send through Graph or through the SMTP server, reading always uses Graph",
    )
    SMTP_HOST: str = Field(default="", description="SMTP server host")
    SMTP_PORT: int = Field(default=587, description="SMTP server port")
    SMTP_SECURITY: Literal["starttls", "ssl", "none"] = Field(
        default="starttls", description="How the SMTP connection is encrypted"
    )
    SMTP_USERNAME: str = Field(default="", description="SMTP login, empty for no login")
    SMTP_PASSWORD: str = Field(default="", description="SMTP password")
    SMTP_FROM_EMAIL: str = Field(
        default="", description="From address on SMTP mail, defaults to GRAPH_MAILBOX"
    )
    SMTP_FROM_NAME: str = Field(
        default="", description="From display name on SMTP mail"
    )
    SMTP_TIMEOUT_SECONDS: float = Field(
        default=30.0, description="SMTP connect and send timeout"
    )

    # OBJECT STORAGE
    S3_ENDPOINT_URL: str = Field(
        default="http://localhost:9100",
        description="MinIO endpoint used by the backend",
    )
    S3_PUBLIC_ENDPOINT_URL: str = Field(
        default="http://localhost:9100",
        description="MinIO endpoint used to sign browser links",
    )
    S3_BUCKET: str = Field(
        default="mail-reply-engine", description="Bucket for documents and uploads"
    )
    S3_ACCESS_KEY: str = Field(default="", description="Bucket scoped access key")
    S3_SECRET_KEY: str = Field(default="", description="Bucket scoped secret key")
    S3_REGION: str = Field(
        default="us-east-1", description="Region name MinIO expects in signatures"
    )
    S3_PRESIGNED_URL_EXPIRE_SECONDS: int = Field(
        default=300, description="Lifetime of download and upload links"
    )

    # OPENAI
    OPENAI_API_KEY: str = Field(default="", description="OpenAI API key")
    OPENAI_MODEL: str = Field(
        default="gpt-5.4", description="Model behind every AI helper"
    )
    OPENAI_REASONING_EFFORT: Literal[
        "none", "minimal", "low", "medium", "high", "xhigh"
    ] = Field(default="low", description="Reasoning effort for AI helpers")
    OPENAI_MAX_OUTPUT_TOKENS: int = Field(
        default=4000, description="Output token cap per AI call"
    )
    OPENAI_TIMEOUT_SECONDS: float = Field(
        default=90.0, description="OpenAI request timeout"
    )
    LLM_AUDIT_RETENTION_DAYS: int = Field(
        default=30, description="Days masked AI requests are kept"
    )

    # PRIVACY
    PII_ENCRYPTION_KEYS: Dict[str, str] = Field(
        default_factory=dict, description="Key id to base64 AES-256 key"
    )
    PII_ACTIVE_KEY_ID: str = Field(
        default="", description="Key id used for new encryptions"
    )
    PII_INDEX_KEY: str = Field(
        default="", description="Base64 HMAC key for blind indexes"
    )
    SPACY_MODEL: str = Field(
        default="en_core_web_sm", description="spaCy model behind Presidio"
    )

    # DOCUMENTS
    TESSERACT_CMD: Optional[str] = Field(
        default=None, description="Path to the tesseract binary when not on PATH"
    )
    MAX_ATTACHMENT_BYTES: int = Field(
        default=25 * 1024 * 1024, description="Largest attachment stored"
    )
    ZIP_MAX_FILES: int = Field(
        default=50, description="Most files unpacked from one zip"
    )
    ZIP_MAX_TOTAL_BYTES: int = Field(
        default=100 * 1024 * 1024, description="Most bytes unpacked from one zip"
    )
    DOCUMENT_TEXT_FOR_AI_CHARS: int = Field(
        default=4000, description="Masked characters sent to identify a document"
    )
    RUNTIME_SETTINGS_CACHE_SECONDS: int = Field(
        default=30, description="Cache lifetime for HR settings and switches"
    )

    @property
    def database_url(self) -> str:
        # Encode credentials so a password like pass@2026 does not split the host.
        user = quote(self.POSTGRES_DB_USER, safe="")
        password = quote(self.POSTGRES_DB_PASSWORD, safe="")
        return (
            f"postgresql://{user}:{password}"
            f"@{self.POSTGRES_DB_HOST}:{self.POSTGRES_DB_PORT}/{self.POSTGRES_DB_NAME}"
        )

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT.lower() == "development"

    @property
    def is_test(self) -> bool:
        return self.ENVIRONMENT.lower() == "test"

    @property
    def graph_configured(self) -> bool:
        return all(
            (
                self.GRAPH_TENANT_ID,
                self.GRAPH_CLIENT_ID,
                self.GRAPH_CLIENT_SECRET,
                self.GRAPH_MAILBOX,
            )
        )

    @property
    def mailbox(self) -> str:
        return self.GRAPH_MAILBOX.lower()

    @property
    def sender_email(self) -> str:
        if self.MAIL_SEND_PROVIDER == "smtp" and self.SMTP_FROM_EMAIL:
            return self.SMTP_FROM_EMAIL.lower()
        return self.mailbox

    @property
    def smtp_configured(self) -> bool:
        return bool(self.SMTP_HOST and self.sender_email)

    @property
    def pii_keys(self) -> Dict[str, bytes]:
        return {
            key_id: _decode_key(f"PII_ENCRYPTION_KEYS[{key_id}]", value)
            for key_id, value in self.PII_ENCRYPTION_KEYS.items()
        }

    @property
    def pii_index_key(self) -> bytes:
        return _decode_key("PII_INDEX_KEY", self.PII_INDEX_KEY)

    @model_validator(mode="after")
    def validate_secrets(self) -> "Settings":
        if self.PII_ENCRYPTION_KEYS or self.PII_ACTIVE_KEY_ID or self.PII_INDEX_KEY:
            keys = self.pii_keys
            if self.PII_ACTIVE_KEY_ID not in keys:
                raise ValueError("PII_ACTIVE_KEY_ID must be one of PII_ENCRYPTION_KEYS")
            if any(len(key_id) > 32 for key_id in keys):
                raise ValueError("PII key ids must be 32 characters or fewer")
            _decode_key("PII_INDEX_KEY", self.PII_INDEX_KEY)
        if self.is_production:
            if self.JWT_SECRET_KEY == DEFAULT_JWT_SECRET:
                raise ValueError("Set JWT_SECRET_KEY in production")
            if not self.PII_ENCRYPTION_KEYS:
                raise ValueError("Set PII_ENCRYPTION_KEYS in production")
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
