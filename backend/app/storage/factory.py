import logging
from typing import TYPE_CHECKING

from app.storage.base import BaseStorage
from app.storage.database import Database, SQLiteStorage
from app.storage.dynamodb import DynamoDBStorage

if TYPE_CHECKING:
    from app.core.config import Settings

logger = logging.getLogger("app.storage.factory")


def create_storage(settings: "Settings") -> BaseStorage:
    """Factory function to instantiate the configured persistence backend.
    
    Supports:
    - 'sqlite': Lightweight, embedded ACID persistence with WAL mode.
    - 'dynamodb': AWS cloud-scale serverless NoSQL persistence with Single-Table Design.
    """
    backend = getattr(settings, "storage_backend", "sqlite")

    if backend == "dynamodb":
        logger.info(
            f"Initializing DynamoDB persistence backend (table: {settings.dynamodb_table_name}, region: {settings.dynamodb_region})"
        )
        return DynamoDBStorage(
            table_name=settings.dynamodb_table_name,
            region_name=settings.dynamodb_region,
            endpoint_url=settings.dynamodb_endpoint_url,
            use_mock=settings.app_env == "test",
        )

    # Default to SQLite
    db_path = (
        ":memory:"
        if settings.app_env == "test" and str(settings.db_path) == "data/vku_assist.db"
        else settings.db_path
    )
    logger.info(f"Initializing SQLite persistence backend at '{db_path}'")
    return SQLiteStorage(db_path=db_path)
