#!/usr/bin/env python3
"""
Summarize the generated YAML configurations
"""
import yaml
from pathlib import Path
from typing import Dict, List


def analyze_yaml_configs():
    """Analyze and summarize all YAML configuration files"""
    
    programs_dir = Path("data/programs")
    
    # Key program types to analyze
    key_programs = [
        'consumer_credit',
        'commercial_credit',
        'consumer_prepaid',
        'commercial_prepaid',
        'ap_automation',
        'fleet',
        'rewards'
    ]
    
    print("YAML Configuration Summary")
    print("=" * 80)
    
    for program in key_programs:
        yaml_file = programs_dir / f"{program}.yaml"
        
        if yaml_file.exists():
            with open(yaml_file, 'r') as f:
                config = yaml.safe_load(f)
            
            print(f"\n{program.upper().replace('_', ' ')}")
            print("-" * 40)
            
            # Count operations
            total_operations = 0
            categories = config.get('categories', [])
            
            print(f"Categories: {len(categories)}")
            
            # Show first 5 categories
            for i, category in enumerate(categories[:5]):
                ops_count = len(category.get('operations', []))
                total_operations += ops_count
                print(f"  - {category['name']}: {ops_count} operations")
            
            if len(categories) > 5:
                # Count remaining operations
                for category in categories[5:]:
                    total_operations += len(category.get('operations', []))
                print(f"  ... and {len(categories) - 5} more categories")
            
            # Count total operations across all categories
            total_ops_all_categories = sum(len(cat.get('operations', [])) for cat in categories)
            print(f"Total Operations: {total_ops_all_categories}")
            
            # Show operation flows
            flows = config.get('operation_flows', {})
            print(f"\nOperation Flows: {len(flows)}")
            for flow_name, flow_data in list(flows.items())[:3]:
                steps = flow_data.get('steps', [])
                print(f"  - {flow_name}: {len(steps)} steps")
            
            # Show dimensions
            dimensions = config.get('dimensions', {})
            print(f"\nDimensions: {len(dimensions)}")
            for dim_name, dim_values in dimensions.items():
                if isinstance(dim_values, list):
                    print(f"  - {dim_name}: {len(dim_values)} values")
                else:
                    print(f"  - {dim_name}")
    
    # Overall statistics
    print("\n" + "=" * 80)
    print("OVERALL STATISTICS")
    print("=" * 80)
    
    all_yamls = list(programs_dir.glob("*.yaml"))
    print(f"Total YAML configurations: {len(all_yamls)}")
    
    # Count operations across all programs
    total_operations_all = 0
    for yaml_file in all_yamls:
        with open(yaml_file, 'r') as f:
            try:
                config = yaml.safe_load(f)
                categories = config.get('categories', [])
                for category in categories:
                    total_operations_all += len(category.get('operations', []))
            except:
                pass
    
    print(f"Total operations across all programs: {total_operations_all}")
    
    # List all available program types
    print("\nAll Available Program Types:")
    for yaml_file in sorted(all_yamls):
        program_name = yaml_file.stem
        print(f"  - {program_name}")


def show_example_usage():
    """Show example usage of the Ship agent with the new configs"""
    
    print("\n" + "=" * 80)
    print("EXAMPLE USAGE")
    print("=" * 80)
    
    print("""
# 1. Generate a collection for a specific customer
from src.ship_agent import ShipAgent

ship_agent = ShipAgent()

# Consumer Credit for a new bank
collection = await ship_agent.generate_collection(
    program_type='consumer_credit',
    dimensions={
        'customer': 'FirstNationalBank',
        'environment': 'sandbox',
        'segment': 'prime'
    },
    options={
        'categories': ['onboarding', 'issuance', 'transactions']
    }
)

# 2. Generate AP Automation collection
collection = await ship_agent.generate_collection(
    program_type='ap_automation',
    dimensions={
        'customer': 'TechStartupX',
        'integration': 'quickbooks'
    }
)

# 3. Generate test data for specific operations
test_data = await ship_agent.generate_test_data(
    program_type='commercial_prepaid',
    dimensions={'customer': 'CorporateClient'},
    options={
        'operations': ['CreateBusinessAccountHolder', 'IssuePaymentCard']
    }
)
""")


if __name__ == "__main__":
    analyze_yaml_configs()
    show_example_usage()