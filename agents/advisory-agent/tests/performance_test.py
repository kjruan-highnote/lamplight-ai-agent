#!/usr/bin/env python3
"""
Performance test suite for the Advisory Agent.
Tests routing accuracy, response quality, and performance metrics.
Loads test cases from external JSON file for easy maintenance.
"""

import asyncio
import aiohttp
import json
import time
import statistics
import argparse
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
import random

@dataclass
class TestCase:
    """Represents a single test case."""
    id: str
    category: str  # 'schema', 'documentation', 'mixed'
    question: str
    expected_keywords: List[str]  # Keywords that should appear in response
    expected_agent: str  # 'schema', 'doc', 'both'
    difficulty: str  # 'easy', 'medium', 'hard'
    tags: List[str] = None  # Optional tags for filtering
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'TestCase':
        """Create TestCase from dictionary."""
        return cls(
            id=data['id'],
            category=data['category'],
            question=data['question'],
            expected_keywords=data['expected_keywords'],
            expected_agent=data['expected_agent'],
            difficulty=data['difficulty'],
            tags=data.get('tags', [])
        )

@dataclass
class TestResult:
    """Results from a single test."""
    test_id: str
    success: bool
    response_time_ms: float
    agents_used: List[str]
    response_length: int
    keywords_found: List[str]
    keywords_missing: List[str]
    query_type: str
    confidence: float
    error: Optional[str] = None
    response_preview: Optional[str] = None

class AdvisoryAgentPerformanceTester:
    """Performance test suite for Advisory Agent."""
    
    def __init__(self, 
                 base_url: str = "http://localhost:8002",
                 test_cases_file: str = "test_cases.json",
                 timeout: int = 30):
        self.base_url = base_url
        self.timeout = timeout
        self.session = None
        self.test_cases = self._load_test_cases(test_cases_file)
        
    def _load_test_cases(self, filepath: str) -> List[TestCase]:
        """Load test cases from JSON file."""
        path = Path(filepath)
        if not path.exists():
            # Try relative to tests directory
            path = Path(__file__).parent / filepath
            if not path.exists():
                raise FileNotFoundError(f"Test cases file not found: {filepath}")
        
        with open(path, 'r') as f:
            data = json.load(f)
        
        test_cases = []
        for case_data in data['test_cases']:
            test_cases.append(TestCase.from_dict(case_data))
        
        print(f"Loaded {len(test_cases)} test cases from {path}")
        if 'metadata' in data:
            print(f"Test suite version: {data['metadata'].get('version', 'unknown')}")
        
        return test_cases
    
    async def __aenter__(self):
        """Async context manager entry."""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.timeout)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    async def health_check(self) -> Dict[str, Any]:
        """Check if the advisory agent and underlying agents are healthy."""
        try:
            async with self.session.get(f"{self.base_url}/health") as response:
                if response.status == 200:
                    data = await response.json()
                    return {
                        'healthy': data.get("status") == "healthy",
                        'details': data
                    }
                return {'healthy': False, 'error': f"HTTP {response.status}"}
        except Exception as e:
            return {'healthy': False, 'error': str(e)}
    
    async def run_test_case(self, test_case: TestCase) -> TestResult:
        """Run a single test case."""
        start_time = time.time()
        
        try:
            payload = {
                "question": test_case.question,
                "top_k": 5,
                "force_both_agents": False
            }
            
            async with self.session.post(
                f"{self.base_url}/chat",
                json=payload
            ) as response:
                elapsed_ms = (time.time() - start_time) * 1000
                
                if response.status == 200:
                    data = await response.json()
                    
                    # Check for expected keywords
                    response_lower = data["response"].lower()
                    keywords_found = [
                        kw for kw in test_case.expected_keywords 
                        if kw.lower() in response_lower
                    ]
                    keywords_missing = [
                        kw for kw in test_case.expected_keywords 
                        if kw.lower() not in response_lower
                    ]
                    
                    # Determine success based on keyword coverage and routing
                    keyword_coverage = len(keywords_found) / len(test_case.expected_keywords) if test_case.expected_keywords else 0
                    
                    # Check agent routing
                    agents_used = data.get("agents_used", [])
                    routing_correct = self._check_routing(test_case.expected_agent, agents_used)
                    
                    # Overall success: good keyword coverage AND correct routing
                    success = keyword_coverage >= 0.5 and routing_correct
                    
                    return TestResult(
                        test_id=test_case.id,
                        success=success,
                        response_time_ms=elapsed_ms,
                        agents_used=agents_used,
                        response_length=len(data["response"]),
                        keywords_found=keywords_found,
                        keywords_missing=keywords_missing,
                        query_type=data.get("query_type", "unknown"),
                        confidence=data.get("confidence", 0.0),
                        response_preview=data["response"][:200] + "..." if len(data["response"]) > 200 else data["response"]
                    )
                else:
                    error_text = await response.text()
                    return TestResult(
                        test_id=test_case.id,
                        success=False,
                        response_time_ms=elapsed_ms,
                        agents_used=[],
                        response_length=0,
                        keywords_found=[],
                        keywords_missing=test_case.expected_keywords,
                        query_type="error",
                        confidence=0.0,
                        error=f"HTTP {response.status}: {error_text[:200]}"
                    )
                    
        except Exception as e:
            elapsed_ms = (time.time() - start_time) * 1000
            return TestResult(
                test_id=test_case.id,
                success=False,
                response_time_ms=elapsed_ms,
                agents_used=[],
                response_length=0,
                keywords_found=[],
                keywords_missing=test_case.expected_keywords,
                query_type="error",
                confidence=0.0,
                error=str(e)[:200]
            )
    
    def _check_routing(self, expected_agent: str, agents_used: List[str]) -> bool:
        """Check if the routing matches expectations."""
        if expected_agent == "both":
            return len(agents_used) == 2
        elif expected_agent == "schema":
            return "schema-agent" in agents_used and "document-agent" not in agents_used
        elif expected_agent == "doc":
            return "document-agent" in agents_used and "schema-agent" not in agents_used
        return False
    
    async def run_performance_test(self, 
                                   categories: List[str] = None,
                                   difficulties: List[str] = None,
                                   tags: List[str] = None,
                                   sample_size: int = None,
                                   test_ids: List[str] = None) -> Dict[str, Any]:
        """
        Run performance tests with various filtering options.
        
        Args:
            categories: Filter by categories (schema, documentation, mixed)
            difficulties: Filter by difficulty levels (easy, medium, hard)
            tags: Filter by tags
            sample_size: Random sample size
            test_ids: Specific test IDs to run
        """
        
        # Filter test cases
        test_cases = self.test_cases
        
        if test_ids:
            test_cases = [tc for tc in test_cases if tc.id in test_ids]
        else:
            if categories:
                test_cases = [tc for tc in test_cases if tc.category in categories]
            if difficulties:
                test_cases = [tc for tc in test_cases if tc.difficulty in difficulties]
            if tags:
                test_cases = [tc for tc in test_cases if any(tag in tc.tags for tag in tags)]
        
        if sample_size and sample_size < len(test_cases):
            test_cases = random.sample(test_cases, sample_size)
        
        if not test_cases:
            print("No test cases match the specified filters")
            return {}
        
        print(f"\nRunning {len(test_cases)} test cases...")
        print("-" * 60)
        
        # Run tests with progress indicator
        results = []
        for i, test_case in enumerate(test_cases, 1):
            print(f"[{i:3d}/{len(test_cases)}] Testing: {test_case.id:15s} | {test_case.question[:50]:<50s}", end='')
            result = await self.run_test_case(test_case)
            
            # Print immediate feedback
            status = "✓" if result.success else "✗"
            print(f" | {status} {result.response_time_ms:6.1f}ms")
            
            results.append(result)
            
            # Brief pause between tests
            if i < len(test_cases):
                await asyncio.sleep(0.2)
        
        # Calculate statistics
        return self._calculate_statistics(results, test_cases)
    
    def _calculate_statistics(self, results: List[TestResult], test_cases: List[TestCase]) -> Dict[str, Any]:
        """Calculate comprehensive statistics from test results."""
        
        successful_tests = [r for r in results if r.success]
        failed_tests = [r for r in results if not r.success]
        response_times = [r.response_time_ms for r in results if r.response_time_ms > 0]
        
        stats = {
            "summary": {
                "total_tests": len(results),
                "successful": len(successful_tests),
                "failed": len(failed_tests),
                "success_rate": len(successful_tests) / len(results) * 100 if results else 0
            },
            "response_times": self._calculate_response_time_stats(response_times),
            "by_category": self._analyze_by_category(results, test_cases),
            "by_difficulty": self._analyze_by_difficulty(results, test_cases),
            "by_agent": self._analyze_by_agent(results),
            "routing_accuracy": self._calculate_routing_accuracy(results, test_cases),
            "keyword_coverage": self._calculate_keyword_coverage(results),
            "failures": self._analyze_failures(failed_tests, test_cases)
        }
        
        return {
            "timestamp": datetime.now().isoformat(),
            "configuration": {
                "base_url": self.base_url,
                "timeout": self.timeout,
                "test_cases_count": len(test_cases)
            },
            "statistics": stats,
            "results": [asdict(r) for r in results],
            "test_cases": [asdict(tc) for tc in test_cases]
        }
    
    def _calculate_response_time_stats(self, response_times: List[float]) -> Dict[str, float]:
        """Calculate response time statistics."""
        if not response_times:
            return {"min": 0, "max": 0, "mean": 0, "median": 0, "p95": 0, "p99": 0}
        
        return {
            "min": min(response_times),
            "max": max(response_times),
            "mean": statistics.mean(response_times),
            "median": statistics.median(response_times),
            "p95": statistics.quantiles(response_times, n=20)[18] if len(response_times) > 1 else response_times[0],
            "p99": statistics.quantiles(response_times, n=100)[98] if len(response_times) > 1 else response_times[0]
        }
    
    def _analyze_by_category(self, results: List[TestResult], test_cases: List[TestCase]) -> Dict[str, Any]:
        """Analyze results by category."""
        analysis = {}
        for category in ["schema", "documentation", "mixed"]:
            cat_results = []
            for result in results:
                test_case = next((tc for tc in test_cases if tc.id == result.test_id), None)
                if test_case and test_case.category == category:
                    cat_results.append(result)
            
            if cat_results:
                success_count = len([r for r in cat_results if r.success])
                analysis[category] = {
                    "total": len(cat_results),
                    "successful": success_count,
                    "success_rate": success_count / len(cat_results) * 100,
                    "avg_response_time": statistics.mean([r.response_time_ms for r in cat_results])
                }
        return analysis
    
    def _analyze_by_difficulty(self, results: List[TestResult], test_cases: List[TestCase]) -> Dict[str, Any]:
        """Analyze results by difficulty."""
        analysis = {}
        for difficulty in ["easy", "medium", "hard"]:
            diff_results = []
            for result in results:
                test_case = next((tc for tc in test_cases if tc.id == result.test_id), None)
                if test_case and test_case.difficulty == difficulty:
                    diff_results.append(result)
            
            if diff_results:
                success_count = len([r for r in diff_results if r.success])
                analysis[difficulty] = {
                    "total": len(diff_results),
                    "successful": success_count,
                    "success_rate": success_count / len(diff_results) * 100,
                    "avg_response_time": statistics.mean([r.response_time_ms for r in diff_results])
                }
        return analysis
    
    def _analyze_by_agent(self, results: List[TestResult]) -> Dict[str, int]:
        """Analyze agent usage patterns."""
        analysis = {
            "schema_only": 0,
            "doc_only": 0,
            "both": 0,
            "none": 0
        }
        
        for result in results:
            if len(result.agents_used) == 2:
                analysis["both"] += 1
            elif "schema-agent" in result.agents_used:
                analysis["schema_only"] += 1
            elif "document-agent" in result.agents_used:
                analysis["doc_only"] += 1
            else:
                analysis["none"] += 1
        
        return analysis
    
    def _calculate_routing_accuracy(self, results: List[TestResult], test_cases: List[TestCase]) -> Dict[str, Any]:
        """Calculate routing accuracy."""
        correct_routing = 0
        
        for result in results:
            test_case = next((tc for tc in test_cases if tc.id == result.test_id), None)
            if test_case:
                if self._check_routing(test_case.expected_agent, result.agents_used):
                    correct_routing += 1
        
        return {
            "correct": correct_routing,
            "total": len(results),
            "accuracy": correct_routing / len(results) * 100 if results else 0
        }
    
    def _calculate_keyword_coverage(self, results: List[TestResult]) -> Dict[str, Any]:
        """Calculate keyword coverage statistics."""
        total_expected = sum(len(r.keywords_found) + len(r.keywords_missing) for r in results)
        total_found = sum(len(r.keywords_found) for r in results)
        
        return {
            "total_expected": total_expected,
            "total_found": total_found,
            "coverage": total_found / total_expected * 100 if total_expected else 0
        }
    
    def _analyze_failures(self, failed_tests: List[TestResult], test_cases: List[TestCase]) -> List[Dict[str, Any]]:
        """Analyze failed tests."""
        failures = []
        for result in failed_tests[:10]:  # Limit to top 10 failures
            test_case = next((tc for tc in test_cases if tc.id == result.test_id), None)
            if test_case:
                failures.append({
                    "test_id": result.test_id,
                    "question": test_case.question,
                    "category": test_case.category,
                    "difficulty": test_case.difficulty,
                    "error": result.error,
                    "keywords_missing": result.keywords_missing,
                    "response_time_ms": result.response_time_ms
                })
        return failures
    
    def save_results(self, results: Dict[str, Any], filepath: str = None):
        """Save test results to a JSON file."""
        if filepath is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filepath = f"results/performance_test_{timestamp}.json"
        
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"\nResults saved to: {filepath}")
        return filepath
    
    def print_summary(self, results: Dict[str, Any]):
        """Print a formatted summary of test results."""
        if not results:
            print("No results to display")
            return
        
        stats = results["statistics"]
        
        print("\n" + "="*70)
        print("ADVISORY AGENT PERFORMANCE TEST RESULTS")
        print("="*70)
        print(f"Timestamp: {results['timestamp']}")
        print(f"Base URL: {results['configuration']['base_url']}")
        
        # Overall results
        summary = stats["summary"]
        print(f"\n📊 Overall Results:")
        print(f"  Total Tests: {summary['total_tests']}")
        print(f"  ✓ Successful: {summary['successful']}")
        print(f"  ✗ Failed: {summary['failed']}")
        print(f"  Success Rate: {summary['success_rate']:.1f}%")
        
        # Response times
        rt = stats["response_times"]
        print(f"\n⏱️  Response Times (ms):")
        print(f"  Min: {rt['min']:.1f}")
        print(f"  Median: {rt['median']:.1f}")
        print(f"  Mean: {rt['mean']:.1f}")
        print(f"  Max: {rt['max']:.1f}")
        print(f"  P95: {rt['p95']:.1f}")
        print(f"  P99: {rt['p99']:.1f}")
        
        # By category
        if stats["by_category"]:
            print(f"\n📂 Results by Category:")
            for category, data in stats["by_category"].items():
                print(f"  {category.capitalize():15s}: {data['successful']:2d}/{data['total']:2d} "
                      f"({data['success_rate']:5.1f}%) - Avg: {data['avg_response_time']:6.1f}ms")
        
        # By difficulty
        if stats["by_difficulty"]:
            print(f"\n🎯 Results by Difficulty:")
            for difficulty, data in stats["by_difficulty"].items():
                print(f"  {difficulty.capitalize():10s}: {data['successful']:2d}/{data['total']:2d} "
                      f"({data['success_rate']:5.1f}%) - Avg: {data['avg_response_time']:6.1f}ms")
        
        # Agent usage
        print(f"\n🤖 Agent Usage:")
        for agent, count in stats["by_agent"].items():
            print(f"  {agent.replace('_', ' ').title():15s}: {count}")
        
        # Routing accuracy
        ra = stats["routing_accuracy"]
        print(f"\n🎯 Routing Accuracy:")
        print(f"  Correct: {ra['correct']}/{ra['total']} ({ra['accuracy']:.1f}%)")
        
        # Keyword coverage
        kc = stats["keyword_coverage"]
        print(f"\n🔍 Keyword Coverage:")
        print(f"  Found: {kc['total_found']}/{kc['total_expected']} ({kc['coverage']:.1f}%)")
        
        # Top failures
        if stats["failures"]:
            print(f"\n❌ Top Failed Tests:")
            for failure in stats["failures"][:5]:
                print(f"  - {failure['test_id']}: {failure['question'][:50]}...")
                if failure['error']:
                    print(f"    Error: {failure['error'][:80]}...")
        
        print("="*70)


async def main():
    """Main function to run performance tests."""
    
    parser = argparse.ArgumentParser(description='Advisory Agent Performance Test Suite')
    parser.add_argument('--url', default='http://localhost:8002', help='Advisory agent URL')
    parser.add_argument('--test-file', default='test_cases.json', help='Path to test cases JSON file')
    parser.add_argument('--categories', nargs='+', choices=['schema', 'documentation', 'mixed'],
                       help='Filter by categories')
    parser.add_argument('--difficulties', nargs='+', choices=['easy', 'medium', 'hard'],
                       help='Filter by difficulties')
    parser.add_argument('--tags', nargs='+', help='Filter by tags')
    parser.add_argument('--sample', type=int, help='Random sample size')
    parser.add_argument('--test-ids', nargs='+', help='Specific test IDs to run')
    parser.add_argument('--output', help='Output file path for results')
    parser.add_argument('--no-save', action='store_true', help='Do not save results to file')
    
    args = parser.parse_args()
    
    print("🚀 Advisory Agent Performance Test Suite")
    print("=" * 70)
    
    async with AdvisoryAgentPerformanceTester(args.url, args.test_file) as tester:
        # Check health
        print("\n🔍 Checking advisory agent health...")
        health = await tester.health_check()
        
        if not health['healthy']:
            print("❌ ERROR: Advisory agent is not healthy!")
            print(f"   Error: {health.get('error', 'Unknown error')}")
            print("\n📝 Please ensure all agents are running:")
            print("   - Schema agent on port 8000")
            print("   - Document agent on port 8001")
            print("   - Advisory agent on port 8002")
            return
        
        print("✅ Advisory agent is healthy!")
        
        # Show agent status
        if 'details' in health:
            details = health['details']
            if 'agents_status' in details:
                print("\n📊 Agent Status:")
                for agent, status in details['agents_status'].items():
                    status_icon = "✅" if status.get('status') == 'healthy' else "❌"
                    print(f"   {status_icon} {agent}: {status.get('status', 'unknown')}")
        
        # Run tests
        print("\n🏃 Starting performance tests...")
        
        results = await tester.run_performance_test(
            categories=args.categories,
            difficulties=args.difficulties,
            tags=args.tags,
            sample_size=args.sample,
            test_ids=args.test_ids
        )
        
        if results:
            # Print summary
            tester.print_summary(results)
            
            # Save results
            if not args.no_save:
                filepath = tester.save_results(results, args.output)
                print(f"\n💾 Detailed results saved to: {filepath}")
            
            print("\n✨ Test completed successfully!")
        else:
            print("\n❌ No test results generated")


if __name__ == "__main__":
    asyncio.run(main())