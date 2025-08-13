#!/bin/bash

# Advisory Agent with Ngrok Runner
# This script starts the advisory agent and exposes it via ngrok
# while keeping internal connections to schema and document agents

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Default values
NGROK_DOMAIN=""
START_ALL_AGENTS=false
VERBOSE=false

print_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Run the advisory agent with ngrok exposure.

OPTIONS:
    -d, --domain <domain>   Your ngrok domain (required)
    -a, --all               Start all three agents (schema, document, advisory)
    -v, --verbose           Verbose output
    -h, --help              Show this help message

ENVIRONMENT VARIABLES:
    NGROK_AUTHTOKEN        Your ngrok auth token (required)
    NGROK_DOMAIN           Your ngrok domain (can be set via -d flag)

EXAMPLES:
    # Run with domain flag
    $0 -d your-domain.ngrok-free.app

    # Start all agents and expose advisory agent
    $0 -d your-domain.ngrok-free.app -a

    # Use environment variable for domain
    export NGROK_DOMAIN=your-domain.ngrok-free.app
    $0

EOF
}

log_info() {
    echo -e "${CYAN}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--domain)
            NGROK_DOMAIN="$2"
            shift 2
            ;;
        -a|--all)
            START_ALL_AGENTS=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

# Check for ngrok auth token
if [ -z "$NGROK_AUTHTOKEN" ]; then
    log_error "NGROK_AUTHTOKEN environment variable is not set"
    echo "Please set it with: export NGROK_AUTHTOKEN=your-token"
    exit 1
fi

# Check for domain
if [ -z "$NGROK_DOMAIN" ]; then
    log_error "No ngrok domain specified"
    echo "Use -d flag or set NGROK_DOMAIN environment variable"
    exit 1
fi

# Export domain for ngrok config
export NGROK_DOMAIN

log_info "Starting Highnote Advisory Agent with ngrok"
log_info "Domain: $NGROK_DOMAIN"

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to start an agent
start_agent() {
    local agent_name=$1
    local agent_dir=$2
    local port=$3
    
    if check_port $port; then
        log_warning "$agent_name already running on port $port"
    else
        log_info "Starting $agent_name on port $port..."
        cd "../$agent_dir"
        nohup python src/api.py > logs/${agent_dir}.log 2>&1 &
        echo $! > logs/${agent_dir}.pid
        cd - > /dev/null
        
        # Wait for agent to start
        local count=0
        while ! check_port $port && [ $count -lt 30 ]; do
            sleep 1
            count=$((count + 1))
        done
        
        if check_port $port; then
            log_success "$agent_name started successfully"
        else
            log_error "Failed to start $agent_name"
            exit 1
        fi
    fi
}

# Start agents if requested
if [ "$START_ALL_AGENTS" = true ]; then
    log_info "Starting all agents..."
    
    # Start schema agent
    start_agent "Schema Agent" "schema-agent" 8000
    
    # Start document agent
    start_agent "Document Agent" "document-agent" 8001
    
    # Start advisory agent
    start_agent "Advisory Agent" "advisory-agent" 8002
else
    # Check if required agents are running
    if ! check_port 8000; then
        log_warning "Schema agent not running on port 8000"
        log_info "Start it manually or use -a flag to start all agents"
    fi
    
    if ! check_port 8001; then
        log_warning "Document agent not running on port 8001"
        log_info "Start it manually or use -a flag to start all agents"
    fi
    
    if ! check_port 8002; then
        log_info "Starting Advisory Agent..."
        nohup python src/api.py > logs/advisory-agent.log 2>&1 &
        echo $! > logs/advisory-agent.pid
        
        # Wait for it to start
        count=0
        while ! check_port 8002 && [ $count -lt 30 ]; do
            sleep 1
            count=$((count + 1))
        done
        
        if check_port 8002; then
            log_success "Advisory agent started"
        else
            log_error "Failed to start advisory agent"
            exit 1
        fi
    else
        log_info "Advisory agent already running on port 8002"
    fi
fi

# Start ngrok
log_info "Starting ngrok tunnel..."

# Kill any existing ngrok processes
pkill -f "ngrok http" 2>/dev/null || true

# Start ngrok with config
if [ "$VERBOSE" = true ]; then
    ngrok http 8002 --domain=$NGROK_DOMAIN --log=stdout &
else
    nohup ngrok http 8002 --domain=$NGROK_DOMAIN > logs/ngrok.log 2>&1 &
fi

NGROK_PID=$!
echo $NGROK_PID > logs/ngrok.pid

# Wait for ngrok to establish tunnel
sleep 3

# Check if ngrok is running
if kill -0 $NGROK_PID 2>/dev/null; then
    log_success "Ngrok tunnel established"
    echo ""
    echo -e "${GREEN}=====================================${NC}"
    echo -e "${GREEN}Advisory Agent is now accessible at:${NC}"
    echo -e "${BLUE}https://$NGROK_DOMAIN${NC}"
    echo -e "${GREEN}=====================================${NC}"
    echo ""
    echo "Endpoints:"
    echo "  - Chat: https://$NGROK_DOMAIN/chat"
    echo "  - Health: https://$NGROK_DOMAIN/health"
    echo "  - Docs: https://$NGROK_DOMAIN/docs"
    echo ""
    echo "Internal agents:"
    echo "  - Schema Agent: http://localhost:8000"
    echo "  - Document Agent: http://localhost:8001"
    echo "  - Advisory Agent: http://localhost:8002"
    echo ""
    echo "Ngrok Dashboard: http://localhost:4040"
    echo ""
    echo "Press Ctrl+C to stop all services"
    
    # Trap Ctrl+C to cleanup
    trap cleanup INT
    
    cleanup() {
        echo ""
        log_info "Shutting down..."
        
        # Kill ngrok
        if [ -f logs/ngrok.pid ]; then
            kill $(cat logs/ngrok.pid) 2>/dev/null || true
            rm logs/ngrok.pid
        fi
        
        if [ "$START_ALL_AGENTS" = true ]; then
            # Kill all agents
            for agent in advisory-agent document-agent schema-agent; do
                if [ -f "../$agent/logs/$agent.pid" ]; then
                    kill $(cat "../$agent/logs/$agent.pid") 2>/dev/null || true
                    rm "../$agent/logs/$agent.pid"
                fi
            done
        fi
        
        log_success "Shutdown complete"
        exit 0
    }
    
    # Keep script running
    wait $NGROK_PID
else
    log_error "Failed to start ngrok tunnel"
    exit 1
fi