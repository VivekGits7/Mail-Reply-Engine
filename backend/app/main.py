from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi.middleware import SlowAPIMiddleware

from app import runtime
from app.admin import admin_router
from app.auth import auth_router, users_router
from app.cases import cases_router, tasks_router
from app.common.schemas import (
    PUBLIC_ERROR_RESPONSES,
    HealthCheckResponse,
    HealthData,
    RootData,
    RootResponse,
    ServiceUnavailableResponse,
)
from app.config import settings
from app.database import close_db_pool, create_db_pool, execute_scalar
from app.engine import approvals_router, case_view_router, seed_defaults, setup_engine
from app.error import ServiceUnavailableException, setup_error_handlers
from app.graph import ensure_subscription, graph_router, subscription_status
from app.graph.client import close as close_graph
from app.limiter import limiter
from app.logger import get_logger, setup_logging
from app.mail import attachments_router, sou_router, templates_router
from app.middleware import RequestLoggingMiddleware, SecurityHeadersMiddleware
from app.storage import uploads_router
from app.workflows import (
    complaints_router,
    exits_router,
    feedback_router,
    induction_router,
    joiners_router,
    release_router,
    reminders_router,
    sessions_router,
    signoff_router,
)

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_pool()
    logger.info("Database pool created")
    setup_engine()
    await seed_defaults()
    try:
        await ensure_subscription()
    except Exception as e:
        logger.warning(
            f"Graph subscription not ready, polling covers it: {type(e).__name__}"
        )
    yield
    await close_graph()
    await close_db_pool()
    logger.info("Database pool closed")


app = FastAPI(
    title=settings.APP_NAME,
    description="HR email agent on Microsoft Graph. It reads the dedicated mailbox, classifies every email on masked text, runs the onboarding, exit, reminder, feedback and induction workflows, and keeps HR in control through approvals.",
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

app.state.limiter = limiter
setup_error_handlers(app)

app.add_middleware(SlowAPIMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)

allowed_origins = settings.CORS_ORIGINS if settings.is_production else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allowed_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (
    auth_router,
    users_router,
    joiners_router,
    signoff_router,
    case_view_router,
    cases_router,
    tasks_router,
    exits_router,
    release_router,
    approvals_router,
    induction_router,
    sessions_router,
    reminders_router,
    feedback_router,
    complaints_router,
    uploads_router,
    templates_router,
    attachments_router,
    sou_router,
    admin_router,
    graph_router,
):
    app.include_router(router)


@app.get(
    "/",
    response_model=RootResponse,
    tags=["Health"],
    responses={
        **PUBLIC_ERROR_RESPONSES,
        200: {"model": RootResponse, "description": "API welcome response"},
    },
)
@limiter.limit("30/minute")
async def root(request: Request) -> RootResponse:
    """
    Return the API name and version.
    """
    return RootResponse(
        success=True,
        message="API is running",
        data=RootData(app_name=settings.APP_NAME, version=settings.APP_VERSION),
    )


async def _redis_state() -> str:
    if settings.EVENT_DISPATCH_MODE == "inline":
        return "inline"
    try:
        import redis.asyncio as redis

        client = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        try:
            await client.ping()
        finally:
            await client.aclose()
        return "connected"
    except Exception:
        return "unreachable"


@app.get(
    "/health",
    response_model=HealthCheckResponse,
    tags=["Health"],
    responses={
        **PUBLIC_ERROR_RESPONSES,
        200: {
            "model": HealthCheckResponse,
            "description": "Service, database and broker are healthy",
        },
        503: {
            "model": ServiceUnavailableResponse,
            "description": "Database or broker is unreachable",
        },
    },
)
@limiter.limit("60/minute")
async def health_check(request: Request) -> HealthCheckResponse:
    """
    Health probe for monitoring, checks the database, Redis and the Graph subscription.

    - redis shows inline when events run in the API process
    - mailbox_subscription is active, expired, polling_only or not_configured
    """
    try:
        await execute_scalar("SELECT 1")
    except Exception as e:
        logger.error(f"Health check database error: {type(e).__name__}")
        raise ServiceUnavailableException("Database is unreachable")
    redis_state = await _redis_state()
    if redis_state == "unreachable":
        raise ServiceUnavailableException("Redis is unreachable")
    rs = await runtime.current()
    return HealthCheckResponse(
        success=True,
        message="Service is healthy",
        data=HealthData(
            database="connected",
            redis=redis_state,
            worker="inline" if redis_state == "inline" else "queued",
            mailbox_subscription=await subscription_status(),
            kill_switch=rs.kill_switch,
            dry_run=rs.dry_run,
        ),
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.is_development,
    )
