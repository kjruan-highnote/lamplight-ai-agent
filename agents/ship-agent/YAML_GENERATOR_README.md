# Postman to YAML Generator

Generate program YAML configuration files from Postman collections automatically.

## Features

The generator analyzes Postman collections to create comprehensive YAML configurations with:

- **Automatic Categorization**: Groups operations by type (account management, cards, transactions, etc.)
- **Capability Detection**: Identifies program capabilities based on available operations
- **Workflow Generation**: Creates common workflows (onboarding, card issuance, transaction processing)
- **Entity Extraction**: Identifies core entities from operation names
- **Operation Classification**: Marks operations as queries/mutations and identifies required ones

## Usage

### Generate from a Single Collection

```bash
# Generate YAML for Trip.com collection
python src/postman_to_yaml_generator.py --collection "Trip.com"

# Generate with custom output path
python src/postman_to_yaml_generator.py --collection "Consumer Credit" \
  --output data/programs/consumer_credit_custom.yaml
```

### Generate for All Collections

```bash
# Process all Postman collections in the directory
python src/postman_to_yaml_generator.py --all
```

### Command Line Options

- `--collection NAME`: Postman collection name (without .json extension)
- `--output PATH`: Custom output path for generated YAML
- `--all`: Generate YAMLs for all collections
- `--postman-dir PATH`: Custom Postman collections directory
- `--programs-dir PATH`: Custom programs output directory

## Generated YAML Structure

The generator creates YAML files with the following structure:

```yaml
program_type: consumer_credit
vendor: highnote
version: 1.0.0
api_type: graphql

metadata:
  name: "Consumer Credit"
  description: "Consumer Credit program configuration"
  authentication:
    type: bearer
  generated_from: postman/Consumer Credit.postman_collection.json
  generated_at: "2025-08-08T08:29:27"

capabilities:
  - virtual_card_issuance
  - spend_controls
  - transaction_monitoring
  - kyc_verification
  - reporting_analytics

workflows:
  onboarding:
    name: "Customer Onboarding"
    steps:
      - operation: CreateUSPersonAccountHolder
        required: true
      - operation: UploadDocument
        required: false
        
  card_issuance:
    name: "Card Issuance"
    steps:
      - operation: CreateCardProduct
      - operation: IssuePaymentCard
      - operation: ActivatePaymentCard

entities:
  - name: Account
    primary: true
  - name: Card
    primary: true
  - name: Transaction
    primary: true

categories:
  - name: account_management
    display_name: "Account Management"
    operations:
      - name: CreateUSPersonAccountHolder
        type: mutation
        required: true
      - name: GetAccountHolder
        type: query
        required: false
```

## How It Works

1. **Loads Postman Collection**: Reads the JSON file containing API operations
2. **Extracts Operations**: Recursively processes folders and requests
3. **Analyzes GraphQL**: Determines operation types (query/mutation)
4. **Categorizes**: Groups operations by functional area
5. **Detects Capabilities**: Identifies what the program can do
6. **Generates Workflows**: Creates step-by-step processes
7. **Identifies Entities**: Extracts core data objects
8. **Outputs YAML**: Saves structured configuration file

## Customization

After generation, you can manually refine the YAML:

1. **Adjust Workflows**: Add conditions, reorder steps
2. **Fine-tune Categories**: Reorganize operations
3. **Add Compliance**: Include specific standards and regulations
4. **Set Performance**: Define rate limits and SLAs
5. **Update Metadata**: Add descriptions and documentation

## Examples

### Generated Files

- `trip_com_generated.yaml`: 77 operations, 8 capabilities, 2 workflows
- `consumer_credit_generated.yaml`: 143 operations, 10 capabilities, 3 workflows

### Integration with Solution Generator

Once generated, use the YAML with the modular solution generator:

```bash
# Generate solution document using the new YAML
python src/modular_solution_generator.py --program consumer_credit_generated

# With customer context
python src/modular_solution_generator.py --program trip_com_generated --customer trip_com
```

## Best Practices

1. **Review Generated YAML**: Always review and refine the generated configuration
2. **Add Business Context**: Supplement with customer-specific context files
3. **Version Control**: Track changes to YAML configurations
4. **Test Workflows**: Validate that generated workflows match actual processes
5. **Document Changes**: Add comments for manual modifications

## Troubleshooting

- **Collection Not Found**: Ensure the Postman collection exists in `data/postman/`
- **Empty Workflows**: Add more operations to the Postman collection
- **Missing Categories**: Operations may need clearer naming conventions
- **Incorrect Types**: Verify GraphQL queries start with `query` or `mutation`