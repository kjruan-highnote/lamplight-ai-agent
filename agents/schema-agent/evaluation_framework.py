#!/usr/bin/env python3
"""
Evaluation framework for RAG system performance based on schema analysis
and generated question patterns.
"""

import json
import logging
from pathlib import Path
from typing import List, Dict, Tuple, Any
from dataclasses import dataclass
import re
from agent.retriever import Retriever


@dataclass
class EvaluationCase:
    """A single evaluation test case."""
    question: str
    expected_files: List[str]  # Files that should be in top results
    expected_content_keywords: List[str]  # Keywords that should appear in response
    category: str
    difficulty: str  # easy, medium, hard
    rationale: str  # Why this test case is important


class EvaluationFramework:
    """Framework for evaluating RAG system performance."""
    
    def __init__(self, schema_path: str = "schema/highnote.graphql", 
                 patterns_path: str = "question_patterns.json"):
        self.schema_path = Path(schema_path)
        self.patterns_path = Path(patterns_path)
        self.logger = logging.getLogger(__name__)
        
    def analyze_schema_for_test_cases(self) -> List[EvaluationCase]:
        """Analyze schema to generate comprehensive test cases."""
        test_cases = []
        
        # Load question patterns to understand coverage
        patterns = self._load_patterns()
        
        # Generate test cases by category
        test_cases.extend(self._generate_validation_test_cases())
        test_cases.extend(self._generate_field_inquiry_test_cases())
        test_cases.extend(self._generate_type_discovery_test_cases())
        test_cases.extend(self._generate_mutation_test_cases())
        test_cases.extend(self._generate_relationship_test_cases())
        test_cases.extend(self._generate_business_logic_test_cases())
        test_cases.extend(self._generate_edge_case_test_cases())
        
        return test_cases
    
    def _load_patterns(self) -> Dict:
        """Load generated patterns for analysis."""
        if not self.patterns_path.exists():
            return {}
        
        with open(self.patterns_path, 'r') as f:
            return json.load(f)
    
    def _generate_validation_test_cases(self) -> List[EvaluationCase]:
        """Generate validation-related test cases."""
        return [
            EvaluationCase(
                question="What are the validations for streetAddress?",
                expected_files=["1579_inputs_AddressInput.graphql"],
                expected_content_keywords=["regex", "pattern", "streetAddress", "validation"],
                category="validation",
                difficulty="medium",
                rationale="Core validation inquiry - should find exact field validation info"
            ),
            EvaluationCase(
                question="What regex pattern is used for postal code validation?",
                expected_files=["1579_inputs_AddressInput.graphql"],
                expected_content_keywords=["postalCode", "regex", "pattern", "5 numbers", "hyphen"],
                category="validation",
                difficulty="medium",
                rationale="Specific field validation pattern inquiry"
            ),
            EvaluationCase(
                question="How do I validate an email address format?",
                expected_files=[],  # Would need to check if email validation exists
                expected_content_keywords=["email", "validation", "format"],
                category="validation",
                difficulty="easy",
                rationale="Common validation question"
            ),
            EvaluationCase(
                question="What are the constraints for locality field?",
                expected_files=["1579_inputs_AddressInput.graphql"],
                expected_content_keywords=["locality", "validation", "pattern", "letter"],
                category="validation",
                difficulty="hard",
                rationale="Tests understanding of complex regex patterns"
            )
        ]
    
    def _generate_field_inquiry_test_cases(self) -> List[EvaluationCase]:
        """Generate field-related test cases."""
        return [
            EvaluationCase(
                question="What fields are available in AddressInput?",
                expected_files=["1579_inputs_AddressInput.graphql"],
                expected_content_keywords=["streetAddress", "postalCode", "locality", "region", "countryCodeAlpha3"],
                category="field_inquiry",
                difficulty="easy",
                rationale="Basic type structure inquiry"
            ),
            EvaluationCase(
                question="What is the type of streetAddress field?",
                expected_files=["1579_inputs_AddressInput.graphql", "334_objects_Address.graphql"],
                expected_content_keywords=["streetAddress", "String"],
                category="field_inquiry",
                difficulty="easy",
                rationale="Simple field type inquiry"
            ),
            EvaluationCase(
                question="Which fields are required in AddressInput?",
                expected_files=["1579_inputs_AddressInput.graphql"],
                expected_content_keywords=["streetAddress", "postalCode", "locality", "region", "countryCodeAlpha3", "required"],
                category="field_inquiry",
                difficulty="medium",
                rationale="Understanding field requirements (! syntax)"
            ),
            EvaluationCase(
                question="What payment card fields can I query?",
                expected_files=[],  # Multiple files might match
                expected_content_keywords=["payment", "card", "field"],
                category="field_inquiry",
                difficulty="medium",
                rationale="Broader field discovery"
            )
        ]
    
    def _generate_type_discovery_test_cases(self) -> List[EvaluationCase]:
        """Generate type discovery test cases."""
        return [
            EvaluationCase(
                question="What types are available for address information?",
                expected_files=["334_objects_Address.graphql", "1579_inputs_AddressInput.graphql"],
                expected_content_keywords=["Address", "AddressInput", "type", "input"],
                category="type_discovery",
                difficulty="easy",
                rationale="Basic type discovery"
            ),
            EvaluationCase(
                question="Show me all payment-related types",
                expected_files=[],  # Multiple payment-related files
                expected_content_keywords=["payment", "card", "type"],
                category="type_discovery",
                difficulty="hard",
                rationale="Broad type discovery requiring good search"
            ),
            EvaluationCase(
                question="What enum values are available for address validation?",
                expected_files=["1557_enums_ValidatedAddressLabel.graphql"],
                expected_content_keywords=["enum", "ValidatedAddressLabel", "PO_BOX", "BUSINESS", "RESIDENTIAL"],
                category="type_discovery",
                difficulty="medium",
                rationale="Enum discovery and value listing"
            )
        ]
    
    def _generate_mutation_test_cases(self) -> List[EvaluationCase]:
        """Generate mutation-related test cases."""
        return [
            EvaluationCase(
                question="How do I create a business account holder?",
                expected_files=[],  # Would need to find business account creation mutations
                expected_content_keywords=["create", "business", "account", "holder", "mutation"],
                category="mutation",
                difficulty="medium",
                rationale="Common business operation inquiry"
            ),
            EvaluationCase(
                question="What inputs are needed to validate an address?",
                expected_files=["2101_inputs_ValidateAddressInput.graphql", "319_mutations_validateAddress.graphql"],
                expected_content_keywords=["validateAddress", "input", "address", "idempotencyKey"],
                category="mutation",
                difficulty="medium",
                rationale="Mutation input requirements"
            ),
            EvaluationCase(
                question="How do I update a street address spend rule?",
                expected_files=["114_mutations_updateStreetAddressSpendRule.graphql", "2009_inputs_UpdateStreetAddressSpendRuleInput.graphql"],
                expected_content_keywords=["updateStreetAddressSpendRule", "input", "spend rule"],
                category="mutation",
                difficulty="hard",
                rationale="Specific mutation with complex inputs"
            )
        ]
    
    def _generate_relationship_test_cases(self) -> List[EvaluationCase]:
        """Generate relationship and reference test cases."""
        return [
            EvaluationCase(
                question="What types reference AddressInput?",
                expected_files=["2101_inputs_ValidateAddressInput.graphql"],
                expected_content_keywords=["AddressInput", "reference", "uses"],
                category="relationship",
                difficulty="hard",
                rationale="Understanding type relationships"
            ),
            EvaluationCase(
                question="What mutations return address validation results?",
                expected_files=["319_mutations_validateAddress.graphql", "2446_unions_ValidateAddressPayload.graphql"],
                expected_content_keywords=["validateAddress", "AddressValidationResult"],
                category="relationship",
                difficulty="hard",
                rationale="Mutation return type relationships"
            )
        ]
    
    def _generate_business_logic_test_cases(self) -> List[EvaluationCase]:
        """Generate business logic understanding test cases."""
        return [
            EvaluationCase(
                question="What's the difference between Address and AddressInput?",
                expected_files=["334_objects_Address.graphql", "1579_inputs_AddressInput.graphql"],
                expected_content_keywords=["Address", "AddressInput", "type", "input", "validation"],
                category="business_logic",
                difficulty="medium",
                rationale="Understanding GraphQL type vs input distinction"
            ),
            EvaluationCase(
                question="Can I use PO Box addresses for applications?",
                expected_files=["1579_inputs_AddressInput.graphql"],
                expected_content_keywords=["PO Box", "application", "validation", "excluded"],
                category="business_logic",
                difficulty="hard",
                rationale="Business rule understanding from validation patterns"
            ),
            EvaluationCase(
                question="What address formats are supported for card orders?",
                expected_files=["1579_inputs_AddressInput.graphql"],
                expected_content_keywords=["physical payment card", "card order", "PO Box", "mailing"],
                category="business_logic",
                difficulty="hard",
                rationale="Context-specific business rules"
            )
        ]
    
    def _generate_edge_case_test_cases(self) -> List[EvaluationCase]:
        """Generate edge case and error condition test cases."""
        return [
            EvaluationCase(
                question="What happens if I provide an invalid street address format?",
                expected_files=["1579_inputs_AddressInput.graphql"],
                expected_content_keywords=["validation", "regex", "pattern", "match"],
                category="edge_case",
                difficulty="hard",
                rationale="Error condition understanding"
            ),
            EvaluationCase(
                question="streetaddress field validation rules",  # Intentionally imperfect grammar
                expected_files=["1579_inputs_AddressInput.graphql"],
                expected_content_keywords=["streetAddress", "validation", "regex"],
                category="edge_case",
                difficulty="medium",
                rationale="Handling imperfect user queries"
            ),
            EvaluationCase(
                question="address input type",  # Very short query
                expected_files=["1579_inputs_AddressInput.graphql"],
                expected_content_keywords=["AddressInput", "input", "address"],
                category="edge_case",
                difficulty="easy",
                rationale="Handling minimal queries"
            )
        ]
    
    def run_evaluation(self, retriever: Retriever) -> Dict[str, Any]:
        """Run comprehensive evaluation and return results."""
        test_cases = self.analyze_schema_for_test_cases()
        results = {
            "total_cases": len(test_cases),
            "passed": 0,
            "failed": 0,
            "by_category": {},
            "by_difficulty": {},
            "detailed_results": []
        }
        
        for case in test_cases:
            result = self._evaluate_single_case(retriever, case)
            results["detailed_results"].append(result)
            
            if result["passed"]:
                results["passed"] += 1
            else:
                results["failed"] += 1
            
            # Track by category
            category = case.category
            if category not in results["by_category"]:
                results["by_category"][category] = {"passed": 0, "failed": 0, "total": 0}
            results["by_category"][category]["total"] += 1
            if result["passed"]:
                results["by_category"][category]["passed"] += 1
            else:
                results["by_category"][category]["failed"] += 1
            
            # Track by difficulty
            difficulty = case.difficulty
            if difficulty not in results["by_difficulty"]:
                results["by_difficulty"][difficulty] = {"passed": 0, "failed": 0, "total": 0}
            results["by_difficulty"][difficulty]["total"] += 1
            if result["passed"]:
                results["by_difficulty"][difficulty]["passed"] += 1
            else:
                results["by_difficulty"][difficulty]["failed"] += 1
        
        return results
    
    def _evaluate_single_case(self, retriever: Retriever, case: EvaluationCase) -> Dict[str, Any]:
        """Evaluate a single test case."""
        try:
            # Get retrieval results
            results = retriever.retrieve_chunks(case.question, top_k=10)
            result_files = [Path(r[0]).name for r in results]
            result_content = " ".join([r[1] for r in results]).lower()
            
            # Check file expectations
            file_matches = []
            for expected_file in case.expected_files:
                found = any(expected_file in rf for rf in result_files)
                file_matches.append(found)
            
            # Check content keyword expectations
            keyword_matches = []
            for keyword in case.expected_content_keywords:
                found = keyword.lower() in result_content
                keyword_matches.append(found)
            
            # Calculate scores
            file_score = sum(file_matches) / len(file_matches) if file_matches else 1.0
            keyword_score = sum(keyword_matches) / len(keyword_matches) if keyword_matches else 1.0
            overall_score = (file_score + keyword_score) / 2
            
            # Pass threshold
            passed = overall_score >= 0.7  # 70% threshold
            
            return {
                "question": case.question,
                "category": case.category,
                "difficulty": case.difficulty,
                "passed": passed,
                "overall_score": overall_score,
                "file_score": file_score,
                "keyword_score": keyword_score,
                "expected_files": case.expected_files,
                "found_files": result_files[:5],  # Top 5 results
                "expected_keywords": case.expected_content_keywords,
                "rationale": case.rationale
            }
            
        except Exception as e:
            return {
                "question": case.question,
                "category": case.category,
                "difficulty": case.difficulty,
                "passed": False,
                "error": str(e),
                "overall_score": 0.0
            }
    
    def print_evaluation_report(self, results: Dict[str, Any]):
        """Print formatted evaluation report."""
        print("\n" + "="*60)
        print("RAG SYSTEM EVALUATION REPORT")
        print("="*60)
        
        # Overall stats
        total = results["total_cases"]
        passed = results["passed"]
        failed = results["failed"]
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print(f"\nOVERALL PERFORMANCE:")
        print(f"  Total Cases: {total}")
        print(f"  Passed: {passed}")
        print(f"  Failed: {failed}")
        print(f"  Success Rate: {success_rate:.1f}%")
        
        # By category
        print(f"\nPERFORMANCE BY CATEGORY:")
        for category, stats in results["by_category"].items():
            rate = (stats["passed"] / stats["total"] * 100) if stats["total"] > 0 else 0
            print(f"  {category.title()}: {stats['passed']}/{stats['total']} ({rate:.1f}%)")
        
        # By difficulty
        print(f"\nPERFORMANCE BY DIFFICULTY:")
        for difficulty, stats in results["by_difficulty"].items():
            rate = (stats["passed"] / stats["total"] * 100) if stats["total"] > 0 else 0
            print(f"  {difficulty.title()}: {stats['passed']}/{stats['total']} ({rate:.1f}%)")
        
        # Failed cases
        failed_cases = [r for r in results["detailed_results"] if not r["passed"]]
        if failed_cases:
            print(f"\nFAILED CASES:")
            for case in failed_cases[:5]:  # Show top 5 failures
                print(f"  FAILED [{case['category']}] {case['question']}")
                print(f"     Score: {case.get('overall_score', 0):.2f}")
                if 'expected_files' in case:
                    print(f"     Expected: {case['expected_files']}")
                    print(f"     Found: {case.get('found_files', [])}")
                print()


if __name__ == "__main__":
    # Run evaluation
    logging.basicConfig(level=logging.INFO)
    
    framework = EvaluationFramework()
    test_cases = framework.analyze_schema_for_test_cases()
    
    print(f"Generated {len(test_cases)} evaluation test cases")
    print("\nSample test cases:")
    for i, case in enumerate(test_cases[:5]):
        print(f"{i+1}. [{case.category}] {case.question}")
        print(f"   Expected files: {case.expected_files}")
        print(f"   Keywords: {case.expected_content_keywords}")
        print()
    
    # Run actual evaluation
    from agent.retriever import Retriever
    retriever = Retriever()
    
    print("Running evaluation...")
    results = framework.run_evaluation(retriever)
    framework.print_evaluation_report(results)