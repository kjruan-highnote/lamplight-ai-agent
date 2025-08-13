#!/bin/bash

# Postman Collections Sync Script
# Automates syncing of Postman collections and updating program YAMLs

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SOLUTION_GEN_DIR="$PROJECT_ROOT/solution-generator"

# Default action
ACTION="${1:-help}"

print_header() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  Postman Collections Sync Automation${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""
}

print_usage() {
    cat << EOF
Usage: $0 [command] [options]

Commands:
    setup       Install dependencies and initialize configuration
    init        Initialize or update configuration
    run         Run sync manually
    start       Start scheduled sync (runs in foreground)
    daemon      Start as background daemon
    stop        Stop background daemon
    status      Check sync status
    list        List all collections in workspace
    test        Test extraction on a single collection
    backup      Create manual backup of programs
    restore     Restore from backup
    help        Show this help message

Options:
    -c, --config    Path to configuration file
    -v, --verbose   Verbose output

Examples:
    $0 setup                    # First time setup
    $0 run                      # Manual sync
    $0 start                    # Start scheduled sync
    $0 daemon                   # Run as background service
    $0 test collection.json     # Test extraction

Environment Variables:
    POSTMAN_API_KEY         Your Postman API key
    POSTMAN_WORKSPACE_ID    Your Postman workspace ID

EOF
}

# Check Node.js installation
check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Error: Node.js is not installed${NC}"
        echo "Please install Node.js version 18.0.0 or higher"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${RED}Error: Node.js version 18.0.0 or higher required${NC}"
        echo "Current version: $(node -v)"
        exit 1
    fi
}

# Setup function
setup() {
    print_header
    echo -e "${BLUE}Setting up Postman Sync...${NC}\n"
    
    check_node
    
    cd "$SOLUTION_GEN_DIR"
    
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
    
    echo -e "${YELLOW}Building TypeScript...${NC}"
    npm run build
    
    echo -e "${GREEN}✓ Setup complete${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Set environment variables:"
    echo "     export POSTMAN_API_KEY=your-api-key"
    echo "     export POSTMAN_WORKSPACE_ID=your-workspace-id"
    echo "  2. Initialize configuration:"
    echo "     $0 init"
    echo "  3. Run sync:"
    echo "     $0 run"
}

# Initialize configuration
init_config() {
    print_header
    cd "$SOLUTION_GEN_DIR"
    npx tsx src/cli/postman-sync.ts init
}

# Run sync manually
run_sync() {
    print_header
    echo -e "${BLUE}Running manual sync...${NC}\n"
    cd "$SOLUTION_GEN_DIR"
    
    if [ -n "$CONFIG_FILE" ]; then
        npx tsx src/cli/postman-sync.ts run -c "$CONFIG_FILE"
    else
        npx tsx src/cli/postman-sync.ts run
    fi
}

# Start scheduled sync
start_scheduled() {
    print_header
    echo -e "${BLUE}Starting scheduled sync...${NC}"
    echo -e "${GRAY}Press Ctrl+C to stop${NC}\n"
    cd "$SOLUTION_GEN_DIR"
    
    if [ -n "$CONFIG_FILE" ]; then
        npx tsx src/cli/postman-sync.ts start -c "$CONFIG_FILE"
    else
        npx tsx src/cli/postman-sync.ts start
    fi
}

# Start as daemon
start_daemon() {
    print_header
    echo -e "${BLUE}Starting sync daemon...${NC}\n"
    
    cd "$SOLUTION_GEN_DIR"
    
    # Check if already running
    if [ -f "$PROJECT_ROOT/.postman-sync.pid" ]; then
        PID=$(cat "$PROJECT_ROOT/.postman-sync.pid")
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${YELLOW}Sync daemon is already running (PID: $PID)${NC}"
            exit 0
        fi
    fi
    
    # Start in background
    nohup npx tsx src/cli/postman-sync.ts start > "$PROJECT_ROOT/postman-sync.log" 2>&1 &
    PID=$!
    echo $PID > "$PROJECT_ROOT/.postman-sync.pid"
    
    echo -e "${GREEN}✓ Sync daemon started (PID: $PID)${NC}"
    echo -e "  Log file: $PROJECT_ROOT/postman-sync.log"
    echo -e "  Stop with: $0 stop"
}

# Stop daemon
stop_daemon() {
    if [ -f "$PROJECT_ROOT/.postman-sync.pid" ]; then
        PID=$(cat "$PROJECT_ROOT/.postman-sync.pid")
        if ps -p $PID > /dev/null 2>&1; then
            kill $PID
            rm "$PROJECT_ROOT/.postman-sync.pid"
            echo -e "${GREEN}✓ Sync daemon stopped${NC}"
        else
            echo -e "${YELLOW}Sync daemon not running${NC}"
            rm "$PROJECT_ROOT/.postman-sync.pid"
        fi
    else
        echo -e "${YELLOW}No daemon PID file found${NC}"
    fi
}

# Check status
check_status() {
    print_header
    cd "$SOLUTION_GEN_DIR"
    
    # Check daemon status
    if [ -f "$PROJECT_ROOT/.postman-sync.pid" ]; then
        PID=$(cat "$PROJECT_ROOT/.postman-sync.pid")
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "Daemon Status: ${GREEN}Running${NC} (PID: $PID)"
        else
            echo -e "Daemon Status: ${RED}Not running${NC}"
        fi
    else
        echo -e "Daemon Status: ${YELLOW}Not started${NC}"
    fi
    echo ""
    
    # Check sync status
    npx tsx src/cli/postman-sync.ts status
}

# List collections
list_collections() {
    print_header
    cd "$SOLUTION_GEN_DIR"
    npx tsx src/cli/postman-sync.ts list
}

# Test extraction
test_extraction() {
    if [ -z "$2" ]; then
        echo -e "${RED}Error: Please provide a collection file${NC}"
        echo "Usage: $0 test <collection.json>"
        exit 1
    fi
    
    print_header
    cd "$SOLUTION_GEN_DIR"
    npx tsx src/cli/postman-sync.ts test -f "$2"
}

# Create backup
create_backup() {
    print_header
    echo -e "${BLUE}Creating backup...${NC}\n"
    
    BACKUP_DIR="$PROJECT_ROOT/data/backups/manual/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup programs
    if [ -d "$PROJECT_ROOT/data/programs" ]; then
        cp -r "$PROJECT_ROOT/data/programs" "$BACKUP_DIR/"
        echo -e "${GREEN}✓ Backed up programs${NC}"
    fi
    
    # Backup operations
    if [ -d "$PROJECT_ROOT/data/operations" ]; then
        cp -r "$PROJECT_ROOT/data/operations" "$BACKUP_DIR/"
        echo -e "${GREEN}✓ Backed up operations${NC}"
    fi
    
    echo -e "\nBackup saved to: ${BLUE}$BACKUP_DIR${NC}"
}

# Restore from backup
restore_backup() {
    print_header
    echo -e "${BLUE}Available backups:${NC}\n"
    
    BACKUP_BASE="$PROJECT_ROOT/data/backups"
    
    # List available backups
    find "$BACKUP_BASE" -maxdepth 2 -type d -name "[0-9]*" | sort -r | head -10 | while read dir; do
        echo "  $(basename $(dirname "$dir"))/$(basename "$dir")"
    done
    
    echo ""
    read -p "Enter backup to restore (or 'cancel'): " BACKUP_CHOICE
    
    if [ "$BACKUP_CHOICE" = "cancel" ]; then
        echo -e "${YELLOW}Restore cancelled${NC}"
        exit 0
    fi
    
    RESTORE_DIR="$BACKUP_BASE/$BACKUP_CHOICE"
    
    if [ ! -d "$RESTORE_DIR" ]; then
        echo -e "${RED}Error: Backup not found${NC}"
        exit 1
    fi
    
    # Restore files
    if [ -d "$RESTORE_DIR/programs" ]; then
        cp -r "$RESTORE_DIR/programs/"* "$PROJECT_ROOT/data/programs/"
        echo -e "${GREEN}✓ Restored programs${NC}"
    fi
    
    if [ -d "$RESTORE_DIR/operations" ]; then
        cp -r "$RESTORE_DIR/operations/"* "$PROJECT_ROOT/data/operations/"
        echo -e "${GREEN}✓ Restored operations${NC}"
    fi
    
    echo -e "\n${GREEN}✓ Restore complete${NC}"
}

# Parse arguments
CONFIG_FILE=""
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -c|--config)
            CONFIG_FILE="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        *)
            break
            ;;
    esac
done

ACTION="${1:-help}"

# Execute action
case $ACTION in
    setup)
        setup
        ;;
    init)
        init_config
        ;;
    run)
        run_sync
        ;;
    start)
        start_scheduled
        ;;
    daemon)
        start_daemon
        ;;
    stop)
        stop_daemon
        ;;
    status)
        check_status
        ;;
    list)
        list_collections
        ;;
    test)
        test_extraction "$@"
        ;;
    backup)
        create_backup
        ;;
    restore)
        restore_backup
        ;;
    help|--help|-h)
        print_usage
        ;;
    *)
        echo -e "${RED}Error: Unknown command '$ACTION'${NC}"
        echo ""
        print_usage
        exit 1
        ;;
esac