import json
import logging
import re
from pathlib import Path
from typing import List, Tuple, Optional, Set
from functools import lru_cache
from agent.embedder import Embedder

class Retriever:
    def __init__(self, index_path="embeddings/index.faiss", metadata_path="embeddings/metadata.json", 
                 model_name="BAAI/bge-base-en-v1.5", min_similarity_score=-2.0):
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

    def retrieve_chunks(self, question: str, top_k: int = 12) -> List[Tuple[str, str, float]]:
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
            
            # Try to get results with similarity scores, fallback to regular search
            try:
                primary_results = self.embedder.search_with_scores(processed_question, top_k=top_k)
                
                # Filter by minimum similarity score
                filtered_primary = [
                    (path, content, score) for path, content, score in primary_results 
                    if score >= self.min_similarity_score
                ]
                
                # Fetch related chunks based on type references
                related_chunks = self._fetch_related_chunks(filtered_primary, max_related=5)
                
                # Combine primary and related results, sort by score
                all_results = filtered_primary + related_chunks
                all_results.sort(key=lambda x: x[2], reverse=True)  # Sort by score descending
                
                # Limit total results to top_k + some related chunks
                final_results = all_results[:top_k + 3]
                
                self.logger.info(f"Retrieved {len(filtered_primary)} primary + {len(related_chunks)} related chunks for query: {question[:50]}...")
                return final_results
                
            except (AttributeError, TypeError) as e:
                # Fallback to regular search without scores
                self.logger.warning(f"search_with_scores failed, using fallback: {e}")
                regular_results = self.embedder.search(processed_question, top_k=top_k)
                
                # Convert to expected format with dummy scores
                fallback_results = [
                    (path, content, 1.0) for path, content in regular_results
                ]
                
                self.logger.info(f"Retrieved {len(fallback_results)} chunks (fallback) for query: {question[:50]}...")
                return fallback_results
            
        except Exception as e:
            self.logger.error(f"Error retrieving chunks: {e}")
            return []

    def _preprocess_query(self, query: str) -> str:
        """Preprocess the query for better retrieval with GraphQL-specific enhancements."""
        query = query.strip().lower()
        
        # GraphQL keyword mappings and expansions
        expansions = {
            'create': ['create', 'mutation', 'input'],
            'update': ['update', 'mutation', 'input'], 
            'delete': ['delete', 'mutation'],
            'get': ['query', 'type'],
            'list': ['query', 'type', 'connection'],
            'user': ['user', 'createuser', 'updateuser', 'userinput'],
            'field': ['field', 'type', 'property'],
            'mutation': ['mutation', 'input', 'create', 'update', 'delete'],
            'query': ['query', 'type', 'get', 'list'],
            'input': ['input', 'mutation', 'create', 'update'],
            'type': ['type', 'field', 'interface', 'enum']
        }
        
        # Expand query with related terms
        expanded_terms = set(query.split())
        for word in query.split():
            if word in expansions:
                expanded_terms.update(expansions[word])
        
        # Question type detection and enhancement  
        question_patterns = {
            'what': ['type', 'field', 'definition'],
            'how': ['mutation', 'query', 'example'],
            'create': ['mutation', 'input', 'create'],
            'fields': ['type', 'field', 'property'],
            'available': ['query', 'mutation', 'type'],
            'input': ['input', 'mutation', 'create', 'update']
        }
        
        for pattern, enhancements in question_patterns.items():
            if pattern in query:
                expanded_terms.update(enhancements)
        
        # Convert back to string and ensure GraphQL context
        expanded_query = ' '.join(expanded_terms)
        if 'graphql' not in expanded_query:
            expanded_query = f"GraphQL {expanded_query}"
            
        return expanded_query
    
    def _extract_type_references(self, content: str) -> Set[str]:
        """Extract GraphQL type references from schema content."""
        type_refs = set()
        
        # Match type references in various contexts
        patterns = [
            r'\b([A-Z]\w+)!?\s*(?:\(|\{|:)',  # Type names followed by operators
            r':\s*([A-Z]\w+)!?',              # Field types  
            r'\[([A-Z]\w+)!?\]!?',            # Array types
            r'input\s+([A-Z]\w+)',            # Input type definitions
            r'type\s+([A-Z]\w+)',             # Type definitions
            r'interface\s+([A-Z]\w+)',        # Interface definitions
            r'enum\s+([A-Z]\w+)',             # Enum definitions
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches:
                if match and not match.lower() in ['string', 'int', 'float', 'boolean', 'id']:
                    type_refs.add(match)
        
        return type_refs
    
    def _fetch_related_chunks(self, primary_results: List[Tuple[str, str, float]], max_related: int = 5) -> List[Tuple[str, str, float]]:
        """Fetch chunks related to the primary results by type references."""
        if not primary_results:
            return []
            
        # Extract all type references from primary results
        all_type_refs = set()
        primary_paths = set()
        
        for path, content, score in primary_results:
            primary_paths.add(path)
            type_refs = self._extract_type_references(content)
            all_type_refs.update(type_refs)
        
        # Search for chunks containing these type references
        related_chunks = []
        seen_paths = primary_paths.copy()
        
        for type_ref in all_type_refs:
            if len(related_chunks) >= max_related:
                break
                
            try:
                # Search for this specific type
                type_results = self.embedder.search_with_scores(f"type {type_ref}", top_k=3)
                
                for path, content, score in type_results:
                    if path not in seen_paths and len(related_chunks) < max_related:
                        # Boost score slightly to indicate it's a related type
                        related_chunks.append((path, content, score * 0.8))
                        seen_paths.add(path)
                        
            except Exception as e:
                self.logger.debug(f"Failed to fetch related chunks for {type_ref}: {e}")
                continue
        
        return related_chunks
    
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
