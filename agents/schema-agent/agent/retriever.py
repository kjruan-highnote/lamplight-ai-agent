import json
import logging
import re
import numpy as np
from pathlib import Path
from typing import List, Tuple, Optional, Set, Dict
from difflib import SequenceMatcher
from agent.embedder import Embedder
from agent.schema_analyzer import SchemaAnalyzer
from agent.pattern_generator import PatternGenerator
from agent.relevance_scorer import RelevanceScorer

class Retriever:
    def __init__(self, index_path="embeddings/index.faiss", metadata_path="embeddings/metadata.json", 
                 model_name="sentence-transformers/all-MiniLM-L6-v2", min_similarity_score=-0.5):
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
        
        # Initialize schema analyzer for self-learning vocabulary
        self.schema_analyzer = SchemaAnalyzer(metadata_path=metadata_path)
        
        # Load generated question patterns
        self.question_patterns = self._load_question_patterns()
        
        # Initialize relevance scorer
        self.relevance_scorer = RelevanceScorer()
        
        self._initialize_embedder()
    
    def _load_question_patterns(self) -> Dict[str, List[str]]:
        """Load generated question patterns from file."""
        try:
            patterns = PatternGenerator.load_patterns("question_patterns.json")
            pattern_dict = {}
            
            for pattern in patterns:
                for trigger in pattern.trigger_words:
                    if trigger not in pattern_dict:
                        pattern_dict[trigger] = []
                    pattern_dict[trigger].extend(pattern.expansion_terms)
            
            self.logger.info(f"Loaded {len(patterns)} question patterns")
            return pattern_dict
            
        except Exception as e:
            self.logger.warning(f"Failed to load question patterns: {e}")
            return {}
    
    # Legacy method kept for compatibility - now uses schema analyzer
    def _build_dynamic_expansions(self) -> Dict[str, List[str]]:
        """Build query expansions dynamically from actual GraphQL schema files."""
        if self._expansion_cache is not None:
            return self._expansion_cache
            
        if not self.embedder or not self.embedder.paths:
            # Fallback to minimal static expansions
            return {
                'create': ['create', 'mutation', 'input'],
                'update': ['update', 'mutation', 'input'],
                'issue': ['issue', 'mutation'],
                'mutation': ['mutation', 'input'],
                'query': ['query', 'type'],
                'input': ['input', 'mutation'],
                'type': ['type', 'field']
            }
        
        expansions = {
            # Base GraphQL concepts
            'create': ['create', 'mutation', 'input'],
            'update': ['update', 'mutation', 'input'], 
            'delete': ['delete', 'mutation'],
            'issue': ['issue', 'mutation'],
            'get': ['query', 'type'],
            'list': ['query', 'type', 'connection'],
            'field': ['field', 'type', 'property'],
            'mutation': ['mutation', 'input', 'create', 'update', 'delete', 'issue'],
            'query': ['query', 'type', 'get', 'list'],
            'input': ['input', 'mutation', 'create', 'update'],
            'type': ['type', 'field', 'interface', 'enum']
        }
        
        # Extract terms from actual filenames to build dynamic expansions
        entity_groups = {}
        
        for path in self.embedder.paths:
            filename = Path(path).stem.lower()
            parts = filename.split('_', 2)
            
            if len(parts) >= 3:
                category = parts[1]  # mutations, queries, inputs, etc.
                term_name = parts[2].lower()
                
                # Extract base entities (user, card, account, etc.)
                base_entities = self._extract_base_entities(term_name)
                
                for entity in base_entities:
                    if entity not in entity_groups:
                        entity_groups[entity] = set()
                    
                    # Add variations found in actual files
                    entity_groups[entity].add(term_name)
                    entity_groups[entity].add(entity)
                    
                    # Add category-specific variations
                    if category == 'mutations':
                        if term_name.startswith('create'):
                            entity_groups[entity].add(f'create{entity}')
                        elif term_name.startswith('update'):
                            entity_groups[entity].add(f'update{entity}')
                        elif term_name.startswith('issue'):
                            entity_groups[entity].add(f'issue{entity}')
                    elif category == 'inputs':
                        entity_groups[entity].add(f'{entity}input')
        
        # Convert sets to lists and add to expansions
        for entity, variations in entity_groups.items():
            if len(variations) > 1:  # Only add if we found multiple variations
                expansions[entity] = list(variations)
        
        self._expansion_cache = expansions
        return expansions
    
    def _extract_base_entities(self, term_name: str) -> List[str]:
        """Extract base entity names from compound terms."""
        entities = []
        
        # Common patterns to extract base entities
        patterns = [
            # Remove prefixes
            (r'^create(.+)', r'\1'),
            (r'^update(.+)', r'\1'), 
            (r'^issue(.+)', r'\1'),
            (r'^delete(.+)', r'\1'),
            # Remove suffixes  
            (r'(.+)input$', r'\1'),
            (r'(.+)payload$', r'\1'),
            (r'(.+)connection$', r'\1'),
            (r'(.+)edge$', r'\1'),
        ]
        
        current_term = term_name
        for pattern, replacement in patterns:
            match = re.match(pattern, current_term, re.IGNORECASE)
            if match:
                current_term = match.group(1).lower()
                break
        
        # Split compound words (basic heuristic)
        # Look for common entities
        common_entities = ['user', 'card', 'account', 'holder', 'business', 'person', 'payment', 'financial', 'authorized']
        
        for entity in common_entities:
            if entity in current_term:
                entities.append(entity)
        
        # Add the processed term itself if it's different from original
        if current_term != term_name and current_term not in entities:
            entities.append(current_term)
            
        return entities if entities else [term_name]
    
    def _build_minimal_expansions(self) -> Dict[str, List[str]]:
        """Build minimal expansions for technical term extraction without circular dependencies."""
        if not self.embedder or not self.embedder.paths:
            # Absolute minimal fallback
            return {
                'create': ['create', 'mutation'],
                'update': ['update', 'mutation'], 
                'issue': ['issue', 'mutation'],
                'delete': ['delete', 'mutation'],
                'card': ['card', 'paymentcard'],
                'payment': ['payment', 'paymentcard'],
                'account': ['account', 'accountholder', 'financialaccount'],
                'financial': ['financial', 'financialaccount'],
                'business': ['business', 'businessaccountholder'],
                'user': ['user', 'authorizeduser'],
                'mutation': ['mutation'],
                'query': ['query'],
                'input': ['input'],
                'type': ['type']
            }
        
        # Quick file-based expansion building (no complex processing)
        quick_expansions = {
            'create': ['create', 'mutation', 'input'],
            'update': ['update', 'mutation', 'input'],
            'issue': ['issue', 'mutation'],
            'delete': ['delete', 'mutation'],
            'card': ['card', 'paymentcard'],
            'payment': ['payment', 'paymentcard'], 
            'account': ['account', 'accountholder', 'financialaccount'],
            'financial': ['financial', 'financialaccount'],
            'business': ['business', 'businessaccountholder'],
            'user': ['user', 'authorizeduser'],
            'person': ['person', 'personaccountholder'],
            'holder': ['holder', 'accountholder'], 
            'authorized': ['authorized', 'authorizeduser'],
            'mutation': ['mutation', 'input'],
            'query': ['query', 'type'],
            'input': ['input', 'mutation'],
            'type': ['type', 'field']
        }
        
        # Simple enhancement from actual filenames
        common_patterns = set()
        for path in self.embedder.paths[:100]:  # Limit to first 100 for speed
            filename = Path(path).stem.lower()
            parts = filename.split('_', 2)
            if len(parts) >= 3:
                term_name = parts[2].lower()
                common_patterns.add(term_name)
        
        # Add commonly found patterns to relevant base terms
        for pattern in common_patterns:
            if 'issue' in pattern and 'payment' in pattern:
                quick_expansions.setdefault('issue', []).append(pattern)
                quick_expansions.setdefault('payment', []).append(pattern)
            elif 'issue' in pattern and 'financial' in pattern:
                quick_expansions.setdefault('issue', []).append(pattern)
                quick_expansions.setdefault('financial', []).append(pattern)
            elif 'create' in pattern and 'business' in pattern:
                quick_expansions.setdefault('create', []).append(pattern)
                quick_expansions.setdefault('business', []).append(pattern)
        
        return quick_expansions
    
    def _get_schema_terms_for_extraction(self) -> Dict[str, List[str]]:
        """Get schema terms specifically for technical term extraction."""
        # Base terms - these are safe and don't cause circular dependencies
        base_terms = {
            'create': ['create', 'mutation', 'input'],
            'update': ['update', 'mutation', 'input'],
            'issue': ['issue', 'mutation'],
            'delete': ['delete', 'mutation'],
            'card': ['card', 'paymentcard'],
            'payment': ['payment', 'paymentcard'], 
            'account': ['account', 'accountholder', 'financialaccount'],
            'financial': ['financial', 'financialaccount'],
            'business': ['business', 'businessaccountholder'],
            'user': ['user', 'authorizeduser'],
            'person': ['person', 'personaccountholder'],
            'holder': ['holder', 'accountholder'], 
            'authorized': ['authorized', 'authorizeduser'],
            'mutation': ['mutation', 'input'],
            'query': ['query', 'type'],
            'input': ['input', 'mutation'],
            'type': ['type', 'field']
        }
        
        # Enhance with actual schema file patterns if available
        if self.embedder and self.embedder.paths:
            # Add key patterns found in actual files
            key_patterns = [
                'issuepaymentcard', 'issuepaymentcardforapplication', 'issuepaymentcardforfinancialaccount',
                'issuefinancialaccount', 'issuefinancialaccountforapplication', 
                'issuefinancialaccountforapplicationwithondemandfundingsource',
                'issuefundingfinancialaccountforapplication', 'issueemployerfinancialaccountforcardproduct',
                'createusbusinessaccountholder', 'createuspersonaccountholder',
                'paymentcardinput', 'businessaccountholder', 'personaccountholder'
            ]
            
            for pattern in key_patterns:
                # Add to relevant base terms
                if 'issue' in pattern:
                    base_terms.setdefault('issue', []).append(pattern)
                if 'payment' in pattern:
                    base_terms.setdefault('payment', []).append(pattern)
                if 'card' in pattern:
                    base_terms.setdefault('card', []).append(pattern)
                if 'financial' in pattern:
                    base_terms.setdefault('financial', []).append(pattern)
                if 'business' in pattern:
                    base_terms.setdefault('business', []).append(pattern)
                if 'person' in pattern:
                    base_terms.setdefault('person', []).append(pattern)
                if 'account' in pattern:
                    base_terms.setdefault('account', []).append(pattern)
        
        return base_terms
    
    
    def _merge_hybrid_results(self, semantic_results: List[Tuple[str, str, float]], 
                             keyword_results: List[Tuple[str, str, float]], 
                             top_k: int) -> List[Tuple[str, str, float]]:
        """Merge and re-rank semantic and keyword search results."""
        # Create a dict to track all results by path
        combined_results = {}
        
        # Add semantic results
        for path, content, score in semantic_results:
            combined_results[path] = {
                'content': content,
                'semantic_score': score,
                'keyword_score': None,
                'hybrid_score': score
            }
        
        # Add/update with keyword results
        for path, content, keyword_score in keyword_results:
            if path in combined_results:
                # Combine scores: boost semantic score with keyword match
                semantic_score = combined_results[path]['semantic_score']
                # Keyword boost: add positive boost to semantic score
                keyword_boost = min(0.5, abs(keyword_score) * 0.8)  # Cap boost at 0.5
                hybrid_score = semantic_score + keyword_boost
                
                combined_results[path].update({
                    'keyword_score': keyword_score,
                    'hybrid_score': hybrid_score
                })
            else:
                # Pure keyword match (no semantic result)
                combined_results[path] = {
                    'content': content,
                    'semantic_score': None,
                    'keyword_score': keyword_score,
                    'hybrid_score': keyword_score + 0.3  # Boost pure keyword matches
                }
        
        # Convert back to list and sort by hybrid score
        final_results = []
        for path, data in combined_results.items():
            final_results.append((path, data['content'], data['hybrid_score']))
        
        # Sort by hybrid score (higher = better for our boosted scores)
        final_results.sort(key=lambda x: x[2], reverse=True)
        
        # Production: minimal logging only
        
        return final_results[:top_k]
    
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
            
            # Extract technical terms for keyword search
            technical_terms = self._extract_technical_terms(question)
            
            # Try to get results with similarity scores, fallback to regular search
            try:
                # 1. Semantic search - cast wider net initially
                semantic_results = self.embedder.search_with_scores(processed_question, top_k=top_k * 4)
                
                # Calculate adaptive threshold based on score distribution
                scores = [score for _, _, score in semantic_results]
                adaptive_threshold = self._calculate_adaptive_threshold(scores, top_k)
                
                # Use more permissive threshold to include more candidates
                # Be extra permissive for validation queries since they often need specific files
                validation_related = any(term in processed_question.lower() 
                                       for term in ['validation', 'validate', 'pattern', 'regex', 'format'])
                if validation_related:
                    effective_threshold = min(adaptive_threshold, -1.5)  # Much more permissive for validation queries
                else:
                    effective_threshold = min(adaptive_threshold, -1.0)  # Allow scores down to -1.0
                
                # Filter semantic results by threshold
                filtered_semantic = [
                    (path, content, score) for path, content, score in semantic_results 
                    if score >= effective_threshold
                ]
                
                # 2. Keyword search
                keyword_results = []
                if technical_terms:
                    keyword_results = self._fuzzy_match_chunks(technical_terms, min_similarity=0.5)
                    # Limit keyword results to prevent overwhelming semantic results
                    keyword_results = keyword_results[:top_k]
                
                # 3. Hybrid merge and ranking (keep more candidates than requested)
                hybrid_results = self._merge_hybrid_results(filtered_semantic, keyword_results, top_k * 2)
                
                # 4. Fetch related chunks based on type references from top hybrid results
                related_chunks = self._fetch_related_chunks(hybrid_results[:top_k], max_related=3)
                
                # 5. Final combination
                all_results = hybrid_results + related_chunks
                # Remove duplicates while preserving order
                seen_paths = set()
                deduplicated_results = []
                for item in all_results:
                    if item[0] not in seen_paths:
                        deduplicated_results.append(item)
                        seen_paths.add(item[0])
                
                # 6. Apply relevance scoring for final ranking (but keep more balanced)
                relevance_enhanced_results = self.relevance_scorer.enhance_search_results(
                    deduplicated_results, question, top_k + 2
                )
                
                # 7. Return relevance-enhanced results
                final_results = relevance_enhanced_results
                
                # Production: summary logging only
                self.logger.info(f"Retrieved {len(final_results)} chunks via hybrid search")
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
        """Preprocess the query using relevance scorer for focused expansion."""
        query = query.strip()
        
        # Use relevance scorer to create optimized query
        optimized_query = self.relevance_scorer.create_optimized_query(query)
        
        # Add minimal GraphQL context if needed
        if 'graphql' not in optimized_query.lower():
            optimized_query = f"GraphQL {optimized_query}"
        
        return optimized_query
    
    def _extract_technical_terms(self, query: str) -> Set[str]:
        """Extract technical terms using self-learning schema analyzer."""
        return self.schema_analyzer.get_technical_terms(query)
    
    def _calculate_adaptive_threshold(self, scores: List[float], top_k: int = 12) -> float:
        """Calculate adaptive similarity threshold based on score distribution."""
        if not scores:
            return -10.0
            
        # Take scores from top results for analysis
        analysis_scores = scores[:min(top_k * 2, len(scores))]
        
        if len(analysis_scores) < 3:
            # Not enough data, use permissive threshold
            return -2.0
            
        # Calculate statistical measures
        mean_score = np.mean(analysis_scores)
        std_score = np.std(analysis_scores)
        
        # Adaptive threshold strategy:
        # 1. If there's a clear best match (large gap), be more selective
        # 2. If scores are tightly clustered, be more permissive
        # 3. Use standard deviation to detect score distribution
        
        if len(analysis_scores) >= 2:
            score_gap = abs(analysis_scores[0] - analysis_scores[1])
            if score_gap > 0.2:  # Large gap indicates clear best match
                threshold = mean_score - (0.3 * std_score)
            else:  # Tight clustering, be more permissive
                threshold = mean_score - (0.8 * std_score)
        else:
            threshold = mean_score - (0.5 * std_score)
        
        # Apply bounds to prevent extreme thresholds
        threshold = max(threshold, -3.0)  # Not too permissive
        threshold = min(threshold, -0.1)  # Not too restrictive
        
        # Production: threshold calculation only, no debug logging
        
        return threshold
    
    def _fuzzy_match_chunks(self, technical_terms: Set[str], min_similarity: float = 0.6) -> List[Tuple[str, str, float]]:
        """Find chunks using fuzzy matching on technical terms."""
        keyword_matches = []
        
        if not self.embedder or not self.embedder.paths:
            return keyword_matches
            
        for i, (path, content) in enumerate(zip(self.embedder.paths, self.embedder.texts)):
            filename = Path(path).stem.lower()  # Get filename without extension
            content_lower = content.lower()
            
            max_match_score = 0.0
            best_term = ""
            
            # Check each technical term against filename and content
            for term in technical_terms:
                # Filename matching (higher weight)
                filename_similarity = SequenceMatcher(None, term, filename).ratio()
                if filename_similarity > min_similarity:
                    # Boost filename matches significantly
                    match_score = filename_similarity * 1.5  # Boost filename matches
                    if match_score > max_match_score:
                        max_match_score = match_score
                        best_term = term
                
                # Content matching (lower weight, for exact matches)
                if term in content_lower:
                    content_score = 0.8  # Fixed high score for exact content matches
                    if content_score > max_match_score:
                        max_match_score = content_score
                        best_term = term
                
                # Fuzzy content matching for technical terms
                if len(term) > 8:  # Only for longer terms to avoid noise
                    for line in content_lower.split('\n')[:5]:  # Check first 5 lines
                        line_similarity = SequenceMatcher(None, term, line).ratio()
                        if line_similarity > 0.7:
                            content_score = line_similarity * 0.9
                            if content_score > max_match_score:
                                max_match_score = content_score
                                best_term = term
            
            if max_match_score > 0:
                # Convert to similarity score format (negative, closer to 0 = better)
                keyword_score = -(1.0 - max_match_score)  # Convert to negative similarity
                keyword_matches.append((path, content, keyword_score))
        
        # Sort by score (closer to 0 = better)
        keyword_matches.sort(key=lambda x: x[2], reverse=True)
        return keyword_matches
    
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
        
        stats = {
            "status": "ready",
            "total_chunks": len(self.embedder.texts),
            "model_name": self.model_name,
            "index_path": str(self.index_path),
            "min_similarity_score": self.min_similarity_score
        }
        
        # Add schema analyzer stats
        schema_stats = self.schema_analyzer.get_stats()
        stats["schema_analyzer"] = schema_stats
        
        return stats

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
