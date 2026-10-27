"""Run against a real, temporary Uvicorn process using only the standard library."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class BackendSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        cls.base = f"http://127.0.0.1:{port}"
        cls.log = tempfile.TemporaryFile(mode="w+", encoding="utf-8")
        env = dict(os.environ, APP_NAME="VKU Assist Test", APP_ENV="test", LOG_LEVEL="INFO",
                   RETRIEVAL_ENABLED="false", CHAT_ENABLED="false",
                   CORS_ORIGINS='["http://localhost:5173","http://127.0.0.1:5173"]')
        cls.process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1",
             "--port", str(port), "--no-access-log"],
            cwd=Path(__file__).resolve().parents[1], env=env, stdout=cls.log, stderr=cls.log,
        )
        cls.addClassCleanup(cls.cleanup)
        for _ in range(100):
            try:
                cls.fetch("/health")
                return
            except (URLError, OSError):
                if cls.process.poll() is not None:
                    break
                time.sleep(0.1)
        cls.log.seek(0)
        raise RuntimeError("Server did not start: " + cls.log.read())

    @classmethod
    def cleanup(cls):
        cls.process.terminate()
        try:
            cls.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            cls.process.kill()
            cls.process.wait(timeout=5)
        cls.log.close()

    @classmethod
    def fetch(cls, path, headers=None, method="GET"):
        request = Request(cls.base + path, headers=headers or {}, method=method)
        try:
            response = urlopen(request, timeout=3)
        except HTTPError as error:
            response = error
        with response:
            return response.status, response.headers, response.read()

    def test_endpoints_and_request_logs(self):
        request_ids = set()
        for path, expected in (("/health", 200), ("/ready", 503),
                               ("/openapi.json", 200), ("/docs", 200)):
            status, headers, body = self.fetch(path)
            self.assertEqual(status, expected)
            request_ids.add(headers["X-Request-ID"])
            if path == "/health":
                self.assertEqual(json.loads(body), {"status": "ok", "service": "VKU Assist Test"})
            elif path == "/ready":
                self.assertEqual(json.loads(body), {"status": "not_ready", "reason": "retrieval_not_initialized"})
            elif path == "/openapi.json":
                self.assertTrue({"/health", "/ready"} <= json.loads(body)["paths"].keys())
        self.assertEqual(len(request_ids), 4)
        self.log.seek(0)
        records = [json.loads(line) for line in self.log.read().splitlines() if line.startswith("{")]
        matching = [r for r in records if r.get("request_id") in request_ids]
        self.assertEqual(len(matching), 4)
        for record in matching:
            self.assertTrue({"request_id", "method", "path", "status_code", "duration_ms"} <= record.keys())

    def test_cors(self):
        for origin in ("http://localhost:5173", "http://127.0.0.1:5173"):
            status, headers, _ = self.fetch("/health", {"Origin": origin})
            self.assertEqual(status, 200)
            self.assertEqual(headers["Access-Control-Allow-Origin"], origin)
            self.assertIn("X-Request-ID", headers["Access-Control-Expose-Headers"])
        _, headers, _ = self.fetch("/health", {"Origin": "https://outside.example"})
        self.assertIsNone(headers.get("Access-Control-Allow-Origin"))
        for origin, expected in (("http://localhost:5173", 200), ("https://outside.example", 400)):
            status, headers, _ = self.fetch("/health", {
                "Origin": origin, "Access-Control-Request-Method": "GET",
            }, method="OPTIONS")
            self.assertEqual(status, expected)
            self.assertIsNotNone(headers.get("X-Request-ID"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
