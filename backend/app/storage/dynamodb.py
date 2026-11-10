import copy
from datetime import datetime, timezone
import json
import logging
from typing import Any

from app.storage.base import BaseStorage

logger = logging.getLogger("app.storage.dynamodb")


def utc_now_iso() -> str:
    """Return current UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).isoformat()


class DynamoDBStorage(BaseStorage):
    """AWS DynamoDB Single-Table Persistence Layer for VKU Assist.
    
    Implements Single-Table Design for high-concurrency cloud deployments:
    - PK (Partition Key): Primary entity boundary (e.g. SESSION#<id>, FEEDBACK#<id>)
    - SK (Sort Key): Sub-item sorting and type discriminator (e.g. METADATA, MSG#<ts>#<id>)
    - GSI1PK / GSI1SK: Secondary index for global/user listings ordered by updated_at or created_at.
    
    Includes built-in in-memory simulation mode (use_mock=True) for test isolation
    and environments without direct AWS DynamoDB connectivity.
    """

    def __init__(
        self,
        table_name: str = "vku_assist_persistence",
        region_name: str = "ap-southeast-1",
        endpoint_url: str | None = None,
        use_mock: bool = False,
        aws_access_key_id: str | None = None,
        aws_secret_access_key: str | None = None,
    ):
        self.table_name = table_name
        self.region_name = region_name
        self.endpoint_url = endpoint_url
        self.use_mock = use_mock
        self._dynamodb = None
        self._table = None

        # In-memory storage table: maps (PK, SK) -> item dict
        self._items: dict[tuple[str, str], dict[str, Any]] = {}

        if not self.use_mock:
            self._init_aws_client(aws_access_key_id, aws_secret_access_key)

    def _init_aws_client(self, access_key: str | None, secret_key: str | None) -> None:
        """Initialize boto3 DynamoDB resource and table reference."""
        try:
            import boto3
            from botocore.exceptions import ClientError, NoCredentialsError

            session_kwargs: dict[str, Any] = {"region_name": self.region_name}
            if access_key and secret_key:
                session_kwargs["aws_access_key_id"] = access_key
                session_kwargs["aws_secret_access_key"] = secret_key

            boto_session = boto3.Session(**session_kwargs)
            client_kwargs: dict[str, Any] = {}
            if self.endpoint_url:
                client_kwargs["endpoint_url"] = self.endpoint_url

            self._dynamodb = boto_session.resource("dynamodb", **client_kwargs)
            self._table = self._dynamodb.Table(self.table_name)

            # Probe table existence
            try:
                self._table.load()
            except ClientError as e:
                code = e.response.get("Error", {}).get("Code")
                if code == "ResourceNotFoundException":
                    logger.info(f"Table '{self.table_name}' does not exist. Creating table...")
                    self._create_table_schema()
                else:
                    raise
        except (ImportError, NoCredentialsError, Exception) as e:
            logger.warning(
                f"AWS DynamoDB connection unavailable ({e}). Falling back to mock in-memory storage."
            )
            self.use_mock = True
            self._table = None

    def _create_table_schema(self) -> None:
        """Create single-table schema with PK, SK, and GSI1."""
        try:
            table = self._dynamodb.create_table(
                TableName=self.table_name,
                KeySchema=[
                    {"AttributeName": "PK", "KeyType": "HASH"},
                    {"AttributeName": "SK", "KeyType": "RANGE"},
                ],
                AttributeDefinitions=[
                    {"AttributeName": "PK", "AttributeType": "S"},
                    {"AttributeName": "SK", "AttributeType": "S"},
                    {"AttributeName": "GSI1PK", "AttributeType": "S"},
                    {"AttributeName": "GSI1SK", "AttributeType": "S"},
                ],
                GlobalSecondaryIndexes=[
                    {
                        "IndexName": "GSI1",
                        "KeySchema": [
                            {"AttributeName": "GSI1PK", "KeyType": "HASH"},
                            {"AttributeName": "GSI1SK", "KeyType": "RANGE"},
                        ],
                        "Projection": {"ProjectionType": "ALL"},
                        "ProvisionedThroughput": {
                            "ReadCapacityUnits": 5,
                            "WriteCapacityUnits": 5,
                        },
                    }
                ],
                BillingMode="PAY_PER_REQUEST",
            )
            table.wait_until_exists()
            self._table = table
            logger.info(f"DynamoDB table '{self.table_name}' created successfully.")
        except Exception as e:
            logger.error(f"Failed to create DynamoDB table: {e}")
            self.use_mock = True

    # -----------------------------------------------------------------------
    # Low-level item operations (abstracting real boto3 vs mock)
    # -----------------------------------------------------------------------

    def _put_item(self, item: dict[str, Any]) -> None:
        pk, sk = item["PK"], item["SK"]
        self._items[(pk, sk)] = copy.deepcopy(item)
        if not self.use_mock and self._table is not None:
            try:
                self._table.put_item(Item=item)
            except Exception as e:
                logger.error(f"DynamoDB put_item failed: {e}")

    def _get_item(self, pk: str, sk: str) -> dict[str, Any] | None:
        if self.use_mock or self._table is None:
            item = self._items.get((pk, sk))
            return copy.deepcopy(item) if item else None
        try:
            res = self._table.get_item(Key={"PK": pk, "SK": sk})
            return res.get("Item")
        except Exception as e:
            logger.error(f"DynamoDB get_item failed: {e}")
            item = self._items.get((pk, sk))
            return copy.deepcopy(item) if item else None

    def _delete_item(self, pk: str, sk: str) -> bool:
        existed = (pk, sk) in self._items
        self._items.pop((pk, sk), None)
        if not self.use_mock and self._table is not None:
            try:
                self._table.delete_item(Key={"PK": pk, "SK": sk})
                return True
            except Exception as e:
                logger.error(f"DynamoDB delete_item failed: {e}")
        return existed

    def _query_pk(self, pk: str, sk_prefix: str | None = None) -> list[dict[str, Any]]:
        """Query all items matching PK, optionally filtering by SK prefix."""
        if self.use_mock or self._table is None:
            results = []
            for (item_pk, item_sk), val in self._items.items():
                if item_pk == pk:
                    if sk_prefix is None or item_sk.startswith(sk_prefix):
                        results.append(copy.deepcopy(val))
            return results
        try:
            from boto3.dynamodb.conditions import Key
            expr = Key("PK").eq(pk)
            if sk_prefix:
                expr = expr & Key("SK").begins_with(sk_prefix)
            res = self._table.query(KeyConditionExpression=expr)
            return res.get("Items", [])
        except Exception as e:
            logger.error(f"DynamoDB query failed: {e}")
            return [
                copy.deepcopy(v)
                for (k_pk, k_sk), v in self._items.items()
                if k_pk == pk and (sk_prefix is None or k_sk.startswith(sk_prefix))
            ]

    def _query_gsi1(self, gsi1_pk: str, limit: int = 50, offset: int = 0) -> tuple[list[dict[str, Any]], int]:
        """Query items by GSI1PK, sorted descending by GSI1SK."""
        all_matches = []
        if self.use_mock or self._table is None:
            for item in self._items.values():
                if item.get("GSI1PK") == gsi1_pk:
                    all_matches.append(copy.deepcopy(item))
        else:
            try:
                from boto3.dynamodb.conditions import Key
                res = self._table.query(
                    IndexName="GSI1",
                    KeyConditionExpression=Key("GSI1PK").eq(gsi1_pk),
                    ScanIndexForward=False,
                )
                all_matches = res.get("Items", [])
            except Exception as e:
                logger.error(f"DynamoDB GSI1 query failed: {e}")
                for item in self._items.values():
                    if item.get("GSI1PK") == gsi1_pk:
                        all_matches.append(copy.deepcopy(item))

        # Sort descending by GSI1SK
        all_matches.sort(key=lambda x: x.get("GSI1SK", ""), reverse=True)
        total = len(all_matches)
        sliced = all_matches[offset : offset + limit]
        return sliced, total

    # -----------------------------------------------------------------------
    # Session Operations
    # -----------------------------------------------------------------------

    def create_session(
        self,
        session_id: str,
        title: str = "Cuộc trò chuyện mới",
        session_token: str | None = None,
    ) -> dict[str, Any]:
        now = utc_now_iso()
        gsi1_pk = "SESSIONS#GLOBAL"
        gsi1_sk = f"{now}#{session_id}"

        item = {
            "PK": f"SESSION#{session_id}",
            "SK": "METADATA",
            "GSI1PK": gsi1_pk,
            "GSI1SK": gsi1_sk,
            "id": session_id,
            "title": title,
            "session_token": session_token,
            "created_at": now,
            "updated_at": now,
            "entity_type": "session",
        }
        self._put_item(item)

        return {
            "id": session_id,
            "title": title,
            "session_token": session_token,
            "created_at": now,
            "updated_at": now,
            "createdAt": now,
            "updatedAt": now,
            "messages": [],
        }

    def get_session(
        self, session_id: str, include_messages: bool = True
    ) -> dict[str, Any] | None:
        pk = f"SESSION#{session_id}"
        if include_messages:
            items = self._query_pk(pk)
            metadata = None
            raw_messages = []
            for it in items:
                if it.get("SK") == "METADATA":
                    metadata = it
                elif it.get("SK", "").startswith("MSG#"):
                    raw_messages.append(it)

            if not metadata:
                return None

            raw_messages.sort(key=lambda m: m.get("created_at", ""))
            messages = [self._format_message(m) for m in raw_messages]

            res = {
                "id": metadata["id"],
                "title": metadata["title"],
                "session_token": metadata.get("session_token"),
                "created_at": metadata["created_at"],
                "updated_at": metadata["updated_at"],
                "createdAt": metadata["created_at"],
                "updatedAt": metadata["updated_at"],
                "messages": messages,
            }
            return res
        else:
            metadata = self._get_item(pk, "METADATA")
            if not metadata:
                return None
            return {
                "id": metadata["id"],
                "title": metadata["title"],
                "session_token": metadata.get("session_token"),
                "created_at": metadata["created_at"],
                "updated_at": metadata["updated_at"],
                "createdAt": metadata["created_at"],
                "updatedAt": metadata["updated_at"],
                "messages": [],
            }

    def list_sessions(
        self,
        session_token: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        all_matches = []
        if self.use_mock or self._table is None:
            for item in self._items.values():
                if item.get("SK") == "METADATA" and item.get("entity_type") == "session":
                    if session_token is None or item.get("session_token") == session_token:
                        all_matches.append(copy.deepcopy(item))
        else:
            try:
                from boto3.dynamodb.conditions import Key, Attr
                kwargs = {
                    "IndexName": "GSI1",
                    "KeyConditionExpression": Key("GSI1PK").eq("SESSIONS#GLOBAL"),
                    "ScanIndexForward": False,
                }
                if session_token:
                    kwargs["FilterExpression"] = Attr("session_token").eq(session_token)
                res = self._table.query(**kwargs)
                all_matches = res.get("Items", [])
            except Exception as e:
                logger.error(f"DynamoDB GSI1 query failed: {e}")
                for item in self._items.values():
                    if item.get("SK") == "METADATA" and item.get("entity_type") == "session":
                        if session_token is None or item.get("session_token") == session_token:
                            all_matches.append(copy.deepcopy(item))

        all_matches.sort(key=lambda x: x.get("GSI1SK", ""), reverse=True)
        total = len(all_matches)
        sliced = all_matches[offset : offset + limit]

        results = []
        for s in sliced:
            sess_id = s["id"]
            msg_items = self._query_pk(f"SESSION#{sess_id}", sk_prefix="MSG#")
            msg_count = len(msg_items)

            results.append({
                "id": sess_id,
                "title": s["title"],
                "session_token": s.get("session_token"),
                "created_at": s["created_at"],
                "updated_at": s["updated_at"],
                "createdAt": s["created_at"],
                "updatedAt": s["updated_at"],
                "message_count": msg_count,
            })

        return results, total

    def update_session(
        self, session_id: str, title: str | None = None
    ) -> dict[str, Any] | None:
        pk = f"SESSION#{session_id}"
        metadata = self._get_item(pk, "METADATA")
        if not metadata:
            return None

        now = utc_now_iso()
        if title is not None:
            metadata["title"] = title
        metadata["updated_at"] = now
        metadata["GSI1SK"] = f"{now}#{session_id}"
        self._put_item(metadata)

        return self.get_session(session_id, include_messages=True)

    def delete_session(self, session_id: str) -> bool:
        pk = f"SESSION#{session_id}"
        items = self._query_pk(pk)
        if not items:
            return False

        for it in items:
            self._delete_item(it["PK"], it["SK"])
        return True

    def clear_sessions(self, session_token: str | None = None) -> int:
        items, _ = self.list_sessions(session_token=session_token, limit=10000, offset=0)
        count = 0
        for s in items:
            sess_id = s.get("id")
            if sess_id and self.delete_session(sess_id):
                count += 1
        return count

    # -----------------------------------------------------------------------
    # Message Operations
    # -----------------------------------------------------------------------

    def add_message(
        self,
        message_id: str,
        session_id: str,
        role: str,
        content: str,
        status: str | None = None,
        sources: list[dict] | None = None,
        request_id: str | None = None,
        index_version: str | None = None,
        generation_mode: str | None = None,
        created_at: str | None = None,
    ) -> dict[str, Any]:
        now = created_at or utc_now_iso()
        pk = f"SESSION#{session_id}"

        # Check if session exists; auto-create if not
        metadata = self._get_item(pk, "METADATA")
        if not metadata:
            title = content[:36] if role == "user" else "Cuộc trò chuyện mới"
            self.create_session(session_id=session_id, title=title)
        else:
            # Touch session updated_at
            metadata["updated_at"] = now
            metadata["GSI1SK"] = f"{now}#{session_id}"
            self._put_item(metadata)

        sk = f"MSG#{now}#{message_id}"
        msg_item = {
            "PK": pk,
            "SK": sk,
            "message_id": message_id,
            "session_id": session_id,
            "role": role,
            "content": content,
            "status": status,
            "sources": json.dumps(sources, ensure_ascii=False) if sources is not None else None,
            "request_id": request_id,
            "index_version": index_version,
            "generation_mode": generation_mode,
            "created_at": now,
            "entity_type": "message",
        }
        self._put_item(msg_item)

        return self._format_message(msg_item)

    def _format_message(self, m: dict[str, Any]) -> dict[str, Any]:
        sources_val = m.get("sources")
        if isinstance(sources_val, str):
            try:
                sources = json.loads(sources_val)
            except Exception:
                sources = []
        elif isinstance(sources_val, list):
            sources = sources_val
        else:
            sources = []

        return {
            "message_id": m["message_id"],
            "session_id": m["session_id"],
            "role": m["role"],
            "content": m["content"],
            "status": m.get("status"),
            "sources": sources,
            "request_id": m.get("request_id"),
            "index_version": m.get("index_version"),
            "generation_mode": m.get("generation_mode"),
            "created_at": m["created_at"],
            "timestamp": m.get("created_at"),
        }

    def get_messages(self, session_id: str) -> list[dict[str, Any]]:
        pk = f"SESSION#{session_id}"
        items = self._query_pk(pk, sk_prefix="MSG#")
        items.sort(key=lambda m: m.get("created_at", ""))
        return [self._format_message(m) for m in items]

    def delete_message(self, message_id: str) -> bool:
        # Search for message across items
        target = None
        for (pk, sk), it in self._items.items():
            if it.get("message_id") == message_id:
                target = (pk, sk)
                break
        if target:
            return self._delete_item(target[0], target[1])
        return False

    # -----------------------------------------------------------------------
    # Feedback Operations
    # -----------------------------------------------------------------------

    def create_feedback(
        self,
        feedback_id: str,
        message_id: str,
        rating: str,
        comment: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        now = utc_now_iso()
        item = {
            "PK": f"FEEDBACK#{feedback_id}",
            "SK": "METADATA",
            "GSI1PK": "FEEDBACKS#GLOBAL",
            "GSI1SK": f"{now}#{feedback_id}",
            "feedback_id": feedback_id,
            "message_id": message_id,
            "session_id": session_id,
            "rating": rating,
            "comment": comment,
            "created_at": now,
            "status": "recorded",
            "entity_type": "feedback",
        }
        self._put_item(item)

        return {
            "feedback_id": feedback_id,
            "message_id": message_id,
            "session_id": session_id,
            "rating": rating,
            "comment": comment,
            "created_at": now,
            "status": "recorded",
        }

    def list_feedbacks(
        self, limit: int = 100, offset: int = 0
    ) -> tuple[list[dict[str, Any]], int]:
        raw_items, total = self._query_gsi1("FEEDBACKS#GLOBAL", limit=limit, offset=offset)
        results = [
            {
                "feedback_id": it["feedback_id"],
                "message_id": it["message_id"],
                "session_id": it.get("session_id"),
                "rating": it["rating"],
                "comment": it.get("comment"),
                "created_at": it["created_at"],
                "status": it.get("status", "recorded"),
            }
            for it in raw_items
        ]
        return results, total

    def get_feedback(self, feedback_id: str) -> dict[str, Any] | None:
        pk = f"FEEDBACK#{feedback_id}"
        it = self._get_item(pk, "METADATA")
        if not it:
            return None
        return {
            "feedback_id": it["feedback_id"],
            "message_id": it["message_id"],
            "session_id": it.get("session_id"),
            "rating": it["rating"],
            "comment": it.get("comment"),
            "created_at": it["created_at"],
            "status": it.get("status", "recorded"),
        }

    def delete_feedback(self, feedback_id: str) -> bool:
        pk = f"FEEDBACK#{feedback_id}"
        return self._delete_item(pk, "METADATA")

    # -----------------------------------------------------------------------
    # Document Knowledge Base Operations
    # -----------------------------------------------------------------------

    def create_document(self, doc_data: dict[str, Any]) -> dict[str, Any]:
        now = utc_now_iso()
        doc_id = doc_data["document_id"]
        item = {
            "PK": f"DOC#{doc_id}",
            "SK": "METADATA",
            "GSI1PK": "DOCUMENTS#GLOBAL",
            "GSI1SK": f"{now}#{doc_id}",
            "document_id": doc_id,
            "title": doc_data["title"],
            "category": doc_data.get("category", "academic"),
            "source_url": doc_data.get("source_url"),
            "applicable_year": doc_data.get("applicable_year"),
            "issue_date": doc_data.get("issue_date") or now[:10],
            "version": doc_data.get("version", "v1.0"),
            "status": doc_data.get("status", "processing"),
            "chunks_count": doc_data.get("chunks_count", 0),
            "size_mb": doc_data.get("size_mb", 0.0),
            "file_path": doc_data.get("file_path"),
            "created_at": doc_data.get("created_at") or now,
            "updated_at": now,
            "entity_type": "document",
        }
        self._put_item(item)
        return copy.deepcopy(item)

    def get_document(self, document_id: str) -> dict[str, Any] | None:
        pk = f"DOC#{document_id}"
        it = self._get_item(pk, "METADATA")
        return copy.deepcopy(it) if it else None

    def list_documents(
        self,
        category: str | None = None,
        status: str | None = None,
        search: str | None = None,
    ) -> list[dict[str, Any]]:
        results = []
        if self.use_mock or self._table is None:
            for item in self._items.values():
                if item.get("SK") == "METADATA" and item.get("entity_type") == "document":
                    results.append(copy.deepcopy(item))
        else:
            try:
                from boto3.dynamodb.conditions import Key
                res = self._table.query(
                    IndexName="GSI1",
                    KeyConditionExpression=Key("GSI1PK").eq("DOCUMENTS#GLOBAL"),
                    ScanIndexForward=False,
                )
                results = res.get("Items", [])
            except Exception as e:
                logger.error(f"DynamoDB documents query failed: {e}")
                for item in self._items.values():
                    if item.get("SK") == "METADATA" and item.get("entity_type") == "document":
                        results.append(copy.deepcopy(item))

        filtered = []
        for d in results:
            if category and category != "all" and d.get("category") != category:
                continue
            if status and status != "all" and d.get("status") != status:
                continue
            if search:
                s = search.lower()
                if s not in d.get("title", "").lower() and s not in d.get("document_id", "").lower():
                    continue
            filtered.append(d)

        filtered.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        return filtered

    def update_document(self, document_id: str, **kwargs) -> dict[str, Any] | None:
        pk = f"DOC#{document_id}"
        doc = self._get_item(pk, "METADATA")
        if not doc:
            return None
        now = utc_now_iso()
        for k, v in kwargs.items():
            if k not in {"PK", "SK", "document_id", "created_at"}:
                doc[k] = v
        doc["updated_at"] = now
        doc["GSI1SK"] = f"{now}#{document_id}"
        self._put_item(doc)
        return copy.deepcopy(doc)

    def delete_document(self, document_id: str) -> bool:
        pk = f"DOC#{document_id}"
        return self._delete_item(pk, "METADATA")

    # -----------------------------------------------------------------------
    # Indexing Job Operations
    # -----------------------------------------------------------------------

    def create_job(self, job_data: dict[str, Any]) -> dict[str, Any]:
        now = utc_now_iso()
        job_id = job_data["job_id"]
        item = {
            "PK": f"JOB#{job_id}",
            "SK": "METADATA",
            "GSI1PK": "JOBS#GLOBAL",
            "GSI1SK": f"{now}#{job_id}",
            "job_id": job_id,
            "document_id": job_data["document_id"],
            "title": job_data["title"],
            "status": job_data.get("status", "processing"),
            "progress": job_data.get("progress", 0),
            "index_version": job_data.get("index_version"),
            "error_message": job_data.get("error_message"),
            "created_at": job_data.get("created_at") or now,
            "updated_at": now,
            "entity_type": "job",
        }
        self._put_item(item)
        return copy.deepcopy(item)

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        pk = f"JOB#{job_id}"
        it = self._get_item(pk, "METADATA")
        return copy.deepcopy(it) if it else None

    def list_jobs(self, limit: int = 20) -> list[dict[str, Any]]:
        results = []
        if self.use_mock or self._table is None:
            for item in self._items.values():
                if item.get("SK") == "METADATA" and item.get("entity_type") == "job":
                    results.append(copy.deepcopy(item))
        else:
            try:
                from boto3.dynamodb.conditions import Key
                res = self._table.query(
                    IndexName="GSI1",
                    KeyConditionExpression=Key("GSI1PK").eq("JOBS#GLOBAL"),
                    ScanIndexForward=False,
                )
                results = res.get("Items", [])
            except Exception as e:
                logger.error(f"DynamoDB jobs query failed: {e}")
                for item in self._items.values():
                    if item.get("SK") == "METADATA" and item.get("entity_type") == "job":
                        results.append(copy.deepcopy(item))

        results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return results[:limit]

    def update_job(self, job_id: str, **kwargs) -> dict[str, Any] | None:
        pk = f"JOB#{job_id}"
        job = self._get_item(pk, "METADATA")
        if not job:
            return None
        now = utc_now_iso()
        for k, v in kwargs.items():
            if k not in {"PK", "SK", "job_id", "created_at"}:
                job[k] = v
        job["updated_at"] = now
        job["GSI1SK"] = f"{now}#{job_id}"
        self._put_item(job)
        return copy.deepcopy(job)

    # -----------------------------------------------------------------------
    # Lifecycle
    # -----------------------------------------------------------------------

    def close(self) -> None:
        self._items.clear()
        self._table = None
        self._dynamodb = None
