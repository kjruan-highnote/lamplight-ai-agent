# Ship Agent

A flexible, plugin-based pattern generation and context management system for creating program-specific API collections.

## Overview

The Ship Agent is designed to:
- Parse and extract patterns from multiple data sources (Postman, MongoDB, Confluence, etc.)
- Learn from examples and corrections
- Generate program-specific queries and mutations
- Create customized Postman collections for different program types
- Support unlimited program types and data sources through plugins

## Architecture

### Plugin-Based System
Everything in Ship Agent is a plugin:
- **Data Source Plugins**: Connect to any data source (Postman, MongoDB, APIs, etc.)
- **Program Type Plugins**: Define rules for any program (credit, acquiring, AP automation, etc.)
- **Generator Plugins**: Output in any format (Postman, Insomnia, GraphQL, etc.)
- **Processor Plugins**: Transform data as needed
- **Validator Plugins**: Custom validation logic

### Flexible Context Management
- No fixed schema - adapts to any data structure
- Dynamic dimensions (customer, program type, region, etc.)
- Learning from corrections and feedback
- Pattern extraction and inference

## API Endpoints

### Context Management
- `POST /context/dimension` - Add new categorization dimension
- `POST /context/source` - Add data source
- `POST /context/pattern` - Add pattern
- `POST /context/correction` - Submit correction for learning
- `POST /context/query` - Query context with filters
- `GET /context/status` - Get context statistics

### Plugin Management
- `GET /plugins` - List available plugins
- `POST /plugins/register` - Register new plugin dynamically
- `POST /plugins/reload/{type}/{name}` - Reload a plugin

### Generation
- `POST /generate/queries` - Generate queries for program type
- `POST /generate/collection` - Generate complete Postman collection
- `POST /generate/test-data` - Generate test data

### File Upload
- `POST /upload/postman` - Upload Postman collection
- `POST /upload/confluence` - Upload Confluence documentation

## Usage Examples

### 1. Upload a Postman Collection
```bash
curl -X POST http://localhost:8003/upload/postman \
  -F "file=@collection.json"
```

### 2. Add a New Program Type
```bash
curl -X POST http://localhost:8003/plugins/register \
  -H "Content-Type: application/json" \
  -d '{
    "plugin_type": "program_types",
    "name": "expense_management",
    "definition": {
      "rules": {...},
      "patterns": {...}
    }
  }'
```

### 3. Generate Collection for Specific Program
```bash
curl -X POST http://localhost:8003/generate/collection \
  -H "Content-Type: application/json" \
  -d '{
    "program_type": "acquiring",
    "dimensions": {
      "customer": "MerchantX",
      "segment": "commercial"
    },
    "output_format": "postman"
  }'
```

### 4. Submit Correction for Learning
```bash
curl -X POST http://localhost:8003/context/correction \
  -H "Content-Type: application/json" \
  -d '{
    "original": {...},
    "corrected": {...},
    "reason": "Missing authentication headers",
    "context": {
      "program_type": "credit",
      "customer": "BankY"
    }
  }'
```

## Adding New Plugins

### Create a Data Source Plugin
```python
# plugins/data_sources/my_source.py
from src.plugin_base import DataSourcePlugin

class MySourcePlugin(DataSourcePlugin):
    def extract_patterns(self, query=None):
        # Extract patterns from your source
        return {'patterns': {...}}
```

### Create a Program Type Plugin
```python
# plugins/program_types/my_program.py
from src.plugin_base import ProgramTypePlugin

class MyProgramPlugin(ProgramTypePlugin):
    def get_rules(self):
        return {...}
    
    def get_patterns(self):
        return {...}
```

## Configuration

Edit `config/config.json` to:
- Enable/disable plugins
- Configure integrations
- Set learning parameters
- Adjust logging levels

## Installation

```bash
pip install -r requirements.txt
```

## Running

The Ship Agent is automatically started with other agents using:
```bash
./scripts/start_all_agents.sh
```

Or run standalone:
```bash
python src/api.py
```

## Integration with Other Agents

Ship Agent integrates with:
- **Schema Agent**: Validates generated queries
- **Document Agent**: Gets business rules and examples
- **Advisory Agent**: Provides generation capabilities

## Future Enhancements

- Machine learning for pattern recognition
- Advanced relationship detection
- Automatic test data generation
- Support for more output formats
- Real-time pattern learning