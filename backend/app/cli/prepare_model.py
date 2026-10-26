import argparse

from app.core.config import get_settings
from app.rag.embeddings import Embedder, snapshot


def main():
    parser = argparse.ArgumentParser(description="Explicitly download and verify the configured CPU embedding model")
    parser.parse_args()
    try:
        settings = get_settings()
        path = snapshot(settings, download=True)
        model = Embedder(settings)
        print(f"Prepared {settings.embedding_model} revision={path.name} dimension={model.dimension}")
    except Exception as error:
        print(f"Model preparation failed ({type(error).__name__}). No fallback model was selected.")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
