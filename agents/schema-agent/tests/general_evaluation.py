#!/usr/bin/env python3
"""
General evaluation framework that dynamically generates test cases
from schema analysis without hardcoding specific queries.
"""

import json
import logging
import re
from pathlib import Path
from typing import List, Dict, Tuple, Any, Set
from dataclasses import dataclass
from collections import defaultdict, Counter
import random


@dataclass
class GeneralTestCase:
    """A general test case generated from schema analysis."""
    question: str
    query_type: str  # field_lookup, type_discovery, validation_inquiry, etc.
    target_concepts: List[str]  # General concepts that should be found
    difficulty: str
    success_criteria: Dict[str, Any]  # Flexible success criteria


class GeneralEvaluationFramework:
    """General evaluation framework based on schema patterns."""
    
    def __init__(self, metadata_path: str = "embeddings/metadata.json"):
        self.metadata_path = Path(metadata_path)
        self.logger = logging.getLogger(__name__)
        
        # Schema vocabulary extracted from files
        self.schema_vocabulary = self._extract_schema_vocabulary()
        
    def _extract_schema_vocabulary(self) -> Dict[str, Any]:
        """Extract vocabulary from schema files for test generation."""
        if not self.metadata_path.exists():
            return {}
        
        with open(self.metadata_path, 'r') as f:
            metadata = json.load(f)
        
        vocabulary = {
            'input_types': set(),
            'object_types': set(), 
            'enum_types': set(),
            'mutation_names': set(),
            'common_fields': Counter(),
            'business_entities': set(),
            'technical_concepts': set()
        }
        
        # Analyze file names to extract vocabulary
        for path in metadata['paths']:
            filename = Path(path).stem
            parts = filename.split('_', 2)
            
            if len(parts) >= 3:
                category = parts[1]
                name = parts[2]
                
                if category == 'inputs':
                    vocabulary['input_types'].add(name)
                elif category == 'objects':
                    vocabulary['object_types'].add(name)
                elif category == 'enums':
                    vocabulary['enum_types'].add(name)
                elif category == 'mutations':
                    vocabulary['mutation_names'].add(name)
                
                # Extract business concepts
                business_terms = self._extract_business_terms(name)
                vocabulary['business_entities'].update(business_terms)
        
        # Sample some files to extract field patterns
        sample_files = random.sample(metadata['paths'], min(100, len(metadata['paths'])))
        for path in sample_files:
            try:
                with open(path, 'r') as f:
                    content = f.read()
                self._extract_fields_from_content(content, vocabulary)
            except:
                continue
        
        return vocabulary
    
    def _extract_business_terms(self, name: str) -> Set[str]:
        """Extract business terms from type/field names."""
        terms = set()
        name_lower = name.lower()
        
        # Common business concepts (not hardcoded to specific domain)
        common_patterns = [
            'account', 'user', 'profile', 'business', 'person', 'company',
            'payment', 'transaction', 'order', 'product', 'service',
            'address', 'contact', 'identity', 'verification', 'validation',
            'application', 'request', 'response', 'result', 'status',
            'configuration', 'setting', 'rule', 'policy', 'limit'
        ]
        
        for pattern in common_patterns:
            if pattern in name_lower:
                terms.add(pattern)
        
        return terms
    
    def _extract_fields_from_content(self, content: str, vocabulary: Dict):
        """Extract field patterns from GraphQL content."""
        # Find field definitions
        field_pattern = re.compile(r'^\s*(\w+)\s*:\s*([A-Z][\w\[\]!]*)', re.MULTILINE)
        matches = field_pattern.findall(content)
        
        for field_name, field_type in matches:
            vocabulary['common_fields'][field_name] += 1
            
        # Find technical concepts
        if 'validation' in content.lower() or 'regex' in content.lower():
            vocabulary['technical_concepts'].add('validation')
        if 'mutation' in content.lower():
            vocabulary['technical_concepts'].add('mutation')
        if 'query' in content.lower():
            vocabulary['technical_concepts'].add('query')
    
    def generate_comprehensive_test_cases(self) -> List[GeneralTestCase]:
        """Generate comprehensive test cases from schema analysis."""
        test_cases = []
        
        # Generate different categories of tests
        test_cases.extend(self._generate_field_discovery_tests())
        test_cases.extend(self._generate_type_exploration_tests())
        test_cases.extend(self._generate_concept_inquiry_tests())
        test_cases.extend(self._generate_relationship_tests())
        test_cases.extend(self._generate_operation_tests())
        test_cases.extend(self._generate_search_quality_tests())
        
        return test_cases
    
    def _generate_field_discovery_tests(self) -> List[GeneralTestCase]:
        """Generate tests for field discovery capabilities."""
        tests = []
        
        # Use common fields from schema
        common_fields = [field for field, count in self.schema_vocabulary['common_fields'].most_common(10)]
        
        for field in common_fields[:5]:  # Test top 5 most common fields
            tests.append(GeneralTestCase(
                question=f"What types contain the {field} field?",
                query_type="field_discovery",
                target_concepts=[field, "type", "field"],
                difficulty="medium",
                success_criteria={
                    "content_should_contain": [field],
                    "result_diversity": True,  # Should find multiple types
                    "min_results": 2
                }
            ))
            
            tests.append(GeneralTestCase(
                question=f"What is the type of {field}?",
                query_type="field_type_inquiry",
                target_concepts=[field, "type"],
                difficulty="easy",
                success_criteria={
                    "content_should_contain": [field, ":"],
                    "min_results": 1
                }
            ))
        
        return tests
    
    def _generate_type_exploration_tests(self) -> List[GeneralTestCase]:
        """Generate tests for type exploration."""
        tests = []
        
        # Sample different types
        input_types = list(self.schema_vocabulary['input_types'])[:5]
        object_types = list(self.schema_vocabulary['object_types'])[:5]
        
        for input_type in input_types:
            tests.append(GeneralTestCase(
                question=f"What fields are in {input_type}?",
                query_type="type_structure_inquiry",
                target_concepts=[input_type, "input", "field"],
                difficulty="easy",
                success_criteria={
                    "filename_should_contain": [input_type.lower()],
                    "content_should_contain": ["input", input_type],
                    "min_results": 1
                }
            ))
        
        for obj_type in object_types:
            tests.append(GeneralTestCase(
                question=f"Show me the {obj_type} type definition",
                query_type="type_definition_lookup",
                target_concepts=[obj_type, "type"],
                difficulty="easy", 
                success_criteria={
                    "filename_should_contain": [obj_type.lower()],
                    "content_should_contain": ["type", obj_type],
                    "min_results": 1
                }
            ))
        
        return tests
    
    def _generate_concept_inquiry_tests(self) -> List[GeneralTestCase]:
        """Generate tests for business concept understanding."""
        tests = []
        
        business_entities = list(self.schema_vocabulary['business_entities'])[:8]
        
        for entity in business_entities:
            tests.append(GeneralTestCase(
                question=f"What types are related to {entity}?",
                query_type="concept_exploration",
                target_concepts=[entity],
                difficulty="medium",
                success_criteria={
                    "content_should_contain": [entity],
                    "result_diversity": True,
                    "min_results": 2
                }
            ))
            
            tests.append(GeneralTestCase(
                question=f"How do I work with {entity} data?",
                query_type="concept_usage_inquiry",
                target_concepts=[entity, "mutation", "query"],
                difficulty="hard",
                success_criteria={
                    "content_should_contain": [entity],
                    "should_find_operations": True,
                    "min_results": 1
                }
            ))
        
        return tests
    
    def _generate_relationship_tests(self) -> List[GeneralTestCase]:
        """Generate tests for understanding type relationships."""
        tests = []
        
        # Test generic relationship understanding
        tests.append(GeneralTestCase(
            question="What input types are available?",
            query_type="category_listing",
            target_concepts=["input", "type"],
            difficulty="medium",
            success_criteria={
                "result_diversity": True,
                "content_should_contain": ["input"],
                "min_results": 5
            }
        ))
        
        tests.append(GeneralTestCase(
            question="What enum types exist in the schema?",
            query_type="category_listing", 
            target_concepts=["enum"],
            difficulty="medium",
            success_criteria={
                "result_diversity": True,
                "content_should_contain": ["enum"],
                "min_results": 3
            }
        ))
        
        return tests
    
    def _generate_operation_tests(self) -> List[GeneralTestCase]:
        """Generate tests for operation discovery."""
        tests = []
        
        mutation_samples = list(self.schema_vocabulary['mutation_names'])[:5]
        
        for mutation in mutation_samples:
            tests.append(GeneralTestCase(
                question=f"How do I use the {mutation} operation?",
                query_type="operation_usage",
                target_concepts=[mutation, "mutation"],
                difficulty="medium",
                success_criteria={
                    "filename_should_contain": [mutation.lower()],
                    "content_should_contain": [mutation],
                    "min_results": 1
                }
            ))
        
        # Generic operation discovery
        tests.append(GeneralTestCase(
            question="What mutations are available for creating data?",
            query_type="operation_discovery",
            target_concepts=["create", "mutation"],
            difficulty="hard",
            success_criteria={
                "content_should_contain": ["create", "mutation"],
                "result_diversity": True,
                "min_results": 3
            }
        ))
        
        return tests
    
    def _generate_search_quality_tests(self) -> List[GeneralTestCase]:
        """Generate tests to evaluate search quality."""
        tests = []
        
        # Test handling of different query styles
        common_fields = list(self.schema_vocabulary['common_fields'].keys())[:5]
        
        for field in common_fields:
            # Formal query
            tests.append(GeneralTestCase(
                question=f"What is the definition of the {field} field?",
                query_type="formal_field_inquiry",
                target_concepts=[field],
                difficulty="easy",
                success_criteria={
                    "content_should_contain": [field],
                    "min_results": 1
                }
            ))
            
            # Informal query
            tests.append(GeneralTestCase(
                question=f"{field} field info",  # Short, informal
                query_type="informal_field_inquiry", 
                target_concepts=[field],
                difficulty="medium",
                success_criteria={
                    "content_should_contain": [field],
                    "min_results": 1
                }
            ))
        
        return tests
    
    def evaluate_retrieval_system(self, retriever) -> Dict[str, Any]:
        """Evaluate retrieval system with generated test cases."""
        test_cases = self.generate_comprehensive_test_cases()
        
        results = {
            "total_cases": len(test_cases),
            "passed": 0,
            "failed": 0,
            "by_query_type": defaultdict(lambda: {"passed": 0, "failed": 0, "total": 0}),
            "by_difficulty": defaultdict(lambda: {"passed": 0, "failed": 0, "total": 0}),
            "detailed_results": []
        }
        
        for case in test_cases:
            result = self._evaluate_single_case(retriever, case)
            results["detailed_results"].append(result)
            
            # Update counters
            if result["passed"]:
                results["passed"] += 1
            else:
                results["failed"] += 1
            
            # By query type
            qt = case.query_type
            results["by_query_type"][qt]["total"] += 1
            if result["passed"]:
                results["by_query_type"][qt]["passed"] += 1
            else:
                results["by_query_type"][qt]["failed"] += 1
            
            # By difficulty
            diff = case.difficulty
            results["by_difficulty"][diff]["total"] += 1
            if result["passed"]:
                results["by_difficulty"][diff]["passed"] += 1
            else:
                results["by_difficulty"][diff]["failed"] += 1
        
        return results
    
    def _evaluate_single_case(self, retriever, case: GeneralTestCase) -> Dict[str, Any]:
        """Evaluate a single test case with flexible criteria."""
        try:
            # Get retrieval results
            results = retriever.retrieve_chunks(case.question, top_k=10)
            result_files = [Path(r[0]).name for r in results]
            result_content = " ".join([r[1] for r in results]).lower()
            
            # Evaluate based on success criteria
            score_components = []
            
            criteria = case.success_criteria
            
            # Check content requirements
            if "content_should_contain" in criteria:
                content_matches = []
                for term in criteria["content_should_contain"]:
                    found = term.lower() in result_content
                    content_matches.append(found)
                content_score = sum(content_matches) / len(content_matches) if content_matches else 0
                score_components.append(("content", content_score))
            
            # Check filename requirements
            if "filename_should_contain" in criteria:
                filename_matches = []
                for term in criteria["filename_should_contain"]:
                    found = any(term in rf.lower() for rf in result_files)
                    filename_matches.append(found)
                filename_score = sum(filename_matches) / len(filename_matches) if filename_matches else 0
                score_components.append(("filename", filename_score))
            
            # Check minimum results
            if "min_results" in criteria:
                min_results = criteria["min_results"]
                has_min_results = len(results) >= min_results
                score_components.append(("min_results", 1.0 if has_min_results else 0.0))
            
            # Check result diversity
            if criteria.get("result_diversity", False):
                unique_concepts = len(set(case.target_concepts) & set(result_content.split()))
                diversity_score = min(unique_concepts / len(case.target_concepts), 1.0) if case.target_concepts else 1.0
                score_components.append(("diversity", diversity_score))
            
            # Calculate overall score
            if score_components:
                overall_score = sum(score for _, score in score_components) / len(score_components)
            else:
                overall_score = 0.0
            
            # Pass threshold
            passed = overall_score >= 0.6  # 60% threshold
            
            return {
                "question": case.question,
                "query_type": case.query_type,
                "difficulty": case.difficulty,
                "passed": passed,
                "overall_score": overall_score,
                "score_components": dict(score_components),
                "target_concepts": case.target_concepts,
                "found_files": result_files[:3],  # Top 3 results
                "results_count": len(results)
            }
            
        except Exception as e:
            return {
                "question": case.question,
                "query_type": case.query_type,
                "difficulty": case.difficulty,
                "passed": False,
                "error": str(e),
                "overall_score": 0.0
            }
    
    def print_evaluation_summary(self, results: Dict[str, Any]):
        """Print evaluation summary."""
        print("\n" + "="*70)
        print("GENERAL RAG SYSTEM EVALUATION")
        print("="*70)
        
        # Overall performance
        total = results["total_cases"]
        passed = results["passed"]
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print(f"\nOVERALL PERFORMANCE:")
        print(f"  Cases: {passed}/{total} ({success_rate:.1f}%)")
        
        # By query type
        print(f"\nPERFORMANCE BY QUERY TYPE:")
        for query_type, stats in results["by_query_type"].items():
            rate = (stats["passed"] / stats["total"] * 100) if stats["total"] > 0 else 0
            print(f"  {query_type.replace('_', ' ').title()}: {stats['passed']}/{stats['total']} ({rate:.1f}%)")
        
        # By difficulty
        print(f"\nPERFORMANCE BY DIFFICULTY:")
        for difficulty, stats in results["by_difficulty"].items():
            rate = (stats["passed"] / stats["total"] * 100) if stats["total"] > 0 else 0
            print(f"  {difficulty.title()}: {stats['passed']}/{stats['total']} ({rate:.1f}%)")
        
        # Sample failed cases
        failed_cases = [r for r in results["detailed_results"] if not r["passed"]]
        if failed_cases:
            print(f"\nSAMPLE FAILED CASES:")
            for case in failed_cases[:3]:
                print(f"  FAILED [{case['query_type']}] {case['question']}")
                print(f"     Score: {case.get('overall_score', 0):.2f}")
                print()


if __name__ == "__main__":
    # Run general evaluation
    logging.basicConfig(level=logging.INFO)
    
    framework = GeneralEvaluationFramework()
    print(f"Schema vocabulary extracted:")
    print(f"  Input types: {len(framework.schema_vocabulary['input_types'])}")
    print(f"  Object types: {len(framework.schema_vocabulary['object_types'])}")  
    print(f"  Business entities: {len(framework.schema_vocabulary['business_entities'])}")
    print(f"  Common fields: {len(framework.schema_vocabulary['common_fields'])}")
    
    # Generate and show sample test cases
    test_cases = framework.generate_comprehensive_test_cases()
    print(f"\nGenerated {len(test_cases)} test cases")
    
    print("\nSample test cases across different types:")
    query_types_shown = set()
    for case in test_cases:
        if case.query_type not in query_types_shown and len(query_types_shown) < 5:
            print(f"  [{case.query_type}] {case.question}")
            query_types_shown.add(case.query_type)
    
    # Run evaluation
    print("\nRunning evaluation...")
    from src.retriever import Retriever
    retriever = Retriever()
    
    results = framework.evaluate_retrieval_system(retriever)
    framework.print_evaluation_summary(results)