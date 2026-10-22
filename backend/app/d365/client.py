from app import runtime
from app.logger import get_logger

logger = get_logger(__name__)


async def poll_status_changes() -> None:
    if not (await runtime.current()).d365_enabled:
        return
    logger.info(
        "D365 polling is enabled but the D365 client is a stub until API access arrives"
    )
