import os
import json
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from typing import List, Tuple, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class DocumentRetriever:
    """Retrieves relevant documentation chunks using semantic search."""
    
    def __init__(self, 
                 index_path: str = "embeddings/index.faiss",
                 metadata_path: str = "embeddings/metadata.json",
                 model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.index_path = index_path
        self.metadata_path = metadata_path
        self.model_name = model_name
        
        # Initialize components
        self.index = None
        self.metadata = []
        self.model = None
        
        # Load everything
        self._load_model()
        self._load_index_and_metadata()
    
    def _load_model(self):
        """Load the embedding model."""
        try:
            self.model = SentenceTransformer(self.model_name, trust_remote_code=True)
            logger.info(f"Loaded embedding model: {self.model_name}")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise
    
    def _load_index_and_metadata(self):
        """Load FAISS index and metadata."""
        if not os.path.exists(self.index_path):
            raise FileNotFoundError(f"Index file not found: {self.index_path}")
        
        if not os.path.exists(self.metadata_path):
            raise FileNotFoundError(f"Metadata file not found: {self.metadata_path}")
        
        # Load FAISS index
        self.index = faiss.read_index(self.index_path)
        
        # Load metadata
        with open(self.metadata_path, 'r') as f:
            self.metadata = json.load(f)
        
        logger.info(f"Loaded index with {self.index.ntotal} vectors and {len(self.metadata)} metadata entries")
    
    def enhance_query(self, query: str, context: Optional[Dict] = None) -> str:
        """Enhance query with context for better retrieval."""
        enhanced_parts = [query]
        
        if context:
            if context.get('category'):
                enhanced_parts.append(f"Category: {context['category']}")
            if context.get('section'):
                enhanced_parts.append(f"Section: {context['section']}")
        
        return " | ".join(enhanced_parts)
    
    def retrieve_chunks(self, 
                       query: str, 
                       top_k: int = 5,
                       category_filter: Optional[str] = None,
                       min_score_threshold: float = 0.0) -> List[Tuple[str, str, float]]:
        """
        Retrieve most relevant chunks for a query.
        
        Returns:
            List of tuples: (file_path, content, similarity_score)
        """
        # Enhance query
        enhanced_query = self.enhance_query(query)
        
        # Create query embedding
        query_embedding = self.model.encode([enhanced_query], convert_to_numpy=True)
        
        # Search in FAISS index
        # Note: FAISS returns distances (lower is better), we convert to similarity scores
        distances, indices = self.index.search(query_embedding.astype(np.float32), top_k * 2)  # Get more for filtering
        
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx >= len(self.metadata):
                continue
            
            meta = self.metadata[idx]
            
            # Apply category filter if specified
            if category_filter and meta.get('doc_category') != category_filter:
                continue
            
            # Convert distance to similarity score (higher is better)
            similarity_score = 1.0 / (1.0 + dist)
            
            # Apply minimum score threshold
            if similarity_score < min_score_threshold:
                continue
            
            # Get file path and content
            file_path = meta.get('file_path', f"chunk_{idx}")
            content = meta.get('text', '')
            
            results.append((file_path, content, similarity_score))
            
            # Stop once we have enough results
            if len(results) >= top_k:
                break
        
        return results
    
    def retrieve_by_category(self, 
                           query: str, 
                           category: str, 
                           top_k: int = 5) -> List[Tuple[str, str, float]]:
        """Retrieve chunks filtered by documentation category."""
        return self.retrieve_chunks(
            query=query,
            top_k=top_k,
            category_filter=category
        )
    
    def get_chunk_by_id(self, chunk_id: str) -> Optional[Dict]:
        """Get a specific chunk by its ID."""
        for meta in self.metadata:
            if meta.get('chunk_id') == chunk_id:
                return meta
        return None
    
    def get_categories(self) -> List[str]:
        """Get all available documentation categories."""
        categories = set()
        for meta in self.metadata:
            if meta.get('doc_category'):
                categories.add(meta['doc_category'])
        return sorted(list(categories))
    
    def get_stats(self) -> Dict[str, Any]:
        """Get retriever statistics."""
        categories = {}
        chunk_types = {}
        total_chunks = len(self.metadata)
        
        for meta in self.metadata:
            # Count by category
            cat = meta.get('doc_category', 'unknown')
            categories[cat] = categories.get(cat, 0) + 1
            
            # Count by chunk type
            chunk_type = meta.get('chunk_type', 'unknown')
            chunk_types[chunk_type] = chunk_types.get(chunk_type, 0) + 1
        
        return {
            'total_chunks': total_chunks,
            'categories': categories,
            'chunk_types': chunk_types,
            'index_size': self.index.ntotal if self.index else 0,
            'model': self.model_name
        }
    
    def format_context(self, chunks: List[Tuple[str, str, float]]) -> str:
        """Format retrieved chunks into context string."""
        context_parts = []
        
        for i, (file_path, content, score) in enumerate(chunks, 1):
            # Extract filename for source reference
            filename = os.path.basename(file_path)
            
            context_parts.append(f"# Source {i}: {filename} (relevance: {score:.3f})")
            context_parts.append(content)
            context_parts.append("")  # Empty line for separation
        
        return "\n".join(context_parts)
    
    def search_similar_chunks(self, 
                            reference_chunk_id: str, 
                            top_k: int = 5) -> List[Tuple[str, str, float]]:
        """Find chunks similar to a reference chunk."""
        reference_meta = self.get_chunk_by_id(reference_chunk_id)
        if not reference_meta:
            return []
        
        reference_text = reference_meta.get('text', '')
        if not reference_text:
            return []
        
        return self.retrieve_chunks(reference_text, top_k=top_k)

if __name__ == "__main__":
    # Example usage
    retriever = DocumentRetriever()
    
    # Test query
    query = "How do I create a card product?"
    results = retriever.retrieve_chunks(query, top_k=3)
    
    print(f"Query: {query}")
    print(f"Found {len(results)} results:")
    
    for i, (path, content, score) in enumerate(results, 1):
        print(f"\n{i}. {os.path.basename(path)} (score: {score:.3f})")
        print(f"Content: {content[:200]}...")
    
    # Show stats
    stats = retriever.get_stats()
    print(f"\nRetriever stats: {stats}")