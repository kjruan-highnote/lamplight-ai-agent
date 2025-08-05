# Config Folder

This folder contains configuration files for the unified generator. These configurations control what assets are generated and how they're configured.

## File Organization

### Program-Specific Configurations
- `consumer_credit_config.yaml` - Consumer credit card program generation
- `ap_automation_config.yaml` - AP automation program generation
- `trip_com_*.yaml` - Trip.com specific configurations

### Generation Type Examples
- `collection_generation.yaml` - Example of collection generation with all outputs
- `solutions_generation.yaml` - Example of solutions document generation
- `yaml_from_operations.json` - Example of YAML generation from operations
- `batch_generation.yaml` - Example of batch processing multiple configs

### Special Configurations
- `collection_with_solutions.yaml` - Combined collection and solutions generation
- `sample_generation_config.yaml` - Sample configuration template

## Usage

```bash
# Generate assets using a config file
python src/unified_generator.py config/consumer_credit_config.yaml

# Validate a config file
python src/unified_generator.py config/trip_com_complete_e2e.yaml --validate

# Show sample configuration
python src/unified_generator.py --sample
```

## Config File Structure

```yaml
type: collection|solutions|yaml_from_operations|batch
config:
  program_type: <program_name>
  dimensions:
    customer: "Customer Name"
    environment: production|sandbox
    # ... other dimensions
  options:
    categories: [...]
    flows: [...]
    features: [...]
outputs:
  - collection
  - yaml
  - test_data
  - solutions
  - summary
```

## Best Practices

1. Use descriptive file names: `{customer}_{purpose}_config.yaml`
2. Include comments in YAML files to explain complex configurations
3. Test configurations with `--validate` before running
4. Keep customer-specific configs organized with consistent naming

## See Also

- [Config Folder Guide](../docs/config_folder_guide.md) - Detailed documentation
- [Solutions Generator Guide](../docs/solutions_generator_guide.md) - Solutions document configuration