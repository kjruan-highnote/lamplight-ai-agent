import os
import json
from pathlib import Path
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from typing import List, Tuple, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class SimpleDocumentRetriever:
    """Simple document retriever using in-memory embeddings."""
    
    def __init__(self, 
                 chunks_dir: str = "data/chunks",
                 model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.chunks_dir = chunks_dir
        self.model_name = model_name
        
        # Load model
        self.model = SentenceTransformer(model_name, trust_remote_code=True)
        
        # Load chunks and create embeddings
        self.chunks = []
        self.embeddings = None
        self._load_chunks_and_embeddings()
    
    def _load_chunks_and_embeddings(self):
        """Load chunks and create embeddings."""
        metadata_file = Path(self.chunks_dir) / "chunks_metadata.json"
        
        if not metadata_file.exists():
            raise FileNotFoundError(f"Metadata file not found: {metadata_file}")
        
        with open(metadata_file, 'r') as f:
            metadata_list = json.load(f)
        
        texts = []
        
        for meta in metadata_list:
            file_path = meta['file_path']
            if not os.path.exists(file_path):
                continue
            
            try:
                with open(file_path, 'r') as f:
                    content = f.read()
                
                # Extract content after header
                if "=" * 50 in content:
                    content = content.split("=" * 50, 1)[1].strip()
                
                if content:
                    enhanced_text = self._enhance_text_for_embedding(content, meta)
                    texts.append(enhanced_text)
                    self.chunks.append({
                        'content': content,
                        'metadata': meta
                    })
            except Exception as e:
                logger.error(f"Error reading chunk {file_path}: {e}")
        
        # Create embeddings
        if texts:
            logger.info(f"Creating embeddings for {len(texts)} chunks...")
            self.embeddings = self.model.encode(texts, convert_to_numpy=True)
            logger.info("Embeddings created successfully")
    
    def _enhance_text_for_embedding(self, text: str, metadata: dict) -> str:
        """Enhance text with metadata for better embeddings."""
        enhanced_parts = []
        
        if metadata.get('doc_category'):
            enhanced_parts.append(f"Category: {metadata['doc_category']}")
        
        if metadata.get('doc_title'):
            enhanced_parts.append(f"Page: {metadata['doc_title']}")
        
        if metadata.get('heading'):
            enhanced_parts.append(f"Section: {metadata['heading']}")
        
        enhanced_parts.append(text)
        return " | ".join(enhanced_parts)
    
    def retrieve_chunks(self, 
                       query: str, 
                       top_k: int = 5,
                       category_filter: Optional[str] = None) -> List[Tuple[str, str, float]]:
        """Retrieve most relevant chunks for a query."""
        if self.embeddings is None or len(self.chunks) == 0:
            return []
        
        # Create query embedding
        query_embedding = self.model.encode([query], convert_to_numpy=True)
        
        # Calculate similarities
        similarities = cosine_similarity(query_embedding, self.embeddings)[0]
        
        # Get top results
        top_indices = np.argsort(similarities)[::-1][:top_k * 2]  # Get more for filtering
        
        results = []
        for idx in top_indices:
            chunk = self.chunks[idx]
            meta = chunk['metadata']
            
            # Apply category filter
            if category_filter and meta.get('doc_category') != category_filter:
                continue
            
            similarity_score = float(similarities[idx])
            chunk_id = meta.get('chunk_id', f'chunk_{idx}')
            content = chunk['content']
            
            results.append((chunk_id, content, similarity_score))
            
            if len(results) >= top_k:
                break
        
        return results
    
    def get_stats(self) -> Dict[str, Any]:
        """Get retriever statistics."""
        categories = {}
        chunk_types = {}
        
        for chunk in self.chunks:
            meta = chunk['metadata']
            
            # Count by category
            cat = meta.get('doc_category', 'unknown')
            categories[cat] = categories.get(cat, 0) + 1
            
            # Count by chunk type
            chunk_type = meta.get('chunk_type', 'unknown')
            chunk_types[chunk_type] = chunk_types.get(chunk_type, 0) + 1
        
        return {
            'total_chunks': len(self.chunks),
            'categories': categories,
            'chunk_types': chunk_types,
            'model': self.model_name
        }
    
    def format_context(self, chunks: List[Tuple[str, str, float]]) -> str:
        """Format retrieved chunks into context string."""
        context_parts = []
        
        for i, (chunk_id, content, score) in enumerate(chunks, 1):
            context_parts.append(f"# Source {i}: {chunk_id} (relevance: {score:.3f})")
            context_parts.append(content)
            context_parts.append("")
        
        return "\n".join(context_parts)

if __name__ == "__main__":
    # Test the retriever
    retriever = SimpleDocumentRetriever()
    
    query = "How do I create a card product?"
    results = retriever.retrieve_chunks(query, top_k=3)
    
    print(f"Query: {query}")
    print(f"Found {len(results)} results:")
    
    for i, (chunk_id, content, score) in enumerate(results, 1):
        print(f"\n{i}. {chunk_id} (score: {score:.3f})")
        print(f"Content: {content[:200]}...")
    
    stats = retriever.get_stats()
    print(f"\nStats: {stats}")