import os
import chromadb
from sentence_transformers import SentenceTransformer
from typing import List, Tuple, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

class DocumentRetriever:
    """Retrieves relevant documentation chunks using ChromaDB semantic search."""
    
    def __init__(self, 
                 persist_directory: str = "embeddings",
                 collection_name: str = "highnote_docs",
                 model_name: str = "sentence-transformers/all-MiniLM-L6-v2"):
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        self.model_name = model_name
        
        # Initialize components
        self.client = None
        self.collection = None
        self.model = None
        
        # Load everything
        self._load_model()
        self._load_collection()
    
    def _load_model(self):
        """Load the embedding model."""
        try:
            self.model = SentenceTransformer(self.model_name, trust_remote_code=True)
            logger.info(f"Loaded embedding model: {self.model_name}")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise
    
    def _load_collection(self):
        """Load ChromaDB collection."""
        if not os.path.exists(self.persist_directory):
            raise FileNotFoundError(f"Embeddings directory not found: {self.persist_directory}")
        
        self.client = chromadb.PersistentClient(path=self.persist_directory)
        
        try:
            self.collection = self.client.get_collection(self.collection_name)
            count = self.collection.count()
            logger.info(f"Loaded collection '{self.collection_name}' with {count} documents")
        except Exception as e:
            logger.error(f"Failed to load collection '{self.collection_name}': {e}")
            raise
    
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
        
        # Prepare where clause for filtering
        where_clause = None
        if category_filter:
            where_clause = {"doc_category": category_filter}
        
        # Query ChromaDB
        try:
            results = self.collection.query(
                query_embeddings=query_embedding.tolist(),
                n_results=top_k,
                where=where_clause,
                include=['documents', 'metadatas', 'distances']
            )
        except Exception as e:
            logger.error(f"Error querying ChromaDB: {e}")
            return []
        
        # Process results
        formatted_results = []
        
        if results['documents'] and len(results['documents']) > 0:
            documents = results['documents'][0]  # First query result
            metadatas = results['metadatas'][0] if results['metadatas'] else []
            distances = results['distances'][0] if results['distances'] else []
            
            for i, (doc, meta, dist) in enumerate(zip(documents, metadatas, distances)):
                # Convert distance to similarity score (higher is better)
                similarity_score = 1.0 / (1.0 + dist)
                
                # Apply minimum score threshold
                if similarity_score < min_score_threshold:
                    continue
                
                # Get file path from metadata
                file_path = meta.get('chunk_id', f'chunk_{i}')
                
                formatted_results.append((file_path, doc, similarity_score))
        
        return formatted_results
    
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
        try:
            results = self.collection.get(
                where={"chunk_id": chunk_id},
                include=['documents', 'metadatas']
            )
            
            if results['documents'] and len(results['documents']) > 0:
                return {
                    'text': results['documents'][0],
                    'metadata': results['metadatas'][0] if results['metadatas'] else {}
                }
        except Exception as e:
            logger.error(f"Error getting chunk by ID {chunk_id}: {e}")
        
        return None
    
    def get_categories(self) -> List[str]:
        """Get all available documentation categories."""
        try:
            # Get all unique categories
            results = self.collection.get(include=['metadatas'])
            categories = set()
            
            if results['metadatas']:
                for meta in results['metadatas']:
                    if meta.get('doc_category'):
                        categories.add(meta['doc_category'])
            
            return sorted(list(categories))
        except Exception as e:
            logger.error(f"Error getting categories: {e}")
            return []
    
    def get_stats(self) -> Dict[str, Any]:
        """Get retriever statistics."""
        try:
            total_count = self.collection.count()
            
            # Get all metadata to analyze
            results = self.collection.get(include=['metadatas'])
            
            categories = {}
            chunk_types = {}
            
            if results['metadatas']:
                for meta in results['metadatas']:
                    # Count by category
                    cat = meta.get('doc_category', 'unknown')
                    categories[cat] = categories.get(cat, 0) + 1
                    
                    # Count by chunk type
                    chunk_type = meta.get('chunk_type', 'unknown')
                    chunk_types[chunk_type] = chunk_types.get(chunk_type, 0) + 1
            
            return {
                'total_chunks': total_count,
                'categories': categories,
                'chunk_types': chunk_types,
                'collection_name': self.collection_name,
                'model': self.model_name
            }
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {
                'total_chunks': 0,
                'categories': {},
                'chunk_types': {},
                'collection_name': self.collection_name,
                'model': self.model_name,
                'error': str(e)
            }
    
    def format_context(self, chunks: List[Tuple[str, str, float]]) -> str:
        """Format retrieved chunks into context string."""
        context_parts = []
        
        for i, (chunk_id, content, score) in enumerate(chunks, 1):
            context_parts.append(f"# Source {i}: {chunk_id} (relevance: {score:.3f})")
            context_parts.append(content)
            context_parts.append("")  # Empty line for separation
        
        return "\n".join(context_parts)
    
    def search_similar_chunks(self, 
                            reference_chunk_id: str, 
                            top_k: int = 5) -> List[Tuple[str, str, float]]:
        """Find chunks similar to a reference chunk."""
        reference_chunk = self.get_chunk_by_id(reference_chunk_id)
        if not reference_chunk:
            return []
        
        reference_text = reference_chunk.get('text', '')
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
    
    for i, (chunk_id, content, score) in enumerate(results, 1):
        print(f"\n{i}. {chunk_id} (score: {score:.3f})")
        print(f"Content: {content[:200]}...")
    
    # Show stats
    stats = retriever.get_stats()
    print(f"\nRetriever stats: {stats}")