# Solutions Document Generator Guide

## Overview

The Solutions Document Generator creates professional, customizable documentation from Postman collections. It has been refactored to follow SOLID principles and allows users to configure which sections to include in the generated documents.

## Architecture

The generator follows these design principles:

### Single Responsibility Principle (SRP)
- Each section has its own class responsible only for generating that specific section
- `CollectionAnalyzer` handles collection analysis
- `SectionRegistry` manages section registration and ordering
- `SolutionsDocumentGenerator` orchestrates the generation process

### Open/Closed Principle (OCP)
- New sections can be added by creating new classes implementing `SectionGenerator`
- Existing code doesn't need modification to add new sections

### Liskov Substitution Principle (LSP)
- All section generators implement the `SectionGenerator` abstract base class
- Any section can be substituted for another without breaking the system

### Interface Segregation Principle (ISP)
- `SectionGenerator` interface is minimal with only essential methods
- Sections don't depend on methods they don't use

### Dependency Inversion Principle (DIP)
- High-level generator depends on abstract `SectionGenerator` interface
- Concrete sections depend on the same abstraction

## Available Sections

| Section ID | Section Name | Description |
|------------|--------------|-------------|
| `header` | Document Header | Title, version, date, and metadata |
| `executive_summary` | Executive Summary | Overview, key capabilities, and benefits |
| `table_of_contents` | Table of Contents | Auto-generated based on enabled sections |
| `technical_overview` | Technical Overview | Architecture, entities, operations, statistics |
| `use_cases` | Use Cases | Primary and secondary use cases |
| `implementation_flows` | Implementation Flows | Workflows and integration patterns |
| `api_reference` | API Operations Reference | Detailed operations by category |
| `integration_guide` | Integration Guide | Prerequisites, quick start, best practices |
| `security_compliance` | Security and Compliance | Security architecture and standards |
| `appendices` | Appendices | Glossary, error codes, resources |

## Usage

### Command Line Interface

```bash
# List available sections
python solutions_document_generator.py --list-sections

# Generate with all sections (default)
python solutions_document_generator.py collection.json --customer "ABC Bank"

# Generate with specific sections only
python solutions_document_generator.py collection.json \
  --customer "ABC Bank" \
  --sections header executive_summary api_reference

# Specify program type
python solutions_document_generator.py collection.json \
  --customer "ABC Bank" \
  --program-type consumer_credit \
  --sections header technical_overview api_reference integration_guide
```

### Programmatic Usage

```python
from solutions_document_generator import SolutionsDocumentGenerator

# Create generator with default sections
generator = SolutionsDocumentGenerator()

# Generate with all sections
output_path = generator.generate_from_postman(
    "collection.json",
    customer_name="ABC Bank",
    program_type="consumer_credit"
)

# Generate with specific sections
output_path = generator.generate_from_postman(
    "collection.json",
    customer_name="ABC Bank",
    program_type="consumer_credit",
    sections=["header", "executive_summary", "api_reference"]
)

# Get available sections
sections = generator.get_available_sections()
for section_id, section_name in sections.items():
    print(f"{section_id}: {section_name}")
```

### Using with Unified Generator

The unified generator supports section configuration through input files:

```yaml
# YAML configuration
type: solutions
postman_file: path/to/collection.json
customer: "ABC Bank"
program_type: consumer_credit
sections:
  - header
  - executive_summary
  - use_cases
  - api_reference
```

```json
// JSON configuration
{
  "type": "solutions",
  "postman_file": "path/to/collection.json",
  "customer": "ABC Bank",
  "program_type": "consumer_credit",
  "sections": [
    "header",
    "executive_summary",
    "use_cases",
    "api_reference"
  ]
}
```

## Creating Custom Sections

To add a new section, create a class that inherits from `SectionGenerator`:

```python
from solutions_document_generator import SectionGenerator

class CustomSection(SectionGenerator):
    def get_section_id(self) -> str:
        return "custom_section"
    
    def get_section_name(self) -> str:
        return "Custom Section"
    
    def generate(self, collection_name: str, customer_name: Optional[str], 
                 program_type: str, analysis: Dict[str, Any]) -> str:
        return f"""## Custom Section
        
This is a custom section for {customer_name or 'the customer'}.

Program Type: {program_type}
Total Operations: {analysis['total_operations']}
"""

# Register the section
generator = SolutionsDocumentGenerator()
custom_section = CustomSection()
generator.registry.register(custom_section, order=7)  # Insert at position 7
```

## Section Selection Strategies

### Minimal Documentation
For quick reference or API-only documentation:
- `header`
- `api_reference`

### Executive Summary
For stakeholder presentations:
- `header`
- `executive_summary`
- `use_cases`
- `appendices`

### Technical Documentation
For development teams:
- `header`
- `technical_overview`
- `implementation_flows`
- `api_reference`
- `integration_guide`

### Compliance Package
For security and compliance reviews:
- `header`
- `executive_summary`
- `security_compliance`
- `appendices`

### Full Documentation
For comprehensive program documentation:
- All sections (default behavior)

## Output Structure

Documents are saved in customer-specific folders:
```
data/generated/
├── abc_bank/
│   ├── consumer_credit_solution.md
│   └── commercial_credit_solution.md
├── trip.com/
│   └── travel_services_solution.md
└── default/
    └── financial_services_solution.md
```

## Best Practices

1. **Section Selection**: Choose sections based on your audience and purpose
2. **Program Type**: Let the generator infer from collection name or specify explicitly
3. **Customer Names**: Use consistent naming for proper folder organization
4. **Custom Sections**: Add custom sections for organization-specific content
5. **Batch Processing**: Use the unified generator for processing multiple collections

## Examples

See `data/examples/solutions_config_example.yaml` for configuration examples.