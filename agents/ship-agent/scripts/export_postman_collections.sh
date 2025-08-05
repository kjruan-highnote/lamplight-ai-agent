#!/bin/bash
# Script to export Postman collections using Newman and Postman API

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Postman Collection Auto-Exporter${NC}"
echo "=================================="

# Check if required tools are installed
check_requirements() {
    echo -e "\n${YELLOW}Checking requirements...${NC}"
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Node.js is not installed!${NC}"
        echo "Install Node.js from: https://nodejs.org/"
        exit 1
    fi
    
    # Check for npm
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}npm is not installed!${NC}"
        exit 1
    fi
    
    # Check for newman
    if ! command -v newman &> /dev/null; then
        echo -e "${YELLOW}Newman is not installed. Installing...${NC}"
        npm install -g newman
    fi
    
    echo -e "${GREEN}✓ All requirements met${NC}"
}

# Install Postman CLI (official tool)
install_postman_cli() {
    echo -e "\n${YELLOW}Installing Postman CLI...${NC}"
    
    # Check OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if ! command -v postman &> /dev/null; then
            echo "Installing Postman CLI via curl..."
            curl -o- "https://dl-cli.pstmn.io/install/osx_arm64.sh" | sh
        else
            echo -e "${GREEN}✓ Postman CLI already installed${NC}"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -o- "https://dl-cli.pstmn.io/install/linux64.sh" | sh
    else
        echo -e "${RED}Unsupported OS. Please install Postman CLI manually.${NC}"
        echo "Visit: https://learning.postman.com/docs/postman-cli/postman-cli-installation/"
        exit 1
    fi
}

# Export using Postman API
export_via_api() {
    echo -e "\n${YELLOW}Exporting collections via Postman API...${NC}"
    
    # Check for API key
    if [ -z "$POSTMAN_API_KEY" ]; then
        echo -e "${RED}POSTMAN_API_KEY environment variable not set!${NC}"
        echo "To get your API key:"
        echo "1. Go to https://postman.com"
        echo "2. Click on your avatar -> Settings"
        echo "3. Go to API keys tab"
        echo "4. Generate a new API key"
        echo "5. Run: export POSTMAN_API_KEY='your-api-key'"
        exit 1
    fi
    
    # Use Python script
    python3 ../src/postman_auto_exporter.py
}

# Export using Postman CLI
export_via_cli() {
    echo -e "\n${YELLOW}Exporting collections via Postman CLI...${NC}"
    
    # Login to Postman
    echo "Logging in to Postman..."
    postman login
    
    # List collections
    echo -e "\n${YELLOW}Available collections:${NC}"
    postman collection list
    
    # Export all collections
    OUTPUT_DIR="../data/postman/cli_export"
    mkdir -p "$OUTPUT_DIR"
    
    echo -e "\n${YELLOW}Exporting collections to $OUTPUT_DIR${NC}"
    
    # This would need to be enhanced to loop through collections
    # For now, it's a manual process
    echo "To export a specific collection:"
    echo "  postman collection export <collection-id> -o $OUTPUT_DIR/<collection-name>.json"
}

# Main menu
show_menu() {
    echo -e "\n${GREEN}Export Options:${NC}"
    echo "1. Export via Postman API (Python script)"
    echo "2. Export via Postman CLI"
    echo "3. Install/Update tools"
    echo "4. Exit"
    
    read -p "Select option (1-4): " choice
    
    case $choice in
        1)
            export_via_api
            ;;
        2)
            export_via_cli
            ;;
        3)
            check_requirements
            install_postman_cli
            ;;
        4)
            echo -e "${GREEN}Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            show_menu
            ;;
    esac
}

# Run
check_requirements
show_menu