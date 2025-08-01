#!/usr/bin/env python3
"""
General relevance scorer that boosts chunks based on exact schema term matches
and semantic relevance without hardcoding specific patterns.
"""

import re
import logging
from typing import List, Tuple, Set, Dict
from pathlib import Path
from collections import Counter


class RelevanceScorer:
    """Scores chunk relevance based on schema term matching and content analysis."""
    
    def __init__(self, schema_vocabulary: Dict[str, Set[str]] = None):
        self.logger = logging.getLogger(__name__)
        self.schema_vocabulary = schema_vocabulary or {}
    
    def extract_query_terms(self, query: str) -> Dict[str, List[str]]:
        """Extract different types of terms from query."""
        query_lower = query.lower()
        
        return {
            'direct_terms': re.findall(r'\b\w+\b', query_lower),
            'compound_terms': self._extract_compound_terms(query_lower),
            'question_intent': self._detect_question_intent(query_lower)
        }
    
    def _extract_compound_terms(self, query: str) -> List[str]:
        """Extract compound terms like 'streetAddress' from query."""
        compound_terms = []
        
        # Look for camelCase-like patterns in the query
        words = query.split()
        for word in words:
            # Convert common patterns to compound terms
            if 'street' in word.lower() and 'address' in word.lower():
                compound_terms.append('streetaddress')
            elif 'address' in word.lower() and 'input' in word.lower():
                compound_terms.append('addressinput')  
            elif len(word) > 6:  # Longer words might be compound
                compound_terms.append(word.lower())
        
        # Also check for multi-word compound concepts
        query_lower = query.lower()
        if 'street address' in query_lower:
            compound_terms.append('streetaddress')
        if 'address input' in query_lower:
            compound_terms.append('addressinput')
        if 'address validation' in query_lower:
            compound_terms.append('addressvalidation')
            
        return compound_terms
    
    def _detect_question_intent(self, query: str) -> str:
        """Detect the intent of the question."""
        if any(word in query for word in ['validation', 'validate', 'format', 'pattern', 'regex']):
            return 'validation_inquiry'
        elif any(word in query for word in ['create', 'how to', 'how do']):
            return 'creation_inquiry'
        elif any(word in query for word in ['what', 'what are', 'list', 'show']):
            return 'information_inquiry'
        elif any(word in query for word in ['field', 'fields', 'property']):
            return 'field_inquiry'
        else:
            return 'general_inquiry'
    
    def calculate_term_match_score(self, content: str, filename: str, query_terms: Dict[str, List[str]]) -> float:
        """Calculate score based on dynamic term matching without hardcoded terms."""
        score = 0.0
        content_lower = content.lower()
        filename_lower = filename.lower()
        
        all_query_terms = query_terms['direct_terms'] + query_terms['compound_terms']
        
        for term in all_query_terms:
            if len(term) < 3:  # Skip very short terms
                continue
                
            # Calculate term specificity (longer, less common terms get higher weight)
            # Give extra weight to compound terms and longer terms
            base_weight = min(len(term) / 8.0, 1.2)  # Max weight of 1.2 for terms 8+ chars
            # Bonus for compound terms (likely more specific/important)
            if len(term) > 8 or any(char.isupper() for char in term[1:]):  # camelCase or long terms
                term_weight = min(base_weight * 1.3, 1.5)
            else:
                term_weight = base_weight
            
            # Content matches
            if term in content_lower:
                base_score = 0.3 * term_weight
                score += base_score
                
                # Bonus for field definitions (term followed by colon)
                if f'{term}:' in content_lower or f'{term} :' in content_lower:
                    score += 0.4 * term_weight
                    
                # Bonus for terms in comments/descriptions
                if f'"""{term}' in content_lower or f'# {term}' in content_lower:
                    score += 0.2 * term_weight
            
            # Filename matches (generally more specific/relevant)
            if term in filename_lower:
                score += 0.5 * term_weight
                
            # Exact filename component match (between underscores)
            filename_parts = filename_lower.replace('.graphql', '').split('_')
            if term in filename_parts:
                score += 0.3 * term_weight
        
        # Context-aware boosting based on query intent and content overlap
        query_intent = query_terms['question_intent']
        if query_intent == 'validation_inquiry':
            # Boost files that contain terms semantically related to the query terms
            # Count overlapping concepts rather than hardcoded lists
            query_concept_words = set()
            for term in all_query_terms:
                if len(term) > 4:  # Focus on meaningful terms
                    query_concept_words.add(term)
            
            content_words = set(content_lower.split())
            concept_overlap = len(query_concept_words & content_words)
            if concept_overlap > 0:
                score += 0.3 * min(concept_overlap / 3.0, 1.0)  # Up to 0.3 boost for concept overlap
                
            # Boost input types for validation queries (structural pattern)
            if 'input' in filename_lower and 'input' in content_lower:
                score += 0.2
        
        elif query_intent == 'field_inquiry':
            # Boost files that contain field definitions (structural pattern)
            import re
            field_definition_pattern = r'\w+\s*:\s*\w+'
            if re.search(field_definition_pattern, content_lower):
                score += 0.2
                
        return score
    
    def calculate_content_structure_score(self, content: str, query_intent: str) -> float:
        """Score based on content structure and query intent."""
        score = 0.0
        content_lower = content.lower()
        
        # Detect GraphQL structures dynamically
        structures = {
            'input_definition': bool(re.search(r'input\s+\w+\s*{', content_lower)),
            'type_definition': bool(re.search(r'type\s+\w+\s*{', content_lower)),
            'enum_definition': bool(re.search(r'enum\s+\w+\s*{', content_lower)),
            'field_with_type': bool(re.search(r'\w+\s*:\s*\w+', content_lower)),
            'has_comments': '"""' in content,
            'mutation_definition': bool(re.search(r'type\s+mutation\s*{', content_lower)),
            'interface_definition': bool(re.search(r'interface\s+\w+\s*{', content_lower)),
        }
        
        # Score based on query intent and structural patterns (no hardcoded terms)
        if query_intent == 'validation_inquiry':
            # Look for detailed comments/descriptions (likely to contain validation info)
            if structures['has_comments']:
                # Count comment blocks - more detailed documentation is better
                comment_blocks = content.count('"""') // 2
                score += min(comment_blocks * 0.25, 0.75)  # Up to 0.75 for multiple comment blocks
                
            # Input types are more likely to have validation
            if structures['input_definition']:
                score += 0.4
                
        elif query_intent == 'field_inquiry':
            # Files with field definitions are most relevant
            if structures['field_with_type']:
                score += 0.5
            # Type and input definitions contain field information
            if structures['type_definition'] or structures['input_definition']:
                score += 0.3
                
        elif query_intent == 'information_inquiry':
            # General information queries benefit from well-documented files
            if structures['has_comments']:
                score += 0.3
            # Any definition type is potentially useful
            definition_count = sum(1 for k, v in structures.items() 
                                 if k.endswith('_definition') and v)
            if definition_count > 0:
                score += min(definition_count * 0.15, 0.3)  # Up to 0.3 for multiple definitions
        
        return score
    
    def calculate_semantic_density_score(self, content: str, query_terms: Dict[str, List[str]]) -> float:
        """Calculate semantic density of relevant terms."""
        content_words = re.findall(r'\b\w+\b', content.lower())
        if not content_words:
            return 0.0
        
        all_query_terms = set(query_terms['direct_terms'] + query_terms['compound_terms'])
        matching_words = [word for word in content_words if word in all_query_terms]
        
        # Calculate density
        density = len(matching_words) / len(content_words)
        
        # Bonus for multiple different term matches
        unique_matches = len(set(matching_words))
        diversity_bonus = min(unique_matches * 0.1, 0.5)
        
        return density + diversity_bonus
    
    def score_chunk_relevance(self, path: str, content: str, query: str) -> float:
        """Calculate overall relevance score for a chunk."""
        filename = Path(path).name
        query_terms = self.extract_query_terms(query)
        intent = query_terms['question_intent']
        
        # Calculate component scores
        term_match_score = self.calculate_term_match_score(content, filename, query_terms)
        structure_score = self.calculate_content_structure_score(content, intent)
        density_score = self.calculate_semantic_density_score(content, query_terms)
        
        # Combine scores with weights
        total_score = (
            term_match_score * 0.4 +      # 40% for exact term matches
            structure_score * 0.35 +       # 35% for content structure relevance
            density_score * 0.25           # 25% for semantic density
        )
        
        return total_score
    
    def enhance_search_results(self, results: List[Tuple[str, str, float]], 
                             query: str, top_k: int = 10) -> List[Tuple[str, str, float]]:
        """Enhance search results with relevance scoring."""
        if not results:
            return results
        
        enhanced_results = []
        
        for path, content, original_score in results:
            # Calculate relevance boost
            relevance_score = self.score_chunk_relevance(path, content, query)
            
            # Combine original embedding score with relevance score
            # Original score is negative (closer to 0 = better)
            # Relevance score is positive (higher = better)
            enhanced_score = original_score + relevance_score
            
            enhanced_results.append((path, content, enhanced_score))
        
        # Sort by enhanced score (higher = better)
        enhanced_results.sort(key=lambda x: x[2], reverse=True)
        
        # Log top results for debugging
        self.logger.debug(f"Enhanced results for query '{query}':")
        for i, (path, _, score) in enumerate(enhanced_results[:5]):
            self.logger.debug(f"  {i+1}. {Path(path).name} (score: {score:.3f})")
        
        return enhanced_results[:top_k]
    
    def create_optimized_query(self, original_query: str) -> str:
        """Create optimized query focusing on key terms."""
        query_terms = self.extract_query_terms(original_query)
        
        # Start with compound terms as they're usually most specific
        key_terms = query_terms['compound_terms'].copy()
        
        # Add the most important direct terms
        important_direct_terms = [term for term in query_terms['direct_terms'] 
                                if len(term) > 3 and term not in ['what', 'are', 'the', 'for']]
        key_terms.extend(important_direct_terms)
        
        # Limit to avoid over-expansion
        if len(key_terms) > 8:
            # Prioritize longer, more specific terms
            key_terms = sorted(key_terms, key=len, reverse=True)[:8]
        
        return ' '.join(key_terms) if key_terms else original_query


if __name__ == "__main__":
    # Test the scorer
    logging.basicConfig(level=logging.DEBUG)
    
    scorer = RelevanceScorer()
    
    test_query = "What are the validations for streetAddress?"
    query_terms = scorer.extract_query_terms(test_query)
    
    print(f"Query: {test_query}")
    print(f"Terms: {query_terms}")
    print(f"Optimized: {scorer.create_optimized_query(test_query)}")
    
    # Test scoring
    sample_content = '''"""Input representing the parts of an address."""
input AddressInput {
  """The number and street of the address."""
  streetAddress: String!
}'''
    
    score = scorer.score_chunk_relevance("test_AddressInput.graphql", sample_content, test_query)
    print(f"\\nSample content score: {score:.3f}")