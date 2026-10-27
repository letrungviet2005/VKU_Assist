"""Opt-in HTTP chat smoke. Fake by default; one paid call requires two explicit flags."""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--provider', choices=['fake', 'bedrock'], default='fake')
    parser.add_argument('--allow-paid-call', action='store_true')
    args = parser.parse_args()
    if args.provider == 'bedrock' and not args.allow_paid_call:
        parser.error('Bedrock requires --allow-paid-call; this makes at most one generation request')
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root))
    from app.core.config import Settings
    from app.llm.client import configuration_error

    settings = Settings(chat_enabled=True, llm_provider=args.provider, app_env='development')
    if reason := configuration_error(settings):
        print(f'Cannot run: {reason}. Configure BEDROCK_REGION and BEDROCK_MODEL_ID first.')
        return 1
    env = dict(os.environ, APP_ENV='development', RETRIEVAL_ENABLED='true', CHAT_ENABLED='true',
               LLM_PROVIDER=args.provider, MODEL_CACHE=str(settings.model_cache.resolve()),
               INDEX_DIR=str(settings.index_dir.resolve()), HF_HUB_OFFLINE='1', TRANSFORMERS_OFFLINE='1')
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    base = f'http://127.0.0.1:{port}'
    with tempfile.TemporaryFile(mode='w+', encoding='utf-8') as log:
        process = subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app',
                                    '--host', '127.0.0.1', '--port', str(port), '--no-access-log'],
                                   cwd=root, env=env, stdout=log, stderr=log)
        try:
            for _ in range(300):
                try:
                    with urlopen(base + '/health', timeout=2) as response:
                        assert response.status == 200
                    break
                except (URLError, OSError):
                    if process.poll() is not None:
                        raise RuntimeError('Backend exited before startup')
                    time.sleep(.2)
            else:
                raise RuntimeError('Backend startup timed out')
            try:
                with urlopen(base + '/ready', timeout=3) as response:
                    ready = json.load(response)
            except HTTPError:
                print('Retrieval/chat not ready. Prepare the local model and fixture index first.')
                return 1
            body = json.dumps({'message': 'Tra cứu lịch học ở đâu?', 'category': 'academic'}, ensure_ascii=False).encode()
            request = Request(base + '/api/chat', data=body, headers={'Content-Type': 'application/json'})
            try:
                with urlopen(request, timeout=settings.llm_connect_timeout + settings.llm_read_timeout + 90) as response:
                    result = json.load(response)
                    assert result['request_id'] == response.headers['X-Request-ID']
            except HTTPError as error:
                print(json.dumps(json.load(error), ensure_ascii=True))
                return 1
            assert result['generation_mode'] == args.provider
            assert result['index_version'] == ready['index_version']
            if args.provider == 'fake':
                assert result['status'] == 'answered' and 'FAKE' in result['answer']
                assert result['sources'] and result['sources'][0]['url'].startswith('https://example.org/demo/')
            # Deliberately print only identifiers/outcome, not prompts, question or answer.
            print(json.dumps({'provider': args.provider, 'region': settings.bedrock_region if args.provider == 'bedrock' else None,
                'model': settings.bedrock_model_id if args.provider == 'bedrock' else 'fake',
                'status': result['status'], 'index_version': result['index_version'],
                'request_id': result['request_id'], 'sources': len(result['sources'])}, ensure_ascii=True))
            print('PASS HTTP chat contract; this does not evaluate answer quality.')
            return 0
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


if __name__ == '__main__':
    raise SystemExit(main())
