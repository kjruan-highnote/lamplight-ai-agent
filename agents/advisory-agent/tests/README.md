# Advisory Agent Performance Test Suite

This test suite provides comprehensive performance testing for the Advisory Agent, which routes questions to the appropriate underlying agents (Schema Agent and Document Agent).

## 📁 Files

- `test_cases.json` - Test cases with questions, expected answers, and metadata
- `performance_test.py` - Main test framework that loads and executes tests
- `run_tests.sh` - Convenient shell script for running different test scenarios
- `results/` - Directory where test results are saved (created automatically)

## 🚀 Quick Start

### Prerequisites

1. Ensure all three agents are running:
   - Schema Agent on port 8000
   - Document Agent on port 8001
   - Advisory Agent on port 8002

2. Install required Python packages:
```bash
pip install aiohttp
```

### Running Tests

#### Using the Shell Script (Recommended)

```bash
# Quick test with 10 random cases
./run_tests.sh quick

# Run all tests
./run_tests.sh full

# Run specific categories
./run_tests.sh schema      # Schema-only tests
./run_tests.sh docs        # Documentation-only tests
./run_tests.sh mixed       # Tests requiring both agents

# Run by difficulty
./run_tests.sh easy
./run_tests.sh medium
./run_tests.sh hard
```

#### Using Python Directly

```bash
# Run all tests
python3 performance_test.py

# Run with filters
python3 performance_test.py --categories schema documentation
python3 performance_test.py --difficulties easy medium
python3 performance_test.py --sample 20  # Random sample of 20 tests

# Run specific tests
python3 performance_test.py --test-ids schema_001 doc_005 mixed_003

# Specify custom URL
python3 performance_test.py --url http://localhost:8002

# Use custom test file
python3 performance_test.py --test-file my_tests.json
```

## 📊 Test Case Structure

Test cases are defined in `test_cases.json` with the following structure:

```json
{
  "test_cases": [
    {
      "id": "schema_001",
      "category": "schema",
      "question": "What is the type of the ping field?",
      "expected_keywords": ["String", "ping", "Query"],
      "expected_agent": "schema",
      "difficulty": "easy",
      "tags": ["basic", "query", "type"]
    }
  ]
}
```

### Fields

- `id`: Unique identifier for the test case
- `category`: One of "schema", "documentation", or "mixed"
- `question`: The question to ask the advisory agent
- `expected_keywords`: Keywords that should appear in the response
- `expected_agent`: Which agent(s) should handle the query ("schema", "doc", or "both")
- `difficulty`: Test difficulty ("easy", "medium", "hard")
- `tags`: Optional tags for filtering tests

## 📈 Adding New Test Cases

To add new test cases, edit `test_cases.json`:

1. Add your test case to the `test_cases` array
2. Follow the naming convention:
   - `schema_XXX` for schema-related tests
   - `doc_XXX` for documentation tests
   - `mixed_XXX` for tests requiring both agents
   - `edge_XXX` for edge cases
   - `complex_XXX` for complex scenarios

3. Ensure you provide:
   - Clear, specific questions
   - Relevant expected keywords
   - Correct expected agent routing
   - Appropriate difficulty level

Example:
```json
{
  "id": "schema_099",
  "category": "schema",
  "question": "What are the fields in the User type?",
  "expected_keywords": ["User", "email", "name", "id"],
  "expected_agent": "schema",
  "difficulty": "easy",
  "tags": ["user", "type", "fields"]
}
```

## 📊 Understanding Results

The test suite provides comprehensive metrics:

### Success Metrics
- **Overall Success Rate**: Percentage of tests that passed
- **Category Success**: Success rates for schema, documentation, and mixed tests
- **Difficulty Success**: Success rates by difficulty level

### Performance Metrics
- **Response Times**: Min, max, mean, median, P95, P99
- **By Category**: Average response time per category
- **By Difficulty**: Average response time per difficulty

### Quality Metrics
- **Routing Accuracy**: How often questions are routed to the correct agent(s)
- **Keyword Coverage**: Percentage of expected keywords found in responses
- **Agent Usage**: Distribution of which agents handled queries

### Example Output

```
📊 Overall Results:
  Total Tests: 53
  ✓ Successful: 48
  ✗ Failed: 5
  Success Rate: 90.6%

⏱️  Response Times (ms):
  Min: 125.3
  Median: 342.7
  Mean: 389.2
  Max: 1823.5
  P95: 892.3
  P99: 1523.8

🎯 Routing Accuracy:
  Correct: 51/53 (96.2%)
```

## 🔍 Analyzing Results

Results are saved to JSON files in the `results/` directory with timestamps:
- `performance_test_20240120_143022.json`

These files contain:
- Complete test results with details
- Response previews for each test
- Error messages for failed tests
- Comprehensive statistics

You can analyze trends over time by comparing multiple result files.

## 🛠️ Troubleshooting

### Common Issues

1. **"Advisory agent is not healthy"**
   - Ensure all three agents are running
   - Check the URLs are correct
   - Verify network connectivity

2. **High failure rate**
   - Check if the underlying agents have the latest data
   - Verify the schema and documentation are up to date
   - Review failed test cases for patterns

3. **Slow response times**
   - Check system resources
   - Verify agent configurations
   - Consider reducing concurrent load

### Debug Mode

For detailed debugging, modify the test execution:

```python
# In performance_test.py, add debug output
result = await self.run_test_case(test_case)
print(f"Debug - Response: {result.response_preview}")
print(f"Debug - Keywords found: {result.keywords_found}")
```

## 📝 Best Practices

1. **Regular Testing**: Run tests regularly to catch regressions
2. **Baseline Metrics**: Establish baseline performance metrics
3. **Test Coverage**: Ensure good coverage across all categories and difficulties
4. **Update Test Cases**: Keep test cases updated with schema/documentation changes
5. **Monitor Trends**: Track performance metrics over time

## 🤝 Contributing

To contribute new test cases:

1. Identify gaps in current test coverage
2. Create test cases following the established format
3. Test your additions locally
4. Submit with clear descriptions and expected outcomes

## 📄 License

This test suite is part of the Advisory Agent project.