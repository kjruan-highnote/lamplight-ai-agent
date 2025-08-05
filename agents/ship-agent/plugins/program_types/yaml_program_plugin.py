"""
YAML-based program type plugin that loads configuration from YAML and operations from MongoDB
"""
import sys
import os
import yaml
import json
from typing import Dict, Any, List, Optional
from pathlib import Path

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.plugin_base import ProgramTypePlugin

# MongoDB is optional - will work with just YAML if MongoDB is not available
try:
    from pymongo import MongoClient
    MONGODB_AVAILABLE = True
except ImportError:
    MONGODB_AVAILABLE = False


class YAMLProgramPlugin(ProgramTypePlugin):
    """
    Lightweight plugin that loads program structure from YAML and operations from MongoDB
    """
    
    def __init__(self, program_type: str):
        super().__init__(program_type, "2.0.0")
        self.program_type = program_type
        self.config = None
        self.mongodb = None
        self._load_config()
        self._connect_mongodb()
        
    def _load_config(self):
        """Load YAML configuration for the program type"""
        yaml_path = Path(f"data/programs/{self.program_type}.yaml")
        if not yaml_path.exists():
            # Try alternative paths
            yaml_path = Path(__file__).parent.parent.parent / f"data/programs/{self.program_type}.yaml"
        
        if yaml_path.exists():
            with open(yaml_path, 'r') as f:
                self.config = yaml.safe_load(f)
        else:
            # Create minimal config if file doesn't exist
            self.config = {
                'program_type': self.program_type,
                'version': '1.0.0',
                'categories': [],
                'operation_flows': {}
            }
    
    def _connect_mongodb(self):
        """Connect to MongoDB if available"""
        if MONGODB_AVAILABLE and os.getenv('MONGODB_URI'):
            try:
                client = MongoClient(os.getenv('MONGODB_URI'))
                self.mongodb = client[os.getenv('MONGODB_DATABASE', 'ship_agent')]
            except Exception as e:
                print(f"MongoDB connection failed: {e}")
                self.mongodb = None
    
    def initialize(self, config: Dict[str, Any]) -> bool:
        """Initialize the plugin"""
        if config:
            self.config.update(config)
        return True
    
    def validate_config(self, config: Dict[str, Any]) -> bool:
        """Validate plugin configuration"""
        return 'program_type' in self.config
    
    def get_rules(self) -> Dict[str, Any]:
        """Get business rules from YAML config"""
        return self.config.get('rules', {})
    
    def get_patterns(self) -> Dict[str, Any]:
        """Get operation patterns organized by category"""
        patterns = {
            'categories': self.config.get('categories', []),
            'flows': self.config.get('operation_flows', {}),
            'dimensions': self.config.get('dimensions', {})
        }
        
        # If MongoDB is available, fetch actual operations
        if self.mongodb:
            for category in patterns['categories']:
                category['operations_detail'] = []
                for op_name in category.get('operations', []):
                    operation = self.get_operation(op_name)
                    if operation:
                        category['operations_detail'].append(operation)
        
        return patterns
    
    def get_operation(self, operation_name: str) -> Optional[Dict[str, Any]]:
        """
        Fetch actual GraphQL query/mutation from MongoDB
        """
        if not self.mongodb:
            return None
            
        try:
            operation = self.mongodb.operations.find_one({
                "name": operation_name,
                "program_type": self.program_type
            })
            
            if operation:
                # Remove MongoDB _id from response
                operation.pop('_id', None)
                return operation
        except Exception as e:
            print(f"Error fetching operation {operation_name}: {e}")
            
        return None
    
    def get_flow(self, flow_name: str) -> Dict[str, Any]:
        """
        Get operation sequence for a specific flow
        """
        flows = self.config.get('operation_flows', {})
        flow = flows.get(flow_name, {})
        
        if isinstance(flow, dict):
            # Enhance flow with actual operations if MongoDB is available
            if self.mongodb and 'steps' in flow:
                flow['operations'] = []
                for step in flow['steps']:
                    operation = self.get_operation(step)
                    if operation:
                        flow['operations'].append(operation)
            return flow
        else:
            # Old format - just list of steps
            return {
                'steps': flow,
                'description': f"Flow: {flow_name}"
            }
    
    def get_required_fields(self) -> List[str]:
        """
        Get required fields from YAML config
        """
        # This can be defined in YAML if needed
        return self.config.get('required_fields', [])
    
    def validate_request(self, request: Dict[str, Any]) -> bool:
        """
        Simple validation - just check if operation exists
        """
        operation_name = request.get('operation')
        if not operation_name:
            return True
            
        # Check if operation is in any category
        for category in self.config.get('categories', []):
            if operation_name in category.get('operations', []):
                return True
                
        return False
    
    def get_all_operations(self) -> List[str]:
        """
        Get list of all operation names
        """
        operations = []
        for category in self.config.get('categories', []):
            operations.extend(category.get('operations', []))
        return operations
    
    def get_operations_by_category(self, category_name: str) -> List[str]:
        """
        Get operations for a specific category
        """
        for category in self.config.get('categories', []):
            if category['name'] == category_name:
                return category.get('operations', [])
        return []
    
    def get_metadata(self) -> Dict[str, Any]:
        """
        Get program metadata
        """
        return self.config.get('metadata', {})
    
    def generate_collection(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generate a Postman collection based on context
        """
        collection = {
            "info": {
                "name": f"{self.program_type} - {context.get('customer', 'Generated')}",
                "description": self.config.get('metadata', {}).get('description', ''),
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            "item": [],
            "variable": []
        }
        
        # Add variables from context
        for key, value in context.items():
            collection['variable'].append({
                "key": key,
                "value": value,
                "type": "string"
            })
        
        # Build collection structure from categories
        categories_to_include = context.get('categories', [cat['name'] for cat in self.config.get('categories', [])])
        
        for category in self.config.get('categories', []):
            if category['name'] not in categories_to_include:
                continue
                
            folder = {
                "name": category['name'],
                "description": category.get('description', ''),
                "item": []
            }
            
            # Add operations to folder
            for op_name in category.get('operations', []):
                if self.mongodb:
                    # Fetch from MongoDB
                    operation = self.get_operation(op_name)
                    if operation:
                        folder['item'].append(self._format_postman_request(operation, context))
                else:
                    # Create placeholder
                    folder['item'].append({
                        "name": op_name,
                        "request": {
                            "method": "POST",
                            "header": [{"key": "Content-Type", "value": "application/json"}],
                            "url": "{{apiUrl}}",
                            "description": f"Operation: {op_name}"
                        }
                    })
            
            if folder['item']:
                collection['item'].append(folder)
        
        return collection
    
    def _format_postman_request(self, operation: Dict[str, Any], context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format MongoDB operation as Postman request
        """
        request = {
            "name": operation.get('name', 'Unknown'),
            "request": {
                "method": "POST",
                "header": [],
                "url": {
                    "raw": "{{apiUrl}}",
                    "host": ["{{apiUrl}}"]
                }
            }
        }
        
        # Add headers
        headers = operation.get('headers', {})
        for key, value in headers.items():
            request['request']['header'].append({"key": key, "value": value})
        
        # Add GraphQL body if present
        if 'graphql' in operation:
            request['request']['body'] = {
                "mode": "graphql",
                "graphql": {
                    "query": operation['graphql'].get('query', ''),
                    "variables": json.dumps(operation['graphql'].get('variables', {}))
                }
            }
        
        # Add description from metadata
        if 'metadata' in operation:
            request['description'] = operation['metadata'].get('description', '')
        
        return request