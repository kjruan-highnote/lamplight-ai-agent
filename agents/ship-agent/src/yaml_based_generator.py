#!/usr/bin/env python3
"""
YAML-based Collection Generator
Accepts a YAML configuration file and generates both Postman collection and operations YAML
"""
import yaml
import json
import asyncio
from pathlib import Path
from typing import Dict, Any
import argparse
from datetime import datetime

from ship_agent_simplified import SimplifiedShipAgent


class YAMLBasedGenerator:
    """
    Generator that uses YAML input to create collections and operation files
    """
    
    def __init__(self, output_dir: str = "data/generated"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.ship_agent = SimplifiedShipAgent()
        
    async def generate_from_yaml(self, config_file: str) -> Dict[str, str]:
        """
        Generate collection and operations YAML from configuration file
        
        Args:
            config_file: Path to YAML configuration file
            
        Returns:
            Dict with paths to generated files
        """
        # Load configuration
        with open(config_file, 'r') as f:
            config = yaml.safe_load(f)
        
        # Validate configuration
        self._validate_config(config)
        
        # Extract configuration
        program_type = config['program_type']
        dimensions = config.get('dimensions', {})
        options = config.get('options', {})
        
        # Generate customer-specific output directory
        customer_name = dimensions.get('customer', 'default')
        customer_dir = self.output_dir / customer_name.lower().replace(' ', '_')
        customer_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate Postman collection
        collection = await self.ship_agent.generate_collection(
            program_type=program_type,
            dimensions=dimensions,
            options=options
        )
        
        # Save Postman collection
        collection_file = customer_dir / f"{program_type}_collection.json"
        with open(collection_file, 'w') as f:
            json.dump(collection, f, indent=2)
        
        # Generate operations YAML
        operations_yaml = self._generate_operations_yaml(
            program_type, dimensions, options, collection
        )
        
        # Save operations YAML
        operations_file = customer_dir / f"{program_type}_operations.yaml"
        with open(operations_file, 'w') as f:
            yaml.dump(operations_yaml, f, default_flow_style=False, sort_keys=False, width=120)
        
        # Generate summary report
        summary = self._generate_summary(config, collection, collection_file, operations_file)
        summary_file = customer_dir / f"{program_type}_summary.txt"
        with open(summary_file, 'w') as f:
            f.write(summary)
        
        print(f"✅ Generation complete!")
        print(f"📁 Output directory: {customer_dir}")
        print(f"📄 Postman collection: {collection_file.name}")
        print(f"📄 Operations YAML: {operations_file.name}")
        print(f"📄 Summary: {summary_file.name}")
        
        return {
            'collection': str(collection_file),
            'operations': str(operations_file),
            'summary': str(summary_file)
        }
    
    def _validate_config(self, config: Dict[str, Any]) -> None:
        """Validate the configuration file"""
        if 'program_type' not in config:
            raise ValueError("Configuration must include 'program_type'")
        
        if 'dimensions' not in config:
            config['dimensions'] = {}
        
        if 'customer' not in config['dimensions']:
            raise ValueError("Configuration must include 'dimensions.customer'")
    
    def _generate_operations_yaml(self, program_type: str, dimensions: Dict[str, Any], 
                                 options: Dict[str, Any], collection: Dict[str, Any]) -> Dict[str, Any]:
        """Generate operations YAML from collection data"""
        operations_yaml = {
            'metadata': {
                'program_type': program_type,
                'customer': dimensions.get('customer', 'Unknown'),
                'generated_at': datetime.now().isoformat(),
                'generator_version': '1.0.0'
            },
            'dimensions': dimensions,
            'options': options,
            'operations': {}
        }
        
        # Extract operations from collection
        for folder in collection.get('item', []):
            if folder.get('item'):  # It's a folder
                category_name = folder['name']
                operations_yaml['operations'][category_name] = []
                
                for operation in folder.get('item', []):
                    op_data = {
                        'name': operation.get('name', 'Unknown'),
                        'method': operation.get('request', {}).get('method', 'POST'),
                        'description': operation.get('description', '')
                    }
                    
                    # Extract GraphQL details if available
                    body = operation.get('request', {}).get('body', {})
                    if body.get('mode') == 'graphql':
                        graphql = body.get('graphql', {})
                        op_data['graphql'] = {
                            'query': graphql.get('query', ''),
                            'variables': graphql.get('variables', {})
                        }
                    
                    operations_yaml['operations'][category_name].append(op_data)
        
        # Add flows if specified
        if 'flows' in options:
            operations_yaml['flows'] = options['flows']
        
        return operations_yaml
    
    def _generate_summary(self, config: Dict[str, Any], collection: Dict[str, Any],
                         collection_file: Path, operations_file: Path) -> str:
        """Generate a summary report"""
        total_operations = 0
        categories_summary = []
        
        for folder in collection.get('item', []):
            if folder.get('item'):
                count = len(folder.get('item', []))
                total_operations += count
                categories_summary.append(f"  - {folder['name']}: {count} operations")
        
        summary = f"""Collection Generation Summary
{'=' * 50}
Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Configuration:
  Program Type: {config['program_type']}
  Customer: {config.get('dimensions', {}).get('customer', 'Unknown')}
  Environment: {config.get('dimensions', {}).get('environment', 'Not specified')}

Results:
  Total Operations: {total_operations}
  Categories: {len(categories_summary)}
{chr(10).join(categories_summary)}

Generated Files:
  - Postman Collection: {collection_file.name}
  - Operations YAML: {operations_file.name}

Dimensions Applied:
{yaml.dump(config.get('dimensions', {}), default_flow_style=False).strip()}

Options Applied:
{yaml.dump(config.get('options', {}), default_flow_style=False).strip()}
"""
        return summary


def main():
    """Main function for CLI usage"""
    parser = argparse.ArgumentParser(
        description='Generate Postman collection and operations YAML from configuration file'
    )
    parser.add_argument('config_file', help='YAML configuration file')
    parser.add_argument('--output-dir', default='data/generated', 
                       help='Output directory for generated files')
    
    args = parser.parse_args()
    
    generator = YAMLBasedGenerator(args.output_dir)
    
    try:
        asyncio.run(generator.generate_from_yaml(args.config_file))
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())