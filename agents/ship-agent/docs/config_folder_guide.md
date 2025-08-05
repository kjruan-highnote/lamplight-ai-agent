# Config Folder Guide

## Overview

The `config/` folder contains configuration files that drive the unified generator to create various assets for different programs. These files act as instructions for what to generate and how to configure the outputs.

## Purpose

The config folder serves as:
1. **Configuration Storage**: Stores reusable generation configurations
2. **Batch Processing**: Enables automated generation of multiple assets
3. **Version Control**: Tracks generation configurations over time
4. **Customization**: Allows fine-tuned control over generation parameters

## File Formats

The unified generator accepts two formats:

### 1. YAML Format (.yaml)
More human-readable, supports comments, preferred for complex configurations.

### 2. JSON Format (.json)
More compact, better for programmatic generation, strict syntax.

## Configuration Types

### 1. Collection Generation
Generates Postman collections, test data, and related assets.

```yaml
type: collection
config:
  program_type: consumer_credit
  dimensions:
    customer: "ABC Bank"
    environment: sandbox
    region: us-east
  options:
    categories:
      - person_account_holder
      - payment_cards
    flows:
      - standard_onboarding
outputs:
  - collection
  - yaml
  - test_data
  - solutions
  - summary
```

### 2. YAML from Operations
Generates enhanced YAML configuration from existing operations.

```json
{
  "type": "yaml_from_operations",
  "operations_file": "data/operations/trip.com_operations.json"
}
```

### 3. Solutions Document Generation
Generates solutions documentation from Postman collections.

```yaml
type: solutions
postman_file: data/postman/Consumer Credit.postman_collection.json
customer: "ABC Bank"
program_type: consumer_credit
sections:
  - header
  - executive_summary
  - api_reference
```

### 4. Batch Generation
Processes multiple configurations in one run.

```yaml
type: batch
batch:
  - program_type: consumer_credit
    dimensions:
      customer: "Bank A"
    outputs: [collection, summary]
  - program_type: commercial_prepaid
    dimensions:
      customer: "Bank B"
    outputs: [collection, yaml]
```

## Configuration Structure

### Root Level
- `type`: Specifies generation type (collection, solutions, yaml_from_operations, batch)
- `config`: Main configuration object (for collection type)
- `outputs`: List of assets to generate

### Config Section
- `program_type`: Must match a program in `data/programs/`
- `dimensions`: Customer-specific parameters
- `options`: Generation options and filters

### Dimensions
Common dimensions include:
- `customer`: Customer/client name
- `environment`: sandbox, production, staging
- `region`: Geographic region
- `integration`: Integration type or platform
- `use_case`: Specific use case description

### Options
- `categories`: List of operation categories to include
- `flows`: Predefined operation flows
- `features`: Feature flags for the program
- `solutions_sections`: Sections to include in solutions document

## Example Files in Config Folder

### trip_com_complete_e2e.yaml
Complete end-to-end generation with all assets and custom sections.

### trip_com_correct_generation.yaml
Corrected configuration using proper program type identifier.

### trip_com_full_generation.yaml
Full asset generation with all available categories.

### trip_com_yaml_generation.json
Simple JSON config for generating YAML from operations.

## Usage

### Command Line
```bash
python src/unified_generator.py config/config_file.yaml
```

### Validation
```bash
python src/unified_generator.py config/config_file.yaml --validate
```

### Show Sample
```bash
python src/unified_generator.py --sample
```

## Best Practices

1. **Naming Convention**: Use descriptive names like `{customer}_{purpose}.yaml`
2. **Version Control**: Commit input files to track configuration changes
3. **Comments**: Use YAML format and add comments for complex configurations
4. **Validation**: Always validate before running large batch operations
5. **Reusability**: Create template configurations for common patterns

## Output Mapping

| Output Type | Generated File | Location |
|------------|----------------|----------|
| collection | {program_type}_collection.json | data/generated/{customer}/ |
| yaml | {program_type}_operations.yaml | data/generated/{customer}/ |
| test_data | {program_type}_test_data.json | data/generated/{customer}/ |
| solutions | {program_type}_solution.md | data/generated/{customer}/ |
| summary | {program_type}_summary.txt | data/generated/{customer}/ |

## Troubleshooting

### Common Issues

1. **Program Type Not Found**
   - Ensure program_type matches a file in `data/programs/`
   - Check for typos or case sensitivity

2. **Invalid Categories**
   - Categories must exist in the program's operations
   - Use Grep tool to find available categories

3. **Missing Required Fields**
   - Check error messages for missing fields
   - Refer to examples for proper structure

4. **Output Directory Issues**
   - Ensure write permissions for output directory
   - Check disk space availability

## Advanced Features

### Custom Sections
Configure which sections appear in solutions documents:
```yaml
options:
  solutions_sections:
    - header
    - executive_summary
    - api_reference
    - security_compliance
```

### Feature Flags
Enable specific features for the generation:
```yaml
options:
  features:
    - virtual_cards
    - multi_currency
    - real_time_auth
    - webhook_notifications
```

### Environment Variables
Reference environment variables in configurations:
```yaml
dimensions:
  api_key: ${API_KEY}
  environment: ${ENV:-sandbox}
```

## Integration with CI/CD

Config files can be used in automated pipelines:

```bash
# Generate assets for all customers
for config in config/*_production.yaml; do
  python src/unified_generator.py "$config"
done
```

## Summary

The config folder provides a flexible, version-controlled way to manage asset generation configurations. By using structured input files, teams can:
- Standardize generation processes
- Track configuration changes
- Automate asset creation
- Ensure consistency across projects