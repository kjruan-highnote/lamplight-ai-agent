#!/usr/bin/env python3
"""
Unified Generator - Accepts structured JSON/YAML files for generation
Supports multiple input and output formats
"""
import yaml
import json
import asyncio
from pathlib import Path
from typing import Dict, Any, List, Optional, Union
import argparse
from datetime import datetime
from collections import defaultdict
import re

from ship_agent_simplified import SimplifiedShipAgent
from solutions_document_generator import SolutionsDocumentGenerator


class UnifiedGenerator:
    """
    Unified generator that accepts structured input files (JSON/YAML) and generates:
    - Postman collections
    - Program YAML configurations
    - Operations documentation
    - Summary reports
    """
    
    def __init__(self, data_dir: str = "data", output_dir: str = "data/generated"):
        self.data_dir = Path(data_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.ship_agent = SimplifiedShipAgent()
        self.solutions_generator = SolutionsDocumentGenerator(output_dir=output_dir)
        
        # Directories for different data types
        self.operations_dir = self.data_dir / "operations"
        self.programs_dir = self.data_dir / "programs"
        
    async def generate_from_file(self, input_file: str) -> Dict[str, str]:
        """
        Generate outputs from a structured input file (JSON or YAML)
        
        Args:
            input_file: Path to input file (JSON or YAML)
            
        Returns:
            Dict of generated file paths
        """
        # Load input file
        input_data = self._load_input_file(input_file)
        
        # Validate input structure
        self._validate_input(input_data)
        
        # Extract configuration
        config = input_data.get('config', {})
        program_type = config.get('program_type')
        dimensions = config.get('dimensions', {})
        options = config.get('options', {})
        outputs = input_data.get('outputs', ['collection', 'summary'])
        
        # Handle different generation types
        generation_type = input_data.get('type', 'collection')
        
        if generation_type == 'yaml_from_operations':
            # Generate YAML config from operations
            operations_file = input_data.get('operations_file')
            if not operations_file:
                raise ValueError("operations_file required for yaml_from_operations type")
            return await self._generate_yaml_from_operations(operations_file)
            
        elif generation_type == 'collection':
            # Generate collection and other outputs
            return await self._generate_collection_outputs(
                program_type, dimensions, options, outputs
            )
            
        elif generation_type == 'batch':
            # Batch process multiple configurations
            batch_configs = input_data.get('batch', [])
            return await self._generate_batch(batch_configs)
            
        elif generation_type == 'solutions':
            # Generate solutions document from Postman collection
            postman_file = input_data.get('postman_file')
            if not postman_file:
                raise ValueError("postman_file required for solutions type")
            
            customer = input_data.get('customer')
            program_type = input_data.get('program_type')
            sections = input_data.get('sections')  # Optional list of section IDs
            
            output_path = self.solutions_generator.generate_from_postman(
                postman_file, customer, program_type, sections
            )
            return {'solutions_document': output_path}
            
        else:
            raise ValueError(f"Unknown generation type: {generation_type}")
    
    def _load_input_file(self, file_path: str) -> Dict[str, Any]:
        """Load JSON or YAML input file"""
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"Input file not found: {file_path}")
        
        with open(path, 'r') as f:
            if path.suffix.lower() in ['.yaml', '.yml']:
                return yaml.safe_load(f)
            elif path.suffix.lower() == '.json':
                return json.load(f)
            else:
                # Try to parse as YAML first, then JSON
                content = f.read()
                try:
                    return yaml.safe_load(content)
                except yaml.YAMLError:
                    try:
                        return json.loads(content)
                    except json.JSONDecodeError:
                        raise ValueError(f"Unable to parse file as YAML or JSON: {file_path}")
    
    def _validate_input(self, input_data: Dict[str, Any]) -> None:
        """Validate input structure"""
        # Check required fields based on type
        generation_type = input_data.get('type', 'collection')
        
        if generation_type == 'collection':
            if 'config' not in input_data:
                raise ValueError("'config' section required for collection generation")
            
            config = input_data['config']
            if 'program_type' not in config:
                raise ValueError("'program_type' required in config")
            
            if 'dimensions' in config and 'customer' not in config['dimensions']:
                raise ValueError("'customer' required in dimensions")
                
        elif generation_type == 'yaml_from_operations':
            if 'operations_file' not in input_data:
                raise ValueError("'operations_file' required for yaml_from_operations")
                
        elif generation_type == 'batch':
            if 'batch' not in input_data or not isinstance(input_data['batch'], list):
                raise ValueError("'batch' array required for batch generation")
                
        elif generation_type == 'solutions':
            if 'postman_file' not in input_data:
                raise ValueError("'postman_file' required for solutions generation")
    
    async def _generate_collection_outputs(self, 
                                         program_type: str,
                                         dimensions: Dict[str, Any],
                                         options: Dict[str, Any],
                                         outputs: List[str]) -> Dict[str, str]:
        """Generate collection and related outputs"""
        # Create customer-specific directory
        customer_name = dimensions.get('customer', 'default')
        customer_dir = self.output_dir / customer_name.lower().replace(' ', '_')
        customer_dir.mkdir(parents=True, exist_ok=True)
        
        results = {}
        collection = None
        
        # Generate Postman collection
        if 'collection' in outputs:
            collection = await self.ship_agent.generate_collection(
                program_type=program_type,
                dimensions=dimensions,
                options=options
            )
            
            collection_file = customer_dir / f"{program_type}_collection.json"
            with open(collection_file, 'w') as f:
                json.dump(collection, f, indent=2)
            
            results['collection'] = str(collection_file)
            print(f"✅ Generated collection: {collection_file}")
        
        # Generate operations YAML
        if 'yaml' in outputs:
            ops_yaml = self._create_operations_yaml(
                program_type, dimensions, options, collection
            )
            
            ops_file = customer_dir / f"{program_type}_operations.yaml"
            with open(ops_file, 'w') as f:
                yaml.dump(ops_yaml, f, default_flow_style=False, sort_keys=False)
            
            results['yaml'] = str(ops_file)
            print(f"✅ Generated operations YAML: {ops_file}")
        
        # Generate summary
        if 'summary' in outputs:
            summary = self._create_summary(
                program_type, dimensions, options, collection, results
            )
            
            summary_file = customer_dir / f"{program_type}_summary.txt"
            with open(summary_file, 'w') as f:
                f.write(summary)
            
            results['summary'] = str(summary_file)
            print(f"✅ Generated summary: {summary_file}")
        
        # Generate test data
        if 'test_data' in outputs:
            test_data = await self.ship_agent.generate_test_data(
                program_type=program_type,
                dimensions=dimensions,
                options=options
            )
            
            test_file = customer_dir / f"{program_type}_test_data.json"
            with open(test_file, 'w') as f:
                json.dump(test_data, f, indent=2)
            
            results['test_data'] = str(test_file)
            print(f"✅ Generated test data: {test_file}")
        
        # Generate solutions document if requested
        if 'solutions' in outputs:
            # First ensure we have a collection
            if not collection:
                collection = await self.ship_agent.generate_collection(
                    program_type=program_type,
                    dimensions=dimensions,
                    options=options
                )
            
            # Save collection temporarily
            temp_collection = customer_dir / f"{program_type}_temp_collection.json"
            with open(temp_collection, 'w') as f:
                json.dump(collection, f, indent=2)
            
            # Generate solutions document (it will be saved in the same customer directory)
            # Check if there's a sections configuration in options
            sections = options.get('solutions_sections')
            solutions_path = self.solutions_generator.generate_from_postman(
                str(temp_collection),
                dimensions.get('customer'),
                program_type,
                sections
            )
            
            # Remove temp file
            temp_collection.unlink()
            
            results['solutions'] = solutions_path
            print(f"✅ Generated solutions document: {solutions_path}")
        
        return results
    
    async def _generate_yaml_from_operations(self, operations_file: str) -> Dict[str, str]:
        """Generate YAML configuration from operations JSON"""
        # Load operations
        with open(operations_file, 'r') as f:
            operations = json.load(f)
        
        # Determine program type
        program_type = Path(operations_file).stem.replace('_operations', '')
        
        # Analyze operations
        analysis = self._analyze_operations(operations)
        
        # Generate YAML structure
        yaml_config = self._create_yaml_structure(program_type, analysis, operations)
        
        # Save YAML
        output_file = self.programs_dir / f"{program_type}.yaml"
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w') as f:
            yaml.dump(yaml_config, f, default_flow_style=False, sort_keys=False, width=120)
        
        print(f"✅ Generated YAML config: {output_file}")
        return {'yaml': str(output_file)}
    
    async def _generate_batch(self, batch_configs: List[Dict[str, Any]]) -> Dict[str, str]:
        """Process multiple configurations in batch"""
        results = {}
        
        for i, config in enumerate(batch_configs):
            print(f"\nProcessing batch item {i+1}/{len(batch_configs)}...")
            
            program_type = config.get('program_type')
            dimensions = config.get('dimensions', {})
            options = config.get('options', {})
            outputs = config.get('outputs', ['collection', 'summary'])
            
            if not program_type:
                print(f"  ⚠️  Skipping item {i+1}: missing program_type")
                continue
            
            try:
                batch_results = await self._generate_collection_outputs(
                    program_type, dimensions, options, outputs
                )
                results[f"batch_{i+1}"] = batch_results
            except Exception as e:
                print(f"  ❌ Error processing item {i+1}: {e}")
                results[f"batch_{i+1}_error"] = str(e)
        
        return results
    
    def _analyze_operations(self, operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze operations to extract patterns"""
        analysis = {
            'categories': defaultdict(list),
            'operation_types': defaultdict(int),
            'entity_types': set(),
            'action_types': set()
        }
        
        for op in operations:
            category = op.get('metadata', {}).get('category', 'uncategorized')
            category = self._normalize_category(category)
            analysis['categories'][category].append(op.get('name', 'Unknown'))
            
            op_type = op.get('operation_type', 'unknown')
            analysis['operation_types'][op_type] += 1
            
            entities, actions = self._extract_patterns_from_name(op.get('name', ''))
            analysis['entity_types'].update(entities)
            analysis['action_types'].update(actions)
        
        return analysis
    
    def _normalize_category(self, category: str) -> str:
        """Normalize category name"""
        category = re.sub(r'[^\w\s]', '', category)
        category = re.sub(r'\s+', '_', category)
        return category.lower()
    
    def _extract_patterns_from_name(self, op_name: str) -> tuple:
        """Extract entity and action patterns"""
        entities = set()
        actions = set()
        
        entity_patterns = [
            'AccountHolder', 'Account', 'Card', 'Transaction', 'Payment',
            'Application', 'Document', 'Statement', 'Transfer', 'Webhook'
        ]
        
        action_patterns = [
            'Create', 'Get', 'Update', 'Delete', 'Issue', 'Activate',
            'Suspend', 'Close', 'Approve', 'Deny', 'Simulate'
        ]
        
        for entity in entity_patterns:
            if entity in op_name:
                entities.add(entity)
        
        for action in action_patterns:
            if op_name.startswith(action):
                actions.add(action)
        
        return entities, actions
    
    def _create_yaml_structure(self, program_type: str, 
                              analysis: Dict[str, Any],
                              operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Create YAML structure from analysis"""
        yaml_config = {
            'program_type': program_type,
            'vendor': 'highnote',
            'version': '1.0.0',
            'api_type': 'graphql',
            'metadata': {
                'description': f"{program_type.replace('_', ' ').title()} Program - Highnote",
                'base_url': '{{apiUrl}}',
                'authentication': {
                    'type': 'bearer',
                    'header': 'Authorization'
                }
            },
            'categories': self._create_categories(analysis['categories']),
            'dimensions': self._create_dimensions(program_type, analysis),
            'operation_flows': self._create_flows(program_type, analysis),
            'tags': self._create_tags(program_type)
        }
        
        return yaml_config
    
    def _create_categories(self, categories: Dict[str, List[str]]) -> List[Dict[str, Any]]:
        """Create categories section"""
        category_list = []
        
        for name, ops in sorted(categories.items(), key=lambda x: len(x[1]), reverse=True):
            category_list.append({
                'name': name,
                'description': f"{name.replace('_', ' ').title()} operations",
                'operations': sorted(ops)
            })
        
        return category_list
    
    def _create_dimensions(self, program_type: str, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Create dimensions based on program type"""
        dimensions = {}
        
        if 'consumer' in program_type:
            dimensions['customer_segments'] = ['retail', 'premium', 'student', 'senior']
        elif 'commercial' in program_type:
            dimensions['customer_segments'] = ['small_business', 'mid_market', 'enterprise']
        
        if 'credit' in program_type:
            dimensions['risk_tiers'] = ['prime', 'near_prime', 'subprime']
            dimensions['program_variants'] = ['standard_credit', 'rewards_cashback', 'secured_credit']
        elif 'prepaid' in program_type:
            dimensions['program_variants'] = ['general_purpose', 'payroll', 'gift']
            dimensions['funding_sources'] = ['direct_deposit', 'ach_transfer', 'card_load']
        
        if any(cat for cat in analysis['categories'] if 'card' in cat.lower()):
            dimensions['card_types'] = ['physical', 'virtual', 'both']
        
        return dimensions
    
    def _create_flows(self, program_type: str, analysis: Dict[str, Any]) -> Dict[str, Any]:
        """Create operation flows"""
        flows = {}
        
        flows['standard_onboarding'] = {
            'description': f"Standard onboarding flow for {program_type.replace('_', ' ')}",
            'steps': self._get_onboarding_steps(program_type, analysis['categories'])
        }
        
        if any('Card' in op for ops in analysis['categories'].values() for op in ops):
            flows['card_issuance'] = {
                'description': "Payment card issuance and activation",
                'steps': ['IssuePaymentCard', 'ActivatePaymentCard']
            }
        
        return flows
    
    def _get_onboarding_steps(self, program_type: str, categories: Dict[str, List[str]]) -> List[str]:
        """Get onboarding steps based on available operations"""
        steps = []
        
        if 'consumer' in program_type:
            for ops in categories.values():
                if 'CreatePersonAccountHolder' in ops:
                    steps.append('CreatePersonAccountHolder')
                    break
        elif 'commercial' in program_type:
            for ops in categories.values():
                if 'CreateBusinessAccountHolder' in ops:
                    steps.append('CreateBusinessAccountHolder')
                    break
        
        common_steps = [
            'CreateApplication',
            'IssueFinancialAccount',
            'IssuePaymentCard',
            'ActivatePaymentCard'
        ]
        
        for step in common_steps:
            for ops in categories.values():
                if any(step in op for op in ops):
                    steps.append(next(op for op in ops if step in op))
                    break
        
        return steps
    
    def _create_tags(self, program_type: str) -> List[str]:
        """Create relevant tags"""
        tags = [program_type, 'graphql', 'highnote']
        
        if 'credit' in program_type:
            tags.append('credit_card')
        elif 'prepaid' in program_type:
            tags.append('prepaid_card')
        
        if 'consumer' in program_type:
            tags.append('b2c')
        elif 'commercial' in program_type:
            tags.append('b2b')
        
        return tags
    
    def _create_operations_yaml(self, program_type: str, 
                               dimensions: Dict[str, Any],
                               options: Dict[str, Any],
                               collection: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Create operations YAML documentation"""
        ops_yaml = {
            'metadata': {
                'program_type': program_type,
                'customer': dimensions.get('customer', 'Unknown'),
                'generated_at': datetime.now().isoformat(),
                'generator_version': '2.0.0'
            },
            'dimensions': dimensions,
            'options': options,
            'operations': {}
        }
        
        if collection:
            for folder in collection.get('item', []):
                if folder.get('item'):
                    category = folder['name']
                    ops_yaml['operations'][category] = []
                    
                    for op in folder.get('item', []):
                        ops_yaml['operations'][category].append({
                            'name': op.get('name'),
                            'method': op.get('request', {}).get('method', 'POST')
                        })
        
        return ops_yaml
    
    def _create_summary(self, program_type: str,
                       dimensions: Dict[str, Any],
                       options: Dict[str, Any],
                       collection: Optional[Dict[str, Any]],
                       results: Dict[str, str]) -> str:
        """Create summary report"""
        total_ops = 0
        categories = []
        
        if collection:
            for folder in collection.get('item', []):
                if folder.get('item'):
                    count = len(folder.get('item', []))
                    total_ops += count
                    categories.append(f"  - {folder['name']}: {count} operations")
        
        summary = f"""Generation Summary
{'=' * 50}
Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Configuration:
  Program Type: {program_type}
  Customer: {dimensions.get('customer', 'Unknown')}
  Environment: {dimensions.get('environment', 'Not specified')}

Results:
  Total Operations: {total_ops}
  Categories: {len(categories)}
{chr(10).join(categories)}

Generated Files:
{chr(10).join(f'  - {Path(f).name}' for f in results.values())}

Dimensions Applied:
{yaml.dump(dimensions, default_flow_style=False).strip()}

Options Applied:
{yaml.dump(options, default_flow_style=False).strip()}
"""
        return summary


def main():
    """CLI interface for unified generator"""
    parser = argparse.ArgumentParser(
        description='Unified Generator - Generate from structured JSON/YAML files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate from input file
  python unified_generator.py input.yaml
  python unified_generator.py config.json
  
  # Show sample input file
  python unified_generator.py --sample
        """
    )
    
    parser.add_argument('input_file', nargs='?', help='Input file (JSON or YAML)')
    parser.add_argument('--sample', action='store_true', 
                       help='Show sample input file format')
    parser.add_argument('--validate', action='store_true',
                       help='Validate input file without generating')
    
    args = parser.parse_args()
    
    if args.sample:
        sample = {
            "type": "collection",
            "config": {
                "program_type": "consumer_credit",
                "dimensions": {
                    "customer": "ABC Bank",
                    "environment": "sandbox",
                    "region": "us-east"
                },
                "options": {
                    "categories": ["person_account_holder", "payment_cards"],
                    "flows": ["standard_onboarding"]
                }
            },
            "outputs": ["collection", "yaml", "summary"]
        }
        
        print("Sample input file (save as .json or .yaml):\n")
        print(json.dumps(sample, indent=2))
        print("\nOr as YAML:\n")
        print(yaml.dump(sample, default_flow_style=False))
        return 0
    
    if not args.input_file:
        parser.print_help()
        return 1
    
    generator = UnifiedGenerator()
    
    try:
        if args.validate:
            # Just validate the input file
            input_data = generator._load_input_file(args.input_file)
            generator._validate_input(input_data)
            print(f"✅ Input file is valid: {args.input_file}")
        else:
            # Generate outputs
            results = asyncio.run(generator.generate_from_file(args.input_file))
            print(f"\n✅ Generation complete! Generated {len(results)} files")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())