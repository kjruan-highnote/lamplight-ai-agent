"""
Flexible context management system for Ship agent
"""
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path
import hashlib

logger = logging.getLogger(__name__)


class FlexibleContext:
    """
    Schema-less context storage that adapts to any data structure
    """
    
    def __init__(self, storage_path: str = "data/contexts"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        
        self.metadata = {
            'dimensions': {},      # Any categorization
            'sources': {},         # Any data source
            'patterns': {},        # Any pattern type
            'rules': {},          # Any business rule
            'relationships': {},   # Any relationship between entities
            'examples': {},       # Example data
            'corrections': []     # Learning history
        }
        
        self.active_context = {}
        self.context_history = []
        
    def add_dimension(self, name: str, attributes: Dict[str, Any]):
        """
        Add any new dimension dynamically
        Examples: customer, program_type, region, product_line, etc.
        """
        self.metadata['dimensions'][name] = {
            'attributes': attributes,
            'created_at': datetime.now().isoformat(),
            'values': attributes.get('values', []),
            'relationships': attributes.get('relationships', {})
        }
        logger.info(f"Added dimension: {name}")
        
    def add_source(self, source_type: str, source_data: Dict[str, Any]):
        """
        Register any data source
        Examples: postman, confluence, mongodb, postgresql, s3, etc.
        """
        source_id = self._generate_id(source_type, source_data)
        self.metadata['sources'][source_id] = {
            'type': source_type,
            'data': source_data,
            'ingested_at': datetime.now().isoformat(),
            'patterns_extracted': False
        }
        logger.info(f"Added source: {source_type} ({source_id})")
        return source_id
    
    def add_pattern(self, pattern_type: str, pattern_data: Dict[str, Any], 
                   source_id: Optional[str] = None):
        """
        Add any type of pattern
        """
        pattern_id = self._generate_id(pattern_type, pattern_data)
        self.metadata['patterns'][pattern_id] = {
            'type': pattern_type,
            'data': pattern_data,
            'source': source_id,
            'created_at': datetime.now().isoformat(),
            'usage_count': 0
        }
        logger.info(f"Added pattern: {pattern_type} ({pattern_id})")
        return pattern_id
    
    def add_rule(self, rule_type: str, rule_data: Dict[str, Any],
                applies_to: Optional[List[str]] = None):
        """
        Add business rules
        """
        rule_id = self._generate_id(rule_type, rule_data)
        self.metadata['rules'][rule_id] = {
            'type': rule_type,
            'data': rule_data,
            'applies_to': applies_to or [],
            'created_at': datetime.now().isoformat(),
            'priority': rule_data.get('priority', 0)
        }
        logger.info(f"Added rule: {rule_type} ({rule_id})")
        return rule_id
    
    def add_relationship(self, from_entity: str, to_entity: str, 
                        relationship_type: str, metadata: Optional[Dict[str, Any]] = None):
        """
        Add relationships between any entities
        """
        rel_id = f"{from_entity}_{relationship_type}_{to_entity}"
        self.metadata['relationships'][rel_id] = {
            'from': from_entity,
            'to': to_entity,
            'type': relationship_type,
            'metadata': metadata or {},
            'created_at': datetime.now().isoformat()
        }
        logger.info(f"Added relationship: {rel_id}")
        return rel_id
    
    def add_example(self, example_type: str, example_data: Any,
                   context: Optional[Dict[str, Any]] = None):
        """
        Add example data for learning
        """
        example_id = self._generate_id(example_type, str(example_data))
        self.metadata['examples'][example_id] = {
            'type': example_type,
            'data': example_data,
            'context': context or {},
            'created_at': datetime.now().isoformat()
        }
        logger.info(f"Added example: {example_type} ({example_id})")
        return example_id
    
    def add_correction(self, original: Any, corrected: Any, 
                      reason: str, context: Optional[Dict[str, Any]] = None):
        """
        Add corrections for learning
        """
        correction = {
            'original': original,
            'corrected': corrected,
            'reason': reason,
            'context': context or {},
            'timestamp': datetime.now().isoformat()
        }
        self.metadata['corrections'].append(correction)
        logger.info(f"Added correction: {reason}")
        
    def query(self, query_type: str, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Query the context with flexible filters
        """
        results = []
        
        if query_type in self.metadata:
            data = self.metadata[query_type]
            
            if isinstance(data, dict):
                for key, value in data.items():
                    if self._matches_filters(value, filters):
                        results.append({'id': key, **value})
            elif isinstance(data, list):
                for item in data:
                    if self._matches_filters(item, filters):
                        results.append(item)
        
        return results
    
    def get_context_for(self, dimensions: Dict[str, str]) -> Dict[str, Any]:
        """
        Get relevant context for specific dimensions
        Example: {'customer': 'BankX', 'program_type': 'commercial_credit'}
        """
        context = {
            'dimensions': dimensions,
            'patterns': [],
            'rules': [],
            'examples': []
        }
        
        # Find relevant patterns
        for pattern_id, pattern in self.metadata['patterns'].items():
            if self._is_relevant(pattern, dimensions):
                context['patterns'].append(pattern)
        
        # Find relevant rules
        for rule_id, rule in self.metadata['rules'].items():
            if self._is_relevant(rule, dimensions):
                context['rules'].append(rule)
        
        # Find relevant examples
        for example_id, example in self.metadata['examples'].items():
            if self._is_relevant(example, dimensions):
                context['examples'].append(example)
        
        self.active_context = context
        return context
    
    def save_context(self, name: str):
        """Save current context to file"""
        file_path = self.storage_path / f"{name}.json"
        with open(file_path, 'w') as f:
            json.dump(self.metadata, f, indent=2, default=str)
        logger.info(f"Saved context to {file_path}")
        
    def load_context(self, name: str):
        """Load context from file"""
        file_path = self.storage_path / f"{name}.json"
        if file_path.exists():
            with open(file_path, 'r') as f:
                self.metadata = json.load(f)
            logger.info(f"Loaded context from {file_path}")
            return True
        return False
    
    def merge_context(self, other_context: Dict[str, Any]):
        """Merge another context into this one"""
        for key, value in other_context.items():
            if key in self.metadata:
                if isinstance(self.metadata[key], dict) and isinstance(value, dict):
                    self.metadata[key].update(value)
                elif isinstance(self.metadata[key], list) and isinstance(value, list):
                    self.metadata[key].extend(value)
                else:
                    self.metadata[key] = value
            else:
                self.metadata[key] = value
        logger.info("Merged context")
        
    def get_statistics(self) -> Dict[str, Any]:
        """Get statistics about the context"""
        stats = {}
        for key, value in self.metadata.items():
            if isinstance(value, dict):
                stats[key] = len(value)
            elif isinstance(value, list):
                stats[key] = len(value)
            else:
                stats[key] = 1
        return stats
    
    def _generate_id(self, type_str: str, data: Any) -> str:
        """Generate unique ID for any data"""
        content = f"{type_str}_{str(data)}_{datetime.now().isoformat()}"
        return hashlib.md5(content.encode()).hexdigest()[:12]
    
    def _matches_filters(self, item: Dict[str, Any], filters: Optional[Dict[str, Any]]) -> bool:
        """Check if item matches filters"""
        if not filters:
            return True
            
        for key, value in filters.items():
            if key not in item:
                return False
            if isinstance(value, list):
                if item[key] not in value:
                    return False
            elif item[key] != value:
                return False
        return True
    
    def _is_relevant(self, item: Dict[str, Any], dimensions: Dict[str, str]) -> bool:
        """Check if item is relevant to given dimensions"""
        # Check if item has applies_to field
        if 'applies_to' in item:
            for dimension_key, dimension_value in dimensions.items():
                if dimension_value in item['applies_to']:
                    return True
                    
        # Check if item has context field
        if 'context' in item:
            for key, value in dimensions.items():
                if key in item['context'] and item['context'][key] == value:
                    return True
                    
        # Check in item data
        if 'data' in item and isinstance(item['data'], dict):
            for key, value in dimensions.items():
                if key in item['data'] and item['data'][key] == value:
                    return True
                    
        return False


class ContextAggregator:
    """
    Aggregates context from multiple sources
    """
    
    def __init__(self):
        self.contexts = {}
        self.aggregated_context = FlexibleContext()
        
    def add_context(self, name: str, context: FlexibleContext):
        """Add a named context"""
        self.contexts[name] = context
        
    def aggregate(self, merge_strategy: str = "union") -> FlexibleContext:
        """
        Aggregate all contexts based on strategy
        Strategies: union, intersection, priority
        """
        if merge_strategy == "union":
            for name, context in self.contexts.items():
                self.aggregated_context.merge_context(context.metadata)
        elif merge_strategy == "intersection":
            # Implement intersection logic
            pass
        elif merge_strategy == "priority":
            # Implement priority-based merging
            pass
            
        return self.aggregated_context
    
    def get_context_by_source(self, source_type: str) -> FlexibleContext:
        """Get context from specific source type"""
        result = FlexibleContext()
        
        for name, context in self.contexts.items():
            for source_id, source_data in context.metadata['sources'].items():
                if source_data['type'] == source_type:
                    # Copy relevant data
                    result.metadata['sources'][source_id] = source_data
                    
        return result