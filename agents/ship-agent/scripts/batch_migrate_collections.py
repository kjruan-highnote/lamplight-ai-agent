#!/usr/bin/env python3
"""
Batch migrate all exported Postman collections
"""
import json
import sys
from pathlib import Path
from typing import Dict, List

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from src.postman_to_mongodb_migrator import PostmanToMongoDBMigrator


def determine_program_type(collection_name: str) -> str:
    """Determine program type from collection name"""
    name_lower = collection_name.lower()
    
    # Direct mappings
    mappings = {
        'consumer credit': 'consumer_credit',
        'consumer prepaid': 'consumer_prepaid',
        'commercial credit': 'commercial_credit',
        'commercial prepaid': 'commercial_prepaid',
        'commercial charge': 'commercial_charge',
        'consumer charge': 'consumer_charge',
        'acquiring': 'acquiring',
        'ap automation': 'ap_automation',
        'fleet': 'fleet',
        'rewards': 'rewards',
        'onboarding': 'onboarding'
    }
    
    # Check each mapping
    for key, value in mappings.items():
        if key in name_lower:
            return value
    
    # Customer-specific programs
    if 'stellarfi' in name_lower and 'ap' in name_lower:
        return 'stellarfi_ap'
    elif 'airbills' in name_lower:
        return 'airbills_ap'
    elif 'casspay' in name_lower:
        return 'casspay_ap'
    elif 'runa' in name_lower:
        return 'runa_prepaid'
    elif 'witt' in name_lower:
        return 'witt_prepaid'
    elif 'rellevate' in name_lower:
        return 'rellevate_paycard'
    elif 'golfcard' in name_lower:
        return 'golfcard'
    elif 'roadflex' in name_lower:
        return 'roadflex'
    elif 'highnote corp expense' in name_lower:
        return 'corporate_expense'
    
    # Clean name for use as program type
    clean_name = name_lower.replace(' - ', '_').replace(' ', '_').replace('(', '').replace(')', '')
    return clean_name


def batch_migrate():
    """Migrate all collections in the auto_export directory"""
    
    # Load export summary
    export_dir = Path("data/postman/auto_export")
    summary_files = list(export_dir.glob("export_summary_*.json"))
    
    if not summary_files:
        print("No export summary found!")
        return
    
    # Use most recent summary
    latest_summary = sorted(summary_files)[-1]
    
    with open(latest_summary, 'r') as f:
        summary = json.load(f)
    
    print(f"Processing {summary['exported']} collections from {latest_summary.name}")
    print("=" * 60)
    
    # Initialize migrator
    migrator = PostmanToMongoDBMigrator()
    
    # Track statistics
    stats = {
        'total_collections': 0,
        'total_operations': 0,
        'by_program_type': {}
    }
    
    # Process each collection
    for collection_name, info in summary['collections'].items():
        print(f"\nProcessing: {collection_name}")
        
        # Determine program type
        program_type = determine_program_type(collection_name)
        print(f"  Program type: {program_type}")
        
        # Get file path
        file_path = Path(info['file'])
        if not file_path.exists():
            # Try with absolute path
            file_path = Path(__file__).parent.parent / info['file']
        
        if file_path.exists():
            try:
                # Migrate collection
                result = migrator.migrate_collection(str(file_path), program_type)
                
                operations_count = result['total_operations']
                print(f"  ✓ Migrated {operations_count} operations")
                
                # Update stats
                stats['total_collections'] += 1
                stats['total_operations'] += operations_count
                
                if program_type not in stats['by_program_type']:
                    stats['by_program_type'][program_type] = {
                        'collections': 0,
                        'operations': 0
                    }
                
                stats['by_program_type'][program_type]['collections'] += 1
                stats['by_program_type'][program_type]['operations'] += operations_count
                
            except Exception as e:
                print(f"  ✗ Error: {e}")
        else:
            print(f"  ✗ File not found: {file_path}")
    
    # Print summary
    print("\n" + "=" * 60)
    print("Migration Summary")
    print("=" * 60)
    print(f"Total collections processed: {stats['total_collections']}")
    print(f"Total operations extracted: {stats['total_operations']}")
    print(f"\nBy program type:")
    
    for program_type, type_stats in sorted(stats['by_program_type'].items()):
        print(f"  {program_type}:")
        print(f"    Collections: {type_stats['collections']}")
        print(f"    Operations: {type_stats['operations']}")
    
    # Save migration summary
    summary_file = Path("data/operations/migration_summary.json")
    with open(summary_file, 'w') as f:
        json.dump(stats, f, indent=2)
    
    print(f"\nMigration summary saved to: {summary_file}")


def create_yaml_configs():
    """Create YAML configuration files for each program type"""
    
    # Get unique program types from operations directory
    operations_dir = Path("data/operations")
    program_types = set()
    
    for json_file in operations_dir.glob("*_operations.json"):
        program_type = json_file.stem.replace('_operations', '')
        program_types.add(program_type)
    
    print(f"\nCreating YAML configs for {len(program_types)} program types...")
    
    yaml_template = """# {program_type_title} Program Configuration
program_type: {program_type}
vendor: highnote
version: "1.0.0"
api_type: graphql

metadata:
  description: "{program_type_title} Program - Highnote"
  base_url: "{{{{apiUrl}}}}"
  authentication:
    type: "bearer"
    header: "Authorization"

# Categories will be auto-populated from operations
categories: []

# Define your program-specific dimensions
dimensions:
  customer_segments: []
  program_variants: []
  features: []

# Define operation flows for common use cases
operation_flows:
  standard_flow:
    description: "Standard flow for {program_type}"
    steps: []

tags:
  - {program_type}
  - graphql
  - highnote
"""
    
    programs_dir = Path("data/programs")
    programs_dir.mkdir(exist_ok=True)
    
    for program_type in sorted(program_types):
        yaml_file = programs_dir / f"{program_type}.yaml"
        
        if not yaml_file.exists():
            program_type_title = program_type.replace('_', ' ').title()
            
            content = yaml_template.format(
                program_type=program_type,
                program_type_title=program_type_title
            )
            
            with open(yaml_file, 'w') as f:
                f.write(content)
            
            print(f"  Created: {yaml_file}")


if __name__ == "__main__":
    # Run batch migration
    batch_migrate()
    
    # Create YAML configs
    create_yaml_configs()
    
    print("\n✅ Batch migration complete!")