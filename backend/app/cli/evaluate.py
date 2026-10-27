"""Local pilot runner using the existing Retriever and ChatService, never a parallel RAG pipeline."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
from threading import Lock
from time import perf_counter
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field

from app.core.config import Settings
from app.core.errors import ServiceError
from app.llm.client import configuration_error, create_adapter
from app.rag.retriever import Retriever
from app.rag.schemas import Category
from app.schemas.chat import ChatInput, ChatStatus
from app.services.chat_service import ChatService


class Evidence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    document_id: str
    section_contains: str = ""
    support_excerpt: str = ""
    chunk_ids: list[str] = []
    confirmed: bool = False


class Question(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question_id: str
    question: str = Field(min_length=1, max_length=2000)
    category: Category | None
    applicable_year: int | None = None
    kind: str
    expected_status: ChatStatus
    key_points: list[str]
    evidence: list[Evidence]
    review_status: str
    reviewers: list[str] = []
    notes: str = ""


class Dataset(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schema_version: int
    dataset_id: str
    purpose: str
    review_status: str
    questions: list[Question] = Field(min_length=1)


def file_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def save_json(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")


def reference_match(reference, results):
    for chunk in results:
        if chunk['document_id'] != reference.document_id:
            continue
        if reference.chunk_ids:
            if chunk['chunk_id'] in reference.chunk_ids:
                return True
        elif (reference.section_contains in str(chunk['page_or_section'] or '')
              and reference.support_excerpt in chunk['text']):
            return True
    return False


def reviewed(question):
    names = {name.strip().casefold() for name in question.reviewers if name.strip()}
    return question.review_status == 'human_approved' and len(names) >= 2 and 'thu trang' in names


class CallBudget:
    def __init__(self, maximum):
        self.maximum, self.calls = maximum, 0
        self.lock = Lock()

    def take(self):
        with self.lock:
            if self.calls >= self.maximum:
                raise ServiceError(429, 'evaluation_call_budget_exhausted', 'Đã hết số lời gọi được cho phép cho lần đánh giá.')
            self.calls += 1


class CaptureRetriever:
    def __init__(self, retriever):
        self.snapshot, self.results = retriever, []
        self.version = retriever.version
        self.duration_ms = None

    def search(self, *args, **kwargs):
        start = perf_counter()
        try:
            self.results = self.snapshot.search(*args, **kwargs)
            return self.results
        finally:
            self.duration_ms = round((perf_counter() - start) * 1000, 2)


class CaptureAdapter:
    def __init__(self, adapter, budget, deadline=float('inf')):
        self.adapter, self.budget, self.usage = adapter, budget, {}
        self.called = False
        self.deadline = deadline

    def generate(self, prompt):
        if perf_counter() > self.deadline:
            raise ServiceError(504, 'evaluation_run_deadline', 'Hết thời gian bắt đầu lời gọi sinh câu trả lời.')
        self.budget.take()
        self.called = True
        generation = self.adapter.generate(prompt)
        self.usage = generation.usage
        return generation


def evaluate_question(question, retriever, settings, mode, adapter, budget, timeout, deadline):
    start = perf_counter()
    capture = CaptureRetriever(retriever)
    generator = CaptureAdapter(adapter, budget, deadline)
    row = dict(question_id=question.question_id, question=question.question,
               category=question.category, applicable_year=question.applicable_year,
               expected_status=question.expected_status, review_status=question.review_status,
               request_id=str(uuid4()), message_id=str(uuid4()), index_version=retriever.version,
               generation_mode=settings.llm_provider if mode == 'e2e' else None,
               generation_called=False, status=None, answer=None, sources=[], error_code=None)
    try:
        if perf_counter() > deadline:
            raise ServiceError(504, 'evaluation_run_deadline', 'Hết thời gian bắt đầu câu tiếp theo.')
        if mode == 'retrieval':
            capture.search(question.question, settings.search_top_k, question.category, question.applicable_year)
            row['status'] = 'retrieved'
        else:
            body = ChatInput(message=question.question, category=question.category, applicable_year=question.applicable_year)
            if len(body.message) > settings.chat_max_message_chars:
                raise ServiceError(422, 'message_too_long', 'Câu hỏi vượt giới hạn cấu hình.')
            result = ChatService(settings, generator).answer(body, capture, row['request_id'], row['message_id'])
            row.update(result.model_dump(mode='json'))
    except ServiceError as error:
        row['error_code'] = error.code
        row['http_status'] = error.status
    except Exception as error:
        # Avoid persisting SDK error messages with signed URLs or configuration details.
        row['error_code'] = 'evaluation_' + type(error).__name__
    row['duration_ms'] = round((perf_counter() - start) * 1000, 2)
    row['timeout_exceeded'] = row['duration_ms'] > timeout * 1000
    row['retrieval_ms'] = capture.duration_ms
    row['retrieval_results'] = capture.results
    row['generation_called'] = generator.called
    row['token_usage'] = generator.usage
    row['reference_checks'] = [dict(document_id=e.document_id,
        confirmed=e.confirmed and reviewed(question), hit=reference_match(e, capture.results)) for e in question.evidence]
    if row['status'] == 'answered' and row['error_code'] is None:
        # ChatService already validates IDs against contexts actually sent to the adapter.
        row['valid_citations'] = bool(row['sources'])
    else:
        row['valid_citations'] = None
    return row


def summary(rows):
    errors = sum(row['error_code'] is not None for row in rows)
    answered = [r for r in rows if r['status'] == 'answered' and not r['error_code']]
    references = [check for row in rows for check in row['reference_checks'] if check['confirmed']]
    return dict(questions=len(rows), technical_errors=errors, technical_error_rate=errors / len(rows),
        answered_count=len(answered), answered_valid_citation_rate=(sum(r['valid_citations'] for r in answered) / len(answered)) if answered else None,
        confirmed_reference_count=len(references), confirmed_retrieval_hit_rate=(sum(r['hit'] for r in references) / len(references)) if references else None,
        mean_duration_ms=sum(r['duration_ms'] for r in rows) / len(rows),
        timeout_exceeded_count=sum(r['timeout_exceeded'] for r in rows),
        content_accuracy=None, human_review_status='not_scored; fill manual_review.csv')


def run(args):
    dataset = Dataset.model_validate_json(args.dataset.read_text(encoding='utf-8'))
    if dataset.schema_version != 1 or len({q.question_id for q in dataset.questions}) != len(dataset.questions):
        raise ValueError('Unsupported dataset or duplicate question IDs')
    settings = Settings()
    updates = dict(index_dir=args.index_dir, llm_read_timeout=args.timeout,
                   llm_connect_timeout=min(5, args.timeout))
    if args.mode == 'e2e':
        if not args.provider:
            raise ValueError('--provider must be explicit in e2e mode')
        if args.provider == 'bedrock' and not args.allow_paid_calls:
            raise ValueError('Bedrock requires --allow-paid-calls')
        updates.update(chat_enabled=True, llm_provider=args.provider)
    settings = Settings(**{**settings.model_dump(), **updates})
    if args.mode == 'e2e' and configuration_error(settings):
        raise ValueError('Chat provider configuration missing or forbidden; no provider fallback')
    retriever = Retriever(settings)
    documents = json.loads(args.document_manifest.read_text(encoding='utf-8'))
    embedded_docs = retriever.manifest['documents']
    if len(documents) != len(embedded_docs) or any(not any(all(doc.get(k) == embedded.get(k) for k in doc) for embedded in embedded_docs) for doc in documents):
        raise ValueError('Document manifest does not match the loaded bundle')
    adapter = create_adapter(settings) if args.mode == 'e2e' else None
    budget = CallBudget(args.max_llm_calls)
    questions = dataset.questions
    if args.question_id:
        wanted = set(args.question_id)
        questions = [q for q in questions if q.question_id in wanted]
        if {q.question_id for q in questions} != wanted:
            raise ValueError('Unknown question ID')
    questions = questions[:args.limit]
    run_id = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid4().hex[:8]
    output = args.output / run_id
    output.mkdir(parents=True, exist_ok=False)
    root = Path(__file__).resolve().parents[3]
    git = subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=root, capture_output=True, text=True)
    dirty = subprocess.run(['git', 'status', '--porcelain'], cwd=root, capture_output=True, text=True)
    metadata = dict(run_id=run_id, started_at=datetime.now(timezone.utc).isoformat(),
        git_revision=git.stdout.strip() if git.returncode == 0 else None,
        git_dirty=bool(dirty.stdout.strip()) if dirty.returncode == 0 else None,
        dataset_sha256=file_hash(args.dataset), document_manifest_sha256=file_hash(args.document_manifest),
        index_version=retriever.version, embedding=retriever.manifest['embedding'],
        mode=args.mode, provider=args.provider if args.mode == 'e2e' else None,
        generation_mode=settings.llm_provider if args.mode == 'e2e' else None,
        model=settings.bedrock_model_id if args.mode == 'e2e' and args.provider == 'bedrock' else None,
        region=settings.bedrock_region if args.mode == 'e2e' and args.provider == 'bedrock' else None,
        concurrency=args.concurrency, read_timeout_seconds=args.timeout, run_deadline_seconds=args.run_timeout,
        max_llm_calls=args.max_llm_calls, dataset_review_status=dataset.review_status)
    catalog = args.document_manifest.parent / 'source_catalog.json'
    metadata['source_catalog_sha256'] = file_hash(catalog) if catalog.exists() else None
    save_json(output / 'run.json', metadata)
    deadline = perf_counter() + args.run_timeout
    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        rows = list(executor.map(lambda q: evaluate_question(q, retriever, settings, args.mode,
                                   adapter, budget, args.timeout, deadline), questions))
    metadata.update(finished_at=datetime.now(timezone.utc).isoformat(), generation_attempts=budget.calls)
    save_json(output / 'run.json', metadata)
    save_json(output / 'results.json', rows)
    save_json(output / 'automatic_summary.json', summary(rows))
    with (output / 'manual_review.csv').open('w', encoding='utf-8-sig', newline='') as file:
        fields = ['run_id', 'question_id', 'reviewer', 'reviewed_at', 'correctness', 'source_support',
                  'year_cohort_correct', 'clarification_or_refusal_appropriate', 'notes', 'approval_status']
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            writer.writerow(dict(run_id=run_id, question_id=row['question_id']))
    print(json.dumps(dict(run_id=run_id, questions=len(rows), generation_attempts=budget.calls,
                          output=str(output), technical_errors=sum(bool(r['error_code']) for r in rows)), ensure_ascii=True))
    return 0 if not any(r['error_code'] for r in rows) else 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dataset', type=Path, required=True)
    parser.add_argument('--document-manifest', type=Path, required=True)
    parser.add_argument('--index-dir', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=Path('../evaluation/results'))
    parser.add_argument('--mode', choices=['retrieval', 'e2e'], default='retrieval')
    parser.add_argument('--provider', choices=['bedrock', 'fake'])
    parser.add_argument('--allow-paid-calls', action='store_true')
    parser.add_argument('--limit', type=int, default=2)
    parser.add_argument('--max-llm-calls', type=int, default=2)
    parser.add_argument('--concurrency', type=int, default=1)
    parser.add_argument('--timeout', type=float, default=60)
    parser.add_argument('--run-timeout', type=float, default=600)
    parser.add_argument('--question-id', action='append')
    args = parser.parse_args()
    if not (1 <= args.limit <= 100 and 1 <= args.concurrency <= 4 and 0 <= args.max_llm_calls <= 100
            and 0 < args.timeout <= 300 and 0 < args.run_timeout <= 3600):
        parser.error('Invalid limit/concurrency/timeout/call budget')
    try:
        return run(args)
    except Exception as error:
        print(f'Evaluation failed ({type(error).__name__}); check paths, configuration and local model/index. No provider fallback.')
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
