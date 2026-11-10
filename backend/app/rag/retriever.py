from collections import Counter
import math
import re
from threading import Lock

from app.rag.index_store import chunk_config, load_bundle

_TOKEN_RE = re.compile(r"\w+", re.UNICODE)


def _tokenize_lexical(text: str) -> list[str]:
    return [tok for tok in _TOKEN_RE.findall((text or "").lower()) if len(tok) > 1 or tok.isdigit()]


class Retriever:
    def __init__(self, settings, embedder=None):
        from app.rag.embeddings import Embedder

        self.manifest, self.chunks, self.index = load_bundle(
            settings.index_dir, expected_chunking=chunk_config(settings),
        )
        self.embedder = embedder if embedder is not None else Embedder(settings)
        if self.manifest["embedding"] != self.embedder.identity:
            raise ValueError("Embedding model/revision/configuration differs from index")
        self.lock = Lock()

        # Precompute lightweight lexical frequencies for hybrid BM25 retrieval
        self._doc_tokens: list[Counter[str]] = [
            Counter(_tokenize_lexical(f"{c.title} {c.page_or_section or ''} {c.text}"))
            for c in self.chunks
        ]
        self._doc_lengths: list[int] = [sum(tokens.values()) for tokens in self._doc_tokens]
        self._avg_doc_len: float = (
            sum(self._doc_lengths) / len(self._doc_lengths) if self._doc_lengths else 1.0
        )
        self._df: Counter[str] = Counter()
        for tokens in self._doc_tokens:
            for term in tokens:
                self._df[term] += 1

    @property
    def version(self):
        return self.manifest["index_version"]

    def _bm25_scores(self, query: str, eligible: list[int]) -> dict[int, float]:
        query_terms = _tokenize_lexical(query)
        if not query_terms or not eligible:
            return {}
        n_docs = max(len(self.chunks), 1)
        k1 = 1.5
        b = 0.75
        scores: dict[int, float] = {}
        for idx in eligible:
            doc_tf = self._doc_tokens[idx]
            dl = self._doc_lengths[idx]
            score = 0.0
            for term in query_terms:
                tf = doc_tf.get(term, 0)
                if tf == 0:
                    continue
                df = self._df.get(term, 0)
                idf = math.log((n_docs - df + 0.5) / (df + 0.5) + 1.0)
                denom = tf + k1 * (1.0 - b + b * (dl / max(self._avg_doc_len, 1.0)))
                score += idf * ((tf * (k1 + 1.0)) / denom)
            if score > 0:
                scores[idx] = score
        return scores

    def search(
        self,
        query: str,
        top_k: int,
        category=None,
        applicable_year=None,
        *,
        document_id: str | None = None,
        hybrid: bool = False,
    ):
        import faiss
        import numpy as np

        eligible = [
            i for i, c in enumerate(self.chunks)
            if (category is None or c.category == category)
            and (applicable_year is None or c.applicable_year == applicable_year)
            and (document_id is None or c.document_id == document_id)
        ]
        if not eligible:
            return []

        candidate_k = min(max(top_k * 3, 15) if hybrid else top_k, len(eligible))
        with self.lock:
            query_vector = self.embedder.encode([query], "query")
            # Filter inside FAISS's exact search: no rebuild and no global top-k loss.
            selector = faiss.IDSelectorBatch(np.asarray(eligible, dtype="int64"))
            scores, positions = self.index.search(
                query_vector, candidate_k, params=faiss.SearchParameters(sel=selector),
            )

        dense_pairs = [
            (int(position), float(score))
            for score, position in zip(scores[0], positions[0])
            if int(position) >= 0
        ]

        if not hybrid:
            return [
                {**self.chunks[pos].model_dump(mode="json"), "score": score}
                for pos, score in dense_pairs[:top_k]
            ]

        # Reciprocal Rank Fusion (RRF) between FAISS dense rank and BM25 lexical rank
        dense_score_map = {pos: score for pos, score in dense_pairs}
        bm25_map = self._bm25_scores(query, eligible)
        bm25_ranked = sorted(bm25_map.items(), key=lambda item: item[1], reverse=True)

        rrf_scores: dict[int, float] = {}
        k_rrf = 60.0
        for rank, (pos, _) in enumerate(dense_pairs, start=1):
            rrf_scores[pos] = rrf_scores.get(pos, 0.0) + 1.0 / (k_rrf + rank)
        for rank, (pos, _) in enumerate(bm25_ranked[:candidate_k], start=1):
            rrf_scores[pos] = rrf_scores.get(pos, 0.0) + 1.0 / (k_rrf + rank)

        fused_positions = sorted(rrf_scores.keys(), key=lambda pos: rrf_scores[pos], reverse=True)[:top_k]
        results = []
        for pos in fused_positions:
            dumped = self.chunks[pos].model_dump(mode="json")
            dumped["score"] = dense_score_map.get(pos, 0.0)
            dumped["hybrid_score"] = round(rrf_scores[pos], 6)
            results.append(dumped)
        return results

    def list_documents(self) -> list[dict]:
        """Aggregate indexed chunks into document-level metadata for public library exploration."""
        by_doc: dict[str, dict] = {}
        for chunk in self.chunks:
            doc = by_doc.get(chunk.document_id)
            if doc is None:
                doc = {
                    "document_id": chunk.document_id,
                    "title": chunk.title,
                    "category": chunk.category,
                    "source_url": str(chunk.source_url),
                    "applicable_year": chunk.applicable_year,
                    "version": chunk.document_version,
                    "status": "ready",
                    "chunks_count": 0,
                    "updated_at": chunk.indexed_at,
                    "sections_preview": [],
                }
                by_doc[chunk.document_id] = doc
            doc["chunks_count"] += 1
            sec = chunk.page_or_section
            if sec is not None and str(sec) not in doc["sections_preview"] and len(doc["sections_preview"]) < 6:
                doc["sections_preview"].append(str(sec))
        return list(by_doc.values())

    def get_document_chunks(self, document_id: str, limit: int = 30) -> list[dict]:
        """Return indexed chunks belonging to a specific document."""
        matched = [
            chunk.model_dump(mode="json")
            for chunk in self.chunks
            if chunk.document_id == document_id
        ]
        return matched[:limit]
