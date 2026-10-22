import json
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator, List, Optional

import asyncpg

from app.config import settings
from app.logger import get_logger

logger = get_logger(__name__)

_pool: Optional[asyncpg.Pool] = None


async def init_connection(conn: asyncpg.Connection) -> None:
    for json_type in ("json", "jsonb"):
        await conn.set_type_codec(
            json_type,
            encoder=lambda v: json.dumps(v, default=str),
            decoder=json.loads,
            schema="pg_catalog",
        )


async def create_db_pool() -> None:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=settings.DB_POOL_MIN_SIZE,
            max_size=settings.DB_POOL_MAX_SIZE,
            init=init_connection,
        )


async def close_db_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool is not initialised")
    return _pool


async def execute_query(query: str, *args: Any) -> List[asyncpg.Record]:
    async with get_pool().acquire() as conn:
        return await conn.fetch(query, *args)


async def execute_query_one(query: str, *args: Any) -> Optional[asyncpg.Record]:
    async with get_pool().acquire() as conn:
        return await conn.fetchrow(query, *args)


async def execute_scalar(query: str, *args: Any) -> Any:
    async with get_pool().acquire() as conn:
        return await conn.fetchval(query, *args)


async def execute_command(query: str, *args: Any) -> str:
    async with get_pool().acquire() as conn:
        return await conn.execute(query, *args)


async def execute_command_with_return(
    query: str, *args: Any
) -> Optional[asyncpg.Record]:
    async with get_pool().acquire() as conn:
        return await conn.fetchrow(query, *args)


@asynccontextmanager
async def transaction() -> AsyncIterator[asyncpg.Connection]:
    async with get_pool().acquire() as conn:
        async with conn.transaction():
            yield conn


@asynccontextmanager
async def try_advisory_lock(key: str) -> AsyncIterator[bool]:
    async with get_pool().acquire() as conn:
        acquired = await conn.fetchval(
            "SELECT pg_try_advisory_lock(hashtextextended($1, 0))", key
        )
        try:
            yield bool(acquired)
        finally:
            if acquired:
                await conn.execute(
                    "SELECT pg_advisory_unlock(hashtextextended($1, 0))", key
                )
