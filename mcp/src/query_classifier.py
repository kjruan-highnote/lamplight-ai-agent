"""
Query Classifier for intelligent routing

Analyzes queries to determine which agents should handle them.
"""

import re
import logging
from typing import Dict, Any, List, Optional
from enum import Enum
from dataclasses import dataclass

logger = logging.getLogger(__name__)

class QueryType(Enum):
    SCHEMA = "schema"
    DOCUMENTATION = "documentation"
    SOLUTIONS = "solutions"
    IMPLEMENTATION = "implementation"
    MIXED = "mixed"
    UNKNOWN = "unknown"

@dataclass
class ClassificationResult:
    """Result of query classification"""
    query_type: QueryType
    confidence: float
    key_terms: List[str]
    suggested_agents: List[str]
    metadata: Dict[str, Any]

class QueryClassifier:
    """
    Classifies queries to determine appropriate routing.
    
    Uses pattern matching and keyword analysis to identify query types.
    """
    
    def __init__(self):
        # Schema-related patterns and keywords
        self.schema_patterns = [
            r'\b(graphql|gql|schema|type|query|mutation|field|enum|interface|input)\b',
            r'\b(resolver|subscription|directive|fragment)\b',
            r'what (is|are) the .* (type|field|argument)',
            r'how (do|does) .* (query|mutation) work'
        ]
        
        self.schema_keywords = {
            'graphql', 'schema', 'type', 'query', 'mutation', 'field',
            'enum', 'interface', 'resolver', 'argument', 'input'
        }
        
        # Documentation-related patterns
        self.doc_patterns = [
            r'\b(how to|how do i|how can i|tutorial|guide|example|documentation)\b',
            r'\b(implement|integrate|setup|configure|install)\b',
            r'what (is|are) .* (used for|purpose)',
            r'(explain|describe|tell me about)'
        ]
        
        self.doc_keywords = {
            'how', 'guide', 'tutorial', 'example', 'documentation',
            'implement', 'setup', 'configure', 'explain', 'overview'
        }
        
        # Solutions/Program-related patterns
        self.solution_patterns = [
            r'\b(consumer.?credit|ap.?automation|trip\.?com|program|solution)\b',
            r'\b(postman|collection|api|endpoint)\b',
            r'generate .* (collection|test|implementation)'
        ]
        
        self.solution_keywords = {
            'consumer', 'credit', 'automation', 'trip', 'tripcom',
            'program', 'postman', 'collection', 'generate'
        }
        
        # Implementation-specific patterns
        self.implementation_patterns = [
            r'\b(implement|build|create|develop)\b .* (feature|functionality|integration)',
            r'(best practice|pattern|approach) for',
            r'(error|issue|problem|troubleshoot)'
        ]
    
    async def classify(self, query: str) -> QueryType:
        """
        Classify a query into a category.
        
        Args:
            query: The user's query
            
        Returns:
            QueryType enum value
        """
        result = await self.detailed_analysis(query)
        return result["type"]
    
    async def detailed_analysis(self, query: str) -> Dict[str, Any]:
        """
        Perform detailed analysis of a query.
        
        Returns complete classification information including confidence scores.
        """
        query_lower = query.lower()
        
        # Calculate scores for each category
        scores = {
            QueryType.SCHEMA: self._calculate_schema_score(query_lower),
            QueryType.DOCUMENTATION: self._calculate_doc_score(query_lower),
            QueryType.SOLUTIONS: self._calculate_solution_score(query_lower),
            QueryType.IMPLEMENTATION: self._calculate_implementation_score(query_lower)
        }
        
        # Determine primary type
        max_score = max(scores.values())
        
        if max_score < 0.3:
            query_type = QueryType.UNKNOWN
        else:
            # Check if multiple types have high scores
            high_score_types = [t for t, s in scores.items() if s > max_score * 0.7]
            
            if len(high_score_types) > 1:
                query_type = QueryType.MIXED
            else:
                query_type = max(scores, key=scores.get)
        
        # Extract key terms
        key_terms = self._extract_key_terms(query_lower)
        
        # Determine suggested agents
        suggested_agents = self._get_suggested_agents(query_type, scores)
        
        return {
            "type": query_type,
            "confidence": max_score,
            "scores": {t.value: s for t, s in scores.items()},
            "key_terms": key_terms,
            "suggested_agents": suggested_agents,
            "metadata": {
                "query_length": len(query),
                "has_code": bool(re.search(r'```|{|}|\[|\]', query)),
                "is_question": query.strip().endswith('?')
            }
        }
    
    def _calculate_schema_score(self, query: str) -> float:
        """Calculate likelihood that query is schema-related"""
        score = 0.0
        
        # Check patterns
        for pattern in self.schema_patterns:
            if re.search(pattern, query, re.IGNORECASE):
                score += 0.3
        
        # Check keywords
        words = set(query.split())
        keyword_matches = len(words & self.schema_keywords)
        score += min(keyword_matches * 0.2, 0.6)
        
        # Boost for GraphQL-specific terms
        if 'graphql' in query or 'gql' in query:
            score += 0.3
        
        return min(score, 1.0)
    
    def _calculate_doc_score(self, query: str) -> float:
        """Calculate likelihood that query is documentation-related"""
        score = 0.0
        
        # Check patterns
        for pattern in self.doc_patterns:
            if re.search(pattern, query, re.IGNORECASE):
                score += 0.25
        
        # Check keywords
        words = set(query.split())
        keyword_matches = len(words & self.doc_keywords)
        score += min(keyword_matches * 0.15, 0.5)
        
        # Boost for "how to" questions
        if query.startswith('how') or 'how to' in query:
            score += 0.2
        
        return min(score, 1.0)
    
    def _calculate_solution_score(self, query: str) -> float:
        """Calculate likelihood that query is solutions-related"""
        score = 0.0
        
        # Check patterns
        for pattern in self.solution_patterns:
            if re.search(pattern, query, re.IGNORECASE):
                score += 0.35
        
        # Check keywords
        words = set(query.split())
        keyword_matches = len(words & self.solution_keywords)
        score += min(keyword_matches * 0.25, 0.6)
        
        # Boost for specific program mentions
        program_names = ['consumer credit', 'ap automation', 'trip.com', 'tripcom']
        for program in program_names:
            if program in query:
                score += 0.4
                break
        
        return min(score, 1.0)
    
    def _calculate_implementation_score(self, query: str) -> float:
        """Calculate likelihood that query is implementation-related"""
        score = 0.0
        
        # Check patterns
        for pattern in self.implementation_patterns:
            if re.search(pattern, query, re.IGNORECASE):
                score += 0.3
        
        # Check for implementation-specific terms
        impl_terms = ['implement', 'build', 'integrate', 'develop', 'code', 'error', 'debug']
        for term in impl_terms:
            if term in query:
                score += 0.15
        
        return min(score, 1.0)
    
    def _extract_key_terms(self, query: str) -> List[str]:
        """Extract important terms from the query"""
        # Remove common words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
                     'is', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had',
                     'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might'}
        
        words = query.split()
        key_terms = []
        
        for word in words:
            cleaned = re.sub(r'[^\w\s]', '', word).lower()
            if cleaned and cleaned not in stop_words and len(cleaned) > 2:
                key_terms.append(cleaned)
        
        # Also extract any GraphQL type names (PascalCase)
        pascal_case_pattern = r'\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b'
        pascal_matches = re.findall(pascal_case_pattern, query)
        key_terms.extend(pascal_matches)
        
        return list(set(key_terms))[:10]  # Return top 10 unique terms
    
    def _get_suggested_agents(self, query_type: QueryType, scores: Dict[QueryType, float]) -> List[str]:
        """Determine which agents should handle the query"""
        suggested = []
        
        if query_type == QueryType.MIXED:
            # Include all agents with significant scores
            for t, score in scores.items():
                if score > 0.3:
                    if t == QueryType.SCHEMA:
                        suggested.append("schema")
                    elif t == QueryType.DOCUMENTATION:
                        suggested.append("documentation")
                    elif t == QueryType.SOLUTIONS:
                        suggested.append("solutions")
                    elif t == QueryType.IMPLEMENTATION:
                        suggested.append("implementation")
        else:
            # Map query type to agent
            type_to_agent = {
                QueryType.SCHEMA: "schema",
                QueryType.DOCUMENTATION: "documentation",
                QueryType.SOLUTIONS: "solutions",
                QueryType.IMPLEMENTATION: "implementation"
            }
            
            if query_type in type_to_agent:
                suggested.append(type_to_agent[query_type])
            
            # Add secondary agents if their scores are high
            for t, score in scores.items():
                if t != query_type and score > 0.5:
                    if t in type_to_agent:
                        agent = type_to_agent[t]
                        if agent not in suggested:
                            suggested.append(agent)
        
        return suggested if suggested else ["documentation"]  # Default to documentation