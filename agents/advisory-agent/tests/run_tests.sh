#!/bin/bash

# Advisory Agent Performance Test Runner
# This script provides easy commands to run different test scenarios

echo "🚀 Advisory Agent Performance Test Runner"
echo "========================================="

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Default values
BASE_URL="http://localhost:8002"
TEST_FILE="test_cases.json"

# Function to display usage
usage() {
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  quick       Run a quick test (10 random tests)"
    echo "  full        Run all tests"
    echo "  schema      Run only schema-related tests"
    echo "  docs        Run only documentation-related tests"
    echo "  mixed       Run only mixed (both agents) tests"
    echo "  easy        Run only easy difficulty tests"
    echo "  medium      Run only medium difficulty tests"
    echo "  hard        Run only hard difficulty tests"
    echo "  custom      Run with custom parameters"
    echo ""
    echo "Options:"
    echo "  --url URL   Advisory agent URL (default: $BASE_URL)"
    echo "  --file FILE Test cases file (default: $TEST_FILE)"
    echo ""
    echo "Examples:"
    echo "  $0 quick                    # Quick test with 10 random cases"
    echo "  $0 full                     # Run all test cases"
    echo "  $0 schema --url http://localhost:8002"
    echo "  $0 custom --sample 20 --categories schema mixed"
    echo ""
}

# Parse command
COMMAND=${1:-help}
shift

# Parse additional options
EXTRA_ARGS=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --url)
            BASE_URL="$2"
            shift 2
            ;;
        --file)
            TEST_FILE="$2"
            shift 2
            ;;
        *)
            EXTRA_ARGS="$EXTRA_ARGS $1"
            shift
            ;;
    esac
done

# Base Python command
PYTHON_CMD="python3 performance_test.py --url $BASE_URL --test-file $TEST_FILE"

# Execute based on command
case $COMMAND in
    quick)
        echo "Running quick test (10 random test cases)..."
        $PYTHON_CMD --sample 10
        ;;
    full)
        echo "Running full test suite (all test cases)..."
        $PYTHON_CMD
        ;;
    schema)
        echo "Running schema-related tests..."
        $PYTHON_CMD --categories schema
        ;;
    docs|documentation)
        echo "Running documentation-related tests..."
        $PYTHON_CMD --categories documentation
        ;;
    mixed)
        echo "Running mixed (both agents) tests..."
        $PYTHON_CMD --categories mixed
        ;;
    easy)
        echo "Running easy difficulty tests..."
        $PYTHON_CMD --difficulties easy
        ;;
    medium)
        echo "Running medium difficulty tests..."
        $PYTHON_CMD --difficulties medium
        ;;
    hard)
        echo "Running hard difficulty tests..."
        $PYTHON_CMD --difficulties hard
        ;;
    custom)
        echo "Running custom test configuration..."
        $PYTHON_CMD $EXTRA_ARGS
        ;;
    help|--help|-h)
        usage
        exit 0
        ;;
    *)
        echo "❌ Unknown command: $COMMAND"
        usage
        exit 1
        ;;
esac

echo ""
echo "✨ Test execution completed!"