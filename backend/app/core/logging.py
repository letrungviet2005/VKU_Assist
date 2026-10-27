import json
import logging
import sys


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {"level": record.levelname, "logger": record.name,
                   "message": record.getMessage()}
        for key in ("request_id", "method", "path", "status_code", "duration_ms", "message_id",
                    "index_version", "provider", "model", "retrieval_ms", "generation_ms",
                    "context_chunks", "token_usage", "outcome", "error_code"):
            if hasattr(record, key):
                payload[key] = getattr(record, key)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logger = logging.getLogger("app")
    logger.handlers = [handler]
    logger.setLevel(level)
    logger.propagate = False
    # SDK DEBUG logging may include signed requests, prompts and response bodies.
    for name in ("boto3", "botocore", "urllib3"):
        logging.getLogger(name).setLevel(logging.WARNING)
