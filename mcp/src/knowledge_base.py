"""
Unified Knowledge Base for MCP Server

This module manages all data sources (schema, docs, solutions) in a unified way.
It uses FAISS for vector search and maintains separate namespaces for different data types.
"""

import os
import json
import pickle
import logging
from typing import List, Dict, Any, Optional, Tuple, Callable
from pathlib import Path
from dataclasses import dataclass
from enum import Enum

import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

class DataNamespace(Enum):
    """Namespaces for different data types in the unified index"""
    SCHEMA = "schema"
    DOCUMENTATION = "docs"
    SOLUTIONS = "solutions"
    IMPLEMENTATIONS = "implementations"

@dataclass
class SearchResult:
    """Represents a search result from the knowledge base"""
    content: str
    score: float
    metadata: Dict[str, Any]
    namespace: DataNamespace
    chunk_id: int

class UnifiedKnowledgeBase:
    """
    Manages all knowledge sources with unified vector search.
    
    Key features:
    - Namespaced FAISS index for different data types
    - Hybrid search combining semantic and keyword matching
    - Caching for frequently accessed data
    - Dynamic relevance scoring based on query type
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.base_path = Path(__file__).parent.parent.parent  # Points to repo root
        
        # Initialize embedder
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Namespace configuration - maps data types to index ranges
        self.namespaces = {
            DataNamespace.SCHEMA: (0, 10000),
            DataNamespace.DOCUMENTATION: (10001, 50000),
            DataNamespace.SOLUTIONS: (50001, 70000),
            DataNamespace.IMPLEMENTATIONS: (70001, 90000)
        }
        
        # Initialize or load FAISS index
        self.index = self._initialize_index()
        
        # Load metadata for all chunks
        self.metadata = self._load_metadata()
        
        # Cache for frequently accessed data
        self.cache = {}
        
        # Schema-specific data structures
        self.schema_vocabulary = self._build_schema_vocabulary()
        self.type_relationships = self._analyze_type_relationships()
    
    def _initialize_index(self) -> faiss.Index:
        """Initialize or load existing FAISS index"""
        index_path = self.base_path / "mcp" / "embeddings" / "unified.index"
        
        if index_path.exists():
            logger.info(f"Loading existing FAISS index from {index_path}")
            return faiss.read_index(str(index_path))
        else:
            logger.info("Creating new FAISS index")
            # Create directory if it doesn't exist
            index_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Initialize index with appropriate dimension
            dimension = 384  # all-MiniLM-L6-v2 dimension
            index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
            
            # Build index from existing agent data
            self._build_initial_index(index)
            
            # Save index
            faiss.write_index(index, str(index_path))
            return index
    
    def _build_initial_index(self, index: faiss.Index):
        """Build initial index from existing agent data"""
        # Load and index schema chunks
        schema_chunks = self._load_schema_chunks()
        self._add_to_index(index, schema_chunks, DataNamespace.SCHEMA)
        
        # Load and index documentation chunks
        doc_chunks = self._load_doc_chunks()
        self._add_to_index(index, doc_chunks, DataNamespace.DOCUMENTATION)
        
        # Load and index solution patterns
        solution_patterns = self._load_solution_patterns()
        self._add_to_index(index, solution_patterns, DataNamespace.SOLUTIONS)
    
    def _load_schema_chunks(self) -> List[Dict[str, Any]]:
        """Load schema chunks from schema-agent data"""
        chunks = []
        schema_path = self.base_path / "agents" / "schema-agent" / "schema" / "highnote.graphql"
        
        if schema_path.exists():
            with open(schema_path) as f:
                schema_content = f.read()
            
            # Parse and chunk the schema
            chunks = self._chunk_graphql_schema(schema_content)
        
        return chunks
    
    def _load_doc_chunks(self) -> List[Dict[str, Any]]:
        """Load documentation chunks from document-agent data"""
        chunks = []
        chunks_dir = self.base_path / "agents" / "document-agent" / "data" / "chunks"
        
        if chunks_dir.exists():
            for chunk_file in sorted(chunks_dir.glob("chunk_*.txt")):
                with open(chunk_file) as f:
                    content = f.read()
                    chunks.append({
                        "content": content,
                        "metadata": {
                            "source": chunk_file.name,
                            "type": "documentation"
                        }
                    })
        
        return chunks
    
    def _load_solution_patterns(self) -> List[Dict[str, Any]]:
        """Load solution patterns from ship-agent configurations"""
        patterns = []
        config_dir = self.base_path / "agents" / "ship-agent" / "config"
        
        if config_dir.exists():
            for config_file in config_dir.glob("*.yaml"):
                # Parse YAML configs and extract patterns
                try:
                    import yaml
                    with open(config_file) as f:
                        config = yaml.safe_load(f)
                        if config:
                            patterns.append({
                                "content": json.dumps(config),
                                "metadata": {
                                    "source": config_file.name,
                                    "type": "solution_pattern",
                                    "program": config_file.stem
                                }
                            })
                except Exception as e:
                    logger.warning(f"Failed to load {config_file}: {e}")
        
        return patterns
    
    def _add_to_index(self, index: faiss.Index, chunks: List[Dict[str, Any]], namespace: DataNamespace):
        """Add chunks to FAISS index with proper namespace allocation"""
        if not chunks:
            return
        
        start_idx, end_idx = self.namespaces[namespace]
        
        # Generate embeddings
        texts = [chunk["content"] for chunk in chunks]
        embeddings = self.embedder.encode(texts, show_progress_bar=True)
        
        # Normalize for cosine similarity
        faiss.normalize_L2(embeddings)
        
        # Add to index
        index.add(embeddings)
        
        # Store metadata
        for i, chunk in enumerate(chunks):
            chunk_id = start_idx + i
            self.metadata[chunk_id] = {
                **chunk["metadata"],
                "namespace": namespace.value,
                "content": chunk["content"]
            }
    
    def _load_metadata(self) -> Dict[int, Dict[str, Any]]:
        """Load or initialize metadata storage"""
        metadata_path = self.base_path / "mcp" / "embeddings" / "metadata.json"
        
        if metadata_path.exists():
            with open(metadata_path) as f:
                raw_metadata = json.load(f)
                # Convert string keys back to integers
                return {int(k): v for k, v in raw_metadata.items()}
        
        return {}
    
    def _save_metadata(self):
        """Save metadata to disk"""
        metadata_path = self.base_path / "mcp" / "embeddings" / "metadata.json"
        metadata_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(metadata_path, 'w') as f:
            # Convert integer keys to strings for JSON serialization
            json.dump({str(k): v for k, v in self.metadata.items()}, f, indent=2)
    
    def _chunk_graphql_schema(self, schema_content: str) -> List[Dict[str, Any]]:
        """Intelligently chunk GraphQL schema"""
        chunks = []
        
        # Split by major sections (type, interface, enum, etc.)
        import re
        
        # Pattern to match GraphQL definitions
        pattern = r'(type|interface|enum|input|scalar|union)\s+(\w+)[^{]*\{[^}]*\}'
        matches = re.finditer(pattern, schema_content, re.MULTILINE | re.DOTALL)
        
        for match in matches:
            definition = match.group(0)
            def_type = match.group(1)
            def_name = match.group(2)
            
            chunks.append({
                "content": definition,
                "metadata": {
                    "type": "schema",
                    "definition_type": def_type,
                    "definition_name": def_name
                }
            })
        
        # Also chunk queries and mutations
        query_pattern = r'(query|mutation)\s+(\w+)[^{]*\{[^}]*\}'
        query_matches = re.finditer(query_pattern, schema_content, re.MULTILINE | re.DOTALL)
        
        for match in query_matches:
            chunks.append({
                "content": match.group(0),
                "metadata": {
                    "type": "schema",
                    "operation_type": match.group(1),
                    "operation_name": match.group(2)
                }
            })
        
        return chunks
    
    def _build_schema_vocabulary(self) -> Dict[str, List[str]]:
        """Build vocabulary of schema-specific terms"""
        vocab = {
            "types": [],
            "fields": [],
            "operations": [],
            "enums": []
        }
        
        for chunk_id, metadata in self.metadata.items():
            if metadata.get("namespace") == DataNamespace.SCHEMA.value:
                if "definition_name" in metadata:
                    vocab["types"].append(metadata["definition_name"])
                if "operation_name" in metadata:
                    vocab["operations"].append(metadata["operation_name"])
        
        return vocab
    
    def _analyze_type_relationships(self) -> Dict[str, List[str]]:
        """Analyze relationships between GraphQL types"""
        relationships = {}
        
        # This would parse the schema to find type references
        # For now, return empty dict
        return relationships
    
    async def search(
        self, 
        query: str, 
        namespace: Optional[DataNamespace] = None,
        k: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[SearchResult]:
        """
        Perform semantic search across the knowledge base.
        
        Args:
            query: Search query
            namespace: Limit search to specific namespace
            k: Number of results to return
            filters: Additional filters to apply
        
        Returns:
            List of search results ranked by relevance
        """
        # Generate query embedding
        query_embedding = self.embedder.encode([query])[0]
        faiss.normalize_L2(query_embedding.reshape(1, -1))
        
        # Search in index
        scores, indices = self.index.search(query_embedding.reshape(1, -1), k * 3)
        
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:  # Invalid index
                continue
            
            # Check namespace filter
            if namespace:
                chunk_namespace = self._get_namespace_for_index(idx)
                if chunk_namespace != namespace:
                    continue
            
            # Get metadata
            if idx in self.metadata:
                metadata = self.metadata[idx]
                
                # Apply additional filters
                if filters:
                    skip = False
                    for key, value in filters.items():
                        if metadata.get(key) != value:
                            skip = True
                            break
                    if skip:
                        continue
                
                results.append(SearchResult(
                    content=metadata.get("content", ""),
                    score=float(score),
                    metadata=metadata,
                    namespace=self._get_namespace_for_index(idx),
                    chunk_id=idx
                ))
        
        # Apply relevance scoring based on query type
        results = self._apply_relevance_scoring(query, results)
        
        # Sort by score and return top k
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:k]
    
    def _get_namespace_for_index(self, idx: int) -> DataNamespace:
        """Determine namespace for a given index"""
        for namespace, (start, end) in self.namespaces.items():
            if start <= idx <= end:
                return namespace
        return DataNamespace.DOCUMENTATION  # Default
    
    def _apply_relevance_scoring(self, query: str, results: List[SearchResult]) -> List[SearchResult]:
        """Apply additional relevance scoring based on query analysis"""
        query_lower = query.lower()
        
        for result in results:
            # Boost schema results for GraphQL-related queries
            if "graphql" in query_lower or "mutation" in query_lower or "query" in query_lower:
                if result.namespace == DataNamespace.SCHEMA:
                    result.score *= 1.5
            
            # Boost documentation for how-to queries
            if "how to" in query_lower or "implement" in query_lower:
                if result.namespace == DataNamespace.DOCUMENTATION:
                    result.score *= 1.3
            
            # Boost solutions for program-specific queries
            if any(prog in query_lower for prog in ["consumer", "credit", "trip", "automation"]):
                if result.namespace == DataNamespace.SOLUTIONS:
                    result.score *= 1.4
        
        return results
    
    async def search_schema(self, query: str, k: int = 5) -> List[SearchResult]:
        """Search specifically in schema namespace"""
        return await self.search(query, namespace=DataNamespace.SCHEMA, k=k)
    
    async def search_docs(self, query: str, category: Optional[str] = None, k: int = 5) -> List[SearchResult]:
        """Search specifically in documentation namespace"""
        filters = {"category": category} if category else None
        return await self.search(query, namespace=DataNamespace.DOCUMENTATION, k=k, filters=filters)
    
    async def get_full_schema(self) -> str:
        """Get the complete GraphQL schema"""
        schema_path = self.base_path / "agents" / "schema-agent" / "schema" / "highnote.graphql"
        if schema_path.exists():
            with open(schema_path) as f:
                return f.read()
        return "Schema not found"
    
    async def get_program_schema(self, program_type: str) -> List[SearchResult]:
        """Get schema relevant to a specific program"""
        # Search for schema elements related to the program
        return await self.search(
            f"{program_type} GraphQL schema types fields",
            namespace=DataNamespace.SCHEMA,
            k=10
        )
    
    async def get_program_docs(self, program_type: str) -> List[SearchResult]:
        """Get documentation relevant to a specific program"""
        return await self.search(
            f"{program_type} implementation guide documentation",
            namespace=DataNamespace.DOCUMENTATION,
            k=10
        )
    
    async def direct_search(self, query: str) -> str:
        """Perform direct search without routing"""
        results = await self.search(query, k=5)
        
        if results:
            # Format results
            formatted = []
            for r in results:
                formatted.append(f"[Score: {r.score:.2f}] {r.content[:200]}...")
            return "\n\n".join(formatted)
        
        return "No results found"
    
    def save_index(self):
        """Save FAISS index and metadata to disk"""
        index_path = self.base_path / "mcp" / "embeddings" / "unified.index"
        index_path.parent.mkdir(parents=True, exist_ok=True)
        
        faiss.write_index(self.index, str(index_path))
        self._save_metadata()
        
        logger.info(f"Saved index with {self.index.ntotal} vectors")