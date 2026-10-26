"""Opt-in real CPU model + HTTP smoke; prepare model and fixture index first."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import URLError
from urllib.request import Request, urlopen


def main():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    root = Path(__file__).resolve().parents[1]
    env = dict(os.environ, APP_ENV='development', RETRIEVAL_ENABLED='true',
               INDEX_DIR=str(root / 'indexes'), MODEL_CACHE=str(root / '.model-cache'),
               HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1')
    with tempfile.TemporaryFile(mode='w+', encoding='utf-8') as log:
        process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app',
                                    '--host', '127.0.0.1', '--port', str(port), '--no-access-log'],
                                   cwd=root, env=env, stdout=log, stderr=log)
        try:
            base = f'http://127.0.0.1:{port}'
            for _ in range(300):
                try:
                    with urlopen(base + '/health', timeout=2) as response:
                        assert response.status == 200
                    break
                except (URLError, OSError):
                    if process.poll() is not None:
                        raise RuntimeError('Server exited before startup')
                    time.sleep(0.2)
            else:
                raise RuntimeError('Server startup timed out')
            with urlopen(base + '/ready', timeout=3) as response:
                ready = json.load(response)
                assert response.status == 200 and ready['scope'] == 'retrieval'
            for query, category in [('Tra cứu lịch học ở đâu?', 'academic'),
                                    ('Cần kiểm tra hồ sơ tuyển sinh như thế nào?', 'admissions')]:
                data = json.dumps({'query': query, 'category': category, 'top_k': 2}).encode()
                request = Request(base + '/api/search', data=data, headers={'Content-Type': 'application/json'})
                with urlopen(request, timeout=30) as response:
                    body = json.load(response)
                    assert response.status == 200 and body['index_version'] == ready['index_version']
                    assert body['request_id'] == response.headers['X-Request-ID']
                    assert body['results'] and all(r['category'] == category for r in body['results'])
                    first = body['results'][0]
                    assert 'example.org/demo/' in first['source_url']
                    print(json.dumps({'query': query, 'source': first['source_url'],
                                      'location': first['page_or_section'], 'text': first['text'],
                                      'score': first['score']}, ensure_ascii=True))
            print('PASS real CPU model, offline API startup, /health, /ready, Vietnamese HTTP search and sources')
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


if __name__ == '__main__':
    main()
