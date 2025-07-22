import json
import logging
from pathlib import Path
from typing import List, Tuple, Optional
from functools import lru_cache
from agent.embedder import Embedder

class Retriever:
    def __init__(self, index_path="embeddings/index.faiss", metadata_path="embeddings/metadata.json", 
                 model_name="BAAI/bge-base-en-v1.5", min_similarity_score=0.0):
        """
        Initialize the retriever.
        
        Args:
            index_path: Path to the FAISS index file
            metadata_path: Path to the metadata JSON file
            model_name: Name of the embedding model to use
            min_similarity_score: Minimum similarity score for filtering results
        """
        self.index_path = Path(index_path)
        self.metadata_path = Path(metadata_path)
        self.model_name = model_name
        self.min_similarity_score = min_similarity_score
        self.embedder = None
        
        # Set up logging
        self.logger = logging.getLogger(__name__)
        
        self._initialize_embedder()
    
    def _initialize_embedder(self):
        """Initialize the embedder with error handling."""
        try:
            if not self.index_path.exists():
                raise FileNotFoundError(f"Index file not found: {self.index_path}")
            if not self.metadata_path.exists():
                raise FileNotFoundError(f"Metadata file not found: {self.metadata_path}")
            
            self.embedder = Embedder(model_name=self.model_name)
            self.embedder.load(str(self.index_path), str(self.metadata_path))
            self.logger.info(f"Successfully loaded embedder with {len(self.embedder.texts)} chunks")
            
        except Exception as e:
            self.logger.error(f"Failed to initialize embedder: {e}")
            raise RuntimeError(f"Failed to initialize retriever: {e}")

    @lru_cache(maxsize=128)
    def retrieve_chunks(self, question: str, top_k: int = 5) -> List[Tuple[str, str, float]]:
        """
        Retrieve top-k most relevant SDL chunks for the user's question.
        
        Args:
            question: The user's question
            top_k: Number of top chunks to retrieve
            
        Returns:
            List of tuples (path, content, similarity_score)
        """
        if not question or not question.strip():
            self.logger.warning("Empty question provided")
            return []
            
        if self.embedder is None:
            self.logger.error("Embedder not initialized")
            return []
            
        try:
            # Preprocess the question
            processed_question = self._preprocess_query(question)
            
            # Get results with similarity scores
            results_with_scores = self.embedder.search_with_scores(processed_question, top_k=top_k)
            
            # Filter by minimum similarity score
            filtered_results = [
                (path, content, score) for path, content, score in results_with_scores 
                if score >= self.min_similarity_score
            ]
            
            self.logger.info(f"Retrieved {len(filtered_results)} chunks for query: {question[:50]}...")
            return filtered_results
            
        except Exception as e:
            self.logger.error(f"Error retrieving chunks: {e}")
            return []

    def _preprocess_query(self, query: str) -> str:
        """Preprocess the query for better retrieval."""
        # Remove extra whitespace and normalize
        query = query.strip()
        
        # Add GraphQL-specific context hints if not present
        graphql_keywords = ['mutation', 'query', 'type', 'field', 'schema']
        if not any(keyword in query.lower() for keyword in graphql_keywords):
            query = f"GraphQL {query}"
            
        return query
    
    def format_context(self, results: List[Tuple[str, str, float]], include_scores: bool = False) -> str:
        """
        Format the retrieved chunks into a single prompt-ready context string.
        
        Args:
            results: List of (path, content, score) tuples
            include_scores: Whether to include similarity scores in output
            
        Returns:
            Formatted context string
        """
        if not results:
            return "No relevant schema context found."
            
        formatted_chunks = []
        for i, (path, content, score) in enumerate(results, 1):
            filename = Path(path).name
            header = f"# Source {i}: {filename}"
            if include_scores:
                header += f" (similarity: {score:.3f})"
            
            formatted_chunks.append(f"{header}\n\n{content.strip()}")
            
        return "\n\n---\n\n".join(formatted_chunks)
    
    def get_stats(self) -> dict:
        """Get retriever statistics."""
        if self.embedder is None:
            return {"status": "not_initialized"}
            
        return {
            "status": "ready",
            "total_chunks": len(self.embedder.texts),
            "model_name": self.model_name,
            "index_path": str(self.index_path),
            "min_similarity_score": self.min_similarity_score
        }

if __name__ == "__main__":
    import argparse
    
    # Set up basic logging
    logging.basicConfig(level=logging.INFO)

    parser = argparse.ArgumentParser(description="Retrieve relevant schema chunks for a given question.")
    parser.add_argument("--query", required=True, help="Question about the GraphQL schema")
    parser.add_argument("--top_k", type=int, default=5, help="Number of top chunks to retrieve")
    parser.add_argument("--min_score", type=float, default=0.0, help="Minimum similarity score")
    parser.add_argument("--show_scores", action="store_true", help="Show similarity scores")
    parser.add_argument("--stats", action="store_true", help="Show retriever statistics")
    args = parser.parse_args()

    try:
        retriever = Retriever(min_similarity_score=args.min_score)
        
        if args.stats:
            stats = retriever.get_stats()
            print(f"\nRetriever Stats: {json.dumps(stats, indent=2)}")
        
        chunks = retriever.retrieve_chunks(args.query, top_k=args.top_k)
        context = retriever.format_context(chunks, include_scores=args.show_scores)

        print(f"\nRetrieved {len(chunks)} chunks for query: {args.query}\n")
        print("Retrieved Context:\n")
        print(context)
        
    except Exception as e:
        print(f"Error: {e}")
