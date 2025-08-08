#!/usr/bin/env python3
"""
Postman Sync Utility

Synchronizes operations from Postman collections (source of truth) to operations JSON files.
This ensures consistency between what's in Postman and what the solution generator uses.
"""

import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class PostmanOperationExtractor:
    """Extracts operations from Postman collections"""
    
    @staticmethod
    def extract_graphql_info(request: Dict[str, Any]) -> Dict[str, Any]:
        """Extract GraphQL query and variables from request"""
        body = request.get('body', {})
        graphql = body.get('graphql', {})
        
        query = graphql.get('query', '')
        variables = graphql.get('variables', '{}')
        
        # Parse variables if they're a string
        if isinstance(variables, str):
            try:
                variables = json.loads(variables)
            except:
                variables = {}
        
        # Determine operation type
        operation_type = 'unknown'
        if query.strip().startswith('query'):
            operation_type = 'query'
        elif query.strip().startswith('mutation'):
            operation_type = 'mutation'
        elif query.strip().startswith('subscription'):
            operation_type = 'subscription'
        
        return {
            'query': query,
            'variables': variables,
            'operation_type': operation_type
        }
    
    @staticmethod
    def extract_operation_name(query: str) -> str:
        """Extract operation name from GraphQL query"""
        import re
        
        # Try to extract operation name from query/mutation declaration
        pattern = r'(?:query|mutation|subscription)\s+(\w+)'
        match = re.search(pattern, query)
        if match:
            return match.group(1)
        
        # Fallback: try to extract first field name
        pattern = r'{\s*(\w+)'
        match = re.search(pattern, query)
        if match:
            return match.group(1)
        
        return 'UnknownOperation'
    
    @staticmethod
    def process_item(item: Dict[str, Any], parent_path: str = '', 
                    program_type: str = 'unknown') -> List[Dict[str, Any]]:
        """Process a Postman item (folder or request) recursively"""
        operations = []
        
        if 'item' in item:
            # It's a folder
            folder_name = item.get('name', 'Unknown')
            current_path = f"{parent_path}/{folder_name}" if parent_path else folder_name
            
            for sub_item in item.get('item', []):
                operations.extend(
                    PostmanOperationExtractor.process_item(
                        sub_item, current_path, program_type
                    )
                )
        else:
            # It's a request
            request = item.get('request', {})
            graphql_info = PostmanOperationExtractor.extract_graphql_info(request)
            
            # Build operation object
            operation = {
                'name': item.get('name', 'Unknown'),
                'program_type': program_type,
                'operation_type': graphql_info['operation_type'],
                'graphql': {
                    'query': graphql_info['query'],
                    'variables': graphql_info['variables']
                },
                'headers': {
                    'content-type': 'application/json'
                },
                'metadata': {
                    'category': parent_path.split('/')[-1] if parent_path else 'uncategorized',
                    'path': parent_path,
                    'description': item.get('description', ''),
                    'tags': [],
                    'requires': [],
                    'produces': []
                },
                'version': '1.0.0',
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            # Extract tags from the operation name and path
            tags = []
            if '/' in parent_path:
                tags.extend([p.lower().replace(' ', '_') for p in parent_path.split('/')])
            
            # Add operation type as tag
            if graphql_info['operation_type'] != 'unknown':
                tags.append(graphql_info['operation_type'])
            
            # Add action words as tags
            name_lower = operation['name'].lower()
            for action in ['create', 'get', 'update', 'delete', 'list', 'issue', 'activate', 'suspend', 'close']:
                if action in name_lower:
                    tags.append(action)
            
            operation['metadata']['tags'] = list(set(tags))
            
            operations.append(operation)
        
        return operations


class PostmanToOperationsSync:
    """Syncs Postman collections to operations JSON files"""
    
    def __init__(self, postman_dir: Path = None, operations_dir: Path = None):
        base_dir = Path(__file__).parent.parent
        self.postman_dir = postman_dir or base_dir / "data" / "postman"
        self.operations_dir = operations_dir or base_dir / "data" / "operations"
        self.operations_dir.mkdir(parents=True, exist_ok=True)
    
    def sync_all(self) -> Dict[str, int]:
        """Sync all Postman collections to operations files"""
        results = {}
        
        for postman_file in self.postman_dir.glob('*.json'):
            try:
                count = self.sync_collection(postman_file)
                results[postman_file.stem] = count
                logger.info(f"Synced {count} operations from {postman_file.name}")
            except Exception as e:
                logger.error(f"Failed to sync {postman_file}: {e}")
                results[postman_file.stem] = -1
        
        return results
    
    def sync_collection(self, postman_file: Path) -> int:
        """Sync a single Postman collection to operations file"""
        
        # Load Postman collection
        with open(postman_file, 'r') as f:
            collection = json.load(f)
        
        # Determine program type from filename
        program_type = self._get_program_type(postman_file.stem)
        
        # Extract operations
        operations = []
        for item in collection.get('item', []):
            operations.extend(
                PostmanOperationExtractor.process_item(item, '', program_type)
            )
        
        # Save to operations file
        output_file = self.operations_dir / f"{program_type}_operations.json"
        with open(output_file, 'w') as f:
            json.dump(operations, f, indent=2)
        
        logger.info(f"Saved {len(operations)} operations to {output_file}")
        
        # Also update the YAML config if it exists
        self._update_yaml_config(program_type, operations)
        
        return len(operations)
    
    def _get_program_type(self, collection_name: str) -> str:
        """Convert collection name to program type"""
        # Handle special cases
        mappings = {
            'Consumer Credit': 'consumer_credit',
            'Trip.com': 'trip_com',
            'Trip_com': 'trip_com',
            'AP Automation': 'ap_automation',
            'Fleet': 'fleet'
        }
        
        if collection_name in mappings:
            return mappings[collection_name]
        
        # Default: lowercase with underscores
        return collection_name.lower().replace(' ', '_').replace('-', '_').replace('.', '_')
    
    def _update_yaml_config(self, program_type: str, operations: List[Dict[str, Any]]):
        """Update YAML config with operation categories from Postman"""
        yaml_dir = self.operations_dir.parent / 'programs'
        yaml_file = yaml_dir / f"{program_type}.yaml"
        
        if not yaml_file.exists():
            logger.info(f"No YAML config found for {program_type}, skipping update")
            return
        
        try:
            import yaml
            
            # Load existing YAML
            with open(yaml_file, 'r') as f:
                config = yaml.safe_load(f)
            
            # Build categories from operations
            categories_dict = {}
            for op in operations:
                category = op['metadata'].get('category', 'uncategorized')
                if category not in categories_dict:
                    categories_dict[category] = {
                        'name': category.replace('_', ' ').title(),
                        'description': f"{category.replace('_', ' ').title()} operations",
                        'operations': []
                    }
                categories_dict[category]['operations'].append(op['name'])
            
            # Update config
            config['categories'] = list(categories_dict.values())
            config['metadata'] = config.get('metadata', {})
            config['metadata']['last_sync'] = datetime.now().isoformat()
            config['metadata']['operation_count'] = len(operations)
            
            # Save updated YAML
            with open(yaml_file, 'w') as f:
                yaml.dump(config, f, default_flow_style=False, sort_keys=False)
            
            logger.info(f"Updated YAML config for {program_type}")
            
        except Exception as e:
            logger.warning(f"Could not update YAML for {program_type}: {e}")


def main():
    """Main sync function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Sync Postman collections to operations files')
    parser.add_argument('--postman-dir', 
                       help='Directory containing Postman collections')
    parser.add_argument('--operations-dir',
                       help='Directory to save operations files')
    parser.add_argument('--collection',
                       help='Specific collection to sync (optional)')
    
    args = parser.parse_args()
    
    syncer = PostmanToOperationsSync(
        Path(args.postman_dir) if args.postman_dir else None,
        Path(args.operations_dir) if args.operations_dir else None
    )
    
    if args.collection:
        # Sync specific collection
        postman_file = syncer.postman_dir / f"{args.collection}.json"
        if postman_file.exists():
            count = syncer.sync_collection(postman_file)
            print(f"Synced {count} operations from {args.collection}")
        else:
            print(f"Collection not found: {postman_file}")
    else:
        # Sync all collections
        results = syncer.sync_all()
        
        print("\nSync Results:")
        print("-" * 40)
        for collection, count in results.items():
            if count >= 0:
                print(f"  {collection}: {count} operations")
            else:
                print(f"  {collection}: FAILED")
        
        total = sum(c for c in results.values() if c >= 0)
        print(f"\nTotal operations synced: {total}")


if __name__ == "__main__":
    main()