#!/usr/bin/env python3
"""
Dynamic pattern generator that analyzes the GraphQL schema and creates
comprehensive question patterns for query expansion.
"""

import json
import re
import logging
from pathlib import Path
from typing import Dict, Set, List, Tuple
from collections import defaultdict, Counter
from dataclasses import dataclass


@dataclass
class QuestionPattern:
    """A question pattern with expansion terms."""
    trigger_words: List[str]
    expansion_terms: List[str]
    context: str
    confidence: float = 1.0


class PatternGenerator:
    """Generates question patterns by analyzing GraphQL schema."""
    
    def __init__(self, metadata_path: str = "embeddings/metadata.json"):
        self.metadata_path = Path(metadata_path)
        self.logger = logging.getLogger(__name__)
        
        # GraphQL parsing patterns
        self.graphql_patterns = {
            'type': re.compile(r'type\s+(\w+)', re.IGNORECASE),
            'input': re.compile(r'input\s+(\w+)', re.IGNORECASE),
            'enum': re.compile(r'enum\s+(\w+)', re.IGNORECASE),
            'mutation': re.compile(r'(\w+)\s*\([^)]*\)\s*:\s*(\w+)', re.MULTILINE),
            'field': re.compile(r'^\s*(\w+)\s*:\s*([A-Z][\w\[\]!]*)', re.MULTILINE),
            'validation': re.compile(r'validation.*?regex.*?pattern\s*[`"\']([^`"\']+)[`"\']', re.IGNORECASE | re.DOTALL),
            'comment': re.compile(r'"""([^"]*?)"""', re.DOTALL)
        }
    
    def analyze_schema_vocabulary(self) -> Dict[str, Set[str]]:
        """Analyze schema to extract vocabulary by category."""
        if not self.metadata_path.exists():
            return {}
        
        with open(self.metadata_path, 'r') as f:
            metadata = json.load(f)
        
        vocabulary = {
            'types': set(),
            'inputs': set(),
            'enums': set(),
            'mutations': set(),
            'fields': set(),
            'validation_fields': set(),
            'business_concepts': set(),
            'operations': set(),
            'entities': set()
        }
        
        # Process schema files
        for i, path in enumerate(metadata['paths']):
            if i % 500 == 0:
                self.logger.info(f"Analyzing {i}/{len(metadata['paths'])} files for patterns")
            
            try:
                content = self._read_file(path)
                if content:
                    self._extract_vocabulary(content, vocabulary)
            except Exception as e:
                self.logger.debug(f"Error processing {path}: {e}")
        
        self.logger.info(f"Extracted vocabulary: types={len(vocabulary['types'])}, "
                        f"inputs={len(vocabulary['inputs'])}, fields={len(vocabulary['fields'])}")
        
        return vocabulary
    
    def _read_file(self, path: str) -> str:
        """Read file content safely."""
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception:
            return ""
    
    def _extract_vocabulary(self, content: str, vocabulary: Dict[str, Set[str]]):
        """Extract vocabulary from GraphQL content."""
        # Extract basic GraphQL elements
        for pattern_name, pattern in self.graphql_patterns.items():
            matches = pattern.findall(content)
            
            if pattern_name == 'type':
                vocabulary['types'].update(matches)
                # Extract business concepts from type names
                for match in matches:
                    concepts = self._extract_business_concepts(match)
                    vocabulary['business_concepts'].update(concepts)
                    vocabulary['entities'].update(concepts)
                    
            elif pattern_name == 'input':
                vocabulary['inputs'].update(matches)
                # Extract operations from input names
                for match in matches:
                    operations = self._extract_operations(match)
                    vocabulary['operations'].update(operations)
                    
            elif pattern_name == 'enum':
                vocabulary['enums'].update(matches)
                
            elif pattern_name == 'mutation':
                for name, return_type in matches:
                    vocabulary['mutations'].add(name)
                    operations = self._extract_operations(name)
                    vocabulary['operations'].update(operations)
                    
            elif pattern_name == 'field':
                for field_name, field_type in matches:
                    vocabulary['fields'].add(field_name)
                    
            elif pattern_name == 'validation':
                # Find fields with validation patterns
                lines = content.split('\n')
                for pattern_match in matches:
                    field_context = self._find_field_context(content, pattern_match)
                    vocabulary['validation_fields'].update(field_context)
    
    def _extract_business_concepts(self, name: str) -> List[str]:
        """Extract business concepts from type/field names."""
        concepts = []
        name_lower = name.lower()
        
        # Common business entities
        business_terms = [
            'account', 'holder', 'user', 'person', 'business', 'company',
            'payment', 'card', 'transaction', 'financial', 'bank',
            'address', 'billing', 'shipping', 'contact', 'identity',
            'application', 'verification', 'authorization', 'authentication',
            'profile', 'product', 'service', 'feature', 'rule', 'policy',
            'limit', 'balance', 'amount', 'currency', 'merchant', 'vendor'
        ]
        
        for term in business_terms:
            if term in name_lower:
                concepts.append(term)
        
        # Extract compound words (camelCase)
        words = re.findall(r'[A-Z][a-z]+', name)
        concepts.extend([word.lower() for word in words if len(word) > 2])
        
        return concepts
    
    def _extract_operations(self, name: str) -> List[str]:
        """Extract operations from mutation/input names."""
        operations = []
        name_lower = name.lower()
        
        # Common GraphQL operations
        operation_patterns = [
            ('create', ['create', 'add', 'new', 'register', 'establish']),
            ('update', ['update', 'modify', 'change', 'edit', 'revise']),
            ('delete', ['delete', 'remove', 'cancel', 'terminate', 'suspend']),
            ('get', ['get', 'fetch', 'retrieve', 'find', 'lookup']),
            ('list', ['list', 'search', 'query', 'browse', 'enumerate']),
            ('issue', ['issue', 'generate', 'produce', 'emit']),
            ('validate', ['validate', 'verify', 'check', 'confirm', 'authenticate']),
            ('assign', ['assign', 'attach', 'link', 'connect', 'associate']),
            ('simulate', ['simulate', 'test', 'mock', 'preview'])
        ]
        
        for base_op, variants in operation_patterns:
            if base_op in name_lower:
                operations.extend(variants)
                break
        
        return operations
    
    def _find_field_context(self, content: str, validation_pattern: str) -> List[str]:
        """Find field names associated with validation patterns."""
        fields = []
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            if validation_pattern in line:
                # Look for field definitions in nearby lines
                for j in range(max(0, i-10), min(len(lines), i+10)):
                    field_match = re.search(r'(\w+)\s*:\s*String', lines[j])
                    if field_match:
                        fields.append(field_match.group(1))
        
        return fields
    
    def generate_patterns(self) -> List[QuestionPattern]:
        """Generate comprehensive question patterns based on schema analysis."""
        vocabulary = self.analyze_schema_vocabulary()
        patterns = []
        
        # 1. Basic question types
        patterns.extend(self._generate_basic_patterns())
        
        # 2. Validation patterns
        patterns.extend(self._generate_validation_patterns(vocabulary))
        
        # 3. Entity-based patterns
        patterns.extend(self._generate_entity_patterns(vocabulary))
        
        # 4. Operation patterns
        patterns.extend(self._generate_operation_patterns(vocabulary))
        
        # 5. Field inquiry patterns
        patterns.extend(self._generate_field_patterns(vocabulary))
        
        # 6. Schema exploration patterns
        patterns.extend(self._generate_exploration_patterns(vocabulary))
        
        self.logger.info(f"Generated {len(patterns)} question patterns")
        return patterns
    
    def _generate_basic_patterns(self) -> List[QuestionPattern]:
        """Generate basic question type patterns."""
        return [
            QuestionPattern(
                trigger_words=['what', 'what\'s'],
                expansion_terms=['type', 'field', 'definition', 'description'],
                context='basic_inquiry'
            ),
            QuestionPattern(
                trigger_words=['how', 'how to', 'how do i', 'how can i'],
                expansion_terms=['mutation', 'query', 'example', 'procedure', 'method'],
                context='procedural'
            ),
            QuestionPattern(
                trigger_words=['which', 'what are the'],
                expansion_terms=['options', 'choices', 'available', 'list', 'enum'],
                context='options'
            ),
            QuestionPattern(
                trigger_words=['can i', 'is it possible', 'able to'],
                expansion_terms=['mutation', 'capability', 'feature', 'permission'],
                context='capability'
            ),
            QuestionPattern(
                trigger_words=['where', 'where is', 'where can i find'],
                expansion_terms=['location', 'path', 'reference', 'definition'],
                context='location'
            )
        ]
    
    def _generate_validation_patterns(self, vocabulary: Dict[str, Set[str]]) -> List[QuestionPattern]:
        """Generate validation-related patterns."""
        patterns = []
        
        # Validation inquiry patterns
        validation_triggers = [
            'validation', 'validations', 'validate', 'verify', 'check',
            'constraint', 'constraints', 'requirement', 'requirements',
            'rule', 'rules', 'restriction', 'restrictions',
            'format', 'pattern', 'regex', 'allowed', 'permitted'
        ]
        
        for trigger in validation_triggers:
            patterns.append(QuestionPattern(
                trigger_words=[trigger],
                expansion_terms=['regex', 'pattern', 'input', 'validation', 'addressinput'] +
                               list(vocabulary.get('validation_fields', set())),
                context='validation',
                confidence=0.9
            ))
        
        # Field-specific validation patterns
        for field in vocabulary.get('validation_fields', set()):
            patterns.append(QuestionPattern(
                trigger_words=[field, f'{field} validation', f'{field} format'],
                expansion_terms=['regex', 'pattern', 'validation', 'input', field],
                context=f'field_validation_{field}',
                confidence=0.95
            ))
        
        return patterns
    
    def _generate_entity_patterns(self, vocabulary: Dict[str, Set[str]]) -> List[QuestionPattern]:
        """Generate entity-based patterns."""
        patterns = []
        
        for entity in vocabulary.get('business_concepts', set()):
            if len(entity) > 2:  # Skip very short terms
                # Entity inquiry patterns
                patterns.append(QuestionPattern(
                    trigger_words=[entity, f'{entity}s'],
                    expansion_terms=[entity, f'{entity}input', f'create{entity}', f'update{entity}'] +
                                   [t for t in vocabulary.get('types', set()) 
                                    if entity.lower() in t.lower()],
                    context=f'entity_{entity}',
                    confidence=0.8
                ))
        
        return patterns
    
    def _generate_operation_patterns(self, vocabulary: Dict[str, Set[str]]) -> List[QuestionPattern]:
        """Generate operation-based patterns."""
        patterns = []
        
        for operation in vocabulary.get('operations', set()):
            if len(operation) > 2:
                # Operation patterns
                patterns.append(QuestionPattern(
                    trigger_words=[operation, f'{operation}ing', f'{operation}d'],
                    expansion_terms=[operation, 'mutation', 'input'] +
                                   [m for m in vocabulary.get('mutations', set())
                                    if operation.lower() in m.lower()],
                    context=f'operation_{operation}',
                    confidence=0.85
                ))
        
        return patterns
    
    def _generate_field_patterns(self, vocabulary: Dict[str, Set[str]]) -> List[QuestionPattern]:
        """Generate field inquiry patterns."""
        patterns = []
        
        # Common field inquiry terms
        field_triggers = ['field', 'fields', 'property', 'properties', 'attribute', 'attributes']
        
        for trigger in field_triggers:
            patterns.append(QuestionPattern(
                trigger_words=[trigger],
                expansion_terms=['type', 'field', 'property'] + list(vocabulary.get('fields', set()))[:20],
                context='field_inquiry',
                confidence=0.7
            ))
        
        return patterns
    
    def _generate_exploration_patterns(self, vocabulary: Dict[str, Set[str]]) -> List[QuestionPattern]:
        """Generate schema exploration patterns."""
        return [
            QuestionPattern(
                trigger_words=['available', 'existing', 'all'],
                expansion_terms=['query', 'mutation', 'type', 'list', 'available'],
                context='exploration'
            ),
            QuestionPattern(
                trigger_words=['list', 'show', 'display'],
                expansion_terms=['list', 'query', 'type', 'available', 'enum'],
                context='listing'
            ),
            QuestionPattern(
                trigger_words=['type', 'types'],
                expansion_terms=['type', 'definition', 'structure', 'field'],
                context='type_inquiry'
            ),
            QuestionPattern(
                trigger_words=['input', 'inputs'], 
                expansion_terms=['input', 'mutation', 'create', 'update'],
                context='input_inquiry'
            )
        ]
    
    def save_patterns(self, patterns: List[QuestionPattern], output_path: str = "question_patterns.json"):
        """Save patterns to JSON file."""
        pattern_data = []
        for pattern in patterns:
            pattern_data.append({
                'trigger_words': pattern.trigger_words,
                'expansion_terms': pattern.expansion_terms,
                'context': pattern.context,
                'confidence': pattern.confidence
            })
        
        output_file = Path(output_path)
        with open(output_file, 'w') as f:
            json.dump(pattern_data, f, indent=2)
        
        self.logger.info(f"Saved {len(patterns)} patterns to {output_file}")
        return output_file
    
    @staticmethod
    def load_patterns(pattern_path: str = "question_patterns.json") -> List[QuestionPattern]:
        """Load patterns from JSON file."""
        pattern_file = Path(pattern_path)
        if not pattern_file.exists():
            return []
        
        with open(pattern_file, 'r') as f:
            pattern_data = json.load(f)
        
        patterns = []
        for item in pattern_data:
            patterns.append(QuestionPattern(
                trigger_words=item['trigger_words'],
                expansion_terms=item['expansion_terms'],
                context=item['context'],
                confidence=item.get('confidence', 1.0)
            ))
        
        return patterns


if __name__ == "__main__":
    # Generate patterns
    logging.basicConfig(level=logging.INFO)
    
    generator = PatternGenerator()
    patterns = generator.generate_patterns()
    
    output_file = generator.save_patterns(patterns)
    print(f"Generated patterns saved to: {output_file}")
    
    # Show some examples
    print(f"\nExample patterns:")
    for i, pattern in enumerate(patterns[:10]):
        print(f"{i+1}. {pattern.context}: {pattern.trigger_words} -> {pattern.expansion_terms[:5]}")