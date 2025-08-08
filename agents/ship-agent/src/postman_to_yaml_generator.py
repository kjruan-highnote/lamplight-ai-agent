#!/usr/bin/env python3
"""
Postman to YAML Generator

Generates program YAML configuration files from Postman collections.
Analyzes the collection structure to create workflows, categories, and capabilities.
"""

import json
import yaml
import re
from pathlib import Path
from typing import Dict, List, Any, Optional, Set
from datetime import datetime
from collections import defaultdict
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class PostmanToYamlGenerator:
    """Generate program YAML configurations from Postman collections"""
    
    def __init__(self, postman_dir: Path = None, programs_dir: Path = None):
        """Initialize generator with directories"""
        base_dir = Path(__file__).parent.parent
        self.postman_dir = postman_dir or base_dir / "data" / "postman"
        self.programs_dir = programs_dir or base_dir / "data" / "programs"
        
        # Common operation patterns for workflow detection
        self.workflow_patterns = {
            'onboarding': [
                'create.*account', 'create.*holder', 'kyc', 'verify', 'approve'
            ],
            'card_issuance': [
                'issue.*card', 'create.*card', 'activate.*card', 'generate.*card'
            ],
            'transaction_processing': [
                'authorize', 'capture', 'clear', 'settle', 'transaction'
            ],
            'spend_management': [
                'spend.*rule', 'velocity.*rule', 'limit', 'control'
            ],
            'account_management': [
                'update.*account', 'suspend', 'close', 'reactivate'
            ],
            'reporting': [
                'get.*report', 'list.*transaction', 'export', 'statement'
            ],
            'webhook_management': [
                'webhook', 'notification', 'event', 'callback'
            ]
        }
        
        # Common capabilities based on operation types
        self.capability_mappings = {
            'virtual_card_issuance': ['issue.*card', 'create.*virtual.*card'],
            'physical_card_issuance': ['issue.*physical', 'ship.*card'],
            'spend_controls': ['spend.*rule', 'merchant.*control'],
            'velocity_controls': ['velocity.*rule', 'transaction.*limit'],
            'real_time_webhooks': ['webhook', 'event.*notification'],
            'transaction_monitoring': ['transaction.*event', 'authorization.*event'],
            'multi_currency': ['currency', 'fx', 'foreign.*exchange'],
            'on_demand_funding': ['funding', 'transfer.*funds'],
            'collaborative_authorization': ['collaborative', 'auth.*decision'],
            'account_management': ['account.*holder', 'business.*account'],
            'kyc_verification': ['kyc', 'identity.*verification', 'document.*upload'],
            'reporting_analytics': ['report', 'analytics', 'export.*data']
        }
    
    def extract_operation_info(self, item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Extract operation information from a Postman request item"""
        if 'request' not in item:
            return None
        
        request = item['request']
        name = item.get('name', 'Unknown')
        
        # Extract GraphQL operation type and name
        body = request.get('body', {})
        graphql = body.get('graphql', {})
        query = graphql.get('query', '')
        
        # Determine operation type
        operation_type = 'unknown'
        if query.strip().startswith('query'):
            operation_type = 'query'
        elif query.strip().startswith('mutation'):
            operation_type = 'mutation'
        elif query.strip().startswith('subscription'):
            operation_type = 'subscription'
        
        # Extract operation name from GraphQL
        operation_name = self._extract_graphql_operation_name(query) or name
        
        # Determine if this is a required operation (heuristic)
        required = self._is_required_operation(operation_name)
        
        return {
            'name': operation_name,
            'display_name': name,
            'type': operation_type,
            'required': required,
            'description': item.get('description', '')
        }
    
    def _extract_graphql_operation_name(self, query: str) -> Optional[str]:
        """Extract operation name from GraphQL query"""
        # Try to extract from query/mutation declaration
        pattern = r'(?:query|mutation|subscription)\s+(\w+)'
        match = re.search(pattern, query)
        if match:
            return match.group(1)
        
        # Try to extract first field name
        pattern = r'{\s*(\w+)'
        match = re.search(pattern, query)
        if match:
            return match.group(1)
        
        return None
    
    def _is_required_operation(self, operation_name: str) -> bool:
        """Determine if an operation should be marked as required"""
        required_patterns = [
            'create.*account', 'create.*holder', 'issue.*card',
            'activate', 'authenticate', 'authorize.*api'
        ]
        
        operation_lower = operation_name.lower()
        for pattern in required_patterns:
            if re.search(pattern, operation_lower):
                return True
        return False
    
    def categorize_operations(self, operations: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Categorize operations based on their names and types"""
        categories = defaultdict(list)
        
        for op in operations:
            category = self._determine_category(op['name'])
            categories[category].append(op)
        
        return dict(categories)
    
    def _determine_category(self, operation_name: str) -> str:
        """Determine category for an operation based on its name"""
        operation_lower = operation_name.lower()
        
        # Category patterns
        category_patterns = {
            'account_management': ['account', 'holder', 'business', 'individual'],
            'card_management': ['card', 'payment.*card', 'virtual.*card'],
            'transaction_processing': ['transaction', 'authorization', 'clearing', 'settlement'],
            'spend_controls': ['spend.*rule', 'merchant', 'category.*control'],
            'velocity_controls': ['velocity', 'limit', 'threshold'],
            'funding': ['fund', 'transfer', 'deposit', 'withdrawal'],
            'webhooks': ['webhook', 'event', 'notification', 'callback'],
            'reporting': ['report', 'export', 'list', 'get.*all'],
            'authentication': ['auth', 'token', 'api.*key', 'credential'],
            'kyc_compliance': ['kyc', 'verification', 'document', 'identity'],
            'disputes': ['dispute', 'chargeback', 'claim'],
            'rewards': ['reward', 'cashback', 'points', 'loyalty']
        }
        
        for category, patterns in category_patterns.items():
            for pattern in patterns:
                if re.search(pattern, operation_lower):
                    return category
        
        return 'general'
    
    def detect_capabilities(self, operations: List[Dict[str, Any]]) -> List[str]:
        """Detect program capabilities based on available operations"""
        capabilities = set()
        
        # Check all operations against capability patterns
        for op in operations:
            op_lower = op['name'].lower()
            for capability, patterns in self.capability_mappings.items():
                for pattern in patterns:
                    if re.search(pattern, op_lower):
                        capabilities.add(capability)
                        break
        
        return sorted(list(capabilities))
    
    def generate_workflows(self, operations: List[Dict[str, Any]], 
                          categories: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
        """Generate workflows based on operation patterns"""
        workflows = {}
        
        # Generate onboarding workflow
        onboarding_ops = self._find_workflow_operations(operations, 'onboarding')
        if onboarding_ops:
            workflows['onboarding'] = {
                'name': 'Customer Onboarding',
                'description': 'Onboard new customers and accounts',
                'required': True,
                'steps': [
                    {
                        'operation': op['name'],
                        'required': op.get('required', False),
                        'description': op.get('description', '')[:100] if op.get('description') else ''
                    }
                    for op in onboarding_ops[:5]  # Limit to 5 steps
                ]
            }
        
        # Generate card issuance workflow
        card_ops = self._find_workflow_operations(operations, 'card_issuance')
        if card_ops:
            workflows['card_issuance'] = {
                'name': 'Card Issuance',
                'description': 'Issue and activate payment cards',
                'required': True,
                'steps': [
                    {
                        'operation': op['name'],
                        'required': op.get('required', False),
                        'description': op.get('description', '')[:100] if op.get('description') else ''
                    }
                    for op in card_ops[:5]
                ]
            }
        
        # Generate transaction workflow
        transaction_ops = self._find_workflow_operations(operations, 'transaction_processing')
        if transaction_ops:
            workflows['transaction_processing'] = {
                'name': 'Transaction Processing',
                'description': 'Process and manage transactions',
                'required': False,
                'steps': [
                    {
                        'operation': op['name'],
                        'required': op.get('required', False),
                        'description': op.get('description', '')[:100] if op.get('description') else ''
                    }
                    for op in transaction_ops[:5]
                ]
            }
        
        return workflows
    
    def _find_workflow_operations(self, operations: List[Dict[str, Any]], 
                                 workflow_type: str) -> List[Dict[str, Any]]:
        """Find operations that match a workflow pattern"""
        patterns = self.workflow_patterns.get(workflow_type, [])
        matching_ops = []
        
        for op in operations:
            op_lower = op['name'].lower()
            for pattern in patterns:
                if re.search(pattern, op_lower):
                    matching_ops.append(op)
                    break
        
        # Sort by operation type preference (mutations first, then queries)
        type_order = {'mutation': 0, 'query': 1, 'subscription': 2, 'unknown': 3}
        matching_ops.sort(key=lambda x: (type_order.get(x.get('type', 'unknown'), 3), x['name']))
        
        return matching_ops
    
    def extract_entities(self, operations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract core entities from operation names"""
        entities = {}
        
        # Common entity patterns
        entity_patterns = {
            'Account': ['account', 'holder'],
            'Card': ['card', 'payment.*card'],
            'Transaction': ['transaction', 'authorization'],
            'Rule': ['rule', 'control', 'limit'],
            'Webhook': ['webhook', 'event'],
            'Report': ['report', 'statement'],
            'Transfer': ['transfer', 'funding'],
            'Dispute': ['dispute', 'chargeback']
        }
        
        # Check operations for entity references
        for op in operations:
            op_lower = op['name'].lower()
            for entity_name, patterns in entity_patterns.items():
                for pattern in patterns:
                    if re.search(pattern, op_lower) and entity_name not in entities:
                        entities[entity_name] = {
                            'name': entity_name,
                            'description': f'{entity_name} management and operations',
                            'primary': entity_name in ['Account', 'Card', 'Transaction']
                        }
        
        return list(entities.values())
    
    def generate_yaml_config(self, collection_path: Path) -> Dict[str, Any]:
        """Generate YAML configuration from a Postman collection"""
        # Load Postman collection
        with open(collection_path, 'r') as f:
            collection = json.load(f)
        
        # Extract collection info
        info = collection.get('info', {})
        collection_name = info.get('name', 'Unknown')
        
        # Extract all operations
        operations = []
        self._extract_operations_recursive(collection.get('item', []), operations)
        
        # Categorize operations
        categories = self.categorize_operations(operations)
        
        # Detect capabilities
        capabilities = self.detect_capabilities(operations)
        
        # Generate workflows
        workflows = self.generate_workflows(operations, categories)
        
        # Extract entities
        entities = self.extract_entities(operations)
        
        # Determine program type from collection name
        program_type = self._normalize_program_type(collection_name)
        
        # Build YAML configuration
        config = {
            'program_type': program_type,
            'vendor': 'highnote',  # Default vendor
            'version': '1.0.0',
            'api_type': 'graphql',
            
            'metadata': {
                'name': collection_name,
                'description': info.get('description', f'{collection_name} program configuration'),
                'base_url': '{{apiUrl}}',
                'authentication': {
                    'type': 'bearer',
                    'header': 'Authorization'
                },
                'generated_from': f'postman/{collection_path.name}',
                'generated_at': datetime.now().isoformat()
            },
            
            'capabilities': capabilities or ['api_access'],
            
            'workflows': workflows,
            
            'entities': entities,
            
            'categories': self._format_categories(categories),
            
            'compliance': {
                'standards': [
                    {'name': 'PCI_DSS', 'level': 1, 'required': True}
                ],
                'regulations': [
                    {'name': 'OFAC', 'description': 'Sanctions screening'}
                ],
                'security': {
                    'encryption': {
                        'in_transit': 'TLS 1.2+',
                        'at_rest': 'AES-256'
                    },
                    'authentication': [
                        {'type': 'api_key', 'rotation_days': 90}
                    ]
                }
            },
            
            'performance': {
                'api': {
                    'response_time_ms': 500,
                    'availability': 99.9
                },
                'rate_limits': {
                    'requests_per_second': 100,
                    'burst_limit': 500
                }
            }
        }
        
        return config
    
    def _extract_operations_recursive(self, items: List[Dict[str, Any]], 
                                     operations: List[Dict[str, Any]]):
        """Recursively extract operations from Postman collection items"""
        for item in items:
            if 'item' in item:
                # It's a folder, recurse
                self._extract_operations_recursive(item['item'], operations)
            else:
                # It's a request
                op_info = self.extract_operation_info(item)
                if op_info:
                    operations.append(op_info)
    
    def _normalize_program_type(self, collection_name: str) -> str:
        """Normalize collection name to program type"""
        # Remove common suffixes
        name = collection_name.lower()
        name = re.sub(r'[\s\-\.]', '_', name)
        name = re.sub(r'_api$', '', name)
        name = re.sub(r'_collection$', '', name)
        name = re.sub(r'_v\d+$', '', name)
        
        return name
    
    def _format_categories(self, categories: Dict[str, List[Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """Format categories for YAML output"""
        formatted = []
        
        for category_name, operations in categories.items():
            formatted.append({
                'name': category_name,
                'display_name': category_name.replace('_', ' ').title(),
                'description': f'{category_name.replace("_", " ").title()} operations',
                'operations': [
                    {
                        'name': op['name'],
                        'type': op.get('type', 'unknown'),
                        'required': op.get('required', False)
                    }
                    for op in operations
                ]
            })
        
        return formatted
    
    def generate_and_save(self, collection_name: str, output_path: Optional[Path] = None) -> Path:
        """Generate YAML config from Postman collection and save it"""
        # Find Postman collection (try different naming patterns)
        collection_path = self.postman_dir / f"{collection_name}.postman_collection.json"
        if not collection_path.exists():
            collection_path = self.postman_dir / f"{collection_name}.json"
        if not collection_path.exists():
            # Try case-insensitive match
            for file in self.postman_dir.glob("*.json"):
                if collection_name.lower() in file.stem.lower():
                    collection_path = file
                    break
        
        if not collection_path.exists():
            raise FileNotFoundError(f"Postman collection not found: {collection_name}")
        
        # Generate YAML config
        config = self.generate_yaml_config(collection_path)
        
        # Determine output path
        if output_path is None:
            program_type = config['program_type']
            output_path = self.programs_dir / f"{program_type}_generated.yaml"
        
        # Save YAML
        with open(output_path, 'w') as f:
            yaml.dump(config, f, default_flow_style=False, sort_keys=False, width=120)
        
        logger.info(f"Generated YAML config: {output_path}")
        return output_path


def main():
    """Main CLI interface"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Generate program YAML configurations from Postman collections',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate YAML from a specific Postman collection
  python postman_to_yaml_generator.py --collection ap_automation
  
  # Generate and save to specific location
  python postman_to_yaml_generator.py --collection trip_com --output data/programs/trip_com_new.yaml
  
  # Generate for all collections in postman directory
  python postman_to_yaml_generator.py --all
        """
    )
    
    parser.add_argument('--collection', help='Name of Postman collection (without .json)')
    parser.add_argument('--output', help='Output path for YAML file')
    parser.add_argument('--all', action='store_true', help='Generate for all collections')
    parser.add_argument('--postman-dir', help='Directory containing Postman collections')
    parser.add_argument('--programs-dir', help='Directory to save program YAML files')
    
    args = parser.parse_args()
    
    # Initialize generator
    generator = PostmanToYamlGenerator(
        Path(args.postman_dir) if args.postman_dir else None,
        Path(args.programs_dir) if args.programs_dir else None
    )
    
    if args.all:
        # Generate for all collections
        for collection_file in generator.postman_dir.glob("*.json"):
            collection_name = collection_file.stem
            try:
                output_path = generator.generate_and_save(collection_name)
                print(f"✓ Generated: {output_path}")
            except Exception as e:
                print(f"✗ Failed for {collection_name}: {e}")
    
    elif args.collection:
        # Generate for specific collection
        try:
            output_path = Path(args.output) if args.output else None
            result_path = generator.generate_and_save(args.collection, output_path)
            print(f"Successfully generated YAML config: {result_path}")
            
            # Show summary
            with open(result_path, 'r') as f:
                config = yaml.safe_load(f)
            
            print("\nSummary:")
            print(f"  Program Type: {config['program_type']}")
            print(f"  Capabilities: {len(config.get('capabilities', []))}")
            print(f"  Workflows: {len(config.get('workflows', {}))}")
            print(f"  Categories: {len(config.get('categories', []))}")
            
            # Count total operations
            total_ops = sum(
                len(cat.get('operations', [])) 
                for cat in config.get('categories', [])
            )
            print(f"  Total Operations: {total_ops}")
            
        except Exception as e:
            print(f"Error: {e}")
            return 1
    
    else:
        parser.print_help()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())