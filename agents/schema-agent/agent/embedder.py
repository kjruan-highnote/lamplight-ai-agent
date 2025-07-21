import os
import json
import faiss
import numpy as np
from pathlib import Path
from sentence_transformers import SentenceTransformer

class Embedder:
    def __init__(self, model_name="BAAI/bge-base-en-v1.5"):
        self.model = SentenceTransformer(model_name, trust_remote_code=True)
        self.index = {}
        self.texts = []
        self.paths = []

    def embed_chunks(self, chunks_dir: str):
        embeddings = []
        chunk_paths = list(Path(chunks_dir).glob("*.graphql"))

        for path in chunk_paths:
            text = path.read_text()
            emb = self.model.encode(text, batch_size=1)
            embeddings.append(emb)
            self.texts.append(text)
            self.paths.append(str(path))

        embeddings = np.vstack(embeddings)
        self.index = faiss.IndexFlatL2(embeddings.shape[1])
        self.index.add(embeddings) # type: ignore
        print(f"Embedded {len(self.texts)} chunks.")

    def save(self, index_path="embeddings/index.faiss", metadata_path="embeddings/metadata.json"):
        faiss.write_index(self.index, index_path)
        metadata = {"paths": self.paths}
        Path(metadata_path).write_text(json.dumps(metadata, indent=2))
        print(f"💾 Saved index to '{index_path}' and metadata to '{metadata_path}'.")

    def load(self, index_path="embeddings/index.faiss", metadata_path="embeddings/metadata.json"):
        self.index = faiss.read_index(index_path)
        metadata = json.loads(Path(metadata_path).read_text())
        self.paths = metadata["paths"]
        self.texts = [Path(p).read_text() for p in self.paths]

    def search(self, query: str, top_k=5):
        query_emb = self.model.encode([query])
        D, I = self.index.search(query_emb, top_k) # type: ignore
        return [(self.paths[i], self.texts[i]) for i in I[0]]

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Embed SDL chunks for semantic search.")
    parser.add_argument("--chunks", default="chunks", help="Directory containing SDL chunks")
    parser.add_argument("--out_index", default="embeddings/index.faiss", help="Path to FAISS index file")
    parser.add_argument("--out_meta", default="embeddings/metadata.json", help="Path to metadata JSON file")
    parser.add_argument("--query", help="Optional: Ask a question after loading the index")
    parser.add_argument("--force", action="store_true", help="Force rebuild the index even if it exists")

    args = parser.parse_args()

    embedder = Embedder()

    # Create or load index
    if not Path(args.out_index).exists() or not Path(args.out_meta).exists() or args.force:
        embedder.embed_chunks(args.chunks)
        embedder.save(args.out_index, args.out_meta)
    else:
        embedder.load(args.out_index, args.out_meta)
        print(f"Loaded existing index from {args.out_index}")

    # Optional: Run a search
    if args.query:
        results = embedder.search(args.query)
        for path, content in results:
            print(f"\nMatch from: {path}\n")
            print(content)
