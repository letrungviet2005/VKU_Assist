import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger("app.storage.s3")


class S3DocumentStorage:
    """Amazon S3 / Local Document Storage for VKU Assist Knowledge Base.
    
    Provides unified persistence interface for raw knowledge documents (PDF, MD, TXT):
    - When `local_dir` is specified or S3 is unavailable, persists directly to filesystem.
    - When `bucket_name` is configured with AWS credentials, connects via boto3.
    """

    def __init__(
        self,
        bucket_name: str | None = None,
        local_dir: str | Path | None = None,
        region_name: str = "ap-southeast-1",
        endpoint_url: str | None = None,
    ):
        self.bucket_name = bucket_name
        self.local_dir = Path(local_dir) if local_dir else None
        self.region_name = region_name
        self.endpoint_url = endpoint_url
        self._s3_client = None

        if self.local_dir:
            self.local_dir.mkdir(parents=True, exist_ok=True)
        elif self.bucket_name:
            self._init_s3_client()

    def _init_s3_client(self) -> None:
        try:
            import boto3
            from botocore.exceptions import NoCredentialsError

            session = boto3.Session(region_name=self.region_name)
            client_kwargs: dict[str, Any] = {}
            if self.endpoint_url:
                client_kwargs["endpoint_url"] = self.endpoint_url
            self._s3_client = session.client("s3", **client_kwargs)
        except (ImportError, NoCredentialsError, Exception) as e:
            logger.warning(f"S3 client initialization failed ({e}). Defaulting to local temporary storage.")
            self._s3_client = None

    def upload_file(self, content: bytes, key: str) -> str:
        """Upload raw bytes to local filesystem or S3, returning URI."""
        if self.local_dir:
            file_path = self.local_dir / key
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_bytes(content)
            return str(file_path)

        if self._s3_client and self.bucket_name:
            try:
                self._s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=content,
                )
                return f"s3://{self.bucket_name}/{key}"
            except Exception as e:
                logger.error(f"S3 upload failed: {e}")

        # Fallback in-memory / local temp
        fallback_dir = Path("data/documents")
        fallback_dir.mkdir(parents=True, exist_ok=True)
        fallback_path = fallback_dir / key
        fallback_path.parent.mkdir(parents=True, exist_ok=True)
        fallback_path.write_bytes(content)
        return str(fallback_path)

    def download_file(self, key: str) -> bytes | None:
        """Download raw bytes of stored document."""
        if self.local_dir:
            file_path = self.local_dir / key
            if file_path.exists() and file_path.is_file():
                return file_path.read_bytes()
            return None

        if self._s3_client and self.bucket_name:
            try:
                res = self._s3_client.get_object(Bucket=self.bucket_name, Key=key)
                return res["Body"].read()
            except Exception as e:
                logger.error(f"S3 download failed: {e}")

        fallback_path = Path("data/documents") / key
        if fallback_path.exists() and fallback_path.is_file():
            return fallback_path.read_bytes()
        return None

    def list_files(self, prefix: str = "") -> list[str]:
        """List all object keys matching the prefix."""
        if self.local_dir:
            results = []
            for path in self.local_dir.rglob("*"):
                if path.is_file():
                    rel = path.relative_to(self.local_dir).as_posix()
                    if rel.startswith(prefix):
                        results.append(rel)
            return sorted(results)

        if self._s3_client and self.bucket_name:
            try:
                res = self._s3_client.list_objects_v2(Bucket=self.bucket_name, Prefix=prefix)
                return [obj["Key"] for obj in res.get("Contents", [])]
            except Exception as e:
                logger.error(f"S3 list_objects failed: {e}")

        return []

    def delete_file(self, key: str) -> bool:
        """Delete document file."""
        if self.local_dir:
            file_path = self.local_dir / key
            if file_path.exists() and file_path.is_file():
                file_path.unlink()
                return True
            return False

        if self._s3_client and self.bucket_name:
            try:
                self._s3_client.delete_object(Bucket=self.bucket_name, Key=key)
                return True
            except Exception as e:
                logger.error(f"S3 delete failed: {e}")

        return False

    def close(self) -> None:
        self._s3_client = None
