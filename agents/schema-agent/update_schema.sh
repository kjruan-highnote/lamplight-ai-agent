#!/bin/bash

# Automated Schema Update Script
# This script provides a simple interface to update the GraphQL schema

set -e

# Default configuration
CONFIG_FILE="config.json"
LOG_FILE="logs/schema_update.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Automated GraphQL Schema Update Pipeline

OPTIONS:
    -c, --config FILE       Configuration file (default: config.json)
    -e, --endpoint URL      GraphQL endpoint URL
    -t, --token TOKEN       Authentication token
    -f, --file FILE         Load schema from file instead of endpoint
    --force                 Force update even if schema unchanged
    --dry-run              Show what would be done without making changes
    --no-cloud-sync        Skip cloud storage synchronization
    --verbose              Enable verbose logging
    --quiet                Quiet mode (errors only)
    -h, --help             Show this help message

EXAMPLES:
    # Update using default config file
    $0

    # Update from specific endpoint
    $0 --endpoint https://api.example.com/graphql --token YOUR_TOKEN

    # Update from local file
    $0 --file my-schema.graphql

    # Dry run to see what would happen
    $0 --dry-run

    # Force update even if unchanged
    $0 --force

ENVIRONMENT VARIABLES:
    GRAPHQL_ENDPOINT       GraphQL endpoint URL
    GRAPHQL_TOKEN         Authentication token
    UPDATE_CONFIG         Path to configuration file

CONFIGURATION:
    Create a config.json file with your settings:
    {
        "graphql_endpoint": "https://api.example.com/graphql",
        "graphql_token": "your-token-here",
        "sync_to_cloud": true
    }
EOF
}

# Function to check dependencies
check_dependencies() {
    print_status "Checking dependencies..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is required but not installed"
        exit 1
    fi
    
    # Check required Python packages
    python3 -c "import requests, graphql" 2>/dev/null || {
        print_error "Required Python packages not installed"
        print_status "Install with: pip install -r requirements.txt"
        exit 1
    }
    
    # Create logs directory if it doesn't exist
    mkdir -p logs
    
    print_success "Dependencies check passed"
}

# Function to validate configuration
validate_config() {
    if [[ -n "$ENDPOINT" && -z "$TOKEN" ]]; then
        print_error "Token is required when using GraphQL endpoint"
        exit 1
    fi
    
    if [[ -z "$ENDPOINT" && -z "$SCHEMA_FILE" && ! -f "$CONFIG_FILE" ]]; then
        print_error "Either --endpoint, --file, or config file must be provided"
        print_status "Create config.json or use command line options"
        exit 1
    fi
}

# Function to run the update
run_update() {
    print_status "Starting schema update pipeline..."
    
    # Build command arguments
    PYTHON_ARGS=()
    
    if [[ -n "$CONFIG_FILE" && -f "$CONFIG_FILE" ]]; then
        PYTHON_ARGS+=(--config "$CONFIG_FILE")
    fi
    
    if [[ -n "$ENDPOINT" ]]; then
        PYTHON_ARGS+=(--endpoint "$ENDPOINT")
    fi
    
    if [[ -n "$TOKEN" ]]; then
        PYTHON_ARGS+=(--token "$TOKEN")
    fi
    
    if [[ -n "$SCHEMA_FILE" ]]; then
        PYTHON_ARGS+=(--from-file "$SCHEMA_FILE")
    fi
    
    if [[ "$FORCE" == "true" ]]; then
        PYTHON_ARGS+=(--force)
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        PYTHON_ARGS+=(--dry-run)
    fi
    
    if [[ "$NO_CLOUD_SYNC" == "true" ]]; then
        PYTHON_ARGS+=(--no-cloud-sync)
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        PYTHON_ARGS+=(--verbose)
    fi
    
    if [[ "$QUIET" == "true" ]]; then
        PYTHON_ARGS+=(--quiet)
    fi
    
    # Run the Python script
    if python3 update_schema.py "${PYTHON_ARGS[@]}"; then
        print_success "Schema update completed successfully"
        
        # Show summary
        if [[ -f "$LOG_FILE" ]]; then
            print_status "Recent log entries:"
            tail -n 5 "$LOG_FILE"
        fi
        
        return 0
    else
        print_error "Schema update failed"
        
        # Show error log
        if [[ -f "$LOG_FILE" ]]; then
            print_status "Recent error logs:"
            tail -n 10 "$LOG_FILE" | grep -E "(ERROR|CRITICAL)" || true
        fi
        
        return 1
    fi
}

# Parse command line arguments
ENDPOINT=""
TOKEN=""
SCHEMA_FILE=""
FORCE="false"
DRY_RUN="false"
NO_CLOUD_SYNC="false"
VERBOSE="false"
QUIET="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -e|--endpoint)
            ENDPOINT="$2"
            shift 2
            ;;
        -t|--token)
            TOKEN="$2"
            shift 2
            ;;
        -f|--file)
            SCHEMA_FILE="$2"
            shift 2
            ;;
        --force)
            FORCE="true"
            shift
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --no-cloud-sync)
            NO_CLOUD_SYNC="true"
            shift
            ;;
        --verbose)
            VERBOSE="true"
            shift
            ;;
        --quiet)
            QUIET="true"
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Load environment variables if set
ENDPOINT="${ENDPOINT:-$GRAPHQL_ENDPOINT}"
TOKEN="${TOKEN:-$GRAPHQL_TOKEN}"
CONFIG_FILE="${CONFIG_FILE:-$UPDATE_CONFIG}"

# Main execution
main() {
    echo -e "\033[0;34m[REFRESH]\033[0m GraphQL Schema Update Pipeline"
    echo "=================================="
    
    check_dependencies
    validate_config
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_warning "Running in DRY RUN mode - no actual changes will be made"
    fi
    
    if run_update; then
        echo ""
        print_success "[CHECK] Schema update pipeline completed successfully"
        
        # Show next steps
        echo ""
        print_status "Next steps:"
        echo "  • Restart your API server to use the new embeddings"
        echo "  • Test the updated schema with some queries"
        echo "  • Check logs/schema_update.log for details"
        
        exit 0
    else
        echo ""
        print_error "[X] Schema update pipeline failed"
        echo ""
        print_status "Troubleshooting:"
        echo "  • Check logs/schema_update.log for detailed errors"
        echo "  • Verify your GraphQL endpoint and token"
        echo "  • Ensure you have sufficient disk space"
        echo "  • Try running with --verbose for more details"
        
        exit 1
    fi
}

# Run main function
main