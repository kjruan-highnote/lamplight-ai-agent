#!/bin/bash

# ============================================================================
# Solution Generator Feedback Processor
# 
# This script processes customer feedback from edited markdown documents,
# analyzes changes, updates configurations, and optionally regenerates
# the solution with improvements incorporated.
#
# Usage: ./process-feedback.sh [options] <edited-md-file>
# ============================================================================

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
PROGRAM_TYPE=""
CUSTOMER_NAME=""
SESSION_ID=""
AUTO_APPLY=false
REGENERATE=false
EXPORT_HTML=false
EXPORT_PDF=false
VERBOSE=false
DRY_RUN=false
BACKUP=true
INTERACTIVE=false

# Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$PROJECT_ROOT/../data"
BACKUP_DIR="$DATA_DIR/backups"
SESSIONS_DIR="$DATA_DIR/feedback-sessions"

# ============================================================================
# Functions
# ============================================================================

print_usage() {
    cat << EOF
Usage: $0 [OPTIONS] <edited-markdown-file>

Process customer feedback from an edited solution document.

OPTIONS:
    -p, --program <type>      Program type (e.g., ap_automation)
    -c, --customer <name>     Customer name (e.g., trip_com)
    -s, --session <id>        Existing session ID (optional)
    -a, --auto-apply          Automatically apply high-confidence changes
    -r, --regenerate          Regenerate solution after applying feedback
    -h, --html                Export to HTML format
    -f, --pdf                 Export to PDF format
    -i, --interactive         Interactive mode with prompts
    -n, --no-backup           Skip creating backups
    -d, --dry-run             Analyze only, don't apply changes
    -v, --verbose             Verbose output
    --help                    Show this help message

EXAMPLES:
    # Basic feedback processing
    $0 -p ap_automation -c trip_com edited_solution.md

    # Auto-apply changes and regenerate with HTML export
    $0 -p ap_automation -c trip_com -a -r -h edited_solution.md

    # Interactive mode
    $0 -i edited_solution.md

    # Dry run to preview changes
    $0 -p ap_automation -c trip_com -d edited_solution.md

EOF
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
}

# Validate required commands
check_dependencies() {
    local deps=("node" "npm" "git")
    local missing=()
    
    for cmd in "${deps[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing+=("$cmd")
        fi
    done
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required dependencies: ${missing[*]}"
        log_info "Please install missing dependencies and try again."
        exit 1
    fi
}

# Extract metadata from filename
extract_metadata() {
    local filename="$1"
    local basename=$(basename "$filename" .md)
    
    # Try to parse filename pattern: <program>_solution_<date>.md
    if [[ $basename =~ ^([^_]+)_solution_.*$ ]]; then
        PROGRAM_TYPE="${BASH_REMATCH[1]}"
        log_verbose "Extracted program type: $PROGRAM_TYPE"
    fi
    
    # Extract customer from path if possible
    local dir=$(dirname "$filename")
    if [[ $dir =~ /([^/]+)/[^/]+$ ]]; then
        CUSTOMER_NAME="${BASH_REMATCH[1]}"
        log_verbose "Extracted customer name: $CUSTOMER_NAME"
    fi
}

# Interactive mode prompts
run_interactive() {
    echo -e "\n${CYAN}=== Interactive Feedback Processor ===${NC}\n"
    
    # Program type
    if [ -z "$PROGRAM_TYPE" ]; then
        echo -n "Enter program type (e.g., ap_automation): "
        read PROGRAM_TYPE
    else
        echo -n "Program type [$PROGRAM_TYPE]: "
        read input
        [ -n "$input" ] && PROGRAM_TYPE="$input"
    fi
    
    # Customer name
    if [ -z "$CUSTOMER_NAME" ]; then
        echo -n "Enter customer name (e.g., trip_com): "
        read CUSTOMER_NAME
    else
        echo -n "Customer name [$CUSTOMER_NAME]: "
        read input
        [ -n "$input" ] && CUSTOMER_NAME="$input"
    fi
    
    # Auto-apply
    echo -n "Automatically apply high-confidence changes? (y/N): "
    read input
    [[ "$input" =~ ^[Yy]$ ]] && AUTO_APPLY=true
    
    # Regenerate
    echo -n "Regenerate solution after applying feedback? (y/N): "
    read input
    [[ "$input" =~ ^[Yy]$ ]] && REGENERATE=true
    
    # Export formats
    if [ "$REGENERATE" = true ]; then
        echo -n "Export to HTML? (y/N): "
        read input
        [[ "$input" =~ ^[Yy]$ ]] && EXPORT_HTML=true
        
        echo -n "Export to PDF? (y/N): "
        read input
        [[ "$input" =~ ^[Yy]$ ]] && EXPORT_PDF=true
    fi
    
    echo ""
}

# Create backup of original files
create_backup() {
    if [ "$BACKUP" = false ]; then
        return
    fi
    
    log_info "Creating backups..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_subdir="$BACKUP_DIR/$timestamp"
    mkdir -p "$backup_subdir"
    
    # Backup context file
    local context_file="$DATA_DIR/contexts/triplink_context_v2.json"
    if [ -f "$context_file" ]; then
        cp "$context_file" "$backup_subdir/"
        log_verbose "Backed up context file"
    fi
    
    # Backup program config
    local program_file="$DATA_DIR/programs/${PROGRAM_TYPE}.yaml"
    if [ -f "$program_file" ]; then
        cp "$program_file" "$backup_subdir/"
        log_verbose "Backed up program config"
    fi
    
    log_success "Backups created in $backup_subdir"
}

# Check for existing session
find_session() {
    if [ -n "$SESSION_ID" ]; then
        return
    fi
    
    # Look for active sessions for this document
    if [ -d "$SESSIONS_DIR" ]; then
        for session_file in "$SESSIONS_DIR"/session_*.json; do
            if [ -f "$session_file" ]; then
                if grep -q "\"status\": \"active\"" "$session_file" && \
                   grep -q "\"programType\": \"$PROGRAM_TYPE\"" "$session_file" 2>/dev/null && \
                   grep -q "\"customerName\": \"$CUSTOMER_NAME\"" "$session_file" 2>/dev/null; then
                    SESSION_ID=$(basename "$session_file" .json)
                    log_info "Found existing session: $SESSION_ID"
                    return
                fi
            fi
        done
    fi
}

# Start a new feedback session
start_session() {
    log_info "Starting feedback session..."
    
    local output=$(cd "$PROJECT_ROOT" && npm run generate -- feedback-start \
        --document "$EDITED_FILE" \
        --program "$PROGRAM_TYPE" \
        --customer "$CUSTOMER_NAME" 2>&1)
    
    # Extract session ID from output
    SESSION_ID=$(echo "$output" | grep -o 'session_[0-9]*' | head -1)
    
    if [ -n "$SESSION_ID" ]; then
        log_success "Started session: $SESSION_ID"
    else
        log_error "Failed to start feedback session"
        echo "$output"
        exit 1
    fi
}

# Analyze changes
analyze_changes() {
    log_info "Analyzing document changes..."
    
    local output=$(cd "$PROJECT_ROOT" && npm run generate -- feedback-analyze \
        --document "$EDITED_FILE" 2>&1)
    
    local report_path=$(echo "$output" | grep -o '[^[:space:]]*diff_report_[0-9]*.md' | tail -1)
    
    if [ -n "$report_path" ]; then
        log_success "Analysis complete: $report_path"
        
        if [ "$VERBOSE" = true ]; then
            echo -e "\n${CYAN}=== Change Summary ===${NC}"
            head -20 "$DATA_DIR/feedback/$report_path" 2>/dev/null || head -20 "$report_path"
            echo -e "${CYAN}===================${NC}\n"
        fi
        
        ANALYSIS_REPORT="$report_path"
    else
        log_warning "Could not generate analysis report"
    fi
}

# Process feedback
process_feedback() {
    if [ "$DRY_RUN" = true ]; then
        log_info "Dry run mode - changes will not be applied"
        return
    fi
    
    log_info "Processing feedback..."
    
    local cmd="cd \"$PROJECT_ROOT\" && npm run generate -- feedback-process"
    cmd="$cmd --session \"$SESSION_ID\""
    cmd="$cmd --document \"$EDITED_FILE\""
    
    if [ "$AUTO_APPLY" = true ]; then
        cmd="$cmd --auto-apply"
    fi
    
    if [ "$REGENERATE" = true ]; then
        cmd="$cmd --regenerate"
    fi
    
    local output=$(eval $cmd 2>&1)
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        log_success "Feedback processed successfully"
        
        # Extract any generated file paths
        local generated_files=$(echo "$output" | grep -o '[^[:space:]]*\.md' | grep generated || true)
        if [ -n "$generated_files" ]; then
            GENERATED_MD="$generated_files"
            log_success "Generated: $GENERATED_MD"
        fi
    else
        log_error "Failed to process feedback"
        echo "$output"
        return 1
    fi
}

# Regenerate solution
regenerate_solution() {
    if [ "$REGENERATE" = false ] || [ "$DRY_RUN" = true ]; then
        return
    fi
    
    log_info "Regenerating solution..."
    
    local cmd="cd \"$PROJECT_ROOT\" && npm run generate -- generate"
    cmd="$cmd --program \"$PROGRAM_TYPE\""
    cmd="$cmd --customer \"$CUSTOMER_NAME\""
    
    # Determine format
    if [ "$EXPORT_PDF" = true ]; then
        cmd="$cmd --format pdf"
    elif [ "$EXPORT_HTML" = true ]; then
        cmd="$cmd --format html"
    else
        cmd="$cmd --format markdown"
    fi
    
    local output=$(eval $cmd 2>&1)
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        log_success "Solution regenerated"
        
        # Extract generated file paths
        local generated_md=$(echo "$output" | grep -o '[^[:space:]]*\.md' | tail -1)
        local generated_html=$(echo "$output" | grep -o '[^[:space:]]*\.html' | tail -1)
        local generated_pdf=$(echo "$output" | grep -o '[^[:space:]]*\.pdf' | tail -1)
        
        [ -n "$generated_md" ] && log_success "Markdown: $generated_md"
        [ -n "$generated_html" ] && log_success "HTML: $generated_html"
        [ -n "$generated_pdf" ] && log_success "PDF: $generated_pdf"
        
        GENERATED_MD="$generated_md"
        GENERATED_HTML="$generated_html"
        GENERATED_PDF="$generated_pdf"
    else
        log_error "Failed to regenerate solution"
        echo "$output"
        return 1
    fi
}

# Export to additional formats
export_formats() {
    if [ "$DRY_RUN" = true ] || [ -z "$GENERATED_MD" ]; then
        return
    fi
    
    # Export to HTML if requested and not already done
    if [ "$EXPORT_HTML" = true ] && [ -z "$GENERATED_HTML" ]; then
        log_info "Exporting to HTML..."
        
        local output=$(cd "$PROJECT_ROOT" && npm run generate -- generate \
            --program "$PROGRAM_TYPE" \
            --customer "$CUSTOMER_NAME" \
            --format html 2>&1)
        
        local html_file=$(echo "$output" | grep -o '[^[:space:]]*\.html' | tail -1)
        if [ -n "$html_file" ]; then
            GENERATED_HTML="$html_file"
            log_success "HTML exported: $html_file"
        fi
    fi
    
    # Export to PDF if requested and not already done
    if [ "$EXPORT_PDF" = true ] && [ -z "$GENERATED_PDF" ]; then
        log_info "Exporting to PDF..."
        
        local output=$(cd "$PROJECT_ROOT" && npm run generate -- generate \
            --program "$PROGRAM_TYPE" \
            --customer "$CUSTOMER_NAME" \
            --format pdf 2>&1)
        
        local pdf_file=$(echo "$output" | grep -o '[^[:space:]]*\.pdf' | tail -1)
        if [ -n "$pdf_file" ]; then
            GENERATED_PDF="$pdf_file"
            log_success "PDF exported: $pdf_file"
        fi
    fi
}

# Show summary
show_summary() {
    echo -e "\n${GREEN}=== Feedback Processing Complete ===${NC}\n"
    
    echo "Session ID: $SESSION_ID"
    echo "Program: $PROGRAM_TYPE"
    echo "Customer: $CUSTOMER_NAME"
    
    if [ -n "$ANALYSIS_REPORT" ]; then
        echo "Analysis Report: $ANALYSIS_REPORT"
    fi
    
    if [ "$DRY_RUN" = true ]; then
        echo -e "\n${YELLOW}Dry run completed - no changes were applied${NC}"
    else
        echo -e "\nGenerated Files:"
        [ -n "$GENERATED_MD" ] && echo "  - Markdown: $GENERATED_MD"
        [ -n "$GENERATED_HTML" ] && echo "  - HTML: $GENERATED_HTML"
        [ -n "$GENERATED_PDF" ] && echo "  - PDF: $GENERATED_PDF"
    fi
    
    echo -e "\n${GREEN}✓ All operations completed successfully${NC}"
}

# ============================================================================
# Main Script
# ============================================================================

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -p|--program)
                PROGRAM_TYPE="$2"
                shift 2
                ;;
            -c|--customer)
                CUSTOMER_NAME="$2"
                shift 2
                ;;
            -s|--session)
                SESSION_ID="$2"
                shift 2
                ;;
            -a|--auto-apply)
                AUTO_APPLY=true
                shift
                ;;
            -r|--regenerate)
                REGENERATE=true
                shift
                ;;
            -h|--html)
                EXPORT_HTML=true
                shift
                ;;
            -f|--pdf)
                EXPORT_PDF=true
                shift
                ;;
            -i|--interactive)
                INTERACTIVE=true
                shift
                ;;
            -n|--no-backup)
                BACKUP=false
                shift
                ;;
            -d|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            --help)
                print_usage
                exit 0
                ;;
            *)
                EDITED_FILE="$1"
                shift
                ;;
        esac
    done
    
    # Validate input file
    if [ -z "$EDITED_FILE" ]; then
        log_error "No input file specified"
        print_usage
        exit 1
    fi
    
    if [ ! -f "$EDITED_FILE" ]; then
        log_error "File not found: $EDITED_FILE"
        exit 1
    fi
    
    # Make path absolute
    EDITED_FILE="$(cd "$(dirname "$EDITED_FILE")" && pwd)/$(basename "$EDITED_FILE")"
    
    # Check dependencies
    check_dependencies
    
    # Try to extract metadata from filename
    extract_metadata "$EDITED_FILE"
    
    # Run interactive mode if requested
    if [ "$INTERACTIVE" = true ]; then
        run_interactive
    fi
    
    # Validate required parameters
    if [ -z "$PROGRAM_TYPE" ] || [ -z "$CUSTOMER_NAME" ]; then
        log_error "Program type and customer name are required"
        echo "Use -p <program> -c <customer> or -i for interactive mode"
        exit 1
    fi
    
    echo -e "\n${CYAN}=== Processing Feedback for $CUSTOMER_NAME ===${NC}\n"
    
    # Create backups
    create_backup
    
    # Find or start session
    find_session
    if [ -z "$SESSION_ID" ]; then
        start_session
    fi
    
    # Analyze changes
    analyze_changes
    
    # Process feedback
    process_feedback
    
    # Regenerate solution if requested
    regenerate_solution
    
    # Export additional formats
    export_formats
    
    # Show summary
    show_summary
}

# Run main function
main "$@"