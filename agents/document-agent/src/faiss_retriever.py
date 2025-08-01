import os
import json
import faiss
import numpy as np
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional
import logging

from .embedder import DocumentEmbedder

logger = logging.getLogger(__name__)

class FAISSDocumentRetriever:
    """Enhanced FAISS-based document retriever with persistent storage."""
    
    def __init__(self, 
                 model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
                 index_path: str = "data/embeddings",
                 auto_load: bool = True,
                 embedder: Optional[DocumentEmbedder] = None):
        """
        Initialize FAISS retriever.
        
        Args:
            model_name: Sentence transformer model (used if embedder not provided)
            index_path: Directory to store FAISS index and metadata
            auto_load: Automatically load existing index if available
            embedder: Pre-initialized embedder instance (optional)
        """
        self.model_name = model_name
        self.index_path = Path(index_path)
        self.index_path.mkdir(parents=True, exist_ok=True)
        
        # Initialize embedder
        if embedder is not None:
            self.embedder = embedder
            self.model_name = embedder.model_name
        else:
            self.embedder = DocumentEmbedder(model_name=model_name)
        
        # Initialize storage
        self.index = None
        self.chunks = []
        self.metadata = []
        
        # Auto-load existing index
        if auto_load and self._index_exists():
            self.load_index()
    
    def _index_exists(self) -> bool:
        """Check if FAISS index files exist."""
        return (
            (self.index_path / "index.faiss").exists() and
            (self.index_path / "metadata.json").exists()
        )
    
    def build_index_from_directory(self, chunks_dir: str) -> int:
        """
        Build FAISS index from chunks directory.
        
        Args:
            chunks_dir: Directory containing chunk files and metadata
            
        Returns:
            Number of chunks indexed
        """
        logger.info(f"Building FAISS index from {chunks_dir}")
        
        # Use embedder to load chunks and create embeddings
        texts, embeddings, valid_metadata = self.embedder.embed_from_chunks_directory(chunks_dir)
        
        # Build FAISS index
        logger.info("Building FAISS index...")
        dimension = embeddings.shape[1]
        
        # Use IndexFlatIP for cosine similarity (normalized vectors)
        self.index = faiss.IndexFlatIP(dimension)
        
        # Normalize embeddings for cosine similarity
        faiss.normalize_L2(embeddings)
        
        # Add to index
        self.index.add(embeddings.astype(np.float32))
        
        # Store data
        self.chunks = texts
        self.metadata = valid_metadata
        
        # Save to disk
        self.save_index()
        
        logger.info(f"Successfully built FAISS index with {len(texts)} chunks")
        return len(texts)
    
    def save_index(self):
        """Save FAISS index and metadata to disk."""
        if self.index is None:
            raise ValueError("No index to save. Build index first.")
        
        # Save FAISS index
        index_file = self.index_path / "index.faiss"
        faiss.write_index(self.index, str(index_file))
        
        # Save metadata with chunks
        combined_data = {
            'chunks': self.chunks,
            'metadata': self.metadata,
            'model_name': self.embedder.model_name,
            'index_type': 'IndexFlatIP',
            'total_chunks': len(self.chunks)
        }
        
        metadata_file = self.index_path / "metadata.json"
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(combined_data, f, indent=2, ensure_ascii=False)
        
        logger.info(f"Saved FAISS index to {index_file}")
        logger.info(f"Saved metadata to {metadata_file}")
    
    def load_index(self):
        """Load FAISS index and metadata from disk."""
        index_file = self.index_path / "index.faiss"
        metadata_file = self.index_path / "metadata.json"
        
        if not (index_file.exists() and metadata_file.exists()):
            raise FileNotFoundError(f"Index files not found in {self.index_path}")
        
        # Load FAISS index
        self.index = faiss.read_index(str(index_file))
        
        # Load metadata
        with open(metadata_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self.chunks = data['chunks']
        self.metadata = data['metadata']
        
        logger.info(f"Loaded FAISS index with {len(self.chunks)} chunks")
        logger.info(f"Model: {data.get('model_name', 'unknown')}")
    
    def retrieve_chunks(self, query: str, top_k: int = 5) -> List[Tuple[str, float]]:
        """
        Retrieve most similar chunks for a query.
        
        Args:
            query: Search query
            top_k: Number of results to return
            
        Returns:
            List of (chunk_text, similarity_score) tuples
        """
        if self.index is None:
            raise ValueError("No index loaded. Build or load index first.")
        
        # Create query embedding
        query_embedding = self.embedder.embed_single_text(query).reshape(1, -1)
        faiss.normalize_L2(query_embedding)  # Normalize for cosine similarity
        
        # Search
        scores, indices = self.index.search(query_embedding.astype(np.float32), top_k)
        
        # Format results
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < len(self.chunks):
                results.append((self.chunks[idx], float(score)))
        
        return results
    
    def retrieve_chunks_with_metadata(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Retrieve chunks with full metadata.
        
        Returns:
            List of dictionaries with chunk, metadata, and score
        """
        if self.index is None:
            raise ValueError("No index loaded. Build or load index first.")
        
        # Create query embedding
        query_embedding = self.embedder.embed_single_text(query).reshape(1, -1)
        faiss.normalize_L2(query_embedding)
        
        # Search
        scores, indices = self.index.search(query_embedding.astype(np.float32), top_k)
        
        # Format results with metadata
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < len(self.chunks):
                result = {
                    'chunk': self.chunks[idx],
                    'score': float(score),
                    'metadata': self.metadata[idx] if idx < len(self.metadata) else {}
                }
                results.append(result)
        
        return results
    
    def format_context(self, results: List[Tuple[str, float]], include_scores: bool = False) -> str:
        """
        Format retrieval results into context string for LLM.
        
        Args:
            results: List of (chunk_text, score) tuples from retrieve_chunks
            include_scores: Whether to include similarity scores
            
        Returns:
            Formatted context string
        """
        if not results:
            return "No relevant documentation found."
        
        formatted_chunks = []
        for i, (chunk, score) in enumerate(results, 1):
            header = f"# Source {i}"
            if include_scores:
                header += f" (similarity: {score:.3f})"
            
            formatted_chunks.append(f"{header}\n\n{chunk.strip()}")
        
        return "\n\n---\n\n".join(formatted_chunks)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get retriever statistics."""
        if self.index is None:
            return {"status": "no_index_loaded"}
        
        return {
            "status": "ready",
            "total_chunks": len(self.chunks),
            "index_size": self.index.ntotal,
            "model_name": self.embedder.model_name,
            "index_path": str(self.index_path)
        }

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="FAISS Document Retriever")
    parser.add_argument("--build", action="store_true", help="Build index from chunks")
    parser.add_argument("--chunks-dir", default="data/chunks", help="Chunks directory")
    parser.add_argument("--index-path", default="data/embeddings", help="Index storage path")
    parser.add_argument("--query", help="Test query")
    parser.add_argument("--top-k", type=int, default=5, help="Number of results")
    
    args = parser.parse_args()
    
    # Set up logging
    logging.basicConfig(level=logging.INFO)
    
    retriever = FAISSDocumentRetriever(index_path=args.index_path, auto_load=not args.build)
    
    if args.build:
        num_chunks = retriever.build_index_from_directory(args.chunks_dir)
        print(f"Built index with {num_chunks} chunks")
    
    if args.query:
        results = retriever.retrieve_chunks(args.query, args.top_k)
        print(f"\nQuery: {args.query}")
        print(f"Found {len(results)} results:\n")
        for i, (chunk, score) in enumerate(results, 1):
            print(f"{i}. Score: {score:.4f}")
            print(f"   Preview: {chunk[:100]}...")
            print()