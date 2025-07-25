#!/usr/bin/env python3
"""
Self-learning GraphQL schema analyzer that automatically discovers
vocabulary, patterns, and relationships for improved query processing.
"""

import json
import re
import logging
from pathlib import Path
from typing import Dict, Set, List, Tuple, Optional
from collections import defaultdict, Counter
from dataclasses import dataclass, asdict
import pickle
import hashlib

@dataclass
class SchemaVocabulary:
    """Container for discovered schema vocabulary."""
    types: Set[str]
    inputs: Set[str] 
    enums: Set[str]
    interfaces: Set[str]
    unions: Set[str]
    mutations: Set[str]
    queries: Set[str]
    fields: Set[str]
    field_relationships: Dict[str, Set[str]]  # field -> types that contain it
    type_relationships: Dict[str, Set[str]]   # type -> related types
    validation_patterns: Dict[str, Set[str]]  # field -> validation info
    semantic_clusters: Dict[str, Set[str]]    # concept -> related terms
    
    def to_dict(self) -> Dict:
        """Convert to dictionary with sets as lists for JSON serialization."""
        result = {}
        for key, value in asdict(self).items():
            if isinstance(value, set):
                result[key] = list(value)
            elif isinstance(value, dict):
                result[key] = {k: list(v) if isinstance(v, set) else v for k, v in value.items()}
            else:
                result[key] = value
        return result
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'SchemaVocabulary':
        """Create from dictionary, converting lists back to sets."""
        kwargs = {}
        for key, value in data.items():
            if isinstance(value, list):
                kwargs[key] = set(value)
            elif isinstance(value, dict):
                kwargs[key] = {k: set(v) if isinstance(v, list) else v for k, v in value.items()}
            else:
                kwargs[key] = value
        return cls(**kwargs)

class SchemaAnalyzer:
    """Self-learning GraphQL schema analyzer."""
    
    def __init__(self, metadata_path: str = "embeddings/metadata.json", 
                 cache_path: str = "schema_vocabulary_cache.pkl"):
        self.metadata_path = Path(metadata_path)
        self.cache_path = Path(cache_path)
        self.logger = logging.getLogger(__name__)
        
        # GraphQL parsing patterns
        self.patterns = {
            'type': re.compile(r'type\s+(\w+)(?:\s+implements\s+[\w\s&|]+)?\s*\{', re.IGNORECASE),
            'input': re.compile(r'input\s+(\w+)\s*\{', re.IGNORECASE),
            'enum': re.compile(r'enum\s+(\w+)\s*\{', re.IGNORECASE),
            'interface': re.compile(r'interface\s+(\w+)\s*\{', re.IGNORECASE),
            'union': re.compile(r'union\s+(\w+)\s*=\s*([^}]+)', re.IGNORECASE),
            'mutation': re.compile(r'(\w+)\s*\([^)]*\)\s*:\s*(\w+)', re.MULTILINE),
            'field': re.compile(r'^\s*(\w+)\s*:\s*([A-Z][\w\[\]!]*)', re.MULTILINE),
            'validation': re.compile(r'validation.*?regex.*?pattern\s*[`"\']([^`"\']+)[`"\']', re.IGNORECASE | re.DOTALL),
            'comment': re.compile(r'"""([^"]*?)"""', re.DOTALL)
        }
        
        self.vocabulary: Optional[SchemaVocabulary] = None
        self._load_or_build_vocabulary()
    
    def _get_content_hash(self) -> str:
        """Generate hash of schema content for cache invalidation."""
        if not self.metadata_path.exists():
            return ""
            
        with open(self.metadata_path, 'r') as f:
            metadata = json.load(f)
        
        # Hash first 100 file paths and their modification times
        hash_input = []
        for path in metadata['paths'][:100]:
            try:
                stat = Path(path).stat()
                hash_input.append(f"{path}:{stat.st_mtime}")
            except:
                hash_input.append(path)
        
        return hashlib.md5(''.join(hash_input).encode()).hexdigest()
    
    def _load_or_build_vocabulary(self):
        """Load cached vocabulary or build new one if cache is stale."""
        current_hash = self._get_content_hash()
        
        # Try to load from cache
        if self.cache_path.exists():
            try:
                with open(self.cache_path, 'rb') as f:
                    cached_data = pickle.load(f)
                
                if cached_data.get('hash') == current_hash:
                    self.vocabulary = SchemaVocabulary.from_dict(cached_data['vocabulary'])
                    self.logger.info("Loaded schema vocabulary from cache")
                    return
            except Exception as e:
                self.logger.warning(f"Failed to load vocabulary cache: {e}")
        
        # Build new vocabulary
        self.logger.info("Building new schema vocabulary...")
        self.vocabulary = self._build_vocabulary()
        
        # Save to cache
        try:
            with open(self.cache_path, 'wb') as f:
                pickle.dump({
                    'hash': current_hash,
                    'vocabulary': self.vocabulary.to_dict()
                }, f)
            self.logger.info("Saved schema vocabulary to cache")
        except Exception as e:
            self.logger.warning(f"Failed to save vocabulary cache: {e}")
    
    def _build_vocabulary(self) -> SchemaVocabulary:
        """Build vocabulary by analyzing all schema chunks."""
        if not self.metadata_path.exists():
            return self._empty_vocabulary()
        
        with open(self.metadata_path, 'r') as f:
            metadata = json.load(f)
        
        vocab = self._empty_vocabulary()
        
        # Process all chunks
        for i, path in enumerate(metadata['paths']):
            if i % 500 == 0:
                self.logger.info(f"Processed {i}/{len(metadata['paths'])} chunks")
            
            try:
                content = self._read_chunk(path)
                if content:
                    self._extract_from_content(content, vocab)
            except Exception as e:
                self.logger.debug(f"Error processing {path}: {e}")
                continue
        
        # Post-process to build relationships and clusters
        self._build_relationships(vocab)
        self._build_semantic_clusters(vocab)
        
        self.logger.info(f"Built vocabulary with {len(vocab.types)} types, "
                        f"{len(vocab.inputs)} inputs, {len(vocab.fields)} fields")
        
        return vocab
    
    def _empty_vocabulary(self) -> SchemaVocabulary:
        """Create empty vocabulary structure."""
        return SchemaVocabulary(
            types=set(),
            inputs=set(),
            enums=set(),
            interfaces=set(),
            unions=set(),
            mutations=set(),
            queries=set(),
            fields=set(),
            field_relationships=defaultdict(set),
            type_relationships=defaultdict(set),
            validation_patterns=defaultdict(set),
            semantic_clusters=defaultdict(set)
        )
    
    def _read_chunk(self, path: str) -> Optional[str]:
        """Read content from chunk file."""
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception:
            return None
    
    def _extract_from_content(self, content: str, vocab: SchemaVocabulary):
        """Extract vocabulary from GraphQL content."""
        
        # Extract types, inputs, enums, etc.
        for pattern_name, pattern in self.patterns.items():
            matches = pattern.findall(content)
            
            if pattern_name == 'type':
                vocab.types.update(matches)
            elif pattern_name == 'input':
                vocab.inputs.update(matches)
            elif pattern_name == 'enum':
                vocab.enums.update(matches)
            elif pattern_name == 'interface':
                vocab.interfaces.update(matches)
            elif pattern_name == 'union':
                for name, types_str in matches:
                    vocab.unions.add(name)
                    # Extract union member types
                    union_types = re.findall(r'\b([A-Z]\w+)\b', types_str)
                    vocab.type_relationships[name].update(union_types)
            elif pattern_name == 'mutation':
                for name, return_type in matches:
                    vocab.mutations.add(name)
                    vocab.type_relationships[name].add(return_type)
            elif pattern_name == 'field':
                for field_name, field_type in matches:
                    vocab.fields.add(field_name)
                    # Clean field type (remove [], !, etc.)
                    clean_type = re.sub(r'[\[\]!]', '', field_type)
                    vocab.field_relationships[field_name].add(clean_type)
            elif pattern_name == 'validation':
                # Extract validation patterns from comments
                field_context = self._extract_field_context(content, matches)
                for field, pattern in field_context:
                    vocab.validation_patterns[field].add(pattern)
    
    def _extract_field_context(self, content: str, validation_matches: List[str]) -> List[Tuple[str, str]]:
        """Extract field context for validation patterns."""
        results = []
        for pattern in validation_matches:
            # Look for field name near the validation pattern
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if pattern in line:
                    # Look for field definition in nearby lines
                    for j in range(max(0, i-5), min(len(lines), i+5)):
                        field_match = re.search(r'(\w+)\s*:\s*String', lines[j])
                        if field_match:
                            results.append((field_match.group(1), pattern))
                            break
        return results
    
    def _build_relationships(self, vocab: SchemaVocabulary):
        """Build type relationships based on field usage."""
        # Find types that share common fields
        field_to_types = defaultdict(set)
        
        for field, types in vocab.field_relationships.items():
            for type_name in types:
                field_to_types[field].add(type_name)
        
        # Build type relationships
        for field, types in field_to_types.items():
            if len(types) > 1:
                types_list = list(types)
                for i, type1 in enumerate(types_list):
                    for type2 in types_list[i+1:]:
                        vocab.type_relationships[type1].add(type2)
                        vocab.type_relationships[type2].add(type1)
    
    def _build_semantic_clusters(self, vocab: SchemaVocabulary):
        """Build semantic clusters of related terms."""
        
        # Common GraphQL concepts
        base_clusters = {
            'address': {'address', 'street', 'postal', 'locality', 'region', 'country'},
            'payment': {'payment', 'card', 'transaction', 'amount', 'currency'},
            'user': {'user', 'person', 'account', 'holder', 'authorized'},  
            'business': {'business', 'company', 'organization', 'merchant'},
            'validation': {'validation', 'verify', 'check', 'confirm', 'regex', 'pattern'},
            'time': {'date', 'time', 'created', 'updated', 'expires'},
            'mutation': {'create', 'update', 'delete', 'issue', 'cancel', 'suspend'},
            'query': {'get', 'list', 'search', 'find', 'lookup'},
            'rule': {'rule', 'limit', 'restriction', 'policy', 'spend'},
            'status': {'status', 'state', 'active', 'inactive', 'pending', 'approved'}
        }
        
        # Extend clusters with discovered terms
        all_terms = (vocab.types | vocab.inputs | vocab.enums | vocab.fields | 
                    vocab.mutations | vocab.queries)
        
        for cluster_name, base_terms in base_clusters.items():
            vocab.semantic_clusters[cluster_name].update(base_terms)
            
            # Find terms that contain cluster keywords
            for term in all_terms:
                term_lower = term.lower()
                if any(base_term in term_lower for base_term in base_terms):
                    vocab.semantic_clusters[cluster_name].add(term_lower)
    
    def get_query_expansions(self, query: str) -> Set[str]:
        """Get expanded terms for a query using learned vocabulary."""
        if not self.vocabulary:
            return set()
        
        query_lower = query.lower()
        query_words = re.findall(r'\w+', query_lower)
        expanded_terms = set(query_words)
        
        # Expand using semantic clusters
        for word in query_words:
            for cluster_name, terms in self.vocabulary.semantic_clusters.items():
                if word in terms:
                    expanded_terms.update(terms)
                    break
        
        # Add related types and fields
        for word in query_words:
            # Check if word matches any known type/input/field
            word_variants = {word, word.title(), word.capitalize()}
            
            for variant in word_variants:
                if variant in self.vocabulary.types:
                    expanded_terms.update(self.vocabulary.type_relationships.get(variant, set()))
                elif variant in self.vocabulary.inputs:
                    expanded_terms.add('input')
                    expanded_terms.add(variant.lower())
                elif variant in self.vocabulary.fields:
                    related_types = self.vocabulary.field_relationships.get(variant, set())
                    expanded_terms.update(t.lower() for t in related_types)
        
        # Add validation-specific expansions
        validation_keywords = {'validation', 'validate', 'validations', 'regex', 'pattern'}
        if any(kw in query_lower for kw in validation_keywords):
            expanded_terms.update({'input', 'addressinput', 'regex', 'pattern', 'validation'})
        
        return expanded_terms
    
    def get_technical_terms(self, query: str) -> Set[str]:
        """Extract technical terms using learned schema vocabulary."""
        if not self.vocabulary:
            return set()
        
        # Extract words preserving original casing and create lowercase version for patterns
        query_lower = query.lower()
        query_words = re.findall(r'\w+', query)
        technical_terms = set()
        
        # Direct matches with known schema elements
        for word in query_words:
            # Generate comprehensive variants including camelCase preservation
            word_variants = {
                word,                    # Original case (e.g., "streetAddress")
                word.lower(),           # All lowercase (e.g., "streetaddress")
                word.upper(),           # All uppercase (e.g., "STREETADDRESS")
                word.title(),           # Title case (e.g., "Streetaddress")
                word.capitalize(),      # Capitalize first (e.g., "Streetaddress")
            }
            
            # Add camelCase variant if word contains mixed case
            if any(c.isupper() for c in word) and any(c.islower() for c in word):
                word_variants.add(word)  # Keep original camelCase
            
            for variant in word_variants:
                if (variant in self.vocabulary.types or 
                    variant in self.vocabulary.inputs or
                    variant in self.vocabulary.enums or
                    variant in self.vocabulary.mutations):
                    technical_terms.add(variant.lower())
        
        # Pattern-based extraction using learned patterns
        operation_patterns = [
            (r'create\s+(\w+)', 'create{}'),
            (r'update\s+(\w+)', 'update{}'),
            (r'issue\s+(\w+)', 'issue{}'),
            (r'(\w+)\s+input', '{}input'),
        ]
        
        for pattern, template in operation_patterns:
            matches = re.findall(pattern, query_lower)
            for match in matches:
                generated_term = template.format(match)
                if generated_term in [t.lower() for t in self.vocabulary.inputs]:
                    technical_terms.add(generated_term)
        
        return technical_terms
    
    def get_validation_info(self, field_name: str) -> Set[str]:
        """Get validation patterns for a specific field."""
        if not self.vocabulary:
            return set()
        
        return self.vocabulary.validation_patterns.get(field_name, set())
    
    def get_stats(self) -> Dict:
        """Get analyzer statistics."""
        if not self.vocabulary:
            return {"status": "not_initialized"}
        
        return {
            "status": "ready",
            "types": len(self.vocabulary.types),
            "inputs": len(self.vocabulary.inputs),
            "enums": len(self.vocabulary.enums),
            "fields": len(self.vocabulary.fields),
            "mutations": len(self.vocabulary.mutations),
            "semantic_clusters": len(self.vocabulary.semantic_clusters),
            "cache_path": str(self.cache_path)
        }

if __name__ == "__main__":
    # Test the analyzer
    logging.basicConfig(level=logging.INFO)
    
    analyzer = SchemaAnalyzer()
    stats = analyzer.get_stats()
    print(f"Schema Analyzer Stats: {json.dumps(stats, indent=2)}")
    
    # Test query expansion
    test_queries = [
        "What are the validations for streetAddress?",
        "How to create a user?",
        "List payment card types",
        "Business account holder mutations"
    ]
    
    for query in test_queries:
        expansions = analyzer.get_query_expansions(query)
        technical_terms = analyzer.get_technical_terms(query)
        print(f"\nQuery: {query}")
        print(f"Expansions: {list(expansions)[:10]}")
        print(f"Technical terms: {list(technical_terms)}")