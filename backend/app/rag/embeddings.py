"""Explicit preparation may use network; runtime is local-files-only."""
import re

from app.rag.chunking import prefixed


def snapshot(settings, download: bool = False):
    from pathlib import Path
    from huggingface_hub import snapshot_download

    path = Path(snapshot_download(
        repo_id=settings.embedding_model, revision=settings.embedding_revision,
        cache_dir=str(settings.model_cache), local_files_only=not download,
        allow_patterns=["*.json", "*.txt", "*.model", "*.safetensors", "README.md"],
        token=False,
    ))
    if not re.fullmatch(r"[a-f0-9]{40}", path.name):
        raise ValueError("Cannot determine the actual model commit revision")
    if not (path / "modules.json").is_file():
        raise ValueError("Prepared model is missing Sentence Transformers modules.json")
    return path


class ModelUnavailable(RuntimeError):
    pass


class Embedder:
    def __init__(self, settings):
        try:
            self._load(settings)
        except Exception as error:
            raise ModelUnavailable("Prepared model is missing or cannot be loaded locally") from error

    def _load(self, settings):
        from sentence_transformers import SentenceTransformer

        path = snapshot(settings)
        self.model = SentenceTransformer(
            str(path), device="cpu", local_files_only=True, trust_remote_code=False,
            model_kwargs={"use_safetensors": True},
        )
        self.tokenizer = self.model.tokenizer
        self.limit = self.model.max_seq_length
        self.dimension = self.model.get_sentence_embedding_dimension()
        self.identity = {"model_id": settings.embedding_model, "revision": path.name,
                         "dimension": self.dimension, "max_tokens": self.limit,
                         "passage_prefix": "passage: ", "query_prefix": "query: ",
                         "normalized": True}

    def encode(self, texts: list[str], kind: str):
        import numpy as np

        inputs = [prefixed(text, kind) for text in texts]
        for text in inputs:
            if len(self.tokenizer(text, add_special_tokens=True)["input_ids"]) > self.limit:
                raise ValueError("Input exceeds model token limit; shorten the query or chunk")
        vectors = self.model.encode(inputs, normalize_embeddings=True, convert_to_numpy=True,
                                    show_progress_bar=False, prompt="", batch_size=16)
        return np.ascontiguousarray(vectors, dtype="float32")
