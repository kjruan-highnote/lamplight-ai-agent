import re
from typing import List, Dict, Tuple
from enum import Enum

class QueryType(Enum):
    SCHEMA = "schema"
    DOCUMENTATION = "documentation"  
    MIXED = "mixed"
    UNKNOWN = "unknown"

class QueryClassifier:
    """Classifies queries to determine which agent(s) should handle them."""
    
    def __init__(self):
        # Schema-specific keywords
        self.schema_keywords = {
            'graphql', 'mutation', 'query', 'type', 'field', 'enum', 'interface',
            'schema', 'resolver', 'scalar', 'union', 'directive', 'fragment',
            'introspection', 'subscription', 'variables', 'arguments', 'return type',
            'input type', 'object type', 'list type', 'non-null', 'nullable'
        }
        
        # Documentation-specific keywords
        self.doc_keywords = {
            'how to', 'tutorial', 'guide', 'example', 'step by step', 'getting started',
            'implementation', 'integrate', 'setup', 'configure', 'install', 'deploy',
            'best practices', 'workflow', 'process', 'create', 'build', 'develop',
            'dashboard', 'console', 'ui', 'interface', 'screen', 'page', 'form'
        }
        
        # Schema-specific patterns
        self.schema_patterns = [
            r'\b(mutation|query|type|field|enum)\s+\w+',  # GraphQL definitions
            r'\w+\s*\{[^}]*\}',  # GraphQL-like syntax
            r'\b\w+\s*:\s*\w+[!\[\]]*',  # Field type definitions
            r'@\w+',  # Directives
            r'\$\w+',  # Variables
        ]
        
        # Documentation patterns
        self.doc_patterns = [
            r'\bhow\s+(do|to|can)\s+i\b',  # "how do I", "how to", "how can I"
            r'\bwhat\s+is\s+(the\s+)?(process|workflow|way)\b',  # Process questions
            r'\b(step\s+by\s+step|walkthrough|tutorial)\b',  # Tutorial requests
            r'\b(create|build|setup|configure|implement)\s+a?\s*\w+',  # Implementation
        ]
        
        # Mixed indicators - suggest both agents might be useful
        self.mixed_indicators = {
            'api', 'endpoint', 'request', 'response', 'payload', 'data',
            'integration', 'sdk', 'client', 'server', 'authentication', 'authorization'
        }

    def extract_features(self, query: str) -> Dict[str, float]:
        """Extract features from query for classification."""
        query_lower = query.lower()
        
        features = {
            'schema_keyword_count': 0,
            'doc_keyword_count': 0,
            'mixed_keyword_count': 0,
            'schema_pattern_count': 0,
            'doc_pattern_count': 0,
            'query_length': len(query.split()),
            'has_code_syntax': 0,
            'has_question_words': 0,
            'has_implementation_words': 0
        }
        
        # Count keyword matches
        words = set(query_lower.split())
        features['schema_keyword_count'] = len(words.intersection(self.schema_keywords))
        features['doc_keyword_count'] = len(words.intersection(self.doc_keywords))
        features['mixed_keyword_count'] = len(words.intersection(self.mixed_indicators))
        
        # Count pattern matches
        for pattern in self.schema_patterns:
            features['schema_pattern_count'] += len(re.findall(pattern, query, re.IGNORECASE))
        
        for pattern in self.doc_patterns:
            features['doc_pattern_count'] += len(re.findall(pattern, query, re.IGNORECASE))
        
        # Additional features
        features['has_code_syntax'] = 1 if any(char in query for char in ['{', '}', ':', '$', '@']) else 0
        features['has_question_words'] = 1 if any(word in query_lower for word in ['how', 'what', 'why', 'when', 'where', 'which']) else 0
        features['has_implementation_words'] = 1 if any(word in query_lower for word in ['create', 'build', 'implement', 'setup', 'configure']) else 0
        
        return features

    def classify_query(self, query: str) -> Tuple[QueryType, float]:
        """
        Classify a query and return the type with confidence score.
        
        Returns:
            Tuple of (QueryType, confidence_score)
        """
        features = self.extract_features(query)
        
        # Simple rule-based classification
        schema_score = (
            features['schema_keyword_count'] * 2 +
            features['schema_pattern_count'] * 3 +
            features['has_code_syntax'] * 1
        )
        
        doc_score = (
            features['doc_keyword_count'] * 2 +
            features['doc_pattern_count'] * 3 +
            features['has_implementation_words'] * 2 +
            features['has_question_words'] * 1
        )
        
        mixed_score = features['mixed_keyword_count'] * 1.5
        
        # Normalize scores
        total_score = schema_score + doc_score + mixed_score
        if total_score == 0:
            return QueryType.UNKNOWN, 0.0
        
        schema_confidence = schema_score / total_score
        doc_confidence = doc_score / total_score
        mixed_confidence = mixed_score / total_score
        
        # Decision logic
        max_confidence = max(schema_confidence, doc_confidence, mixed_confidence)
        
        if max_confidence < 0.3:
            return QueryType.UNKNOWN, max_confidence
        
        # If mixed indicators are strong or scores are close, classify as MIXED
        if (mixed_confidence > 0.3 or 
            abs(schema_confidence - doc_confidence) < 0.2 and max_confidence > 0.4):
            return QueryType.MIXED, max_confidence
        
        if schema_confidence > doc_confidence:
            return QueryType.SCHEMA, schema_confidence
        else:
            return QueryType.DOCUMENTATION, doc_confidence

    def should_query_schema_agent(self, query_type: QueryType) -> bool:
        """Determine if schema agent should be queried."""
        return query_type in [QueryType.SCHEMA, QueryType.MIXED, QueryType.UNKNOWN]

    def should_query_doc_agent(self, query_type: QueryType) -> bool:
        """Determine if document agent should be queried."""
        return query_type in [QueryType.DOCUMENTATION, QueryType.MIXED, QueryType.UNKNOWN]

    def get_routing_strategy(self, query: str) -> Dict[str, any]:
        """Get complete routing strategy for a query."""
        query_type, confidence = self.classify_query(query)
        
        return {
            'query_type': query_type.value,
            'confidence': confidence,
            'query_schema_agent': self.should_query_schema_agent(query_type),
            'query_doc_agent': self.should_query_doc_agent(query_type),
            'features': self.extract_features(query)
        }

if __name__ == "__main__":
    # Test the classifier
    classifier = QueryClassifier()
    
    test_queries = [
        "What is the type of the ping field?",
        "How do I create a card product?",
        "What mutations do I need to create an account holder?",
        "How do I integrate the Highnote API?",
        "What are the steps to setup authentication?",
        "Show me the FinancialAccount type definition",
        "How do I use the createCardProduct mutation in my application?"
    ]
    
    for query in test_queries:
        strategy = classifier.get_routing_strategy(query)
        print(f"\nQuery: {query}")
        print(f"Type: {strategy['query_type']} (confidence: {strategy['confidence']:.2f})")
        print(f"Route to - Schema: {strategy['query_schema_agent']}, Docs: {strategy['query_doc_agent']}")