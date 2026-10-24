import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from typing import Optional

from app.config import settings

LOGS_DIR = "logs"
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
MAX_LOG_BYTES = 10 * 1024 * 1024
LOG_BACKUP_COUNT = 5


def _file_handler(file_name: str, level: int) -> RotatingFileHandler:
    handler = RotatingFileHandler(
        f"{LOGS_DIR}/{file_name}", maxBytes=MAX_LOG_BYTES, backupCount=LOG_BACKUP_COUNT
    )
    handler.setLevel(level)
    handler.setFormatter(logging.Formatter(LOG_FORMAT))
    return handler


def setup_logging(level: Optional[str] = None) -> None:
    os.makedirs(LOGS_DIR, exist_ok=True)
    numeric_level = getattr(
        logging, (level or settings.LOG_LEVEL).upper(), logging.INFO
    )

    root_logger = logging.getLogger()
    if root_logger.handlers:
        root_logger.handlers.clear()
    root_logger.setLevel(numeric_level)

    # Celery child processes redirect sys.stdout into logging and drop the lines, so write to the real stdout.
    console_handler = logging.StreamHandler(sys.__stdout__)
    console_handler.setLevel(numeric_level)
    console_handler.setFormatter(logging.Formatter(LOG_FORMAT))
    root_logger.addHandler(console_handler)
    root_logger.addHandler(_file_handler("app.log", logging.INFO))
    root_logger.addHandler(_file_handler("error.log", logging.ERROR))

    logging.getLogger("uvicorn.access").addHandler(
        _file_handler("access.log", logging.INFO)
    )

    for noisy in (
        "uvicorn",
        "asyncpg",
        "httpx",
        "openai",
        "botocore",
        "aiobotocore",
        "boto3",
    ):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
