import uuid
from typing import Any, Dict, Optional

from app.audit.model import ActionLog
from app.logger import get_logger

logger = get_logger(__name__)

AGENT = "agent"
USER = "user"
SYSTEM = "system"


async def log_action(
    action: str,
    *,
    actor_type: str = AGENT,
    actor_id: Optional[uuid.UUID] = None,
    case_id: Optional[uuid.UUID] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[uuid.UUID] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    await ActionLog.create(
        actor_type, actor_id, action, case_id, entity_type, entity_id, details or {}
    )


async def log_user_action(user_id: uuid.UUID, action: str, **kwargs: Any) -> None:
    await log_action(action, actor_type=USER, actor_id=user_id, **kwargs)
