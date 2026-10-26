from threading import Lock

from app.rag.index_store import chunk_config, load_bundle


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

    @property
    def version(self):
        return self.manifest["index_version"]

    def search(self, query: str, top_k: int, category=None, applicable_year=None):
        import faiss
        import numpy as np

        eligible = [i for i, c in enumerate(self.chunks)
                    if (category is None or c.category == category)
                    and (applicable_year is None or c.applicable_year == applicable_year)]
        if not eligible:
            return []
        with self.lock:
            query_vector = self.embedder.encode([query], "query")
            # Filter inside FAISS's exact search: no rebuild and no global top-k loss.
            selector = faiss.IDSelectorBatch(np.asarray(eligible, dtype="int64"))
            scores, positions = self.index.search(
                query_vector, min(top_k, len(eligible)), params=faiss.SearchParameters(sel=selector),
            )
        return [{**self.chunks[int(position)].model_dump(mode="json"), "score": float(score)}
                for score, position in zip(scores[0], positions[0])]
