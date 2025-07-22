import os
import json
import faiss
import numpy as np
from pathlib import Path
from sentence_transformers import SentenceTransformer
from tqdm import tqdm
import re

class Embedder:
    def __init__(self, model_name="BAAI/bge-base-en-v1.5", batch_size=16, index_type="flat", nlist=100, docstring_weight=0.7, num_workers=1):
        try:
            self.model = SentenceTransformer(model_name, trust_remote_code=True)
        except Exception as e:
            print(f"[ERROR] Failed to load embedding model '{model_name}': {e}")
            print("[ERROR] Please check your internet connection or ensure the model is available locally.")
            raise SystemExit(1)
        self.index = None
        self.texts = []
        self.paths = []
        self.batch_size = batch_size
        self.index_type = index_type
        self.nlist = nlist
        self.docstring_weight = docstring_weight
        self.num_workers = num_workers

    def extract_docstring(self, text):
        # Match triple-quoted docstring at the top or after type/field
        match = re.match(r'\s*"""([\s\S]*?)"""', text)
        if match:
            return match.group(1).strip()
        return None

    def embed_chunks(self, chunks_dir: str):
        chunk_paths = list(Path(chunks_dir).glob("*.graphql"))
        valid_paths = []
        valid_texts = []
        docstrings = []
        sdl_bodies = []

        for path in tqdm(chunk_paths, desc="Reading chunks"):
            try:
                text = path.read_text().strip()
                if not text:
                    continue
                valid_paths.append(str(path))
                valid_texts.append(text)
                doc = self.extract_docstring(text)
                docstrings.append(doc)
                if doc:
                    # Remove the docstring from the SDL body
                    sdl_body = re.sub(r'^\s*"""[\s\S]*?"""', '', text, count=1).strip()
                else:
                    sdl_body = text
                sdl_bodies.append(sdl_body)
            except Exception as e:
                print(f"[WARN] Failed to read {path}: {e}")

        self.texts = valid_texts
        self.paths = valid_paths

        # Prepare batches for docstrings and SDLs
        all_embeddings = []
        for i in tqdm(range(0, len(valid_texts), self.batch_size), desc="Embedding chunks"):
            batch_docs = docstrings[i:i+self.batch_size]
            batch_sdl = sdl_bodies[i:i+self.batch_size]
            batch_texts = valid_texts[i:i+self.batch_size]
            emb_doc = None
            emb_sdl = None
            try:
                # Embed docstrings (replace None with empty string for embedding)
                emb_doc = self.model.encode([(d if d else "") for d in batch_docs], batch_size=self.batch_size, show_progress_bar=False, num_workers=self.num_workers)
                emb_sdl = self.model.encode(batch_sdl, batch_size=self.batch_size, show_progress_bar=False, num_workers=self.num_workers)
            except Exception as e:
                print(f"[WARN] Failed to embed batch {i//self.batch_size}: {e}")
                continue
            # Combine embeddings
            for j in range(len(batch_texts)):
                if batch_docs[j]:
                    emb = self.docstring_weight * emb_doc[j] + (1 - self.docstring_weight) * emb_sdl[j]
                else:
                    emb = emb_sdl[j]
                all_embeddings.append(emb)
        if all_embeddings:
            embeddings = np.vstack(all_embeddings)
        else:
            embeddings = np.zeros((0, self.model.get_sentence_embedding_dimension()))

        # Configurable FAISS index type
        try:
            if embeddings.shape[0] == 0:
                self.index = None
            elif self.index_type == "flat":
                self.index = faiss.IndexFlatL2(embeddings.shape[1])
                self.index.add(embeddings) # type: ignore
            elif self.index_type == "ivfflat":
                quantizer = faiss.IndexFlatL2(embeddings.shape[1])
                self.index = faiss.IndexIVFFlat(quantizer, embeddings.shape[1], self.nlist)
                # Training required for IVFFlat
                try:
                    self.index.train(embeddings)
                except Exception as e:
                    print(f"[ERROR] Failed to train IVFFlat index: {e}")
                    raise SystemExit(1)
                self.index.add(embeddings)
            else:
                raise ValueError(f"Unknown index_type: {self.index_type}")
            print(f"Embedded {len(self.texts)} chunks.")
        except Exception as e:
            raise RuntimeError(f"Failed to build FAISS index: {e}")

    def save(self, index_path="embeddings/index.faiss", metadata_path="embeddings/metadata.json"):
        if self.index is None:
            raise RuntimeError("No FAISS index to save.")
        try:
            faiss.write_index(self.index, index_path)
            metadata = {"paths": self.paths}
            Path(metadata_path).write_text(json.dumps(metadata, indent=2))
            print(f"Saved index to '{index_path}' and metadata to '{metadata_path}'.")
        except Exception as e:
            raise RuntimeError(f"Failed to save index or metadata: {e}")

    def load(self, index_path="embeddings/index.faiss", metadata_path="embeddings/metadata.json"):
        try:
            self.index = faiss.read_index(index_path)
            metadata = json.loads(Path(metadata_path).read_text())
            self.paths = metadata["paths"]
            self.texts = [Path(p).read_text() for p in self.paths]
        except Exception as e:
            raise RuntimeError(f"Failed to load index or metadata: {e}")

    def search(self, query: str, top_k=5):
        if self.index is None:
            raise RuntimeError("FAISS index not loaded.")
        try:
            query_emb = self.model.encode([query])
            D, I = self.index.search(query_emb, top_k) # type: ignore
            return [(self.paths[i], self.texts[i]) for i in I[0]]
        except Exception as e:
            print(f"[WARN] Search failed: {e}")
            return []

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Embed SDL chunks for semantic search.")
    parser.add_argument("--chunks", default="chunks", help="Directory containing SDL chunks")
    parser.add_argument("--out_index", default="embeddings/index.faiss", help="Path to FAISS index file")
    parser.add_argument("--out_meta", default="embeddings/metadata.json", help="Path to metadata JSON file")
    parser.add_argument("--query", help="Optional: Ask a question after loading the index")
    parser.add_argument("--force", action="store_true", help="Force rebuild the index even if it exists")
    parser.add_argument("--batch_size", type=int, default=16, help="Batch size for embedding")
    parser.add_argument("--index_type", choices=["flat", "ivfflat"], default="flat", help="FAISS index type: flat or ivfflat")
    parser.add_argument("--nlist", type=int, default=100, help="Number of clusters for IVFFlat index")
    parser.add_argument("--docstring_weight", type=float, default=0.7, help="Weight for docstring in embedding (0-1)")
    parser.add_argument("--num_workers", type=int, default=1, help="Number of parallel workers for embedding")

    args = parser.parse_args()

    embedder = Embedder(batch_size=args.batch_size, index_type=args.index_type, nlist=args.nlist, docstring_weight=args.docstring_weight, num_workers=args.num_workers)

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
